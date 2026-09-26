-- Design programme D1: focal point of a media asset.
--
-- focal_x / focal_y are fractions (0–1) from the left and the top of the image that every
-- crop keeps in view (rendered as CSS object-position). Null means the centre. Editors set
-- it in the media library; the value is frozen into release snapshots with the asset.

alter table public.media_assets
  add column if not exists focal_x numeric(4,3) check (focal_x is null or (focal_x >= 0 and focal_x <= 1)),
  add column if not exists focal_y numeric(4,3) check (focal_y is null or (focal_y >= 0 and focal_y <= 1)),
  add constraint media_assets_focal_pair check ((focal_x is null) = (focal_y is null));

grant update (focal_x, focal_y) on public.media_assets to authenticated;
