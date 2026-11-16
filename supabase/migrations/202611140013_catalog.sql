-- Prompt 06: catálogo operacional do núcleo; reservas pertencem ao Prompt 07.
-- Dependência padrão PostgreSQL, criada também no Supabase hospedado pela migration.
create extension if not exists btree_gist with schema extensions;
insert into private.role_permissions select r,p from unnest(array['clinic_admin','manager']) r cross join unnest(array['catalog.read','catalog.write']) p;
insert into private.role_permissions select r,'catalog.read' from unnest(array['reception','professional','finance','auditor']) r;
alter table public.units add column timezone text not null default 'America/Sao_Paulo';
create function private.validate_unit_timezone() returns trigger language plpgsql set search_path='' as $$ begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone and name like '%/%' and name not like 'posix/%' and name not like 'right/%') then raise exception 'Fuso IANA inválido' using errcode='22023'; end if;
 return new;
end $$;
create trigger unit_timezone before insert or update of timezone on public.units for each row execute function private.validate_unit_timezone();
create table private.catalog_resources (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 kind text not null check(kind in ('professional','room','equipment')), name text not null check(length(btrim(name)) between 1 and 160),
 membership_id uuid, qualification text not null default '' check(length(qualification)<=1000),
 capabilities text[] not null default '{}', active boolean not null default true, version integer not null default 1,
 unique(tenant_id,id), foreign key(tenant_id,membership_id) references public.tenant_memberships(tenant_id,id),
 check(kind='professional' or membership_id is null), check(cardinality(capabilities)<=30)
);
create unique index catalog_resource_member on private.catalog_resources(tenant_id,membership_id) where membership_id is not null;
create table private.catalog_resource_units (
 tenant_id uuid not null, resource_id uuid not null, unit_id uuid not null,
 location text not null check(length(btrim(location)) between 1 and 160), capacity integer not null check(capacity between 1 and 1000),
 primary key(tenant_id,resource_id,unit_id),
 foreign key(tenant_id,resource_id) references private.catalog_resources(tenant_id,id),
 foreign key(tenant_id,unit_id) references public.units(tenant_id,id)
);
create table private.catalog_windows (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, resource_id uuid not null, unit_id uuid not null,
 kind text not null check(kind in ('shift','off','holiday','exception')), period tstzrange not null,
 timezone text not null, local_start timestamp not null, local_end timestamp not null,
 reason text not null default '' check(length(reason)<=500),
 foreign key(tenant_id,resource_id,unit_id) references private.catalog_resource_units(tenant_id,resource_id,unit_id),
 check(not isempty(period) and not lower_inf(period) and not upper_inf(period) and lower_inc(period) and not upper_inc(period)),
 check(local_end>local_start and local_end-local_start<=interval '31 days'),
 exclude using gist(tenant_id with =,resource_id with =,period with &&) where(kind in ('shift','exception'))
);
create table private.catalog_services (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), current_version integer not null default 0,
 unique(tenant_id,id)
);
create table private.catalog_service_versions (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, service_id uuid not null, version integer not null check(version>0),
 name text not null check(length(btrim(name)) between 1 and 160), category text not null check(length(btrim(category)) between 1 and 100),
 duration_minutes integer not null check(duration_minutes between 1 and 1440), buffer_before integer not null check(buffer_before between 0 and 1440), buffer_after integer not null check(buffer_after between 0 and 1440),
 price_cents bigint not null check(price_cents between 0 and 999999999999), currency text not null check(currency ~ '^[A-Z]{3}$'),
 preparation text not null default '' check(length(preparation)<=2000), state text not null check(state in ('published','inactive')),
 created_at timestamptz not null default now(), created_by uuid not null,
 unique(tenant_id,id), unique(tenant_id,service_id,version), foreign key(tenant_id,service_id) references private.catalog_services(tenant_id,id)
);
create table private.catalog_service_units (
 tenant_id uuid not null, version_id uuid not null, unit_id uuid not null,
 primary key(tenant_id,version_id,unit_id), foreign key(tenant_id,version_id) references private.catalog_service_versions(tenant_id,id), foreign key(tenant_id,unit_id) references public.units(tenant_id,id)
);
create table private.catalog_service_resources (
 tenant_id uuid not null, version_id uuid not null, unit_id uuid not null, resource_id uuid not null,
 primary key(tenant_id,version_id,unit_id,resource_id),
 foreign key(tenant_id,version_id,unit_id) references private.catalog_service_units(tenant_id,version_id,unit_id),
 foreign key(tenant_id,resource_id,unit_id) references private.catalog_resource_units(tenant_id,resource_id,unit_id)
);
-- Exigências por tipo e capacidade, independentes dos recursos nominados habilitados.
create table private.catalog_requirements (
 tenant_id uuid not null, version_id uuid not null, kind text not null check(kind in ('room','equipment')),
 capability text not null check(capability = btrim(capability) and length(capability) between 1 and 100), quantity integer not null check(quantity between 1 and 1000),
 primary key(tenant_id,version_id,kind,capability), foreign key(tenant_id,version_id) references private.catalog_service_versions(tenant_id,id)
);
do $$ declare n text; begin foreach n in array array['catalog_resources','catalog_resource_units','catalog_windows','catalog_services','catalog_service_versions','catalog_service_units','catalog_service_resources','catalog_requirements'] loop
 execute format('alter table private.%I enable row level security',n);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',n);
 end loop; end $$;
