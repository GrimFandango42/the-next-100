#!/usr/bin/env bash
# Runs on the VPS every 10 minutes (systemd timer). Pulls main from the public repo;
# if it changed, builds and swaps the site atomically. Read-only access to GitHub; no secrets.
set -euo pipefail
REPO=/srv/thenext100/repo
SITE=/srv/thenext100/site
LOG=/srv/thenext100/update.log
cd "$REPO"
git fetch -q origin main
if [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" && -f "$SITE/index.html" && "${FORCE:-0}" != "1" ]]; then exit 0; fi
echo "[$(date -Is)] $(git rev-parse --short HEAD) -> $(git rev-parse --short origin/main)" >> "$LOG"
git reset -q --hard origin/main
npm ci --no-audit --no-fund --silent
npm run build >> "$LOG" 2>&1
rm -rf "$SITE.new" && cp -r dist "$SITE.new"
[[ -d "$SITE" ]] && mv "$SITE" "$SITE.old"
mv "$SITE.new" "$SITE" && rm -rf "$SITE.old"
echo "[$(date -Is)] deployed $(git rev-parse --short HEAD)" >> "$LOG"
