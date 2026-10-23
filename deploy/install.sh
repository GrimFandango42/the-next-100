#!/usr/bin/env bash
# One-time install on the Hetzner VPS (Ubuntu). Run as root (sudo -i), from anywhere:
#   curl -fsSL https://raw.githubusercontent.com/GrimFandango42/the-next-100/main/deploy/install.sh | bash
# Idempotent: re-running updates the unit files and nginx config and redeploys.
set -euo pipefail

DOMAIN=thenext100.duckdns.org
REPO_URL=https://github.com/GrimFandango42/the-next-100.git
REPO=/srv/the-next-100
WEB=/var/www/thenext100

echo "== packages"
apt-get update -qq
apt-get install -y -qq git nginx curl ca-certificates >/dev/null
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "node $(node -v), npm $(npm -v)"

echo "== checkout"
if [[ ! -d "$REPO/.git" ]]; then
  git clone -q "$REPO_URL" "$REPO"
fi
chown -R www-data:www-data "$REPO"
chmod +x "$REPO/deploy/update.sh"
mkdir -p "$WEB" && chown www-data:www-data "$WEB"
touch /var/log/thenext100-update.log && chown www-data:www-data /var/log/thenext100-update.log
# npm cache for www-data
mkdir -p /var/www/.npm && chown -R www-data:www-data /var/www/.npm

echo "== first build"
sudo -u www-data FORCE=1 HOME=/var/www "$REPO/deploy/update.sh"

echo "== nginx"
cp "$REPO/deploy/nginx.conf" /etc/nginx/sites-available/thenext100
ln -sf /etc/nginx/sites-available/thenext100 /etc/nginx/sites-enabled/thenext100
nginx -t && systemctl reload nginx

echo "== auto-update timer"
cp "$REPO/deploy/thenext100-update.service" /etc/systemd/system/
cp "$REPO/deploy/thenext100-update.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now thenext100-update.timer

echo
echo "Site is live over HTTP at http://$DOMAIN once DuckDNS points here."
echo "For HTTPS run:  apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d $DOMAIN --redirect -m you@example.com --agree-tos -n"
echo "Rollback: systemctl disable --now thenext100-update.timer; rm /etc/nginx/sites-enabled/thenext100; systemctl reload nginx"
