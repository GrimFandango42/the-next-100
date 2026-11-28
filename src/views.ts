/**
 * What the This week and Odds views show, as pure functions over the data: what changed since a date, which market gaps
 * moved, what comes due next, and one row per line for the Odds table. Nothing here reads the DOM, storage or the clock.
 */
import { forecastOn, forecastSeries, latestRow, primaryFor, rowsFor, type ForecastSeries, type HistoryRow, type MarketLink } from "./markets";
import type { ChangelogEntry, Domain, ForecastEvent } from "./schema";

const byDate = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const points = (p: number): number => Math.round(p * 100);

// ---------------------------------------------------------------------------------------------------------- check-ins

/** Check-in dates, oldest first, each once. */
export const checkinDates = (log: readonly ChangelogEntry[]): string[] => [...new Set(log.filter((c) => c.kind === "checkin").map((c) => c.date))].sort(byDate);

/** The newest check-in entry; the newest entry of any kind if there has been no check-in yet. */
export function latestCheckin(log: readonly ChangelogEntry[]): ChangelogEntry | undefined {
  const sorted = [...log].sort((a, b) => byDate(b.date, a.date));
  return sorted.find((c) => c.kind === "checkin") ?? sorted[0];
}

export interface Since {
  /** Changes dated after this day count. */
  date: string;
  /** "visit": the reader last saw an older edition. "checkin": the reader is current (or new), so show the latest check-in's changes. */
  mode: "visit" | "checkin";
  /** The latest check-in. */
  checkin: string;
}

/**
 * The window This week covers. A reader whose stored edition is older than the latest check-in sees everything since that
 * edition; anyone else sees what the latest check-in changed (everything after the check-in before it).
 */
export function sinceFor(lastSeen: string | null, lastCheckin: string, checkins: readonly string[], written: string): Since {
  if (lastSeen && lastSeen < lastCheckin) return { date: lastSeen, mode: "visit", checkin: lastCheckin };
  const before = checkins.filter((d) => d < lastCheckin).at(-1) ?? written;
  return { date: before, mode: "checkin", checkin: lastCheckin };
}

// ------------------------------------------------------------------------------------------------------------- moves

export interface Move {
  event: ForecastEvent;
  /** Odds before the first move in the window and after the last one. */
  from: number;
  to: number;
  /** Date of the last move in the window. */
  date: string;
  /** The last move's reason, first sentence. */
  reason: string;
  /** Moves in the window. */
  count: number;
}

/** The first sentence of a reason; decimals ("0.50") and ids do not end a sentence. */
export function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](?=\s+[A-Z(“"']|$)/s);
  return (m ? m[0] : s).trim();
}

/** Lines whose stated odds moved after `since`, net of the window; the biggest move first. A line that moved and came back is left out. */
export function movesSince(events: readonly ForecastEvent[], since: string): Move[] {
  const out: Move[] = [];
  for (const event of events) {
    const hs = event.history.filter((h) => h.from != null && h.to != null && h.date > since).sort((a, b) => byDate(a.date, b.date));
    if (!hs.length) continue;
    const from = hs[0].from as number, to = hs[hs.length - 1].to as number;
    if (points(from) === points(to)) continue;
    out.push({ event, from, to, date: hs[hs.length - 1].date, reason: firstSentence(hs[hs.length - 1].reason), count: hs.length });
  }
  return out.sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from) || a.event.title.localeCompare(b.event.title));
}

const GRADE_WORDS = /\b(status|grade[ds]?|graded|resolved|happened|early|late|partial|missed|retired)\b/i;

/**
 * The day a graded line was graded. `resolvedOn` is when the event occurred (CHECKIN.md), which can be long before the
 * check-in that graded it, so the grade date comes from the line's history: the newest entry that records the grading
 * (its change names the status), else the newest entry on or after `resolvedOn`, else `resolvedOn` itself. Null for open lines.
 */
