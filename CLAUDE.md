# The Next 100 — working notes for Claude

A living, self-grading forecast of 2026–2200. Public site at https://thenext100.duckdns.org, source at github.com/GrimFandango42/the-next-100. The project is run by the maintainer.

## Shape of the repo
- `data/*.json` — the forecast itself. Validated by `src/schema.ts` (zod) and `scripts/validate.ts`. This is what check-ins edit.
- `src/` — Vite + React + TypeScript + D3. Three views under `components/TopBar.tsx`, routed by hash in `route.ts`: `ThisWeek.tsx` (latest check-in, what changed since the last visit, market gaps that moved, what comes due), `OddsView.tsx` (every line in one sortable table with sparklines) and the book; their selectors are pure functions in `views.ts`. `components/StoryJourney.tsx` is the book: native scroll, one page per prediction, chapter pages, one reader strip with an Overview (the whole century on one screen). `Figure.tsx` draws one data figure per prediction (stripes, field of 100, curve with reference line, clock, orbits, milestone ladder). `store.tsx` holds year / branch / selection; `WorldState.tsx` the metric explorer; `Sections.tsx` the evidence section below the book. Styles: `styles.css` (tokens, evidence) + `story.css` (the book).
- `public/moments/<event-id>.webp` — optional artwork shown behind a moment's figure; `scripts/make-art.mjs` can generate it (needs OPENAI_API_KEY on the desktop; never commit keys).
- `scripts/` — validator, check-in brief, check-in logger.
- `deploy/` — Caddy site block, `deploy.ps1` (run from the Windows desktop) and the pull-and-build timer for the VPS.
- `CHECKIN.md` — the weekly check-in protocol. `/checkin` skill runs it. `SOURCES.md` is the source registry.
- `README.md` (public front door), `CONTRIBUTING.md` (rules for humans), `ONBOARDING.md` (brief for agents), `docs/ROADMAP.md` (what's next, by track), `docs/data-model.md`, `docs/architecture.md`, `docs/reviews/` (past outside reviews). `.github/` has issue templates, a PR template and `workflows/ci.yml` (build, evidence, book and deploy checks on pushes and PRs).

## Commands
- `npm run dev` · `npm run build` (validates + typechecks + builds) · `npm run validate` · `npm run checkin:brief` · `npm run checkin:log -- …`

## Conventions
- Every forecast edit gets a `history` entry (with `from`/`to` when a probability moves); every check-in gets a `changelog` entry. Each line carries `timing` (around / by / window / through) and, where it has one, a `resolution.test` that says what counts. The validator enforces tiers (high ≥ .70, moderate .45–.70, speculative < .45) and that scenarios sum to 100.
- Event ids are kebab-case and permanent; `leadsTo` and `changelog.touched` reference them.
- Colors and fonts are tokens in `src/styles.css`; domain colors live in `src/schema.ts` (`DOMAIN_META`).
- Keep the forecast's voice: plain, specific, no hedging filler. Titles are the plain-language claim; the test carries the precision — don't retitle to match tests.
- Scoring is two numbers (founding and strict), defined in `CHECKIN.md`; change the policy there before the code.
- Three views, one drawer: **This week** (`#week`), **Odds** (`#odds`) and **The book** (`#book`), switched only from the top bar; `#line-<id>` opens Odds with that line's drawer. Every line has one drawer, shared by all three. Inside the book: scroll reads, the strip shows where you are, Overview zooms out. No other navigation modes.
- A page is light: claim, one sentence, odds, figure, three linked lines, a collapsed "What counts". Everything else (full test, all links with kinds, revisions, probability history) lives in the drawer. Figures carry one caption, no boilerplate, no disclaimers — the method says once what the figures are.
- Deploys happen by pushing to `main`; the VPS pulls and rebuilds every 10 minutes (`deploy/update.sh`). Never deploy by hand-copying files.

## On the VPS
- The site is static files behind Caddy on a small Linux server. A systemd timer pulls `main`, builds and swaps the site every 10 minutes.
- Checkout `/srv/thenext100/repo`, site root `/srv/thenext100/site`, timer `thenext100-update.timer`, log `/srv/thenext100/update.log`.
- The server's address and login are not in this repository.
- `systemctl reload caddy` has hung before; use `sudo caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.
