-- Site-building programme B5-2: a link to another website is a content kind of its own.
--
-- Items of kind `link` carry a title, a picture and text about an outside resource and its
-- https address; the public site lists them as cards that open the other site and gives each
-- a small page of its own. The enum value is added in a migration of its own: a new enum value
-- cannot be used in the transaction that adds it, and every other change of this phase is in
-- application code and JSON payloads.

alter type public.content_kind add value if not exists 'link';
