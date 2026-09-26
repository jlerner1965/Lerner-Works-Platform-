-- Transactional operations that carry authority. Each function re-checks the caller's
-- identity and capability, uses a fixed search_path, and is granted only to the roles that
-- need it. Nothing here trusts client-supplied organization ids.

-- Public read boundary ----------------------------------------------------------------------

-- Active release of a demonstration site, addressed by its registry key. Returns nothing for
-- live sites, archived sites, or sites without a release.
create or replace function public.get_demo_release(p_site_key text)
returns table (site_id uuid, release_id uuid, release_version integer, snapshot jsonb, published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, r.id, r.version, r.snapshot, r.created_at
  from public.sites s
  join public.releases r on r.id = s.active_release_id
  where s.key = p_site_key and s.mode = 'demo' and s.status = 'active';
$$;

-- Active release of a live site, addressed by an exact normalized hostname with an active
-- domain binding. Unknown hosts return nothing; callers must render a neutral 404.
create or replace function public.get_live_release(p_host text)
returns table (site_id uuid, release_id uuid, release_version integer, snapshot jsonb, published_at timestamptz, is_canonical boolean, canonical_host text)
language sql stable security definer set search_path = '' as $$
  select s.id, r.id, r.version, r.snapshot, r.created_at, d.is_canonical,
    (select c.normalized_host from public.domains c where c.site_id = s.id and c.is_canonical and c.status = 'active' limit 1)
  from public.domains d
  join public.sites s on s.id = d.site_id
  join public.releases r on r.id = s.active_release_id
  where d.normalized_host = lower(p_host) and d.status = 'active' and s.mode = 'live' and s.status = 'active';
$$;

revoke all on function public.get_demo_release(text) from public;
revoke all on function public.get_live_release(text) from public;
grant execute on function public.get_demo_release(text) to anon, authenticated;
grant execute on function public.get_live_release(text) to anon, authenticated;

-- Inquiry intake ------------------------------------------------------------------------------

create or replace function public.submit_inquiry(
  p_site_key text,
  p_host text,
  p_payload jsonb,
  p_requester_hash text,
  p_idempotency_key text,
  p_limit_per_requester integer default 5,
  p_limit_per_site integer default 100,
  p_window interval default interval '10 minutes'
) returns table (inquiry_id uuid, receipt_code text, outcome text)
language plpgsql security definer set search_path = '' as $$
declare
  v_site public.sites%rowtype;
  v_snapshot jsonb;
  v_name text := left(btrim(coalesce(p_payload->>'name', '')), 200);
  v_email text := left(lower(btrim(coalesce(p_payload->>'email', ''))), 260);
  v_phone text := nullif(left(btrim(coalesce(p_payload->>'phone', '')), 60), '');
  v_message text := left(coalesce(p_payload->>'message', ''), 5000);
  v_source_path text := nullif(left(coalesce(p_payload->>'sourcePath', ''), 600), '');
  v_location_id uuid;
  v_location_label text;
  v_consent text := nullif(left(coalesce(p_payload->>'consentVersion', ''), 40), '');
  v_receipt text;
  v_id uuid;
  v_existing record;
  v_count integer;
  v_attempt integer := 0;
begin
  -- Resolve the site from trusted routing inputs only.
  if p_site_key is not null then
    select s.* into v_site from public.sites s where s.key = p_site_key and s.mode = 'demo' and s.status = 'active';
  elsif p_host is not null then
    select s.* into v_site from public.domains d join public.sites s on s.id = d.site_id
    where d.normalized_host = lower(p_host) and d.status = 'active' and s.mode = 'live' and s.status = 'active';
  end if;
  if v_site.id is null or v_site.active_release_id is null then
    raise exception 'site not found' using errcode = 'P0002';
  end if;

  -- Idempotent replay: same site + token returns the original receipt.
  if p_idempotency_key is not null then
    select i.id, i.receipt_code into v_existing from public.inquiries i
    where i.site_id = v_site.id and i.idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing.id, v_existing.receipt_code, 'duplicate'::text;
      return;
    end if;
  end if;

  -- Field validation (defense in depth; the application validates first with Zod).
  if length(v_name) < 1 or length(v_name) > 120 then raise exception 'name must be 1-120 characters' using errcode = '22023'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then raise exception 'email address is not valid' using errcode = '22023'; end if;
  if v_phone is not null and length(v_phone) > 40 then raise exception 'phone must be at most 40 characters' using errcode = '22023'; end if;
  if length(btrim(v_message)) < 1 or length(v_message) > 4000 then raise exception 'message must be 1-4000 characters' using errcode = '22023'; end if;
  if v_source_path is not null and left(v_source_path, 1) <> '/' then raise exception 'source path must be site-relative' using errcode = '22023'; end if;

  -- Optional store/place reference must belong to this site's active release.
  if coalesce(p_payload->>'locationId', '') <> '' then
    begin
      v_location_id := (p_payload->>'locationId')::uuid;
    exception when others then
      raise exception 'location reference is not valid' using errcode = '22023';
    end;
    select r.snapshot into v_snapshot from public.releases r where r.id = v_site.active_release_id;
    if v_snapshot #> array['items', v_location_id::text] is null
       or (v_snapshot #> array['items', v_location_id::text] ->> 'kind') not in ('store', 'place') then
      raise exception 'location does not belong to this site' using errcode = '22023';
    end if;
    v_location_label := v_snapshot #> array['items', v_location_id::text] ->> 'title';
  end if;

  -- Persistent rate limits: per requester and per site within the window.
  if p_requester_hash is not null then
    insert into public.rate_limit_events (site_id, scope, key_hash) values (v_site.id, 'inquiry:requester', p_requester_hash);
    select count(*) into v_count from public.rate_limit_events e
    where e.site_id = v_site.id and e.scope = 'inquiry:requester' and e.key_hash = p_requester_hash and e.created_at > now() - p_window;
    if v_count > p_limit_per_requester then
      raise exception 'too many submissions; please try again later' using errcode = 'P0003';
    end if;
  end if;
  insert into public.rate_limit_events (site_id, scope, key_hash) values (v_site.id, 'inquiry:site', 'site');
  select count(*) into v_count from public.rate_limit_events e
  where e.site_id = v_site.id and e.scope = 'inquiry:site' and e.created_at > now() - p_window;
  if v_count > p_limit_per_site then
    raise exception 'this site is receiving too many submissions; please try again later' using errcode = 'P0003';
  end if;

  -- Store the inquiry and its notification job atomically.
  loop
    v_attempt := v_attempt + 1;
    v_receipt := 'LW-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
    begin
      insert into public.inquiries (organization_id, site_id, receipt_code, name, email, phone, message, source_path,
        location_id, location_label, consent_version, idempotency_key)
      values (v_site.organization_id, v_site.id, v_receipt, v_name, v_email, v_phone, v_message, v_source_path,
        v_location_id, v_location_label, v_consent, p_idempotency_key)
      returning id into v_id;
      exit;
    exception when unique_violation then
      if p_idempotency_key is not null then
        select i.id, i.receipt_code into v_existing from public.inquiries i
        where i.site_id = v_site.id and i.idempotency_key = p_idempotency_key;
        if found then
          return query select v_existing.id, v_existing.receipt_code, 'duplicate'::text;
          return;
        end if;
      end if;
      if v_attempt >= 5 then raise; end if;
    end;
  end loop;

  insert into public.delivery_jobs (organization_id, site_id, inquiry_id, channel, recipients)
  values (v_site.organization_id, v_site.id, v_id, 'email', v_site.inquiry_recipients);

  return query select v_id, v_receipt, 'created'::text;
end;
$$;

revoke all on function public.submit_inquiry(text, text, jsonb, text, text, integer, integer, interval) from public;
grant execute on function public.submit_inquiry(text, text, jsonb, text, text, integer, integer, interval) to anon, authenticated;

-- Publishing ----------------------------------------------------------------------------------

create or replace function public.activate_release_candidate(
  p_candidate_id uuid,
  p_idempotency_key text,
  p_reason text default null
) returns table (release_id uuid, outcome text)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_cand public.release_candidates%rowtype;
  v_site public.sites%rowtype;
  v_existing uuid;
  v_release_id uuid;
  v_version integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  select c.* into v_cand from public.release_candidates c where c.id = p_candidate_id;
  if not found then raise exception 'candidate not found' using errcode = 'P0002'; end if;
  if not private.can_publish_site(v_cand.site_id) then
    raise exception 'publish permission required' using errcode = '42501';
  end if;

  -- Serialize activations per site, then re-read everything under the lock.
  select s.* into v_site from public.sites s where s.id = v_cand.site_id for update;
  select c.* into v_cand from public.release_candidates c where c.id = p_candidate_id;

  select r.id into v_existing from public.releases r where r.site_id = v_site.id and r.idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return query select v_existing, 'already_activated'::text; return;
  end if;
  if v_cand.state = 'activated' then
    return query select v_cand.activated_release_id, 'already_activated'::text; return;
  end if;
  if v_cand.state <> 'ready' then
    raise exception 'candidate is not ready to activate (state: %)', v_cand.state using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(v_cand.validation->'blockers', '[]'::jsonb)) > 0 then
    raise exception 'candidate has publication blockers' using errcode = 'P0001';
  end if;
  if v_cand.assets_prepared_at is null then
    raise exception 'publication assets have not been prepared' using errcode = 'P0001';
  end if;
  if v_site.active_release_id is distinct from v_cand.base_release_id then
    update public.release_candidates set state = 'superseded' where id = v_cand.id;
    return query select null::uuid, 'conflict'::text; return;
  end if;

  select coalesce(max(r.version), 0) + 1 into v_version from public.releases r where r.site_id = v_site.id;

  insert into public.releases (organization_id, site_id, version, schema_version, snapshot, snapshot_hash, actor_id, reason,
    source_candidate_id, base_release_id, idempotency_key, waivers)
  values (v_site.organization_id, v_site.id, v_version, v_cand.schema_version, v_cand.manifest, v_cand.manifest_hash, v_uid,
    p_reason, v_cand.id, v_cand.base_release_id, p_idempotency_key, v_cand.waivers)
  returning id into v_release_id;

  update public.sites set active_release_id = v_release_id where id = v_site.id;
  update public.release_candidates
    set state = 'activated', activated_release_id = v_release_id, activated_at = now()
    where id = v_cand.id;
  update public.release_candidates
    set state = 'superseded'
    where site_id = v_site.id and id <> v_cand.id and state in ('ready', 'blocked');

  perform private.audit(v_site.organization_id, v_site.id, 'release.activated', 'release', v_release_id,
    jsonb_build_object('candidateId', v_cand.id, 'version', v_version, 'baseReleaseId', v_cand.base_release_id, 'reason', p_reason));

  return query select v_release_id, 'activated'::text;
end;
$$;

revoke all on function public.activate_release_candidate(uuid, text, text) from public;
grant execute on function public.activate_release_candidate(uuid, text, text) to authenticated;

create or replace function public.restore_release(
  p_release_id uuid,
  p_idempotency_key text,
  p_reason text,
  p_supported_schema_versions integer[]
) returns table (release_id uuid, outcome text)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_old public.releases%rowtype;
  v_site public.sites%rowtype;
  v_existing uuid;
  v_release_id uuid;
  v_version integer;
  v_withdrawn integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'a restoration reason is required' using errcode = '22023';
  end if;

  select r.* into v_old from public.releases r where r.id = p_release_id;
  if not found then raise exception 'release not found' using errcode = 'P0002'; end if;
  if not private.can_publish_site(v_old.site_id) then
    raise exception 'publish permission required' using errcode = '42501';
  end if;

  select s.* into v_site from public.sites s where s.id = v_old.site_id for update;

  select r.id into v_existing from public.releases r where r.site_id = v_site.id and r.idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return query select v_existing, 'already_restored'::text; return;
  end if;
  if v_site.active_release_id = v_old.id then
    return query select v_old.id, 'already_active'::text; return;
  end if;
  if v_old.restoration_blocked_reason is not null then
    raise exception 'this release cannot be restored: %', v_old.restoration_blocked_reason using errcode = 'P0001';
  end if;
  if not (v_old.schema_version = any (p_supported_schema_versions)) then
    raise exception 'this release uses snapshot schema version %, which the current application cannot render', v_old.schema_version using errcode = 'P0001';
  end if;
  select count(*) into v_withdrawn
  from public.media_assets m
  where m.site_id = v_site.id and m.status = 'withdrawn' and (v_old.snapshot->'media') ? m.id::text;
  if v_withdrawn > 0 then
    raise exception 'this release references % withdrawn media asset(s); replace them before restoring', v_withdrawn using errcode = 'P0001';
  end if;

  select coalesce(max(r.version), 0) + 1 into v_version from public.releases r where r.site_id = v_site.id;

  insert into public.releases (organization_id, site_id, version, schema_version, snapshot, snapshot_hash, actor_id, reason,
    restored_from_release_id, base_release_id, idempotency_key, waivers)
  values (v_site.organization_id, v_site.id, v_version, v_old.schema_version, v_old.snapshot, v_old.snapshot_hash, v_uid,
    p_reason, v_old.id, v_site.active_release_id, p_idempotency_key, v_old.waivers)
  returning id into v_release_id;

  update public.sites set active_release_id = v_release_id where id = v_site.id;
  update public.release_candidates set state = 'superseded'
    where site_id = v_site.id and state in ('ready', 'blocked');

  perform private.audit(v_site.organization_id, v_site.id, 'release.restored', 'release', v_release_id,
    jsonb_build_object('restoredFromReleaseId', v_old.id, 'restoredFromVersion', v_old.version, 'version', v_version, 'reason', p_reason));

  return query select v_release_id, 'restored'::text;
end;
$$;

revoke all on function public.restore_release(uuid, text, text, integer[]) from public;
grant execute on function public.restore_release(uuid, text, text, integer[]) to authenticated;

-- Withdraw an asset for rights/privacy reasons: blocks restoration of releases that contain it.
create or replace function public.withdraw_media_asset(p_asset_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_asset public.media_assets%rowtype;
begin
  select m.* into v_asset from public.media_assets m where m.id = p_asset_id;
  if not found then raise exception 'asset not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(v_asset.organization_id) then
    raise exception 'owner permission required' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'a withdrawal reason is required' using errcode = '22023';
  end if;
  update public.media_assets set status = 'withdrawn', withdrawn_reason = p_reason where id = p_asset_id;
  update public.releases r
    set restoration_blocked_reason = coalesce(r.restoration_blocked_reason, 'contains withdrawn media asset ' || p_asset_id::text)
    where r.site_id = v_asset.site_id and (r.snapshot->'media') ? p_asset_id::text;
  perform private.audit(v_asset.organization_id, v_asset.site_id, 'media.withdrawn', 'media_asset', p_asset_id,
    jsonb_build_object('reason', p_reason));
end;
$$;
revoke all on function public.withdraw_media_asset(uuid, text) from public;
grant execute on function public.withdraw_media_asset(uuid, text) to authenticated;

-- Organizations and sites ---------------------------------------------------------------------

-- Controlled onboarding: only an existing organization owner (the agency operator) can create
-- another organization. An authenticated stranger with no memberships cannot.
create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.memberships m where m.user_id = v_uid and m.organization_role = 'owner') then
    raise exception 'only an existing organization owner can create organizations' using errcode = '42501';
  end if;
  if p_name is null or length(btrim(p_name)) < 1 then
    raise exception 'organization name is required' using errcode = '22023';
  end if;
  insert into public.organizations (name) values (btrim(p_name)) returning id into v_id;
  insert into public.memberships (organization_id, user_id, organization_role, created_by) values (v_id, v_uid, 'owner', v_uid);
  perform private.audit(v_id, null, 'organization.created', 'organization', v_id, jsonb_build_object('name', btrim(p_name)));
  return v_id;
end;
$$;
revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;

create or replace function public.create_site(
  p_org uuid,
  p_key text,
  p_name text,
  p_preset public.site_preset,
  p_time_zone text,
  p_mode public.site_mode,
  p_contact jsonb,
  p_config jsonb
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
  insert into public.sites (organization_id, key, name, preset, time_zone, mode, contact_email, contact_phone, contact_address, inquiry_recipients, created_by)
  values (p_org, p_key, btrim(p_name), p_preset, p_time_zone, p_mode,
    nullif(p_contact->>'email', ''), nullif(p_contact->>'phone', ''), nullif(p_contact->>'address', ''),
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_contact->'inquiryRecipients', '[]'::jsonb)) x), '{}'),
    v_uid)
  returning id into v_site_id;
  insert into public.site_config_revisions (organization_id, site_id, version, schema_version, config, author_id, change_note)
  values (p_org, v_site_id, 1, 1, p_config, v_uid, 'Initial configuration from preset')
  returning id into v_config_id;
  update public.sites set current_config_revision_id = v_config_id where id = v_site_id;
  perform private.audit(p_org, v_site_id, 'site.created', 'site', v_site_id,
    jsonb_build_object('key', p_key, 'preset', p_preset, 'mode', p_mode));
  return v_site_id;
