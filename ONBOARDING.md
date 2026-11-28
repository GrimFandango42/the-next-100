# Working on The Next 100 — brief for any AI model or collaborator

You are working on **The Next 100**, a public, self-grading forecast of 2026–2200. It is run by the maintainer. Live site: https://thenext100.duckdns.org · Source: https://github.com/GrimFandango42/the-next-100 (public). Read `CLAUDE.md` (repo map and conventions), `CONTRIBUTING.md` (the rules) and `CHECKIN.md` (how the forecast is edited) before changing anything; `docs/data-model.md` explains every field and `docs/architecture.md` how the site is put together.

## What it is
- `data/*.json` **is the forecast**: 55 dated predictions (`events.json`), eras, metrics with keyframes to 2200, leading indicators, scenario odds, the Doomsday Clock path, and a changelog. Everything on the site is drawn from these files.
- `src/` is a Vite + React + TypeScript + D3 site with three views under one top bar (`components/TopBar.tsx`, routes in `route.ts`): **This week** (`ThisWeek.tsx`: the latest check-in, what moved or resolved since the reader's last visit, market gaps that moved, what comes due), **Odds** (`OddsView.tsx`: every line in one sortable, filterable table with a sparkline) and **the book**. The selectors behind the first two are pure functions in `views.ts`. `components/StoryJourney.tsx` is the book: native scroll, one page per prediction, chapter pages, one reader strip with an Overview that shows the whole century; `Figure.tsx` draws one data figure per prediction from `data/`; the evidence section below the book (`WorldState`, `Sections`) shows the numbers, odds, indicators, track record and method.
- `scripts/` holds the validator and the check-in tooling; `qa/` holds headless Playwright checks; `deploy/` holds the VPS setup.

## Access
- **Code:** clone the GitHub repo. The maintainer grants push access per account; if you don't have it, open a PR.
- **Deploy:** pushing to `main` *is* the deploy. A timer on the VPS pulls, builds and swaps the site every 10 minutes. Nobody deploys by hand and nothing else writes to the server. A push is live in ~3–6 minutes; check with `curl -s https://thenext100.duckdns.org/ | grep -o 'index-[A-Za-z0-9_-]*\.js'` against `dist/assets/` after a local build.
- **Server:** the server is reachable only by the maintainer. You should not need it.
- **No secrets exist in the repo and none may be added.** The art generator (`scripts/make-art.mjs`) reads `OPENAI_API_KEY` from the environment only.

## Run it
```
npm ci
npm run dev            # local dev server
npm run build          # validates data + typechecks + builds; must pass before any push
npm run checkin:brief  # what the weekly check-in should look at
```
QA (expected for UI changes): `npm run qa:book`, then `npm i -D playwright`, `npx vite preview --port 4174 &` and run `node qa/book.mjs` and `node qa/overflow.mjs http://localhost:4174/`. A clean run reports no overlaps, nothing off-screen and no console errors on desktop and iPhone 13. See `qa/README.md`.

## Rules that are not negotiable
1. **Forecast edits follow `CHECKIN.md`.** Every change to an event appends a `history` entry (`date`, `change`, `reason`, `sources`); every check-in appends a `changelog` entry. **No source, no change** — a URL you actually opened, not a search snippet. Grade a line whose window has closed before touching anything else. Never rewrite or delete history.
2. The validator enforces: confidence tiers (high ≥ .70, moderate .45–.70, speculative < .45), scenarios sum to 100, resolved lines carry `resolvedOn`, no dangling `leadsTo`, eras join. Fix data, don't weaken the validator.
3. Event ids are kebab-case and permanent. `leadsTo` and `changelog.touched` reference them.
4. Keep the forecast's voice: plain, specific, no hedging filler. Keep 2-space JSON formatting.
5. UI: three views and nothing else — **This week**, **Odds** and **The book**, one tap apart in the top bar, each with a hash route (`#week`, `#odds`, `#book`; `#line-<id>` opens Odds with that line's drawer; old `#story-<id>` links open the book). Every line has one drawer, the same from every view. Inside the book, scroll reads, the reader strip shows where you are and its chapters, and Overview (or the − key) shows the whole century. Don't add a fourth view, autoplay, sound, page-turn links, extra menus, or any other navigation mode. Figures are drawn from `data/`; decorative illustration that carries no information is out. Mobile is first-class: no horizontal overflow, nothing overlapping, one idea per screen.
6. Commit messages: a short imperative headline, a body that says why. Push to `main` only when `npm run build` passes and the QA scripts are clean.

## What's wanted
Reviews and improvements in this order: (a) is the forecast right — challenge dates, probabilities, framing, and missing lines, with sources; (b) is the presentation clear and genuinely visual on a phone; (c) code quality. Open GitHub issues for anything you don't fix. The backlog lives in GitHub issues.
