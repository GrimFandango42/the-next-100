#!/usr/bin/env node
/**
 * Checks every URL in data/sources.json and data/citations.json and records a per-source status instead of banning a publisher.
 *   ok           · 2xx
 *   moved        · 3xx to a different host or path (the new location is recorded)
 *   blocked      · 401/403/429 or a bot wall; try the registry's alternate route or the desktop
 *   dead         · 404/410 or DNS failure
 *   unreachable  · network error from this machine (not evidence the page is gone)
 * Usage: node scripts/sources-check.mjs [--write]   (without --write it only prints)
 * Run it from the desktop or the VPS; cloud sessions sit behind an allowlist and will report mostly "unreachable".
 */
import { readFileSync, writeFileSync } from "node:fs";
const write = process.argv.includes("--write");
const today = new Date().toISOString().slice(0, 10);
const reg = JSON.parse(readFileSync(new URL("../data/sources.json", import.meta.url), "utf8"));
const cites = JSON.parse(readFileSync(new URL("../data/citations.json", import.meta.url), "utf8"));
const urls = new Set();
for (const list of Object.values(reg.domains)) for (const r of list) urls.add(r.url);
for (const list of Object.values(reg.metrics)) for (const r of list) urls.add(r.url);
for (const u of Object.keys(cites)) urls.add(u);

const check = async (url) => {
  try {
    const r = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(15000), headers: { "user-agent": "Mozilla/5.0 (compatible; the-next-100 source check)" } });
    if (r.status >= 200 && r.status < 300) return { status: "ok" };
    if (r.status >= 300 && r.status < 400) { const to = r.headers.get("location") ?? ""; return { status: /^https?:/.test(to) && new URL(to).host !== new URL(url).host ? "moved" : "ok", to }; }
    if ([401, 403, 429, 406].includes(r.status)) return { status: "blocked", code: r.status };
    if ([404, 410].includes(r.status)) return { status: "dead", code: r.status };
    return { status: "blocked", code: r.status };
  } catch (e) { return { status: "unreachable", error: String(e?.cause?.code ?? e?.name ?? e) }; }
};
const results = {};
let i = 0;
for (const u of urls) { results[u] = await check(u); i++; process.stdout.write(`\r${i}/${urls.size}`); }
console.log();
const counts = {}; for (const r of Object.values(results)) counts[r.status] = (counts[r.status] ?? 0) + 1;
console.log(counts);
for (const [u, r] of Object.entries(results)) if (r.status !== "ok") console.log(`${r.status.padEnd(12)} ${u}${r.to ? " → " + r.to : ""}${r.code ? " (" + r.code + ")" : ""}`);
if (write) {
  const apply = (r) => { r.status = results[r.url]?.status ?? r.status; r.lastChecked = today; if (results[r.url]?.to) r.movedTo = results[r.url].to; };
  for (const list of Object.values(reg.domains)) list.forEach(apply);
  for (const list of Object.values(reg.metrics)) list.forEach(apply);
  for (const [u, c] of Object.entries(cites)) { const r = results[u]; if (r && r.status !== "unreachable") { c.status = r.status; c.checked = today; } }
  writeFileSync(new URL("../data/sources.json", import.meta.url), JSON.stringify(reg, null, 2) + "\n");
  writeFileSync(new URL("../data/citations.json", import.meta.url), JSON.stringify(cites, null, 2) + "\n");
  console.log("written: data/sources.json, data/citations.json");
}