end;
$$;
revoke all on function public.create_site(uuid, text, text, public.site_preset, text, public.site_mode, jsonb, jsonb) from public;
grant execute on function public.create_site(uuid, text, text, public.site_preset, text, public.site_mode, jsonb, jsonb) to authenticated;

-- Access management ---------------------------------------------------------------------------

create or replace function public.list_organization_members(p_org uuid)
returns table (user_id uuid, email text, organization_role public.organization_role, site_roles jsonb, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email, m.organization_role,
    coalesce((select jsonb_agg(jsonb_build_object('siteId', sm.site_id, 'siteRole', sm.site_role) order by sm.site_id)
              from public.site_memberships sm where sm.organization_id = m.organization_id and sm.user_id = m.user_id), '[]'::jsonb),
    m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.organization_id = p_org and private.is_org_owner(p_org)
  order by m.created_at;
$$;
revoke all on function public.list_organization_members(uuid) from public;
grant execute on function public.list_organization_members(uuid) to authenticated;

create or replace function public.set_organization_membership(p_org uuid, p_user_id uuid, p_role public.organization_role)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_owner_count integer;
  v_current public.organization_role;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not private.is_org_owner(p_org) then raise exception 'owner permission required' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  select m.organization_role into v_current from public.memberships m where m.organization_id = p_org and m.user_id = p_user_id;
  if v_current = 'owner' and p_role <> 'owner' then
    select count(*) into v_owner_count from public.memberships m where m.organization_id = p_org and m.organization_role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'the last owner of an organization cannot be demoted' using errcode = 'P0001';
    end if;
  end if;
  insert into public.memberships (organization_id, user_id, organization_role, created_by)
  values (p_org, p_user_id, p_role, v_uid)
  on conflict (organization_id, user_id) do update set organization_role = excluded.organization_role;
  perform private.audit(p_org, null, 'membership.set', 'user', p_user_id, jsonb_build_object('role', p_role));
end;
$$;
revoke all on function public.set_organization_membership(uuid, uuid, public.organization_role) from public;
grant execute on function public.set_organization_membership(uuid, uuid, public.organization_role) to authenticated;

create or replace function public.remove_organization_membership(p_org uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_owner_count integer;
  v_current public.organization_role;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not private.is_org_owner(p_org) then raise exception 'owner permission required' using errcode = '42501'; end if;
  select m.organization_role into v_current from public.memberships m where m.organization_id = p_org and m.user_id = p_user_id;
  if v_current is null then return; end if;
  if v_current = 'owner' then
    select count(*) into v_owner_count from public.memberships m where m.organization_id = p_org and m.organization_role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'the last owner of an organization cannot be removed' using errcode = 'P0001';
    end if;
  end if;
  delete from public.site_memberships where organization_id = p_org and user_id = p_user_id;
  delete from public.memberships where organization_id = p_org and user_id = p_user_id;
  perform private.audit(p_org, null, 'membership.removed', 'user', p_user_id, '{}'::jsonb);
end;
$$;
revoke all on function public.remove_organization_membership(uuid, uuid) from public;
grant execute on function public.remove_organization_membership(uuid, uuid) to authenticated;

create or replace function public.set_site_membership(p_site uuid, p_user_id uuid, p_role public.site_role)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := private.site_org(p_site);
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if v_org is null then raise exception 'site not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(v_org) then raise exception 'owner permission required' using errcode = '42501'; end if;
  if not exists (select 1 from public.memberships m where m.organization_id = v_org and m.user_id = p_user_id) then
    raise exception 'user must be a member of the organization first' using errcode = 'P0001';
  end if;
  insert into public.site_memberships (organization_id, site_id, user_id, site_role, created_by)
  values (v_org, p_site, p_user_id, p_role, v_uid)
  on conflict (site_id, user_id) do update set site_role = excluded.site_role;
  perform private.audit(v_org, p_site, 'site_membership.set', 'user', p_user_id, jsonb_build_object('role', p_role));
end;
$$;
revoke all on function public.set_site_membership(uuid, uuid, public.site_role) from public;
grant execute on function public.set_site_membership(uuid, uuid, public.site_role) to authenticated;

create or replace function public.remove_site_membership(p_site uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := private.site_org(p_site);
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if v_org is null then raise exception 'site not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(v_org) then raise exception 'owner permission required' using errcode = '42501'; end if;
  delete from public.site_memberships where site_id = p_site and user_id = p_user_id;
  perform private.audit(v_org, p_site, 'site_membership.removed', 'user', p_user_id, '{}'::jsonb);
end;
$$;
revoke all on function public.remove_site_membership(uuid, uuid) from public;
grant execute on function public.remove_site_membership(uuid, uuid) to authenticated;

-- Invitations ---------------------------------------------------------------------------------

create or replace function public.create_invitation(
  p_org uuid,
  p_email text,
  p_role public.organization_role,
  p_site_assignments jsonb,
  p_ttl interval default interval '7 days'
) returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_id uuid;
  v_expires timestamptz;
  v_assignment jsonb;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not private.is_org_owner(p_org) then raise exception 'owner permission required' using errcode = '42501'; end if;
  if p_email is null or lower(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email address is not valid' using errcode = '22023';
  end if;
  for v_assignment in select * from jsonb_array_elements(coalesce(p_site_assignments, '[]'::jsonb)) loop
    if private.site_org((v_assignment->>'siteId')::uuid) is distinct from p_org then
      raise exception 'site assignment does not belong to this organization' using errcode = '22023';
    end if;
    if (v_assignment->>'siteRole') not in ('publisher', 'editor', 'reviewer') then
      raise exception 'site role is not valid' using errcode = '22023';
    end if;
  end loop;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires := now() + coalesce(p_ttl, interval '7 days');
  insert into public.invitations (organization_id, email, organization_role, site_assignments, token_hash, expires_at, created_by)
  values (p_org, lower(btrim(p_email)), p_role, coalesce(p_site_assignments, '[]'::jsonb),
    encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expires, v_uid)
  returning id into v_id;
  perform private.audit(p_org, null, 'invitation.created', 'invitation', v_id,
    jsonb_build_object('role', p_role, 'siteAssignments', coalesce(p_site_assignments, '[]'::jsonb)));
  return query select v_id, v_token, v_expires;
end;
$$;
revoke all on function public.create_invitation(uuid, text, public.organization_role, jsonb, interval) from public;
grant execute on function public.create_invitation(uuid, text, public.organization_role, jsonb, interval) to authenticated;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invitations%rowtype;
begin
  select i.* into v_inv from public.invitations i where i.id = p_invitation_id;
  if not found then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(v_inv.organization_id) then raise exception 'owner permission required' using errcode = '42501'; end if;
  update public.invitations set revoked_at = now() where id = p_invitation_id and revoked_at is null and accepted_at is null;
  perform private.audit(v_inv.organization_id, null, 'invitation.revoked', 'invitation', p_invitation_id, '{}'::jsonb);
end;
$$;
revoke all on function public.revoke_invitation(uuid) from public;
grant execute on function public.revoke_invitation(uuid) to authenticated;

-- Anonymous preview of an invitation so the landing page can explain what is being accepted.
create or replace function public.get_invitation_preview(p_token text)
returns table (organization_name text, email text, organization_role public.organization_role, expires_at timestamptz, state text)
language sql stable security definer set search_path = '' as $$
  select o.name, i.email, i.organization_role, i.expires_at,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'valid'
    end
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;
revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;

-- Accepts an invitation as the signed-in user. The token binds email and organization; it
-- is single use and expires.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv public.invitations%rowtype;
  v_assignment jsonb;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  select i.* into v_inv from public.invitations i
    where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    for update;
  if not found then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if v_inv.accepted_at is not null then raise exception 'invitation has already been used' using errcode = 'P0001'; end if;
  if v_inv.revoked_at is not null then raise exception 'invitation was revoked' using errcode = 'P0001'; end if;
  if v_inv.expires_at <= now() then raise exception 'invitation has expired' using errcode = 'P0001'; end if;
  if lower(v_email) is distinct from v_inv.email then
    raise exception 'this invitation was issued to a different email address' using errcode = 'P0001';
  end if;
  insert into public.memberships (organization_id, user_id, organization_role, created_by)
  values (v_inv.organization_id, v_uid, v_inv.organization_role, v_inv.created_by)
  on conflict (organization_id, user_id) do update
    set organization_role = case when public.memberships.organization_role = 'owner' then 'owner'::public.organization_role else excluded.organization_role end;
  for v_assignment in select * from jsonb_array_elements(v_inv.site_assignments) loop
    insert into public.site_memberships (organization_id, site_id, user_id, site_role, created_by)
    values (v_inv.organization_id, (v_assignment->>'siteId')::uuid, v_uid, (v_assignment->>'siteRole')::public.site_role, v_inv.created_by)
    on conflict (site_id, user_id) do update set site_role = excluded.site_role;
  end loop;
  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  perform private.audit(v_inv.organization_id, null, 'invitation.accepted', 'invitation', v_inv.id, jsonb_build_object('role', v_inv.organization_role));
  return v_inv.organization_id;
end;
$$;
revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

-- Retention jobs (elevated callers only; no grants) --------------------------------------------

create or replace function public.purge_rate_limit_events(p_older_than interval default interval '1 day')
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  delete from public.rate_limit_events where created_at < now() - p_older_than;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.purge_rate_limit_events(interval) from public;

create or replace function public.purge_old_inquiries(p_retention interval default interval '90 days')
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  delete from public.inquiries where received_at < now() - p_retention;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.purge_old_inquiries(interval) from public;
