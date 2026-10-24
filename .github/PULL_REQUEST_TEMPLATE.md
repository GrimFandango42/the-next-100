## What this changes

<!-- One or two sentences. If it touches data/, name the lines. -->

## Checklist

- [ ] `npm run build` passes (validator, typecheck, build)
- [ ] `npm run qa:book` and `npm run qa:evidence` pass
- [ ] Data edits: every touched line has a new `history` entry with the URL(s) I opened, and `data/citations.json` has an entry for each new URL
- [ ] No ids renamed; no earlier history rewritten; a changed `resolution.test` got a new `version`
- [ ] UI edits: `node qa/book.mjs` and `node qa/overflow.mjs` are clean on desktop and iPhone 13, screenshot attached
- [ ] One way to read: no new navigation, no autoplay, no decorative figures
