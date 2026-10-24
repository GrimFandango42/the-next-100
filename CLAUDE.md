# The Next 100 — working notes for Claude

A living, self-grading forecast of 2026–2200. Public site at https://thenext100.duckdns.org, source at github.com/GrimFandango42/the-next-100. Owner: Nithin.

## Shape of the repo
- `data/*.json` — the forecast itself. Validated by `src/schema.ts` (zod) and `scripts/validate.ts`. This is what check-ins edit.
- `src/` — Vite + React + TypeScript + D3. `components/StoryJourney.tsx` is the book: native scroll, one page per prediction, chapter pages, one reader strip with an Overview (the whole century on one screen). `Figure.tsx` draws one data figure per prediction (stripes, field of 100, curve with reference line, clock, orbits, milestone ladder). `store.tsx` holds year / branch / selection; `WorldState.tsx` the metric explorer; `Sections.tsx` the evidence section below the book. Styles: `styles.css` (tokens, evidence) + `story.css` (the book).
- `public/moments/<event-id>.webp` — optional artwork shown behind a moment's figure; `scripts/make-art.mjs` can generate it (needs OPENAI_API_KEY on the desktop; never commit keys).
- `scripts/` — validator, check-in brief, check-in logger.
- `deploy/` — Caddy site block, `deploy.ps1` (run from the Windows desktop) and the pull-and-build timer for the VPS.
- `CHECKIN.md` — the weekly check-in protocol. `/checkin` skill runs it. `SOURCES.md` is the source registry.
- `README.md` (public front door), `CONTRIBUTING.md` (rules for humans), `ONBOARDING.md` (brief for agents), `docs/data-model.md`, `docs/architecture.md`, `docs/reviews/` (past outside reviews). `.github/` has issue templates, a PR template and `ci.yml` (move it to `.github/workflows/` from the desktop to enable; cloud sessions can't push workflow files).

## Commands
- `npm run dev` · `npm run build` (validates + typechecks + builds) · `npm run validate` · `npm run checkin:brief` · `npm run checkin:log -- …`

## Conventions
- Every forecast edit gets a `history` entry (with `from`/`to` when a probability moves); every check-in gets a `changelog` entry. Each line carries `timing` (around / by / window / through) and, where it has one, a `resolution.test` that says what counts. The validator enforces tiers (high ≥ .70, moderate .45–.70, speculative < .45) and that scenarios sum to 100.
- Event ids are kebab-case and permanent; `leadsTo` and `changelog.touched` reference them.
- Colors and fonts are tokens in `src/styles.css`; domain colors live in `src/schema.ts` (`DOMAIN_META`).
- Keep the forecast's voice: plain, specific, no hedging filler.
- One navigation model: scroll reads, the strip shows where you are, Overview zooms out. Don't add a second way to move.
- Deploys happen by pushing to `main`; the VPS pulls and rebuilds every 10 minutes (`deploy/update.sh`). Never deploy by hand-copying files.

## On the VPS
- Hetzner Ubuntu box at 5.161.210.111, user `nithin`. Caddy serves every site (acl26, ajntrip, indianrummy, thenext100). Reach it from the Windows desktop over SSH; cloud sessions cannot reach it, so they push to GitHub and the VPS pulls.
- Checkout `/srv/thenext100/repo`, site root `/srv/thenext100/site`, Caddy block `thenext100.duckdns.org`, timer `thenext100-update.timer`, log `/srv/thenext100/update.log`.
- `systemctl reload caddy` has hung before; use `sudo caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.
