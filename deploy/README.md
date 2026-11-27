# Host your own copy

The production build is static, so a small Linux server can host it behind Caddy.

## What you need

- A Linux server with Caddy, Git and Node.js 22
- A domain whose DNS points to the server
- SSH access for a login user that can use `sudo`

## First setup

From PowerShell in the repository root, give the script an SSH target and run:

```powershell
.\deploy\deploy.ps1 -Vps user@host -FirstTime
```

The script clones into `/srv/thenext100/repo`, builds `/srv/thenext100/site`, adds
the Caddy block, and enables `thenext100-update.timer`. Every 10 minutes the timer
runs `deploy/update.sh`, which fetches `main`, builds it and swaps the site directory.

## Set the target

The script reads the first available target in this order:

```powershell
.\deploy\deploy.ps1 -Vps user@host
$env:NEXT100_VPS = "user@host"; .\deploy\deploy.ps1
"user@host" | Set-Content deploy\vps.local; .\deploy\deploy.ps1
```

`deploy/vps.local` is ignored by Git. With a configured target, add `-FirstTime`
only for the initial server setup; later runs force an immediate rebuild.

## Use another domain

Replace the domain in `deploy/thenext100.caddy`, the meta tags in `index.html`,
and the public links in `README.md` before the first setup.

## Roll back

`deploy/update.sh` keeps the previous complete deployment as
`/srv/thenext100/site.old`. On the server, stop the timer and swap it back:

```bash
sudo systemctl stop thenext100-update.timer
mv /srv/thenext100/site /srv/thenext100/site.failed
mv /srv/thenext100/site.old /srv/thenext100/site
```

Revert or fix `main` before running `sudo systemctl start thenext100-update.timer`.
