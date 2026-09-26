# Walk-through measurements (SB-06)

`tests/e2e/walkthrough.spec.ts` performs the same walk-through after every phase of the
site-building programme, through the dashboard as a person would: create a site from the
community guide preset, brand it (tagline and two colours), add five places, publish. Per
task it counts the screens opened, the fields filled and the links or buttons pressed, and
records the scripted run's wall time and the number of empty-state notices left on the
published home page. It writes `latest.json` on every run of the browser suite; the numbers
per phase are copied into the SB-06 row of `docs/ACCEPTANCE.md`.

The counts are the comparable measure between phases. The wall time is the script's, not a
person's: a script types instantly and never reads, so a person needs several times longer.
A person's own timing of a complete site build is the evidence of phase B4.

`tests/e2e/onboarding.spec.ts` writes two more files on every run of the browser suite:
`onboarding.json` (SB-04: the steps from creating a site to its first release from a filled
onboarding package, with the scripted time of each and the empty-state notices on the
published home page, which must be 0) and `bulk-upload.json` (SB-05: twenty images in one
upload with their alternative text saved on one screen, scripted time). Filling in the
package's sheets happens outside the dashboard and is not timed here.
