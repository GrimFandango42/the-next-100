# QA scripts

## Field-guide redesign

The active UI is now `StoryJourney.tsx`. The old zoom/moment scripts below target the retired film and are retained as reference, not as acceptance checks for this design.

Before merging, check:

- Opening → workbench → fork → prediction index anchors land directly, without scroll interception or blank transition states.
- Both scenario cards update the evidence controls and odds; `?b=concentration` restores the scenario on reload.
- The index count matches `data/events.json`; Space shows only space events; All restores the full count.
- Every prediction opens its reasoning. Tab/Shift+Tab stay inside the dialog, Escape closes it, and focus returns to the opener.
- Event links retain the selected scenario and open the correct dialog on reload; old `#m-` links still work.
- At phone widths, scene copy stacks above artwork, both scenario cards remain readable, and the index has no horizontal overflow. Check Safari on a real phone before broad rollout.
- With reduced motion, the decorative pulses stop. Scrolling is always native.
- Run data validation, TypeScript checking, and the Vite production build.

The redesigned introduction changes presentation only; forecast data and probabilities remain untouched.

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
