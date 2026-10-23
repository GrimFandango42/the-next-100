import { chromium, devices } from "playwright";
const b = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
for (const dev of ["iPhone 13", "iPhone SE", "Pixel 7"]) {
  const p = await (await b.newContext({ ...devices[dev], reducedMotion: "reduce" })).newPage();
  await p.goto(process.argv[2] || "https://thenext100.duckdns.org/", { waitUntil: "networkidle" });
  await p.evaluate(() => { document.documentElement.style.scrollSnapType = "none"; document.documentElement.style.scrollBehavior = "auto"; });
  const n = await p.locator(".snap").count(); let worst = 0, at = -1;
  for (let i = 0; i < n; i++) { await p.evaluate((i) => scrollTo(0, i * 0.7 * document.documentElement.clientHeight), i); await p.waitForTimeout(250); const w = await p.evaluate(() => innerWidth - document.documentElement.clientWidth); if (w > worst) { worst = w; at = i; } }
  // also the Explore section with the year at 2200
  await p.evaluate(() => document.querySelector("#explore").scrollIntoView()); await p.waitForTimeout(400);
  const ex = await p.evaluate(() => innerWidth - document.documentElement.clientWidth);
  console.log(dev, "worst extra width in film:", worst, "at beat", at, "| explore:", ex);
}
await b.close();
