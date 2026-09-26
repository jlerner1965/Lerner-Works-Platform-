-- Display name (email) of a user for dashboard lists, visible only to people who share an
-- organization with that user. auth.users itself is never readable by the authenticated role.

create or replace function public.user_display(p_user_id uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select u.email
  from auth.users u
  where u.id = p_user_id
    and (
      p_user_id = auth.uid()
      or exists (
        select 1 from public.memberships a
        join public.memberships b on b.organization_id = a.organization_id
        where a.user_id = auth.uid() and b.user_id = p_user_id
      )
    );
$$;
revoke all on function public.user_display(uuid) from public;
grant execute on function public.user_display(uuid) to authenticated;
