-- Uploaded sites (site-building programme B7, decision D-026): a site built anywhere and
-- uploaded as a ZIP. A site carries a type; an uploaded site's releases hold a file manifest
-- (snapshot schema series 101) instead of content; publication is one function that inserts
-- the immutable release and activates it; the proxy asks one function which kind of site a
-- hostname serves; removal collects the uploaded files' public copies like the pictures'.

create type public.site_type as enum ('structured', 'uploaded');
alter table public.sites add column if not exists site_type public.site_type not null default 'structured';

alter table public.import_jobs drop constraint if exists import_jobs_package_type_check;
alter table public.import_jobs add constraint import_jobs_package_type_check check (package_type in ('csv', 'site_package', 'onboarding', 'uploaded_site'));

-- create_site takes the type. An uploaded site keeps a configuration revision (the contact and
-- brand fields are still its), and the application creates no starter pages for it.
drop function if exists public.create_site(uuid, text, text, public.site_preset, text, public.site_mode, jsonb, jsonb);
create or replace function public.create_site(
  p_org uuid,
  p_key text,
  p_name text,
  p_preset public.site_preset,
  p_time_zone text,
  p_mode public.site_mode,
  p_contact jsonb,
  p_config jsonb,
  p_site_type public.site_type default 'structured'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_site_id uuid;
  v_config_id uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not private.is_org_owner(p_org) then raise exception 'owner permission required' using errcode = '42501'; end if;
  if p_time_zone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    raise exception 'time zone is not a valid IANA name' using errcode = '22023';
  end if;
  if exists (select 1 from public.sites s where s.key = p_key) then
    raise exception 'site key is already in use' using errcode = '23505';
  end if;
  insert into public.sites (organization_id, key, name, preset, time_zone, mode, site_type, contact_email, contact_phone, contact_address, inquiry_recipients, created_by)
  values (p_org, p_key, btrim(p_name), p_preset, p_time_zone, p_mode, coalesce(p_site_type, 'structured'),
    nullif(p_contact->>'email', ''), nullif(p_contact->>'phone', ''), nullif(p_contact->>'address', ''),
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_contact->'inquiryRecipients', '[]'::jsonb)) x), '{}'),
    v_uid)
  returning id into v_site_id;
  insert into public.site_config_revisions (organization_id, site_id, version, schema_version, config, author_id, change_note)
  values (p_org, v_site_id, 1, 1, p_config, v_uid, 'Initial configuration from preset')
  returning id into v_config_id;
  update public.sites set current_config_revision_id = v_config_id where id = v_site_id;
  perform private.audit(p_org, v_site_id, 'site.created', 'site', v_site_id,
    jsonb_build_object('key', p_key, 'preset', p_preset, 'mode', p_mode, 'siteType', coalesce(p_site_type, 'structured')));
  return v_site_id;
end;
$$;
revoke all on function public.create_site(uuid, text, text, public.site_preset, text, public.site_mode, jsonb, jsonb, public.site_type) from public;
grant execute on function public.create_site(uuid, text, text, public.site_preset, text, public.site_mode, jsonb, jsonb, public.site_type) to authenticated;

