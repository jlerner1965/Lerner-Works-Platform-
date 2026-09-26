# Ten-minute demonstration

Two browser sessions: an agency window (signed in) and a visitor window (not signed in).
Accounts are in `docs/local-accounts.md` after `pnpm seed:demo`. The automated version of
this script is `tests/e2e/demo.spec.ts`; its screenshots are in `docs/evidence/demo/`.

Before the demonstration: `pnpm dev` in one terminal and `pnpm worker:dev` in another.

1. **Both organizations, real pending actions.** Sign in as `owner@lernerworks.example`.
   The Organizations page lists Pine Hollow Guide Co-op and Range Athletics Inc. Open Pine
   Hollow Guide: the overview shows 1 waiting review (the seeded "Winter parking rules"
   article), 1 new inquiry and the latest release.
2. **Two designs.** Visitor window: `/demo/pine-hollow` (editorial serif guide, image hero,
   category list, dated events, place cards) and `/demo/range-athletics` (utility retailer:
   bold sans headline, store finder with live open/closed state, services grid).
3. **Safe editing.** Sign in as `editor-a@pinehollow.example` in a third window (or sign
   out first). Content → Events → "Harvest Market on Aspen Street": change the summary,
   Save draft. Reload the public event page: unchanged.
4. **Review.** Editor: Request review. Owner: Reviews shows the item; open it, Revision
   history shows "Changed: Summary"; Approve (an editor's work always needs a publisher's
   approval; the owner's own saves are approved as they are saved unless the site requires
   review, Settings → Publishing).
5. **Publish.** Owner: Publish. The page lists what the next release contains ("Changed (1)")
   and "Publish now" would publish it in one step; for the demonstration take the careful
   path: Build a candidate, look at the findings list, Preview the frozen candidate (viewport
   toggles), Activate. Reload the public event page: the new summary is live. The candidate
   page links to the release.
6. **Denied access.** Editor window: open `/app/sites/<range-athletics-id>` → 404, nothing
   from organization B is rendered; the sidebar never offered it.
7. **Holiday hours.** Sign in as `publisher-b@rangeathletics.example`. Content → Stores →
   Longmont: add a date exception (e.g. December 24, Christmas Eve, 09:00–14:00). Save: the
   editor reports the version as approved, because the site does not require a separate
   review and a publisher's own save is approved on save (recorded as an approval by the
   publisher in the audit log). Publish → Build a candidate, Activate (or "Publish now").
   Public store page shows the exception under "Upcoming exceptions" (within 90 days of
   today) and the weekly table is unchanged.
8. **Inquiry.** Visitor: on the Longmont store page, send the form. A receipt reference
   appears. Publisher: Inquiries lists it as New with delivery "pending"; after the worker's
   next pass the detail page shows "delivered" with the local sink file reference. Storage
   and email are shown as separate facts.
9. **Recover.** Publisher: Publish → Release history → open the previous release → the
   difference view lists what restoring would change → enter a reason → Restore. Public
   store page shows the old hours again; the inquiry is still in the inbox; drafts are
   untouched.
10. **Reusable delivery.** Owner: Create site → Community guide preset → "Cedar Bend Guide".
    The new site has starter pages whose slots fill themselves once content exists (nothing
    is shown for an empty slot; the onboarding package on Import & export is the fast way to
    fill them). Pine Hollow → Import & export →
    Download site package. Cedar Bend → Import & export → upload the package → the
    validation summary lists items, images and the starter pages that will be replaced →
    Import package as drafts → Content shows the imported places, events and articles as
    unpublished drafts with new ids.

No step requires a code edit, direct database access, browser-console injection or faked
state. If a step fails, that is a defect to record in `docs/ACCEPTANCE.md`.
