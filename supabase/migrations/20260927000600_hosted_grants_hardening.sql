-- Hosted grants hardening (decision D-028). A Supabase project grants anon, authenticated and
-- service_role every privilege on new tables and sequences and execute on new functions in
-- public, through the default privileges of the postgres role; a plain PostgreSQL does not.
-- The policies migration revoked the tables of its day; the tables and functions created
-- since carried the defaults on the hosted project (found by the read-only verification
-- after 20260927000500). From here every client privilege is stated explicitly: the tables
-- created after the policies migration get exactly the grants their migrations meant, every
-- function in public loses the client roles' execute unless a migration granted it, and the
-- defaults are turned off for what postgres creates from now on. Row-level security kept the
-- rows in check throughout; what this closes is the ciphertext column of organization
-- secrets, column-level restrictions on the B8 tables, and the purge functions.

-- 1. Tables created after 20260925000400_policies.sql.
revoke all on table public.upload_sessions from public, anon, authenticated;
grant select, insert on public.upload_sessions to authenticated;
grant update (received, state, job_id, completed_at) on public.upload_sessions to authenticated;

revoke all on table public.site_sources from public, anon, authenticated;
grant select, insert, delete on public.site_sources to authenticated;
grant update (repository, branch, root, last_commit, last_checked_at, last_published_commit, last_published_release_id, connected_by) on public.site_sources to authenticated;

revoke all on table public.organization_secrets from public, anon, authenticated;
grant select (organization_id, kind, last4, created_by, created_at, updated_at) on public.organization_secrets to authenticated;

-- No sequences are used (uuid keys); the default grants are taken back all the same.
revoke all on all sequences in schema public from anon, authenticated;

-- 2. Functions: nothing for the client roles unless a migration granted it. The grants below
--    are the ones the migrations made, re-issued verbatim (a unit test keeps this list equal
--    to them); the purge functions and user_display's siblings stay with the elevated role.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.activate_domain(uuid) to authenticated;
grant execute on function public.activate_release_candidate(uuid, text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text, public.organization_role, jsonb, interval) to authenticated;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.create_site(uuid, text, text, public.site_preset, text, public.site_mode, jsonb, jsonb, public.site_type) to authenticated;
grant execute on function public.delete_organization(uuid, text, boolean) to authenticated;
grant execute on function public.delete_organization_secret(uuid, text) to authenticated;
grant execute on function public.delete_site(uuid, text) to authenticated;
grant execute on function public.disable_domain(uuid) to authenticated;
grant execute on function public.get_demo_release(text) to anon, authenticated;
grant execute on function public.get_host_site_type(text) to anon, authenticated;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
grant execute on function public.get_live_release(text) to anon, authenticated;
grant execute on function public.get_site_secret(uuid, text) to authenticated;
grant execute on function public.list_organization_members(uuid) to authenticated;
grant execute on function public.publish_uploaded_release(uuid, jsonb, text, text, text) to authenticated;
grant execute on function public.record_removal_leftovers(uuid, uuid, jsonb) to authenticated;
grant execute on function public.remove_domain(uuid) to authenticated;
grant execute on function public.remove_organization_membership(uuid, uuid) to authenticated;
grant execute on function public.remove_site_membership(uuid, uuid) to authenticated;
grant execute on function public.restore_release(uuid, text, text, integer[]) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.set_canonical_domain(uuid) to authenticated;
grant execute on function public.set_design_delegation(uuid, boolean) to authenticated;
grant execute on function public.set_domain_verification(uuid, boolean, jsonb) to authenticated;
grant execute on function public.set_organization_membership(uuid, uuid, public.organization_role) to authenticated;
grant execute on function public.set_organization_secret(uuid, text, text, text) to authenticated;
grant execute on function public.set_review_policy(uuid, boolean) to authenticated;
grant execute on function public.set_site_membership(uuid, uuid, public.site_role) to authenticated;
grant execute on function public.set_site_mode(uuid, public.site_mode) to authenticated;
grant execute on function public.submit_inquiry(text, text, jsonb, text, text, integer, integer, interval) to anon, authenticated;
grant execute on function public.user_display(uuid) to authenticated;
grant execute on function public.withdraw_media_asset(uuid, text) to authenticated;

-- 3. The defaults for what postgres creates from now on, where this runs as postgres or a
--    superuser (the hosted project); a plain local database has no such defaults and skips it.
do $$
begin
  if current_user = 'postgres' or (select rolsuper from pg_roles where rolname = current_user) then
    execute 'alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated';
    execute 'alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated';
    execute 'alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated';
  else
    raise notice 'default privileges of role postgres left untouched: running as %', current_user;
  end if;
end;
$$;
