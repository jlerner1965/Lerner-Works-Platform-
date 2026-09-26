/**
 * Supabase Auth settings on a hosted project through the Management API: site URL, redirect
 * allow-list, sign-ups, custom SMTP through Resend and the email rate limit. Reads the current
 * settings, applies only the requested changes, reads them back and verifies each one. Secrets
 * come from the environment and are never printed.
 *
 *   SUPABASE_ACCESS_TOKEN=... pnpm hosted:auth --project-ref <ref> \
 *     --site-url https://app.example --redirect https://app.example/auth/recovery --disable-signups
 *
 *   AUTH_SMTP_RESEND_API_KEY=... SUPABASE_ACCESS_TOKEN=... pnpm hosted:auth --project-ref <ref> \
 *     --smtp-resend --sender notifications@example --sender-name "Example" [--rate-limit-email-sent 30]
 *
 *   --show     print the current settings (no secrets) and exit
 *   --dry-run  print the redacted change set and exit without contacting the API
 *
 * `--redirect` may repeat; together the values replace the project's allow-list. The Resend
 * key must have sending permission for the sender's domain (a sending-only key restricted to
 * that domain is enough).
 */
import { loadEnv } from "./lib/env";
import { assertProjectRef, managementToken } from "./lib/supabase-management";
import { buildAuthPatch, parseHostedAuthArgs, readAuthConfig, redactAuthPatch, RESEND_SMTP, summarizeAuthConfig, updateAuthConfig, verifyAuthPatch } from "./lib/supabase-auth";

loadEnv();

async function main(): Promise<void> {
  const args = parseHostedAuthArgs(process.argv.slice(2));
  const ref = assertProjectRef(args.ref);

  if (args.show) {
    const current = await readAuthConfig(ref, managementToken());
    console.log(`Supabase Auth settings on ${ref}:`);
    for (const line of summarizeAuthConfig(current)) console.log(`  ${line}`);
    return;
  }

  const smtpKey = process.env.AUTH_SMTP_RESEND_API_KEY ?? "";
  if (args.smtpResend) {
    const adminEmail = args.sender ?? process.env.NOTIFY_FROM_ADDRESS ?? "";
    if (!adminEmail) throw new Error("--sender <address> (or NOTIFY_FROM_ADDRESS) is required for --smtp-resend.");
    if (!smtpKey && !args.dryRun) {
      throw new Error("AUTH_SMTP_RESEND_API_KEY (a Resend API key with sending permission for the sender's domain) is required for --smtp-resend.");
    }
    args.options.smtp = { ...RESEND_SMTP, pass: smtpKey || "(dry run)", adminEmail, senderName: args.senderName ?? "Lerner Works Platform" };
  } else if (args.sender || args.senderName) {
    throw new Error("--sender and --sender-name apply only with --smtp-resend.");
  }

  const patch = buildAuthPatch(args.options);

  if (args.dryRun) {
    const shown = redactAuthPatch(patch);
    if ("smtp_pass" in shown && !smtpKey) shown.smtp_pass = "(AUTH_SMTP_RESEND_API_KEY is not set)";
    console.log(`Dry run for ${ref}: this change set would go to PATCH /v1/projects/${ref}/config/auth`);
    console.log(JSON.stringify(shown, null, 2));
    return;
  }

  const token = managementToken();
  const before = await readAuthConfig(ref, token);
  console.log(`Before (${ref}):`);
  for (const line of summarizeAuthConfig(before)) console.log(`  ${line}`);
  if (typeof patch.uri_allow_list === "string" && before.uri_allow_list && before.uri_allow_list !== patch.uri_allow_list) {
    console.log(`  note: the redirect allow-list "${before.uri_allow_list}" is replaced by "${patch.uri_allow_list}"`);
  }

  const after = await updateAuthConfig(ref, token, patch);
  console.log("After:");
  for (const line of summarizeAuthConfig(after)) console.log(`  ${line}`);

  const problems = verifyAuthPatch(patch, after);
  if (problems.length > 0) {
    console.error("The provider does not report every requested value:");
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  const count = Object.keys(patch).length;
  console.log(`Verified ${count} setting${count === 1 ? "" : "s"} on ${ref}.${patch.smtp_host ? " Request a password reset from the sign-in page to confirm delivery through the relay." : ""}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
