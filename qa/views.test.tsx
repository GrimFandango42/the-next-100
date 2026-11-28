/**
 * This week and Odds, offline: the hash routes, the "what changed since" selectors (moves after a date, resolved lines,
 * market-gap deltas), what comes due, sorting and filtering, and server renders of both views.
 * Lines, markets and prices below are invented; nothing here reads data/market-history or the network.
 * Run: node --import tsx --test qa/views.test.tsx
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketLinks } from "../scripts/markets-schema";
import ThisWeek from "../src/components/ThisWeek";
import OddsView from "../src/components/OddsView";
import { data } from "../src/data";
import type { HistoryRow, MarketLink } from "../src/markets";
import { defaultView, hashFor, parseHash } from "../src/route";
import { ChangelogEntry, ForecastEvent } from "../src/schema";
import { StoreProvider } from "../src/store";
import { NO_FILTERS, checkinDates, comingDue, dueYear, filterRows, firstSentence, gapMoves, gradedOn, latestCheckin, movesSince, oddsRows, resolvedSince, signedPoints, sinceFor, sortRows } from "../src/views";

Object.defineProperty(globalThis, "location", { value: new URL("https://forecast.test/"), configurable: true });

const WRITTEN = "2026-10-22";
const ev = (id: string, o: Record<string, unknown> = {}): ForecastEvent => ForecastEvent.parse({
  id, year: 2030, domain: "ai", title: `Invented line ${id}`, summary: "An invented line for tests.", detail: "Invented.", confidence: "moderate",
  probability: 0.5, resolution: { test: "An invented test." }, ...o,
});
const move = (date: string, from: number, to: number, reason = `Moved on ${date}. More detail follows.`) => ({ date, change: `${from} → ${to}`, reason, from, to, sources: [] });
const log = (date: string, headline = `Check-in ${date}`, kind = "checkin") => ChangelogEntry.parse({ date, kind, headline, body: "Invented body." });
const link = (eventId: string, ticker: string, o: Record<string, unknown> = {}): MarketLink => MarketLinks.parse([{
  eventId, venue: "kalshi", market: { ticker, series: "KXTEST" }, label: `Invented market ${ticker}`, primary: true, match: "close", bar: "different", inverted: false, differs: "Invented.", addedOn: WRITTEN, ...o,
}])[0];
const row = (eventId: string, market: string, date: string, p: number, liquidity: number | null = 50_000): HistoryRow => ({ eventId, venue: "kalshi", market, date, p, liquidity });

// ------------------------------------------------------------------------------------------------------------ routes

test("hash routes: the three views, line deep links, old book links and the default", () => {
  const ids = new Set(["alpha-line", "beta-line"]);
  assert.deepEqual(parseHash("", ids, "book"), { view: "book" });
  assert.deepEqual(parseHash("", ids, "week"), { view: "week" });
  assert.deepEqual(parseHash("#week", ids, "book"), { view: "week" });
  assert.deepEqual(parseHash("#odds", ids, "book"), { view: "odds" });
  assert.deepEqual(parseHash("#book", ids, "week"), { view: "book" });
  assert.deepEqual(parseHash("#line-alpha-line", ids, "book"), { view: "odds", line: "alpha-line" });
  assert.deepEqual(parseHash("#alpha-line", ids, "book"), { view: "odds", line: "alpha-line" }, "the old copy-link form");
  assert.deepEqual(parseHash("#m-beta-line", ids, "week"), { view: "book", anchor: "story-beta-line", line: "beta-line" });
  assert.deepEqual(parseHash("#story-beta-line", ids, "week"), { view: "book", anchor: "story-beta-line" });
  assert.deepEqual(parseHash("#chapter-one", ids, "week"), { view: "book", anchor: "chapter-one" });
  assert.deepEqual(parseHash("#explore", ids, "week"), { view: "book", anchor: "explore" });
  assert.deepEqual(parseHash("#line-unknown", ids, "week"), { view: "book", anchor: "line-unknown" }, "an unknown line is not an Odds deep link");
  assert.equal(hashFor({ view: "odds", line: "alpha-line" }), "#line-alpha-line");
  assert.equal(hashFor({ view: "odds" }), "#odds");
  assert.equal(hashFor({ view: "week", line: "alpha-line" }), "#week", "a drawer over This week does not change its hash");
  assert.equal(hashFor({ view: "book", anchor: "story-x" }), "#story-x");
  for (const h of ["#week", "#odds", "#book", "#line-beta-line"]) assert.equal(hashFor(parseHash(h, ids, "book")), h, `${h} round-trips`);
  assert.equal(defaultView(null), "book", "first visit: the book");
  assert.equal(defaultView("2026-11-16"), "week", "returning reader: This week");
});

test("every real line id routes to Odds with its drawer", () => {
  const ids = new Set(data.events.map((e) => e.id));
  for (const id of ids) assert.deepEqual(parseHash(`#line-${id}`, ids, "book"), { view: "odds", line: id });
});

// -------------------------------------------------------------------------------------------------------- what changed

test("the window: a reader on an older edition sees everything since it; a current or new reader sees the latest check-in", () => {
  const checkins = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"];
  assert.deepEqual(sinceFor("2026-11-09", "2026-11-23", checkins, WRITTEN), { date: "2026-11-09", mode: "visit", checkin: "2026-11-23" });
  assert.deepEqual(sinceFor("2026-11-23", "2026-11-23", checkins, WRITTEN), { date: "2026-11-16", mode: "checkin", checkin: "2026-11-23" });
  assert.deepEqual(sinceFor(null, "2026-11-23", checkins, WRITTEN), { date: "2026-11-16", mode: "checkin", checkin: "2026-11-23" });
  assert.deepEqual(sinceFor(null, "2026-11-02", ["2026-11-02"], WRITTEN), { date: WRITTEN, mode: "checkin", checkin: "2026-11-02" }, "the first check-in looks back to launch");
  assert.deepEqual(checkinDates([log("2026-11-09"), log("2026-11-02"), log("2026-11-09"), log("2026-11-05", "A note", "note")]), ["2026-11-02", "2026-11-09"]);
  assert.equal(latestCheckin([log("2026-11-02"), log("2026-11-30", "A later note", "note"), log("2026-11-09")])?.date, "2026-11-09");
});

test("moves after a date: only moves inside the window, netted per line, biggest first, with the last reason's first sentence", () => {
  const events = [
    ev("old-move", { history: [move("2026-11-02", 0.4, 0.5)] }),
    ev("one-move", { history: [move("2026-11-02", 0.4, 0.5), move("2026-11-23", 0.5, 0.55, "Chips fell 38% to 0.55. The rest is detail.")], probability: 0.55 }),
    ev("two-moves", { history: [move("2026-11-16", 0.3, 0.2), move("2026-11-23", 0.2, 0.1, "Second move.")], probability: 0.1 }),
    ev("round-trip", { history: [move("2026-11-16", 0.6, 0.7), move("2026-11-23", 0.7, 0.6)], probability: 0.6 }),
    ev("not-a-move", { history: [{ date: "2026-11-23", change: "Test reworded", reason: "Wording.", sources: [] }] }),
  ];
  const got = movesSince(events, "2026-11-09");
  assert.deepEqual(got.map((m) => m.event.id), ["two-moves", "one-move"]);
  assert.deepEqual(got.map((m) => [m.from, m.to, m.count, m.date]), [[0.3, 0.1, 2, "2026-11-23"], [0.5, 0.55, 1, "2026-11-23"]]);
  assert.equal(got[1].reason, "Chips fell 38% to 0.55.");
  assert.deepEqual(movesSince(events, "2026-11-23"), [], "a move on the since date itself is not after it");
  assert.deepEqual(movesSince(events, "2026-10-30").map((m) => m.event.id), ["two-moves", "one-move", "old-move"]);
});

test("first sentence: decimals and lower-case continuations do not end it", () => {
  assert.equal(firstSentence("ai-equity-drawdown 0.50 → 0.55. Then more."), "ai-equity-drawdown 0.50 → 0.55.");
  assert.equal(firstSentence("No full stop here"), "No full stop here");
  assert.equal(firstSentence("Fell to 9,011 on 5 Nov. (FRED) says so."), "Fell to 9,011 on 5 Nov.");
});

test("resolved lines: graded after the date, newest first; open lines and earlier gradings are left out", () => {
  const events = [
    ev("open-line"),
    ev("hit-early", { status: "early", resolvedOn: "2026-11-20" }),
    ev("missed-line", { status: "missed", resolvedOn: "2026-11-22" }),
    ev("graded-before", { status: "happened", resolvedOn: "2026-11-01" }),
  ];
  assert.deepEqual(resolvedSince(events, "2026-11-16").map((e) => e.id), ["missed-line", "hit-early"]);
  assert.deepEqual(resolvedSince(events, "2026-11-22"), []);
});

test("resolved lines: selected by the day they were graded, not the day the event occurred", () => {
  const grade = (date: string, change: string) => ({ date, change, reason: "Invented grading." });
  const events = [
    // Occurred 1 October, graded at the 23 November check-in.
    ev("graded-late", { status: "happened", resolvedOn: "2026-10-01", history: [grade("2026-11-23", "status: forecast → happened")] }),
    // Graded 23 November; a later retitle must not move the grade date.
    ev("graded-then-edited", { status: "early", resolvedOn: "2026-09-15", history: [grade("2026-11-23", "graded early"), grade("2026-12-01", "title restored")] }),
    // Graded 2 November, before the window.
    ev("graded-earlier", { status: "missed", resolvedOn: "2026-10-20", history: [grade("2026-11-02", "status: forecast → missed")] }),
    // No grading entry: the first history entry on or after resolvedOn stands in.
    ev("unnamed-entry", { status: "partial", resolvedOn: "2026-10-05", history: [grade("2026-09-01", "added"), grade("2026-11-20", "detail rewritten")] }),
  ];
  assert.equal(gradedOn(events[0]), "2026-11-23");
  assert.equal(gradedOn(events[1]), "2026-11-23");
  assert.equal(gradedOn(events[3]), "2026-11-20");
  assert.equal(gradedOn(ev("open")), null);
  assert.deepEqual(resolvedSince(events, "2026-11-16").map((e) => e.id).sort(), ["graded-late", "graded-then-edited", "unnamed-entry"]);
  assert.deepEqual(resolvedSince(events, "2026-11-23"), []);
});

test("market gap deltas: the gap at the last check-in before the newest price against the gap now; 10 points or more counts", () => {
  const checkins = ["2026-11-16", "2026-11-23"];
  const events = [
    ev("gap-widens", { probability: 0.55 }), // 55 vs 70 then (gap −15), 55 vs 34 now (+21): moved 36
    ev("gap-steady", { probability: 0.4 }), // 40 vs 30 then, 40 vs 33 now: moved 3
    ev("exactly-ten", { probability: 0.5 }), // 50 vs 50 then, 50 vs 40 now: moved 10
    ev("forecast-moved", { probability: 0.7, history: [move("2026-11-25", 0.5, 0.7)] }), // 50 vs 50 then, 70 vs 50 now: moved 20
    ev("no-baseline-price", { probability: 0.5 }), // first price after the baseline
    ev("stale-price", { probability: 0.5 }), // no price after the baseline
    ev("no-market"),
  ];
  const links = ["gap-widens", "gap-steady", "exactly-ten", "forecast-moved", "no-baseline-price", "stale-price"].map((id) => link(id, id.toUpperCase()));
  const rows = [
    row("gap-widens", "GAP-WIDENS", "2026-11-22", 0.72), row("gap-widens", "GAP-WIDENS", "2026-11-23", 0.7), row("gap-widens", "GAP-WIDENS", "2026-11-27", 0.34),
    row("gap-steady", "GAP-STEADY", "2026-11-23", 0.3), row("gap-steady", "GAP-STEADY", "2026-11-27", 0.33),
    row("exactly-ten", "EXACTLY-TEN", "2026-11-21", 0.5), row("exactly-ten", "EXACTLY-TEN", "2026-11-27", 0.4),
    row("forecast-moved", "FORECAST-MOVED", "2026-11-23", 0.5), row("forecast-moved", "FORECAST-MOVED", "2026-11-27", 0.5),
    row("no-baseline-price", "NO-BASELINE-PRICE", "2026-11-25", 0.1), row("no-baseline-price", "NO-BASELINE-PRICE", "2026-11-27", 0.9),
    row("stale-price", "STALE-PRICE", "2026-11-20", 0.9),
  ];
  const got = gapMoves(events, links, rows, checkins, WRITTEN);
  assert.equal(got.baseline, "2026-11-23");
  assert.deepEqual(got.moves.map((m) => m.event.id), ["gap-widens", "forecast-moved", "exactly-ten"]);
  const w = got.moves[0];
  assert.equal(signedPoints(w.then), "−15");
  assert.equal(signedPoints(w.now), "+21");
  assert.deepEqual([w.forecast, w.market, w.date], [0.55, 0.34, "2026-11-27"]);
  assert.equal(signedPoints(got.moves[1].then), "0", "the forecast on the baseline day is read from its history");
  assert.deepEqual(gapMoves(events, links, rows, checkins, WRITTEN, 40).moves, [], "the threshold is a parameter");
  assert.deepEqual(gapMoves(events, links, [], checkins, WRITTEN), { baseline: null, moves: [] }, "no prices, no card");
  assert.deepEqual(gapMoves(events, links, rows.filter((r) => r.date <= "2026-11-16"), checkins, WRITTEN).baseline, null, "no check-in before the newest price");
});

test("coming due: open, scored lines by the end of their window", () => {
  assert.equal(dueYear(ev("a", { year: 2027, timing: "around" })), 2028);
  assert.equal(dueYear(ev("b", { year: 2027, timing: "by" })), 2027);
  assert.equal(dueYear(ev("c", { year: 2027, yearEnd: 2030, timing: "window" })), 2030);
  assert.equal(dueYear(ev("d", { year: 2035, timing: "through" })), 2035);
  const events = [
    ev("later", { year: 2029, timing: "by" }),
    ev("window-late", { year: 2026, yearEnd: 2031, timing: "window" }),
    ev("soonest", { year: 2027, timing: "by" }),
    ev("scenario", { year: 2026, timing: "by", resolution: { test: "None.", mode: "scenario" } }),
    ev("graded", { year: 2026, timing: "by", status: "happened", resolvedOn: "2026-11-01" }),
    ev("around", { year: 2027, timing: "around" }),
  ];
  assert.deepEqual(comingDue(events).map((e) => e.id), ["soonest", "around", "later"]);
});

// ---------------------------------------------------------------------------------------------------------------- odds

test("odds rows: odds now, change since launch, market, signed gap; sorting keeps empty cells last both ways", () => {
  const events = [
    ev("up-line", { title: "Bravo", year: 2031, probability: 0.6, history: [move("2026-11-09", 0.5, 0.6)] }),
    ev("down-line", { title: "Alpha", year: 2040, probability: 0.3, history: [move("2026-11-16", 0.45, 0.3)] }),
    ev("flat-line", { title: "Charlie", year: 2028, probability: 0.8, domain: "space" }),
    ev("scene-line", { title: "Delta", year: 2100, probability: undefined, resolution: { test: "None.", mode: "scenario" } }),
  ];
  const links = [link("up-line", "UP"), link("down-line", "DOWN", { match: "loose" })];
  const rows = [row("up-line", "UP", "2026-11-27", 0.45), row("down-line", "DOWN", "2026-11-27", 0.5)];
  const all = oddsRows(events, links, rows, WRITTEN, "2026-11-27");
  const by = (id: string) => all.find((r) => r.event.id === id)!;
  assert.deepEqual([by("up-line").now, by("up-line").launch, signedPoints(by("up-line").change!), by("up-line").moves, by("up-line").lastMove], [0.6, 0.5, "+10", 1, "2026-11-09"]);
  assert.equal(signedPoints(by("up-line").gap!), "+15");
  assert.equal(signedPoints(by("down-line").gap!), "−20");
  assert.deepEqual([by("flat-line").change, by("flat-line").market, by("flat-line").gap, by("flat-line").link], [0, null, null, undefined]);
  assert.deepEqual([by("scene-line").scenario, by("scene-line").now, by("scene-line").series], [true, null, null]);

  const ids = (key: Parameters<typeof sortRows>[1], dir: Parameters<typeof sortRows>[2]) => sortRows(all, key, dir).map((r) => r.event.id);
  assert.deepEqual(ids("when", "asc"), ["flat-line", "up-line", "down-line", "scene-line"]);
  assert.deepEqual(ids("title", "asc"), ["down-line", "up-line", "flat-line", "scene-line"]);
  assert.deepEqual(ids("now", "desc"), ["flat-line", "up-line", "down-line", "scene-line"]);
  assert.deepEqual(ids("now", "asc"), ["down-line", "up-line", "flat-line", "scene-line"], "scenarios sink in both directions");
  assert.deepEqual(ids("gap", "desc"), ["down-line", "up-line", "flat-line", "scene-line"], "gap sorts by size");
  assert.deepEqual(ids("market", "asc"), ["up-line", "down-line", "flat-line", "scene-line"]);
  assert.deepEqual(ids("match", "asc"), ["up-line", "down-line", "flat-line", "scene-line"]);
  assert.deepEqual(ids("trend", "desc"), ["down-line", "up-line", "flat-line", "scene-line"], "most recently moved first");

  const f = (o: Partial<typeof NO_FILTERS>) => filterRows(all, { ...NO_FILTERS, ...o }, 2026).map((r) => r.event.id).sort();
  assert.deepEqual(f({}), ["down-line", "flat-line", "scene-line", "up-line"]);
  assert.deepEqual(f({ moved: true }), ["down-line", "up-line"]);
  assert.deepEqual(f({ market: true }), ["down-line", "up-line"]);
  assert.deepEqual(f({ soon: true }), ["flat-line"], "due by 2031: the 2028 line (around → 2029); the 2031 line is due 2032");
  assert.deepEqual(f({ domains: new Set(["space"] as const) }), ["flat-line"]);
  assert.deepEqual(f({ query: "ALPHA" }), ["down-line"]);
  assert.deepEqual(f({ query: "flat-line" }), ["flat-line"], "ids are searchable");
});

test("the real data: one odds row per line, and every line's change since launch is its recorded moves", () => {
  const all = oddsRows(data.events, [], [], data.meta.written, "2026-11-27");
  assert.equal(all.length, data.events.length);
  for (const r of all) {
    if (r.scenario) continue;
    const moves = r.event.history.filter((h) => h.from != null && h.to != null);
    assert.equal(r.moves, moves.length, r.event.id);
    assert.equal(r.now, r.event.probability, r.event.id);
  }
});

// -------------------------------------------------------------------------------------------------------------- renders

const render = (el: React.ReactElement) => renderToStaticMarkup(<StoreProvider>{el}</StoreProvider>);

test("This week: a quiet week says so in one line, and the gap card is hidden when no gap moved", () => {
  const events = [ev("quiet-a", { year: 2027, timing: "by" }), ev("quiet-b", { year: 2028, timing: "by" })];
  const html = render(<ThisWeek events={events} changelog={[log("2026-11-16"), log("2026-11-23", "A quiet invented week")]} links={[]} rows={[]} lastSeen="2026-11-23" />);
  assert.match(html, /A quiet invented week/);
  assert.equal((html.match(/data-card="quiet"/g) ?? []).length, 1);
  assert.match(html, />Nothing moved and nothing resolved at the Nov 23 check-in\.</);
  assert.doesNotMatch(html, /data-card="moved"|data-card="resolved"|data-card="gaps"/);
  assert.equal((html.match(/data-card="due"/g) ?? []).length, 1);
  assert.deepEqual([...html.matchAll(/data-card="due"[\s\S]*?<\/section>/g)][0][0].match(/data-line="([^"]+)"/g), ['data-line="quiet-a"', 'data-line="quiet-b"']);
});

test("This week: a returning reader sees moves since their last edition, resolutions, and the gap card", () => {
  const events = [
    ev("moved-line", { probability: 0.55, history: [move("2026-11-16", 0.5, 0.55, "Invented reason. More.")] }),
    ev("graded-line", { status: "early", resolvedOn: "2026-11-20" }),
    ev("gap-line", { probability: 0.55 }),
  ];
  const links = [link("gap-line", "GAP")];
  const rows = [row("gap-line", "GAP", "2026-11-23", 0.7), row("gap-line", "GAP", "2026-11-27", 0.34, 200)];
  const html = render(<ThisWeek events={events} changelog={[log("2026-11-09"), log("2026-11-16"), log("2026-11-23")]} links={links} rows={rows} lastSeen="2026-11-09" />);
  assert.match(html, /Moved since your last visit \(check-ins after Nov 9\)/);
  assert.match(html, /data-line="moved-line"[\s\S]*?50%[\s\S]*?55%[\s\S]*?Invented reason\./);
  assert.match(html, /data-card="resolved"[\s\S]*?data-line="graded-line"[\s\S]*?Happened early/);
  assert.match(html, /data-card="gaps"[\s\S]*?since Nov 23[\s\S]*?data-line="gap-line"[\s\S]*?−15[\s\S]*?\+21[\s\S]*?a thin market/);
  assert.doesNotMatch(html, /data-card="quiet"/);
});

test("Odds: one row per line, a sparkline per scored line, and sortable column headers", () => {
  const html = render(<OddsView links={[]} rows={[]} today="2026-11-27" />);
  const rowsIn = [...html.matchAll(/<tr data-line="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(rowsIn.length, data.events.length);
  assert.deepEqual(new Set(rowsIn), new Set(data.events.map((e) => e.id)));
  const scored = data.events.filter((e) => e.probability != null && e.resolution?.mode !== "scenario").length;
  assert.equal((html.match(/data-series="forecast"/g) ?? []).length, scored);
  assert.equal((html.match(/data-series="market"/g) ?? []).length, 0, "no market line without prices");
  assert.equal((html.match(/<th scope="col"/g) ?? []).length, 8);
  assert.match(html, /aria-sort="ascending"[^>]*>|class="c-when" aria-sort="ascending"/);
  assert.match(html, new RegExp(`All ${data.events.length} lines`));
});

test("Odds: a linked market draws its own line beside the forecast", () => {
  const e = data.events.find((x) => x.probability != null && x.resolution?.mode !== "scenario")!;
  const links = [link(e.id, "INVENTED")];
  const rows = [row(e.id, "INVENTED", "2026-11-20", 0.2), row(e.id, "INVENTED", "2026-11-21", 0.25)];
  const html = render(<OddsView events={[e]} links={links} rows={rows} today="2026-11-27" />);
  assert.equal((html.match(/data-series="market"/g) ?? []).length, 1);
  assert.match(html, /class="c-market mono"[^>]*>25%</);
  assert.match(html, /class="pill match-close"/);
});
