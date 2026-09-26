-- Hosted readiness: application-managed sessions for the hosted identity provider, the
-- domain verification and activation workflow, and explicit site go-live control.

-- Application sessions -------------------------------------------------------------------------
-- With Supabase Auth the platform verifies credentials against GoTrue once, then issues its
-- own opaque session (random token in an httpOnly cookie, SHA-256 hash here). The table has
-- row-level security enabled and no policies, and every PostgREST role is revoked, so it is
-- reachable only through the functions below, which are executable solely by the
-- application's connecting role (never by anon/authenticated, never over the REST API).

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent text
);
create index if not exists app_sessions_user_idx on public.app_sessions(user_id);
alter table public.app_sessions enable row level security;
revoke all on table public.app_sessions from public, anon, authenticated;

create or replace function private.create_app_session(p_user_id uuid, p_token_hash text, p_ttl interval, p_user_agent text)
returns table (session_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_exp timestamptz;
begin
  if p_user_id is null or not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'unknown user' using errcode = 'P0002';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid session token hash' using errcode = '22023';
  end if;
  v_exp := now() + least(coalesce(p_ttl, interval '14 days'), interval '30 days');
  insert into public.app_sessions (user_id, token_hash, expires_at, user_agent)
  values (p_user_id, p_token_hash, v_exp, left(p_user_agent, 300))
  returning id into v_id;
  -- Keep at most 20 live sessions per user; drop the oldest beyond that and any expired ones.
  delete from public.app_sessions s
  where s.user_id = p_user_id
    and (s.expires_at <= now() or s.id not in (
      select o.id from public.app_sessions o where o.user_id = p_user_id order by o.created_at desc limit 20));
  return query select v_id, v_exp;
end;
$$;

create or replace function private.resolve_app_session(p_token_hash text)
returns table (user_id uuid, email text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v public.app_sessions%rowtype;
begin
  select s.* into v from public.app_sessions s where s.token_hash = p_token_hash and s.expires_at > now();
  if not found then
    return;
  end if;
  if v.last_seen_at < now() - interval '15 minutes' then
    update public.app_sessions set last_seen_at = now() where id = v.id;
  end if;
  return query select v.user_id, u.email::text, v.expires_at from auth.users u where u.id = v.user_id;
end;
$$;

create or replace function private.delete_app_session(p_token_hash text)
returns void
language sql security definer set search_path = '' as $$
  delete from public.app_sessions where token_hash = p_token_hash;
$$;

create or replace function private.delete_user_sessions(p_user_id uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  delete from public.app_sessions where user_id = p_user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.create_app_session(uuid, text, interval, text) from public;
revoke all on function private.resolve_app_session(text) from public;
revoke all on function private.delete_app_session(text) from public;
revoke all on function private.delete_user_sessions(uuid) from public;

-- The application's connecting role (created by `pnpm db:start` locally and by
-- supabase/hosted/0001_application_roles.sql on a hosted project) may call the session
-- functions directly, before switching to anon/authenticated for user-scoped work. The grants
-- are repeated in that hosted script so the order of the two steps does not matter.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'lw_app') then
    grant usage on schema private to lw_app;
    grant execute on function private.create_app_session(uuid, text, interval, text) to lw_app;
    grant execute on function private.resolve_app_session(text) to lw_app;
    grant execute on function private.delete_app_session(text) to lw_app;
    grant execute on function private.delete_user_sessions(uuid) to lw_app;
  end if;
end;
$$;

-- Domain workflow ------------------------------------------------------------------------------
-- pending   registered in the dashboard only
-- verifying registered with the hosting provider; provider instructions recorded; may or may
--           not be verified yet (verified_at says which)
-- active    verified and explicitly activated by an owner; served by get_live_release
-- disabled  switched off by an owner; never served
-- Only these functions change status and verified_at. The verified flag they receive comes
-- from the hosting provider's API as checked by server code, never from a form field.

revoke update (is_canonical) on public.domains from authenticated;

create or replace function public.set_domain_verification(p_domain_id uuid, p_verified boolean, p_instructions jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.domains%rowtype;
begin
  select d.* into v from public.domains d where d.id = p_domain_id for update;
  if not found then raise exception 'domain not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(v.organization_id) then
    raise exception 'only organization owners manage domains' using errcode = '42501';
  end if;
  update public.domains set
    verification_instructions = coalesce(p_instructions, verification_instructions),
    verified_at = case when coalesce(p_verified, false) then coalesce(verified_at, now()) else null end,
    status = case
      when status = 'disabled' then status
      when status = 'active' then status
      else 'verifying'::public.domain_status
    end
  where id = p_domain_id;
  perform private.audit(v.organization_id, v.site_id, 'domain.verification_checked', 'domain', v.id,
    jsonb_build_object('host', v.normalized_host, 'verified', coalesce(p_verified, false)));
end;
$$;

create or replace function public.activate_domain(p_domain_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.domains%rowtype;
begin
  select d.* into v from public.domains d where d.id = p_domain_id for update;
  if not found then raise exception 'domain not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(v.organization_id) then
    raise exception 'only organization owners manage domains' using errcode = '42501';
  end if;
  if v.verified_at is null then
    raise exception 'the domain is not verified by the hosting provider; check verification first' using errcode = 'P0001';
  end if;
  update public.domains set status = 'active' where id = p_domain_id;
  perform private.audit(v.organization_id, v.site_id, 'domain.activated', 'domain', v.id, jsonb_build_object('host', v.normalized_host));
end;
$$;

create or replace function public.disable_domain(p_domain_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.domains%rowtype;
  v_mode public.site_mode;
begin
  select d.* into v from public.domains d where d.id = p_domain_id for update;
  if not found then raise exception 'domain not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(v.organization_id) then
    raise exception 'only organization owners manage domains' using errcode = '42501';
  end if;
  select s.mode into v_mode from public.sites s where s.id = v.site_id;
  if v.is_canonical and v_mode = 'live' then
    raise exception 'this is the canonical domain of a live site; choose another canonical domain or return the site to demonstration mode first' using errcode = 'P0001';
  end if;
  update public.domains set status = 'disabled' where id = p_domain_id;
  perform private.audit(v.organization_id, v.site_id, 'domain.disabled', 'domain', v.id, jsonb_build_object('host', v.normalized_host));
end;
$$;

create or replace function public.set_canonical_domain(p_domain_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.domains%rowtype;
begin
  select d.* into v from public.domains d where d.id = p_domain_id for update;
  if not found then raise exception 'domain not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(v.organization_id) then
    raise exception 'only organization owners manage domains' using errcode = '42501';
  end if;
  if v.status = 'disabled' then
    raise exception 'a disabled domain cannot be canonical' using errcode = 'P0001';
  end if;
  update public.domains set is_canonical = false where site_id = v.site_id and is_canonical and id <> p_domain_id;
  update public.domains set is_canonical = true where id = p_domain_id;
  perform private.audit(v.organization_id, v.site_id, 'domain.canonical_set', 'domain', v.id, jsonb_build_object('host', v.normalized_host));
end;
$$;

create or replace function public.remove_domain(p_domain_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.domains%rowtype;
begin
  select d.* into v from public.domains d where d.id = p_domain_id for update;
  if not found then raise exception 'domain not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(v.organization_id) then
    raise exception 'only organization owners manage domains' using errcode = '42501';
  end if;
  if v.status = 'active' then
    raise exception 'disable the domain before removing it' using errcode = 'P0001';
  end if;
  delete from public.domains where id = p_domain_id;
  perform private.audit(v.organization_id, v.site_id, 'domain.removed', 'domain', v.id, jsonb_build_object('host', v.normalized_host));
end;
$$;

-- Go-live control ------------------------------------------------------------------------------
-- A site is served on its domains only in live mode. Going live requires an active release and
-- an active, verified canonical domain; returning to demonstration mode is always allowed and
-- immediately stops serving the domains (the demo route serves the site again).

create or replace function public.set_site_mode(p_site_id uuid, p_mode public.site_mode)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.sites%rowtype;
begin
  select s.* into v from public.sites s where s.id = p_site_id for update;
  if not found then raise exception 'site not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(v.organization_id) then
    raise exception 'only organization owners change the site mode' using errcode = '42501';
  end if;
  if p_mode = 'live' then
    if v.active_release_id is null then
      raise exception 'publish a release before going live' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.domains d
      where d.site_id = p_site_id and d.is_canonical and d.status = 'active' and d.verified_at is not null
    ) then
      raise exception 'an active, verified canonical domain is required before going live' using errcode = 'P0001';
    end if;
  end if;
  if v.mode = p_mode then return; end if;
  update public.sites set mode = p_mode where id = p_site_id;
  perform private.audit(v.organization_id, v.id, 'site.mode_changed', 'site', v.id, jsonb_build_object('from', v.mode, 'to', p_mode));
end;
$$;

revoke all on function public.set_domain_verification(uuid, boolean, jsonb) from public;
revoke all on function public.activate_domain(uuid) from public;
revoke all on function public.disable_domain(uuid) from public;
revoke all on function public.set_canonical_domain(uuid) from public;
revoke all on function public.remove_domain(uuid) from public;
revoke all on function public.set_site_mode(uuid, public.site_mode) from public;
grant execute on function public.set_domain_verification(uuid, boolean, jsonb) to authenticated;
grant execute on function public.activate_domain(uuid) to authenticated;
grant execute on function public.disable_domain(uuid) to authenticated;
grant execute on function public.set_canonical_domain(uuid) to authenticated;
grant execute on function public.remove_domain(uuid) to authenticated;
grant execute on function public.set_site_mode(uuid, public.site_mode) to authenticated;
