# Putting a finished site on the platform

For a site built anywhere else, by hand, with a design tool or with a generator, that should
be hosted on its own domain with a working contact form, releases that can be rolled back,
and a login for the client. Nothing in the HTML is changed by the platform.

## Two ways in

**From GitHub.** Upload → *Publish from GitHub*: paste the repository (`owner/name` or its
github.com address) and, if it is not the default branch, the branch; if the site sits in a
folder of the repository (`dist`, `docs`…), name it, or paste the folder's `/tree/…` address.
*Fetch and check* pulls the files at the latest commit and checks them. After the first time
the site remembers the repository: the button reads *Check the latest from GitHub*, and the
page says which commit is live and whether the branch has moved on. Public repositories need
nothing more. For a private repository, an owner pastes a GitHub token once on the
Organizations page (a fine-grained token with read access to Contents of the repositories in
question); it is checked with GitHub, stored sealed, used only on the server and never shown
again. It can be removed there too.

**As a ZIP.** Zip the folder with `index.html` at its top, or the build output folder of a
generator; zipping the folder itself is fine, its name is dropped. Upload → choose the ZIP →
*Upload and check*. The file goes up in parts, so the size limit is the platform's 64 MB, not
the few megabytes a single web request allows; a bar shows the progress.

## What the check does

- Keeps what a website serves: HTML, CSS, JavaScript, images, fonts, PDFs, video and audio,
  up to 2,000 files and 25 MB a file.
- Leaves out and lists everything else instead of refusing: a README or LICENSE, `package.json`
  and its lockfile, `vercel.json`, source files (`.tsx`, `.scss`…), hidden files, `node_modules`,
  and server-side code (PHP, shell scripts), which gets a warning of its own because a page or
  form depending on it will not work here.
- Finds the site inside a build folder (`dist`, `build`, `out`, `public`, `_site`, `docs`) when
  the top level has no `index.html`; a folder can also be named on the form.
- Still refuses what cannot be served at all: no `index.html` anywhere, a path that leaves
  the archive, a file over 25 MB, two files whose names differ only in letter case. A
  repository that has to be built first (a `package.json` with source files and no built
  page) is told so: build it, then upload or point at the output folder.
- Warns about a missing `404.html` and about a form that does not post to the platform.

## Steps

1. **Create the site.** Organizations → Create site → *Uploaded*. Name it, give it a key (the
   preview address uses it), set the contact email and the inquiry recipients.
2. **Get the files in**, from GitHub or as a ZIP, as above. First time? *Download the sample
   site* and upload it as it is.
3. **Publish.** *Publish as release vN*. The site is at its preview address at once
   (`https://<key>.<preview hostname>/`, never indexed by search engines); the overview shows
   the link.
4. **The contact form.** Paste the snippet from the site's overview into the contact page.
   The message lands in Inbox and goes to the recipients; the visitor is taken to the page
   named in `next` (a thanks page) with a receipt code in the address.
5. **Go live.** Settings → Domains: register the hostname, add the records the provider shows,
   verify, activate; then Settings → Publishing → live. The site answers on the domain within
   a minute.
6. **A new version.** Push to the repository and *Check the latest from GitHub*, or upload
   again; each publish is a new release. An earlier version: Upload → Releases → *Restore*.
7. **Hand it to the client.** Team → invite them as a publisher (upload, inbox, settings) or
   as an organization member with no site role.

## What the platform does and does not do for an uploaded site

- It serves the files as uploaded, with the right types, a content hash as the ETag and a
  minute of caching at the edge. A page without its extension and a folder's `index.html`
  resolve; the site's own `404.html` answers missing addresses.
- It does not touch the HTML: no injected scripts, no analytics, no templating. It does not
  run server code and does not build the site (no static-site generator runs here; run it
  before zipping, or commit its output to the repository).
- Checks never published are dropped after thirty days, and an upload that stops half way
  is cleaned up after a day.
- The dashboard for such a site is Upload, Inbox, Settings (details, domains, publishing
  mode), Team and the activity log. There is no content editor, media library or design page
  for it.

## What comes after the first real site

Once one client site is live this way, the next step is letting a hand-built page pull in the
platform's live pieces, such as store hours, an events list or the form itself, through
markers that the publish step expands into plain HTML. That is decided when a real site asks
for it, not before.
