# Lessons from this project

Read before proposing any phase. Written on 2026-09-27 after the owner's verdict that the
work had cost hours and led down paths that got nowhere. These are the mistakes, plainly, and
the rule each one leaves behind.

1. **Look at the real inputs before building.** B8 built "fetch a repository from GitHub"
   without opening one of the owner's repositories. All of them are Astro projects: there is no
   website in them until a build runs, so the feature could not publish a single one of the
   owner's sites. One `git clone` beforehand would have shown it. Rule: before a phase, take the
   owner's actual files, repositories and sites and run them through the plan by hand.

2. **Test on the real host before saying done.** B7 passed every local test and failed the
   owner's first real upload on production: the host refuses request bodies over 4.5 MB, and the
   check refused a repository download over its README and source files. Rule: a phase that
   touches uploads, storage, routing or the database is exercised on production (probe the
   limits, run the read-only checks, use the owner's own files) before it is called done.

3. **Have the owner try the thing after each phase, not after five.** B1 to B5 built a
   structured content platform; the owner then judged it "not something I would use". The bar
   (D-020) existed from B1; the judgement came at B5. Rule: a phase ends with the owner using it
   for ten minutes on production, and the next phase is chosen from what they say.

4. **The platform is where finished sites live, not where they are built.** Hosting on the
   client's domain, immutable releases with restore, the inquiry inbox, per-client access, the
   audit trail. The structured site builder is kept for what exists and not extended. Rule: do
   not propose editor, theme, section, design or import work.

5. **Keep a phase to one sitting, and the owner's step at the end to minutes.** Paste a
   snippet, click a button, look at a page. Anything that asks the owner for an evening is the
   wrong shape.

6. **Hosted defaults differ from local (D-028).** A Supabase project grants the client roles
   everything on new tables and functions; the local database does not, so no test saw it.
   Rule: every migration that creates a table or a function states its grants explicitly, and
   the read-only verification in `docs/OPERATIONS.md` runs on the hosted project afterwards.

7. **Dead ends, named so nobody walks them again:** building sites on the platform (there is
   no build service and none is planned); a page builder or per-element design controls
   (D-017); more features for structured sites; fetching source repositories as if they were
   sites. The path that works for a built site is the one its own CI already walks: build
   there, hand the finished files to the platform (push to deploy, B9).
