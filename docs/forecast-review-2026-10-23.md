# The Next 100: visual, evidence, and coverage review

Reviewed 23 October 2026 against main commit `057610ed11d2e78fc2bddeff3c6992b9fcb7273d` and the live site. This is a review and implementation brief, not a replacement forecast. No public probabilities, data, or UI were changed in this pass.

## Recommendation

Keep the book, chapter navigation, restrained palette, and split spreads. Make each visual answer a question: **what changes, what has to happen first, and what would make this forecast wrong?** The next iteration should improve explanation and evidence before adding animation or more cards.

The forecast currently reads as one compelling AI-led story. That is valuable editorially, but it is not yet a well-specified, calibrated model of the future. Separate a narrative scenario from individually resolvable forecasts. Distinguish measurements, institutional projections, company plans, author judgments, and illustrative geometry everywhere they appear.

## Scope and limits

- Inspected all 39 event records, seven metric series, seven leading indicators, source-registry structure/rules, scenario arithmetic, schema, validation, grading UI, and illustration implementation.
- Inspected the live book and opened the population evidence panel. Reviewed the actual population chart visually.
- Checked selected high-impact claims against primary/institutional material listed below. This was not a link-by-link verification of all 130 registry entries or every claim in every linked paper. Citation counts measure presence, not quality.
- No new date or probability is proposed merely because a technology is important. Candidate additions below need explicit definitions and probability elicitation first.

## Structural findings

Reproduce with `node scripts/audit-evidence.mjs` or `node scripts/audit-evidence.mjs --json`.

| Measure | Result | Implication |
| --- | ---: | --- |
| Forecasts | 39 | Full event-level review below |
| Domain registry entries | 130 | Good discovery coverage; not 130 claim-level substantiations |
| Events with at least one history citation | 29 | Citations are embedded in change history, not mapped to assertions |
| Events with no history citation | 10 | Reader cannot inspect an event-specific evidence trail |
| Events with no watch signal | 6 | Long-horizon claims have little update discipline |
| Structured resolution rules | 0 | Some useful tests exist in prose, but cannot be validated consistently |
| Structured probability histories | 0 | Revisions exist as text, making calibration and cutoff-based scoring fragile |
| Metrics with observed anchors | 5 of 7 | AI work share and paid hours have no observed anchors; the frontier-actor anchor is an author-derived count |
| Indicators with source fields | 0 of 7 | Readings have explanatory notes but no direct structured citations |

The ten uncited events are universal income, manufacturing location, Mars outpost, healthy lifespan 110+, mainstream BCI, asteroid industry, off-Earth population, human–AI continuity, self-sustaining settlement, and clock retirement. This does **not** mean there is no external evidence relevant to them.

## Fix first: correctness and meaning

1. **Hinge probability drift.** `hinge-resolves` was revised from .60 to .57, but its prose and `meta.hinge.pluralismProbability` still say .60. The book displays 60/40; the index displays 57%. Define whether the event means resolution by 2039 or pluralism winning. The revision suggests the latter. Use one canonical branch probability, or explicitly separate these two questions. Current outcome percentages are consistent with rounding a 60/40 mixture; they are not a sum-to-100 bug. Derive them when the hinge is settled.
2. **Probability is not confidence in the evidence.** The validator maps confidence directly to likelihood bands. A well-supported 10% risk can have strong evidence; a highly likely vague story can have weak evidence. Use `probability`, `evidenceStrength`, and `forecastType` separately. The method's description of 45–70% as “more likely than not” is mathematically wrong below 50%. The 70% boundary also receives both high and moderate labels.
3. **Dates have conflicting meanings.** The method calls dates midpoints; cards say “by”; several events specify intervals; the silence means “through.” Add `timeSemantics` with by/in-window/through/as-of, and an explicit resolution date including publication lag. An early event is success for a by-deadline question, but not necessarily for an in-window question.
4. **Stale copied numbers.** Mass-casualty prose says about 15% before 2060; its badge says 17% by 2055. Fix the canonical question first, then render repeated numbers from data rather than duplicating prose constants.
5. **Grading rules sometimes weaken the headline.** “Most routine work” is stronger than firms reporting scaled agent use; a published automated result is weaker than a multi-month autonomous research program; a retailer offering a robot subscription is weaker than meaningful household adoption. Make the grading rule match the headline, not a convenient proxy.
6. **Climate assumptions are too implicit.** Falling annual emissions, net-zero CO₂, net-negative emissions, and temperature decline are different milestones. Specify temperature dataset, baseline, averaging window, and net-zero/removal assumptions. Annual observed temperatures and a smooth long-term forecast should not silently share a definition. The 2050 point is exactly 2.0°C, while the headline says breached. The site's 1.9°C in 2100 is an author scenario, not the current-policy baseline in UNEP 2026 [S3].
7. **Contrarian demographics need visible comparison.** A 2046–2058 peak and 7.5bn in 2100 are materially different from UN WPP 2024 [S1]. The site already acknowledges this in prose; show it next to the curve. Specify fertility, mortality, and demographic momentum assumptions. Rich-country fertility alone cannot establish a global peak; radical longevity also interacts with the population path.
8. **Far-future precision exceeds the support.** 2072 healthy life past 110, 2085 economic asteroid mining, and 2150 self-sufficiency need either operational thresholds and explicit judgment labels or treatment as scenario sketches. Do not simply lower every probability: an imprecise claim needs reframing before re-estimation.
9. **The Clock rationale needs correction.** The Bulletin already considers climate, biotechnology, and AI; it describes the Clock as a metaphor, not a forecasting instrument [S7]. Retirement can remain a speculative institutional prediction, but should not rest on the Clock only measuring nuclear weapons. Its modeled seconds must not imply a calibrated catastrophe probability.

