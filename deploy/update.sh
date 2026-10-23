#!/usr/bin/env bash
# Pull main, rebuild if it changed, swap the site root atomically. Safe to run every 10 minutes.
set -euo pipefail
REPO=/srv/the-next-100
WEB=/var/www/thenext100
LOG=/var/log/thenext100-update.log

cd "$REPO"
before=$(git rev-parse HEAD)
git fetch -q origin main
after=$(git rev-parse origin/main)
if [[ "$before" == "$after" && -f "$WEB/index.html" && "${FORCE:-0}" != "1" ]]; then
  exit 0
fi

echo "[$(date -Is)] updating $before -> $after" >> "$LOG"
git reset -q --hard origin/main
npm ci --no-audit --no-fund --silent
npm run build >> "$LOG" 2>&1

# atomic swap: build into a sibling dir, then rename
tmp="${WEB}.new"
rm -rf "$tmp"
cp -r dist "$tmp"
if [[ -d "$WEB" ]]; then mv "$WEB" "${WEB}.old"; fi
mv "$tmp" "$WEB"
rm -rf "${WEB}.old"
echo "[$(date -Is)] deployed $after" >> "$LOG"
