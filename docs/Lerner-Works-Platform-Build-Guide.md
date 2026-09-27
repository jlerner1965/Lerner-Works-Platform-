# Lerner Works Website Platform Build Guide

**Implementation specification and Claude Code execution packet**  
Prepared for James Lerner • September 25, 2026 • Version 1.0

**How to use this packet:** Read sections 1–6 for the product and design. Sections 7–17 are the implementation contract. Sections 18–24 define build order and proof of completion. Put this file in a new project folder, then paste section 25 into Claude Code. Use section 26 to resume or correct incomplete work. Claude should read the whole file before coding.

| Find it quickly | Section |
|---|---|
| Product scope and user workflows | 1–6 |
| Architecture and database | 7–8 |
| Publishing and rollback | 9 |
| Media, search, inquiries, and security | 10–13 |
| Routing, portability, and pilot content | 14–17 |
| Milestones, credit checkpoints, and setup | 18–19 |
| Acceptance checks and quality targets | 20–21 |
| Deployment boundaries and working rules | 22–23 |
| Demonstration and copy-paste prompts | 24–26 |
| Final handoff and primary sources | 27–28 |

## 1 Purpose and intended result

Build an agency-operated platform that lets Lerner Works create, edit, review, and publish multiple customers’ websites from one application. The first release must include a usable administration dashboard and two complete, distinctly designed pilot websites. Content must persist in a real database. Publishing, lead capture, permissions, and rollback must work end to end.

The first pilot is a fictional Colorado community guide. The second is a fictional multi-location athletic retailer. They demonstrate the workflows relevant to Inside the Towns and potential Lerner Works customers without requiring changes to current live properties. Neither pilot is evidence of an actual customer relationship.

The valuable result is a repeatable delivery system: configure a site, enter its information, review a preview, publish an approved release, receive inquiries, and maintain the site through the dashboard. A large collection of disconnected screens does not meet this specification.

**Deliverable status:** This is a detailed implementation contract, not completed software or a claim of production readiness. The build earns that status only through the acceptance evidence in this guide. No guide can guarantee perfection or that $250 in usage credit completes the full scope. The target is a polished, demonstrably working release with honest boundaries.

### Relationship to the earlier brief

This guide develops the September 24 Reusable Customer Site Platform Project Brief into an implementation plan. It resolves the previously open choices: a database-backed editor is required; the selected implementation is Next.js with Supabase; the initial release uses manual publishing; and the two pilots use fictional data. Existing Astro implementation details in the earlier brief are historical context, not a current repository audit. Reuse requires an actual inspection later.

Earlier agency price estimates and calendar estimates are not adopted here. The constraint in this conversation is $250 of Claude Code usage credit. Model usage, hosting, email, databases, domain services, and maintenance are separate categories.

## 2 What makes the result impressive

The product should demonstrate five things in a ten-minute walkthrough:

1. **One update, real results.** Change a retailer’s holiday hours, preview the changed store page, publish, and show the change in a separate public browser session.
2. **Two convincing designs.** The guide feels editorial and local. The retailer feels like a practical sporting-goods business. Differences include composition, type hierarchy, navigation, and page structure, not just color.
3. **Safe editing.** A client editor can submit changes but cannot publish, access another organization, or alter platform settings.
4. **Recoverable publishing.** A previous site release can be restored without deleting newer drafts or losing incoming inquiries.
5. **A reusable delivery process.** Create a third blank site from a preset, import sample records, customize the identity, and preview it without changing application source code.

The walkthrough must use actual persisted records and permissions. Seeded example content is allowed when explicitly identified. Simulated successful saves, fake traffic, fabricated lead counts, and pretend deployment status are prohibited.

## 3 Scope and release boundaries

### Required working release

- Agency dashboard with organization and site switchers.
- Authentication and explicit organization/site permissions.
- Site setup, branding, navigation, footer, and module configuration.
- Editors for pages, places, events, articles, stores, and services as appropriate to the preset.
- Media upload, selection, attribution, and alternative text.
- Draft save, review submission, revision history, preview, publication, and release rollback.
- Two fully populated fictional pilots with working navigation and inquiry forms.
- Search and filters over each site’s published content.
- Inquiry inbox with status changes and CSV export.
- Publication checks with specific findings and links to the affected records.
- Site export/import with dry-run validation and downloadable media.
- Audit trail for sensitive actions and a documented recovery procedure.
- Repeatable local setup, useful tests, screenshots, and a verified demonstration script.

### Deployment stage after the working release

Managed database, authentication email delivery, hosted application, provider domain verification, production credentials, and a real delivery provider for inquiry notifications. Complete the code and setup instructions first. A missing account or credential must be reported precisely and must not be replaced with a fake successful integration.

### Later modules

Customer subscription billing, shopping carts, POS inventory, team registration, ticket sales, automated advertising sales, AI writing, analytics integrations, scheduled publication, website crawling, and large-scale migration are outside the first release. A future sponsor feature may manage manually sold placements; it is not a payments or ad network product.

Do not create empty menu entries for later modules. Do not describe the product as supporting arbitrary industries. Version 1 supports community guides and location-based retail/service websites within the specified content contracts.

## 4 Product roles and access

Use organizations as the data boundary. A site belongs to exactly one organization. All customer content, media, releases, inquiries, exports, and audit events belong to that boundary. Avoid an implicit global administrator bypass in ordinary request code.

| Role | Access | Publish | Manage access | View inquiries |
|---|---|---|---|---|
| Organization owner | All sites within their organization | Yes | Yes within organization | Yes |
| Site publisher | Assigned sites | Yes | No | Yes |
| Site editor | Assigned sites and their drafts | No | No | No |
| Site reviewer | Assigned sites, previews, and review comments | No | No | No |
| Public visitor | Published public site only | No | No | Submit only |

The Lerner Works agency operator has explicit owner membership in each pilot organization. The cross-organization dashboard aggregates only organizations in which that user is an owner. No user can promote themselves, create arbitrary memberships, or change a membership through a generic record-update endpoint.

Owners can create organizations through a controlled onboarding service. Production onboarding is invite-only. An authenticated stranger cannot create an agency-wide account. Protect the last owner from removal. Site reviewers may comment but cannot change content. Treat publication and permissions as separate abilities.

Local development includes individual seeded accounts for an agency owner, editor A, reviewer A, publisher B, and an unrelated authenticated user. Generate local credentials during setup and keep them in an ignored local file. Never deploy those accounts or credentials to production.

## 5 Daily workflows

### Create a site

1. Owner selects Create site and chooses an existing organization or creates one.
2. Select Community guide or Location business preset.
3. Enter site name, internal key, time zone, and default contact information.
4. Configure logo or text wordmark, colors, typography preset, navigation, and footer.
5. Choose enabled modules. Presets provide sensible defaults.
6. Land on a setup checklist listing actual missing data, with links to fix each item.
7. Enter or import content and create the first candidate release.
8. Review the candidate and publish to the local demonstration route. Live domain activation is a separate operation.

Creating a site creates records, not a new repository or copy of the application. A clean site contains empty states, not fictional customer content. An explicit Load demo content action is available only for a site marked as demonstration.

### Update a store

Publisher selects a store, edits holiday hours, saves a draft, and sees the saved version and timestamp. The public page stays unchanged. The publisher creates a release candidate, reviews the field-level difference, previews the store page, and activates the candidate. A new public request shows the new hours. The audit trail records the actor and release.