## Evidence: retain the registry, add claim-level provenance

The registry's policies are substantially stronger than their implementation. They ask for primary support, counterevidence, dataset editions, and constraints on vendor-driven updates. But event URLs lack titles, editions, access dates, the precise supported assertion, and support/contradiction roles. An authoritative publisher can still be irrelevant to the claim: the aging-therapy event's citation supports life expectancy, not therapy approval.

The robot probability rose five points on press/vendor-related material without an explicit independent deployment audit; the autonomous-research increase is led by self-report. These should be reviewed against the registry's own vendor-update rule. Do not infer independent confirmation from several outlets repeating one announcement.

Recommended record:

```text
resolution: question, geography/population, metric, threshold, time semantics,
            deadline, adjudication source, exclusions, publication lag
evidence: source ID, title, publisher, edition/publication date, accessed date,
          claim supported, supports/challenges/context, independent/vendor,
          verification status, specific section/table
probabilityHistory: timestamp, old value, new value, rationale, evidence IDs,
                    forecast-definition version
drivers: required / enabling / constraining / contextual links
```

Give the four outcome scenarios an explicit horizon and mutually exclusive definitions (for example, loss of human control is not necessarily biological extinction). Their current totals are judgments, not outputs of a fitted joint model.

Keep original probabilities and definitions immutable. Grade binary questions with a proper score such as Brier at a declared forecast cutoff; display sample size and horizon. Keep partial/retired narratives out of binary scoring unless the scoring policy was declared in advance. Do not claim calibration before enough questions resolve. A weekly news update should not silently redefine a question to preserve a hit.

Source maintenance findings: METR's time-horizon page says no longer actively updated, last updated September 8, 2026 [S2]; the registry calls it per-model. UNEP 2026 is available [S3], while the registry names 2025. IEA was previously excluded as inaccessible, but its April 2026 energy/AI release was readable in this review [S13]. Fetch failures need per-source states, not a permanent publisher ban. The IPCC pages and NIH release attempted here returned fetch errors; those were not treated as inspected evidence.

## Missing drivers: what belongs, and at what level?

Quantum and CRISPR are absent from both the event text and domain registry searches. This is a real coverage gap, but not a reason to add a generic “quantum changes everything” page.