export function gradedOn(e: ForecastEvent): string | null {
  if (e.status === "forecast") return null;
  const hs = [...e.history].sort((a, b) => byDate(b.date, a.date));
  const named = hs.find((h) => GRADE_WORDS.test(h.change) && (e.resolvedOn == null || h.date >= e.resolvedOn));
  if (named) return named.date;
  const after = e.resolvedOn != null ? hs.find((h) => h.date >= e.resolvedOn!) : undefined;
  return after?.date ?? e.resolvedOn ?? hs[0]?.date ?? null;
}

/** Lines graded (any status other than forecast) on a day after `since`, by grading date, newest first. */
export function resolvedSince(events: readonly ForecastEvent[], since: string): ForecastEvent[] {
  return events
    .map((e) => ({ e, on: gradedOn(e) }))
    .filter((x): x is { e: ForecastEvent; on: string } => x.on != null && x.on > since)
    .sort((a, b) => byDate(b.on, a.on))
    .map((x) => x.e);
}

// ------------------------------------------------------------------------------------------------------ market gaps

export interface GapMove {
  event: ForecastEvent;
  link: MarketLink;
  /** Forecast minus market, signed, at the baseline check-in and on the latest price. */
  then: number;
  now: number;
  forecast: number;
  market: number;
  /** Date of the latest price. */
  date: string;
}

/**
 * Forecast-to-market gaps that moved by `threshold` points or more since the previous vintage: the last check-in before the
 * newest price. The forecast on that day is read from the line's own revision history (what the vintage froze); the market
 * is its last price on or before that day. Lines without a price on both sides are left out. Widest change first.
 */
export function gapMoves(events: readonly ForecastEvent[], links: readonly MarketLink[], rows: readonly HistoryRow[], checkins: readonly string[], written: string, threshold = 10): { baseline: string | null; moves: GapMove[] } {
  const newest = rows.reduce<string | null>((m, r) => (m === null || r.date > m ? r.date : m), null);
  const baseline = newest ? checkins.filter((d) => d < newest).at(-1) ?? null : null;
  if (!baseline) return { baseline: null, moves: [] };
  const moves: GapMove[] = [];
  for (const event of events) {
    if (event.probability == null || event.resolution?.mode === "scenario" || event.status !== "forecast") continue;
    const link = primaryFor(event.id, links);
    if (!link) continue;
    const rs = rowsFor(link, rows);
    const now = rs.at(-1);
    const then = rs.filter((r) => r.date <= baseline).at(-1);
    if (!now || !then || now.date <= baseline) continue;
    const f = forecastSeries(event, written, [], now.date);
    if (!f) continue;
    const gThen = forecastOn(f, baseline) - then.p, gNow = event.probability - now.p;
    if (Math.abs(points(gNow) - points(gThen)) < threshold) continue;
    moves.push({ event, link, then: gThen, now: gNow, forecast: event.probability, market: now.p, date: now.date });
  }
  return { baseline, moves: moves.sort((a, b) => Math.abs(b.now - b.then) - Math.abs(a.now - a.then)) };
}

// ------------------------------------------------------------------------------------------------------- coming due

/** The year a line's test can first be graded: the end of its window. "around" means year ± 1. */
export function dueYear(e: ForecastEvent): number {
  if (e.timing === "window") return e.yearEnd ?? e.year;
  if (e.timing === "around") return (e.yearEnd ?? e.year) + 1;
  return e.year;
}

/** The next `n` open, scored lines to come due, soonest first. */
export function comingDue(events: readonly ForecastEvent[], n = 3): ForecastEvent[] {
  return events
    .filter((e) => e.status === "forecast" && e.resolution?.mode !== "scenario" && e.probability != null)
    .sort((a, b) => dueYear(a) - dueYear(b) || a.year - b.year || a.title.localeCompare(b.title))
    .slice(0, n);
}

// ------------------------------------------------------------------------------------------------------------ odds

export interface OddsRow {
  event: ForecastEvent;
  scenario: boolean;
  /** Odds now and on the day the forecast was written; null for scenarios. */
  now: number | null;
  launch: number | null;
  /** now − launch, in probability. */
  change: number | null;
  moves: number;
  lastMove: string | null;
  due: number;
  link: MarketLink | undefined;
  market: number | null;
  marketDate: string | null;
  /** Forecast minus market, signed. */
  gap: number | null;
  series: ForecastSeries | null;
  marketRows: HistoryRow[];
}

