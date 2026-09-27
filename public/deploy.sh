#!/usr/bin/env bash
# Push to deploy for Lerner Works Platform (B9). Zips a built site folder, sends it to the
# platform in parts, and publishes it as the site's next release.
#
#   LW_DEPLOY_TOKEN=lwd_… bash deploy.sh dist
#
# Arguments: the folder holding the built site (default: dist). Environment:
#   LW_DEPLOY_TOKEN  the site's deploy token (Upload page → Push to deploy), required
#   LW_URL           the platform's address; defaults to https://app.lernerworksplatform.dev
#                    (the step shown on the Upload page names another address when needed)
#   LW_ROOT          a folder inside the ZIP that is the site, if not its top (rarely needed)
# Needs bash, curl, zip and jq, all present on GitHub's hosted runners. Exits non-zero when
# the platform refuses the site; the refusal lists what to fix.
set -euo pipefail

FOLDER="${1:-dist}"
LW_URL="${LW_URL:-https://app.lernerworksplatform.dev}"
LW_URL="${LW_URL%/}"
: "${LW_DEPLOY_TOKEN:?LW_DEPLOY_TOKEN is not set; create a deploy token on the site's Upload page and add it as a repository secret.}"
for tool in curl zip jq; do command -v "$tool" >/dev/null 2>&1 || { echo "deploy.sh: $tool is required" >&2; exit 2; }; done
[ -f "$FOLDER/index.html" ] || { echo "deploy.sh: no index.html in $FOLDER; build the site first, or name the output folder as the first argument." >&2; exit 2; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
( cd "$FOLDER" && zip -qr -X "$work/site.zip" . )
size="$(wc -c < "$work/site.zip" | tr -d ' ')"
auth=(-H "Authorization: Bearer $LW_DEPLOY_TOKEN")

begin="$(curl -fsS -X POST "$LW_URL/api/deploy/begin" "${auth[@]}" -H "Content-Type: application/json" -d "{\"filename\":\"site.zip\",\"size\":$size}")" \
  || { echo "deploy.sh: the platform refused to start the deploy (is the token right?)" >&2; exit 1; }
session="$(echo "$begin" | jq -r .session)"
part_bytes="$(echo "$begin" | jq -r .partBytes)"
parts="$(echo "$begin" | jq -r .parts)"
[ -n "$session" ] && [ "$session" != "null" ] || { echo "deploy.sh: unexpected answer: $begin" >&2; exit 1; }

( cd "$work" && split -b "$part_bytes" -d -a 5 site.zip part- )
i=0
for f in "$work"/part-*; do
  attempt=0
  until curl -fsS -X PUT "$LW_URL/api/deploy/part?session=$session&index=$i" "${auth[@]}" -H "Content-Type: application/octet-stream" --data-binary @"$f" > /dev/null; do
    attempt=$((attempt + 1))
    [ "$attempt" -lt 3 ] || { echo "deploy.sh: part $((i + 1)) of $parts was not accepted" >&2; exit 1; }
    sleep $((attempt * 2))
  done
  i=$((i + 1))
done
echo "deploy.sh: sent $i part(s), $size bytes"

payload="$(jq -n --arg s "$session" --arg c "${GITHUB_SHA:-}" --arg r "${GITHUB_REF_NAME:-}" --arg root "${LW_ROOT:-}" '{session: $s, commit: $c, ref: $r, root: $root}')"
result="$(curl -sS -X POST "$LW_URL/api/deploy/complete" "${auth[@]}" -H "Content-Type: application/json" -d "$payload")"
if [ "$(echo "$result" | jq -r .ok)" = "true" ]; then
  echo "deploy.sh: published release v$(echo "$result" | jq -r .version) ($(echo "$result" | jq -r .files) files)"
  preview="$(echo "$result" | jq -r '.preview // empty')"
  [ -n "$preview" ] && echo "deploy.sh: preview $preview"
  exit 0
fi
echo "deploy.sh: not published: $(echo "$result" | jq -r '.error // "unknown error"')" >&2
echo "$result" | jq -r '.errors[]? | "  - " + .' >&2
exit 1