### Review a client edit

Editor saves and submits a revision. Reviewer comments or requests changes. Publisher may include only the reviewed revision in the candidate. If the editor changes the record after review, the new revision is unreviewed. The already approved revision remains available; approval never silently transfers to different bytes.

### Handle an inquiry

Visitor submits the form on a store or guide contact page. The server derives site and organization from trusted routing, validates the form, stores the inquiry, and returns a receipt reference. The inbox shows it as New. Owner or publisher marks it In progress, Resolved, or Spam. Email delivery has its own status; stored and emailed are different facts.

### Recover an unwanted update

Publisher selects a historical release, sees differences against the current release, chooses a reason, and restores it. Restoration creates a new release referencing the historical snapshot. Drafts and inquiries remain unchanged. If a historical release contains a withdrawn asset or incompatible schema, block restoration with an actionable explanation.

### Remove a site or an organization

An organization owner removes a site from its Settings by typing the site key (refused while the site is live on a domain), and an organization from the organizations page by typing its name; the organization's sites go first. Rows go in one transaction with the audit event, files follow, the audit trail stays, and an organization is kept as a tombstone row nobody is a member of. There is no undo: export the site package first (site-building B6, decision D-025).

## 6 Interface and design direction

### Administration dashboard

Use a restrained, professional interface with white and cool gray surfaces, dark ink text, a navy navigation rail, and one blue action color. Avoid gradients, decorative metric cards, excessive rounded corners, and large unused areas. Use a 4-pixel radius by default, 8-pixel spacing increments, 14–16-pixel body text, and clear keyboard focus. These are starting tokens, not a substitute for contrast and visual testing.

Desktop layout: approximately 232-pixel sidebar, compact top bar, and an adaptive content region. Sidebar sections: Overview, Content, Media, Reviews, Inquiries, Publishing, and Settings. Hide sections the user cannot access. Site switcher remains visible. Every editing page includes a breadcrumb and the current site name to reduce wrong-site edits.

Overview shows actionable facts: unpublished changes, waiting reviews, unread inquiries, latest release, and detected configuration problems. Empty counts display zero. Do not invent traffic, revenue, growth arrows, or an overall website score.

Content lists support type and status filters, text search, pagination, sorting, and bulk archive with a clear selection count. Editors show fields on the left and an optional preview on the right at wide widths. A pinned action area contains Save draft, Request review, and Preview as permitted. Explicit save is required in version 1; unsaved navigation triggers a warning. Include Save failed and Retry states.

### Community guide pilot

Fictional brand: **Pine Hollow Guide**, with a visible demonstration label. Use an editorial composition, forest green, off-white, charcoal, and restrained rust accents. Use a licensed serif for headings and sans-serif for body copy. The opening section should introduce the place with one strong image and useful category links; avoid generic software marketing copy.

Home sequence: locality introduction, browse categories, upcoming events, selected places, one editorial feature, and a concise community/contact footer. Place detail pages emphasize useful information, source/verification date, and a relevant next action. Events display date, location, cancellation status, and organizer information. Do not make fictional listings appear to be actual Colorado businesses.

### Location business pilot

Fictional brand: **Range Athletics**, with a visible demonstration label. Use ink/navy, white, and a high-contrast orange accent. Use a sans-serif heading system, strong horizontal rules, squared buttons, and direct store-focused calls to action. Home composition must differ from the guide: brand introduction, Find a store, services, featured store, and contact.

Store detail pages prioritize address, ordinary hours, date exceptions, available services, and inquiry form. No inventory, product prices, reviews, or claims of availability. The location finder uses list and filters; a map is not required. Demo direction links remain disabled with a clear explanation because the addresses are fictional. In real-content mode, directions links must be constructed from owner-approved addresses.

### Page and component requirements

- Design at 390-pixel mobile and 1440-pixel desktop widths first, then inspect 768 pixels and 200% zoom.
- Public pages must have purposeful headings, readable text widths, strong images, and useful content above the fold.
- Controls need loading, empty, success, validation, and failure states wherever those states can occur.
- Mobile navigation, dialogs, and menus require keyboard behavior and focus management.
- Every image has dimensions, responsive sizes, intentional crop, and descriptive alternative text or an explicitly decorative designation.
- Use a small set of real, licensed or original assets. Record sources and rights. No hotlinked images, repeated filler imagery, watermarks, or emoji logos.
- Save screenshots of the dashboard, editor, preview, release screen, and both pilots at mobile and desktop sizes. Fix visible defects rather than merely attaching screenshots.

## 7 Selected architecture

### Technology decisions

| Area | Required choice | Reason |
|---|---|---|
| Application | Next.js App Router with TypeScript | One maintained application for the dashboard and server-rendered public sites |
| Data | Supabase PostgreSQL | Persistent relational data, migrations, and row-level access policies |
| Identity | Supabase Auth | Avoid custom password and session implementations |
| Assets | Supabase Storage | Stored files with controlled access and metadata |
| UI | Tailwind CSS and a small accessible component set | Fast consistent interfaces with custom public designs |
| Validation | Zod plus database constraints | Validate both external inputs and stored relationships |
| Testing | Vitest, database integration tests, Playwright | Cover domain logic, isolation, and complete workflows |
| Package management | pnpm with a committed lockfile | Reproducible installs |
| Hosted target | Vercel application plus hosted Supabase | Selected deployment target; verify actual account eligibility and costs |
| Local development | Supabase CLI with a compatible container runtime | Run database, authentication, and storage locally |

Resolve current compatible stable versions at kickoff, record them, and pin the lockfile. Do not paste outdated installation commands from memory. The guide selects the stack; it does not claim specific plan prices or free commercial hosting eligibility.

Official Next.js guidance supports server-side authorization near data access. Supabase documents database row-level policies, and Vercel documents multi-tenant domain configuration. Those capabilities support this architecture; they do not automatically make this application secure. See the primary sources at the end.

### Application structure

Use one repository and one application initially. Avoid microservices and a monorepo framework until a demonstrated boundary requires them. Organize code approximately as follows:

```text
src/app/                 dashboard routes, public routes, HTTP handlers
src/components/admin/   dashboard components
src/components/public/  shared public elements
src/themes/guide/       guide layouts and page renderers
src/themes/locations/   retailer layouts and page renderers
src/modules/            content schemas and module definitions
src/server/auth/        sessions and authorization helpers
src/server/data/        scoped repositories and DTOs
src/server/publishing/  candidates, validation, activation, rollback
src/server/inquiries/   intake, inbox, delivery queue
src/server/media/       upload, publication copies, downloads
src/lib/                pure shared helpers
supabase/migrations/    schema, grants, policies, functions
scripts/                setup checks, seed, import, export
tests/                  unit, integration, browser, fixture data
docs/                   decisions, progress, operations, evidence
```

Render public content from immutable release snapshots. Editing writes working revisions. The public renderer must never read the mutable draft tables. This is the central consistency rule.

Keep authorization in server-only services and database policies. Route guards improve navigation but do not secure a mutation by themselves. Each server action and HTTP handler validates the session, membership, site scope, input schema, and requested capability before changing data. Client-supplied organization IDs are never sufficient authority.

### Local and hosted routing

Local demonstration uses `/demo/pine-hollow` and `/demo/range-athletics`, each resolving a site through a controlled registry. These paths render only active published demo releases. Authenticated candidate previews use `/app/sites/{id}/previews/{candidateId}/...` and render the exact candidate. Recheck access for every preview request and asset request.

