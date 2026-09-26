-- LOCAL-ONLY compatibility shim.
-- Applied by `pnpm db:migrate` only when the target database has no `auth.uid()` function,
-- i.e. a plain PostgreSQL server rather than a Supabase project. It reproduces the minimal
-- surface of Supabase Auth that the platform schema depends on (auth.users, auth.uid(),
-- auth.role(), auth.jwt()) and adds a development-only credential/session store in the
-- `local_auth` schema used by the local auth provider. Hosted Supabase projects never run
-- this file: there, GoTrue owns auth.users and the local provider is disabled.

-- pgcrypto lives in the `extensions` schema on Supabase; mirror that layout locally.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mirrors Supabase's definitions: identity comes from the request's JWT claims setting.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant execute on function auth.role() to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;

-- Development-only credential and session store -------------------------------------------

create schema if not exists local_auth;
revoke all on schema local_auth from public;

create table if not exists local_auth.credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists local_auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists local_auth_sessions_user_idx on local_auth.sessions(user_id);

-- Creates or replaces a local user with a bcrypt password hash. Elevated callers only (seeds).
create or replace function local_auth.upsert_user(p_email text, p_password text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_email is null or position('@' in p_email) = 0 then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if p_password is null or length(p_password) < 12 then
    raise exception 'password must be at least 12 characters' using errcode = '22023';
  end if;
  insert into auth.users (email, email_confirmed_at)
  values (lower(p_email), now())
  on conflict (email) do update set updated_at = now()
  returning id into v_id;
  insert into local_auth.credentials (user_id, password_hash)
  values (v_id, extensions.crypt(p_password, extensions.gen_salt('bf', 10)))
  on conflict (user_id) do update
    set password_hash = excluded.password_hash, updated_at = now();
  return v_id;
end;
$$;

-- Password sign-in. Returns a fresh opaque session token (only its hash is stored).
create or replace function local_auth.sign_in(p_email text, p_password text, p_ttl interval default interval '12 hours')
returns table (user_id uuid, session_token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_hash text;
  v_token text;
  v_expires timestamptz;
begin
  select u.* into v_user from auth.users u where u.email = lower(p_email);
  if not found then
    -- burn comparable time so timing does not reveal account existence
    perform extensions.crypt(coalesce(p_password, ''), extensions.gen_salt('bf', 10));
    return;
  end if;
  select c.password_hash into v_hash from local_auth.credentials c where c.user_id = v_user.id;
  if v_hash is null or extensions.crypt(coalesce(p_password, ''), v_hash) <> v_hash then
    return;
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires := now() + p_ttl;
  insert into local_auth.sessions (user_id, token_hash, expires_at)
  values (v_user.id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expires);
  return query select v_user.id, v_token, v_expires;
end;
$$;

-- Resolves a session token to a user. Extends last_seen; returns nothing when invalid/expired.
create or replace function local_auth.resolve_session(p_token text)
returns table (user_id uuid, email text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
begin
  update local_auth.sessions s
    set last_seen_at = now()
  where s.token_hash = v_hash and s.revoked_at is null and s.expires_at > now();
  return query
    select u.id, u.email, s.expires_at
    from local_auth.sessions s
    join auth.users u on u.id = s.user_id
    where s.token_hash = v_hash and s.revoked_at is null and s.expires_at > now();
end;
$$;

create or replace function local_auth.sign_out(p_token text)
returns void
language sql security definer set search_path = ''
as $$
  update local_auth.sessions
    set revoked_at = now()
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and revoked_at is null;
$$;

-- Used by the local invitation flow: creates the invited account and a session in one step.
-- The invitation token is validated here (email binding, expiry, single use) and the caller
-- then accepts the invitation as that user through public.accept_invitation.
create or replace function local_auth.register_invited_user(p_invitation_token text, p_password text)
returns table (user_id uuid, session_token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv record;
  v_uid uuid;
  v_token text;
  v_expires timestamptz;
begin
  select i.* into v_inv
  from public.invitations i
  where i.token_hash = encode(extensions.digest(coalesce(p_invitation_token, ''), 'sha256'), 'hex');
  if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'invitation is not valid' using errcode = 'P0001';
  end if;
  if exists (select 1 from auth.users u where u.email = v_inv.email) then
    raise exception 'an account with this email already exists; sign in instead' using errcode = 'P0001';
  end if;
  if p_password is null or length(p_password) < 12 then
    raise exception 'password must be at least 12 characters' using errcode = '22023';
  end if;
  insert into auth.users (email, email_confirmed_at) values (v_inv.email, now()) returning id into v_uid;
  insert into local_auth.credentials (user_id, password_hash)
  values (v_uid, extensions.crypt(p_password, extensions.gen_salt('bf', 10)));
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires := now() + interval '12 hours';
  insert into local_auth.sessions (user_id, token_hash, expires_at)
  values (v_uid, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expires);
  return query select v_uid, v_token, v_expires;
end;
$$;

revoke all on function local_auth.upsert_user(text, text) from public;
revoke all on function local_auth.sign_in(text, text, interval) from public;
revoke all on function local_auth.resolve_session(text) from public;
revoke all on function local_auth.sign_out(text) from public;
revoke all on function local_auth.register_invited_user(text, text) from public;

grant usage on schema local_auth to anon, authenticated;
grant execute on function local_auth.sign_in(text, text, interval) to anon, authenticated;
grant execute on function local_auth.resolve_session(text) to anon, authenticated;
grant execute on function local_auth.sign_out(text) to anon, authenticated;
grant execute on function local_auth.register_invited_user(text, text) to anon, authenticated;
