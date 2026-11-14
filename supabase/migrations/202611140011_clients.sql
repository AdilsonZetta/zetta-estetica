-- Cadastro operacional por unidade. Sem transporte, URL ou leitura FLW homologada.
insert into private.role_permissions
select r,p from unnest(array['clinic_admin','manager','reception']) r
cross join unnest(array['clients.read','clients.write']) p;
insert into private.role_permissions values ('clinic_admin','clients.merge'),('manager','clients.merge'),('professional','clients.read'),('finance','clients.read'),('auditor','clients.read');
create table private.clients (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, unit_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 160), phone_raw text check(length(phone_raw)<=60),
 phone_e164 text check(phone_e164 ~ '^\+[1-9][0-9]{7,14}$'), email text check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 state text not null default 'active' check(state in ('active','archived')), merged_into uuid,
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(tenant_id,id), unique(tenant_id,unit_id,id),
 foreign key(tenant_id,unit_id) references public.units(tenant_id,id),
 foreign key(tenant_id,unit_id,merged_into) references private.clients(tenant_id,unit_id,id),
 check((state='archived')=(merged_into is not null)), check(merged_into<>id)
);
create index clients_search_name on private.clients(tenant_id,unit_id,lower(name));
create index clients_search_phone on private.clients(tenant_id,unit_id,phone_e164);
create table private.client_links (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, unit_id uuid not null, client_id uuid not null, integration_id uuid not null,
 kind text not null check(kind in ('contact','card')), external_ref text not null check(external_ref ~ '^[A-Za-z0-9_-]{1,100}$'),
 state text not null check(state in ('pending_review','confirmed','retired')),
 mode text not null default 'manual' check(mode in ('manual','synchronized')),
 source_ref text not null check(source_ref ~ '^[A-Za-z0-9_-]{1,100}$'), source_updated_at timestamptz,
 updated_at timestamptz not null default now(), updated_by uuid not null,
 unique(tenant_id,id), foreign key(tenant_id,unit_id,client_id) references private.clients(tenant_id,unit_id,id),
 foreign key(tenant_id,integration_id) references private.tenant_integrations(tenant_id,id),
 check(mode<>'synchronized' or source_updated_at is not null)
);
create unique index client_links_external on private.client_links(tenant_id,integration_id,kind,external_ref) where state<>'retired';
create table private.client_events (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, unit_id uuid not null, client_id uuid not null,
 actor_id uuid not null, action text not null, effects jsonb not null default '{}', occurred_at timestamptz not null default now(),
 foreign key(tenant_id,unit_id,client_id) references private.clients(tenant_id,unit_id,id)
);
do $$ declare n text; begin
 foreach n in array array['clients','client_links','client_events'] loop
 execute format('alter table private.%I enable row level security',n);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',n);
 end loop;
end $$;
create function private.normalize_client_phone(raw text) returns text
language sql immutable set search_path='' as $$
 select case when btrim(raw) ~ '^\+[0-9 ()-]+$' and regexp_replace(raw,'[^0-9]','','g') ~ '^[1-9][0-9]{7,14}$'
 then '+'||regexp_replace(raw,'[^0-9]','','g')
 -- Telefone nacional só com DDD explícito. Não inventa DDD nem nono dígito.
 when btrim(raw) !~ '^\+' and regexp_replace(raw,'[^0-9]','','g') ~ '^[1-9][0-9]{9,10}$' and raw ~ '^[0-9 ()-]+$'
 then '+55'||regexp_replace(raw,'[^0-9]','','g') end
$$;
create function private.client_event(t uuid,u uuid,c uuid,a text,e jsonb) returns void
language plpgsql set search_path='' as $$ begin
 insert into private.client_events(tenant_id,unit_id,client_id,actor_id,action,effects) values(t,u,c,auth.uid(),a,e);
 insert into public.audit_logs(tenant_id,unit_id,actor_id,action,entity,entity_id) values(t,u,auth.uid(),a,'client',c::text);
end $$;
create function public.search_clients(tenant uuid,unit uuid,query text default '',after_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$ begin
 if unit is null or not private.is_allowed(tenant,unit,'clients.read','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if length(query)>160 then raise exception 'Pesquisa longa' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from (
 select x.* from private.clients x where x.tenant_id=tenant and x.unit_id=unit and (after_id is null or x.id>after_id)
 and (coalesce(query,'')='' or position(lower(query) in lower(x.name))>0 or
 (regexp_replace(query,'[^0-9]','','g')<>'' and position(regexp_replace(query,'[^0-9]','','g') in coalesce(x.phone_e164,regexp_replace(x.phone_raw,'[^0-9]','','g')))>0))
 order by x.id limit 50) c),'[]'::jsonb);
