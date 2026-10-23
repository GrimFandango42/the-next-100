/**
 * Appends a changelog entry and bumps meta.lastCheckin. Keeps the JSON formatted the way the repo keeps it.
 * Usage: npm run checkin:log -- --kind checkin --headline "…" --body "…" [--touched id,id] [--sources url,url] [--date YYYY-MM-DD]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname ?? ".", "..");
const args = process.argv.slice(2);
const get = (k: string) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : undefined; };
const date = get("date") ?? new Date().toISOString().slice(0, 10);
const kind = get("kind") ?? "checkin";
const headline = get("headline"); const body = get("body");
if (!headline || !body) { console.error("need --headline and --body"); process.exit(1); }
const touched = (get("touched") ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
const sources = (get("sources") ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);

const logPath = resolve(root, "data", "changelog.json");
const log = JSON.parse(readFileSync(logPath, "utf8"));
log.push({ date, kind, headline, body, touched, sources });
writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const metaPath = resolve(root, "data", "meta.json");
const meta = JSON.parse(readFileSync(metaPath, "utf8"));
meta.lastCheckin = date;
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
console.log(`✓ logged ${kind} on ${date}: ${headline}`);
