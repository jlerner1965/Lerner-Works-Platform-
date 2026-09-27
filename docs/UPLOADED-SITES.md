# Putting a finished site on the platform

For a site built anywhere else, by hand, with a design tool or with a generator, that should
be hosted on its own domain with a working contact form, releases that can be rolled back,
and a login for the client. Nothing in the HTML is changed by the platform.

## Steps

1. **Create the site.** Organizations → Create site → *Uploaded*. Name it, give it a key (the
   preview address uses it), set the contact email and the inquiry recipients.
2. **Zip the site.** The folder with `index.html` at its top; zipping the folder itself is
   fine, its name is dropped. Keep a `404.html` for missing addresses. Pages may link to each
   other as `/about` or `/about.html`; both work. Up to 64 MB, 2,000 files, 25 MB a file.
   PHP and other server-side files cannot run here and are refused.
3. **Upload and check.** Upload → choose the ZIP → *Upload and check*. The check lists what
   the ZIP holds, what would not be served and what is missing. Nothing changes on the site
   until you publish. First time? *Download the sample site* and upload it as it is.
4. **Publish.** *Publish as release vN*. The site is at its preview address at once
   (`https://<key>.<preview hostname>/`, never indexed by search engines); the overview shows
   the link.
5. **The contact form.** Paste the snippet from the site's overview into the contact page.
   The message lands in Inbox and goes to the recipients; the visitor is taken to the page
   named in `next` (a thanks page) with a receipt code in the address.
6. **Go live.** Settings → Domains: register the hostname, add the records the provider shows,
   verify, activate; then Settings → Publishing → live. The site answers on the domain within
   a minute.
7. **A new version.** Upload again and publish; each upload is a new release. An earlier
   version: Upload → Releases → *Restore*.
8. **Hand it to the client.** Team → invite them as a publisher (upload, inbox, settings) or
   as an organization member with no site role.

## What the platform does and does not do for an uploaded site

- It serves the files as uploaded, with the right types, a content hash as the ETag and a
  minute of caching at the edge. A page without its extension and a folder's `index.html`
  resolve; the site's own `404.html` answers missing addresses.
- It does not touch the HTML: no injected scripts, no analytics, no templating. It does not
  run server code and does not build the site (no static-site generator runs here; run it
  before zipping).
- The dashboard for such a site is Upload, Inbox, Settings (details, domains, publishing
  mode), Team and the activity log. There is no content editor, media library or design page
  for it.

## What comes after the first real site

Once one client site is live this way, the next step is letting a hand-built page pull in the
platform's live pieces, such as store hours, an events list or the form itself, through
markers that the publish step expands into plain HTML. That is decided when a real site asks
for it, not before.