Hosted customer sites resolve exact normalized hostnames from verified domain records. The administration dashboard is served only on its configured application host. Unknown hosts return a neutral 404. Never fall back to the first organization. Do not trust arbitrary forwarded-host headers; document which headers the selected hosting platform supplies and validate against the registry.

All local demo and authenticated preview responses use noindex and no-store behavior. Production domain routes and paths must never make draft URLs publicly accessible. A verified domain maps to exactly one site. Select one canonical domain per live site; verified aliases redirect to it.

### Caching and release consistency

Begin with uncached public HTML and an indexed lookup of `active_release_id` on each request. Cache immutable snapshot content by site ID plus release ID only after tests establish correctness. Read the active release once per request and pass that snapshot through navigation, page content, metadata, search, and footer rendering. Do not mix release reads during one response.

Authenticated dashboard and preview responses must be private and not stored in shared caches. Test alternating requests for two tenants, identical slugs, and two different authenticated users. Never share cache keys based only on a slug or pathname.

## 8 Data model and invariants

All timestamps use UTC with explicit time zones for user-facing events and opening hours. Use UUID identifiers. Organization IDs are present on every tenant-owned record, with site IDs where applicable. Use composite unique keys and composite foreign keys to ensure a site and its child records cannot disagree about their organization. Soft deletion is available for working content; immutable revisions and releases remain intact according to the retention policy.

| Entity | Important fields and invariants |
|---|---|
| organizations | id, name, status; hard deletion requires a separate documented administrative process |
| memberships | organization_id, user_id, organization_role; unique organization/user |
| site_memberships | organization_id, site_id, user_id, site_role; user must belong to organization |
| sites | organization_id, key, name, preset, time_zone, mode, active_release_id; modes demo/live |
| site_config_revisions | organization_id, site_id, version, schema_version, branding, navigation, modules, footer; immutable |
| domains | site_id, organization_id, normalized_host, status, is_canonical, verified_at; globally unique hostname |
| content_items | organization_id, site_id, kind, current_revision_id, archived_at; stable ID independent of slug |
| content_revisions | item_id, organization_id, site_id, version, schema_version, slug, payload, author, created_at; immutable |
| reviews | exact revision ID, reviewer, state, comment, timestamp; approval tied to revision |
| media_assets | organization_id, site_id, private_object_key, type, size, hash, dimensions, rights, alt_text, status |
| release_candidates | site_id, base_active_release_id, frozen_manifest, manifest_hash, validation_result, state |
| releases | site_id, organization_id, snapshot, hash, schema_version, actor, reason, source_candidate_id |
| inquiries | organization_id, site_id, trusted location_id, public receipt, fields, status, received_at |
| delivery_jobs | inquiry_id, channel, attempt_count, next_attempt_at, lease, provider_reference, state |
| audit_events | organization_id, site_id, actor, action, entity_id, safe_metadata, created_at; append only |
| import_jobs | organization_id, site_id, file hash, dry_run_result, mapping, state, created_by |

Add indexes for membership checks, site content lists, revision history, inquiries by site/status/time, release lookup, and scheduled delivery retries. Do not store large media binaries in database rows.

### Shared content fields

Title, slug, summary, body as restricted structured content, media references, internal links by stable ID, metadata title/description, indexability preference, source URL where applicable, last verified date, and optional attribution. Validate links and body nodes. Raw HTML, arbitrary script tags, and executable MDX are not supported content inputs.

Use typed JSON payloads for the different content schemas, backed by shared relational ownership and revision records. Do not build an arbitrary custom-field designer in version 1. Validate payloads on write and again before publication; persist a schema version for future migrations.

### Content types

**Page:** approved ordered sections. Initial section registry: text hero, image hero, rich text, feature list, content collection, location collection, contact callout, and inquiry form. Limit collection selection to same-site content. Reordering uses accessible Move up/Move down controls; drag-and-drop is optional.

**Place:** category, description, approved address or area description, website, phone, source, and verification date. Opening hours are optional and explicitly unknown if absent. Do not infer hours from category.

**Event:** start/end instants, IANA display time zone, venue reference or text, organizer, status, URL, and admission information if supplied. Validate end after start. Version 1 supports individual events, not recurring-event rule engines. Cancellation remains visible on the detail page.

**Article:** headline, summary, structured body, author display name, original publication date, updated date, and referenced assets. Require an actual author field or an organizational attribution; do not invent professional credentials.

**Link (site-building programme B5):** a link to another website as content: the site's own title, summary, picture and body about the outside resource, its https address, a category, and an optional button label. Public listings show links as cards that open the other site directly without a referrer; each link also has a small page of its own for search results and sharing. Nothing is fetched from the other site. The links listing route exists only while at least one link is published.

**Store:** name, approved address, phone, time zone, normal weekly intervals, date-specific exceptions, service references, and status such as open, temporarily closed, or permanently closed. Multiple intervals per day are allowed. Represent overnight hours explicitly with a next-day end flag. Date exceptions override weekly intervals for the local date. Unknown is different from closed.

**Service:** name, description, optional inquiry prompt, and store associations. No invented prices. Store relationships reference stable IDs and resolve through the frozen release, not mutable working data.

### Review and state transitions

Saving creates an immutable revision and advances the working pointer with optimistic concurrency. A stale save returns a conflict and preserves the unsaved input for comparison. Do not overwrite a newer revision silently.

Review states: unsubmitted, submitted, changes requested, approved. Editors submit. Reviewers may request changes and comment; final approval is by a publisher or owner. Owners/publishers can approve their own work with an audit event. Archiving is a draft change until a release removes the item from public routes.

Published is not an exclusive working-item state. A content item may have a published revision and a newer draft simultaneously. Display those facts separately.

## 9 Publishing specification

### Build a candidate

Publisher chooses changes for the next release. Default selection includes explicitly approved changes; new unapproved revisions cannot replace previously approved ones silently. Begin from the active release, apply selected additions, revisions, and removals, and include a selected immutable site configuration revision. Resolve all referenced records and media into one frozen manifest.

The manifest contains the schema version, site identity, selected configuration, routes, content revisions, redirects, media references, and public metadata. It contains no inquiries, membership records, tokens, private notes, or provider credentials. Compute a deterministic hash after canonical serialization. The candidate never reads mutable content again for rendering.

Show a change summary: added pages, changed fields, removed routes, new redirects, navigation changes, and media additions. Human-readable differences are required; raw JSON alone is insufficient. The candidate preview shows its creation time and candidate ID.

### Validate the candidate

Publication blockers include invalid relationships, cross-site references, duplicate routes, redirect loops, missing required content, missing navigation targets, unapproved revisions, unsafe links, missing required image alternatives, unlicensed assets, and schema errors. Brand color combinations failing the configured text/control contrast requirements must be fixed before activation.

Warnings include missing optional metadata, old verification dates, unusually large images, short descriptions, and empty optional collections. Each finding includes its severity, reason, affected field, and a link to fix it. Avoid a single numerical quality score. A waived warning requires a reason stored with the release; blockers cannot be waived.

Validate the entire resulting site, not only the edited record. Removing a referenced location or disabling a module must surface dependent pages. Do not delete dependent content automatically.

### Activate atomically

