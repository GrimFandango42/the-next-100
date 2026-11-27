/**
 * Pulls matched prediction-market prices into data/market-history/.
 *
 *   npm run markets:pull                                      live: read every unresolved link, append unseen days
 *   npm run markets:pull -- --dry-run                         live read, print the latest price per primary link, write nothing
 *   npm run markets:pull -- --dry-run --fixtures qa/fixtures/markets   offline, from the recorded responses and links-seed.json
 *   options: --since YYYY-MM-DD   --only <eventId>   --all (also print non-primary links)
 *
 * Price rules (one price per link per UTC day):
 *   Kalshi      midpoint of the day's closing Yes bid and ask when the spread is at most 0.15, else the day's last trade.
 *   Polymarket  the last print of the day.
 *   Then 1 - p when the link is inverted. A day without a usable price gets a warning and no row; nothing is carried forward.
 * Kalshi candles are dated by the UTC day on which they close. Both public APIs are read-only and need no key.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { MarketLinks, marketId, linkKey, rowKey, type HistoryRow, type MarketLink } from "./markets-schema";
import { REPO_ROOT, appendHistory, latestStoredDate, latestVintageDate, readHistory, readLinks, writeLinks } from "./markets-store";

// ---------------------------------------------------------------------------------------------------------------- types

export type Resolved = { on: string; outcome: "yes" | "no" };
/** One Kalshi daily candle, reduced to what the price rule needs. All prices are dollars (0â€“1). */
export interface KalshiDay { date: string; bid: number | null; ask: number | null; last: number | null; oi: number | null }
/** One Polymarket price print. `t` (unix seconds) is present on live data; recorded daily series are already in order. */
export interface PolyPrint { date: string; p: number; t?: number }
export interface KalshiSnapshot { venue: "kalshi"; days: KalshiDay[]; liquidityNow: number | null; resolved: Resolved | null; warnings: string[] }
export interface PolySnapshot { venue: "polymarket"; prints: PolyPrint[]; liquidityNow: number | null; resolved: Resolved | null; warnings: string[] }
export type Snapshot = KalshiSnapshot | PolySnapshot;
export interface Adapter { read(link: MarketLink, since: string): Promise<Snapshot> }
export interface DayPrice { date: string; p: number; liquidity: number | null }

type J = Record<string, unknown>;
const rec = (x: unknown): J => (x && typeof x === "object" && !Array.isArray(x) ? (x as J) : {});
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const num = (x: unknown): number | null => { if (x === null || x === undefined || x === "") return null; const n = typeof x === "number" ? x : Number(x); return Number.isFinite(n) ? n : null; };
const r4 = (x: number): number => Math.round(x * 10000) / 10000;
const utcDate = (unixSeconds: number): string => new Date(unixSeconds * 1000).toISOString().slice(0, 10);
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
/** Gamma returns some arrays as JSON-encoded strings. */
const jsonArray = (x: unknown): unknown[] => { if (Array.isArray(x)) return x; if (typeof x === "string") { try { const v = JSON.parse(x); return Array.isArray(v) ? v : []; } catch { return []; } } return []; };

// ------------------------------------------------------------------------------------------------------- price rules

export const MAX_SPREAD_CENTS = 15;

/** Kalshi: midpoint of closing bid/ask when the spread is at most 0.15, else that day's last trade, else no price. */
export function kalshiDayPrice(d: Pick<KalshiDay, "bid" | "ask" | "last">): number | null {
  if (d.bid !== null && d.ask !== null && d.ask >= d.bid && Math.round((d.ask - d.bid) * 100) <= MAX_SPREAD_CENTS) return r4((d.bid + d.ask) / 2);
  return d.last;
}