| Driver | Decision | Observable milestone / constraint | Existing forecasts affected |
| --- | --- | --- | --- |
| Post-quantum security | Add a concrete candidate forecast | Audited migration of a named critical-system population, rather than standards publication alone. NIST standards already exist [S10]. | Cyber resilience, infrastructure, state capacity |
| Useful fault-tolerant quantum computing | Add a separately scoped candidate; do not assume broad acceleration | Independently reproduced advantage on a useful chemistry/materials workload against a specified best classical baseline, including full resource costs. Logical error correction progress [S11] is a precursor, not that outcome. | Chemistry, materials, selected industrial research |
| CRISPR and other gene editing | Add explicit biology milestones | Separate ex-vivo editing, in-vivo editing, delivery beyond easy-to-reach tissue, durability, safety, and patient access. Casgevy was already approved in 2023 [S12]; “first CRISPR treatment” would be historical, not a new forecast. | Disease burden, healthspan, care, inequality |
| Programmable/personalized medicine | Research candidate with a bounded question | Repeatable regulatory platform and actual treated cohorts, not a single successful case. Gene therapy is not automatically gene editing; disease treatment is not proof of aging reversal. | Drug development, manufacturing, healthcare delivery |
| Reliable electricity, grids, storage | Promote to a central enabling/limiting driver | Firm delivered cost, interconnection time, storage duration, utilization, and capacity actually operating. IEA documents rising demand and constraints [S13]. | AI deployment, robotics, clean industry, climate |
| Advanced materials and manufacturing | Track within dependencies before adding a standalone card | Lab property → manufacturable process → yield → cost → deployment. Avoid treating material discovery as immediate industrial adoption. | Batteries, chips, fusion, robots, aerospace |
| Synthetic biology and biomanufacturing | Add a research lane | Scale, yield, purification cost, biosafety, and independently measured production; separate beneficial use from misuse risk. | Medicines, food, materials, biosecurity |
| Water, food, heat adaptation | Strengthen climate consequences and constraints | Population exposure, adaptation delivered, crop resilience, water/energy tradeoffs; define region-specific indicators before dates. | Migration, public health, institutional stability |
| Institutions, distribution, demographics | Keep as independent drivers | Procurement, insurance, education, affordability, fertility and mortality; include non-US evidence. | All chapters |

My judgment: **gene editing and dependable energy deployment deserve more immediate narrative weight than a universal quantum breakthrough.** Quantum deserves bounded milestones and monitoring. Do not make quantum a prerequisite for AI or drug discovery without a demonstrated dependency.

The two branches currently bundle several independent dimensions: capability concentration, openness, democratic legitimacy, speed, and benefit distribution. They need not move together. Keep the simple navigation choice, but describe it as two illustrative scenarios. Add visible assumptions for technology progress, governance, and diffusion; later, compare more combinations without creating dozens of branches.

## The visual direction: illustrated explanations

Keep one dominant visual per spread. At rest, show the key fact and a readable caption. Offer one clear action; reveal a short annotation in a fixed area, so interaction does not make the page jump. Preserve native scrolling and reduced-motion behavior. All interactions must work with tap and keyboard, not hover alone.

| Spread | Interactive visual | What the reader learns |
| --- | --- | --- |
| Population | Compare author path with UN reference; scrub labeled years; show only sourced reference points until a full series is ingested | How contrarian the forecast is, and which assumptions account for the gap |
| AI drugs | Stage-selectable pipeline: discovery → trials → approval → access; inspect named candidates and their dated evidence | Faster discovery does not automatically mean shorter trials or more approvals |
| Lunar base | Retain the illustrated base; selectable power, habitat, logistics, life support, crew rotation hotspots | Why landing, long stays, continuous occupation, and self-sufficiency differ |
| Fusion | Meter-style energy account and milestone ladder | Plasma gain, electricity generation, grid export, annual net export, and commercial cost are different claims |
| Gene editing | Before/after mechanism with treatment pathway and delivery constraints | What is edited, where, for whom, and what remains unproven |
| Quantum | Physical → logical → useful workload sequence; compare claimed and independently demonstrated milestones | Why physical-qubit counts alone do not establish usefulness |
| Climate | Observations plus explicit scenario paths; inspect emissions peak, net zero, removal, and temperature thresholds | How the temperature path depends on policy and physical assumptions |
| Hinge | Toggle branches and visibly update one outcome comparison plus a list of changed assumptions | What actually differs, instead of only changing a network illustration |

Do not add synthetic confidence bands, invented percentages of prerequisite completion, or sliders that imply a scientific model we have not built. A sensitivity toy must say it is illustrative and show its assumptions. A reference forecast is a comparison, not automatically the truth.

Every spread should answer four questions without opening a long revision log: **What is the bet? What supports it? What could stop it? What do we watch next?** Put a compact source title/date directly below the visual; keep full history in the drawer. “Forecast data” should become “Author scenario” where appropriate. Charts need meaningful axes/ticks, observed versus projected styling, and accessible data summaries. The current population chart has gridlines without numeric y labels and only endpoint years.

