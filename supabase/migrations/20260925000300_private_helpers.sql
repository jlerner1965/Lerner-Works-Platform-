-- Membership helpers. SECURITY DEFINER with an empty search_path so policies can consult
-- memberships without recursing through the memberships policies themselves.

create or replace function private.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org and m.user_id = auth.uid()
  );
$$;

create or replace function private.is_org_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org and m.user_id = auth.uid() and m.organization_role = 'owner'
  );
$$;

create or replace function private.site_org(p_site uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select s.organization_id from public.sites s where s.id = p_site;
$$;

create or replace function private.site_role(p_site uuid) returns public.site_role
language sql stable security definer set search_path = '' as $$
  select sm.site_role from public.site_memberships sm
  where sm.site_id = p_site and sm.user_id = auth.uid();
$$;

create or replace function private.can_view_site(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sites s
    where s.id = p_site
      and (
        private.is_org_owner(s.organization_id)
        or exists (select 1 from public.site_memberships sm where sm.site_id = s.id and sm.user_id = auth.uid())
      )
  );
$$;

create or replace function private.can_edit_site(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sites s
    where s.id = p_site
      and (
        private.is_org_owner(s.organization_id)
        or exists (
          select 1 from public.site_memberships sm
          where sm.site_id = s.id and sm.user_id = auth.uid() and sm.site_role in ('editor', 'publisher')
        )
      )
  );
$$;

create or replace function private.can_review_site(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sites s
    where s.id = p_site
      and (
        private.is_org_owner(s.organization_id)
        or exists (
          select 1 from public.site_memberships sm
          where sm.site_id = s.id and sm.user_id = auth.uid() and sm.site_role in ('reviewer', 'publisher')
        )
      )
  );
$$;

create or replace function private.can_publish_site(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sites s
    where s.id = p_site
      and (
        private.is_org_owner(s.organization_id)
        or exists (
          select 1 from public.site_memberships sm
          where sm.site_id = s.id and sm.user_id = auth.uid() and sm.site_role = 'publisher'
        )
      )
  );
$$;

-- Owners and publishers may read inquiries; editors and reviewers may not.
create or replace function private.can_view_inquiries(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_publish_site(p_site);
$$;

create or replace function private.audit(
  p_org uuid, p_site uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_org, p_site, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

revoke all on all functions in schema private from public;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.is_org_owner(uuid) to authenticated;
grant execute on function private.site_org(uuid) to authenticated;
grant execute on function private.site_role(uuid) to authenticated;
grant execute on function private.can_view_site(uuid) to authenticated;
grant execute on function private.can_edit_site(uuid) to authenticated;
grant execute on function private.can_review_site(uuid) to authenticated;
grant execute on function private.can_publish_site(uuid) to authenticated;
grant execute on function private.can_view_inquiries(uuid) to authenticated;
grant execute on function private.audit(uuid, uuid, text, text, uuid, jsonb) to authenticated;
