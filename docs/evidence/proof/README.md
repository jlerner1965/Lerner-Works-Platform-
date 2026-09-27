# The proof (site-building programme B4)

The programme's bar, in the owner's words: the platform has to be good enough that they would
choose it to build a client site instead of building the site by hand, and the result has to
be a launch-ready site that does not look templated or basic. This folder is the evidence for
that judgement: two realistic client sites built end to end through the dashboard with real
photography, counted and timed, and captured under every composition of their preset.

## The two sites

| Site | Preset | Built with | Content | Photography |
|---|---|---|---|---|
| Cedar Bend Guide (`src/server/demo/proof/cedar-bend.ts`) | Community guide | Magazine composition; captured under the almanac and the guide as well | 19 places with verified details and hours, 7 events (one postponed), 6 articles, the brand, the home and About text; the home page composed with a collage hero, two picture rows, a photo band, two quotations with portraits, the editors and the members' marks; the About page with an offset hero and a gallery with the lightbox; one event added from the list | 40 photographs |
| Bookcliff Farm Markets (`src/server/demo/proof/bookcliff.ts`) | Location business | Storefront composition; captured under the practice and the retail default as well | 3 markets with hours (one seasonal), 5 services, the brand, the home and About text; the home page composed with two picture rows, a photo band, two quotations, the people and the members' marks | 21 photographs |

Every photograph is from the Carol M. Highsmith Archive at the Library of Congress (public
domain, "no known restrictions on publication"), listed with its catalogue record in
`docs/evidence/ASSETS.md`. The towns, businesses, people, addresses and phone numbers are
invented; the people and the members' marks are stylised artwork, because no licensed
photographs of consenting people were available.

## What was measured

`tests/e2e/proof.spec.ts` builds each site as a person does, through the sidebar, the forms
and the buttons, from the onboarding package a client fills in (`pnpm proof:package --site
cedar-bend`; since B5 the package carries the content as one Excel workbook, `content.xlsx`,
with a sheet per kind and the Site and Images sheets, beside the pictures): create the site,
import the package (brand, contact details, content, pictures
with their alternative text and rights, the home and About text), choose the composition,
compose the home page section by section in the editor, compose the About page, add an event
from the list, publish. Per task it counts the screens opened, the fields filled and the links
or buttons pressed, and records the scripted wall time; `latest.json` holds the numbers of
the last run of the browser suite, per task and in total, with the releases published for the
captures.

The counts are what a person does. The time is the script's: it types instantly and never
reads, so a person needs several times longer; the person's own timing of a complete build is
the owner's, on production, with the same packages, and is the number the bar is judged by.

## Captures

`cedar-bend/<composition>/` and `bookcliff/<composition>/` hold the published pages as JPEGs:
every public page kind at 390, 768 and 1440 CSS pixels under the composition used for the
build, and the home, About, index and detail pages at 390 and 1440 under the preset's other
two compositions. Each capture is taken after the page settled, and the run fails on
horizontal overflow or a console error. The browser suite writes `latest.json` on every run
but puts the captures in the repository only when asked (`PROOF_EVIDENCE=1 pnpm test:e2e`,
or `PROOF_EVIDENCE=1 pnpm verify` for a gate run that refreshes them); a routine run writes
them to `.data/proof-captures/`, so the committed evidence changes only when a phase is
recorded.

## Rebuilding the sites on production

1. Create a site from the preset (Community guide for Cedar Bend, Location business for
   Bookcliff) as an organization owner.
2. `pnpm proof:package --site cedar-bend` (or `bookcliff`) writes the package; upload it on
   Import & export, confirm the dry run.
3. Look: choose the composition (Magazine, Storefront, or any other written for the preset);
   compose the home and About pages as the browser test does, or as wanted.
4. Publish now.

The photographs are committed under `src/server/demo/proof/photos/`; `pnpm proof:photos`
fetches them again from the archive if they are ever missing.