1. Verify current permission and candidate state server-side.
2. Revalidate the candidate’s schema and relationship integrity.
3. Ensure all publication assets have been prepared successfully.
4. Inside a database transaction, check that the site’s active release still equals the candidate’s base release. Lock or use compare-and-swap.
5. Insert the immutable release, advance the active pointer, consume the candidate, and append the audit event atomically.
6. Return the actual release ID and a link to the published site.

Use an idempotency key so a retried activation cannot create multiple releases. If another release was activated meanwhile, return Conflict and require the publisher to rebuild/review a new candidate. A changed active pointer must never be overwritten silently.

The first release has a null base. A failed activation leaves the old release active. A failed asset operation leaves the candidate unactivated and offers retry. Do not hold a database transaction open while making external network calls.

### Restore a release

Restore creates a new immutable release with the historical content snapshot and a `restored_from_release_id`. Check schema compatibility, current media availability, and present permission. Use compare-and-swap against the current active release. No changes to drafts, inquiries, memberships, or domain ownership occur.

Content rollback and application deployment rollback are different operations. Document both. Keep readers backward compatible with stored snapshot versions, or migrate them through an explicitly tested process before removing support.

## 10 Media and public assets

Upload into private storage first. Accept JPEG, PNG, WebP, and optionally AVIF only when the installed processing library supports validation. Reject HTML, SVG, archives, executables, and mismatched MIME/signature content. Set a default 10 MB file limit and a decoded pixel limit. Strip unnecessary metadata and create web derivatives. Never use a filename supplied by a user as an unchecked object path.

The server assigns organization/site-scoped object keys. Database and storage policies enforce the same permissions. A signed preview asset URL has a short expiration and is issued only after authorization. Original uploads remain private.

For publication, copy approved web derivatives to immutable content-hash paths in a dedicated public asset area. Confirm required copies exist before release activation. Publication makes those derivatives publicly retrievable; do not use confidential images. The application must disclose this in the upload/publish workflow.

Do not delete assets referenced by any retained release. An unused-media view may mark candidates for cleanup, but hard deletion is outside ordinary editor controls. Withdrawal for rights/privacy reasons requires disabling affected releases from restoration and replacing or removing the public derivative. Export assets as actual downloadable files, not expired signed links.

Logo upload supports validated raster images and a text-wordmark fallback. Avoid building an SVG sanitization subsystem merely to support the initial demonstration.

Documents (site-building B5, decision D-024): the media library also accepts PDF files, as assets of kind `document` beside the pictures. Validate by signature and trailer, agree the declared type and extension, cap at 25 MB, and accept no other document type. A document is referred to as `document:<id>` wherever a link target is typed (rich text, buttons, section links) and as an attachment (id and label) on any item; a page may list documents in a Downloads section. Publication copies each referenced document to an immutable content-hash path like a derivative, serves it inline with `nosniff` and a name from the title, and refuses a release that names a picture where a document is needed or the reverse, a download with no file, or a withdrawn document. The site package and the onboarding package carry documents with their rights.

## 11 Search and visitor tasks

Search indexes the active published snapshot only. For the expected pilot size, a small deterministic in-memory index built from the immutable snapshot is sufficient. No separate paid search provider is required. Limit searchable fields to public titles, descriptions, categories, and locations.

Guide filters: content kind, category, and event date range. Retail filters: store service and locality. Filter state appears in URL query parameters and survives refresh/back navigation. Use explicit reset controls and useful no-results messages. Search matches never reveal drafts, private notes, archived pages absent from the current release, or another site’s records.

Do not implement ZIP-radius sorting without a verified geocoding/distance solution. Version 1’s list and locality filters are complete features. A map can be a later enhancement.

Events display using their own IANA time zone. Test midnight boundaries and daylight-saving transitions. For deterministic tests and demonstrations, use a controllable test clock; do not change production time handling to make fixtures pass. Past events leave upcoming collections but may retain detail pages according to editorial preference.

Public inquiry forms provide visible labels, clear required/optional fields, inline validation, an error summary, a submitting state, and a success receipt. Preserve user input after a server error. Avoid collecting information that the business does not need.

## 12 Inquiry capture and notification delivery

### Storage comes first

Fields: name, email, optional phone, message, source page, optional store/service reference, displayed consent version when applicable, received time, and a safe receipt identifier. Use a same-site allowlist for return URLs. Validate email format without claiming delivery verification.

Derive site identity from trusted host/path resolution. If a location reference is supplied, verify it belongs to that site’s active release. Form submissions cannot choose a destination email address, organization, or provider credential. Resolve recipients from owner-configured server-side settings.

Apply length limits, request size limits, a honeypot, and a persistent rate limiter. Use a short-retention hash of the requester address where needed; do not expose raw address data in the dashboard. Exact rate thresholds are configuration values, initially 5 submissions per 10 minutes per site/requester with a broader site abuse limit. Tune after real use and document false-positive handling.

Accept valid inquiries even if email is temporarily unavailable. Insert the inquiry and its notification job in one transaction. A server error must not return a success receipt. Prevent rapid double-submissions with an idempotency token scoped to the site.

### Delivery queue

Local mode uses a local email sink or explicitly labeled Local notification log. That proves job processing, not internet email delivery. Production mode uses an owner-selected transactional email provider configured server-side. Provider selection and current pricing must be checked at deployment.

Jobs use pending, processing, delivered, and failed states. Claim work with a lease so two workers do not send the same job concurrently. Retry transient failures with bounded backoff, for example after 1, 5, and 30 minutes. Store a safe provider reference. Provide a publisher-only retry action and distinguish provider acceptance from confirmed delivery if no delivery webhook exists.

Use provider idempotency when available. Without it, document that a network timeout can cause duplicate notification emails even though inquiry storage is deduplicated. Do not promise exactly-once delivery across an external service.

In hosted mode, run processing through an authenticated scheduled endpoint or a supported job service. Verify hosting scheduler limits before selecting a cadence. Local development provides an explicit worker command. Missing worker setup appears as a real readiness blocker.

### Inquiry administration

Inbox has status filters, date range, store filter, detail view, and CSV export. Escape cells that could execute spreadsheet formulas. Keep inquiries out of general content export. An owner-only personal-data export is a separate action with a recorded purpose. Do not place submitted messages or email addresses in ordinary logs.

Default demonstration retention policy: retain inquiries for 90 days, then purge through a documented job. This is a product default requiring owner review before real collection, not a legal compliance claim. Retain safe counts or event references only when needed for operations.

## 13 Access controls and failure handling

Enable row-level security on every exposed tenant table and storage object policy. Explicitly specify grants; a table without an intended public use must not be readable by anonymous users. Test the database boundary with actual anonymous/authenticated clients, not exclusively through a privileged test connection.

Ordinary authenticated operations use the user’s authenticated database context. Elevated credentials are isolated in server-only modules for narrowly defined administrative work. Supabase documents that privileged service keys can bypass row-level controls, so they must never appear in browser bundles or be treated as if policies constrain every privileged operation.

Public rendering uses a narrowly scoped database function or view that returns only the active public release for an eligible site. Raw revisions, candidates, releases, and domain configuration are not anonymously listable. The public read function may return demo releases only through explicit demo routing; domain activation checks still apply for live sites. Keep the output schema minimal and test it.

Where a privileged database function is necessary, use a fixed search path, minimal grants, explicit scope checks, and tested inputs. Restrict function execution to intended roles. Avoid recursive membership policies by implementing and testing a minimal membership helper in a private schema.

