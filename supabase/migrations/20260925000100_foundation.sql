-- Foundation: extensions, schemas, enumerated types.
-- Compatible with hosted Supabase (anon/authenticated/service_role roles and the
-- `extensions` schema already exist there) and with the local PostgreSQL bootstrap.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- Helper functions that must never be callable through an exposed API live here.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

grant usage on schema public to anon, authenticated;
grant usage on schema extensions to anon, authenticated;

do $$ begin
  create type public.organization_role as enum ('owner', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.site_role as enum ('publisher', 'editor', 'reviewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.site_preset as enum ('community_guide', 'location_business');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.site_mode as enum ('demo', 'live');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_kind as enum ('page', 'place', 'event', 'article', 'store', 'service');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_state as enum ('submitted', 'comment', 'changes_requested', 'approved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.candidate_state as enum ('ready', 'blocked', 'activated', 'superseded', 'discarded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_status as enum ('processing', 'ready', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inquiry_status as enum ('new', 'in_progress', 'resolved', 'spam');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.delivery_state as enum ('pending', 'processing', 'delivered', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.domain_status as enum ('pending', 'verifying', 'active', 'disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.import_state as enum ('dry_run', 'completed', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;
