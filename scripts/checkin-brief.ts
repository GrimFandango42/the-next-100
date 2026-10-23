/**
 * Prints the brief a check-in starts from: what is due, what to search for, where the needles sit.
 * Usage: npm run checkin:brief
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Dataset } from "../src/schema";

const root = resolve(import.meta.dirname ?? ".", "..");
const read = (f: string) => JSON.parse(readFileSync(resolve(root, "data", f), "utf8"));
const d = Dataset.parse({ meta: read("meta.json"), events: read("events.json"), eras: read("eras.json"), metrics: read("metrics.json"), clock: read("clock.json"), scenarios: read("scenarios.json"), indicators: read("indicators.json"), changelog: read("changelog.json") });

const today = new Date();
const y = today.getFullYear() + (today.getMonth() + 1) / 12;
const horizon = 4; // years ahead worth researching every week

const overdue = d.events.filter((e) => e.status === "forecast" && (e.yearEnd ?? e.year) + 1 < y);
const live = d.events.filter((e) => e.status === "forecast" && e.year <= y + horizon && !overdue.includes(e));
const resolved = d.events.filter((e) => e.status !== "forecast");

const out: string[] = [];
out.push(`# Check-in brief · ${today.toISOString().slice(0, 10)}`);
out.push(`Forecast written ${d.meta.written}; last check-in ${d.meta.lastCheckin}. ${d.events.length} lines, ${resolved.length} resolved.`);
out.push("");
if (overdue.length) {
  out.push(`## MUST GRADE (window closed, still marked forecast)`);
  for (const e of overdue) out.push(`- [${e.id}] ${e.year}${e.yearEnd ? "–" + e.yearEnd : ""} · ${e.title}`);
  out.push("");
}
out.push(`## Live lines (due within ${horizon} years) — search each one's signals`);
for (const e of live.sort((a, b) => a.year - b.year)) {
  out.push(`- [${e.id}] ${e.year}${e.yearEnd ? "–" + e.yearEnd : ""} · ${e.title} · ${e.confidence}${e.probability != null ? " " + Math.round(e.probability * 100) + "%" : ""}`);
  for (const s of e.signals) out.push(`    · signal: ${s}`);
}
out.push("");
out.push(`## Leading indicators (reading: −1 concentration … +1 pluralism)`);
for (const i of d.indicators) out.push(`- [${i.id}] ${i.watch} · reading ${i.reading >= 0 ? "+" : ""}${i.reading.toFixed(1)} · last checked ${i.lastChecked ?? "never"}\n    · pluralism if: ${i.pluralism}\n    · concentration if: ${i.concentration}`);
out.push("");
out.push(`## Metrics with observed anchors to refresh`);
for (const m of d.metrics) out.push(`- [${m.id}] ${m.label} · ${m.observed.length} observed point(s)`);
out.push("");
out.push("## Registry sources to open first (SOURCES.md · data/sources.json)");
const reg = read("sources.json") as { domains: Record<string, { name: string; url: string; pulls: string; cadence: string; tier: string }[]>; metrics: Record<string, { name: string; url: string }[]>; queries: { weekly: string[]; quarterly: string[] }; rules: string[] };
const liveDomains = new Set(live.map((e) => e.domain));
for (const [dom, list] of Object.entries(reg.domains)) if (liveDomains.has(dom as never)) { out.push(`- ${dom}:`); for (const r of list.filter((x) => x.tier === "primary" || x.tier === "institutional").slice(0, 4)) out.push(`    · ${r.name} — ${r.url} · ${r.cadence}`); }
for (const m of d.metrics) { const list = reg.metrics[m.id] ?? []; if (list.length) out.push(`- metric ${m.id}: ${list.slice(0, 2).map((r) => `${r.name} — ${r.url}`).join(" · ")}`); }
out.push("");
out.push("## Standing search queries (weekly)");
for (const s of reg.queries.weekly) out.push(`- ${s}`);
const quarterStart = [0, 3, 6, 9].includes(today.getMonth()) && today.getDate() <= 10;
out.push("");
out.push(quarterStart ? "## Quarterly queries — due this week" : "## Quarterly queries (first check-in of Jan / Apr / Jul / Oct)");
for (const s of reg.queries.quarterly) out.push(`- ${s}`);
out.push("");
out.push("## Source rules (SOURCES.md has the full list)");
for (const r of reg.rules.slice(0, 5)) out.push(`- ${r}`);
console.log(out.join("\n"));
