/**
 * Scores resolved lines against the number they carried in the earliest vintage that contains them (Brier, lower is better).
 * happened / early / late count as 1, missed as 0; partial and retired are listed, not scored.
 * Usage: tsx scripts/score.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname ?? ".", "..");
const events = JSON.parse(readFileSync(resolve(root, "data", "events.json"), "utf8")) as any[];
const dir = resolve(root, "data", "vintages");
const vintages = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")));
const first = (id: string) => { for (const v of vintages) if (v.events[id]) return { date: v.date, p: v.events[id].probability as number | null }; return null; };

const rows = events.filter((e) => (e.status ?? "forecast") !== "forecast").map((e) => {
  const o = first(e.id); const outcome = ["happened", "early", "late"].includes(e.status) ? 1 : e.status === "missed" ? 0 : null;
  const brier = o?.p != null && outcome != null ? (o.p - outcome) ** 2 : null;
  return { id: e.id, status: e.status, resolvedOn: e.resolvedOn, original: o?.p ?? null, vintage: o?.date ?? null, outcome, brier };
});
const scored = rows.filter((r) => r.brier != null);
console.log(`${events.length} lines · ${rows.length} resolved · ${scored.length} scored`);
for (const r of rows) console.log(`- ${r.id}: ${r.status} on ${r.resolvedOn} · written at ${r.original ?? "—"} (${r.vintage ?? "no vintage"})${r.brier != null ? ` · Brier ${r.brier.toFixed(3)}` : " · not scored"}`);
if (scored.length) console.log(`Mean Brier: ${(scored.reduce((a, r) => a + r.brier!, 0) / scored.length).toFixed(3)} (0.25 = coin flip)`);
else console.log("Nothing scored yet; the first lines come due in 2027.");
