# Site-building programme

Agreed with the owner on 2026-09-26, after the design programme's phase D2. The bar, in the
owner's words: the platform has to be good enough that they would choose it to build a client
site instead of building the site by hand, and the result has to be a launch-ready site that
does not look templated or basic. This programme is measured against that bar, not against
feature counts. Everything in it is built to last: real persistence through migrations,
server-side rules, tests at the unit, integration and browser levels, documentation and the
release gate, on the session branch, with production deploys only on the owner's go.

The design boundary stands (`docs/DECISIONS.md` D-017: not a page builder). Nothing here adds a
canvas, free positioning, per-element styling, custom code, a template gallery or generated
copy. The programme makes the existing structures fast to use and the compositions richer.

## 1 Baseline (honest assessment, 2026-09-26)

Judged on the two pilots and on a fresh site created from each preset (`docs/PROGRESS.md`
records the check):

- **Ceiling.** A fully populated site looks professional: coherent typography, brand-derived
  colour, correct hours and events, four compositions, fast and accessible. It still reads as
  a well-made template family: recognisable structure per composition, restrained sections,
  little art direction beyond an overlay and a focal point, no motion, no team or testimonial
  faces, no logo strip, no gallery lightbox, a map link where clients expect a map. The pilots'
  flat illustrations flatter the compositions; ordinary photographs would look plainer.
- **Floor.** A fresh site publishes as an empty scaffold ("No hero image selected yet", four
  sections saying nothing has been added). Nothing carries the owner from that to launch.
- **Effort.** Every place, store, event and article is typed into a form of eight to fifteen
  fields; every item needs an approval before it can publish, including the owner's own;
  publishing takes three screens; settings sit across nine cards on one page; the sidebar
  names the system's parts rather than the owner's tasks. Populating a twenty-place guide is a
  day of form filling before any copy is written. Hand-building a one-off is faster today.

Verdict at the baseline: not good enough. The ceiling is respectable, the floor and the effort
fail the bar.

## 2 Principles

1. **The daily task is the unit of design.** Every screen answers "what do I do here, and what
   happens next". Menus name tasks, not tables.
2. **One person, one step.** A person who may publish never has to approve their own work in
   a separate step, and publishes in one action; the four-eyes flow stays available for teams
   that want it, as a site setting.
3. **Never empty.** A new site arrives with a real structure to replace, not with empty states;
   imports fill many records at once; defaults are sensible and required fields are few.
4. **Richness inside the boundary.** Compositions gain treatments, sections and a third
   composition per preset; every addition is a typed section or an enumerated option.
5. **Measured, then fixed.** Each phase ends with the same walk-through, counted and timed
   by a browser test, and the numbers go in `docs/ACCEPTANCE.md` (SB-06). Screenshots and
   Lighthouse stay in the gate.
6. **Built right.** Migrations for data, services for rules, tests for behaviour, docs for
   the next session. No feature flags left behind, no "temporary" screens.

## 3 Phases

### B1 · Publish in one step, navigate by task

