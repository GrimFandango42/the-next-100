# QA

Checks that have caught real regressions. Screenshots land in `qa/out/` (git-ignored).

```
npm run qa:book                       # node test: one page per prediction in order, anchors resolve, no duplicate ids, figures render, ?b= deep links
npm i -D playwright                   # once; bundled Chromium, or set PW_CHROMIUM=/path/to/chrome
npm run build && npx vite preview --port 4174 &
node qa/book.mjs                      # desktop + iPhone 13: console errors, horizontal overflow, page count, Why sheet opens; screenshots of 9 pages
node qa/overflow.mjs http://localhost:4174/   # iPhone 13 / SE / Pixel 7: any section wider than the screen
```

Pass a URL as the first argument to run against the live site. Clean = `errs: []`, `sw` equal to the viewport width, `sheet: true`.

Both sweeps also open three drawers (`qa/drawers.mjs`): a line with two markets (`next-pandemic`), one with none (`agents-default-knowledge-work`) and one with an inverted market (`the-silence`). Per drawer they check the sheet opens, nothing scrolls sideways, the parts under "How the odds moved" do not overlap, the end labels neither collide nor leave the chart, a hover (desktop) or tap (phone) shows a tooltip inside the chart, and no console errors appear. `odds` in the `book.mjs` output lists each drawer with `ok` and its `problems`; either script exits non-zero on any problem. Screenshots: `qa/out/{d,m}-odds-<id>.png`. The browser is `PW_CHROMIUM` if set, else Playwright's Chromium, else an installed Edge or Chrome (`qa/browser.mjs`).

The market chart and the "Forecast against the markets" figure are tested offline, with rows built from the recordings in `qa/fixtures/markets` through `pull()`:

```
node --import tsx --test qa/odds.test.tsx qa/markets.test.ts
```

With no `data/market-history/` the drawers draw the forecast alone and the Explore rows say "no price yet". To see real lines in a preview before the first pull, write rows from the fixtures into `data/market-history/` locally, build, and delete the folder afterwards; never commit it.
