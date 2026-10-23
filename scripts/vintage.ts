/**
 * Freezes the numbers a reader could have seen on a given day: every line's probability, confidence, dates and status,
 * every indicator reading, the hinge and the scenario odds. Written by the check-in logger; never edited afterwards.
 * Usage: tsx scripts/vintage.ts [YYYY-MM-DD]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname ?? ".", "..");
const read = (f: string) => JSON.parse(readFileSync(resolve(root, "data", f), "utf8"));
export function writeVintage(date: string) {
  const dir = resolve(root, "data", "vintages"); mkdirSync(dir, { recursive: true });
  const path = resolve(dir, `${date}.json`);
  if (existsSync(path)) { console.log(`vintage ${date} already exists; left as is`); return; }
  const events = read("events.json"), indicators = read("indicators.json"), meta = read("meta.json"), scenarios = read("scenarios.json");
  const v = {
    date,
    note: "Frozen at this check-in. Never edited. Scores are computed against the earliest vintage that contains a line.",
    hinge: meta.hinge.pluralismProbability,
    scenarios: Object.fromEntries(scenarios.map((s: any) => [s.id, { unconditional: s.unconditional, ...s.byBranch }])),
    indicators: Object.fromEntries(indicators.map((i: any) => [i.id, i.reading])),
    events: Object.fromEntries(events.map((e: any) => [e.id, { year: e.year, yearEnd: e.yearEnd ?? null, timing: e.timing ?? "around", probability: e.probability ?? null, confidence: e.confidence, status: e.status ?? "forecast" }])),
  };
  writeFileSync(path, JSON.stringify(v, null, 2) + "\n");
  console.log(`✓ vintage ${date}: ${events.length} lines frozen`);
}
if (process.argv[1] && /vintage\.ts$/.test(process.argv[1])) writeVintage(process.argv[2] ?? new Date().toISOString().slice(0, 10));
