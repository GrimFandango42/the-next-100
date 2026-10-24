# Contributing

The forecast is meant to be argued with. Here is how to do it so the argument lands.

## The quick version

1. **Found a line that's wrong?** [Open a *Challenge a forecast* issue](https://github.com/GrimFandango42/the-next-100/issues/new/choose). Say which line, what's wrong (the date, the odds, the framing, the test), and link the source you read. That alone is a contribution: the next check-in will weigh it.
2. **Want to fix it yourself?** Edit `data/events.json`, append a `history` entry, run `npm run build`, open a PR. CI (`.github/ci.yml`, enabled by moving it to `.github/workflows/`) runs the validator and the tests.
3. **Something missing?** [*Propose a line*](https://github.com/GrimFandango42/the-next-100/issues/new/choose): a dated, gradable claim with two sources.

## The rules (the validator enforces most of them)

- **No source, no change.** A URL you actually opened, not a search snippet. Add it to `data/citations.json` with title, publisher and date.
- **Every edit appends to `history`** — `{date, change, reason, sources}`, plus `from`/`to` when a probability moved. Never rewrite or delete an earlier entry.
- **Tiers follow the number:** high ≥ .70, moderate .45–.70, speculative < .45.
- **Ids are permanent.** Rename nothing; add a new line instead.
- **The test is frozen by version.** To change what counts, bump `resolution.version` and say why in history.
- **Keep the voice:** plain, specific, no hedging filler. Say what you think; the odds carry the uncertainty.
- **Data edits are data edits.** A check-in or a forecast PR touches `data/` only. UI and scripts are separate PRs.

## Editing a line, step by step

```bash
git checkout -b challenge/fusion-date
# edit data/events.json: the field, then history[]
npm run build          # validator + typecheck + build must pass
npm run qa:book        # structural tests
git commit -am "fusion-net-grid: 0.65 → 0.60, SPARC slipped to 2027 (CFS statement)"
```

A good history entry:

```json
{ "date": "2026-11-02", "change": "probability 0.65 → 0.60", "from": 0.65, "to": 0.60,
  "reason": "CFS moved SPARC first plasma to 2027 in its 14 October statement; no magnetic Q>1 before 2028 now.",
  "sources": ["https://cfs.energy/…"] }
```

## Adding a line

Copy the shape of a neighbour in `data/events.json`. It needs: `id`, `year` (and `yearEnd` with `timing: "window"` if it's a window), `domain`, `title`, `summary`, `detail`, `probability` + `confidence`, three `signals`, a `resolution.test` with a `version`, a `hero` (at least `label` and `effect`), and a `history` entry with `change: "added"` and two opened sources. Link it into the graph with `leadsTo` where there's a real dependency. Look at `docs/data-model.md` for what every field means and which figure it gets.

## Changing the site

Read `ONBOARDING.md` rule 5 first: one way to read (scroll), one strip, Overview to zoom out, figures drawn from data. Then:

```bash
npm run dev
# …
npm run build && npm run qa:book && npm run qa:evidence
npm i -D playwright && npx vite preview --port 4174 &
node qa/book.mjs && node qa/overflow.mjs http://localhost:4174/
```

Clean means no console errors, nothing overlapping, no horizontal overflow on desktop or iPhone 13. Put a screenshot in the PR.

## Running a check-in

`CHECKIN.md` is the protocol and `SOURCES.md` the registry. `npm run checkin:brief` prints what to look at; `npm run checkin:log -- …` writes the changelog entry and freezes a vintage. In Claude Code, `/checkin` does the whole thing. Check-ins commit to `main` and deploy themselves.

## For AI agents

Start with [`ONBOARDING.md`](ONBOARDING.md). It is the brief: access, rules, what's wanted, in that order.