## Other product improvements

- Give each chapter a short synthesis: what changes for ordinary life, what drives it, and the main uncertainty. Avoid 39 equal-weight spreads becoming a monotonous catalogue; mark a few anchor predictions and make supporting ones easy to skim.
- Add a visible current-scenario indicator where the choice matters, plus “what changed?” feedback. No event currently has a branch field, and most book artwork is branch-invariant, despite the fork saying everything after it branches.
- Make sources legible as publisher/title/date, not only `[1]` in revision history. Display evidence gaps openly rather than filling them with generic source homepages.
- Improve chart label and metadata legibility. Keep animations brief and tied to meaning—highlight a dependency when selected, trace a real series, or reveal the next stage—not constant decorative motion.
- Separate observed status from editorial narrative. A plan is not a delivery, an approval is not access, and a leading indicator is not the event's resolution.
- Keep mobile interaction shallow and test on actual mobile Safari/Chrome before expanding gestures. This pass was desktop inspection, not a mobile accessibility certification.

## Delivery order

1. Resolve hinge/date/likelihood semantics, stale text, and explicit scoring rules. Add claim-linked evidence and source freshness checks. No unsupported bulk probability recalibration.
2. Build three exemplary interactive spreads: population comparison, drug pipeline, and lunar prerequisites. Validate learning value and keyboard/mobile behavior; then extend the pattern by subject.
3. Introduce well-defined gene-editing, post-quantum migration, and useful-quantum-computation candidates; elevate grid/storage constraints. Retire or regroup weak narrative-only cards to avoid length inflation.
4. Show driver links and scenario assumptions; add immutable forecast vintages and eventual calibration. Broaden independent evidence, geography, and counterarguments before increasing apparent precision.

Success means a reader can explain the mechanism, identify the main bottleneck, inspect a dated source, and tell us exactly what would count as a miss.

## Primary-source checks

Accessed 2026-10-23 unless stated. These checks support the distinctions in this review; none independently validates the site's subjective percentages.

- **S1 — UN, WPP 2024 key messages.** Reference peak about 10.3bn in the mid-2080s, 10.2bn in 2100; demographic momentum matters. https://population.un.org/wpp/assets/Files/WPP2024_Key-Messages.pdf
- **S2 — METR, task-completion horizons.** Scope is predominantly software/ML/cyber tasks; a human-equivalent task duration is not continuous autonomous work. Page reports it is no longer actively updated. https://metr.org/time-horizons/
- **S3 — UNEP, Emissions Gap Report 2026, executive summary, especially sections 5 and 7.** Different policy pathways imply different warming outcomes; cooling pathways require substantial removals. Current-policy 2.8°C is presented at a 66% limiting probability, not as a guaranteed temperature. https://wedocs.unep.org/bitstreams/80aaab0e-2a6e-49d6-bd87-a5280fc786c7/download
- **S4 — FDA, AI for drug development.** AI is used across the product lifecycle; that does not establish that the molecule was AI-originated. https://www.fda.gov/about-fda/center-drug-evaluation-and-research-cder/artificial-intelligence-drug-development
- **S5 — NASA, Moon Base, updated October 20, 2026.** Phased access, infrastructure, and extended presence; a plan is not evidence of continuous occupation. https://www.nasa.gov/reference/moonbase-about/
- **S6 — Helion, May 10, 2023 PPA announcement.** Vendor primary for a contract and target: online by 2028, 50MW or more after a year of ramp-up. Not independent evidence of delivery. https://www.helionenergy.com/newsroom/helion-announces-worlds-first-fusion-ppa-with-microsoft
- **S7 — Bulletin, Clock FAQ.** Broader threats already included; the Clock is a metaphor and explicitly not a forecasting tool. https://thebulletin.org/doomsday-clock/faq/
- **S8 — Stanford Digital Economy Lab, Canaries, revised August 12, 2026.** Young exposed-worker employment divergence; authors label the findings descriptive rather than causal estimates. Preserve this qualification in hiring narratives. https://digitaleconomy.stanford.edu/publication/canaries-in-the-coal-mine-six-facts-about-the-recent-employment-effects-of-artificial-intelligence/
- **S9 — FDA, implanted BCI guidance, May 2021.** Feasibility/pivotal study considerations are not product premarket approval. https://www.fda.gov/regulatory-information/search-fda-guidance-documents/implanted-brain-computer-interface-bci-devices-patients-paralysis-or-amputation-non-clinical-testing
- **S10 — NIST, post-quantum cryptography.** Standards are available; migration is a separate deployment question. https://www.nist.gov/pqc
- **S11 — Bluvstein et al., fault-tolerant neutral-atom architecture, Nature, published November 10, 2025 (2026 volume).** Demonstrated architectural/error-correction progress; not proof of general commercial advantage. https://www.nature.com/articles/s41586-025-09848-5
- **S12 — FDA, December 8, 2023, Casgevy approval.** Established CRISPR treatment baseline. Do not generalize a specific disease approval into proof of broad longevity gains. https://www.fda.gov/news-events/press-announcements/fda-approves-first-gene-therapies-treat-patients-sickle-cell-disease
- **S13 — IEA, energy and AI, April 16, 2026.** Rising data-centre energy use and infrastructure constraints warrant explicit dependencies. https://www.iea.org/news/data-centre-electricity-use-surged-in-2025-even-with-tightening-bottlenecks-driving-a-scramble-for-solutions
- **S14 — Dario Amodei, We Must Pace the Frontier, September 2026.** Direct evidence of a proposal/commitment, not independent proof that a multilateral pacing agreement is operating. https://darioamodei.com/post/we-must-pace-the-frontier

