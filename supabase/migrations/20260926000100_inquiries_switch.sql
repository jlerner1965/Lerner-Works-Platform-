-- Design programme D0: the Inquiries module switch is enforced at intake.
--
-- public.submit_inquiry resolves the site from trusted routing inputs and now refuses a
-- submission when the site's active release was published with the Inquiries module off
-- (config.modules.inquiries = false in the release snapshot). The application maps the
-- P0002 error to a 404 "This site does not accept inquiries." Same signature as before;
-- grants are restated for clarity.

create or replace function public.submit_inquiry(
  p_site_key text,
  p_host text,
  p_payload jsonb,
  p_requester_hash text,
  p_idempotency_key text,
  p_limit_per_requester integer default 5,
  p_limit_per_site integer default 100,
  p_window interval default interval '10 minutes'
) returns table (inquiry_id uuid, receipt_code text, outcome text)
language plpgsql security definer set search_path = '' as $$
declare
  v_site public.sites%rowtype;
  v_snapshot jsonb;
  v_name text := left(btrim(coalesce(p_payload->>'name', '')), 200);
  v_email text := left(lower(btrim(coalesce(p_payload->>'email', ''))), 260);
  v_phone text := nullif(left(btrim(coalesce(p_payload->>'phone', '')), 60), '');
  v_message text := left(coalesce(p_payload->>'message', ''), 5000);
  v_source_path text := nullif(left(coalesce(p_payload->>'sourcePath', ''), 600), '');
  v_location_id uuid;
  v_location_label text;
  v_consent text := nullif(left(coalesce(p_payload->>'consentVersion', ''), 40), '');
  v_receipt text;
  v_id uuid;
  v_existing record;
  v_count integer;
  v_attempt integer := 0;
begin
  -- Resolve the site from trusted routing inputs only.
  if p_site_key is not null then
    select s.* into v_site from public.sites s where s.key = p_site_key and s.mode = 'demo' and s.status = 'active';
  elsif p_host is not null then
    select s.* into v_site from public.domains d join public.sites s on s.id = d.site_id
    where d.normalized_host = lower(p_host) and d.status = 'active' and s.mode = 'live' and s.status = 'active';
  end if;
  if v_site.id is null or v_site.active_release_id is null then
    raise exception 'site not found' using errcode = 'P0002';
  end if;

  -- The published release decides whether the site accepts inquiries at all.
  select r.snapshot into v_snapshot from public.releases r where r.id = v_site.active_release_id;
  if coalesce((v_snapshot #>> '{config,modules,inquiries}')::boolean, true) is false then
    raise exception 'this site does not accept inquiries' using errcode = 'P0002';
  end if;

  -- Idempotent replay: same site + token returns the original receipt.
  if p_idempotency_key is not null then
    select i.id, i.receipt_code into v_existing from public.inquiries i
    where i.site_id = v_site.id and i.idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing.id, v_existing.receipt_code, 'duplicate'::text;
      return;
    end if;
  end if;

  -- Field validation (defense in depth; the application validates first with Zod).
  if length(v_name) < 1 or length(v_name) > 120 then raise exception 'name must be 1-120 characters' using errcode = '22023'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then raise exception 'email address is not valid' using errcode = '22023'; end if;
  if v_phone is not null and length(v_phone) > 40 then raise exception 'phone must be at most 40 characters' using errcode = '22023'; end if;
  if length(btrim(v_message)) < 1 or length(v_message) > 4000 then raise exception 'message must be 1-4000 characters' using errcode = '22023'; end if;
  if v_source_path is not null and left(v_source_path, 1) <> '/' then raise exception 'source path must be site-relative' using errcode = '22023'; end if;

  -- Optional store/place reference must belong to this site's active release.
  if coalesce(p_payload->>'locationId', '') <> '' then
    begin
      v_location_id := (p_payload->>'locationId')::uuid;
    exception when others then
      raise exception 'location reference is not valid' using errcode = '22023';
    end;
    if v_snapshot #> array['items', v_location_id::text] is null
       or (v_snapshot #> array['items', v_location_id::text] ->> 'kind') not in ('store', 'place') then
      raise exception 'location does not belong to this site' using errcode = '22023';
    end if;
    v_location_label := v_snapshot #> array['items', v_location_id::text] ->> 'title';
  end if;

  -- Persistent rate limits: per requester and per site within the window.
  if p_requester_hash is not null then
    insert into public.rate_limit_events (site_id, scope, key_hash) values (v_site.id, 'inquiry:requester', p_requester_hash);
    select count(*) into v_count from public.rate_limit_events e
    where e.site_id = v_site.id and e.scope = 'inquiry:requester' and e.key_hash = p_requester_hash and e.created_at > now() - p_window;
    if v_count > p_limit_per_requester then
      raise exception 'too many submissions; please try again later' using errcode = 'P0003';
    end if;
  end if;
  insert into public.rate_limit_events (site_id, scope, key_hash) values (v_site.id, 'inquiry:site', 'site');
  select count(*) into v_count from public.rate_limit_events e
  where e.site_id = v_site.id and e.scope = 'inquiry:site' and e.created_at > now() - p_window;
  if v_count > p_limit_per_site then
    raise exception 'this site is receiving too many submissions; please try again later' using errcode = 'P0003';
  end if;

  -- Store the inquiry and its notification job atomically.
  loop
    v_attempt := v_attempt + 1;
    v_receipt := 'LW-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
    begin
      insert into public.inquiries (organization_id, site_id, receipt_code, name, email, phone, message, source_path,
        location_id, location_label, consent_version, idempotency_key)
      values (v_site.organization_id, v_site.id, v_receipt, v_name, v_email, v_phone, v_message, v_source_path,
        v_location_id, v_location_label, v_consent, p_idempotency_key)
      returning id into v_id;
      exit;
    exception when unique_violation then
      if p_idempotency_key is not null then
        select i.id, i.receipt_code into v_existing from public.inquiries i
        where i.site_id = v_site.id and i.idempotency_key = p_idempotency_key;
        if found then
          return query select v_existing.id, v_existing.receipt_code, 'duplicate'::text;
          return;
        end if;
      end if;
      if v_attempt >= 5 then raise; end if;
    end;
  end loop;

  insert into public.delivery_jobs (organization_id, site_id, inquiry_id, channel, recipients)
  values (v_site.organization_id, v_site.id, v_id, 'email', v_site.inquiry_recipients);

  return query select v_id, v_receipt, 'created'::text;
end;
$$;

revoke all on function public.submit_inquiry(text, text, jsonb, text, text, integer, integer, interval) from public;
grant execute on function public.submit_inquiry(text, text, jsonb, text, text, integer, integer, interval) to anon, authenticated;