export function oddsRows(events: readonly ForecastEvent[], links: readonly MarketLink[], rows: readonly HistoryRow[], written: string, today: string): OddsRow[] {
  return events.map((event) => {
    const series = forecastSeries(event, written, [], today);
    const scenario = !series;
    const link = scenario ? undefined : primaryFor(event.id, links);
    const last = link ? latestRow(link, rows) : undefined;
    const moved = series ? series.steps.filter((s) => s.moved) : [];
    const now = series ? series.end : null;
    const launch = series ? series.steps[0].p : null;
    return {
      event, scenario, now, launch,
      change: now !== null && launch !== null ? now - launch : null,
      moves: moved.length,
      lastMove: moved.at(-1)?.date ?? null,
      due: dueYear(event),
      link,
      market: last?.p ?? null,
      marketDate: last?.date ?? null,
      gap: now !== null && last ? now - last.p : null,
      series,
      marketRows: link ? rowsFor(link, rows) : [],
    };
  });
}

export type SortKey = "title" | "when" | "now" | "change" | "trend" | "market" | "gap" | "match";
export type SortDir = "asc" | "desc";
export const SORT_LABEL: Record<SortKey, string> = { title: "Line", when: "When", now: "Odds now", change: "Since launch", trend: "Last moved", market: "Market", gap: "Gap", match: "Match" };
/** The direction a column sorts in when first clicked. */
export const FIRST_DIR: Record<SortKey, SortDir> = { title: "asc", when: "asc", now: "desc", change: "desc", trend: "desc", market: "desc", gap: "desc", match: "asc" };

const MATCH_ORDER: Record<MarketLink["match"], number> = { close: 0, related: 1, loose: 2 };

function sortValue(r: OddsRow, key: SortKey): number | string | null {
  switch (key) {
    case "title": return r.event.title.toLowerCase();
    case "when": return r.due * 10000 + r.event.year;
    case "now": return r.now;
    case "change": return r.change;
    case "trend": return r.lastMove;
    case "market": return r.market;
    case "gap": return r.gap === null ? null : Math.abs(r.gap);
    case "match": return r.link ? MATCH_ORDER[r.link.match] : null;
  }
}

/** Sorted copy. Rows with no value for the column (scenarios, lines with no market) always sink to the bottom; ties fall back to date order. */
export function sortRows(rows: readonly OddsRow[], key: SortKey, dir: SortDir): OddsRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key), vb = sortValue(b, key);
    if (va === null || vb === null) { if (va !== vb) return va === null ? 1 : -1; }
    else if (va !== vb) return (va < vb ? -1 : 1) * sign;
    return a.due - b.due || a.event.year - b.event.year || a.event.title.localeCompare(b.event.title);
  });
}

export interface Filters {
  domains: ReadonlySet<Domain>;
  moved: boolean;
  market: boolean;
  soon: boolean;
  query: string;
}
export const NO_FILTERS: Filters = { domains: new Set(), moved: false, market: false, soon: false, query: "" };
export const SOON_YEARS = 5;

/** An empty domain set means every domain. "Soon" is an open line due within five years of `thisYear`. */
export function filterRows(rows: readonly OddsRow[], f: Filters, thisYear: number): OddsRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((r) =>
    (f.domains.size === 0 || f.domains.has(r.event.domain)) &&
    (!f.moved || r.moves > 0) &&
    (!f.market || r.link !== undefined) &&
    (!f.soon || (r.event.status === "forecast" && r.due <= thisYear + SOON_YEARS)) &&
    (!q || `${r.event.title} ${r.event.summary} ${r.event.id}`.toLowerCase().includes(q)));
}

export const activeFilterCount = (f: Filters): number => f.domains.size + Number(f.moved) + Number(f.market) + Number(f.soon);

/** "+5", "−3", "0": a difference in probability, as signed percentage points. */
export function signedPoints(d: number): string {
  const n = points(d);
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}
export const pct = (p: number): string => `${points(p)}%`;
