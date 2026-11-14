-- Emulação mínima do ambiente Supabase para desenvolvimento local SEM Docker.
-- Cria papéis, schemas e o schema storage compatível (buckets/objects/foldername).
-- NÃO usar em produção: no Supabase real esses objetos já existem.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login password 'local-authenticator' noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin login password 'local-auth-admin' createrole; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_storage_admin') then create role supabase_storage_admin nologin; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
create schema if not exists auth authorization supabase_auth_admin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on functions to service_role;
alter default privileges in schema public grant all on sequences to service_role;
grant usage on schema auth to anon, authenticated, service_role;
alter role supabase_auth_admin set search_path = auth;

-- Storage (compatível com o schema do Supabase Storage para testes de política)
create schema if not exists storage authorization supabase_storage_admin;
create table if not exists storage.buckets (
  id text primary key, name text not null unique, owner uuid, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text not null, owner uuid, owner_id text, metadata jsonb, path_tokens text[] generated always as (string_to_array(name,'/')) stored,
  created_at timestamptz default now(), updated_at timestamptz default now(), last_accessed_at timestamptz default now(), version text,
  unique (bucket_id, name));
create or replace function storage.foldername(name text) returns text[] language plpgsql immutable as $f$
declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts,1)-1]; end $f$;
create or replace function storage.filename(name text) returns text language plpgsql immutable as $f$
declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[array_length(_parts,1)]; end $f$;
alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects, storage.buckets to authenticated, service_role;