Client changes to IDs, hidden form fields, API routes, and storage keys must not change authority. CSRF/origin defenses must match the selected framework/session mechanism. Store secrets only in server environment configuration. Redact them from errors, screenshots, logs, and exports.

Global errors should show a safe message and reference code while recording a redacted diagnostic server-side. Preserve existing public releases during downstream failures where possible; do not render another tenant or demo fixture as a fallback. No `catch` block may convert a failed write into an apparent success.

## 14 Page metadata and public routing

Each published route has a title, description, canonical URL when on a live canonical domain, and deliberate indexability. Sitemaps include only active, indexable canonical routes. Demo routes, dashboard routes, previews, and noncanonical hosting addresses must not be presented as customer canonical URLs.

Use noindex headers and metadata for demonstrations/previews. Access control protects drafts; noindex is not a security control. Do not assume a robots exclusion protects confidential content.

Slugs are unique across the resolved site route namespace. Store old-to-new redirects in the release manifest when published slugs change. Reject loops, collisions with current pages, and external redirect targets unless an owner explicitly configures an allowed external redirect feature later. Return true 404 responses for missing pages.

Structured data is optional per supported content type and must match visible facts. Do not manufacture ratings, prices, availability, or geographic facts. Fictional demos should not emit business structured data that could be mistaken for real entities.

This platform facilitates correct publishing; it does not guarantee rankings, traffic, leads, or sales.

## 15 Import export and ownership

### CSV import

Support initial imports for stores, places, and events. Provide downloadable templates with field descriptions. Import begins with upload and mapping, followed by a dry run that shows create/update/skip/error counts and specific row errors. No database mutation occurs during dry run.

Identify updates through an external ID scoped to the site and content kind. Do not match customers by title alone. On confirmation, record the input hash and job ID, write revisions within a transaction for the selected batch, and report actual results. A repeated identical job must not duplicate records. Imported items remain drafts requiring approval.

Start with a 500-row cap and a 5 MB input cap. Reject oversized or invalid inputs with instructions to split the file. This bounded implementation is preferable to pretending to support unlimited imports.

The onboarding package (site-building B2 and B5) is the client's path: the template downloads as one Excel workbook (`content.xlsx`: a sheet per content kind of the preset, a Site sheet of settings, an Images sheet, a Documents sheet and a Read me) to be returned on its own or zipped with the `images/` and `documents/` folders. The workbook is read by a small OOXML subset in code (no spreadsheet dependency), sheets matched by name, and converted to the same CSV files before the dry run, so the import has one shape; CSV files are still accepted, a sheet given both ways is refused, and Excel's dates, numbers, booleans and formula results are read as text the sheets expect.

### Portable site package

An owner can download a ZIP containing a versioned JSON manifest, content, site configuration, redirects, and actual reusable media derivatives with rights metadata. Exclude passwords, tokens, provider secrets, memberships, audit personal data, and inquiries. Include a README explaining the format and limitations.

Restore/import into a new blank site using an old-to-new ID map. Never let a manifest choose the destination organization or overwrite another customer. Validate checksums, schema versions, path traversal, file counts, total uncompressed size, and supported media types. Disable domains and delivery recipients on import. Imported content is draft until reviewed and published.

Acceptance requires export of pilot A, import into a fresh site C, and comparison of content counts, relationships, text, and asset hashes. A JSON download alone is not a complete export if the images cannot be recovered.

### Backups

Site export is portability, not complete disaster recovery. Document database backup and storage backup separately. Perform one local restore rehearsal using a new database instance and copied storage assets. Record what was restored and what remains provider-dependent before hosted launch.

## 16 Demonstration content contract

Create two organizations, one site each, and separate user permissions. Mark both sites as demonstration in the registry and public layout. All supplied names, messages, hours, and addresses are fixtures. Keep synthetic inquiries visibly labeled inside the inbox.

| Pilot | Required representative content |
|---|---|
| Pine Hollow Guide | 12 places across 4 categories; 6 events covering future, past, and cancelled states; 3 short complete articles; home, about, contact, directory, and events pages |
| Range Athletics | 3 stores with distinct service combinations; 4 services; weekly hours plus one holiday exception, one overnight interval, and one temporary closure; home, locations, services, about, and contact pages |
| Both | One draft item, one pending review, two historical releases after the publishing stage, valid image metadata, a seeded inquiry, and realistic empty/error states reachable in tests |

Write complete useful fixture copy rather than lorem ipsum. Keep articles short enough to review. Use reserved `.example` email/domain values. Do not send emails to real businesses or use fabricated reviews/testimonials. Do not invent factual claims about actual Niwot organizations.

Seeds must be repeatable and protected: local-only by default, explicit environment check, no production connection, no destructive reset as part of ordinary application startup. Store any demonstration clock offset in fixture generation, never global production logic.

## 17 Screens and routes to finish

| Screen | Required working behavior |
|---|---|
| Sign in | Validation, incorrect credentials, session expiry, sign out |
| Organization overview | Accessible organizations only; switch context without leaking prior data |
| Site overview | Real counts, setup tasks, latest release, open review links |
| Site creation | Preset, identity, time zone, initial configuration, persisted result |
| Content list | Search, filters, pagination, create, open, archive draft |
| Content editor | Typed fields, relationship picker, media picker, explicit save, conflict handling |
| Media library | Upload progress, validation errors, metadata editing, usage references |
| Review queue | Submitted revisions, field differences, comments, approval/request changes |
| Candidate preview | Frozen candidate, desktop/mobile viewport controls, working internal links |
| Publish review | Change summary, blockers/warnings, activate action, conflict handling |
| Release history | Actual releases, actor, time, difference view, restore action |
| Inquiry inbox | Persisted records, status updates, safe details, notification status, export |
| Site settings | Brand, navigation, modules, contact defaults, visible domain status |
| Access management | Owner-only invitations/assignments, revocation, last-owner protection |
| Import and export | Templates, dry run, confirmation, results, downloadable ZIP |
| Public pilots | Complete relevant index/detail pages, filters, forms, 404, responsive navigation |

Do not ship a visible button unless its handler works or it clearly explains a genuine configuration prerequisite. A disabled control with no explanation is a defect. Technical diagnostics belong in settings or operations views, not in ordinary visitor flows.

## 18 Implementation sequence

Complete one milestone at a time. Keep the application runnable after each milestone. Do not build all page shells first and defer persistence, authorization, and publishing to the end. The following budget allocations are suggested usage-credit checkpoints, not quoted costs or promises of completion.

| Milestone | Credit checkpoint | Concrete exit condition |
|---|---:|---|
| M0 Foundation decisions and setup | $15 | Working application, local services, migrations, scripts, environment documentation |
| M1 First complete publishing workflow | $55 | Authenticated edit to draft to candidate to public page, with isolation checks |
| M2 Full editor and two public designs | $55 | Required content types, two populated pilots, responsive pages, working media |
| M3 Operational workflows | $50 | Reviews, rollback, inquiries, queue, import/export, access management |
| M4 Verification and visual refinement | $60 | Acceptance matrix executed, defects fixed, screenshots and demonstration complete |
| Reserve | $15 | Unexpected fixes and handoff; do not pre-spend on extra modules |
| Total planning envelope | $250 | No completion guarantee; reconcile actual usage after every milestone |