- Per-site review policy (`sites.review_required`, default off): when off, a revision saved
  by someone who may publish is approved on save, recorded as an immutable review row on
  that exact revision and audited; editors' work still needs a publisher. When on, nothing is
  approved without an explicit decision (today's behaviour). Set in Settings by owners.
- Publish page: what will change (computed from the current approved work without writing),
  blockers with links, warnings, one "Publish now" action that builds the candidate and
  activates it. The careful path (build, preview the frozen candidate, waive warnings,
  activate) stays as the advanced section. Restore stays.
- Sidebar and overview rebuilt around tasks: Overview (setup, what is unpublished, publish),
  content by kind, Media, Look (brand, design, theme and the preview on one page), Inbox,
  Publish, Settings (site details, navigation and footer, domains, review policy, team,
  import and export, activity). Every page keeps the site name and a breadcrumb.
- Editor: "Save" with "Publish" at hand when the person may publish and review is off;
  "Save draft" and "Request review" otherwise. Preview stays.
- Exit: SB-01 to SB-03 PASS (section 4); the walk-through measured (SB-06).
- Status: built and verified in the repository on 2026-09-26 (`docs/ACCEPTANCE.md` SB-01 to
  SB-03 PASS, SB-06 recorded; decision D-020); on production since pull request #10 the same
  day (`docs/evidence/production/d2-b1-2026-09-26-live-checks.txt`).

### B2 · From empty to launch

- Starter pages with a real structure whose slots fill themselves (category list from the
  published places, latest places, upcoming events, latest articles; store finder and
  services) or wait for the owner's words (introduction, About), still no fictional copy. A
  section with nothing to show is left out of the public page (D-021); publication lists what
  is left out; the editor marks each slot; the setup checklist names the text still to write.
- Onboarding package: a downloadable template (one spreadsheet per content kind including
  articles and services, a settings sheet for the brand, contact details and the starter
  pages' text, an images folder with a sheet for alternative text and rights) imported in the
  existing dry-run-then-confirm step; images, rows and settings applied in one transaction.
- Media uploaded many files at once with one rights statement, then an alternative-text pass
  for every image on one screen.
- Editor speed: quick add from the list (title, and the category for a place, then the
  editor), duplicate an item, category suggestions from the site, the site as the default
  attribution of an article, the site's time zone for events and stores.
- Imports follow the site's review policy: approved on save for someone who may publish when
  review is not required.
- Exit: SB-04 and SB-05 PASS; a fresh site reaches a presentable first release from a
  package in under ten minutes of dashboard time.
- Status: built and verified in the repository on 2026-09-26 (`docs/ACCEPTANCE.md` SB-04 and
  SB-05 PASS, SB-06 re-measured; decision D-021; migration
  `20260926000500_onboarding_package.sql`, already applied to the production project); on
  `main` since pull request #11, merged by the owner on 2026-09-26 (the live checks on
  production are still to be run).

### B3 · Design richness inside the boundary

- Hero treatments (oversized type, offset image, image collage), brand-tinted photo bands,
  alternating image sides, gallery lightbox without a script budget increase, testimonials
  with photos, team section, logo strip, click-to-load map (D-013 extended), richer rich text.
- A third, visibly different composition per preset.
- Exit: DES-13 and DES-14 hold; screenshots per composition; the owner's judgement on two
  sample sites built with real photography.
- Status: built and verified in the repository on 2026-09-26 (decision D-022): the section
  vocabulary (people, logo strip, image-and-text rows, photo band, portraits on quotations,
  hero collage, offset and statement, gallery lightbox, click-to-load map, rich text divider,
  callout and button), rendered by all six compositions, and the almanac (guide) and practice
  (location business) compositions; both pilots re-composed with the new sections; DES-13 and
  DES-14 re-measured (`docs/evidence/LIGHTHOUSE.md`), screenshots per composition in
  `docs/evidence/screenshots/` and its `magazine`, `storefront`, `almanac` and `practice`
  folders; SB-07 PASS. Open: the owner's judgement on two sample sites built with real
  photography (B4 supplies the photography); on `main` since pull request #11 with B2,
  merged by the owner on 2026-09-26.

### B4 · The proof

- Build one realistic client site end to end through the dashboard with licensed
  photography, timing every step; fix what is slow or plain; record the result as the
  acceptance evidence for the bar; production on the owner's go.
- Status: built and verified in the repository on 2026-09-26 (decision D-023). Two client
  sites with public-domain photography (Library of Congress, Carol M. Highsmith Archive), a
  community guide and a location business, written as the onboarding package a client fills
  in (`src/server/demo/proof/`, `pnpm proof:package`); each built end to end through the
  dashboard by `tests/e2e/proof.spec.ts` as a person does and counted per task (the guide: 12
  screens, 83 fields, 43 actions from an empty site to a published one with a composed home
  page, a composed About page and an added event; the location business: 8, 52, 26), captured
  under every composition of its preset (`docs/evidence/proof/`). Found by the build and
  fixed: the proxy's 10 MB body buffer truncated a package larger than that; the settings
  sheet's opening picture did nothing for a home that opens with words alone; colours that
  fail the contrast pairings passed the dry run; the quick-add form said "Add a event". SB-08
  PASS; SB-09 (the bar itself) is the owner's: their own timed build on production with the
  packages and their judgement of the captures and the sites. On `main` since pull request
  #12, merged by the owner on 2026-09-26 (no migration; the live checks on production are
  still to be run).

### B5 · Documents, links and the workbook