create function private.catalog_assert(t uuid,u uuid,p text) returns void language plpgsql stable set search_path='' as $$ begin
 if u is null or not private.is_allowed(t,u,p,'core') then raise exception 'Acesso ao catálogo negado' using errcode='42501'; end if;
end $$;
create function private.catalog_audit(t uuid,us uuid[],entity text,entity_id uuid,action text) returns void language plpgsql set search_path='' as $$ declare u uuid; begin
 foreach u in array us loop
 insert into public.audit_logs(tenant_id,unit_id,actor_id,entity,entity_id,action) values(t,u,auth.uid(),entity,entity_id::text,action);
 end loop;
end $$;
create function public.save_catalog_resource(tenant uuid,unit uuid,payload jsonb,resource uuid default null,expected_version integer default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid; old private.catalog_resources; j jsonb; u uuid; mid uuid; historical boolean := false; us uuid[] := '{}'; begin
 perform private.catalog_assert(tenant,unit,'catalog.write');
 -- Serializa configurações compartilhadas e publicações no tenant, inclusive criação.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog:'||tenant::text,0));
 if resource is not null then
 select * into old from private.catalog_resources r where r.tenant_id=tenant and r.id=resource for update;
 if not found then raise exception 'Recurso indisponível' using errcode='42501'; end if;
 for u in select ru.unit_id from private.catalog_resource_units ru where ru.tenant_id=tenant and ru.resource_id=resource loop perform private.catalog_assert(tenant,u,'catalog.write'); end loop;
 if expected_version is distinct from old.version then raise exception 'Versão desatualizada' using errcode='40001'; end if;
 if payload->>'kind' is distinct from old.kind then raise exception 'Tipo imutável' using errcode='22023'; end if;
 elsif expected_version is not null then raise exception 'Versão esperada só se aplica à edição' using errcode='22023'; end if;
 if jsonb_typeof(payload->'units') is distinct from 'array' or jsonb_array_length(payload->'units') not between 1 and 100 then raise exception 'Informe unidades' using errcode='22023'; end if;
 mid := nullif(payload->>'membership_id','')::uuid;
 if resource is not null and mid is not distinct from old.membership_id and coalesce((payload->>'active')::boolean,true)=false then historical := true; end if;
 for j in select value from jsonb_array_elements(payload->'units') loop
 u := (j->>'unit_id')::uuid; perform private.catalog_assert(tenant,u,'catalog.write'); us:=array_append(us,u);
 -- Inativar pode conservar o vínculo já gravado mesmo depois da revogação. Troca ou recurso ativo exigem escopo vigente.
 if mid is not null and not historical and not exists(select 1 from public.tenant_memberships m join public.membership_units mu on mu.tenant_id=m.tenant_id and mu.membership_id=m.id where m.tenant_id=tenant and m.id=mid and m.status='active' and mu.unit_id=u) then raise exception 'Equipe sem escopo vigente na unidade' using errcode='22023'; end if;
 end loop;
 if not unit=any(us) then raise exception 'Inclua a unidade ativa' using errcode='22023'; end if;
 if resource is null then
 insert into private.catalog_resources(tenant_id,kind,name,membership_id,qualification,capabilities,active) values(tenant,payload->>'kind',payload->>'name',mid,coalesce(payload->>'qualification',''),array(select btrim(value) from jsonb_array_elements_text(coalesce(payload->'capabilities','[]')) where btrim(value)<>''),coalesce((payload->>'active')::boolean,true)) returning id into rid;
 else
 rid:=resource;
 update private.catalog_resources set name=payload->>'name',membership_id=mid,qualification=coalesce(payload->>'qualification',''),capabilities=array(select btrim(value) from jsonb_array_elements_text(coalesce(payload->'capabilities','[]')) where btrim(value)<>''),active=coalesce((payload->>'active')::boolean,true),version=version+1 where id=rid;
 -- FKs preservam vínculos históricos e janelas; remoções incompatíveis são recusadas.
 delete from private.catalog_resource_units ru where ru.tenant_id=tenant and ru.resource_id=rid and not ru.unit_id=any(us);
 end if;
 for j in select value from jsonb_array_elements(payload->'units') loop
 insert into private.catalog_resource_units(tenant_id,resource_id,unit_id,location,capacity) values(tenant,rid,(j->>'unit_id')::uuid,j->>'location',(j->>'capacity')::integer)
 on conflict(tenant_id,resource_id,unit_id) do update set location=excluded.location,capacity=excluded.capacity;
 end loop;
 perform private.catalog_audit(tenant,us,'catalog_resource',rid,'catalog_resource_saved'); return rid;
end $$;
create function public.publish_catalog_service(tenant uuid,unit uuid,payload jsonb,service uuid default null,expected_version integer default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare sid uuid; vid uuid; n integer; u uuid; j jsonb; r uuid; us uuid[]:='{}'; begin
 perform private.catalog_assert(tenant,unit,'catalog.write');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog:'||tenant::text,0));
 if service is null then
 if expected_version is not null then raise exception 'Versão esperada só se aplica à edição' using errcode='22023'; end if;
 insert into private.catalog_services(tenant_id) values(tenant) returning id,current_version into sid,n;
 else
 select s.id,s.current_version into sid,n from private.catalog_services s where s.tenant_id=tenant and s.id=service for update;
 if not found then raise exception 'Serviço indisponível' using errcode='42501'; end if;
 for u in select su.unit_id from private.catalog_service_units su join private.catalog_service_versions v on v.tenant_id=su.tenant_id and v.id=su.version_id where v.tenant_id=tenant and v.service_id=sid and v.version=n loop perform private.catalog_assert(tenant,u,'catalog.write'); end loop;
 if n is distinct from expected_version then raise exception 'Versão desatualizada' using errcode='40001'; end if;
 end if;
 if jsonb_typeof(payload->'units') is distinct from 'array' or jsonb_array_length(payload->'units') not between 1 and 100 then raise exception 'Informe unidades' using errcode='22023'; end if;
 for j in select value from jsonb_array_elements(payload->'units') loop u:=(j#>>'{}')::uuid; perform private.catalog_assert(tenant,u,'catalog.write'); us:=array_append(us,u); end loop;
 if not unit=any(us) then raise exception 'Inclua a unidade ativa' using errcode='22023'; end if;
 insert into private.catalog_service_versions(tenant_id,service_id,version,name,category,duration_minutes,buffer_before,buffer_after,price_cents,currency,preparation,state,created_by)
 values(tenant,sid,n+1,payload->>'name',payload->>'category',(payload->>'duration_minutes')::integer,(payload->>'buffer_before')::integer,(payload->>'buffer_after')::integer,(payload->>'price_cents')::bigint,payload->>'currency',coalesce(payload->>'preparation',''),payload->>'state',auth.uid()) returning id into vid;
 foreach u in array us loop insert into private.catalog_service_units values(tenant,vid,u); end loop;
 for j in select value from jsonb_array_elements(coalesce(payload->'resources','[]')) loop
 u:=(j->>'unit_id')::uuid; r:=(j->>'resource_id')::uuid;
 if not exists(select 1 from private.catalog_resources cr join private.catalog_resource_units ru on ru.tenant_id=cr.tenant_id and ru.resource_id=cr.id where cr.tenant_id=tenant and cr.id=r and ru.unit_id=u and (payload->>'state'='inactive' or (cr.active and (cr.membership_id is null or exists(select 1 from public.tenant_memberships m join public.membership_units mu on mu.tenant_id=m.tenant_id and mu.membership_id=m.id where m.tenant_id=tenant and m.id=cr.membership_id and m.status='active' and mu.unit_id=u))))) then raise exception 'Recurso sem habilitação vigente' using errcode='22023'; end if;
 insert into private.catalog_service_resources values(tenant,vid,u,r);
 end loop;
 for j in select value from jsonb_array_elements(coalesce(payload->'requirements','[]')) loop
 if btrim(coalesce(j->>'capability',''))='' then raise exception 'Capacidade exigida inválida' using errcode='22023'; end if;
 insert into private.catalog_requirements values(tenant,vid,j->>'kind',btrim(j->>'capability'),(j->>'quantity')::integer);
 end loop;
 update private.catalog_services set current_version=n+1 where id=sid;
 perform private.catalog_audit(tenant,us,'catalog_service_version',vid,'catalog_service_published'); return vid;
end $$;
create function public.set_catalog_window(tenant uuid,unit uuid,resource uuid,kind text,local_start timestamp,local_end timestamp,reason text default '',window_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare tz text; a timestamptz; b timestamptz; wid uuid; begin
 perform private.catalog_assert(tenant,unit,'catalog.write');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog:'||tenant::text,0));
 if not exists(select 1 from private.catalog_resource_units ru join private.catalog_resources r on r.tenant_id=ru.tenant_id and r.id=ru.resource_id where ru.tenant_id=tenant and ru.resource_id=resource and ru.unit_id=unit and r.active) then raise exception 'Recurso indisponível na unidade' using errcode='42501'; end if;
 select un.timezone into tz from public.units un where un.tenant_id=tenant and un.id=unit;
 a:=local_start at time zone tz; b:=local_end at time zone tz;
 if local_start is null or local_end is null or local_end<=local_start or b<=a or local_end-local_start>interval '31 days' or a at time zone tz<>local_start or b at time zone tz<>local_end then raise exception 'Intervalo local inválido' using errcode='22023'; end if;
 if window_id is not null then
 delete from private.catalog_windows w where w.tenant_id=tenant and w.unit_id=unit and w.resource_id=resource and w.id=window_id;
 if not found then raise exception 'Janela indisponível' using errcode='42501'; end if;
 end if;
 insert into private.catalog_windows(tenant_id,resource_id,unit_id,kind,period,timezone,local_start,local_end,reason) values(tenant,resource,unit,kind,tstzrange(a,b,'[)'),tz,local_start,local_end,coalesce(reason,'')) returning id into wid;
 perform private.catalog_audit(tenant,array[unit],'catalog_window',wid,'catalog_window_saved'); return wid;
end $$;
create function public.delete_catalog_window(tenant uuid,unit uuid,window_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.catalog_assert(tenant,unit,'catalog.write');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog:'||tenant::text,0));
 delete from private.catalog_windows w where w.tenant_id=tenant and w.unit_id=unit and w.id=window_id;
 if not found then raise exception 'Janela indisponível' using errcode='42501'; end if;
 perform private.catalog_audit(tenant,array[unit],'catalog_window',window_id,'catalog_window_deleted');
end $$;
create function public.set_catalog_timezone(tenant uuid,unit uuid,timezone text) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.catalog_assert(tenant,unit,'catalog.write');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog:'||tenant::text,0));
 -- Janelas já gravadas conservam instantes e fuso original para revisão explícita.
 update public.units u set timezone=set_catalog_timezone.timezone where u.tenant_id=tenant and u.id=unit;
 perform private.catalog_audit(tenant,array[unit],'catalog_timezone',unit,'catalog_timezone_saved');
end $$;
create function public.list_catalog(tenant uuid,unit uuid,kind text default 'services',query text default '',after_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$ declare result jsonb; begin
 perform private.catalog_assert(tenant,unit,'catalog.read');
 if length(query)>160 or kind not in ('services','resources','windows') then raise exception 'Filtro inválido' using errcode='22023'; end if;
 if kind='services' then
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') into result from (
 select s.id,v.id as version_id,v.version,v.name,v.category,v.duration_minutes,v.buffer_before,v.buffer_after,v.price_cents,v.currency,v.preparation,v.state,
 (select coalesce(jsonb_agg(to_jsonb(req)-'tenant_id'-'version_id'),'[]') from private.catalog_requirements req where req.tenant_id=tenant and req.version_id=v.id) requirements,
 (select coalesce(jsonb_agg(jsonb_build_object('resource_id',sr.resource_id,'unit_id',sr.unit_id,'name',cr.name,'kind',cr.kind,'active',cr.active,'eligible',cr.active and (cr.membership_id is null or exists(select 1 from public.tenant_memberships m join public.membership_units mu on mu.tenant_id=m.tenant_id and mu.membership_id=m.id where m.tenant_id=tenant and m.id=cr.membership_id and m.status='active' and mu.unit_id=sr.unit_id))) order by sr.unit_id,sr.resource_id),'[]') from private.catalog_service_resources sr join private.catalog_resources cr on cr.tenant_id=sr.tenant_id and cr.id=sr.resource_id where sr.tenant_id=tenant and sr.version_id=v.id and private.is_allowed(tenant,sr.unit_id,'catalog.read')) resources,
 (select jsonb_agg(su.unit_id) from private.catalog_service_units su where su.tenant_id=tenant and su.version_id=v.id and private.is_allowed(tenant,su.unit_id,'catalog.read')) units,
 not exists(select 1 from private.catalog_service_units su where su.tenant_id=tenant and su.version_id=v.id and not private.is_allowed(tenant,su.unit_id,'catalog.write')) can_edit
 from private.catalog_services s join private.catalog_service_versions v on v.tenant_id=s.tenant_id and v.service_id=s.id and v.version=s.current_version
 join private.catalog_service_units su on su.tenant_id=v.tenant_id and su.version_id=v.id and su.unit_id=unit
 where s.tenant_id=tenant and (after_id is null or s.id>after_id) and v.name ilike '%'||btrim(query)||'%' order by s.id limit 30) x;
 elsif kind='resources' then
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') into result from (
 select r.*,
 r.active and (r.membership_id is null or exists(select 1 from public.tenant_memberships m join public.membership_units mu on mu.tenant_id=m.tenant_id and mu.membership_id=m.id where m.tenant_id=tenant and m.id=r.membership_id and m.status='active' and mu.unit_id=unit)) eligible,
 (select jsonb_agg(to_jsonb(ru)-'tenant_id'-'resource_id') from private.catalog_resource_units ru where ru.tenant_id=tenant and ru.resource_id=r.id and private.is_allowed(tenant,ru.unit_id,'catalog.read')) units,
 not exists(select 1 from private.catalog_resource_units ru where ru.tenant_id=tenant and ru.resource_id=r.id and not private.is_allowed(tenant,ru.unit_id,'catalog.write')) can_edit
 from private.catalog_resources r join private.catalog_resource_units ru on ru.tenant_id=r.tenant_id and ru.resource_id=r.id and ru.unit_id=unit
 where r.tenant_id=tenant and (after_id is null or r.id>after_id) and r.name ilike '%'||btrim(query)||'%' order by r.id limit 30) x;
 else
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') into result from (
 select w.id,w.resource_id,r.name,w.kind,w.local_start,w.local_end,w.timezone,w.reason,lower(w.period) starts_at,upper(w.period) ends_at
 from private.catalog_windows w join private.catalog_resources r on r.tenant_id=w.tenant_id and r.id=w.resource_id
 where w.tenant_id=tenant and w.unit_id=unit and (after_id is null or w.id>after_id) and r.name ilike '%'||btrim(query)||'%' order by w.id limit 30) x;
 end if; return result;
end $$;
create function public.catalog_service_history(tenant uuid,unit uuid,service uuid,after_version integer default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$ begin
 perform private.catalog_assert(tenant,unit,'catalog.read');
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.version desc),'[]') from (
 select v.* from private.catalog_service_versions v join private.catalog_service_units su on su.tenant_id=v.tenant_id and su.version_id=v.id
 where v.tenant_id=tenant and v.service_id=service and su.unit_id=unit and (after_version is null or v.version<after_version) order by v.version desc limit 30) x);
end $$;
create function public.catalog_availability(tenant uuid,unit uuid,local_start timestamp,local_end timestamp,version_id uuid default null,after_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$ declare a timestamptz; b timestamptz; tz text; begin
 perform private.catalog_assert(tenant,unit,'catalog.read');
 select u.timezone into tz from public.units u where u.tenant_id=tenant and u.id=unit;
 a:=local_start at time zone tz; b:=local_end at time zone tz;
 if a is null or b is null or b<=a or b-a>interval '31 days' or a at time zone tz<>local_start or b at time zone tz<>local_end then raise exception 'Intervalo inválido' using errcode='22023'; end if;
 if version_id is not null then
 if not exists(select 1 from private.catalog_service_versions v join private.catalog_service_units su on su.tenant_id=v.tenant_id and su.version_id=v.id join private.catalog_services s on s.tenant_id=v.tenant_id and s.id=v.service_id and s.current_version=v.version where v.tenant_id=tenant and v.id=catalog_availability.version_id and su.unit_id=unit and v.state='published') then raise exception 'Versão não disponível para nova operação' using errcode='22023'; end if;
 if exists(select 1 from private.catalog_service_versions v where v.id=catalog_availability.version_id and b-a<>make_interval(mins=>v.duration_minutes)) then raise exception 'O intervalo deve corresponder à duração da versão, sem buffers' using errcode='22023'; end if;
 select a-make_interval(mins=>v.buffer_before),b+make_interval(mins=>v.buffer_after) into a,b from private.catalog_service_versions v where v.id=catalog_availability.version_id;
 end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from (
 select r.id,r.name,r.kind,r.qualification,r.capabilities,ru.location,ru.capacity,
 exists(select 1 from private.catalog_windows w where w.tenant_id=tenant and w.resource_id=r.id and w.unit_id=unit and w.kind in ('shift','exception') and w.period @> tstzrange(a,b,'[)'))
 and not exists(select 1 from private.catalog_windows w where w.tenant_id=tenant and w.resource_id=r.id and w.kind in ('off','holiday') and w.period && tstzrange(a,b,'[)')) as available
 from private.catalog_resources r join private.catalog_resource_units ru on ru.tenant_id=r.tenant_id and ru.resource_id=r.id and ru.unit_id=unit
 where r.tenant_id=tenant and r.active and (after_id is null or r.id>after_id)
 and (r.membership_id is null or exists(select 1 from public.tenant_memberships m join public.membership_units mu on mu.tenant_id=m.tenant_id and mu.membership_id=m.id where m.tenant_id=tenant and m.id=r.membership_id and m.status='active' and mu.unit_id=unit))
 and (version_id is null or (r.kind='professional' and exists(select 1 from private.catalog_service_resources sr where sr.tenant_id=tenant and sr.version_id=catalog_availability.version_id and sr.unit_id=unit and sr.resource_id=r.id))
 or (r.kind<>'professional' and (exists(select 1 from private.catalog_service_resources sr where sr.tenant_id=tenant and sr.version_id=catalog_availability.version_id and sr.unit_id=unit and sr.resource_id=r.id)
 or (exists(select 1 from private.catalog_requirements q where q.tenant_id=tenant and q.version_id=catalog_availability.version_id and q.kind=r.kind and q.capability=any(r.capabilities) and ru.capacity>=q.quantity)
 and not exists(select 1 from private.catalog_service_resources sr join private.catalog_resources cr on cr.tenant_id=sr.tenant_id and cr.id=sr.resource_id where sr.tenant_id=tenant and sr.version_id=catalog_availability.version_id and sr.unit_id=unit and cr.kind=r.kind)))))
 order by r.id limit 30) x);
end $$;
-- Sem acesso direto ao schema privado; RPCs são a única porta de leitura/escrita.
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig,n.nspname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('save_catalog_resource','publish_catalog_service','set_catalog_window','delete_catalog_window','set_catalog_timezone','list_catalog','catalog_service_history','catalog_availability')) or (n.nspname='private' and p.proname in ('validate_unit_timezone','catalog_assert','catalog_audit')) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 if f.nspname='public' then execute format('grant execute on function %s to authenticated',f.sig); end if;
 end loop;
end $$;
create function public.catalog_team_options(tenant uuid,unit uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 perform private.catalog_assert(tenant,unit,'catalog.write');
 return (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(nullif(p.display_name,''),au.email,'Integrante da equipe')||' · '||case m.role when 'clinic_admin' then 'Admin da clínica' when 'manager' then 'Gerente' when 'professional' then 'Profissional' when 'reception' then 'Recepção' when 'finance' then 'Financeiro' else 'Auditoria' end)),'[]') from public.tenant_memberships m join auth.users au on au.id=m.user_id left join public.profiles p on p.id=m.user_id where m.tenant_id=tenant and m.status='active'
 and exists(select 1 from public.membership_units mu where mu.tenant_id=tenant and mu.membership_id=m.id and mu.unit_id=unit));
end $$;
revoke all on function public.catalog_team_options(uuid,uuid) from public,anon,service_role;
grant execute on function public.catalog_team_options(uuid,uuid) to authenticated;
