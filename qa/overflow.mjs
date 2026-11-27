import { devices } from "playwright";
import { launch } from "./browser.mjs";
import { checkDrawers } from "./drawers.mjs";
const b = await launch();
for (const dev of ["iPhone 13", "iPhone SE", "Pixel 7"]) {
  const p = await (await b.newContext({ ...devices[dev], reducedMotion: "reduce" })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(process.argv[2] || "https://thenext100.duckdns.org/", { waitUntil: "networkidle" });
  await p.evaluate(() => { document.documentElement.style.scrollSnapType = "none"; document.documentElement.style.scrollBehavior = "auto"; });
  const n = await p.locator(".snap").count(); let worst = 0, at = -1;
  for (let i = 0; i < n; i++) { await p.evaluate((i) => scrollTo(0, i * 0.7 * document.documentElement.clientHeight), i); await p.waitForTimeout(250); const w = await p.evaluate(() => innerWidth - document.documentElement.clientWidth); if (w > worst) { worst = w; at = i; } }
  // also the Explore section with the year at 2200
  await p.evaluate(() => document.querySelector("#explore").scrollIntoView()); await p.waitForTimeout(400);
  const ex = await p.evaluate(() => innerWidth - document.documentElement.clientWidth);
  console.log(dev, "worst extra width in film:", worst, "at beat", at, "| explore:", ex);
  // the "Forecast against the markets" figure, then the three drawers (two markets, none, inverted)
  await p.evaluate(() => document.querySelector("#odds .market-gap")?.scrollIntoView()); await p.waitForTimeout(300);
  const gapOver = await p.evaluate(() => { const g = document.querySelector("#odds .market-gap"); return g ? { rows: g.querySelectorAll(".gap-row").length, over: Math.max(0, g.scrollWidth - g.clientWidth), page: innerWidth - document.documentElement.clientWidth } : null; });
  console.log(dev, "market figure:", JSON.stringify(gapOver));
  if (!gapOver || gapOver.over > 0 || gapOver.page > 0) process.exitCode = 1;
  for (const d of await checkDrawers(p, "m", errs, { shots: false })) {
    console.log(dev, "drawer", d.id, `(${d.what})`, d.ok ? "clean" : "PROBLEMS: " + d.problems.join("; "));
    if (!d.ok) process.exitCode = 1;
  }
}
await b.close();
