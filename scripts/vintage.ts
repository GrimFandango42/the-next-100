/**
 * Freezes the numbers a reader could have seen on a given day: every line's probability, confidence, dates and status,
 * every indicator reading, the hinge and the scenario odds. Written by the check-in logger; never edited afterwards.
 * Usage: tsx scripts/vintage.ts [YYYY-MM-DD]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { primaryPricesOn } from "./markets-store";

const repoRoot = resolve(import.meta.dirname ?? ".", "..");
/** `root` is the repo root; tests pass a temp copy. */
export function writeVintage(date: string, root: string = repoRoot) {
  const read = (f: string) => JSON.parse(readFileSync(resolve(root, "data", f), "utf8"));
  const dir = resolve(root, "data", "vintages"); mkdirSync(dir, { recursive: true });
  let path = resolve(dir, `${date}.json`);
  let sequence = 1;
  while (existsSync(path)) path = resolve(dir, `${date}-${String(++sequence).padStart(2,"0")}.json`);
  const events = read("events.json"), indicators = read("indicators.json"), meta = read("meta.json"), scenarios = read("scenarios.json");
  // Market prices are frozen only for the exact day, and only where a primary link has one. Nothing earlier is substituted.
  const markets = primaryPricesOn(date, root);
  const v = {
    date,
    note: "Frozen at this check-in. Never edited. Scores use the earliest pre-resolution vintage with the same definition version. Earlier unversioned snapshots remain historical records, not scoreable replacements.",
    hinge: meta.hinge.pluralismProbability,
    scenarios: Object.fromEntries(scenarios.map((s: any) => [s.id, { unconditional: s.unconditional, ...s.byBranch }])),
    indicators: Object.fromEntries(indicators.map((i: any) => [i.id, i.reading])),
    events: Object.fromEntries(events.map((e: any) => [e.id, { title: e.title, summary: e.summary, resolution: e.resolution ?? null, branch: e.branch ?? null, year: e.year, yearEnd: e.yearEnd ?? null, timing: e.timing ?? "around", probability: e.probability ?? null, confidence: e.confidence, status: e.status ?? "forecast" }])),
    ...(Object.keys(markets).length ? { markets } : {}),
  };
  writeFileSync(path, JSON.stringify(v, null, 2) + "\n");
  console.log(`✓ vintage ${date}: ${events.length} lines frozen${Object.keys(markets).length ? `, ${Object.keys(markets).length} market prices` : ""}`);
  return path;
}
if (process.argv[1] && /vintage\.ts$/.test(process.argv[1])) writeVintage(process.argv[2] ?? new Date().toISOString().slice(0, 10));
