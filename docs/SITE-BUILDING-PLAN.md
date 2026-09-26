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
  `20260926000500_onboarding_package.sql`, already applied to the production project);
  production on the owner's go (pull request, live checks).

### B3 · Design richness inside the boundary

- Hero treatments (oversized type, offset image, image collage), brand-tinted photo bands,
  alternating image sides, gallery lightbox without a script budget increase, testimonials
  with photos, team section, logo strip, click-to-load map (D-013 extended), richer rich text.
- A third, visibly different composition per preset.
- Exit: DES-13 and DES-14 hold; screenshots per composition; the owner's judgement on two
  sample sites built with real photography.

### B4 · The proof

- Build one realistic client site end to end through the dashboard with licensed
  photography, timing every step; fix what is slow or plain; record the result as the
  acceptance evidence for the bar; production on the owner's go.

## 4 Acceptance rows

| ID | Scenario | Expected |
|---|---|---|
| SB-01 | Owner edits a page and publishes | Save, then one action publishes; the public site shows the change; no separate approval step; audit trail names the actor and release |
| SB-02 | A site with review required | The owner's own save is not approved; the candidate excludes it until an explicit approval; editors' work always needs a publisher |
| SB-03 | Owner finds every daily task from the sidebar | Change the look, add a place, publish, read the inbox and manage the team are each reachable in one click from any page of the site |
| SB-04 | Create a site and reach a first release from a package | Under ten minutes of dashboard time; no empty section on the published home page |
| SB-05 | Bulk media upload with alt text | Twenty images in one upload; each with alt text before use |
| SB-06 | Walk-through measured after each phase | Create site, brand it, add five places, publish, through the dashboard as a person would: screens, fields and actions per task and the scripted run's time recorded per phase by `tests/e2e/walkthrough.spec.ts` (`docs/evidence/walkthrough/`), with the empty-state notices left on the published home; a person's own timing of a complete build is B4's evidence |

## 5 Open points for the owner

- Whether the review-required policy should default to on for organizations with editors.
- Photography for the proof site: the owner supplies licensed images, or public-domain
  photographs are used with attribution recorded.
