-- Revisão do Prompt 05: preservar a migration 011 já aplicada.
-- Remover assinatura antiga evita bypass da versão e ambiguidade no PostgREST.
drop function public.set_client_link(uuid,uuid,uuid,text,text,text,text,uuid);
create or replace function public.search_clients(tenant uuid,unit uuid,query text default '',after_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q text:=btrim(coalesce(query,''));
begin
 if unit is null or not private.is_allowed(tenant,unit,'clients.read','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if length(query)>160 then raise exception 'Pesquisa longa' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from (
 select x.* from private.clients x where x.tenant_id=tenant and x.unit_id=unit and (after_id is null or x.id>after_id)
 and (q='' or position(lower(q) in lower(x.name))>0 or
 (regexp_replace(q,'[^0-9]','','g')<>'' and position(regexp_replace(q,'[^0-9]','','g') in coalesce(x.phone_e164,regexp_replace(x.phone_raw,'[^0-9]','','g')))>0))
 order by x.id limit 50) c),'[]'::jsonb);
end $$;
create or replace function public.merge_clients(tenant uuid,unit uuid,source uuid,survivor uuid,source_version integer,survivor_version integer,reason text,confirmed boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.clients; d private.clients; moved integer; result jsonb;
begin
 if unit is null or not private.is_allowed(tenant,unit,'clients.merge','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if confirmed is distinct from true or reason is null or length(btrim(reason)) not between 5 and 300 or source is null or survivor is null or source=survivor then raise exception 'Revisão e motivo obrigatórios' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||unit::text,5));
 perform id from private.clients where tenant_id=tenant and unit_id=unit and id in(source,survivor) order by id for update;
 select * into s from private.clients where tenant_id=tenant and unit_id=unit and id=source;
 select * into d from private.clients where tenant_id=tenant and unit_id=unit and id=survivor;
 if s.id is null or d.id is null then raise exception 'Clientes indisponíveis' using errcode='22023'; end if;
 if s.merged_into=survivor and d.state='active' then
 select effects into result from private.client_events
 where tenant_id=tenant and unit_id=unit and client_id=source and action='client_merged'
 order by occurred_at desc,id desc limit 1;
 -- Replay é da operação original, não uma nova revisão das versões atuais.
 if (result->>'source_version')::integer=source_version and (result->>'survivor_version')::integer=survivor_version then
 return result;
 end if;
 end if;
 if s.state<>'active' or d.state<>'active' then raise exception 'Cliente arquivado' using errcode='22023'; end if;
 if source_version is distinct from s.version or survivor_version is distinct from d.version then raise exception 'Ficha mudou; refaça a revisão' using errcode='40001'; end if;
 -- Somente vínculos desta etapa são mutáveis. Histórico e eventos de integrações não são reescritos.
 update private.client_links set client_id=survivor,updated_at=now(),updated_by=auth.uid() where tenant_id=tenant and unit_id=unit and client_id=source;
 get diagnostics moved=row_count;
 update private.clients set state='archived',merged_into=survivor,version=version+1,updated_at=now() where id=source;
 update private.clients set version=version+1,updated_at=now() where id=survivor;
 result:=jsonb_build_object('source',source,'survivor',survivor,'moved_links',moved,'reason',btrim(reason),'source_version',s.version,'survivor_version',d.version);
 perform private.client_event(tenant,unit,source,'client_merged',result);
 perform private.client_event(tenant,unit,survivor,'client_merge_received',result);
 return result;
end $$;
create or replace function public.preview_client_import(tenant uuid,unit uuid,rows jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; n integer:=0; report jsonb:='[]'; errors jsonb; candidates jsonb; ph text; nm text; em text;
begin
 if unit is null or not private.is_allowed(tenant,unit,'clients.write','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if rows is null or jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>100 or pg_column_size(rows)>100000 then raise exception 'Amostra: máximo 100 linhas e 100 KB' using errcode='22023'; end if;
 for r in select value from jsonb_array_elements(rows) loop
 n:=n+1; errors:='[]'; nm:=btrim(r->>'name'); ph:=private.normalize_client_phone(r->>'phone'); em:=nullif(btrim(r->>'email'),'');
 if jsonb_typeof(r)<>'object' or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(r)='object' then r else '{}' end) k where k not in ('name','phone','email','source_ref')) then errors:=errors||'"Campos fora do mapeamento v1"'::jsonb; end if;
 if jsonb_typeof(r->'name') is distinct from 'string' or nm is null or length(nm) not between 1 and 160 then errors:=errors||'"Nome obrigatório (até 160 caracteres)"'::jsonb; end if;
 if (r ? 'phone' and jsonb_typeof(r->'phone') not in ('string','null')) or length(r->>'phone')>60 or (nullif(btrim(r->>'phone'),'') is not null and ph is null) then errors:=errors||'"Telefone sem país/DDD suficiente"'::jsonb; end if;
 if (r ? 'email' and jsonb_typeof(r->'email') not in ('string','null')) or em is not null and (length(em)>254 or em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then errors:=errors||'"E-mail inválido"'::jsonb; end if;
 if jsonb_typeof(r->'source_ref') is distinct from 'string' or r->>'source_ref' is null or r->>'source_ref' !~ '^[A-Za-z0-9_-]{1,100}$' then errors:=errors||'"Referência de origem obrigatória"'::jsonb; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'phone',x.phone_e164)),'[]') into candidates from private.clients x where x.tenant_id=tenant and x.unit_id=unit and x.state='active' and (lower(x.name)=lower(nm) or (ph is not null and x.phone_e164=ph) or (em is not null and x.email=lower(em)));
 report:=report||jsonb_build_array(jsonb_build_object('line',n,'source_ref',r->>'source_ref','name',nm,'phone_e164',ph,'candidates',candidates,'errors',errors,'status',case when jsonb_array_length(errors)>0 then 'rejected' when jsonb_array_length(candidates)>0 or exists(select 1 from jsonb_array_elements(rows) x where x<>r and (x->>'source_ref'=r->>'source_ref' or lower(btrim(x->>'name'))=lower(nm) or (ph is not null and private.normalize_client_phone(x->>'phone')=ph) or (em is not null and lower(btrim(x->>'email'))=lower(em)))) or (select count(*) from jsonb_array_elements(rows) x where x=r)>1 then 'review' else 'new' end));
 end loop;
 return jsonb_build_object('mapping','clients.manual.v1','dry_run',true,'rows',report,'total',n,'rejected',(select count(*) from jsonb_array_elements(report) x where x->>'status'='rejected'),'review',(select count(*) from jsonb_array_elements(report) x where x->>'status'='review'));
