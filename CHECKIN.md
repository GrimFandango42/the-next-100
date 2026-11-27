# The weekly check-in

The forecast is a set of data files. A check-in is a disciplined edit of those files, with every change explained and sourced. It runs weekly (Mondays) as a scheduled Claude task, and anyone can run it by hand with `/checkin` in Claude Code from the repo root.

## Principles

1. **Grade before you revise.** A line whose window has closed gets a status (`happened`, `partial`, `early`, `late`, `missed`, `retired`) before anything else is touched. The validator refuses a build where a closed window is still `forecast`.
2. **Change the probability, not the story, unless the story broke.** Most weeks move a `probability` by a few points or a `reading` on an indicator. Rewriting `detail` is rare and must say why in `history`.
3. **Never silently rewrite.** Every edit to an event appends a `history` entry (`date`, `change`, `reason`, `sources`). Every check-in appends one `changelog` entry, even when nothing moved ("no change" is a finding).
4. **Sources are URLs you actually opened.** A search snippet is not a source. No source, no change.
5. **Keep the tiers honest.** `confidence` must match `probability`: high ≥ 0.70, moderate 0.45–0.70, speculative < 0.45. Moving one moves the other; the validator checks.
6. **Dates don't drift without a reason.** Changing `year` or `yearEnd` is a revision like any other, logged in `history`. The original window is recoverable from history, which is how the forecast gets graded later.
7. **Scenarios sum to 100.** Both branches and the unconditional column.
8. **The forecast's voice stays the forecast's.** Edits are written in the same register as the original lines: plain, specific, no hedging filler.
9. **Sources are judged, not just collected.** `SOURCES.md` is the registry (what to open per domain and metric, tiers, what to avoid) and its last section is the rules: one primary or it did not happen; a vendor claim moves a line by at most two points and says so; resolving a line needs two independent primaries; cite datasets by edition; for bot-blocked hosts use the registry's alternate route or leave it for the desktop run. Every check-in evaluates the sources it used, and the changelog body says when a source was weak.

## Steps

```
git pull
npm ci
npm run checkin:brief          # what is due, what to search, where the needles sit
# research: open the registry sources (SOURCES.md) first, then the standing queries + each live line's signals; read, don't skim
# edit data/*.json accordingly (see "What can change" below)
npm run markets:pull           # after the research: today's price of each matched prediction market → data/market-history/ (see "Prediction markets")
npm run checkin:log -- --headline "…" --body "…" --touched id,id --sources url,url
npm run sources:check -- --write   # quarterly, from the desktop: per-source status (ok / moved / blocked / dead), never a publisher ban
npm run validate               # must pass
npm run build                  # must pass
git add -A && git commit -m "checkin: YYYY-MM-DD — <one line>" && git push
```

The VPS pulls `main` every 10 minutes and rebuilds, so a push is a deploy.

## Prediction markets

Some lines have a public Kalshi or Polymarket market that asks a nearby question. `data/markets.json` lists the matches (one primary per line at most, with `differs` saying how the market's question is not the line's test). The pull is read-only and needs no key.

1. Run `npm run markets:pull` after the research and **before** `checkin:log`, so the vintage the logger writes freezes today's primary prices. It appends one price per market per UTC day to `data/market-history/YYYY-MM.json`, never rewrites a day already stored, and prints one `PRICE` line per primary link. Read any `WARN`: a day with no usable price is skipped, not filled in. `--dry-run` prints without writing.
2. When a primary market has moved **more than 10 points in the week**, find out why before deciding whether the line moves: open the market page, read the news behind the move, and check whether the market's question (see `differs`) is even the one that moved. A thin market (see `liquidity` in the history rows) can jump on one trade.
3. A market price is evidence like any other source. It **never moves a line by itself**, and a line is never set to match a market. If it does inform an edit, say so in the `history` reason and cite the market page in `sources` (add it to `citations.json` like any other URL).
4. A market that resolves is recorded on its link (`resolved: {on, outcome}`) and no longer pulled. That is the market's result, not the line's grade.
5. Once a quarter, look for lines with no link and propose matches in `data/markets.json` (`primary: false` until a human has read the market's resolution rules; label it from the market's own title; write `differs`). The candidate finder (`markets:find`) is a separate, later order; until it lands, search both venues by hand.

## What can change, and where

| File | Typical weekly edit | Rare edit |
| --- | --- | --- |
| `data/events.json` | `probability` (and `confidence` if it crosses a tier), `status` + `resolvedOn` when a window closes, a `history` entry per edit | `year`/`yearEnd`, `summary`/`detail`, a new event (append; give it `history` with `change: "added"`) |
| `data/indicators.json` | `reading` (−1…+1), `lastChecked`, `note` | wording of the two readings |
| `data/metrics.json` | append to `observed` when a real figure is published (UN population, Copernicus temperature, etc.) | reshape `keyframes` when observed data clearly diverges from the path |
| `data/clock.json` | `byBranch` first keyframe when the Bulletin resets the clock (January) | notes |
| `data/scenarios.json` | a few points between scenarios when the hinge evidence moves | — |
| `data/meta.json` | `lastCheckin` (the log script does this), `hinge.pluralismProbability` when indicators move in aggregate | forces, caveat |
| `data/changelog.json` | one entry per check-in (the log script does this) | — |
| `data/eras.json` | — | names and theses only if an era's character has clearly changed |
| `data/sources.json` + `SOURCES.md` | — | quarterly: `npm run sources:check -- --write`, then replace moved or dead sources, demote ones that failed twice, add a source a line needed and lacked |
| `data/citations.json` | add an entry (title, publisher, date, tier) for every new URL cited in `history` or `changelog` | — |
| `data/vintages/` | written automatically by `checkin:log`; never edited | — |
| `data/market-history/` | appended by `markets:pull`; existing rows are never edited | — |
| `data/markets.json` | `markets:pull` records `resolved` on a link that settles | quarterly: add or re-judge a link (never changes a line's probability) |

## Scoring

Two scores, both shown, neither optional. The **founding** score grades a resolved line against the probability in the earliest frozen vintage that holds the same claim (same title and window); if the test was reworded after that vintage the score stands and the rewording is a caveat. The **strict** score grades only an explicit adjudication (outcome, rationale, sources) against a vintage whose test, version, window, timing and branch are identical. Narrative scenarios, partial and retired lines are never scored. `npm run score` prints both. Do not change this policy in a UI or scripts commit; it is a forecast-method decision and changes here first.

Titles are the claim in plain words; `resolution.test` carries the precision. Do not retitle a line to mirror its test.

## Grading rules

- `happened`: the thing in the title occurred within the window (`year` to `yearEnd`, or `year` ± 1 when there is no `yearEnd`).
- `early` / `late`: occurred outside the window by more than a year; `resolvedOn` is when it occurred.
- `partial`: a clear fraction of the claim is true (name the fraction in the history entry).
- `missed`: the window plus one year closed and it has not happened.
- `retired`: the framing stopped making sense (say why); never used to hide a miss.

## What a good changelog entry looks like

> **2026-11-02 · checkin** — Open-weight gap narrowed; cyberattack line nudged up.
> Two open-weight releases this week landed within ~8 months of frontier capability on public evals; moved `open-weights-gap` reading from +0.3 to +0.4. CISA's advisory on autonomous intrusion tooling is the first official use of the phrase; `ai-cyberattack-infrastructure` 0.70 → 0.72. No lines resolved. Sources: [1] [2] [3].

## Scope guard

A check-in edits `data/` only. UI, scripts and deploy files are changed in ordinary development sessions, by Nithin or by Claude when asked.
