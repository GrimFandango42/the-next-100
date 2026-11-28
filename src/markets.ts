/**
 * The market feed as the site reads it: the curated links (data/markets.json), the daily prices pulled so far
 * (data/market-history/*.json, may be absent) and the pure functions that turn them into the drawer chart and the
 * Explore figure. Nothing here fetches anything; the pull script owns the data.
 */
import { z } from "zod";
import linksJson from "../data/markets.json";
import { HistoryRow, MarketLinks, marketId, type MarketLink } from "../scripts/markets-schema";
import type { ForecastEvent } from "./schema";

export type { HistoryRow, MarketLink };

export const MARKET_LINKS: MarketLink[] = MarketLinks.parse(linksJson);

/** Month files are read at build time by Vite. Under plain node (tests) `import.meta.glob` does not exist, so the call throws and the history is empty. */
function loadHistory(): HistoryRow[] {
  let files: Record<string, unknown> = {};
  try { files = import.meta.glob("../data/market-history/*.json", { eager: true, import: "default" }); } catch { files = {}; }
  const rows: HistoryRow[] = [];
  for (const raw of Object.values(files)) { const ok = z.array(HistoryRow).safeParse(raw); if (ok.success) rows.push(...ok.data); }
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
export const MARKET_HISTORY: HistoryRow[] = loadHistory();

// ------------------------------------------------------------------------------------------------------------ the links

/** A line's links, primary first. */
export function linksFor(eventId: string, links: readonly MarketLink[] = MARKET_LINKS): MarketLink[] {
  return links.filter((l) => l.eventId === eventId).sort((a, b) => Number(b.primary) - Number(a.primary));
}
export const primaryFor = (eventId: string, links: readonly MarketLink[] = MARKET_LINKS): MarketLink | undefined => linksFor(eventId, links).find((l) => l.primary);

export const venueName = (l: MarketLink): string => (l.venue === "kalshi" ? "Kalshi" : "Polymarket");

/** Polymarket: the event page. Kalshi: the series page (the data holds the ticker and series, not the market's own slug). */
export function marketUrl(l: MarketLink): string {
  return l.venue === "polymarket" ? `https://polymarket.com/event/${l.market.eventSlug}` : `https://kalshi.com/markets/${l.market.series.toLowerCase()}`;
}

/** One link's daily rows, oldest first. */
export function rowsFor(l: MarketLink, rows: readonly HistoryRow[] = MARKET_HISTORY): HistoryRow[] {
  const id = marketId(l);
  return rows.filter((r) => r.eventId === l.eventId && r.venue === l.venue && r.market === id).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
export const latestRow = (l: MarketLink, rows: readonly HistoryRow[] = MARKET_HISTORY): HistoryRow | undefined => rowsFor(l, rows).at(-1);

/**
 * A market is "thin" when the latest row's liquidity is below its venue's floor. The two numbers are not comparable:
 * Kalshi reports open interest in contracts, Polymarket reports liquidity in dollars. Starting values, open to challenge.
 */
export const THIN_BELOW: Record<MarketLink["venue"], number> = { kalshi: 1000, polymarket: 5000 };
export const isThin = (l: MarketLink, row: HistoryRow | undefined): boolean => row?.liquidity != null && row.liquidity < THIN_BELOW[l.venue];

// ------------------------------------------------------------------------------------------------------------- dates

const DAY = 86_400_000;
export const dayNum = (iso: string): number => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);
export const isoDay = (n: number): string => new Date(n * DAY).toISOString().slice(0, 10);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDate = (iso: string): string => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;

// -------------------------------------------------------------------------------------------------- the forecast series

export interface Step { date: string; p: number; moved: boolean }
export interface ForecastSeries {
  /** Value on `written`, then one step per recorded move. */
  steps: Step[];
  /** Check-in dates (after the line was written) on which the number held. */
  held: string[];
  /** Current value. */
  end: number;
}

/**
 * The forecast as a step line, from the line's own revision history: it starts at the first move's `from` on the day the
 * forecast was written and steps at each recorded move. `checkins` are the dates of the weekly check-ins; the ones with no move are "held".
 * Null for scenario lines and lines without a stated probability.
 */
export function forecastSeries(e: ForecastEvent, written: string, checkins: readonly string[], today: string): ForecastSeries | null {
  if (e.resolution?.mode === "scenario" || e.probability == null) return null;
  const moves = e.history.filter((h) => h.from != null && h.to != null).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const steps: Step[] = [{ date: written, p: moves.length ? (moves[0].from as number) : e.probability, moved: false }, ...moves.map((m) => ({ date: m.date, p: m.to as number, moved: true }))];
  const moveDates = new Set(moves.map((m) => m.date));
  const held = [...new Set(checkins)].filter((d) => d > written && d <= today && !moveDates.has(d)).sort();
  return { steps, held, end: steps[steps.length - 1].p };
}

/** The forecast's value on a date: the last step on or before it. */
export function forecastOn(f: ForecastSeries, date: string): number {
  let p = f.steps[0].p;
  for (const s of f.steps) if (s.date <= date) p = s.p;
  return p;
}

// --------------------------------------------------------------------------------------------------------- the readout

export type SeriesKey = "forecast" | "primary" | "second";
export interface MarketLine { key: "primary" | "second"; link: MarketLink; name: string; rows: HistoryRow[] }
export interface ReadItem { key: SeriesKey; name: string; p: number | null }

/** The market lines the chart draws: the first link as the solid one, the next as the dashed one. */
export function marketLines(eventId: string, links: readonly MarketLink[], rows: readonly HistoryRow[]): MarketLine[] {
  const mine = linksFor(eventId, links).slice(0, 2);
  return mine.map((link, i) => ({
    key: i === 0 ? "primary" : "second",
    link,
    name: i === 1 && mine[0].venue === link.venue ? `${venueName(link)}, other market` : venueName(link),
    rows: rowsFor(link, rows),
  }));
}

/** Every series' value on one day, for the crosshair tooltip. A market with no row that day reads null ("no price"). */
export function readoutAt(date: string, f: ForecastSeries, lines: readonly MarketLine[]): ReadItem[] {
  return [
    { key: "forecast", name: "Forecast", p: forecastOn(f, date) },
    ...lines.map((m): ReadItem => ({ key: m.key, name: m.name, p: m.rows.find((r) => r.date === date)?.p ?? null })),
  ];
}

// ----------------------------------------------------------------------------------------------------- the Explore rows

export interface GapRow {
  event: ForecastEvent;
  link: MarketLink;
  forecast: number;
  /** Latest market price, or null before the first pull. */
  market: number | null;
  date: string | null;
  gap: number | null;
  thin: boolean;
}

/** One row per line that has a primary market, the widest forecast-to-market gap first; lines with no price yet come last, in date order. */
export function gapRows(events: readonly ForecastEvent[], links: readonly MarketLink[], rows: readonly HistoryRow[]): GapRow[] {
  const out: GapRow[] = [];
  for (const event of events) {
    const link = primaryFor(event.id, links);
    if (!link || event.probability == null || event.resolution?.mode === "scenario") continue;
    const last = latestRow(link, rows);
    out.push({ event, link, forecast: event.probability, market: last?.p ?? null, date: last?.date ?? null, gap: last ? Math.abs(event.probability - last.p) : null, thin: isThin(link, last) });
  }
  return out.sort((a, b) => (a.gap === null ? 1 : 0) - (b.gap === null ? 1 : 0) || (b.gap ?? 0) - (a.gap ?? 0) || a.event.year - b.event.year);
}
