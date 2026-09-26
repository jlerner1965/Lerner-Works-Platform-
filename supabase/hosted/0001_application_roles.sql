-- HOSTED PROJECTS ONLY. Not a migration: run it once per Supabase project (SQL editor or
-- psql as the project's postgres role), either before or after `supabase db push`.
--
-- It creates the application's connecting role. That role owns no table privileges: every
-- request switches to anon or authenticated (row-level security applies) and only the
-- session functions in the private schema are executable directly. Replace the password,
-- then store the connection string as DATABASE_URL in the hosting provider's secret store.
-- Through the Supabase connection pooler the user name is written as `lw_app.<project-ref>`.
--
-- The elevated connection (DATABASE_ADMIN_URL: migrations, seeds, worker endpoints) uses the
-- project's own postgres role; no second role is created here.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lw_app') then
    create role lw_app login noinherit password 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
  end if;
end;
$$;

alter role lw_app noinherit;
grant anon to lw_app;
grant authenticated to lw_app;

-- Session bookkeeping functions (created by migration 20260925000700). The same grants are
-- attempted by that migration when the role already exists, so this script works before or
-- after the migrations; the guards below skip objects that do not exist yet.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'private') then
    grant usage on schema private to lw_app;
  end if;
  if to_regprocedure('private.create_app_session(uuid, text, interval, text)') is not null then
    grant execute on function private.create_app_session(uuid, text, interval, text) to lw_app;
  end if;
  if to_regprocedure('private.resolve_app_session(text)') is not null then
    grant execute on function private.resolve_app_session(text) to lw_app;
  end if;
  if to_regprocedure('private.delete_app_session(text)') is not null then
    grant execute on function private.delete_app_session(text) to lw_app;
  end if;
  if to_regprocedure('private.delete_user_sessions(uuid)') is not null then
    grant execute on function private.delete_user_sessions(uuid) to lw_app;
  end if;
end;
$$;

-- Verification (expected: rolcanlogin = t, rolinherit = f, rolbypassrls = f)
-- select rolname, rolcanlogin, rolinherit, rolbypassrls from pg_roles where rolname = 'lw_app';
