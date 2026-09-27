-- Push to deploy (site-building programme B9, decision D-029). A built site is handed to the
-- platform by the CI that built it: a deploy token per site, shown once and stored hashed,
-- authorises the deploy endpoints; the token acts as the person who created it, so the
-- release carries their name and their rights end with it. Client privileges are stated
-- explicitly (D-028); the token hash is never readable by the client roles, and the
-- endpoints resolve a token through the elevated connection.

create table public.site_deploy_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  token_hash text not null unique,
  label text not null default '' check (length(label) <= 80),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);
create index site_deploy_tokens_site_idx on public.site_deploy_tokens(site_id, created_at desc);

alter table public.site_deploy_tokens enable row level security;
revoke all on table public.site_deploy_tokens from public, anon, authenticated;
grant insert on public.site_deploy_tokens to authenticated;
grant select (id, organization_id, site_id, label, created_by, created_at, last_used_at, revoked_at) on public.site_deploy_tokens to authenticated;
grant update (revoked_at) on public.site_deploy_tokens to authenticated;
create policy site_deploy_tokens_select on public.site_deploy_tokens for select to authenticated
  using (private.can_publish_site(site_id));
create policy site_deploy_tokens_insert on public.site_deploy_tokens for insert to authenticated
  with check (private.can_publish_site(site_id) and organization_id = private.site_org(site_id) and created_by = auth.uid());
create policy site_deploy_tokens_update on public.site_deploy_tokens for update to authenticated
  using (private.can_publish_site(site_id)) with check (private.can_publish_site(site_id));