end $$;
create function public.save_client(tenant uuid,unit uuid,name text,phone text default null,email text default null,client uuid default null,expected_version integer default null,reviewed boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare c private.clients; n text:=btrim(name); ph text:=nullif(btrim(phone),''); em text:=nullif(lower(btrim(email)),''); norm text;
begin
 if unit is null or not private.is_allowed(tenant,unit,'clients.write','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if n is null or length(n) not between 1 and 160 or length(ph)>60 or (em is not null and (length(em)>254 or em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) then raise exception 'Cadastro inválido' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||unit::text,5));
 norm:=private.normalize_client_phone(ph);
 if client is not null then
 select * into c from private.clients where tenant_id=tenant and unit_id=unit and id=client for update;
 if c.id is null or c.state<>'active' then raise exception 'Cliente indisponível' using errcode='22023'; end if;
 if expected_version is distinct from c.version then raise exception 'Cadastro mudou; recarregue a ficha' using errcode='40001'; end if;
 end if;
 if reviewed is distinct from true and ((ph is not null and norm is null) or exists(select 1 from private.clients x where x.tenant_id=tenant and x.unit_id=unit and x.state='active' and x.id<>coalesce(client,'00000000-0000-0000-0000-000000000000') and (lower(x.name)=lower(n) or (norm is not null and x.phone_e164=norm) or (em is not null and x.email=em)))) then
 raise exception 'Correspondência ambígua ou telefone incompleto: revisão obrigatória' using errcode='22023'; end if;
 if client is null then
 insert into private.clients(tenant_id,unit_id,name,phone_raw,phone_e164,email) values(tenant,unit,n,ph,norm,em) returning * into c;
 perform private.client_event(tenant,unit,c.id,'client_created',jsonb_build_object('reviewed',reviewed));
 else
 update private.clients set name=n,phone_raw=ph,phone_e164=norm,email=em,version=version+1,updated_at=now() where id=c.id;
 perform private.client_event(tenant,unit,c.id,'client_updated',jsonb_build_object('previous_version',c.version,'phone_changed',c.phone_raw is distinct from ph,'reviewed',reviewed));
 end if;
 return c.id;
end $$;
create function public.set_client_link(tenant uuid,unit uuid,client uuid,kind text,reference text,source text,link_state text default 'pending_review',link uuid default null) returns uuid
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
 update private.client_links set kind=set_client_link.kind,external_ref=reference,source_ref=source,state=link_state,updated_at=now(),updated_by=auth.uid() where id=l.id;
 else
 insert into private.client_links(tenant_id,unit_id,client_id,integration_id,kind,external_ref,source_ref,state,updated_by)
 values(tenant,unit,client,i,kind,reference,source,link_state,auth.uid()) returning id into link;
 end if;
 update private.clients set version=version+1,updated_at=now() where id=client;
 perform private.client_event(tenant,unit,client,'client_link_reviewed',jsonb_build_object('link_id',coalesce(link,l.id),'previous',case when l.id is null then null else to_jsonb(l) end,'reference',reference,'kind',kind,'state',link_state,'source',source));
 return coalesce(link,l.id);
end $$;
create function public.merge_clients(tenant uuid,unit uuid,source uuid,survivor uuid,source_version integer,survivor_version integer,reason text,confirmed boolean default false) returns jsonb
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
 return (select effects from private.client_events where tenant_id=tenant and client_id=source and action='client_merged' order by occurred_at desc limit 1);
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
create function public.client_detail(tenant uuid,unit uuid,client uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c private.clients; history jsonb; mods jsonb;
begin
 if unit is null or not private.is_allowed(tenant,unit,'clients.read','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 select * into c from private.clients where tenant_id=tenant and unit_id=unit and id=client;
 if c.id is null then raise exception 'Cliente indisponível' using errcode='22023'; end if;
 with recursive lineage as (
 select id from private.clients where tenant_id=tenant and unit_id=unit and id=client
 union all select x.id from private.clients x join lineage l on x.merged_into=l.id where x.tenant_id=tenant and x.unit_id=unit
 ) select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at,e.id),'[]') into history from private.client_events e where e.tenant_id=tenant and e.unit_id=unit and e.client_id in(select id from lineage);
 select coalesce(jsonb_agg(jsonb_build_object('key',m.key,'name',m.name)),'[]') into mods from public.module_catalog m where m.key<>'core' and private.is_allowed(tenant,unit,m.permission,m.key);
 return jsonb_build_object('client',to_jsonb(c),'links',coalesce((select jsonb_agg(to_jsonb(l) order by l.updated_at,l.id) from private.client_links l where l.tenant_id=tenant and l.unit_id=unit and l.client_id=client),'[]'),'history',history,'modules',mods,'crm_url',null,'crm_code','CAPABILITY_NOT_VERIFIED');
end $$;
create function public.preview_client_import(tenant uuid,unit uuid,rows jsonb) returns jsonb
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
 report:=report||jsonb_build_array(jsonb_build_object('line',n,'source_ref',r->>'source_ref','name',nm,'phone_e164',ph,'candidates',candidates,'errors',errors,'status',case when jsonb_array_length(errors)>0 then 'rejected' when jsonb_array_length(candidates)>0 or exists(select 1 from jsonb_array_elements(rows) x where x<>r and (x->>'source_ref'=r->>'source_ref' or lower(btrim(x->>'name'))=lower(nm) or (ph is not null and private.normalize_client_phone(x->>'phone')=ph))) or (select count(*) from jsonb_array_elements(rows) x where x=r)>1 then 'review' else 'new' end));
 end loop;
 return jsonb_build_object('mapping','clients.manual.v1','dry_run',true,'rows',report,'total',n,'rejected',(select count(*) from jsonb_array_elements(report) x where x->>'status'='rejected'),'review',(select count(*) from jsonb_array_elements(report) x where x->>'status'='review'));
end $$;
revoke all on function private.normalize_client_phone(text),private.client_event(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.search_clients(uuid,uuid,text,uuid), public.save_client(uuid,uuid,text,text,text,uuid,integer,boolean), public.set_client_link(uuid,uuid,uuid,text,text,text,text,uuid), public.merge_clients(uuid,uuid,uuid,uuid,integer,integer,text,boolean), public.client_detail(uuid,uuid,uuid),public.preview_client_import(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.search_clients(uuid,uuid,text,uuid), public.save_client(uuid,uuid,text,text,text,uuid,integer,boolean), public.set_client_link(uuid,uuid,uuid,text,text,text,text,uuid), public.merge_clients(uuid,uuid,uuid,uuid,integer,integer,text,boolean), public.client_detail(uuid,uuid,uuid),public.preview_client_import(uuid,uuid,jsonb) to authenticated;
