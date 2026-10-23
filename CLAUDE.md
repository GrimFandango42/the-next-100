# The Next 100 — working notes for Claude

A living, self-grading forecast of 2026–2200. Public site at https://thenext100.duckdns.org, source at github.com/GrimFandango42/the-next-100. Owner: Nithin.

## Shape of the repo
- `data/*.json` — the forecast itself. Validated by `src/schema.ts` (zod) and `scripts/validate.ts`. This is what check-ins edit.
- `src/` — Vite + React + TypeScript + D3. `store.tsx` holds year / branch / filters / selection; `components/Timeline.tsx` is the zoomable timeline; `WorldState.tsx` the metric tiles + explorer; `Sections.tsx` the rest.
- `scripts/` — validator, check-in brief, check-in logger.
- `deploy/` — Caddy site block, `deploy.ps1` (run from the Windows desktop) and the pull-and-build timer for the VPS.
- `CHECKIN.md` — the weekly check-in protocol. `/checkin` skill runs it.

## Commands
- `npm run dev` · `npm run build` (validates + typechecks + builds) · `npm run validate` · `npm run checkin:brief` · `npm run checkin:log -- …`

## Conventions
- Every forecast edit gets a `history` entry; every check-in gets a `changelog` entry. The validator enforces tiers (high ≥ .70, moderate .45–.70, speculative < .45) and that scenarios sum to 100.
- Event ids are kebab-case and permanent; `leadsTo` and `changelog.touched` reference them.
- Colors and fonts are tokens in `src/styles.css`; domain colors live in `src/schema.ts` (`DOMAIN_META`).
- Keep the forecast's voice: plain, specific, no hedging filler.
- Deploys happen by pushing to `main`; the VPS pulls and rebuilds every 10 minutes (`deploy/update.sh`). Never deploy by hand-copying files.

## On the VPS
- Hetzner Ubuntu box at 5.161.210.111, user `nithin`. Caddy serves every site (acl26, ajntrip, indianrummy, thenext100). Reach it from the Windows desktop over SSH; cloud sessions cannot reach it, so they push to GitHub and the VPS pulls.
- Checkout `/srv/thenext100/repo`, site root `/srv/thenext100/site`, Caddy block `thenext100.duckdns.org`, timer `thenext100-update.timer`, log `/srv/thenext100/update.log`.
- `systemctl reload caddy` has hung before; use `sudo caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.
