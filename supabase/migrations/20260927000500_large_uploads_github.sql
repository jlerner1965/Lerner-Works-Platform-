-- Large uploads and Publish from GitHub (site-building programme B8, decision D-027).
-- A ZIP arrives in parts, each request under the hosting platform's body limit, and is
-- assembled from private storage; an uploaded site may name a GitHub repository as its
-- source, fetched server-side; an organization may hold one GitHub token, encrypted by the
-- application, whose ciphertext is reachable only through the functions below.

-- 1. Upload sessions ---------------------------------------------------------------------

create table public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  created_by uuid not null references auth.users(id),
  filename text not null,
  byte_size bigint not null check (byte_size > 0),
  part_bytes integer not null check (part_bytes > 0),
  parts integer not null check (parts > 0),
  received integer[] not null default '{}',
  state text not null default 'open' check (state in ('open', 'completed', 'abandoned')),
  job_id uuid references public.import_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);
create index upload_sessions_site_idx on public.upload_sessions(site_id, created_at desc);
create index upload_sessions_open_idx on public.upload_sessions(created_at) where state = 'open';

alter table public.upload_sessions enable row level security;
grant select, insert on public.upload_sessions to authenticated;
grant update (received, state, job_id, completed_at) on public.upload_sessions to authenticated;
create policy upload_sessions_select on public.upload_sessions for select to authenticated
  using (private.can_publish_site(site_id));
create policy upload_sessions_insert on public.upload_sessions for insert to authenticated
  with check (private.can_publish_site(site_id) and organization_id = private.site_org(site_id) and created_by = auth.uid());
create policy upload_sessions_update on public.upload_sessions for update to authenticated
  using (private.can_publish_site(site_id) and created_by = auth.uid())
  with check (private.can_publish_site(site_id) and created_by = auth.uid());

-- Sessions still open after p_age are abandoned; the caller (the retention job, with the
-- elevated connection) removes their parts from storage.
create or replace function public.purge_abandoned_uploads(p_age interval default interval '1 day')
returns table (id uuid, organization_id uuid, site_id uuid)
language sql security definer set search_path = '' as $$
  update public.upload_sessions u set state = 'abandoned', completed_at = now()
  where u.state = 'open' and u.created_at < now() - p_age
  returning u.id, u.organization_id, u.site_id;
$$;
revoke all on function public.purge_abandoned_uploads(interval) from public;

-- Checked uploads never published within p_age are cancelled; the caller removes their ZIPs.
create or replace function public.purge_stale_upload_checks(p_age interval default interval '30 days')
returns table (id uuid, organization_id uuid, site_id uuid)
language sql security definer set search_path = '' as $$
  update public.import_jobs j set state = 'cancelled', completed_at = now()
  where j.package_type = 'uploaded_site' and j.state = 'dry_run' and j.created_at < now() - p_age
  returning j.id, j.organization_id, j.site_id;
$$;
revoke all on function public.purge_stale_upload_checks(interval) from public;

-- 2. Site sources -------------------------------------------------------------------------

create table public.site_sources (
  site_id uuid primary key,
  organization_id uuid not null,
  kind text not null check (kind in ('github')),
  repository text not null check (repository ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  branch text not null check (length(branch) between 1 and 200),
  root text check (root is null or (length(root) between 1 and 200 and root !~ '^/' and root !~ '(^|/)\.\.?(/|$)')),
  last_commit text,
  last_checked_at timestamptz,
  last_published_commit text,
  last_published_release_id uuid references public.releases(id) on delete set null,
  connected_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);
create trigger site_sources_touch before update on public.site_sources for each row execute function private.touch_updated_at();

alter table public.site_sources enable row level security;
grant select, insert, delete on public.site_sources to authenticated;
grant update (repository, branch, root, last_commit, last_checked_at, last_published_commit, last_published_release_id, connected_by) on public.site_sources to authenticated;
create policy site_sources_select on public.site_sources for select to authenticated
  using (private.can_view_site(site_id));
create policy site_sources_insert on public.site_sources for insert to authenticated
  with check (private.can_publish_site(site_id) and organization_id = private.site_org(site_id));
create policy site_sources_update on public.site_sources for update to authenticated
  using (private.can_publish_site(site_id)) with check (private.can_publish_site(site_id));
create policy site_sources_delete on public.site_sources for delete to authenticated
  using (private.can_publish_site(site_id));

-- 3. Organization secrets -----------------------------------------------------------------

create table public.organization_secrets (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('github_token')),
  ciphertext text not null,
  last4 text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, kind)
);
alter table public.organization_secrets enable row level security;
-- Owners see that a token exists and its last characters; the ciphertext column is not granted.
grant select (organization_id, kind, last4, created_by, created_at, updated_at) on public.organization_secrets to authenticated;
create policy organization_secrets_select on public.organization_secrets for select to authenticated
  using (private.is_org_owner(organization_id));

create or replace function public.set_organization_secret(p_org uuid, p_kind text, p_ciphertext text, p_last4 text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not private.is_org_owner(p_org) then raise exception 'only organization owners manage tokens' using errcode = '42501'; end if;
  if p_kind is null or p_kind <> 'github_token' then raise exception 'unknown secret kind' using errcode = '22023'; end if;
  if p_ciphertext is null or p_ciphertext !~ '^v1:' or length(p_ciphertext) < 24 then raise exception 'ciphertext required' using errcode = '22023'; end if;
  insert into public.organization_secrets (organization_id, kind, ciphertext, last4, created_by)
  values (p_org, p_kind, p_ciphertext, coalesce(p_last4, ''), auth.uid())
  on conflict (organization_id, kind) do update
    set ciphertext = excluded.ciphertext, last4 = excluded.last4, created_by = excluded.created_by, updated_at = now();
  perform private.audit(p_org, null, 'organization.secret_set', 'organization', p_org, jsonb_build_object('kind', p_kind, 'last4', coalesce(p_last4, '')));
end;
$$;
revoke all on function public.set_organization_secret(uuid, text, text, text) from public;
grant execute on function public.set_organization_secret(uuid, text, text, text) to authenticated;

create or replace function public.delete_organization_secret(p_org uuid, p_kind text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_found boolean;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not private.is_org_owner(p_org) then raise exception 'only organization owners manage tokens' using errcode = '42501'; end if;
  delete from public.organization_secrets where organization_id = p_org and kind = p_kind;
  v_found := found;
  if v_found then
    perform private.audit(p_org, null, 'organization.secret_removed', 'organization', p_org, jsonb_build_object('kind', p_kind));
  end if;
  return v_found;
end;
$$;
revoke all on function public.delete_organization_secret(uuid, text) from public;
grant execute on function public.delete_organization_secret(uuid, text) to authenticated;

-- Whoever may publish a site may use its organization's token through the application (the
-- token is decrypted on the server and never shown); null when none is stored.
create or replace function public.get_site_secret(p_site uuid, p_kind text)
returns text
language sql stable security definer set search_path = '' as $$
  select s.ciphertext
  from public.organization_secrets s
  join public.sites st on st.organization_id = s.organization_id
  where st.id = p_site and s.kind = p_kind and private.can_publish_site(p_site);
$$;
revoke all on function public.get_site_secret(uuid, text) from public;
grant execute on function public.get_site_secret(uuid, text) to authenticated;
