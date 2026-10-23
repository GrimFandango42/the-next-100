# QA scripts

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
