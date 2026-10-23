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
out.push("## Standing search queries");
const q = [
  "frontier AI model release capabilities this week", "open-weight model frontier gap", "AI agents enterprise adoption layoffs entry-level hiring",
  "AI export controls compute verification US China", "AI cyberattack critical infrastructure autonomous", "AI-designed drug Phase III results FDA approval",
  "fusion net electricity grid milestone", "humanoid robot deployment hospital home price", "Artemis lunar base crew schedule",
  "Doomsday Clock setting Bulletin of the Atomic Scientists", "UN world population projections revision fertility", "global mean temperature 1.5C Copernicus record",
  "universal basic income national program law", "AI federal legislation United States Congress passed",
];
for (const s of q) out.push(`- ${s}`);
console.log(out.join("\n"));
