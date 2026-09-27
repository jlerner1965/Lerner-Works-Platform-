-- Site-building programme B5-1: documents (PDF files) in the media library alongside images.
--
-- A media asset now has a kind. Images keep their dimensions and WebP derivatives; a document
-- has no dimensions and one derivative, `file`, whose public name is the content hash with the
-- file's extension. Everything else about an asset (private original, rights, withdrawal,
-- release references) is the same for both kinds, so the same table holds them.

do $$ begin
  create type public.media_kind as enum ('image', 'document');
exception when duplicate_object then null; end $$;

alter table public.media_assets
  add column if not exists kind public.media_kind not null default 'image';

alter table public.media_assets
  alter column width drop not null,
  alter column height drop not null;

alter table public.media_assets drop constraint if exists media_assets_width_check;
alter table public.media_assets drop constraint if exists media_assets_height_check;
alter table public.media_assets drop constraint if exists media_assets_dimensions_by_kind;
alter table public.media_assets add constraint media_assets_dimensions_by_kind check (
  (kind = 'image' and width is not null and width > 0 and height is not null and height > 0)
  or (kind = 'document' and width is null and height is null)
);

create index if not exists media_assets_site_kind_idx on public.media_assets(site_id, kind, created_at desc);
