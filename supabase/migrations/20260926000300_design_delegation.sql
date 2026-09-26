-- Design programme D2 (decisions D-014, D-017): design controls belong to organization owners.
-- An owner may delegate them to one site's publishers; the switch is audited, and a
-- configuration revision that changes the design is refused at the database level unless the
-- author is an owner or the site's design is delegated.

alter table public.sites add column design_delegated boolean not null default false;
comment on column public.sites.design_delegated is 'When true, this site''s publishers may change its design settings (owner-only otherwise).';

create or replace function public.set_design_delegation(p_site_id uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.sites%rowtype;
begin
  select s.* into v from public.sites s where s.id = p_site_id for update;
  if not found then raise exception 'site not found' using errcode = 'P0002'; end if;
  if not private.is_org_owner(v.organization_id) then
    raise exception 'only organization owners delegate design' using errcode = '42501';
  end if;
  if v.design_delegated = p_enabled then return; end if;
  update public.sites set design_delegated = p_enabled where id = p_site_id;
  perform private.audit(v.organization_id, v.id, 'design.delegation_changed', 'site', v.id, jsonb_build_object('delegated', p_enabled));
end;
$$;

revoke all on function public.set_design_delegation(uuid, boolean) from public;
grant execute on function public.set_design_delegation(uuid, boolean) to authenticated;

-- A new configuration revision may change `design` only when written by an organization owner
-- or, for a site with delegated design, by anyone allowed to write revisions (publishers).
create or replace function private.check_design_change()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_current jsonb;
  v_delegated boolean;
begin
  select r.config -> 'design', s.design_delegated into v_current, v_delegated
  from public.sites s
  left join public.site_config_revisions r on r.id = s.current_config_revision_id
  where s.id = new.site_id;
  if v_current is null then return new; end if; -- first revision, or a configuration from before design settings existed
  if (new.config -> 'design') is distinct from v_current
     and not private.is_org_owner(new.organization_id)
     and not coalesce(v_delegated, false) then
    raise exception 'design changes need an organization owner, or design delegated to this site''s publishers' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists site_config_revisions_design_check on public.site_config_revisions;
create trigger site_config_revisions_design_check
  before insert on public.site_config_revisions
  for each row execute function private.check_design_change();
