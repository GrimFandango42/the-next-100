/**
 * Validates every data file against the schema and the cross-file rules.
 * Run by `npm run build` and by the check-in before committing.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Dataset } from "../src/schema";

const root = resolve(import.meta.dirname ?? ".", "..");
const read = (f: string) => JSON.parse(readFileSync(resolve(root, "data", f), "utf8"));

const raw = {
  meta: read("meta.json"), events: read("events.json"), eras: read("eras.json"), metrics: read("metrics.json"),
  clock: read("clock.json"), scenarios: read("scenarios.json"), indicators: read("indicators.json"), changelog: read("changelog.json"), citations: read("citations.json"),
};

const parsed = Dataset.safeParse(raw);
const errors: string[] = [];
const vintages = readdirSync(resolve(root, "data/vintages")).filter(f=>f.endsWith(".json")).map(f=>JSON.parse(readFileSync(resolve(root,"data/vintages",f),"utf8")));
if (!parsed.success) {
  for (const i of parsed.error.issues) errors.push(`${i.path.join(".")}: ${i.message}`);
} else {
  const d = parsed.data;
  const ids = new Set<string>();
  for (const e of d.events) {
    if (ids.has(e.id)) errors.push(`duplicate event id ${e.id}`);
    ids.add(e.id);
    for (const v of vintages) {
      const old = v.events[e.id];
      if (old?.resolution?.version && old.resolution.version === e.resolution?.version && (old.resolution.test !== e.resolution?.test || old.year !== e.year || (old.yearEnd ?? null) !== (e.yearEnd ?? null) || (old.timing ?? "around") !== e.timing || (old.branch ?? null) !== (e.branch ?? null))) errors.push(`${e.id}: resolution changed without a new version (${v.date})`);
    }
    for (const [target] of Object.entries(e.relationshipKinds)) if (!e.leadsTo.includes(target)) errors.push(`${e.id}: relationship type without a link to ${target}`);
    if (!e.resolution?.version) errors.push(`${e.id}: needs a versioned resolution definition`);
    if (e.adjudication && e.adjudication.definitionVersion !== e.resolution?.version) errors.push(`${e.id}: adjudication definition mismatch`);
    if (e.yearEnd && e.yearEnd < e.year) errors.push(`${e.id}: yearEnd before year`);
    if (e.yearEnd && e.timing !== "window") errors.push(`${e.id}: has yearEnd so timing must be "window"`);
    if (!e.yearEnd && e.timing === "window") errors.push(`${e.id}: timing "window" needs yearEnd`);
    for (const h of e.history) { if ((h.from == null) !== (h.to == null)) errors.push(`${e.id}: history ${h.date} has one of from/to`); if (h.to != null && h === e.history[e.history.length - 1] && Math.abs(h.to - (e.probability ?? -1)) > 1e-9 && /probability/.test(h.change) && !/added/.test(h.change)) errors.push(`${e.id}: last probability move (${h.to}) does not match probability ${e.probability}`); }
    if (e.status !== "forecast" && !e.resolvedOn) errors.push(`${e.id}: status ${e.status} needs resolvedOn`);
    if (e.status !== "forecast" && e.history.length === 0) errors.push(`${e.id}: a resolved event needs a history entry explaining the resolution`);
    const band = e.confidence === "high" ? [0.7, 1] : e.confidence === "moderate" ? [0.45, 0.7] : [0, 0.45];
    if (e.probability != null && (e.probability < band[0] - 1e-9 || e.probability > band[1] + 1e-9)) errors.push(`${e.id}: probability ${e.probability} does not match confidence tier ${e.confidence}`);
    for (const h of e.history) if (h.date < d.meta.written) errors.push(`${e.id}: revision dated before the forecast was written`);
  }
  for (const e of d.events) for (const l of e.leadsTo) if (!ids.has(l)) errors.push(`${e.id}: leadsTo unknown id ${l}`);
  for (const c of d.changelog) for (const t of c.touched) if (!ids.has(t)) errors.push(`changelog ${c.date}: touched unknown id ${t}`);
  for (const s of d.scenarios) { /* branch sums */ }
  for (const b of ["pluralism", "concentration"] as const) {
    const sum = d.scenarios.reduce((a, s) => a + (s.byBranch[b] ?? 0), 0);
    if (Math.abs(sum - 100) > 0.5) errors.push(`scenarios for ${b} sum to ${sum}, not 100`);
  }
  const usum = d.scenarios.reduce((a, s) => a + s.unconditional, 0);
  if (Math.abs(usum - 100) > 0.5) errors.push(`unconditional scenarios sum to ${usum}, not 100`);
  for (const m of d.metrics) {
    if (!m.keyframes && !m.byBranch) errors.push(`metric ${m.id}: needs keyframes or byBranch`);
    const kfs = m.byBranch ? Object.values(m.byBranch) : [m.keyframes!];
    for (const kf of kfs) for (let i = 1; i < kf.length; i++) if (kf[i][0] <= kf[i - 1][0]) errors.push(`metric ${m.id}: keyframes not increasing in year`);
  }
  const eras = [...d.eras].sort((a, b) => a.from - b.from);
  for (let i = 1; i < eras.length; i++) if (eras[i].from !== eras[i - 1].to) errors.push(`eras ${eras[i - 1].id} and ${eras[i].id} do not join`);
  if (d.meta.lastCheckin < d.meta.written) errors.push("meta.lastCheckin before meta.written");
  const log = [...d.changelog].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (log[log.length - 1].date > new Date().toISOString().slice(0, 10)) errors.push("changelog entry dated in the future");
}

if (errors.length) {
  console.error(`✗ ${errors.length} data problem(s):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`✓ data valid: ${(parsed as any).data.events.length} events, ${(parsed as any).data.changelog.length} log entries`);
