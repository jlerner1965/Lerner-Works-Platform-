-- Site-building programme B1 (docs/SITE-BUILDING-PLAN.md, decision D-020): a per-site review
-- policy. With review not required (the default), a revision saved by someone who may publish
-- is approved on save; the approval is still an immutable review row on that exact revision.
-- With review required, nothing is approved without an explicit decision.

alter table public.sites add column review_required boolean not null default false;
comment on column public.sites.review_required is 'When true, every revision needs an explicit approval before publication, including a publisher''s own work; when false, publishers'' and owners'' saves are approved on save.';

create or replace function public.set_review_policy(p_site_id uuid, p_required boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.sites%rowtype;
begin
  select s.* into v from public.sites s where s.id = p_site_id for update;
  if not found then raise exception 'site not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(v.organization_id) then
    raise exception 'only organization owners change the review policy' using errcode = '42501';
  end if;
  if v.review_required = p_required then return; end if;
  update public.sites set review_required = p_required where id = p_site_id;
  perform private.audit(v.organization_id, v.id, 'site.review_policy_changed', 'site', v.id, jsonb_build_object('reviewRequired', p_required));
end;
$$;

revoke all on function public.set_review_policy(uuid, boolean) from public;
grant execute on function public.set_review_policy(uuid, boolean) to authenticated;
