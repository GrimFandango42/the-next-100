# Roadmap

Where the site goes next. Revised 28 November 2026 around one question: **is this a good place to take in the future and compare its pieces?** Grading still matters and the machinery stays honest, but it is not the product: no line can be graded before the end of 2029, so for the next three years the site earns its keep by what a reader can see, explore and compare.

The items are ordered within each section. Dates are intentions, not promises; the weekly check-in is the only fixed clock.

## Principles

These outrank anything below.
- **Three views (This week, Odds, the book), one drawer per line, and the board inside the book.** No other navigation.
- **Every picture is drawn from `data/`.** A lens or a game word is fine as long as the real measure is one glance away: the legend says it in plain words.
- **Compare beats catalogue.** A new feature should help a reader set two things side by side: line against line, forecast against market, a year against a year, one path against the other.
- **No source, no change; never rewrite history.**
- **Phones are first-class.** The page never scrolls sideways. The board is the one exception: it pans sideways inside its own frame, like a map.

## Shipped

| | What | Where |
|---|---|---|
| TN-01 | Public repo scrubbed of names and server; onboarding docs | #28 |
| TN-03 / 03B | Kalshi and Polymarket odds matched to 19 lines, pulled daily, frozen at each check-in | #29, #30 |
| TN-04 | "How the odds moved": each line's odds over time against its market, in the drawer | #31 |
| TN-05 | This week · Odds · the book, one tap apart | #32 |
| **TN-06** | **The century board** replaces the list Overview. Every line is a hex token, years across and domains down, with six lenses: odds, momentum, crowd gap, evidence, threads and horizon. It has cards with links and the market line, a compare tray of four with one overlaid chart and a side-by-side table, a world panel for any year on either path, explored count, keyboard travel. Also: the drawer is a readable side panel on desktop; duplicate "Linked" chips and number-less figure captions fixed. | this branch |

## Every earlier item, checked again

Each item from the previous roadmap, judged on whether it helps a reader consume and compare.

| Item | Verdict | Why |
|---|---|---|
| Absorb 2026 (Iran war, agent incident, etc.) | **Keep: check-in work** | A forecast that ignores the year it lives in can't be compared with anything. This belongs to the check-in, not a feature. |
| Re-anchor vendor-sourced moves | **Keep: check-in work** | The Evidence lens now shows these lines as dark tokens, so the gap is visible. Close it one check-in at a time. |
| Signature exhibits (six lines with a real series) | **Keep, move up** | Two of six done (population, Arctic). A real series beside the forecast is the most direct comparison the site can offer. |
| One figure vocabulary | **Reshape** | The board and the drawer chart are now the shared grammar for odds. What remains is captions: one caption format on every page. Fold into the phone pass. |
| Phone first screen | **Keep** | Still true: some curves and exhibits fall below the fold on an iPhone SE. |
| Branch flip should feel like a flip | **Partly done** | The board's world panel moves with the path pill. Still to do: in the book, show "on this path: …" under each branch-aware line. |
| Overview as the map | **Done** | The century board (TN-06). |
| Reading time and progress | **Shrink** | One line on the cover. Low value next to the board. |
| Share a page (OG images) | **Keep** | Sharing is how a comparison travels. Pair it with shareable board states (below). |
| First grades (2027) | **Correct and defer** | The earliest `assessAfter` is 2029-12-31, not 2027. The adjudication fields and two-score code exist; the worked example waits. |
| Observed series on metric curves | **Keep, move up** | "Observed" against "forecast" on one curve is a comparison. It also feeds the world panel. |
| Indicators that compute | **Keep** | A derived reading can be compared week to week; a hand-set one can't. |
| Line budget (55, merge rule) | **Keep** | Fewer, sharper lines make the board readable. |
| Era palettes | **Drop** | The board's chapter bands already say where you are. Cosmetic. |
| Fork page as centerpiece | **Reshape** | Build it from the world panel: two worlds at a year, side by side, rather than new art. |
| VoiceOver / NVDA pass | **Keep** | The board adds a large interactive surface. It needs a real screen-reader read. |
| "What would change your mind?" | **Keep** | One signal per card, as a question. Cheap, and it makes a card worth opening. |
| Weekly digest + RSS | **Keep** | The most direct "consume" feature not yet built. |
| Return-visit banner | **Done** | This week already shows changes since your last visit. |
| Calibration plot | **Later (2030+)** | Needs resolved lines. |
| Vintage diffing | **Keep, reshape** | Becomes a board lens: "the board as it was on <date>", tokens showing their move since. |
| Contributor forecasts | **Keep (later)** | "Your odds against ours" is a comparison. It needs storage, so it comes after the shareable states. |
| Translations, print | **Later** | Unchanged. |