end $$;
create or replace function public.set_client_link(tenant uuid,unit uuid,client uuid,kind text,reference text,source text,link_state text default 'pending_review',link uuid default null,expected_version integer default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare c private.clients; i uuid; l private.client_links;
begin
 if unit is null or not private.is_allowed(tenant,unit,'clients.write','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if kind is null or kind not in ('contact','card') or reference is null or reference !~ '^[A-Za-z0-9_-]{1,100}$' or source is null or source !~ '^[A-Za-z0-9_-]{1,100}$' or link_state is null or link_state not in ('pending_review','confirmed','retired') then raise exception 'Vínculo inválido' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||unit::text,5));
 select * into c from private.clients where tenant_id=tenant and unit_id=unit and id=client for update;
 if c.id is null or c.state<>'active' then raise exception 'Cliente indisponível' using errcode='22023'; end if;
 insert into private.tenant_integrations(tenant_id) values(tenant) on conflict(tenant_id,provider) do nothing;
 select id into i from private.tenant_integrations where tenant_id=tenant and provider='flw';
 if link is not null then
 select * into l from private.client_links where tenant_id=tenant and unit_id=unit and client_id=client and id=link for update;
 if l.id is null then raise exception 'Vínculo indisponível' using errcode='22023'; end if;
 if expected_version is distinct from c.version then raise exception 'Ficha mudou; refaça a revisão' using errcode='40001'; end if;
 update private.client_links set kind=set_client_link.kind,external_ref=reference,source_ref=source,state=link_state,mode='manual',source_updated_at=null,updated_at=now(),updated_by=auth.uid() where id=l.id;
 else
 insert into private.client_links(tenant_id,unit_id,client_id,integration_id,kind,external_ref,source_ref,state,updated_by)
 values(tenant,unit,client,i,kind,reference,source,link_state,auth.uid()) returning id into link;
 end if;
 update private.clients set version=version+1,updated_at=now() where id=client;
 perform private.client_event(tenant,unit,client,'client_link_reviewed',jsonb_build_object('link_id',coalesce(link,l.id),'previous',case when l.id is null then null else to_jsonb(l) end,'reference',reference,'kind',kind,'state',link_state,'source',source));
 return coalesce(link,l.id);
end $$;
revoke all on function public.set_client_link(uuid,uuid,uuid,text,text,text,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.set_client_link(uuid,uuid,uuid,text,text,text,text,uuid,integer) to authenticated;
