-- Row-level security and explicit grants. No table is readable by anon. Authenticated users
-- see only rows inside organizations/sites they belong to. Mutations that carry authority
-- (memberships, releases, active pointers, inquiries) happen only through SECURITY DEFINER
-- functions defined in the next migration.

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.sites enable row level security;
alter table public.site_memberships enable row level security;
alter table public.site_config_revisions enable row level security;
alter table public.domains enable row level security;
alter table public.content_items enable row level security;
alter table public.content_revisions enable row level security;
alter table public.reviews enable row level security;
alter table public.media_assets enable row level security;
alter table public.releases enable row level security;
alter table public.release_candidates enable row level security;
alter table public.inquiries enable row level security;
alter table public.delivery_jobs enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.import_jobs enable row level security;
alter table public.invitations enable row level security;

-- Explicit, minimal grants. Column lists restrict what authenticated users can change directly.
revoke all on all tables in schema public from anon, authenticated;

grant select on public.organizations to authenticated;
grant update (name) on public.organizations to authenticated;

grant select on public.memberships to authenticated;

grant select on public.sites to authenticated;
grant update (name, time_zone, contact_email, contact_phone, contact_address, inquiry_recipients, current_config_revision_id, demo_content_loaded_at) on public.sites to authenticated;

grant select on public.site_memberships to authenticated;

grant select, insert on public.site_config_revisions to authenticated;

grant select on public.domains to authenticated;
grant insert (organization_id, site_id, normalized_host, is_canonical, created_by) on public.domains to authenticated;
grant update (is_canonical) on public.domains to authenticated;

grant select, insert on public.content_items to authenticated;
grant update (current_revision_id, external_id, archived_at, archived_by) on public.content_items to authenticated;

grant select, insert on public.content_revisions to authenticated;

grant select, insert on public.reviews to authenticated;

grant select, insert on public.media_assets to authenticated;
grant update (status, derivatives, title, alt_text, decorative, attribution_text, license, source_url) on public.media_assets to authenticated;

grant select on public.releases to authenticated;

grant select, insert on public.release_candidates to authenticated;
grant update (validation, waivers, state, assets_prepared_at, summary) on public.release_candidates to authenticated;

grant select on public.inquiries to authenticated;
grant update (status, notes, updated_by) on public.inquiries to authenticated;

grant select on public.delivery_jobs to authenticated;
grant update (state, next_attempt_at, lease_expires_at, last_error) on public.delivery_jobs to authenticated;

grant select, insert on public.audit_events to authenticated;

grant select, insert on public.import_jobs to authenticated;
grant update (mapping, dry_run_result, result, state, completed_at, row_count) on public.import_jobs to authenticated;

grant select on public.invitations to authenticated;

-- Policies -----------------------------------------------------------------------------------

