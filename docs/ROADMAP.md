# Roadmap

Where the site goes from here, in the order it should go. Four tracks — **data**, **visuals**, **interaction**, **consumption** — and a fifth for the machinery that keeps it honest. Each item says what it is, why it earns a place, and how we'd know it worked. Dates are intentions, not promises; the check-in cadence is the only fixed clock.

Principles that outrank anything below: one way to read (scroll, strip, Overview); figures drawn from data, never decoration; no hedging filler on the page; no source, no change; never rewrite history.

## Now → next check-in (late October – November 2026)

**Data**
- **Absorb 2026.** The forecast was written before it knew about the Iran war (since 28 Feb), the Hugging Face agent incident, Commerce switching off a lab's models, the US–China incident channel. Re-read the energy, risk and Clock lines against them in a sourced check-in rather than a reflex. *Done when:* every line whose signals fired in 2026 has a 2026 history entry.
- **Re-anchor the vendor-sourced moves.** Humanoids, AI drugs, the research loop and the-silence still lean on sponsor or trade sources (`SOURCES.md` lists them). *Done when:* each has one primary or institutional source in history.
- **Signature exhibits for the lines that have a real series.** The population and Arctic exhibits set the pattern: a pinned, hashed extract from the measuring institution, a chart that reads at a glance, variants the reader can flip without touching the forecast. Next in line: warming (Copernicus annual series beside the stripes), fossil CO₂ (Global Carbon Budget), US data-centre share (LBNL), recent-graduate unemployment (NY Fed), SOX drawdown (FRED). *Done when:* six lines carry an exhibit whose data file has a source URL and SHA.

**Visuals**
- **One figure vocabulary.** Seven figure kinds plus six exhibit types plus two signature exhibits is three visual grammars. Fold them into one: every page gets a *figure* (data) and, where it helps, a *stage strip* (the explainer tabs), with the same kicker, caption and source line. *Done when:* `Figure.tsx` is the only entry point and the caption format is identical on every page.
- **The phone first screen.** Title, one sentence, the figure, the odds — in that order, inside the first 100svh, on every page. The ladders and bars already fit; the curves and exhibits sometimes don't. *Done when:* the sweep reports the figure's top edge above the fold on iPhone SE for all 55 pages.

**Interaction**
- **The branch flip should feel like a flip.** Changing the path on the fork page re-renders twenty figures and a table; nothing tells you what changed. Animate the numbers that move (CountUp on the differs table, curve morphs on the metric figures) and show a one-line "on this path: …" under the odds of each branch-aware line. *Done when:* flipping on any page produces visible motion on that page.
- **Overview as the map.** It already filters by thread and searches. Add the four threads as columns so the century reads as a weave, and show each line's odds as a dot you can scan. *Done when:* the Overview answers "what does the planet thread look like in the 2040s" without opening a page.

**Consumption**
- **Reading time and progress.** 62 pages is a long read; say so on the cover ("about 40 minutes; chapter 1 is 8") and let the strip's progress bar mean something. *Done when:* the cover states the time and it's within 20% of a real read.
- **Share a page.** Every page has a deep link (`#story-<id>`); give it an OG image per line (the figure on the book's background) so a shared page previews as that prediction, not the cover. *Done when:* `public/og/<id>.png` exists for all lines and `index.html` picks it by hash at build time or via a tiny edge rewrite.

## Next quarter (December 2026 – February 2027)

**Data**
- **The first grades.** The 2027 lines come due. Before they do: adjudication fields on each (`adjudication: {outcome, rationale, sources, definitionVersion}`), the two scores on the track-record page, and a worked example of a graded line in `CHECKIN.md`. *Done when:* the first resolved line shows a founding and a strict score on the site.
- **Metrics with observed series, not points.** `population`, `warming`, `work-hours`, `off-earth` get yearly observed arrays from the registry sources so the curves show a solid observed line meeting a dashed forecast. *Done when:* every metric figure draws observed as a line, not rings.
- **Indicators that compute.** Four of the seven indicators (open-weights gap, compute ownership, incidents, labor response) can be numbers from Epoch, BLS and the incident registry rather than a hand-set reading. *Done when:* their `reading` is derived from a stored series with the formula in the note.
- **A line budget.** 55 is right; 80 is a catalogue. New lines replace or merge weak ones (two of the far space lines overlap) rather than add. *Done when:* `CONTRIBUTING.md` states the budget and the merge rule.

**Visuals**
- **Era palettes.** Five chapters, one palette. A restrained shift per era (the greens cool toward 2200) would let a reader feel where they are without reading the strip. *Done when:* a screenshot of any page can be placed in its chapter by colour alone.
- **The fork page as the centrepiece.** It is the most important page and currently the plainest. Two planets or two worlds drawn from the two branches' metrics at 2060 — population, hours, lifespan, actors, clock — side by side, animated on choice. *Done when:* the fork page is the one people screenshot.

**Interaction**
- **Keyboard and screen-reader pass on a real device.** Headless checks say the structure is sound; nobody has read it with VoiceOver. *Done when:* a full read-through on iOS VoiceOver and NVDA produces a list of fixes and they're shipped.
- **"What would change your mind?" on every page.** The signals already exist; render the top one as a question under the odds ("If OpenAI reports India as #1, this resolves"). *Done when:* every page shows one signal in that form.

**Consumption**
- **A weekly digest that writes itself.** The check-in already writes a changelog entry; render the latest as a short, shareable page (`/this-week`) and an RSS/Atom feed. *Done when:* the feed validates and the Monday check-in populates it with no extra step.
- **Return visits.** The "what changed since you were here" digest exists; make it the thing a returning reader sees first (a one-line banner on the cover when their stored edition is older). *Done when:* a returning reader sees the count of changed lines before scrolling.

## Later (2027)

- **Calibration, once there is enough to calibrate.** After ~15 resolved lines: a calibration plot (stated odds vs. hit rate) on the track-record page, by tier and by force, with the honest sample-size note. Not before.
- **Vintage diffing.** "Show me the forecast as it was on 2026-10-22" — the vintages exist; a read-only toggle in the Overview to view a past edition's odds beside today's.
- **Contributor forecasts.** Let a reader record their own odds on a line (local only, or a signed-in layer later) and see how they did when it resolves. The founding/strict split already supports it.
- **Translations.** The data model separates copy from code; the book is ~15k words. Spanish and Hindi first, given where the readers of the India and Africa lines are.
- **Print.** A PDF of the current edition, generated at check-in time: the book as a book, dated, with the vintage hash on the cover.

## How this list changes

Anyone — person or agent — can propose an item by opening an issue with the *Propose a line* or *Site bug* template, or a PR against this file. Items move up when a reader asks for them or a check-in needs them; they come off when done or when a better idea replaces them. Reviews that argue with this plan live in `docs/reviews/`.
