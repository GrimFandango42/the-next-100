// The century board in a real browser, desktop and iPhone 13: it opens from the book's strip and with "-", every lens
// paints, a card opens and lights its links, arrow keys travel, two cards go to the tray and compare without the chart and
// table overlapping, Escape steps back out (compare → card → board → book), and nothing logs an error or scrolls sideways
// outside the board. Screenshots: qa/out/board-{d,m}-*.png. Exits non-zero on any problem.
// Run: npm run build && npx vite preview --port 4174 &  node qa/board.mjs http://localhost:4174/
import { devices } from "playwright";
import { mkdirSync } from "node:fs";
import { launch } from "./browser.mjs";

const base = process.argv[2] ?? "http://localhost:4174/";
mkdirSync("qa/out", { recursive: true });
const browser = await launch();
const report = {};
let failed = false;

for (const [tag, opts] of [["d", { viewport: { width: 1440, height: 900 } }], ["m", devices["iPhone 13"]]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errs = [], problems = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(base + "#book");
  await page.waitForSelector(".overview-btn");
  await page.locator(".overview-btn").click();
  const board = page.locator(".board-wrap");
  await board.waitFor();
  const tokens = await page.locator(".token").count();
  if (tokens < 50) problems.push(`only ${tokens} tokens`);
  for (const lens of ["Odds", "Momentum", "Crowd gap", "Evidence", "Threads", "Horizon"]) {
    await page.getByRole("radio", { name: lens }).click();
    const painted = await page.locator(".token .hex").evaluateAll((els) => els.filter((e) => getComputedStyle(e).fill !== "none" && e.style.fill !== "").length);
    if (painted < 10) problems.push(`${lens} painted ${painted}`);
  }
  await page.getByRole("radio", { name: "Odds" }).click();
  await page.screenshot({ path: `qa/out/board-${tag}-board.png` });

  // A card, its links, arrow travel
  await page.locator(".token").nth(14).click();
  await page.locator(".card h3").waitFor();
  const first = await page.locator(".card h3").textContent();
  if (tag === "d") {
    const links = await page.locator(".board-links path").count();
    const out = await page.locator(".card-link").count();
    if (links !== out) problems.push(`card lists ${out} links, board draws ${links}`);
    await page.keyboard.press("ArrowRight");
    const second = await page.locator(".card h3").textContent();
    if (second === first) problems.push("ArrowRight did not move");
  }
  await page.screenshot({ path: `qa/out/board-${tag}-card.png` });

  // Two into the tray, then compare
  await page.getByRole("button", { name: /Add to compare/ }).click();
  if (tag === "m") await page.locator(".card .card-x").click();
  await page.locator(".token").nth(30).click();
  await page.getByRole("button", { name: /Add to compare/ }).click();
  if (tag === "m") await page.locator(".card .card-x").click();
  await page.getByRole("button", { name: /^Compare 2/ }).click();
  const panel = page.locator(".board-compare");
  await panel.waitFor();
  const [chart, table] = await Promise.all([panel.locator(".compare-chart").boundingBox(), panel.locator(".compare-table").boundingBox()]);
  if (!chart || !table || chart.y + chart.height > table.y + 1) problems.push("compare chart overlaps the table");
  await page.screenshot({ path: `qa/out/board-${tag}-compare.png` });

  // Escape steps back out
  await page.keyboard.press("Escape");
  if (await panel.count()) problems.push("Escape left compare open");
  await page.locator(".token").nth(5).click();
  await page.keyboard.press("Escape");
  if (await page.locator(".card h3").count()) problems.push("Escape left the card open");
  await page.keyboard.press("Escape");
  if (await board.count()) problems.push("Escape left the board open");
  await page.keyboard.press("-");
  if (!(await board.count())) problems.push('"-" did not open the board');
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (sw > 0) problems.push(`page scrolls sideways by ${sw}px`);
  if (errs.length) problems.push(...errs.map((e) => `console: ${e}`));
  report[tag] = { tokens, problems };
  if (problems.length) failed = true;
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 1));
process.exit(failed ? 1 : 0);
