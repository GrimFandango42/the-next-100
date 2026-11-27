/**
 * Schemas and cross-file rules for the market feed: data/markets.json (the curated links)
 * and data/market-history/YYYY-MM.json (daily prices, append-only).
 */
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

export const MarketRef = z.discriminatedUnion("venue", [
  z.object({ venue: z.literal("kalshi"), market: z.object({ ticker: z.string().min(1), series: z.string().min(1) }).strict() }),
  z.object({ venue: z.literal("polymarket"), market: z.object({ slug: z.string().min(1), eventSlug: z.string().min(1) }).strict() }),
]);

const LinkFields = z.object({
  eventId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "eventId must be kebab-case"),
  label: z.string().min(1),
  primary: z.boolean(),
  match: z.enum(["close", "related", "loose"]),
  bar: z.enum(["easier", "harder", "different"]),
  inverted: z.boolean(),
  differs: z.string().min(1),
  addedOn: isoDate,
  resolved: z.object({ on: isoDate, outcome: z.enum(["yes", "no"]) }).strict().optional(),
});

export const MarketLink = LinkFields.and(MarketRef);
export const MarketLinks = z.array(MarketLink);
export type MarketLink = z.infer<typeof MarketLink>;

export const HistoryRow = z.object({
  eventId: z.string().min(1),
  venue: z.enum(["kalshi", "polymarket"]),
  market: z.string().min(1),
  date: isoDate,
  p: z.number().min(0).max(1),
  liquidity: z.number().nonnegative().nullable(),
}).strict();
export type HistoryRow = z.infer<typeof HistoryRow>;

/** The stable identifier of a market inside its venue: Kalshi ticker or Polymarket market slug. */
export const marketId = (l: MarketLink): string => (l.venue === "kalshi" ? l.market.ticker : l.market.slug);
/** Uniqueness key of a link. */
export const linkKey = (l: MarketLink): string => `${l.venue}|${marketId(l)}`;
/** Uniqueness key of a history row. */
export const rowKey = (r: { eventId: string; venue: string; market: string; date: string }): string => `${r.eventId}|${r.venue}|${r.market}|${r.date}`;

/** Parse + cross-check a links array. Returns human-readable problems; empty means valid. */
export function validateLinks(raw: unknown, eventIds: ReadonlySet<string>): string[] {
  const parsed = MarketLinks.safeParse(raw);
  if (!parsed.success) return parsed.error.issues.map((i) => `markets.json ${i.path.join(".")}: ${i.message}`);
  const errors: string[] = [];
  const seen = new Set<string>();
  const primaries = new Map<string, number>();
  for (const l of parsed.data) {
    if (!eventIds.has(l.eventId)) errors.push(`markets.json: unknown eventId ${l.eventId}`);
    const k = `${l.eventId}|${linkKey(l)}`;
    if (seen.has(k)) errors.push(`markets.json: duplicate link ${l.eventId} ${linkKey(l)}`);
    seen.add(k);
    if (l.primary) primaries.set(l.eventId, (primaries.get(l.eventId) ?? 0) + 1);
  }
  for (const [id, n] of primaries) if (n > 1) errors.push(`markets.json: ${id} has ${n} primary links (at most one)`);
  return errors;
}

/** Parse + cross-check history rows (all months together). `file` names each row's source for messages. */
export function validateHistory(files: { file: string; rows: unknown }[], links: readonly MarketLink[]): string[] {
  const errors: string[] = [];
  const known = new Set(links.map((l) => `${l.eventId}|${linkKey(l)}`));
  const seen = new Set<string>();
  for (const { file, rows } of files) {
    const parsed = z.array(HistoryRow).safeParse(rows);
    if (!parsed.success) { for (const i of parsed.error.issues) errors.push(`${file} ${i.path.join(".")}: ${i.message}`); continue; }
    const month = file.replace(/\.json$/, "");
    for (const r of parsed.data) {
      if (!r.date.startsWith(month)) errors.push(`${file}: row dated ${r.date} is in the wrong month file`);
      if (!known.has(`${r.eventId}|${r.venue}|${r.market}`)) errors.push(`${file}: row for ${r.eventId} ${r.venue} ${r.market} has no link in markets.json`);
      const k = rowKey(r);
      if (seen.has(k)) errors.push(`${file}: duplicate row ${k}`);
      seen.add(k);
    }
  }
  return errors;
}