If spending outruns the checkpoints, cut later enhancements first. Do not cut authorization, persistent storage, truthful error states, the first working publication workflow, or the verification reserve. If a required milestone cannot be completed within the remaining credit, finish and document the last coherent release and explicitly list unmet requirements. Do not label it full version 1.

### M0 Foundation and setup

**Tasks:** Inspect the new project folder and any applicable instructions. Confirm that it is not an existing live site repository. Create the source layout, install pinned dependencies, add a lockfile, configure local Supabase, write initial migrations and policies, create `.env.example`, and implement a setup diagnostic script. Establish the local authentication path and seed identities.

Create `docs/DECISIONS.md` describing the architecture, `docs/PROGRESS.md` with milestone state, `docs/ACCEPTANCE.md` with test IDs, and `docs/OPERATIONS.md` with setup and reset boundaries. A scaffold is not the milestone outcome: start the application, sign in locally, and read an authorized site record from the database.

**Evidence:** Fresh install command output, migration result, sign-in screenshot, and an unauthorized read that fails. Record any missing container runtime or dependency as a precise environment blocker. If local services cannot run, complete code and configuration but mark execution unverified; do not swap in localStorage as the application database.

### M1 First complete publishing workflow

**Tasks:** Implement site ownership, content items/revisions, a single editable page schema, configuration revisions, candidates, immutable releases, and atomic activation. Build a minimal but polished dashboard, page editor, release review, and two local published routes. Use distinct initial branding for the two organizations from the start.

Implement the actual public read boundary and database policies before broadening content types. Add optimistic save conflicts and publish conflicts. Test the same slug in both organizations. Add a public inquiry storage endpoint only after the correct site can be resolved securely.

**Evidence:** Edit pilot A, save, refresh, preview, publish, and fetch the public result. Show that pilot B is unchanged and unauthorized direct database/API access fails. Save a browser test for the complete sequence. This milestone is the core product, not a disposable prototype.

### M2 Complete editing and public experiences

**Tasks:** Add all prescribed content schemas, list/detail editors, relationships, media handling, navigation settings, both theme renderers, search/filter behavior, and the complete fixture content. Implement hours and event date logic with tests before displaying Open now or upcoming labels.

Create the guide and retailer as distinct visual systems. Finish mobile layouts as each page type is built. Implement useful empty states and error recovery. Add route/metadata generation from the frozen release. Complete site creation from presets without source edits.

**Evidence:** Screenshots of every representative public page and the editor. Walk through all navigation links. Test two different tenant datasets with identical slugs and titles. Search results must follow the active release. New drafts must not appear publicly.

### M3 Operational completion

**Tasks:** Add review queue and immutable review decisions; candidate differences; release restore; owner access management; invitation setup and local invitation flow; inquiry inbox; durable notification queue; CSV import; portable site package; audit events; and local backup/restore instructions.

Invitation flow must bind the intended email/account and organization, expire, and resist replay. Use the authentication provider’s supported flow where possible. Local mail sink verification is acceptable for the local release; real invitation delivery must pass separately before deployment. Do not create arbitrary passwords and send them in messages.

**Evidence:** Editor-to-publisher review flow, unauthorized publish denial, successful rollback, email failure with preserved inquiry, dry-run import with no mutations, and export/import into site C. Demonstrate revoking a user’s access takes effect on the next protected request even if that user still has a session.

### M4 Verification and refinement

**Tasks:** Execute the acceptance matrix; fix blockers; inspect browser console and network failures; review mobile and desktop screenshots; verify keyboard workflows; measure public performance; run a production build; conduct a clean-install rehearsal; and write an honest release report.

Do not spend this milestone adding more modules. Refine hierarchy, spacing, image crops, labels, content completeness, and transitions between tasks. Remove orphaned files and unused dependencies when safe. Review dependency/security scan results; document unresolved relevant findings rather than treating a tool’s green badge as proof of security.

**Evidence:** Dated test results, screenshot paths, production build log, tested setup procedure, known limitations, and a ten-minute demonstration. Hosted integrations are either verified with evidence or explicitly unconfigured.

## 19 Required repository commands

Implement and document these scripts with safe behavior. The names are part of the handoff contract; their internal commands depend on the versions selected at M0.

| Command | Required behavior |
|---|---|
| `pnpm setup:check` | Reports runtime, container, environment, and dependency readiness without printing secrets |
| `pnpm db:start` | Starts local Supabase services; never selects production |
| `pnpm db:migrate` | Applies pending local migrations without resetting data |
| `pnpm seed:demo` | Loads repeatable fictional fixtures into explicitly local/demo context |
| `pnpm dev` | Starts the application and prints useful local entry URLs |
| `pnpm worker:dev` | Processes local notification jobs using the local sink |
| `pnpm lint` | Runs linting appropriate to the installed stack |
| `pnpm typecheck` | Runs TypeScript checks without producing a release |
| `pnpm test` | Runs deterministic unit tests |
| `pnpm test:integration` | Runs database and policy tests against an isolated local test target |
| `pnpm test:e2e` | Runs browser acceptance workflows with controlled fixtures |
| `pnpm build` | Produces a production application build |
| `pnpm start` | Runs the built application for production-mode QA |
| `pnpm verify` | Runs the documented release gate and fails on unmet required checks |

Test commands must not reset the operator’s development database silently. Use an isolated test database/project or clearly protected ephemeral test context. A separate explicit reset command may exist, but it must require a local target check and warn of data loss.

### First-time operator setup

1. Create a new empty local folder named `lernerworks-platform`. Do not open the Inside the Towns or AragoCor project for this build.
2. Put this Markdown guide inside that folder, preferably under `docs/`.
3. Start Claude Code in the folder and paste the starting prompt in section 25.
4. Let Claude inspect prerequisites and scaffold M0. Install a compatible container runtime if the setup checker says it is missing.
5. Follow the generated README: install dependencies, start local services, apply migrations, seed demonstrations, start the application and local worker.
6. Use the generated local-only account information to open the dashboard. Test both public demonstration routes in a separate browser session.
7. At each milestone, review the specific evidence. Use the continuation prompt to proceed from recorded progress rather than restarting.
8. Only after the local release passes should you configure hosting and production services. Account creation, paid plan selection, secrets, and DNS actions require your involvement where access or approval is needed.

Do not paste production passwords or API secrets into the project guide. Configure them through environment files excluded from version control or the hosting provider’s secret interface.

## 20 Acceptance matrix

Record each result as PASS, FAIL, BLOCKED, or NOT RUN, with evidence and the tested revision identifier. Do not mark tests passed because corresponding code exists. A blocked check is not a passed check.