/** Polymarket: the last print of each UTC day. Live prints are ordered by `t`; recorded ones keep their order. */
export function lastPrintPerDay(prints: readonly PolyPrint[]): { date: string; p: number }[] {
  const ordered = prints.every((x) => x.t !== undefined) ? [...prints].sort((a, b) => (a.t as number) - (b.t as number)) : prints;
  const byDate = new Map<string, number>();
  for (const x of ordered) byDate.set(x.date, x.p);
  return [...byDate].map(([date, p]) => ({ date, p })).sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Apply 1 - p for inverted links. Call after price selection. */
export const applyInversion = (p: number, inverted: boolean): number => (inverted ? r4(1 - p) : r4(p));

/** All usable day prices for a snapshot, inverted where the link says so, plus warnings for days dropped. */
export function dayPrices(snap: Snapshot, link: MarketLink): { prices: DayPrice[]; warnings: string[] } {
  const warnings: string[] = [];
  const dropped: string[] = [];
  const prices: DayPrice[] = [];
  const raw: { date: string; p: number | null; oi: number | null }[] =
    snap.venue === "kalshi" ? snap.days.map((d) => ({ date: d.date, p: kalshiDayPrice(d), oi: d.oi })) : lastPrintPerDay(snap.prints).map((x) => ({ date: x.date, p: x.p, oi: null }));
  const lastDate = raw.reduce<string | null>((m, x) => (m === null || x.date > m ? x.date : m), null);
  for (const x of raw) {
    if (x.p === null || x.p < 0 || x.p > 1) { dropped.push(x.date); continue; }
    const liquidity = x.oi ?? (x.date === lastDate ? snap.liquidityNow : null);
    prices.push({ date: x.date, p: applyInversion(x.p, link.inverted), liquidity: liquidity === null ? null : Math.max(0, liquidity) });
  }
  prices.sort((a, b) => (a.date < b.date ? -1 : 1));
  if (dropped.length) warnings.push(`${link.eventId} ${marketId(link)}: ${dropped.length} day(s) with no usable price, no row written (${dropped.slice(0, 3).join(", ")}${dropped.length > 3 ? ", â€¦" : ""})`);
  return { prices, warnings };
}

// -------------------------------------------------------------------------------------------------------------- parsers

export function parseKalshiCandles(json: unknown): KalshiDay[] {
  const byDate = new Map<string, KalshiDay>();
  for (const c of arr(rec(json).candlesticks).map(rec)) {
    const ts = num(c.end_period_ts);
    if (ts === null) continue;
    const date = utcDate(ts);
    byDate.set(date, { date, bid: num(rec(c.yes_bid).close_dollars), ask: num(rec(c.yes_ask).close_dollars), last: num(rec(c.price).close_dollars), oi: num(c.open_interest_fp) });
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** `{market: {...}}` from GET /markets/{ticker}. A market only counts as resolved when it is settled with a yes/no result. */
export function parseKalshiMarket(json: unknown, today: string): { openInterest: number | null; resolved: Resolved | null; warnings: string[] } {
  const m = rec(rec(json).market);
  const status = String(m.status ?? "");
  const result = String(m.result ?? "").toLowerCase();
  const warnings: string[] = [];
  let resolved: Resolved | null = null;
  if (["determined", "finalized", "settled"].includes(status) && (result === "yes" || result === "no")) {
    const when = String(m.settlement_ts ?? m.close_time ?? m.expiration_time ?? "").slice(0, 10);
    resolved = { on: isDate(when) ? when : today, outcome: result };
  } else if (!["active", "open", "initialized", ""].includes(status)) {
    warnings.push(`status "${status}" with result "${result}" is not a settled yes/no; link left unresolved`);
  }
  return { openInterest: num(m.open_interest_fp), resolved, warnings };
}

/** One market object from a gamma event's `markets[]`: its Yes token, liquidity, and resolution if the market itself is settled. */
export function parsePolymarketMarket(m: J, today: string): { token: string | null; liquidity: number | null; resolved: Resolved | null; warnings: string[] } {
  const outcomes = jsonArray(m.outcomes).map((o) => String(o).toLowerCase());
  const yes = Math.max(0, outcomes.indexOf("yes"));
  const token = jsonArray(m.clobTokenIds)[yes];
  const warnings: string[] = [];
  let resolved: Resolved | null = null;
  if (m.closed === true) {
    const pYes = num(jsonArray(m.outcomePrices)[yes]);
    if (m.umaResolutionStatus === "resolved" && pYes !== null && (pYes >= 0.99 || pYes <= 0.01)) {
      const when = String(m.closedTime ?? m.umaEndDate ?? m.endDate ?? "").slice(0, 10);
      resolved = { on: isDate(when) ? when : today, outcome: pYes >= 0.99 ? "yes" : "no" };
    } else {
      warnings.push(`market is closed but not cleanly resolved (uma "${String(m.umaResolutionStatus ?? "")}", yes price ${pYes}); link left unresolved`);
    }
  }
  return { token: typeof token === "string" ? token : null, liquidity: num(m.liquidityNum) ?? num(m.liquidity), resolved, warnings };
}

/** Find one market by slug in the body of GET gamma /events/slug/{eventSlug}. */
export function findPolymarketMarket(json: unknown, slug: string): J | null {
  const ev = Array.isArray(json) ? rec(json[0]) : rec(json);
  return arr(ev.markets).map(rec).find((m) => m.slug === slug) ?? null;
}

export function parsePolymarketHistory(json: unknown): PolyPrint[] {
  const out: PolyPrint[] = [];
  for (const h of arr(rec(json).history).map(rec)) { const t = num(h.t), p = num(h.p); if (t !== null && p !== null) out.push({ date: utcDate(t), p, t }); }
  return out;
}

// ------------------------------------------------------------------------------------------------------------ adapters

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"));

/** Offline adapter over the "picked" recordings in a fixtures directory. Makes no network request. */
export function fixtureAdapter(dir: string): Adapter {
  const files = (prefix: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".json")).sort() : []);
  const kalshi = new Map<string, J>();
  const poly = new Map<string, J>();
  for (const f of files("kalshi-picked")) for (const e of arr(readJson(resolve(dir, f))).map(rec)) kalshi.set(String(e.ticker), e);
  for (const f of files("polymarket-picked")) for (const e of arr(readJson(resolve(dir, f))).map(rec)) poly.set(String(e.slug), e);
  return {
    async read(link): Promise<Snapshot> {
      if (link.venue === "kalshi") {
        const e = kalshi.get(link.market.ticker);
        if (!e) return { venue: "kalshi", days: [], liquidityNow: null, resolved: null, warnings: [`${link.market.ticker}: not in the recorded fixtures`] };
        const days = arr(e.history).map(rec).filter((h) => isDate(h.d)).map((h): KalshiDay => ({ date: String(h.d), bid: num(h.bid), ask: num(h.ask), last: num(h.last), oi: null }));
        return { venue: "kalshi", days, liquidityNow: num(e.oi), resolved: null, warnings: [] };
      }
      const e = poly.get(link.market.slug);
      if (!e) return { venue: "polymarket", prints: [], liquidityNow: null, resolved: null, warnings: [`${link.market.slug}: not in the recorded fixtures`] };
      const prints = arr(e.history).map(rec).filter((h) => isDate(h.d) && num(h.p) !== null).map((h): PolyPrint => ({ date: String(h.d), p: num(h.p) as number }));
      return { venue: "polymarket", prints, liquidityNow: num(e.liquidity), resolved: null, warnings: [] };
    },
  };
}

export interface LiveOptions { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; kalshiDelayMs?: number; today?: string }
const KALSHI = "https://external-api.kalshi.com/trade-api/v2";
const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";

/** Live adapter over the public, read-only APIs. Kalshi calls are spaced 700 ms apart; a 429 is retried a bounded number of times. */
export function liveAdapter(opts: LiveOptions = {}): Adapter {
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const delay = opts.kalshiDelayMs ?? 700;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  let lastKalshi = 0;
  const events = new Map<string, unknown>();

  async function getJson(url: string, kalshi: boolean): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      if (kalshi) { const wait = lastKalshi + delay - Date.now(); if (wait > 0) await sleep(wait); lastKalshi = Date.now(); }
      const res = await doFetch(url, { headers: { accept: "application/json", "user-agent": "the-next-100-markets-pull" } });
      if (res.status === 429 && attempt < 3) { await sleep(2000 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error(`${res.status} from ${url}`);
      return res.json();
    }
  }

  return {
    async read(link, since): Promise<Snapshot> {
      const startTs = Math.floor(Date.parse(`${since}T00:00:00Z`) / 1000) - 86400;
      const endTs = Math.floor(Date.now() / 1000);
      if (link.venue === "kalshi") {
        const { ticker, series } = link.market;
        const market = parseKalshiMarket(await getJson(`${KALSHI}/markets/${encodeURIComponent(ticker)}`, true), today);
        if (market.resolved) return { venue: "kalshi", days: [], liquidityNow: market.openInterest, resolved: market.resolved, warnings: market.warnings };
        const candles = await getJson(`${KALSHI}/series/${encodeURIComponent(series)}/markets/${encodeURIComponent(ticker)}/candlesticks?start_ts=${startTs}&end_ts=${endTs}&period_interval=1440`, true);
        return { venue: "kalshi", days: parseKalshiCandles(candles), liquidityNow: market.openInterest, resolved: null, warnings: market.warnings };
      }
      const { slug, eventSlug } = link.market;
      if (!events.has(eventSlug)) events.set(eventSlug, await getJson(`${GAMMA}/events/slug/${encodeURIComponent(eventSlug)}`, false));
      const m = findPolymarketMarket(events.get(eventSlug), slug);
      if (!m) return { venue: "polymarket", prints: [], liquidityNow: null, resolved: null, warnings: [`${slug}: not found in event ${eventSlug}`] };
      const info = parsePolymarketMarket(m, today);
      if (info.resolved || !info.token) return { venue: "polymarket", prints: [], liquidityNow: info.liquidity, resolved: info.resolved, warnings: info.token || info.resolved ? info.warnings : [...info.warnings, `${slug}: no Yes token`] };
      const hist = await getJson(`${CLOB}/prices-history?market=${encodeURIComponent(info.token)}&fidelity=1440&startTs=${startTs}`, false);
      return { venue: "polymarket", prints: parsePolymarketHistory(hist), liquidityNow: info.liquidity, resolved: null, warnings: info.warnings };
    },
  };
}

// ----------------------------------------------------------------------------------------------------------- pipeline

export interface PriceLine { link: MarketLink; date: string; p: number; liquidity: number | null; newRows: number }
export interface PullResult { rows: HistoryRow[]; lines: PriceLine[]; warnings: string[]; resolved: { link: MarketLink; resolved: Resolved }[] }
export interface PullOptions { links: readonly MarketLink[]; adapter: Adapter; history: readonly HistoryRow[]; defaultSince: string; since?: string; only?: string }

/**
 * Read every unresolved link and work out which history rows are new. Pure with respect to the disk: it writes nothing.
 * `since` per link is the explicit --since, else the link's latest stored day, else `defaultSince` (the previous vintage).
 */
export async function pull(o: PullOptions): Promise<PullResult> {
  const result: PullResult = { rows: [], lines: [], warnings: [], resolved: [] };
  const seen = new Set(o.history.map(rowKey));
  for (const link of o.links) {
    if (o.only && link.eventId !== o.only) continue;
    if (link.resolved) continue;
    const since = o.since ?? latestStoredDate([...o.history], link) ?? o.defaultSince;
    let snap: Snapshot;
    try { snap = await o.adapter.read(link, since); }
    catch (e) { result.warnings.push(`${link.eventId} ${marketId(link)}: read failed (${e instanceof Error ? e.message : String(e)})`); continue; }
    result.warnings.push(...snap.warnings.map((w) => `${link.eventId} ${marketId(link)}: ${w}`));
    if (snap.resolved) { result.resolved.push({ link, resolved: snap.resolved }); continue; }
    const { prices, warnings } = dayPrices(snap, link);
    result.warnings.push(...warnings);
    let newRows = 0;
    for (const x of prices) {
      if (x.date < since) continue;
      const row: HistoryRow = { eventId: link.eventId, venue: link.venue, market: marketId(link), date: x.date, p: x.p, liquidity: x.liquidity };
      if (seen.has(rowKey(row))) continue;
      seen.add(rowKey(row));
      result.rows.push(row);
      newRows++;
    }
    const latest = prices[prices.length - 1];
    if (latest) result.lines.push({ link, date: latest.date, p: latest.p, liquidity: latest.liquidity, newRows });
    else if (!warnings.length) result.warnings.push(`${link.eventId} ${marketId(link)}: no prices returned`);
  }
  return result;
}

export function formatLine(l: PriceLine): string {
  return `PRICE ${l.link.venue} ${marketId(l.link)} ${l.link.eventId} ${l.date} p=${l.p.toFixed(3)}${l.link.inverted ? " (inverted)" : ""} liquidity=${l.liquidity === null ? "n/a" : l.liquidity} new=${l.newRows}`;
}

// ---------------------------------------------------------------------------------------------------------------- CLI

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (k: string) => args.includes(`--${k}`);
  const get = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  const dry = flag("dry-run");
  const fixtures = get("fixtures");
  if (fixtures && !dry) { console.error("--fixtures is for offline checks only; add --dry-run (it never writes)."); process.exit(1); }
  const since = get("since");
  if (since !== undefined && !isDate(since)) { console.error("--since must be YYYY-MM-DD"); process.exit(1); }

  const links = fixtures ? MarketLinks.parse(readJson(resolve(REPO_ROOT, fixtures, "links-seed.json"))) : readLinks();
  if (!links.length) { console.error("no links: data/markets.json is empty or missing"); process.exit(1); }
  const adapter = fixtures ? fixtureAdapter(resolve(REPO_ROOT, fixtures)) : liveAdapter();
  const defaultSince = latestVintageDate() ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const result = await pull({ links, adapter, history: readHistory(), defaultSince, since, only: get("only") });

  for (const l of result.lines) if (l.link.primary || flag("all")) console.log(formatLine(l));
  for (const w of result.warnings) console.warn(`WARN ${w}`);
  for (const r of result.resolved) console.log(`RESOLVED ${r.link.eventId} ${marketId(r.link)} ${r.resolved.outcome} on ${r.resolved.on}`);

  if (dry) { console.log(`dry run: ${result.rows.length} new row(s) would be added; nothing written`); return; }
  const written = appendHistory(result.rows);
  if (result.resolved.length) {
    const all = readLinks();
    for (const r of result.resolved) { const l = all.find((x) => linkKey(x) === linkKey(r.link) && x.eventId === r.link.eventId); if (l) l.resolved = r.resolved; }
    writeLinks(all);
  }
  console.log(`âœ“ markets: ${written.length} new row(s) in data/market-history, ${result.resolved.length} link(s) resolved`);
}

if (process.argv[1] && /markets-pull\.ts$/.test(process.argv[1])) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
