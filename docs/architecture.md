# Architecture

One static site, one data folder, one deploy path. No backend, no database, no accounts.

```mermaid
flowchart TB
    subgraph browser["In the browser"]
        store[store.tsx<br/>year · branch · selected] --> book
        store --> evidence
        book[StoryJourney.tsx<br/>the book: cover, chapters, pages, fork, board] --> figure[Figure.tsx<br/>stripes · field · curve · clock · orbits · ladder · bars]
        book --> exhibit[Exhibit.tsx + ExhibitLabs.tsx<br/>stage explainers for six topics]
        book --> drawer[EventDrawer.tsx<br/>'Why this forecast?': reasoning, what counts, signals, history with citations]
        evidence[Sections.tsx · WorldState.tsx · Clock.tsx<br/>metrics, odds, indicators, track record, changelog, method]
    end
    data[(data/*.json)] -->|data.ts parses with zod| store
    subgraph build["npm run build"]
        validate[scripts/validate.ts] --> tsc --> vite
    end
    data --> validate
    vite --> dist[dist/]
    dist -->|git push main| timer[VPS: thenext100-update.timer<br/>every 10 min: pull · build · swap · keep one rollback]
    timer --> caddy[Caddy serves thenext100.duckdns.org]
```

## The reading model

The site has three views, one tap apart in the top bar (`TopBar.tsx`): **This week** (`ThisWeek.tsx`), **Odds** (`OddsView.tsx`) and **the book**. `route.ts` maps the hash to a view (`#week`, `#odds`, `#book`, `#line-<id>` for Odds with a drawer; `#story-`, `#chapter-`, `#m-` and the evidence anchors open the book), and the store listens to `hashchange`, so back and forward move between views. A first visit opens the book; a returning reader (one with a stored edition in `localStorage`) opens This week, which compares against the edition they last saw. All three views stay mounted and the inactive ones are `hidden`, so the book keeps its place; `App.tsx` restores each view's scroll position on return. The selectors behind This week and Odds (moves after a date, resolved lines, market-gap deltas, coming due, sort and filter) are pure functions in `views.ts`, tested in `qa/views.test.tsx`. Every line has one drawer (`EventDrawer.tsx`), shared by all three views.

Inside the book, scroll is the only way to read. The reader strip under the top bar shows where you are (chapter, year, page n of 55) and the path you're following; **Board** (or the `−` key) opens the century board (`CenturyBoard.tsx`, logic in `board.ts`): every line as a hex token, years across and domains down, six lenses (odds, momentum, crowd gap, evidence, threads, horizon), a card per line, a compare tray of up to four, and the world panel for any year on either path. There is deliberately no other navigation: no page-turn links, no tours, no autoplay. See `ONBOARDING.md` rule 5 before adding UI.

`StoryJourney` renders one `<section data-story-stop>` per cover, chapter, page and ending. An `IntersectionObserver` picks the section nearest the viewport centre and sets `active` and the store's `year`; the figures and the fork read `branch` from the store, so flipping the path on the fork page (or the pill in the strip) re-renders every branch-aware figure after it.

## Styling

`src/styles.css` holds the tokens (`:root`) and the evidence section; `src/story.css` holds the book; `src/components/exhibit.css` the explainers. Domain colours live in `src/schema.ts` (`DOMAIN_META`). Dark is the design; a light scheme exists for the evidence section only.

## Scripts

| Script | Does |
| --- | --- |
| `validate.ts` | Schema + rules: tiers, sums, ids, closed windows graded, versioned tests not silently changed. |
| `checkin-brief.ts` | What the weekly check-in should look at: due lines, live lines and their signals, indicators, metrics to refresh, registry sources, standing queries. |
| `checkin-log.ts` | Appends the changelog entry, bumps `meta.lastCheckin`, writes a vintage. |
| `vintage.ts` · `score.ts` · `scoring.ts` | Freeze and grade. |
| `sources-check.mjs` | Per-source status for the registry and citations (run from a machine with open network). |
| `make-art.mjs` | Optional artwork per line via an image model; never required. |

## Deploy

`deploy/update.sh` runs on the VPS from a systemd timer. If `origin/main` differs from the last deployed commit it pulls, `npm ci`, builds, copies `dist/` to `site.new`, swaps it in atomically and keeps the previous site as `site.old` for rollback. A failed build leaves the live site untouched. Nothing else writes to the server; there are no secrets in the repo and none on the box beyond the SSH key.
