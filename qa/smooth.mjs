import { chromium } from "playwright";
const b = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(process.argv[2] || "http://localhost:4174/", { waitUntil: "networkidle" });
await p.evaluate(() => scrollTo({ top: 5 * 0.7 * innerHeight, behavior: "instant" }));
await p.waitForTimeout(1500);
// jump two beats and sample the displayed year every 50ms
const samples = await p.evaluate(async () => {
  scrollTo({ top: 9 * 0.7 * innerHeight, behavior: "instant" });
  const out = [];
  for (let i = 0; i < 24; i++) { await new Promise((r) => setTimeout(r, 50)); out.push(document.querySelector(".stage-year .yr")?.textContent + ":" + (document.querySelector(".beat h2")?.textContent || "").slice(0, 8)); }
  return out;
});
console.log(samples.join(" "));
await b.close();