create policy organizations_select on public.organizations for select to authenticated
  using (private.is_org_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (private.is_org_owner(id)) with check (private.is_org_owner(id));

create policy memberships_select on public.memberships for select to authenticated
  using (private.is_org_member(organization_id));

create policy sites_select on public.sites for select to authenticated
  using (private.can_view_site(id));
create policy sites_update on public.sites for update to authenticated
  using (private.can_publish_site(id)) with check (private.can_publish_site(id));

create policy site_memberships_select on public.site_memberships for select to authenticated
  using (private.can_view_site(site_id));

create policy site_config_revisions_select on public.site_config_revisions for select to authenticated
  using (private.can_view_site(site_id));
create policy site_config_revisions_insert on public.site_config_revisions for insert to authenticated
  with check (private.can_edit_site(site_id) and author_id = auth.uid() and organization_id = private.site_org(site_id));

create policy domains_select on public.domains for select to authenticated
  using (private.can_view_site(site_id));
create policy domains_insert on public.domains for insert to authenticated
  with check (private.is_org_owner(organization_id) and organization_id = private.site_org(site_id) and created_by = auth.uid());
create policy domains_update on public.domains for update to authenticated
  using (private.is_org_owner(organization_id)) with check (private.is_org_owner(organization_id));

create policy content_items_select on public.content_items for select to authenticated
  using (private.can_view_site(site_id));
create policy content_items_insert on public.content_items for insert to authenticated
  with check (private.can_edit_site(site_id) and organization_id = private.site_org(site_id) and created_by = auth.uid());
create policy content_items_update on public.content_items for update to authenticated
  using (private.can_edit_site(site_id)) with check (private.can_edit_site(site_id));

create policy content_revisions_select on public.content_revisions for select to authenticated
  using (private.can_view_site(site_id));
create policy content_revisions_insert on public.content_revisions for insert to authenticated
  with check (private.can_edit_site(site_id) and organization_id = private.site_org(site_id) and author_id = auth.uid());

create policy reviews_select on public.reviews for select to authenticated
  using (private.can_view_site(site_id));
-- Editors submit and comment; reviewers comment and request changes; only publishers/owners approve.
create policy reviews_insert on public.reviews for insert to authenticated
  with check (
    actor_id = auth.uid()
    and organization_id = private.site_org(site_id)
    and (
      (state = 'submitted' and private.can_edit_site(site_id))
      or (state = 'comment' and (private.can_edit_site(site_id) or private.can_review_site(site_id)))
      or (state = 'changes_requested' and private.can_review_site(site_id))
      or (state = 'approved' and private.can_publish_site(site_id))
    )
  );

create policy media_assets_select on public.media_assets for select to authenticated
  using (private.can_view_site(site_id));
create policy media_assets_insert on public.media_assets for insert to authenticated
  with check (private.can_edit_site(site_id) and organization_id = private.site_org(site_id) and created_by = auth.uid());
create policy media_assets_update on public.media_assets for update to authenticated
  using (private.can_edit_site(site_id)) with check (private.can_edit_site(site_id));

create policy releases_select on public.releases for select to authenticated
  using (private.can_view_site(site_id));

create policy release_candidates_select on public.release_candidates for select to authenticated
  using (private.can_view_site(site_id));
create policy release_candidates_insert on public.release_candidates for insert to authenticated
  with check (private.can_publish_site(site_id) and organization_id = private.site_org(site_id) and created_by = auth.uid()
    and state in ('ready', 'blocked'));
create policy release_candidates_update on public.release_candidates for update to authenticated
  using (private.can_publish_site(site_id) and state in ('ready', 'blocked'))
  with check (private.can_publish_site(site_id) and state in ('ready', 'blocked', 'discarded'));

create policy inquiries_select on public.inquiries for select to authenticated
  using (private.can_view_inquiries(site_id));
create policy inquiries_update on public.inquiries for update to authenticated
  using (private.can_view_inquiries(site_id)) with check (private.can_view_inquiries(site_id));

create policy delivery_jobs_select on public.delivery_jobs for select to authenticated
  using (private.can_view_inquiries(site_id));
create policy delivery_jobs_update on public.delivery_jobs for update to authenticated
  using (private.can_publish_site(site_id)) with check (private.can_publish_site(site_id));

create policy audit_events_select on public.audit_events for select to authenticated
  using (private.is_org_owner(organization_id) or (site_id is not null and private.can_publish_site(site_id)));
create policy audit_events_insert on public.audit_events for insert to authenticated
  with check (actor_id = auth.uid() and private.is_org_member(organization_id)
    and (site_id is null or private.site_org(site_id) = organization_id));

create policy import_jobs_select on public.import_jobs for select to authenticated
  using (private.can_view_site(site_id));
create policy import_jobs_insert on public.import_jobs for insert to authenticated
  with check (private.can_edit_site(site_id) and organization_id = private.site_org(site_id) and created_by = auth.uid());
create policy import_jobs_update on public.import_jobs for update to authenticated
  using (private.can_edit_site(site_id)) with check (private.can_edit_site(site_id));

create policy invitations_select on public.invitations for select to authenticated
  using (private.is_org_owner(organization_id));

-- rate_limit_events: no policies and no grants; function-only access.
