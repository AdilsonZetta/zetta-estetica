-- O destino é indicação; a autorização usa identidade e vínculo atuais no banco.
create function public.launch_context(destination text default null)
returns table(id uuid, name text, slug text)
language sql stable security definer set search_path='' as $$
 select t.id,t.name,t.slug from public.tenants t
 where (destination is null or t.slug=destination)
 and private.is_allowed(t.id,null,'unit.read','core')
 order by t.name,t.id
$$;
revoke all on function public.launch_context(text) from public,anon;
grant execute on function public.launch_context(text) to authenticated;

alter table public.tenant_connections
 add column icon_name text not null default 'Gestão Estética' check(length(trim(icon_name)) between 2 and 80),
 add column desired_mode text not null default 'external_tab' check(desired_mode in ('external_tab','same_tab','iframe','sso')),
 add column installation_status text not null default 'pending' check(installation_status in ('pending','installed','tested','blocked')),
 add column installation_evidence text not null default '' check(length(installation_evidence)<=2000),
 add column evolution_evidence text not null default '' check(length(evolution_evidence)<=2000);

create function public.record_icon_installation(tenant uuid,icon_name text,account_label text,desired_mode text,installation_status text,evidence text,evolution text default '')
returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 if coalesce(length(trim(icon_name)),0) not between 2 and 80
 or coalesce(length(trim(account_label)),0) not between 2 and 120
 or desired_mode is null or desired_mode not in ('external_tab','same_tab','iframe','sso')
 or installation_status is null or installation_status not in ('pending','installed','tested','blocked')
 or evidence is null or length(evidence)>2000 or evolution is null or length(evolution)>2000
 or (installation_status in ('installed','tested','blocked') and length(trim(evidence))<10)
 then raise exception 'Revise os campos e informe evidência redigida' using errcode='22023'; end if;
 -- Registrar intenção/evidência não habilita iframe, SSO ou qualquer capacidade FLW.
 update public.tenant_connections c set icon_name=trim(record_icon_installation.icon_name),
 icon_account_label=trim(account_label),desired_mode=record_icon_installation.desired_mode,
 installation_status=record_icon_installation.installation_status,
 installation_evidence=record_icon_installation.evidence,evolution_evidence=evolution,
 icon_installer=auth.uid(),icon_updated_at=now(),icon_state='awaiting_validation'
 where c.tenant_id=tenant;
 if not found then raise exception 'Empresa inexistente' using errcode='22023'; end if;
 perform private.console_event(tenant,'icon_installation_recorded','tenant_connections',tenant::text,
 jsonb_build_object('status',installation_status,'desired_mode',desired_mode,'installer',auth.uid()));
end $$;
revoke all on function public.record_icon_installation(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.record_icon_installation(uuid,text,text,text,text,text,text) to authenticated;