- The owner's review of B4 asked for three things a client site needs and the platform did
  not have: documents (an article's PDF) beside the pictures, a page that is a link to
  another website, and the onboarding package as an Excel workbook instead of CSV files.
- Status: built and verified in the repository on 2026-09-27 (decision D-024). Documents in
  Media: PDFs uploaded like pictures (signature and trailer checked, 25 MB, no other type),
  referred to from text, buttons and section links as `document:<id>`, listed as downloads
  under any item or in a page's Downloads section, carried by the release and served from
  content-hash names inline with `nosniff`; withdrawing one blocks the release that needs it,
  as with a picture; the site package and the onboarding package carry them. Links as content:
  a kind of both presets with an https address, a category, a picture, a summary and a button
  label, shown as cards that open the other site (no referrer) from a collection on any page
  and from the `/links` index, which appears with its navigation entry once a link is
  published; a page of its own for search and sharing. The workbook: the template downloads
  as `content.xlsx` (a sheet per kind, Site, Images, Documents, a Read me), uploaded on its
  own or inside the package beside the images and documents folders; sheets matched by name;
  Excel's dates, numbers, booleans and formula results read as text; CSV files still accepted;
  the proof packages carry the workbook. SB-10, SB-11 and SB-12 PASS; migrations
  `20260927000100_media_documents.sql` and `20260927000200_content_kind_link.sql`; snapshot
  schema version 6 with the ten earlier frozen releases rendering unchanged. On `main` since
  pull request #14, merged by the owner on 2026-09-27 (deployed 02:00 UTC); the two
  migrations followed at 02:02 UTC through the Management API, so the dashboard ran about
  two minutes without them (public pages read snapshots and were unaffected). Public live
  checks in `docs/evidence/production/b5-2026-09-27-live-checks.txt`.

### B6 · Removing a site or an organization

- The owner asked for a way to delete test sites and organizations after the proof.
- Status: built and verified in the repository on 2026-09-27 (decision D-025). Settings →
  Remove this site (owners; the site key typed; refused while live on a domain; the rows in
  one transaction with the audit event, the files after, the trail kept and the removed sites
  listed on the organizations page); Organizations → Remove organization… (owners; the name
  typed; the sites first, then memberships and invitations; the row kept as a tombstone with
  its trail; the last organization owned refused). OPS-04 and OPS-05 PASS in
  `docs/ACCEPTANCE.md`; migration `20260927000300_removal.sql`.

### The owner's verdict on the bar, and B7

- On 2026-09-27, after B5, the owner judged the platform against the bar of D-020 in their
  own words: "this is not something I would use, way too complicated, not enough easy
  customization like being able to upload zip". SB-09 is recorded as not met.
- The finding: the platform's strength is the machinery under a site (hosting on the client's
  domain, immutable releases with restore, the inquiry inbox and delivery, per-client access,
  the audit trail); its weakness is the layer that decides how a site looks (typed sections,
  compositions in code, enumerated design settings), which cannot match a hand-built design
  and exposes editing machinery a one-person agency does not need day to day.
- The direction decided with the owner: **B7 · Uploaded sites**. A site built anywhere
  (hand-coded, a design tool, a generator) is zipped and uploaded; the upload becomes an
  immutable release served on the client's domain with clean URLs, correct types and caching,
  restorable like every release, with a contact form snippet that posts to the site's own
  address and lands in the existing inbox, previews on a hostname of their own (never the
  dashboard's origin), and a dashboard of four things: Upload, Releases, Domains, Inbox. The
  structured sites stay for directories and multi-location businesses and get no new
  features. The bar is re-judged on the first real client site hosted this way; the step after
  it, once that site is live, is letting a hand-built page pull in the platform's live pieces
  (hours, events, a form) through markers the publish step expands into plain HTML.

## 4 Acceptance rows

| ID | Scenario | Expected |
|---|---|---|
| SB-01 | Owner edits a page and publishes | Save, then one action publishes; the public site shows the change; no separate approval step; audit trail names the actor and release |
| SB-02 | A site with review required | The owner's own save is not approved; the candidate excludes it until an explicit approval; editors' work always needs a publisher |
| SB-03 | Owner finds every daily task from the sidebar | Change the look, add a place, publish, read the inbox and manage the team are each reachable in one click from any page of the site |
| SB-04 | Create a site and reach a first release from a package | Under ten minutes of dashboard time; no empty section on the published home page |
| SB-05 | Bulk media upload with alt text | Twenty images in one upload; each with alt text before use |
| SB-06 | Walk-through measured after each phase | Create site, brand it, add five places, publish, through the dashboard as a person would: screens, fields and actions per task and the scripted run's time recorded per phase by `tests/e2e/walkthrough.spec.ts` (`docs/evidence/walkthrough/`), with the empty-state notices left on the published home; a person's own timing of a complete build is B4's evidence |
| SB-07 | Publish a page carrying every B3 section, then view it under each composition of the preset | The release carries every picture the sections refer to; every composition renders the page from the frozen release with no script for the lightbox or the band and no frame before the visitor asks for the map; the editor offers the sections and treatments and says what each slot still needs |
| SB-08 | Build a realistic client site end to end through the dashboard from the package a client fills in, with real photography | Counted per task and timed; published at the first attempt with no blocker; every section with content; captured under every composition of the preset |
| SB-09 | The bar (D-020) | The owner's own timed build on production with the packages, and their judgement: they would choose the platform over building by hand, and the result is launch-ready rather than templated |
| SB-10 | Documents beside pictures | A PDF uploads like a picture, is linked from text and a button, listed as a download under an article and in a page section, served from the published release with the right type and name, and refused when it is not a PDF, too large, truncated or withdrawn |
| SB-11 | A page that is a link to another website | A link is added from the list with its address, published, and shown as a card that opens the other site from a collection and from the index, with a page of its own found by search; the index and its navigation entry appear only once a link is published |
| SB-12 | The onboarding package as a workbook | The template downloads as one Excel file; a filled workbook uploaded on its own or inside the package goes through the same dry run and import as the CSV sheets, with Excel's dates and numbers read as the sheets expect, and a sheet given both ways refused |

## 5 Open points for the owner

- Whether the review-required policy should default to on for organizations with editors.
- Photography for the proof site: the owner supplies licensed images, or public-domain
  photographs are used with attribution recorded.
