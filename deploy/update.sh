#!/usr/bin/env bash
# Runs on the VPS every 10 minutes (systemd timer). Pulls main from the public repo;
# if it changed, builds and swaps the site atomically. Read-only access to GitHub; no secrets.
set -euo pipefail
REPO=${REPO:-/srv/thenext100/repo}
SITE=${SITE:-/srv/thenext100/site}
LOG=${LOG:-/srv/thenext100/update.log}
cd "$REPO"
git fetch -q origin main
TARGET=$(git rev-parse origin/main)
if [[ "$(cat "$SITE/deployed-commit.txt" 2>/dev/null || true)" == "$TARGET" && -f "$SITE/index.html" && "${FORCE:-0}" != "1" ]]; then exit 0; fi
echo "[$(date -Is)] $(git rev-parse --short HEAD) -> $(git rev-parse --short origin/main)" >> "$LOG"
git reset -q --hard origin/main
npm ci --no-audit --no-fund --silent
npm run build >> "$LOG" 2>&1
rm -rf "$SITE.new"
cp -r dist "$SITE.new"
test -s "$SITE.new/index.html"
printf '%s\n' "$TARGET" > "$SITE.new/deployed-commit.txt"
# Recover if a previous process stopped between the two directory renames.
if [[ ! -d "$SITE" && -d "$SITE.old" ]]; then mv "$SITE.old" "$SITE"; fi
rm -rf "$SITE.old"
[[ -d "$SITE" ]] && mv "$SITE" "$SITE.old"
if ! mv "$SITE.new" "$SITE"; then
  [[ -d "$SITE.old" ]] && mv "$SITE.old" "$SITE"
  exit 1
fi
# Keep one complete deployment for manual rollback.
echo "[$(date -Is)] deployed $(git rev-parse --short HEAD)" >> "$LOG"
