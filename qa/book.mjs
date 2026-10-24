import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
mkdirSync("qa/out", { recursive: true });
const b = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
const out = {};
for (const [dev, opts] of [["d", { viewport: { width: 1440, height: 900 } }], ["m", devices["iPhone 13"]]]) {
  const ctx = await b.newContext({ ...opts, colorScheme: "dark" });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(process.argv[2] || "http://localhost:4174/", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  const total = await p.evaluate(() => document.documentElement.scrollHeight);
  const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  const stops = await p.evaluate(() => [...document.querySelectorAll("[data-story-stop]")].map((e) => ({ id: e.id, top: e.getBoundingClientRect().top + scrollY, h: e.getBoundingClientRect().height })));
  const shots = [0, 1, 2, 3, 8, 16, 24, 40, 46];
  for (const i of shots) { const s = stops[Math.min(i, stops.length - 1)]; await p.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), s.top); await p.waitForTimeout(600); await p.screenshot({ path: `qa/out/${dev}-${String(i).padStart(2, "0")}.png` }); }
  await p.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), stops[2].top); await p.waitForTimeout(400);
  await p.locator(".event-scene .page-actions .guide-text-button").first().click({ force: true }); await p.waitForTimeout(600);
  const sheet = await p.locator(".sheet").isVisible().catch(() => false);
  await p.screenshot({ path: `qa/out/${dev}-why.png` });
  out[dev] = { errs, total, sw, nStops: stops.length, avgStop: Math.round(stops.reduce((a, s) => a + s.h, 0) / stops.length), sheet };
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