| ID | Scenario | Required observed result |
|---|---|---|
| AUTH-01 | Sign out and request dashboard data | No protected data returned; authentication required |
| AUTH-02 | Editor A requests B’s site through direct API and database clients | Access denied or no rows; no private fields disclosed |
| AUTH-03 | Editor calls publish endpoint manually | Denied with no release or pointer mutation |
| AUTH-04 | Change tenant/site IDs in create and relationship payloads | Request rejected; no cross-tenant rows created |
| AUTH-05 | Revoke an active user’s membership | Next protected operation fails without waiting for a UI refresh |
| AUTH-06 | Request another site’s private upload or preview asset | Denied; no long-lived public original URL exposed |
| AUTH-07 | Attempt self-promotion or last-owner removal | Denied by server/database constraints |
| DATA-01 | Save content and restart application | Data persists correctly |
| DATA-02 | Two editors save from the same original version | Second stale save receives conflict and preserves input |
| DATA-03 | Disable a referenced module or archive referenced content | Candidate reports the affected dependency; no silent deletion |
| PUB-01 | Save unpublished edits | Anonymous public content remains unchanged |
| PUB-02 | Edit again after candidate creation | Candidate preview remains identical to its frozen manifest |
| PUB-03 | Activate a valid candidate | New public content, navigation, metadata, and search use one release |
| PUB-04 | Activate an invalid or unapproved candidate | Blocked with actionable findings; active release unchanged |
| PUB-05 | Double-submit activation or race two candidates | Idempotent retry or conflict; no lost update |
| PUB-06 | Restore historical release | New release restores public content; drafts/inquiries survive |
| PUB-07 | Fail asset preparation or transactional activation | Prior release remains active; error is visible and retryable |
| PUB-08 | Try public read of candidate/revision tables | No drafts or private manifests exposed |
| ROUTE-01 | Unknown host or unverified live domain | Neutral failure; never another tenant’s site |
| ROUTE-02 | Alternate identical paths across sites and sessions | Correct tenant every time; no shared-cache leakage |
| ROUTE-03 | Change a slug then publish | New URL works and old URL redirects without a loop |
| UX-01 | Keyboard through menus, dialog, form, and editor | Logical focus, reachable actions, visible focus, correct labels |
| UX-02 | Render at 390, 768, and 1440 pixels and 200% zoom | No clipped controls, unintended horizontal overflow, or unreadable text |
| UX-03 | Search with no matches and clear filters | Helpful state; reset works; browser back restores prior filters |
| TIME-01 | Holiday, overnight hours, unknown hours, closure | Correct local-date behavior without fabricated Open now status |
| TIME-02 | Event at midnight and daylight-saving boundary | Correct ordering, display zone, and upcoming/past classification |
| LEAD-01 | Submit valid form and refresh inbox | One persisted inquiry under the correct site |
| LEAD-02 | Notification provider fails | Inquiry persists; failure appears; retry is available |
| LEAD-03 | Tamper with recipient or foreign location | Recipient ignored/rejected and foreign relationship denied |
| LEAD-04 | Duplicate click or repeated request token | One inquiry; stable receipt behavior |
| LEAD-05 | Exceed rate limit or send invalid/oversized data | Appropriate rejection; no unbounded write or secret error output |
| MEDIA-01 | Upload invalid type, oversized file, or misleading extension | Rejected without public exposure |
| MEDIA-02 | Replace image then restore old release | Historical image resolves if retained and allowed |
| PORT-01 | CSV dry run containing invalid rows | Exact row findings; no writes before confirmation |
| PORT-02 | Repeat confirmed import | No duplicate records from same external IDs/job |
| PORT-03 | Export A and import into blank C | Counts, relationships, content, and asset hashes match; no users/secrets imported |
| OPS-01 | Fresh install from README and lockfile | Application and required tests run reproducibly |
| OPS-02 | Database/storage restore rehearsal | Records and referenced assets recover; result documented |
| OPS-03 | Production build and secret inspection | Build passes; no privileged credentials in client artifacts |
| META-01 | Inspect preview, demo, canonical pages, sitemap, and 404 | Correct environment-specific metadata and status behavior |

Automate the permission, publishing, conflict, time, and data-integrity cases. Use browser tests for representative user journeys. Use manual visual review for composition and readability. Do not write dozens of tests that only mirror CSS classes or assert the implementation’s own constants.

## 21 Quality targets

### Accessibility and performance

Aim for WCAG 2.2 AA behavior and test the actual interfaces. Automated scans are one input; keyboard and screen-reader spot checks remain necessary. Fix missing labels, contrast defects, broken focus, and dialog traps before release.

On representative production-built public pages, target a median Lighthouse mobile performance score of at least 90 across three controlled runs, CLS at or below 0.1, and lab LCP at or below 2.5 seconds when the test environment supports a meaningful measurement. These are project targets, not promised field results. Record device/throttling conditions. Do not claim field Core Web Vitals from a local lab run.

Keep above-the-fold images properly sized, defer nonessential media, minimize public client-side JavaScript, and avoid loading the admin component system into public bundles. No autoplay video is necessary to make the pilots convincing.

### Content and visual review

No lorem ipsum, dummy chart, unsupported metric, broken image, placeholder action, or unresolved console error belongs in the final walkthrough. Every public page needs a clear purpose and next step. A renderer can be reusable while each preset has distinct layout and visual hierarchy.

Review screenshots side by side: if the two pilots look like the same page recolored, revise the public compositions. Compare the dashboard’s most common tasks for unnecessary clicks. A store-hour update should be understandable without developer vocabulary.

### Release labels

- **Working local release:** required local workflows and tests pass; provider-dependent features honestly identified.
- **Hosted staging verified:** managed auth, storage, application, worker, and notifications tested with staging data; no customer domain migration.
- **Live pilot ready:** approved real content, domain configuration, backup/restore, real inquiry routing, and remaining release checks pass.
- **Commercially validated:** actual paying customer use and retention provide evidence. Software completion alone does not justify this label.

## 22 Deployment and existing-site protection

Create a separate staging application and a separate staging database/project. Do not point staging at production data. Configure server credentials and public keys according to the provider’s current documentation. Configure authentication callback URLs and email delivery explicitly. Never reuse a demonstration seed in production.

Before live deployment, check current Vercel plan eligibility for commercial use, custom domain limits, build/runtime limits, and job scheduling; check Supabase database/storage/email/backup limits; and check transactional email pricing. Report actual selected plan costs for owner approval. No free-tier promise is made here.

Domain workflow: enter hostname, register it with the hosting provider, display provider-supplied verification instructions, verify ownership/provider status, and only then mark the binding active. Do not infer DNS values, alter nameservers, or mark a domain verified because it was typed into a form. The dashboard can initially guide manual provider setup, provided status is honestly verified before activation.

Do not edit, commit, merge, deploy, or migrate Inside the Towns, its town domains, AragoCor, or Lerner Works’ existing website as part of this guide. Do not move production DNS. For this new project, prepare local changes and evidence; request explicit authorization before Git commits, pushes, merges, remote repository creation, or public deployment. Normal local implementation and testing should continue without repeated permission questions.

If a future migration is requested, inventory current URLs, redirects, content rights, forms, metadata, and hosting first. Produce a route-by-route comparison and restoration plan. Start with one separately approved pilot. This guide does not authorize a bulk migration.

## 23 Claude Code working rules

1. Read the full guide initially. Create a short `CLAUDE.md` pointing to it and summarizing non-negotiable boundaries; do not copy the entire guide into every context file.
2. Keep `docs/PROGRESS.md` current with completed milestone, current task, last test results, known blockers, and next action. This is the resume point after context reset.
3. Make ordinary reversible implementation decisions autonomously. Record material architectural decisions and why they fit the spec. Ask only for a genuinely missing credential, access, approval, or incompatible requirement.
4. Use current official documentation for version-sensitive APIs. Record installed versions and the relevant links. Avoid redesigning the stack because a package API changed.
5. Implement one complete behavior at a time and verify it. Do not stop at a plan, architecture diagram, mockup, component gallery, or fixture-only frontend.
6. Prefer one primary implementation thread initially. Parallel agent work is optional only if separately authorized and justified; do not multiply context costs by default.
7. Search narrowly, summarize relevant findings, and avoid repeatedly reading the entire repository or producing giant logs. Use concise progress notes and durable project files.
8. Never alter tests merely to make failing behavior appear correct. Explain the cause and fix the underlying behavior or clearly document a specification conflict.
9. Never invent credentials, current prices, test results, external integration success, published URLs, or production readiness.
10. Reserve verification capacity. When usage becomes constrained, preserve a working tested milestone and an exact remaining-work list.

