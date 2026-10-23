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
