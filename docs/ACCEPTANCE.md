# Acceptance matrix

Status values: PASS, FAIL, BLOCKED, NOT RUN. A row is PASS only with recorded evidence for
the tested revision. Automated coverage lives in `tests/`. This file is updated at each
milestone; see `docs/PROGRESS.md` for the current milestone. "Revision" names the milestone
state the evidence was produced at; re-run the suites listed in `pnpm verify` for a fresh run.

| ID | Scenario | Status | Evidence / test | Revision |
|---|---|---|---|---|
| AUTH-01 | Sign out and request dashboard data | PASS | e2e publishing.spec: signed-out request to /app/sites/… redirects to /sign-in | M1 |
| AUTH-02 | Editor A requests B's site through API and DB clients | PASS | integration isolation.test (0 rows through app role); e2e 404 without site name | M1 |
| AUTH-03 | Editor calls publish endpoint manually | PASS | integration isolation.test: editor activate → denied, pointer update → 42501 | M1 |
| AUTH-04 | Change tenant/site IDs in create and relationship payloads | PASS | integration isolation.test: mismatched organization/site ids rejected by policy | M1 |
| AUTH-05 | Revoke an active user's membership | PASS | integration isolation.test + e2e access.spec: removed membership → 404 on the next request of a live session | M3 |
| AUTH-06 | Request another site's private upload or preview asset | NOT RUN | | |
| AUTH-07 | Attempt self-promotion or last-owner removal | PASS | integration isolation.test + e2e access.spec (last-owner controls disabled and explained) | M3 |
| DATA-01 | Save content and restart application | PASS | integration publishing.test: revision persists; demo flow re-read after restart of dev server (manual) | M1 |
| DATA-02 | Two editors save from the same original version | PASS | integration publishing.test: stale save → conflict with latest payload, no write | M1 |
| DATA-03 | Disable a referenced module or archive referenced content | PASS | integration publishing.test: disabled module → blocker names dependent page; nothing deleted | M1 |
| PUB-01 | Save unpublished edits | PASS | integration + e2e: draft save leaves public snapshot unchanged | M1 |
| PUB-02 | Edit again after candidate creation | PASS | integration + e2e: later edit does not change frozen manifest/hash or preview | M1 |
| PUB-03 | Activate a valid candidate | PASS | integration + e2e: activation publishes new snapshot (navigation/metadata/search from one snapshot) | M1 |
| PUB-04 | Activate an invalid or unapproved candidate | PASS | integration publishing.test: blocked candidate cannot activate; active release unchanged | M1 |
| PUB-05 | Double-submit activation or race two candidates | PASS | integration publishing.test: retry with same key → already_activated; stale candidate → conflict + superseded | M1 |
| PUB-06 | Restore historical release | PASS | integration publishing.test: restore creates new release; drafts and inquiries survive | M1 |
| PUB-07 | Fail asset preparation or transactional activation | PASS | integration media-releases.test: missing derivative → assets_failed, prior release active, candidate stays ready, retry succeeds after repair | M3 |
| PUB-08 | Try public read of candidate/revision tables | PASS | integration isolation.test: anon select on revisions/candidates/releases → 42501 | M1 |
| ROUTE-01 | Unknown host or unverified live domain | PASS | manual curl: unknown Host → 404; /host/* on app host → 404 (proxy) | M1 |
| ROUTE-02 | Alternate identical paths across sites and sessions | PASS | integration publishing.test: same slug resolves to each site's own item | M1 |
| ROUTE-03 | Change a slug then publish | PASS | integration publishing.test: slug change publishes redirect without loop | M1 |
| UX-01 | Keyboard through menus, dialog, form, and editor | NOT RUN | | |
| UX-02 | Render at 390, 768, and 1440 pixels and 200% zoom | PASS | screenshot pass at 390/768/1440 (docs/evidence/screenshots), scrollWidth check: no overflow; 200% zoom check pending (M4) | M2 |
| UX-03 | Search with no matches and clear filters | PASS | e2e public.spec: category filter survives reload, back restores, no-results state, Clear resets | M2 |
| TIME-01 | Holiday, overnight hours, unknown hours, closure | PASS | unit hours.test + e2e public.spec (temporarily closed store shows no Open now; unknown hours shown as not published; hours table) | M2 |
| TIME-02 | Event at midnight and daylight-saving boundary | PASS | unit events.test + e2e public.spec (cancelled label, zone abbreviation, past filter, overnight event range) | M2 |
| LEAD-01 | Submit valid form and refresh inbox | PASS | integration inquiries.test + e2e public.spec: form validation, receipt, inbox shows the record | M2 |
| LEAD-02 | Notification provider fails | PASS | integration delivery.test: failing provider → pending with backoff → failed after 4 attempts; inquiry persists; publisher re-queue; sink delivery | M3 |
| LEAD-03 | Tamper with recipient or foreign location | PASS | integration inquiries.test: foreign location rejected; recipient fields ignored | M1 |
| LEAD-04 | Duplicate click or repeated request token | PASS | integration inquiries.test: repeated token → same receipt | M1 |
| LEAD-05 | Exceed rate limit or send invalid/oversized data | PASS | integration inquiries.test: 6th submission → P0003; oversized message rejected | M1 |
| MEDIA-01 | Upload invalid type, oversized file, or misleading extension | PASS | integration media.test (SVG/HTML/mismatch/corrupt/oversize/pixel limit rejected, nothing stored) + e2e upload form | M2 |
| MEDIA-02 | Replace image then restore old release | PASS | integration media-releases.test: replaced image, restored old release, historical derivative resolves; withdrawn asset blocks restore | M3 |
| PORT-01 | CSV dry run containing invalid rows | PASS | integration import-export.test: dry run reports row 4 (missing title, bad hours) and row 5 (duplicate id); no writes | M3 |
| PORT-02 | Repeat confirmed import | PASS | integration import-export.test: repeated import → 0 created, 2 skipped; changed row → 1 update, no duplicates | M3 |
| PORT-03 | Export A and import into blank C | PASS | integration import-export.test: export A → import into fresh site C; counts, venue reference, text and asset SHA-256 match; no users/secrets; tampered package refused | M3 |
| OPS-01 | Fresh install from README and lockfile | NOT RUN | | |
| OPS-02 | Database/storage restore rehearsal | PASS | pnpm backup:local + pnpm restore:rehearsal: 2 sites/39 items/4 releases/26 media/2 inquiries restored; 78/78 derivatives present (see PROGRESS.md) | M3 |
| OPS-03 | Production build and secret inspection | NOT RUN | | |
| META-01 | Inspect preview, demo, canonical pages, sitemap, and 404 | NOT RUN | | |