### Progress report after each milestone

Report what a user can now do, how to open it, what was tested, what failed or remains blocked, and which milestone comes next. Include actual usage if available; otherwise request the owner’s usage reading without guessing. Avoid reporting “95% complete” unless there is an explicit denominator of passed acceptance items.

Maintain a feature ledger with columns for feature, working UI, persistent backend, permission checks, tests, and external configuration. This prevents a screen from being counted as complete while its behavior is missing.

## 24 Demonstration script

Run the following with two browser sessions and a clean known fixture set. Aim for about ten minutes; this is a demonstration target, not a mandatory speed test.

1. Open the agency dashboard. Show both organizations and actual pending actions.
2. Open the two public pilot homepages side by side. Explain their different visitor tasks.
3. Sign in as editor A. Edit a guide event and save. Show the unchanged public page.
4. Submit for review. As publisher, inspect the revision difference and approve it.
5. Build a candidate. Open its preview and publish. Show the new event on the public site.
6. Try to open organization B from editor A’s session. Show denied access without leaked data.
7. Edit the retailer’s holiday hours, publish, and show the changed store page.
8. Submit an inquiry and show the stored inbox record and local/real delivery status accurately.
9. Restore the previous retailer release. Show the old hours and preserved inquiry.
10. Create a third blank site from a preset. Import the portable package in draft form and show the resulting editable content.

If any step requires a code edit, direct database repair, browser-console injection, or manually faked state during the demonstration, the corresponding workflow is incomplete.

## 25 Starting prompt for Claude Code

Copy the following into Claude Code after placing this file in the new project folder.

```text
Build the Lerner Works Website Platform described in docs/Lerner-Works-Platform-Build-Guide.md. If the guide is in the project root instead, locate and read that copy. Read the entire specification before implementing.

I want a working, polished application, not a concept, a marketing landing page, or a collection of mock dashboard screens. Use the selected architecture and deliver the milestones in order. The full local release requires two distinct fictional pilot websites, a persistent editing dashboard, tenant isolation, frozen candidate previews, atomic publication, rollback, working inquiry storage, reviews, media, and portable import/export.

First inspect the current directory and applicable project instructions. Work only in this new project. Do not modify any existing live site or its repository. Do not create remote repositories, commit, push, merge, deploy publicly, change DNS, send real emails, or purchase services without my explicit approval. Local implementation, installation, migrations against clearly local services, and testing are authorized.

Create a concise CLAUDE.md plus docs/PROGRESS.md, docs/DECISIONS.md, docs/ACCEPTANCE.md, and docs/OPERATIONS.md. Record current versions and a reproducible setup. Do not invent account credentials or provider success. When a credential is missing, finish all unblocked local work and identify the exact remaining setup step.

Start with M0 and continue into M1 once setup is verified. Prove one complete edit -> draft -> frozen preview -> publish -> public page workflow before broadening the interface. Implement the database policies and test tenant separation early. Use real persistence, not localStorage or successful-looking mock responses.

Continue through the remaining milestones while maintaining a runnable application and a current progress file. At each milestone report concrete behavior and test evidence. Do not repeatedly ask me to approve normal implementation choices. Do not stop after producing a plan. Respect the guide's usage checkpoints and reserve testing capacity; the $250 is Claude Code usage credit, not a hosting budget or a guaranteed completion estimate.

Make the public sites visibly different in layout and typography. Make the dashboard restrained and useful. Inspect desktop and mobile screenshots, fix defects, and complete the acceptance matrix. Be truthful about every unverified or externally blocked feature. The final report must distinguish a working local release from hosted or live production readiness.

Begin implementation now.
```

## 26 Continuation and refinement prompts

### Resume after interruption

```text
Continue the Lerner Works platform build. Read CLAUDE.md and docs/PROGRESS.md, inspect the current changes, and consult the relevant sections of the build guide. Resume from the next incomplete milestone; do not restart or replace working architecture. Complete unblocked implementation and run the specific checks needed for the changed behavior. Keep the progress and acceptance files accurate. Preserve the existing-site and publishing approval boundaries.
```

### If Claude produces polished screens without working behavior

```text
Audit the feature ledger against actual behavior. For every visible action, identify its persisted backend operation, authorization check, and verification evidence. Replace simulated success, localStorage business records, fake metrics, and disconnected controls with the required implementation. Prioritize the end-to-end editing and publication workflow. Do not add new screens until the existing workflow is demonstrably functional.
```

### Final refinement pass

```text
Run the guide's acceptance matrix against the current application. Report PASS, FAIL, BLOCKED, or NOT RUN with evidence. Fix failed required behavior, then inspect screenshots at 390, 768, and 1440 pixels and 200% zoom. Improve actual readability, navigation, empty states, image crops, spacing, and interaction feedback. Verify the two public presets differ beyond colors. Add no new modules. Finish with a production build, fresh-setup check, demonstration script results, and an honest release report.
```

## 27 Required final handoff

The completed project must include application source, pinned dependency lockfile, migrations and row-level policies, local seed script, `.env.example`, all required commands, tested setup instructions, operations guide, architecture decisions, current feature ledger, acceptance results, screenshots, primary-source links, demonstration instructions, and exact remaining configuration steps.

The handoff must state: what works locally; what works on hosted staging if configured; which external integrations remain unverified; known defects and impact; how to restore a release; how to export a site; and how to resume development. Provide the local URLs or genuinely deployed URLs that exist, not anticipated destinations.

**Completion gate:** The user can run the documented setup and complete the demonstration using the interface. Tenant isolation and publication integrity tests pass. The two public pilots look intentional and work on mobile. Required failures are recoverable and truthful. Any unmet criterion remains visible in the release report.

## 28 Primary sources and implementation checks

The architecture above is a project recommendation. These current official sources were consulted on September 25, 2026 to verify relevant platform capabilities. Recheck the version-sensitive instructions during implementation. Most feature details and thresholds in this guide are authored requirements, not vendor promises.

1. [Next.js data security](https://nextjs.org/docs/app/guides/data-security) — server-side data access and authorization guidance.
2. [Next.js authentication](https://nextjs.org/docs/app/guides/authentication) — sessions, authentication, and authorization distinctions.
3. [Supabase row level security](https://supabase.com/docs/guides/database/postgres/row-level-security) — database policies, authenticated access, and privileged service-key caveats.
4. [Supabase storage access control](https://supabase.com/docs/guides/storage/security/access-control) — object-access policy model.
5. [Supabase local development](https://supabase.com/docs/guides/local-development) — CLI and container-based local environment.
6. [Vercel multi-tenant domain configuration](https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains) — custom domains and verification.
7. [Vercel multi-tenant limits](https://vercel.com/docs/multi-tenant/limits) — account/plan constraints to verify before selecting hosting.
8. [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist) — production preparation and runtime considerations.

The earlier Reusable Customer Site Platform Project Brief was read as project context. Its historical repository observations are not treated as current verification. No current live site or repository was changed to produce this guide.
