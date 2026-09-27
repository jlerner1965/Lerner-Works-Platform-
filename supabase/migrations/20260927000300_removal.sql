-- Removing a site or an organization (site-building programme B6, decision D-025).
-- Owner-only functions with a typed confirmation. A site that is live on a domain is refused
-- until it is taken off. A site's rows go with it (every site-scoped table cascades from
-- sites), its audit events stay on the organization (audit_events.site_id has no foreign key),
-- and the function returns the storage objects the application removes afterwards: the
-- private originals and derivatives under the site's asset prefixes, and the public copies no
-- other site's release carries (public names are content hashes and may be shared). An
-- organization is not removed as a row: its sites must be gone, its memberships and
-- invitations are deleted, and the row stays as a tombstone (status 'deleted') that no one is
-- a member of, so that its audit trail, including the deletion itself, remains.

alter table public.organizations drop constraint if exists organizations_status_check;
alter table public.organizations add constraint organizations_status_check check (status in ('active', 'suspended', 'deleted'));
alter table public.organizations add column if not exists deleted_at timestamptz;
alter table public.organizations add column if not exists deleted_by uuid references auth.users(id);

create or replace function public.delete_site(p_site uuid, p_confirm_key text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.sites%rowtype;
  v_counts jsonb;
  v_private text[];
  v_public text[];
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select s.* into v from public.sites s where s.id = p_site for update;
  if not found then raise exception 'site not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(v.organization_id) then
    raise exception 'only organization owners delete a site' using errcode = '42501';
  end if;
  if p_confirm_key is null or btrim(p_confirm_key) <> v.key then
    raise exception 'type the site key exactly to confirm the deletion' using errcode = '22023';
  end if;
  if v.mode = 'live' or exists (select 1 from public.domains d where d.site_id = p_site and d.status = 'active') then
    raise exception 'the site is live on a domain; return it to demonstration mode and disable its domains first' using errcode = 'P0001';
  end if;
  select jsonb_build_object(
    'items', (select count(*) from public.content_items i where i.site_id = p_site),
    'releases', (select count(*) from public.releases r where r.site_id = p_site),
    'media', (select count(*) from public.media_assets m where m.site_id = p_site),
    'inquiries', (select count(*) from public.inquiries q where q.site_id = p_site),
    'members', (select count(*) from public.site_memberships sm where sm.site_id = p_site),
    'domains', (select count(*) from public.domains d where d.site_id = p_site))
  into v_counts;
  -- Private originals and derivatives live under organization/site/asset.
  select coalesce(array_agg(m.organization_id::text || '/' || m.site_id::text || '/' || m.id::text order by m.created_at), '{}')
    into v_private
    from public.media_assets m where m.site_id = p_site;
  -- Public copies are named by content hash: only the names no other site's release carries are returned for removal.
  select coalesce(array_agg(distinct names.n), '{}')
    into v_public
    from (
      select v2.value->>'path' as n
      from public.releases r,
        jsonb_each(coalesce(r.snapshot->'media', '{}'::jsonb)) m,
        jsonb_each(coalesce(m.value->'variants', '{}'::jsonb)) v2
      where r.site_id = p_site
    ) names
    where names.n is not null and not exists (
      select 1
      from public.releases r2,
        jsonb_each(coalesce(r2.snapshot->'media', '{}'::jsonb)) m2,
        jsonb_each(coalesce(m2.value->'variants', '{}'::jsonb)) v3
      where r2.site_id <> p_site and v3.value->>'path' = names.n
    );
  delete from public.sites where id = p_site;
  perform private.audit(v.organization_id, p_site, 'site.deleted', 'site', p_site,
    jsonb_build_object('key', v.key, 'name', v.name, 'preset', v.preset, 'counts', v_counts));
  return jsonb_build_object(
    'key', v.key, 'name', v.name, 'organizationId', v.organization_id, 'counts', v_counts,
    'privatePrefixes', to_jsonb(v_private), 'publicNames', to_jsonb(v_public));
end;
$$;

-- Storage objects the application could not remove after a deletion are written to the audit
-- trail with their keys, so the operator can finish by hand; the rows are gone either way.
create or replace function public.record_removal_leftovers(p_org uuid, p_site uuid, p_leftovers jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not private.is_org_owner(p_org) then raise exception 'owner permission required' using errcode = '42501'; end if;
  perform private.audit(p_org, p_site, 'site.storage_cleanup_failed', 'site', p_site, jsonb_build_object('leftovers', coalesce(p_leftovers, '[]'::jsonb)));
end;
$$;

-- With p_check_only the rules are applied and nothing changes: the application asks first,
-- deletes the organization's sites one by one, then calls again to finish.
create or replace function public.delete_organization(p_org uuid, p_confirm_name text, p_check_only boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.organizations%rowtype;
  v_uid uuid := auth.uid();
  v_members integer := 0;
  v_invitations integer := 0;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select o.* into v from public.organizations o where o.id = p_org for update;
  if not found or v.status = 'deleted' then raise exception 'organization not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(p_org) then
    raise exception 'only organization owners delete an organization' using errcode = '42501';
  end if;
  if p_confirm_name is null or btrim(p_confirm_name) <> v.name then
    raise exception 'type the organization name exactly to confirm the deletion' using errcode = '22023';
  end if;
  if not exists (select 1 from public.memberships m where m.user_id = v_uid and m.organization_role = 'owner' and m.organization_id <> p_org) then
    raise exception 'this is the last organization you own; create the next one before deleting it' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.sites s where s.organization_id = p_org and s.mode = 'live') then
    raise exception 'a site of this organization is live on a domain; return it to demonstration mode and disable its domains first' using errcode = 'P0001';
  end if;
  if coalesce(p_check_only, false) then
    return jsonb_build_object('name', v.name, 'sites', (select count(*) from public.sites s where s.organization_id = p_org));
  end if;
  if exists (select 1 from public.sites s where s.organization_id = p_org) then
    raise exception 'the organization still has sites; delete them first' using errcode = 'P0001';
  end if;
  delete from public.invitations where organization_id = p_org;
  get diagnostics v_invitations = row_count;
  delete from public.memberships where organization_id = p_org;
  get diagnostics v_members = row_count;
  update public.organizations set status = 'deleted', deleted_at = now(), deleted_by = v_uid where id = p_org;
  perform private.audit(p_org, null, 'organization.deleted', 'organization', p_org,
    jsonb_build_object('name', v.name, 'members', v_members, 'invitations', v_invitations));
  return jsonb_build_object('name', v.name, 'members', v_members, 'invitations', v_invitations);
end;
$$;

revoke all on function public.delete_site(uuid, text) from public;
revoke all on function public.record_removal_leftovers(uuid, uuid, jsonb) from public;
revoke all on function public.delete_organization(uuid, text, boolean) from public;
grant execute on function public.delete_site(uuid, text) to authenticated;
grant execute on function public.record_removal_leftovers(uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_organization(uuid, text, boolean) to authenticated;
