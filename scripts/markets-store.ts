/**
 * Reading and writing the market feed's files. Every function takes the repo root so tests can point at a temp copy.
 *   data/markets.json                 curated links
 *   data/market-history/YYYY-MM.json  daily prices, append-only
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MarketLinks, HistoryRow, rowKey, marketId, type MarketLink } from "./markets-schema";
import { z } from "zod";

export const REPO_ROOT = resolve(import.meta.dirname ?? ".", "..");

const linksPath = (root: string) => resolve(root, "data", "markets.json");
const historyDir = (root: string) => resolve(root, "data", "market-history");

export const stringify = (v: unknown): string => JSON.stringify(v, null, 2) + "\n";

/** One row per line, fixed key order: a month of prices stays readable and a day's append is a clean diff. */
export function stringifyRows(rows: readonly HistoryRow[]): string {
  if (!rows.length) return "[]\n";
  return "[\n" + rows.map((r) => "  " + JSON.stringify({ eventId: r.eventId, venue: r.venue, market: r.market, date: r.date, p: r.p, liquidity: r.liquidity })).join(",\n") + "\n]\n";
}

export function readLinks(root = REPO_ROOT): MarketLink[] {
  const p = linksPath(root);
  return existsSync(p) ? MarketLinks.parse(JSON.parse(readFileSync(p, "utf8"))) : [];
}

/** Fixed key order, and the two-field `market` object on one line, so a rewrite never reshuffles the file. */
export function stringifyLinks(links: readonly MarketLink[]): string {
  const ordered = links.map((l) => ({ eventId: l.eventId, venue: l.venue, market: l.market, label: l.label, primary: l.primary, match: l.match, bar: l.bar, inverted: l.inverted, differs: l.differs, addedOn: l.addedOn, ...(l.resolved ? { resolved: l.resolved } : {}) }));
  return stringify(ordered).replace(/"market": \{\s+("[a-zA-Z]+": "[^"]*"),\s+("[a-zA-Z]+": "[^"]*")\s+\}/g, '"market": { $1, $2 }').replace(/"resolved": \{\s+("on": "[^"]*"),\s+("outcome": "[^"]*")\s+\}/g, '"resolved": { $1, $2 }');
}

export function writeLinks(links: readonly MarketLink[], root = REPO_ROOT): void {
  writeFileSync(linksPath(root), stringifyLinks(links));
}

/** Every month file, as `{file, rows}` with rows unparsed (the validator parses them). */
export function readHistoryFiles(root = REPO_ROOT): { file: string; rows: unknown }[] {
  const dir = historyDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort().map((file) => ({ file, rows: JSON.parse(readFileSync(resolve(dir, file), "utf8")) }));
}

export function readHistory(root = REPO_ROOT): HistoryRow[] {
  return readHistoryFiles(root).flatMap(({ rows }) => z.array(HistoryRow).parse(rows));
}

const rowOrder = (a: HistoryRow, b: HistoryRow): number =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.eventId !== b.eventId ? (a.eventId < b.eventId ? -1 : 1) : a.venue !== b.venue ? (a.venue < b.venue ? -1 : 1) : a.market < b.market ? -1 : a.market > b.market ? 1 : 0;

/**
 * Pure merge: existing rows are kept exactly as they are; only rows whose key is unseen are added.
 * Returns the merged list per month file (sorted deterministically) and the rows that were new.
 */
export function mergeRows(existing: readonly HistoryRow[], incoming: readonly HistoryRow[]): { added: HistoryRow[]; merged: HistoryRow[] } {
  const seen = new Set(existing.map(rowKey));
  const added: HistoryRow[] = [];
  for (const r of incoming) {
    const k = rowKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    added.push(r);
  }
  return { added, merged: [...existing, ...added].sort(rowOrder) };
}

/**
 * Append new rows to the month files. A row whose (eventId, venue, market, date) already exists is never rewritten, and a month file
 * with nothing new is not touched. Returns the rows actually written.
 */
export function appendHistory(incoming: readonly HistoryRow[], root = REPO_ROOT): HistoryRow[] {
  const dir = historyDir(root);
  const byMonth = new Map<string, HistoryRow[]>();
  for (const r of incoming) { const m = r.date.slice(0, 7); byMonth.set(m, [...(byMonth.get(m) ?? []), r]); }
  const written: HistoryRow[] = [];
  const allKeys = new Set(readHistory(root).map(rowKey));
  for (const [month, rows] of [...byMonth].sort()) {
    const path = resolve(dir, `${month}.json`);
    const current: HistoryRow[] = existsSync(path) ? z.array(HistoryRow).parse(JSON.parse(readFileSync(path, "utf8"))) : [];
    const fresh = rows.filter((r) => !allKeys.has(rowKey(r)));
    const { added, merged } = mergeRows(current, fresh);
    if (!added.length) continue;
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, stringifyRows(merged));
    for (const r of added) allKeys.add(rowKey(r));
    written.push(...added);
  }
  return written;
}

/** Latest date for which a link has a stored row, or null. */
export function latestStoredDate(history: readonly HistoryRow[], link: MarketLink): string | null {
  let best: string | null = null;
  for (const r of history) if (r.eventId === link.eventId && r.venue === link.venue && r.market === marketId(link) && (best === null || r.date > best)) best = r.date;
  return best;
}

/** Date of the newest frozen vintage, or null. */
export function latestVintageDate(root = REPO_ROOT): string | null {
  const dir = resolve(root, "data", "vintages");
  if (!existsSync(dir)) return null;
  const dates = readdirSync(dir).map((f) => f.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]).filter((d): d is string => !!d).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/**
 * Market prices for a vintage: one entry per event whose primary link has a stored row on exactly `date`.
 * No earlier price is substituted. Returns {} when there is none.
 */
export function primaryPricesOn(date: string, root = REPO_ROOT): Record<string, { venue: "kalshi" | "polymarket"; market: string; p: number }> {
  const links = readLinks(root).filter((l) => l.primary);
  if (!links.length) return {};
  const history = readHistory(root).filter((r) => r.date === date);
  const out: Record<string, { venue: "kalshi" | "polymarket"; market: string; p: number }> = {};
  for (const l of links) {
    const row = history.find((r) => r.eventId === l.eventId && r.venue === l.venue && r.market === marketId(l));
    if (row) out[l.eventId] = { venue: l.venue, market: row.market, p: row.p };
  }
  return out;
}
