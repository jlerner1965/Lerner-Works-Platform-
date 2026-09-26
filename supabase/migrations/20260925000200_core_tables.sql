-- Core tenant tables. Every tenant-owned row carries organization_id (and site_id where
-- applicable); composite foreign keys keep a site and its children in one organization.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  primary key (organization_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  key text not null unique check (key ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$'),
  name text not null check (length(name) between 1 and 120),
  preset public.site_preset not null,
  time_zone text not null,
  mode public.site_mode not null default 'demo',
  status text not null default 'active' check (status in ('active', 'archived')),
  contact_email text,
  contact_phone text,
  contact_address text,
  inquiry_recipients text[] not null default '{}',
  current_config_revision_id uuid,
  active_release_id uuid,
  demo_content_loaded_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index sites_org_idx on public.sites(organization_id);

create table public.site_memberships (
  organization_id uuid not null,
  site_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  site_role public.site_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  primary key (site_id, user_id),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade,
  foreign key (organization_id, user_id) references public.memberships(organization_id, user_id) on delete cascade
);
create index site_memberships_user_idx on public.site_memberships(user_id);

create table public.site_config_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  version integer not null check (version >= 1),
  schema_version integer not null default 1,
  config jsonb not null,
  change_note text,
  author_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (site_id, version),
  unique (id, site_id),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);

alter table public.sites
  add constraint sites_current_config_fk
  foreign key (current_config_revision_id, id) references public.site_config_revisions(id, site_id)
  deferrable initially deferred;

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  normalized_host text not null unique check (normalized_host = lower(normalized_host) and length(normalized_host) between 1 and 253),
  status public.domain_status not null default 'pending',
  is_canonical boolean not null default false,
  verification_instructions jsonb,
  verified_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);
create unique index domains_one_canonical_per_site on public.domains(site_id) where is_canonical;
create index domains_site_idx on public.domains(site_id);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  kind public.content_kind not null,
  current_revision_id uuid,
  external_id text check (external_id is null or length(external_id) between 1 and 120),
  archived_at timestamptz,
  archived_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, site_id, organization_id),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);
create unique index content_items_external_id_idx on public.content_items(site_id, kind, external_id) where external_id is not null;
create index content_items_site_kind_idx on public.content_items(site_id, kind, archived_at);

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  organization_id uuid not null,
  site_id uuid not null,
  version integer not null check (version >= 1),
  schema_version integer not null default 1,
  kind public.content_kind not null,
  slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$'),
  title text not null check (length(title) between 1 and 200),
  payload jsonb not null,
  change_note text,
  base_revision_id uuid references public.content_revisions(id),
  author_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (item_id, version),
  unique (id, item_id),
  foreign key (item_id, site_id, organization_id) references public.content_items(id, site_id, organization_id) on delete cascade
);
create index content_revisions_item_idx on public.content_revisions(item_id, version desc);
create index content_revisions_site_idx on public.content_revisions(site_id, created_at desc);

alter table public.content_items
  add constraint content_items_current_revision_fk
  foreign key (current_revision_id, id) references public.content_revisions(id, item_id)
  deferrable initially deferred;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  item_id uuid not null,
  revision_id uuid not null,
  state public.review_state not null,
  comment text check (comment is null or length(comment) <= 4000),
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (revision_id, item_id) references public.content_revisions(id, item_id) on delete cascade,
  foreign key (item_id, site_id, organization_id) references public.content_items(id, site_id, organization_id) on delete cascade
);
create index reviews_revision_idx on public.reviews(revision_id, created_at desc);
create index reviews_site_idx on public.reviews(site_id, created_at desc);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  status public.media_status not null default 'processing',
  original_key text not null unique,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0),
  sha256 text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  derivatives jsonb not null default '{}'::jsonb,
  title text check (title is null or length(title) <= 200),
  alt_text text check (alt_text is null or length(alt_text) <= 500),
  decorative boolean not null default false,
  attribution_text text check (attribution_text is null or length(attribution_text) <= 500),
  license text check (license is null or length(license) <= 200),
  source_url text check (source_url is null or length(source_url) <= 1000),
  withdrawn_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, site_id),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);