-- Publishes an uploaded site's manifest as the next release and activates it, atomically and
-- idempotently. The application has already copied every file to public storage under its
-- content-hash name; the manifest maps the site's paths to those names.
create or replace function public.publish_uploaded_release(
  p_site uuid,
  p_snapshot jsonb,
  p_snapshot_hash text,
  p_reason text,
  p_idempotency_key text
) returns table (release_id uuid, version integer, outcome text)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_site public.sites%rowtype;
  v_existing public.releases%rowtype;
  v_release_id uuid;
  v_version integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;
  if not private.can_publish_site(p_site) then
    raise exception 'publish permission required' using errcode = '42501';
  end if;
  select s.* into v_site from public.sites s where s.id = p_site for update;
  if not found then raise exception 'site not found' using errcode = 'P0002'; end if;
  if v_site.site_type <> 'uploaded' then
    raise exception 'this site is not an uploaded site' using errcode = 'P0001';
  end if;
  if coalesce(p_snapshot->>'kind', '') <> 'uploaded' or jsonb_typeof(p_snapshot->'files') <> 'object' or p_snapshot->'files'->'/index.html' is null then
    raise exception 'the manifest is not an uploaded site with an index page' using errcode = '22023';
  end if;
  select r.* into v_existing from public.releases r where r.site_id = p_site and r.idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_existing.version, 'already_published'::text; return;
  end if;
  select coalesce(max(r.version), 0) + 1 into v_version from public.releases r where r.site_id = p_site;
  insert into public.releases (organization_id, site_id, version, schema_version, snapshot, snapshot_hash, actor_id, reason, base_release_id, idempotency_key)
  values (v_site.organization_id, p_site, v_version, 101, p_snapshot, p_snapshot_hash, v_uid, p_reason, v_site.active_release_id, p_idempotency_key)
  returning id into v_release_id;
  update public.sites set active_release_id = v_release_id where id = p_site;
  perform private.audit(v_site.organization_id, p_site, 'release.activated', 'release', v_release_id,
    jsonb_build_object('version', v_version, 'uploaded', true,
      'files', (select count(*) from jsonb_object_keys(p_snapshot->'files')),
      'bytes', coalesce((p_snapshot->'source'->>'totalBytes')::bigint, 0),
      'reason', p_reason));
  return query select v_release_id, v_version, 'published'::text;
end;
$$;
revoke all on function public.publish_uploaded_release(uuid, jsonb, text, text, text) from public;
grant execute on function public.publish_uploaded_release(uuid, jsonb, text, text, text) to authenticated;

-- Which kind of site a verified, active hostname serves (null when none): the proxy asks this
-- to route an uploaded site's requests to the file handler. Public, like the release readers.
create or replace function public.get_host_site_type(p_host text)
returns text
language sql stable security definer set search_path = '' as $$
  select s.site_type::text
  from public.domains d join public.sites s on s.id = d.site_id
  where d.normalized_host = lower(p_host) and d.status = 'active' and s.mode = 'live' and s.status = 'active'
  limit 1;
$$;
revoke all on function public.get_host_site_type(text) from public;
grant execute on function public.get_host_site_type(text) to anon, authenticated;

-- Removal (B6) also returns the uploaded files' public copies no other site's release carries.
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
  select coalesce(array_agg(m.organization_id::text || '/' || m.site_id::text || '/' || m.id::text order by m.created_at), '{}')
    into v_private
    from public.media_assets m where m.site_id = p_site;
  -- Public copies are named by content hash: pictures' derivatives (media variants) and uploaded
  -- files alike; only the names no other site's release carries are returned for removal.
  select coalesce(array_agg(distinct names.n), '{}')
    into v_public
    from (
      select v2.value->>'path' as n
      from public.releases r,
        jsonb_each(coalesce(r.snapshot->'media', '{}'::jsonb)) m,
        jsonb_each(coalesce(m.value->'variants', '{}'::jsonb)) v2
      where r.site_id = p_site
      union
      select f.value->>'name'
      from public.releases r, jsonb_each(coalesce(r.snapshot->'files', '{}'::jsonb)) f
      where r.site_id = p_site
    ) names
    where names.n is not null
      and not exists (
        select 1
        from public.releases r2,
          jsonb_each(coalesce(r2.snapshot->'media', '{}'::jsonb)) m2,
          jsonb_each(coalesce(m2.value->'variants', '{}'::jsonb)) v3
        where r2.site_id <> p_site and v3.value->>'path' = names.n)
      and not exists (
        select 1
        from public.releases r3, jsonb_each(coalesce(r3.snapshot->'files', '{}'::jsonb)) f3
        where r3.site_id <> p_site and f3.value->>'name' = names.n);
  delete from public.sites where id = p_site;
  perform private.audit(v.organization_id, p_site, 'site.deleted', 'site', p_site,
    jsonb_build_object('key', v.key, 'name', v.name, 'preset', v.preset, 'siteType', v.site_type, 'counts', v_counts));
  return jsonb_build_object(
    'key', v.key, 'name', v.name, 'organizationId', v.organization_id, 'counts', v_counts,
    'privatePrefixes', to_jsonb(v_private), 'publicNames', to_jsonb(v_public));
end;
$$;
