/** The track record: every resolved line with its founding and strict Brier scores. Usage: tsx scripts/score.ts */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scoreEvent, type Scorable, type Vintage } from "./scoring";
const root = resolve(import.meta.dirname ?? ".", "..");
const events = JSON.parse(readFileSync(resolve(root, "data/events.json"), "utf8")) as Scorable[];
const dir = resolve(root, "data/vintages");
const vintages = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")) as Vintage);
const resolved = events.filter((e) => (e.status ?? "forecast") !== "forecast");
const rows = resolved.map((e) => scoreEvent(e, vintages));
const f = rows.filter((r) => r.founding != null), s = rows.filter((r) => r.strict != null);
console.log(`${events.length} lines · ${resolved.length} resolved · ${f.length} scored (founding) · ${s.length} scored (strict) · ${vintages.length} vintages`);
for (const r of rows) console.log(`- ${r.id}: founding ${r.founding == null ? "—" : r.founding.toFixed(3)} · strict ${r.strict == null ? "—" : r.strict.toFixed(3)} · ${r.reason}${r.caveat ? ` · ${r.caveat}` : ""}`);
const mean = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3);
if (f.length) console.log(`Mean founding Brier ${mean(f.map((r) => r.founding!))} over ${f.length}${s.length ? `; mean strict Brier ${mean(s.map((r) => r.strict!))} over ${s.length}` : ""} (0.25 = always saying 50%).`);
else console.log("Nothing scored yet; the first lines come due in 2027.");
