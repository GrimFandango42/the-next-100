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
npm run checkin:log -- --headline "…" --body "…" --touched id,id --sources url,url
npm run validate               # must pass
npm run build                  # must pass
git add -A && git commit -m "checkin: YYYY-MM-DD — <one line>" && git push
```

The VPS pulls `main` every 10 minutes and rebuilds, so a push is a deploy.

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
| `data/sources.json` + `SOURCES.md` | — | quarterly: replace moved or dead sources, demote ones that failed twice, add a source a line needed and lacked |

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
