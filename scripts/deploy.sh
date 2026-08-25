#!/usr/bin/env bash
#
# One-shot deploy to Vercel.
#
# Creates (or reuses) the Vercel project, sets every environment variable the app
# needs, and deploys to production. Everything except the database URL is already
# decided, so the only thing to have ready is that one string.
#
#   bash scripts/deploy.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }
die()  { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------- prerequisites
if ! command -v vercel >/dev/null 2>&1; then
  bold "Installing the Vercel CLI…"
  npm install -g vercel >/dev/null 2>&1 || die "Could not install the Vercel CLI. Try: npm install -g vercel"
fi

bold "Signing in to Vercel (a browser window will open if you are not already signed in)…"
vercel whoami >/dev/null 2>&1 || vercel login

# ---------------------------------------------------------------- the one input
cat <<'NOTE'

────────────────────────────────────────────────────────────────────────
The database connection string is the only thing this script cannot work
out for itself. To get it:

  1. https://supabase.com/dashboard/project/upytbfoyglzztfmykahb
  2. Settings → Database → Reset database password  (copy what it shows)
  3. The Connect button at the top → Transaction pooler
  4. Copy that string and put your password where [YOUR-PASSWORD] is

It must be the TRANSACTION POOLER string, on port 6543. The direct
connection on 5432 runs out of connections under serverless.
────────────────────────────────────────────────────────────────────────

NOTE

read -rp "DATABASE_URL: " DATABASE_URL
[ -n "${DATABASE_URL}" ] || die "Nothing entered. Run the script again once you have the string."
case "$DATABASE_URL" in
  postgres://*|postgresql://*) ;;
  *) die "That does not look like a Postgres URL — it should start with postgresql://" ;;
esac
case "$DATABASE_URL" in
  *:6543/*) ;;
  *) warn "Warning: that is not port 6543, so it is probably the direct connection rather than the transaction pooler. Serverless will run out of connections. Continuing anyway." ;;
esac
case "$DATABASE_URL" in
  *YOUR-PASSWORD*|*\[*\]*) die "The password placeholder is still in the string. Replace [YOUR-PASSWORD] with the real password." ;;
esac

# ---------------------------------------------------------------- project setup
bold "Linking the Vercel project…"
vercel link --yes >/dev/null

# ---------------------------------------------------------------- env variables
PRD_USERNAME="admin"
PRD_PASSWORD="jgrx9-z4ye9-25pm4-jvud9"
PRD_SESSION_SECRET="fffb668297919af6c926938852fcd02ba95f3dac8b2a2e3754a6d82c2d5bf912"

set_env() {
  local name="$1" value="$2" target
  for target in production preview; do
    # Remove first so a re-run updates rather than erroring on a duplicate.
    vercel env rm "$name" "$target" --yes >/dev/null 2>&1 || true
    printf '%s' "$value" | vercel env add "$name" "$target" >/dev/null
  done
  echo "  set $name"
}

bold "Setting environment variables…"
set_env DATABASE_URL "$DATABASE_URL"
set_env PRD_USERNAME "$PRD_USERNAME"
set_env PRD_PASSWORD "$PRD_PASSWORD"
set_env PRD_SESSION_SECRET "$PRD_SESSION_SECRET"
set_env PUPPETEER_SKIP_DOWNLOAD "1"

# ---------------------------------------------------------------- deploy
bold "Deploying to production. The first build takes a few minutes…"
URL=$(vercel deploy --prod --yes)

cat <<EOF

────────────────────────────────────────────────────────────────────────
 Deployed.

   $URL

   Username: $PRD_USERNAME
   Password: $PRD_PASSWORD

 Open it, sign in, create a PRD, and try Export PDF — that is the one
 part that behaves differently hosted than it does locally.

 If the PDF export fails:  vercel logs $URL
────────────────────────────────────────────────────────────────────────

EOF
