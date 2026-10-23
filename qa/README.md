# QA scripts

## Illustrated book

The active UI is `StoryJourney.tsx`: five era chapters, one illustrated spread per prediction, a sticky chapter rail, and a compact index. `PredictionArt.tsx` selects purpose-built SVG scenes for each forecast. The old zoom/moment scripts below target the retired film and are retained as reference, not as acceptance checks for this design.

Run `npm run qa:book` for render-level regression checks: every forecast gets exactly one chronological spread, all navigation anchors resolve, HTML/SVG ids are unique, current predictions have selected artwork, and scenario deep links restore the fork.

Before merging, check:

- Cover → chapter opening → predictions → epilogue → compact index anchors land directly, without scroll interception or blank transition states.
- The chapter rail and contents panel reach all five chapters. Contents closes after choosing a page, clicking outside, or pressing Escape.
- Previous/next page controls reach neighboring predictions; the last page of an era introduces the next chapter. The current year, folio, and progress rail follow the visible spread.
- Both scenario cards update the evidence controls and odds; `?b=concentration` restores the scenario on reload.
- The index count matches `data/events.json`; Space shows only space events; All restores the full count.
- Every prediction opens its reasoning. Tab/Shift+Tab stay inside the dialog, Escape closes it, and focus returns to the opener.
- Event links retain the selected scenario and open the correct dialog on reload; old `#m-` links still work.
- At phone widths, scene copy stacks above artwork, both scenario cards remain readable, and the index has no horizontal overflow. Check Safari on a real phone before broad rollout.
- With reduced motion, illustration reveals, page perspective, assembly effects, and decorative pulses stop. Scrolling is always native. Scroll-driven perspective has a static fallback when CSS view timelines are unsupported.
- Run data validation, TypeScript checking, and the Vite production build.

The illustrated book changes presentation only; forecast data and probabilities remain untouched. Unknown future event ids fall back to a topic illustration until their artwork is chosen.

## Legacy film checks

Headless Playwright checks that have caught real regressions. They write screenshots to `qa/out/` (git-ignored).

```
npm i -D playwright            # once; uses the Chromium it bundles, or set PW_CHROMIUM=/path/to/chrome
npm run build && npx vite preview --port 4174 &
node qa/zoom.mjs               # century / decade / moment at 5 scroll positions, desktop + iPhone 13: overlaps, off-screen labels, gestures, dive-in, Why sheet
node qa/moments.mjs            # every moment with its figure, desktop + phone: overlaps, console errors
node qa/overflow.mjs http://localhost:4174/   # iPhone 13 / SE / Pixel 7: any beat wider than the screen
node qa/smooth.mjs             # samples the year readout after a scroll jump; should glide, not step
```

Pass a URL as the first argument to run any of them against the live site. A clean run prints no `ov` (overlap), no `off`, and an empty `errs`.