## Event-by-event review

The following inventory counts distinct URLs in each event's revision history. “Citations” does not mean that each URL was independently verified here or supports every clause. Proposed tests are editorial work to complete, not silently adopted resolution rules.

| Prediction ID | Window | Citations / signals | Review action |
| --- | --- | ---: | --- |
| `agents-default-knowledge-work` | 2027 | 4 / 3 | High: scaled deployment at firms is not most work done by agents. Specify sectors, firm size, work share, survey denominator, and reliable use. |
| `entry-level-hiring-contracts` | 2027 | 4 / 3 | High: define geography, occupations, baseline and contraction threshold; distinguish descriptive association from AI attribution [S8]. |
| `labs-pace-the-frontier` | 2027 | 4 / 3 | Medium: keep the three-lab operational test; require an effective agreement and independent published evaluation, not endorsements [S14]. |
| `state-ai-laws-preempted` | 2027 | 3 / 3 | Medium: cite enacted text; specify scope and effective date. Separate enacted preemption from injunctions or proposed frameworks. |
| `ai-runs-rd-programs` | 2028 | 3 / 3 | High: require multi-month duration, autonomy level, scientific output and independent verification; remove the weaker single-publication alternative [S2]. |
| `first-ai-election` | 2028 | 3 / 3 | High: operationalize substantially/organizing issue through a fixed polling or content-analysis rule; distinguish AI from generic energy prices. |
| `helion-delivers-microsoft` | 2028–2030 | 1 / 3 | Medium: distinguish initial export from 50MW after ramp-up and annual net generation; obtain metered buyer/utility evidence [S6]. |
| `ai-cyberattack-infrastructure` | 2029 | 4 / 3 | High: define national-scale disruption, duration and attribution; separate malicious attack from accidental agent incident if both count. |
| `federal-ai-statute` | 2029 | 3 / 3 | Medium: align crisis-shaped summary with broader grading rule; identify mandatory provisions, enforceability and effective date. |
| `bci-permanent-approval` | 2029–2031 | 2 / 3 | Medium: keep explicit PMA test and name product/use; distinguish trial authorization, clearance, chronic implantation and commercial approval [S9]. |
| `compute-verification-talks` | 2030 | 3 / 3 | Medium: require official negotiations specifically addressing compute verification, not an AI safety dialogue or incident channel. |
| `china-crewed-moon` | 2030–2031 | 1 / 3 | Medium: keep landing plus safe return; clarify before-2030 target versus 2030–2031 window, and whether second nation is separately graded. |
| `fossil-co2-peak` | 2030–2033 | 1 / 3 | High: two declines identify a local candidate peak, not a permanent global maximum. Add confirmation period and data-revision policy. |
| `ai-drugs-phase-iii` | 2033 | 4 / 3 | High: split successful Phase III, approval counts and shorter trial duration; define AI-originated and at scale with named trial records [S4]. |
| `fusion-net-grid` | 2034 | 3 / 3 | Medium: strong annual-net test; add plant boundary, metering period and utility confirmation. Solar abundance is a separate claim. |
| `ubi-pilots-national` | 2034 | 0 / 3 | High: universal unconditional payments differ from means-tested income floors; specify eligibility, payment size, duration and enacted programs. |
| `superhuman-cognition` | 2034–2040 | 2 / 3 | High: every human at every measurable task is not practically adjudicable. Define a frozen task suite, reliability and independent evaluation. |
| `ai-chemistry-majority` | 2035 | 3 / 2 | High: specify numerator/denominator, small molecules versus biologics, attribution method and unknown-origin treatment; build molecule-level provenance [S4]. |
| `lunar-base-occupied` | 2035 | 4 / 2 | Medium: define maximum allowed gap in days and 12-month occupancy; split US-led and China-by-2038 claims. Use NASA plans as precursors [S5]. |
| `humanoids-in-homes` | 2036 | 4 / 3 | High: retail availability is not 1% household adoption. Specify autonomy, active use and denominator; independently verify deployment. |
| `hinge-resolves` | 2039 | 5 / 3 | Critical: reconcile .57 with .60, define what is being predicted, allow unresolved/mixed outcomes; derive branch-weighted totals. |
| `aging-therapy-approved` | 2043 | 1 / 2 | High: specify regulator, indication and human clinical endpoint; lifespan data alone do not substantiate slowed aging. Add gene editing without conflating it with rejuvenation. |
| `labor-cost-irrelevant` | 2045 | 0 / 2 | High: replace universal no-longer-decides language with measurable labor-share/location criteria across named industries; require sector evidence. |
| `population-peak` | 2046–2058 | 2 / 2 | High: show UN reference, full demographic assumptions and peak confirmation rule; specify what near 9.6bn means [S1]. |
| `two-degrees-breached` | 2050 | 2 / 3 | High: define temperature measure/window, breach threshold and declining-emissions condition; specify net-zero/removal dependencies [S3]. |
| `geoengineering-unilateral` | 2052 | 4 / 2 | High: define deployment versus research, minimum scale/duration, state authorization and unilateral; split geopolitical superlative from graded claim. |
| `mars-outpost` | 2052 | 0 / 2 | High: define permanent occupancy, resupply cadence and observation duration; add mission architecture evidence and prerequisite milestones. |
| `superintelligence-regime` | 2055 | 4 / 2 | High: define powers, membership, audit access, enforcement and duration; de facto dominance and a legitimate treaty are different outcomes. |
| `mass-casualty-event` | 2055 | 1 / 2 | Critical: reconcile 15%/2060 versus 17%/2055; define fatality threshold and attribution. Keep evidence discussion non-operational. |
| `population-declining` | 2065 | 2 / 1 | Medium: specify consecutive annual declines and dataset vintage; reconcile narrative prosperity with the narrower demographic question. |
| `healthy-lifespan-110` | 2072 | 0 / 2 | High: define healthy, broadly available, population and outcome measurement. Separate potential treatment access from observed 110-year healthy lifespans. |
| `bci-mainstream` | 2075 | 0 / 1 | High: fix adoption threshold, geography and nonmedical augmentation definition; medical success does not establish consumer demand. |
| `orbital-industry` | 2085 | 0 / 2 | High: specify asteroid-origin material quantities or revenue, customer and economic significance; sample return alone must not resolve it. |
| `off-earth-population` | 2100 | 0 / 0 | High: define resident versus visitor, counting date and threshold; add dated census source and intermediate watch signals. |
| `world-2100` | 2100 | 1 / 0 | High: split population, climate management, AI capability and social acceptance, or clearly label a narrative composite with no binary score. |
| `human-ai-continuity` | 2125–2175 | 0 / 0 | High: treat as an explicit scenario sketch unless continuity, uploading and protected human populations can be separately specified. |
| `self-sustaining-settlement` | 2150 | 0 / 0 | High: specify autonomy duration and dependencies including medicine, spare parts and reproduction; hypothetical forever-survival is untestable. |
| `clock-retired` | 2150 | 0 / 0 | High: correct rationale against current Bulletin scope [S7]; define official retirement/replacement and move to institutional watchlist or sketch. |
| `the-silence` | 2180 | 1 / 0 | Medium: label probability as silence through 2180, not event by 2180; define confirmation protocol and technosignature/contact scope. |
