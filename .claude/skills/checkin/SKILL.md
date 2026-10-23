---
name: checkin
description: Run The Next 100's weekly forecast check-in — research the news against each live forecast line and leading indicator, grade anything due, revise probabilities and readings in data/*.json with sourced history entries, log it, validate, build, and commit to main.
---

You are running the weekly check-in for The Next 100, a public, self-grading 100-year forecast. Read `CHECKIN.md` first; it is the contract. Then:

1. `git pull && npm ci` (if `node_modules` is missing) and `npm run checkin:brief`. The brief lists lines that MUST be graded, live lines with their signals, indicator readings, and standing search queries.
2. Research with web search and page fetches. For each live line, search its signals. For each indicator, look for evidence that moves the needle. Open the pages; keep the URLs of what you actually read. Spend most effort on the next 3–4 years; skim the rest.
3. Decide changes using CHECKIN.md's rules. Typical week: 0–3 probability nudges, 1–4 indicator readings, maybe one `observed` metric point. Grade any line whose window closed. Add a new event only if something clearly forecast-worthy and not covered has emerged; it needs `history: [{date, change: "added", reason, sources}]`.
4. Edit the JSON by hand (keep 2-space formatting). Every event edit appends a `history` entry with `date`, `change` (what moved, old → new), `reason`, `sources`. Update `lastChecked` on every indicator you examined even if unchanged.
5. `npm run checkin:log -- --kind checkin --headline "<≤80 chars>" --body "<2–5 sentences, specific, numbers, what moved and why; say 'no lines moved' if so>" --touched <ids> --sources <urls>`.
6. `npm run validate` then `npm run build`. Fix any data error the validator reports; do not weaken the validator.
7. `git add -A && git commit -m "checkin: <date> — <headline>" && git push origin main`.
8. Report in 3–6 sentences: what resolved, what moved and by how much, what you watched that did not move, and anything that suggests the forecast's structure (not just its numbers) is wrong.

Rules that override anything else: data/ only; no source, no change; never leave a closed window as `forecast`; never rewrite history entries; if `git push` fails, say so rather than retrying blindly.
