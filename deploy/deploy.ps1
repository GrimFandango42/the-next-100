# Deploy The Next 100 from a Windows desktop.
#   .\deploy\deploy.ps1 -FirstTime   # one-time: clone on VPS, Caddy block, auto-update timer
#   .\deploy\deploy.ps1              # force an immediate rebuild (normally the timer does this)
param([string]$Vps, [switch]$FirstTime)
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Vps)) {
  $Vps = $env:NEXT100_VPS
}
if ([string]::IsNullOrWhiteSpace($Vps)) {
  $targetFile = Join-Path $PSScriptRoot "vps.local"
  if (Test-Path -LiteralPath $targetFile) {
    $Vps = Get-Content -LiteralPath $targetFile | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1
  }
}
if ([string]::IsNullOrWhiteSpace($Vps)) {
  Write-Host "Missing VPS target: use -Vps, NEXT100_VPS, or deploy/vps.local."
  exit 1
}
$Vps = $Vps.Trim()

Set-Location (Split-Path $PSScriptRoot -Parent)
if ($FirstTime) {
  scp deploy/thenext100.caddy deploy/thenext100-update.service deploy/thenext100-update.timer "$($Vps):/tmp/"
  $remote = @'
set -e
command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs; }
deploy_user=$(id -un)
deploy_group=$(id -gn)
sudo mkdir -p /srv/thenext100 && sudo chown "$deploy_user:$deploy_group" /srv/thenext100
[ -d /srv/thenext100/repo/.git ] || git clone -q https://github.com/GrimFandango42/the-next-100.git /srv/thenext100/repo
chmod +x /srv/thenext100/repo/deploy/update.sh
FORCE=1 /srv/thenext100/repo/deploy/update.sh
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-thenext100-$(date -u +%Y%m%dT%H%M%SZ)
grep -q '^thenext100.duckdns.org {' /etc/caddy/Caddyfile || { echo; cat /tmp/thenext100.caddy; } | sudo tee -a /etc/caddy/Caddyfile >/dev/null
sudo touch /var/log/caddy/thenext100.log && sudo chown caddy:caddy /var/log/caddy/thenext100.log
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
sudo caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
sed -i "s/__DEPLOY_USER__/$deploy_user/g" /tmp/thenext100-update.service
sudo mv /tmp/thenext100-update.service /tmp/thenext100-update.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now thenext100-update.timer
sleep 15; curl -s -m 10 -o /dev/null -w "thenext100:%{http_code}\n" https://thenext100.duckdns.org/
'@
} else {
  $remote = "FORCE=1 /srv/thenext100/repo/deploy/update.sh && curl -s -o /dev/null -w 'thenext100:%{http_code}\n' https://thenext100.duckdns.org/"
}
$remote | ssh $Vps "tr -d '\r' | bash -s"
