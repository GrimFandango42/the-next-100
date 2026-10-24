/** Prints the track record: every resolved line, its score, and any caveat. Usage: tsx scripts/score.ts */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scoreEvent, type Scorable, type Vintage } from "./scoring";
const root = resolve(import.meta.dirname ?? ".", "..");
const events = JSON.parse(readFileSync(resolve(root, "data/events.json"), "utf8")) as Scorable[];
const dir = resolve(root, "data/vintages");
const vintages = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")) as Vintage);
const resolved = events.filter((e) => (e.status ?? "forecast") !== "forecast");
const rows = resolved.map((e) => scoreEvent(e, vintages));
const scored = rows.filter((r) => r.score !== null);
console.log(`${events.length} lines · ${resolved.length} resolved · ${scored.length} scored · ${vintages.length} vintages`);
for (const r of rows) console.log(`- ${r.id}: ${r.score === null ? "not scored" : `Brier ${r.score.toFixed(3)}`} · ${r.reason}${r.caveat ? ` · caveat: ${r.caveat}` : ""}`);
if (scored.length) console.log(`Mean Brier ${(scored.reduce((s, r) => s + r.score!, 0) / scored.length).toFixed(3)} over ${scored.length} (0.25 = always saying 50%).`);
else console.log("Nothing scored yet; the first lines come due in 2027.");