## Next: December 2026 – February 2027

**Explore and compare**
1. **TN-07 Shareable board states.** The hash carries the lens, the open card and the tray (`#board?lens=crowd&card=x&cmp=a,b`), so a comparison can be sent as a link. *Done when:* a pasted link reopens the same board, card and tray.
2. **TN-08 Compare from Odds.** A checkbox column in the Odds table feeds the same tray, and "Compare" opens the board's compare panel. *Done when:* the tray is shared between Odds and the board.
3. **TN-09 Outside views beyond markets.** Add Metaculus community forecasts and the major expert surveys as a second comparator beside Kalshi and Polymarket. The Crowd gap lens becomes "Outside views" with a venue picker. This needs `metaculus.com` allowed in the check-in environment; it is blocked here today. *Done when:* at least 10 lines show a non-market outside view with its date and question text.
4. **TN-10 The card asks what would change its mind.** The top signal appears under the odds on each card and book page, phrased as a question. *Done when:* every open line shows one.
5. **TN-11 Board polish from real use.** Lane labels that stay put while the board pans on a phone; a zoomed board when a card is open on narrow desktops; a "since <date>" lens built from vintages. *Done when:* the board sweep (`qa/board.mjs`) and a phone read-through find nothing.

**Data to compare against**

6. **TN-12 Four more signature exhibits:** SOX drawdown (FRED), warming (Copernicus), fossil CO₂ (Global Carbon Budget), recent-graduate unemployment (NY Fed). Each is a pinned extract with source URL and hash. *Done when:* six lines carry one.
7. **TN-13 Observed series** for population, warming, work hours and off-Earth, drawn solid against the dashed forecast, and shown as "observed" in the world panel for past years. *Done when:* no metric figure draws observations as loose points.
8. **TN-14 Source quotes on cards.** Each card shows one short, attributed quote from its strongest source: what the evidence actually says, in its own words. This needs a `quote` field on history sources, added at check-in time and never invented. *Done when:* 20 lines carry one.

**Take it with you**

9. **TN-15 Weekly digest and feed.** `/feed.xml` (Atom) is built from `changelog.json` at build time, and This week links to it. *Done when:* the feed validates and fills with no extra step at check-in.
10. **TN-16 Share images.** `public/og/<id>.png` for every line (its token, claim and odds), served for `#line-<id>` links through a small Caddy rewrite. *Done when:* a shared line previews as that line.

**Keep it fast**

11. **TN-17 Split the bundle.** The main chunk is 733 kB. Lazy-load the board and the signature exhibits. *Done when:* the first screen loads under 300 kB of JS.

## Later (2027)

- The fork as two worlds side by side, built from the world panel.
- A screen-reader pass on real devices (VoiceOver, NVDA) across the board and the drawer.
- Contributor odds: a reader records their own number on a line and sees it beside the forecast and the market.
- Translations (Spanish, Hindi), then a print edition per check-in.
- Calibration, once enough lines resolve (not before 2030).

## How this list changes

Anyone can propose an item with the *Propose a line* or *Site bug* issue template, or with a PR against this file. Items move up when a reader asks for them or a check-in needs them. Reviews that argue with this plan live in `docs/reviews/`.