create index media_assets_site_idx on public.media_assets(site_id, created_at desc);

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  version integer not null check (version >= 1),
  schema_version integer not null,
  snapshot jsonb not null,
  snapshot_hash text not null,
  actor_id uuid references auth.users(id),
  reason text,
  source_candidate_id uuid,
  restored_from_release_id uuid references public.releases(id),
  base_release_id uuid references public.releases(id),
  idempotency_key text not null,
  waivers jsonb not null default '[]'::jsonb,
  restoration_blocked_reason text,
  created_at timestamptz not null default now(),
  unique (site_id, version),
  unique (site_id, idempotency_key),
  unique (id, site_id),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);
create index releases_site_idx on public.releases(site_id, version desc);

alter table public.sites
  add constraint sites_active_release_fk
  foreign key (active_release_id, id) references public.releases(id, site_id)
  deferrable initially deferred;

create table public.release_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  base_release_id uuid references public.releases(id),
  config_revision_id uuid not null references public.site_config_revisions(id),
  manifest jsonb not null,
  manifest_hash text not null,
  schema_version integer not null,
  selection jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{"blockers":[],"warnings":[]}'::jsonb,
  waivers jsonb not null default '[]'::jsonb,
  state public.candidate_state not null default 'blocked',
  assets_prepared_at timestamptz,
  activated_release_id uuid references public.releases(id),
  activated_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);
create index release_candidates_site_idx on public.release_candidates(site_id, created_at desc);

alter table public.releases
  add constraint releases_source_candidate_fk
  foreign key (source_candidate_id) references public.release_candidates(id);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  receipt_code text not null,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  source_path text,
  location_id uuid,
  location_label text,
  consent_version text,
  status public.inquiry_status not null default 'new',
  idempotency_key text,
  is_demo_fixture boolean not null default false,
  notes text,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (site_id, receipt_code),
  unique (site_id, idempotency_key),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);
create index inquiries_site_status_idx on public.inquiries(site_id, status, received_at desc);
create index inquiries_site_received_idx on public.inquiries(site_id, received_at desc);

create table public.delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  channel text not null default 'email' check (channel in ('email')),
  recipients text[] not null default '{}',
  state public.delivery_state not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 4,
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  provider text,
  provider_reference text,
  provider_accepted boolean,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);
create index delivery_jobs_due_idx on public.delivery_jobs(state, next_attempt_at) where state in ('pending', 'processing');
create index delivery_jobs_inquiry_idx on public.delivery_jobs(inquiry_id);

-- Short-retention abuse counters for public forms. Rows are purged by the retention job.
create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  scope text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_lookup_idx on public.rate_limit_events(site_id, scope, key_hash, created_at desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid,
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_org_idx on public.audit_events(organization_id, created_at desc);
create index audit_events_site_idx on public.audit_events(site_id, created_at desc);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  package_type text not null check (package_type in ('csv', 'site_package')),
  kind public.content_kind,
  filename text,
  file_sha256 text not null,
  row_count integer,
  mapping jsonb not null default '{}'::jsonb,
  dry_run_result jsonb,
  result jsonb,
  state public.import_state not null default 'dry_run',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);
create index import_jobs_site_idx on public.import_jobs(site_id, created_at desc);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email = lower(email)),
  organization_role public.organization_role not null default 'member',
  site_assignments jsonb not null default '[]'::jsonb,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index invitations_org_idx on public.invitations(organization_id, created_at desc);

-- Maintain updated_at automatically.
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger organizations_touch before update on public.organizations for each row execute function private.touch_updated_at();
create trigger sites_touch before update on public.sites for each row execute function private.touch_updated_at();
create trigger domains_touch before update on public.domains for each row execute function private.touch_updated_at();
create trigger content_items_touch before update on public.content_items for each row execute function private.touch_updated_at();
create trigger media_assets_touch before update on public.media_assets for each row execute function private.touch_updated_at();
create trigger release_candidates_touch before update on public.release_candidates for each row execute function private.touch_updated_at();
create trigger inquiries_touch before update on public.inquiries for each row execute function private.touch_updated_at();
create trigger delivery_jobs_touch before update on public.delivery_jobs for each row execute function private.touch_updated_at();
