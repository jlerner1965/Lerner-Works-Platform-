-- Site-building programme B2-2: the onboarding package (one spreadsheet per content kind, a
-- settings sheet and an images folder) is a third import job type, imported through the same
-- dry-run-then-confirm step as CSV files and site packages.
alter table public.import_jobs drop constraint if exists import_jobs_package_type_check;
alter table public.import_jobs add constraint import_jobs_package_type_check check (package_type in ('csv', 'site_package', 'onboarding'));
