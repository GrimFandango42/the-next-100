/**
 * The market feed, offline. Every test reads the recorded responses in qa/fixtures/markets or builds its own data in a temp dir;
 * globalThis.fetch is replaced with a stub that fails the test if anything tries to reach the network.
 * Run: node --import tsx --test qa/markets.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { MarketLinks, validateHistory, validateLinks, type HistoryRow, type MarketLink } from "../scripts/markets-schema";
import { appendHistory, mergeRows, primaryPricesOn, readHistory, stringifyLinks } from "../scripts/markets-store";
import {
  applyInversion, dayPrices, findPolymarketMarket, fixtureAdapter, kalshiDayPrice, lastPrintPerDay, liveAdapter, parseKalshiCandles, parseKalshiMarket,
  parsePolymarketHistory, parsePolymarketMarket, pull, type Adapter, type Snapshot,
} from "../scripts/markets-pull";
import { writeVintage } from "../scripts/vintage";

const repo = resolve(import.meta.dirname, "..");
const fx = resolve(repo, "qa/fixtures/markets");
type J = Record<string, unknown>;
const json = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"));
const seed = MarketLinks.parse(json(resolve(fx, "links-seed.json")));
const link = (eventId: string, venue: "kalshi" | "polymarket", primary?: boolean): MarketLink => {
  const l = seed.find((x) => x.eventId === eventId && x.venue === venue && (primary === undefined || x.primary === primary));
  assert.ok(l, `seed has ${eventId} ${venue}`);
  return l;
};
const eventIds = new Set((json(resolve(repo, "data/events.json")) as { id: string }[]).map((e) => e.id));
const temp = (): string => mkdtempSync(resolve(tmpdir(), "markets-test-"));
const sha = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");
const lf = (s: string): string => s.replace(/\r\n/g, "\n");

let realFetch: typeof fetch;
let networkCalls = 0;
before(() => { realFetch = globalThis.fetch; globalThis.fetch = (() => { networkCalls++; throw new Error("network attempted in an offline test"); }) as typeof fetch; });
after(() => { globalThis.fetch = realFetch; assert.equal(networkCalls, 0); });

// ---------------------------------------------------------------------------------------------------- Kalshi price rule

const rawCandles = parseKalshiCandles(json(resolve(fx, "raw-kalshi-candlesticks.json")));
const pickedKalshi = (json(resolve(fx, "kalshi-picked-2026-11-27.json")) as J[]);
const pickedDays = (ticker: string) => (pickedKalshi.find((e) => e.ticker === ticker)?.history as J[]).map((h) => ({ date: String(h.d), bid: h.bid === null ? null : Number(h.bid), ask: h.ask === null ? null : Number(h.ask), last: h.last === null ? null : Number(h.last) }));

test("kalshi: recorded candles parse to one day each, dated by the UTC day the candle closes", () => {
  assert.ok(rawCandles.length >= 40);
  assert.equal(rawCandles[0].date, "2026-10-16");
  assert.equal(new Set(rawCandles.map((d) => d.date)).size, rawCandles.length);
  const picked = new Map(pickedDays("KXWARMING-50").map((d) => [d.date, d]));
  let compared = 0;
  for (const d of rawCandles) {
    const p = picked.get(d.date);
    if (!p) continue;
    compared++;
    assert.deepEqual({ bid: d.bid, ask: d.ask, last: d.last }, { bid: p.bid, ask: p.ask, last: p.last }, d.date);
  }
  assert.ok(compared >= 40, `compared ${compared} days`);
});

test("kalshi: a tight spread takes the midpoint of the closing bid and ask, even on a day with a trade", () => {
  const day = rawCandles.find((d) => d.date === "2026-10-19");
  assert.ok(day);
  assert.deepEqual([day.bid, day.ask, day.last], [0.66, 0.68, 0.69]);
  assert.equal(kalshiDayPrice(day), 0.67);
  // and a day with no trade at all still gets its midpoint
  const quiet = rawCandles.find((d) => d.date === "2026-10-16");
  assert.ok(quiet && quiet.last === null);
  assert.equal(kalshiDayPrice(quiet), 0.67);
});

test("kalshi: a spread above 0.15 falls back to that day's last trade; exactly 0.15 still uses the midpoint", () => {
  const recorded = rawCandles.find((d) => d.date === "2026-10-19");
  assert.ok(recorded);
  // The recorded candle with its closing bid pulled down to open a 0.28 spread: the 0.69 last trade wins.
  assert.equal(kalshiDayPrice({ ...recorded, bid: 0.4 }), 0.69);
  assert.equal(kalshiDayPrice({ bid: 0.55, ask: 0.7, last: 0.9 }), 0.625);
  assert.equal(kalshiDayPrice({ bid: 0.55, ask: 0.71, last: 0.9 }), 0.9);
  assert.equal(kalshiDayPrice({ bid: 0, ask: 1, last: 0.3 }), 0.3);
  assert.equal(kalshiDayPrice({ bid: null, ask: 0.5, last: 0.3 }), 0.3);
});

test("kalshi: recorded wide-spread days without a trade give no price, and the pipeline writes no row for them", () => {
  let wideNoTrade = 0, wideTrade = 0;
  for (const e of pickedKalshi) for (const d of pickedDays(String(e.ticker))) {
    if (d.bid === null || d.ask === null || Math.round((d.ask - d.bid) * 100) <= 15) continue;
    if (d.last === null) { wideNoTrade++; assert.equal(kalshiDayPrice(d), null, `${e.ticker} ${d.date}`); }
    else { wideTrade++; assert.equal(kalshiDayPrice(d), d.last, `${e.ticker} ${d.date}`); }
  }
  assert.ok(wideNoTrade > 0, "the recordings contain wide quotes with no trade");
  const l = link("federal-ai-statute", "kalshi");
  const snap: Snapshot = { venue: "kalshi", days: pickedDays("KXAILEGISLATION-27-28JAN01").map((d) => ({ ...d, oi: null })), liquidityNow: 2105.11, resolved: null, warnings: [] };
  const { prices, warnings } = dayPrices(snap, l);
  assert.ok(warnings.length === 1 && /no usable price/.test(warnings[0]));
  assert.ok(prices.length < snap.days.length);
  assert.ok(prices.every((p) => p.p >= 0 && p.p <= 1));
  const dropped = snap.days.filter((d) => !prices.some((p) => p.date === d.date));
  assert.ok(dropped.length > 0 && dropped.every((d) => kalshiDayPrice(d) === null), "dropped days are exactly the ones with no price; none is filled from another day");
  void wideTrade;
});

// ------------------------------------------------------------------------------------------------ Polymarket price rule

test("polymarket: the last print of the UTC day, whatever order the prints arrive in", () => {
  const day = 1792108800; // 2026-10-16T00:00:00Z
  const prints = [
    { date: "2026-10-16", p: 0.31, t: day + 80000 },
    { date: "2026-10-16", p: 0.2, t: day + 100 },
    { date: "2026-10-17", p: 0.4, t: day + 86400 + 5 },
  ];
  assert.deepEqual(lastPrintPerDay(prints), [{ date: "2026-10-16", p: 0.31 }, { date: "2026-10-17", p: 0.4 }]);
  // t = 23:59:59 stays on its own day; the next second is the next day
  assert.deepEqual(parsePolymarketHistory({ history: [{ t: day + 86399, p: 0.5 }, { t: day + 86400, p: 0.6 }] }).map((x) => x.date), ["2026-10-16", "2026-10-17"]);
});

test("polymarket: recorded history reduces to one price per UTC day, equal to that day's last print", () => {
  const recorded = parsePolymarketHistory(json(resolve(fx, "raw-polymarket-prices-history.json")));
  assert.ok(recorded.length >= 30);
  const days = lastPrintPerDay(recorded);
  assert.equal(new Set(days.map((d) => d.date)).size, days.length);
  for (const d of days) {
    const sameDay = recorded.filter((x) => x.date === d.date).sort((a, b) => (a.t as number) - (b.t as number));
    assert.equal(d.p, sameDay[sameDay.length - 1].p, d.date);
  }
});

test("polymarket: fixture adapter returns the last recorded print of a day with several", async () => {
  const adapter = fixtureAdapter(fx);
  // Recorded: this market printed 0.485, 0.18 and 0.105 across 2026-11-26/27; the last print of 2026-11-27 is the price.
  const l = { ...link("taiwan-chip-supply-shock", "polymarket", true), market: { slug: "will-china-blockade-taiwan-by-june-30-2027", eventSlug: "will-china-blockade-taiwan-by-in-2026" } } as MarketLink;
  const snap = await adapter.read(l, "2026-10-16");
  assert.equal(snap.venue, "polymarket");
  const { prices } = dayPrices(snap, l);
  const last = prices[prices.length - 1];
  assert.equal(last.date, "2026-11-27");
  assert.equal(last.p, 0.105);
  assert.equal(last.liquidity, 10819.2367);
});

// --------------------------------------------------------------------------------------------------------------- inversion

test("inversion: 1 - p is applied after price selection, to midpoint and last-trade prices alike", () => {
  assert.equal(applyInversion(0.3, true), 0.7);
  assert.equal(applyInversion(0.3, false), 0.3);
  assert.equal(applyInversion(0.0445, true), 0.9555);
  const silence = link("the-silence", "kalshi");
  assert.equal(silence.inverted, true);
  const mid: Snapshot = { venue: "kalshi", days: [{ date: "2026-11-01", bid: 0.2, ask: 0.3, last: 0.9, oi: 5 }], liquidityNow: null, resolved: null, warnings: [] };
  assert.equal(dayPrices(mid, silence).prices[0].p, 0.75);
  const wide: Snapshot = { venue: "kalshi", days: [{ date: "2026-11-01", bid: 0.1, ask: 0.5, last: 0.2, oi: 5 }], liquidityNow: null, resolved: null, warnings: [] };
  assert.equal(dayPrices(wide, silence).prices[0].p, 0.8);
  assert.equal(dayPrices(wide, { ...silence, inverted: false }).prices[0].p, 0.2);
});

test("a price outside [0,1] is dropped with a warning, never clamped or carried forward", () => {
  const l = link("two-degrees-breached", "kalshi");
  const snap: Snapshot = { venue: "kalshi", days: [{ date: "2026-11-01", bid: 0.5, ask: 0.52, last: null, oi: 1 }, { date: "2026-11-02", bid: null, ask: null, last: 1.4, oi: 1 }, { date: "2026-11-03", bid: null, ask: null, last: null, oi: 1 }], liquidityNow: null, resolved: null, warnings: [] };
  const { prices, warnings } = dayPrices(snap, l);
  assert.deepEqual(prices.map((p) => p.date), ["2026-11-01"]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /2 day\(s\)/);
});

// ------------------------------------------------------------------------------------------------- append never rewrites

const row = (date: string, p: number, over: Partial<HistoryRow> = {}): HistoryRow => ({ eventId: "two-degrees-breached", venue: "kalshi", market: "KXWARMING-50", date, p, liquidity: null, ...over });

test("append: existing rows are kept byte for byte; only unseen (event, venue, market, date) keys are added", () => {
  const root = temp();
  try {
    const first = appendHistory([row("2026-11-20", 0.6), row("2026-11-21", 0.61), row("2026-12-01", 0.62)], root);
    assert.equal(first.length, 3);
    const nov = resolve(root, "data/market-history/2026-11.json"), dec = resolve(root, "data/market-history/2026-12.json");
    assert.deepEqual(readdirSync(resolve(root, "data/market-history")).sort(), ["2026-11.json", "2026-12.json"]);
    const before = [sha(nov), sha(dec)];
    // same dates, different prices: nothing is rewritten and nothing is written
    assert.deepEqual(appendHistory([row("2026-11-20", 0.99), row("2026-12-01", 0.01)], root), []);
    assert.deepEqual([sha(nov), sha(dec)], before);
    // an unseen date is added; the old rows are still the old rows
    assert.equal(appendHistory([row("2026-11-20", 0.99), row("2026-11-19", 0.5), row("2026-11-22", 0.63, { market: "KXOTHER", eventId: "fusion-net-grid" })], root).length, 2);
    const rows = readHistory(root);
    assert.equal(rows.length, 5);
    assert.equal(rows.find((r) => r.date === "2026-11-20")?.p, 0.6);
    assert.deepEqual(rows.map((r) => r.date), [...rows.map((r) => r.date)].sort());
    assert.equal(sha(dec), before[1], "the December file was not touched");
    assert.equal(new Set(rows.map((r) => `${r.eventId}|${r.venue}|${r.market}|${r.date}`)).size, rows.length);
    // running the same thing again is a no-op
    const again = [sha(nov), sha(dec)];
    assert.deepEqual(appendHistory(rows, root), []);
    assert.deepEqual([sha(nov), sha(dec)], again);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("mergeRows: duplicates inside one batch collapse to the first; output is sorted", () => {
  const { added, merged } = mergeRows([row("2026-11-20", 0.6)], [row("2026-11-19", 0.5), row("2026-11-19", 0.9), row("2026-11-20", 0.1)]);
  assert.deepEqual(added.map((r) => r.p), [0.5]);
  assert.deepEqual(merged.map((r) => r.date), ["2026-11-19", "2026-11-20"]);
});

// ----------------------------------------------------------------------------------------------------------- validation

test("seed: 23 links, 19 primary, 19 distinct primary events; data/markets.json is the same list and the same text", () => {
  assert.equal(seed.length, 23);
  const primaries = seed.filter((l) => l.primary);
  assert.equal(primaries.length, 19);
  assert.equal(new Set(primaries.map((l) => l.eventId)).size, 19);
  const data = json(resolve(repo, "data/markets.json"));
  assert.deepEqual(data, json(resolve(fx, "links-seed.json")));
  assert.equal(lf(stringifyLinks(seed)), lf(readFileSync(resolve(repo, "data/markets.json"), "utf8")), "the writer reproduces the committed file exactly");
  assert.deepEqual(validateLinks(data, eventIds), []);
  for (const l of seed) assert.ok(l.differs.length > 20 && l.label.length > 5);
});

test("validator: rejects an unknown eventId, two primaries for one event, and a duplicate market", () => {
  const copy = (): MarketLink[] => structuredClone(seed);
  const bad1 = copy(); bad1[0].eventId = "no-such-line";
  assert.ok(validateLinks(bad1, eventIds).some((e) => /unknown eventId no-such-line/.test(e)));
  const bad2 = copy(); const second = bad2.find((l) => l.eventId === "next-pandemic" && !l.primary);
  assert.ok(second); second.primary = true;
  assert.ok(validateLinks(bad2, eventIds).some((e) => /next-pandemic has 2 primary links/.test(e)));
  const bad3 = [...copy(), structuredClone(seed[0])];
  assert.ok(validateLinks(bad3, eventIds).some((e) => /duplicate link/.test(e)));
  const bad4 = copy() as unknown[]; (bad4[0] as J).match = "exact";
  assert.ok(validateLinks(bad4, eventIds).length > 0);
  const bad5 = copy() as unknown[]; delete (bad5[1] as J).differs;
  assert.ok(validateLinks(bad5, eventIds).length > 0);
  assert.deepEqual(validateLinks([], eventIds), []);
});

test("validator: history rows must have a link, the right month file, and a unique key", () => {
  const good = [row("2026-11-20", 0.6)];
  assert.deepEqual(validateHistory([{ file: "2026-11.json", rows: good }], seed), []);
  assert.ok(validateHistory([{ file: "2026-12.json", rows: good }], seed).some((e) => /wrong month/.test(e)));
  assert.ok(validateHistory([{ file: "2026-11.json", rows: [row("2026-11-20", 0.6, { market: "KXNOPE" })] }], seed).some((e) => /no link/.test(e)));
  assert.ok(validateHistory([{ file: "2026-11.json", rows: [good[0], good[0]] }], seed).some((e) => /duplicate row/.test(e)));
  assert.ok(validateHistory([{ file: "2026-11.json", rows: [row("2026-11-20", 1.5)] }], seed).length > 0);
});

// -------------------------------------------------------------------------------------------------------------- parsers

test("kalshi market: an active market is unresolved; a settled yes/no is recorded; anything murkier is a warning", () => {
  const live = parseKalshiMarket(json(resolve(fx, "raw-kalshi-market.json")), "2026-11-27");
  assert.equal(live.resolved, null);
  assert.equal(live.openInterest, 4093.14);
  assert.deepEqual(live.warnings, []);
  const done = parseKalshiMarket({ market: { status: "finalized", result: "yes", settlement_ts: "2027-03-02T15:00:00Z" } }, "2027-04-01");
  assert.deepEqual(done.resolved, { on: "2027-03-02", outcome: "yes" });
  assert.deepEqual(parseKalshiMarket({ market: { status: "determined", result: "no" } }, "2027-04-01").resolved, { on: "2027-04-01", outcome: "no" });
  const murky = parseKalshiMarket({ market: { status: "closed", result: "" } }, "2027-04-01");
  assert.equal(murky.resolved, null);
  assert.equal(murky.warnings.length, 1);
});

test("polymarket market: finds the market by slug, its Yes token and liquidity; resolves only a settled market", () => {
  const event = json(resolve(fx, "raw-polymarket-event.json"));
  const open = findPolymarketMarket(event, "ai-bubble-burst-by-june-30-2027");
  assert.ok(open);
  const o = parsePolymarketMarket(open, "2026-11-27");
  assert.ok(o.token && /^\d{20,}$/.test(o.token));
  assert.equal(o.resolved, null);
  assert.equal(o.liquidity, 24514.8206);
  const done = findPolymarketMarket(event, "ai-industry-downturn-by-march-31-2026-547");
  assert.ok(done);
  assert.deepEqual(parsePolymarketMarket(done, "2026-11-27").resolved, { on: "2026-04-01", outcome: "no" });
  assert.equal(findPolymarketMarket(event, "nope"), null);
  const ambiguous = parsePolymarketMarket({ closed: true, umaResolutionStatus: "proposed", outcomes: '["Yes","No"]', outcomePrices: '["0.6","0.4"]' }, "2026-11-27");
  assert.equal(ambiguous.resolved, null);
  assert.equal(ambiguous.warnings.length, 1);
});

// ------------------------------------------------------------------------------------------------------------- pipeline

test("pull (fixtures): one price for each of the 19 primary links, inside [0,1], no network, and nothing is written", async () => {
  const result = await pull({ links: seed, adapter: fixtureAdapter(fx), history: [], defaultSince: "2026-11-23" });
  const primary = result.lines.filter((l) => l.link.primary);
  assert.equal(primary.length, 19);
  assert.equal(new Set(primary.map((l) => l.link.eventId)).size, 19);
  for (const l of primary) assert.ok(l.p >= 0 && l.p <= 1 && /^\d{4}-\d{2}-\d{2}$/.test(l.date), l.link.eventId);
  const silence = primary.find((l) => l.link.eventId === "the-silence");
  assert.ok(silence && silence.link.inverted);
  assert.ok(result.rows.length > 0 && result.rows.every((r) => r.date >= "2026-11-23"));
  assert.equal(networkCalls, 0);
});

test("pull: starts at each link's latest stored day, skips resolved links, and reports a failing read without stopping", async () => {
  const a = link("two-degrees-breached", "kalshi"), b = link("fusion-net-grid", "kalshi"), c = link("mars-outpost", "kalshi");
  const calls: string[] = [];
  const adapter: Adapter = {
    async read(l, since) {
      calls.push(`${l.eventId}@${since}`);
      if (l.eventId === "mars-outpost") throw new Error("429");
      return { venue: "kalshi", days: [{ date: "2026-11-24", bid: 0.4, ask: 0.42, last: null, oi: 9 }, { date: "2026-11-25", bid: 0.5, ask: 0.52, last: null, oi: 9 }], liquidityNow: null, resolved: null, warnings: [] };
    },
  };
  const result = await pull({ links: [a, { ...b, resolved: { on: "2026-11-01", outcome: "no" } }, c], adapter, history: [row("2026-11-24", 0.41)], defaultSince: "2026-11-10" });
  assert.deepEqual(calls, ["two-degrees-breached@2026-11-24", "mars-outpost@2026-11-10"]);
  assert.deepEqual(result.rows.map((r) => r.date), ["2026-11-25"], "the stored 2026-11-24 row is not produced again");
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /mars-outpost.*read failed \(429\)/);
});

test("pull: a market that has settled is reported as resolved and produces no rows", async () => {
  const a = link("two-degrees-breached", "kalshi");
  const adapter: Adapter = { async read() { return { venue: "kalshi", days: [], liquidityNow: null, resolved: { on: "2026-12-01", outcome: "yes" }, warnings: [] }; } };
  const result = await pull({ links: [a], adapter, history: [], defaultSince: "2026-11-23" });
  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.resolved.map((r) => r.resolved), [{ on: "2026-12-01", outcome: "yes" }]);
});

// ---------------------------------------------------------------------------------------------- live adapter, stubbed

test("live adapter: builds the documented URLs, spaces Kalshi calls 700 ms apart, retries a 429 a bounded number of times", async () => {
  const kalshiMarket = json(resolve(fx, "raw-kalshi-market.json")), candles = json(resolve(fx, "raw-kalshi-candlesticks.json"));
  const event = json(resolve(fx, "raw-polymarket-event.json")), hist = json(resolve(fx, "raw-polymarket-prices-history.json"));
  const urls: string[] = [], sleeps: number[] = [];
  let tooMany = 1;
  const stub = (async (url: string) => {
    urls.push(url);
    const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    if (url.includes("/series/")) { if (tooMany-- > 0) return { ok: false, status: 429, json: async () => ({}) }; return ok(candles); }
    if (url.includes("/trade-api/v2/markets/")) return ok(kalshiMarket);
    if (url.includes("/events/slug/")) return ok(event);
    if (url.includes("/prices-history")) return ok(hist);
    return { ok: false, status: 404, json: async () => ({}) };
  }) as unknown as typeof fetch;
  const adapter = liveAdapter({ fetchImpl: stub, sleep: async (ms) => { sleeps.push(ms); }, today: "2026-11-27" });

  const k = await adapter.read(link("two-degrees-breached", "kalshi"), "2026-10-16");
  assert.equal(k.venue, "kalshi");
  assert.ok(urls[0].startsWith("https://external-api.kalshi.com/trade-api/v2/markets/KXWARMING-50"));
  assert.ok(urls[1].startsWith("https://external-api.kalshi.com/trade-api/v2/series/KXWARMING/markets/KXWARMING-50/candlesticks?"));
  assert.match(urls[1], /period_interval=1440/);
  assert.match(urls[1], /start_ts=\d+&end_ts=\d+/);
  assert.equal(urls.filter((u) => u.includes("/series/")).length, 2, "one 429, one retry");
  assert.ok(sleeps.some((ms) => ms >= 2000), "backed off after the 429");
  if (k.venue === "kalshi") { assert.ok(k.days.length >= 40); assert.equal(k.liquidityNow, 4093.14); }

  urls.length = 0; sleeps.length = 0;
  const l: MarketLink = { ...link("ai-equity-drawdown", "polymarket"), market: { slug: "ai-bubble-burst-by-june-30-2027", eventSlug: "ai-bubble-burst-by" } };
  const p = await adapter.read(l, "2026-10-16");
  await adapter.read(l, "2026-10-16");
  assert.equal(urls.filter((u) => u.includes("/events/slug/ai-bubble-burst-by")).length, 1, "the event is fetched once and shared");
  assert.ok(urls.some((u) => u.startsWith("https://clob.polymarket.com/prices-history?market=54930692724987225021792924039023958542270805785463374293701614625470107640058&fidelity=1440")));
  if (p.venue === "polymarket") { assert.ok(p.prints.length >= 30); assert.equal(p.liquidityNow, 24514.8206); }

  // a persistent 429 gives up instead of looping
  const always = liveAdapter({ fetchImpl: (async () => ({ ok: false, status: 429, json: async () => ({}) })) as unknown as typeof fetch, sleep: async () => {}, today: "2026-11-27" });
  await assert.rejects(always.read(link("two-degrees-breached", "kalshi"), "2026-10-16"), /429/);
  assert.equal(networkCalls, 0);
});

test("live adapter: Kalshi calls are at least 700 ms apart", async () => {
  const waits: number[] = [];
  const stub = (async () => ({ ok: true, status: 200, json: async () => ({ market: { status: "active" }, candlesticks: [] }) })) as unknown as typeof fetch;
  const adapter = liveAdapter({ fetchImpl: stub, sleep: async (ms) => { waits.push(ms); }, today: "2026-11-27" });
  await adapter.read(link("two-degrees-breached", "kalshi"), "2026-11-01");
  // two requests back to back (market, then candlesticks): the second one has to wait out most of the 700 ms
  assert.equal(waits.length, 1);
  assert.ok(waits[0] > 0 && waits[0] <= 700);
});

// ------------------------------------------------------------------------------------------------------------- vintages

function vintageRoot(): string {
  const root = temp();
  const data = resolve(root, "data");
  mkdirSync(resolve(data, "vintages"), { recursive: true });
  writeFileSync(resolve(data, "events.json"), JSON.stringify([{ id: "two-degrees-breached", title: "t", summary: "s", year: 2050, confidence: "moderate", probability: 0.5 }, { id: "fusion-net-grid", title: "t2", summary: "s2", year: 2040, confidence: "speculative", probability: 0.3 }]));
  writeFileSync(resolve(data, "indicators.json"), "[]");
  writeFileSync(resolve(data, "scenarios.json"), "[]");
  writeFileSync(resolve(data, "meta.json"), JSON.stringify({ hinge: { pluralismProbability: 0.5 } }));
  writeFileSync(resolve(data, "markets.json"), stringifyLinks(seed));
  writeFileSync(resolve(data, "vintages", "2026-11-23.json"), '{"date":"2026-11-23","note":"an old vintage, left alone"}\n');
  return root;
}

test("vintage: freezes the exact-date price of each primary link, skips a primary with no price that day, leaves old vintages alone", () => {
  const root = vintageRoot();
  try {
    const oldPath = resolve(root, "data/vintages/2026-11-23.json");
    const oldHash = sha(oldPath);
    appendHistory([
      row("2026-11-30", 0.7, { liquidity: 4000 }),
      row("2026-11-29", 0.31, { eventId: "fusion-net-grid", market: "KXFUSION-35-JAN01" }), // primary, but its price is a day old
      row("2026-11-30", 0.2, { eventId: "next-pandemic", venue: "polymarket", market: "new-pandemic-before-2028" }), // not primary
    ], root);
    const path = writeVintage("2026-11-30", root);
    const v = json(path) as J;
    assert.deepEqual(v.markets, { "two-degrees-breached": { venue: "kalshi", market: "KXWARMING-50", p: 0.7 } });
    assert.deepEqual(Object.keys(v.events as J), ["two-degrees-breached", "fusion-net-grid"]);
    assert.equal(sha(oldPath), oldHash, "the earlier vintage is untouched");
    assert.deepEqual(primaryPricesOn("2026-11-29", root), { "fusion-net-grid": { venue: "kalshi", market: "KXFUSION-35-JAN01", p: 0.31 } });
    // a second vintage the same day takes a new filename and does not touch the first
    const first = sha(path);
    const second = writeVintage("2026-11-30", root);
    assert.notEqual(second, path);
    assert.equal(sha(path), first);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("vintage: with no market price on the day there is no markets key at all", () => {
  const root = vintageRoot();
  try {
    const v = json(writeVintage("2026-12-07", root)) as J;
    assert.equal("markets" in v, false);
    assert.deepEqual(primaryPricesOn("2026-12-07", root), {});
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ------------------------------------------------------------------------------------------------------------ the CLI

test("markets:pull --dry-run --fixtures: 19 price lines for the primary links, and no file changes", () => {
  const watch = [resolve(repo, "data/markets.json"), resolve(repo, "qa/fixtures/markets/links-seed.json")];
  const histDir = resolve(repo, "data/market-history");
  const snapshot = () => ({ files: watch.map(sha), hist: existsSync(histDir) ? readdirSync(histDir).sort().map((f) => `${f}:${sha(resolve(histDir, f))}`) : [], vintages: readdirSync(resolve(repo, "data/vintages")).sort() });
  const before = snapshot();
  const out = execFileSync(process.execPath, ["--import", "tsx", "scripts/markets-pull.ts", "--dry-run", "--fixtures", "qa/fixtures/markets"], { cwd: repo, encoding: "utf8", env: { ...process.env, NODE_NO_WARNINGS: "1" } });
  const lines = out.split(/\r?\n/).filter((l) => l.startsWith("PRICE "));
  assert.equal(lines.length, 19, out);
  assert.match(out, /dry run: \d+ new row\(s\) would be added; nothing written/);
  assert.deepEqual(snapshot(), before);
  assert.throws(() => execFileSync(process.execPath, ["--import", "tsx", "scripts/markets-pull.ts", "--fixtures", "qa/fixtures/markets"], { cwd: repo, stdio: "pipe" }), /Command failed/);
});
