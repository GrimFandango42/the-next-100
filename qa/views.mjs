// The three reader views on desktop and iPhone 13: each route loads, a drawer opens from each view, deep links and the back
// button land on the right view, and nothing overflows sideways, overlaps, or logs a console error.
// Run against a preview: npm run build && npx vite preview --port 4174 &  node qa/views.mjs [url]
import { devices } from "playwright";
import { mkdirSync } from "node:fs";
import { launch } from "./browser.mjs";

// --block-fonts aborts every request to the web-font host, as a restricted network does: the sweep must still pass, and
// must still fail on any other failed request.
const args = process.argv.slice(2);
const BLOCK_FONTS = args.includes("--block-fonts");
const BASE = (args.find((a) => !a.startsWith("--")) || "http://localhost:4174/").replace(/#.*$/, "");
const DEEP = "next-pandemic"; // a line with a market
const OLD = "fusion-net-grid"; // an old #story- link
mkdirSync("qa/out", { recursive: true });

const b = await launch();
const out = {};
let failed = false;

for (const [dev, opts] of [["d", { viewport: { width: 1440, height: 900 } }], ["m", devices["iPhone 13"]]]) {
  const ctx = await b.newContext({ ...opts, colorScheme: "dark", reducedMotion: "reduce" });
  if (BLOCK_FONTS) await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await ctx.newPage();
  const errs = [];
  const problems = [];
  // Requests that fail or return an error, by URL. A console "Failed to load resource" line carries no URL in its text,
  // so it is matched to its request through the message's location; the web-font host is external and may be blocked.
  const failedUrls = [];
  p.on("requestfailed", (r) => failedUrls.push(r.url()));
  p.on("response", (r) => r.status() >= 400 && failedUrls.push(r.url()));
  p.on("pageerror", (e) => errs.push({ text: e.message, url: "" }));
  p.on("console", (m) => m.type() === "error" && errs.push({ text: m.text(), url: m.location()?.url ?? "" }));
  const shot = (name) => p.screenshot({ path: `qa/out/views-${dev}-${name}.png` });
  const settle = (ms = 500) => p.waitForTimeout(ms);
  const visibleView = () => p.evaluate(() => [...document.querySelectorAll(".view")].filter((v) => !v.hidden).map((v) => v.className.replace("view view-", "")));
  const current = () => p.evaluate(() => document.querySelector(".topbar-views a[aria-current=page]")?.dataset.view ?? null);
  const expectView = async (want, where) => {
    const v = await visibleView(), c = await current();
    if (v.length !== 1 || v[0] !== want) problems.push(`${where}: showing ${JSON.stringify(v)}, wanted ${want}`);
    if (c !== want) problems.push(`${where}: top bar marks ${c}, wanted ${want}`);
  };
  const layout = async (where) => {
    const m = await p.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      const bar = document.querySelector(".topbar");
      const parts = [bar.querySelector(".topbar-name"), ...bar.querySelectorAll(".topbar-views a")];
      const barHits = [];
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) if (hit(r(parts[i]), r(parts[j]))) barHits.push(`${parts[i].textContent} / ${parts[j].textContent}`);
      const outside = parts.filter((e) => r(e).right > innerWidth + 0.5 || r(e).left < -0.5).map((e) => e.textContent);
      // inside every row or card item, the pieces must not overlap each other
      const items = [...document.querySelectorAll(".view:not([hidden]) :is(.wk-item, .odds-item)")];
      const itemHits = [];
      for (const it of items) {
        const kids = [...it.children].filter((k) => r(k).width > 0);
        for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) if (hit(r(kids[i]), r(kids[j]))) itemHits.push(it.dataset.line);
        if (r(it).right > innerWidth + 0.5) itemHits.push(it.dataset.line + " (past the screen)");
      }
      const wide = [...document.querySelectorAll(".view:not([hidden]) *")].filter((e) => !e.closest("svg") && r(e).width > 0 && r(e).right > innerWidth + 1).map((e) => e.tagName + "." + e.className).slice(0, 3);
      return { over: document.documentElement.scrollWidth - innerWidth, barH: r(bar).height, barHits, outside, itemHits: [...new Set(itemHits)].slice(0, 5), wide, items: items.length };
    });
    if (m.over > 0) problems.push(`${where}: page scrolls sideways by ${m.over}px`);
    if (m.barHits.length) problems.push(`${where}: top bar items overlap: ${m.barHits.join(", ")}`);
    if (m.outside.length) problems.push(`${where}: top bar items off screen: ${m.outside.join(", ")}`);
    if (m.barH > 72) problems.push(`${where}: top bar wraps (${m.barH}px tall)`);
    if (m.itemHits.length) problems.push(`${where}: overlapping parts in ${m.itemHits.join(", ")}`);
    if (m.wide.length) problems.push(`${where}: wider than the screen: ${m.wide.join(", ")}`);
    return m;
  };
  const drawer = async (where, title) => {
    await settle(450);
    const s = await p.evaluate(() => { const sh = document.querySelector(".sheet"); return sh ? { title: sh.querySelector("h3")?.textContent ?? "", over: sh.scrollWidth - sh.clientWidth, chart: !!sh.querySelector(".odds-history") } : null; });
    if (!s) { problems.push(`${where}: drawer did not open`); return; }
    if (title && !s.title.startsWith(title)) problems.push(`${where}: drawer shows "${s.title}", wanted "${title}"`);
    if (s.over > 0) problems.push(`${where}: drawer scrolls sideways`);
    await shot(`${where}-drawer`);
    await p.keyboard.press("Escape");
    await settle(300);
    if (await p.locator(".sheet").count()) problems.push(`${where}: drawer did not close on Escape`);
  };
  const title = (id) => p.evaluate((id) => document.querySelector(`[data-line="${id}"]`)?.textContent ?? null, id);

  // 1. First visit: no stored edition, so the book.
  await p.goto(BASE, { waitUntil: "networkidle" });
  await settle(800);
  await expectView("book", "first visit");
  await layout("book");
  await shot("book");
  await p.locator(".event-scene .page-actions .guide-text-button").nth(2).click({ force: true });
  await drawer("book");

  // 2. Returning reader: the stored edition makes This week the default.
  await p.goto(BASE, { waitUntil: "networkidle" });
  await settle(600);
  await expectView("week", "returning visit");
  const wk = await layout("week");
  await shot("week");
  if (!wk.items && !(await p.locator(".wk-quiet").count())) problems.push("week: no cards");
  const firstWeek = p.locator(".view-week .wk-item").first();
  const weekLine = await firstWeek.getAttribute("data-line");
  await firstWeek.click();
  const wt = await p.evaluate((id) => document.querySelector(`.view-week [data-line="${id}"] .wk-title`)?.textContent ?? "", weekLine);
  await drawer("week", wt);
  if (!(await p.evaluate(() => location.hash === "" || location.hash === "#week"))) problems.push("week: opening a drawer changed the hash");

  // 3. Odds: every line, sorting, a filter, a drawer.
  await p.locator('.topbar-views a[data-view="odds"]').click();
  await settle(600);
  await expectView("odds", "odds");
  const nRows = await p.locator(dev === "d" ? ".odds-table tbody tr" : ".odds-list .odds-item").count();
  const nLines = await p.evaluate(() => Number(document.querySelector(".odds-count").textContent.match(/(\d+) lines/)?.[1] ?? 0));
  if (!nRows || nRows !== nLines) problems.push(`odds: ${nRows} rows for ${nLines} lines`);
  await layout("odds");
  await shot("odds");
  if (dev === "d") {
    await p.locator(".odds-table thead th.c-now button").click();
    const order = await p.evaluate(() => [...document.querySelectorAll(".odds-table tbody td.c-now")].map((td) => parseInt(td.textContent)).filter((n) => !Number.isNaN(n)));
    if (order.some((v, i) => i && v > order[i - 1])) problems.push("odds: sorting by odds now is not descending");
    if ((await p.locator(".odds-table thead th.c-now").getAttribute("aria-sort")) !== "descending") problems.push("odds: aria-sort not set");
    await p.locator(".odds-chips .chip", { hasText: "Has a market" }).click();
    await settle(200);
    const withMarket = await p.locator(".odds-table tbody tr").count();
    const dashes = await p.locator(".odds-table tbody td.c-match", { hasText: "—" }).count();
    if (!withMarket || withMarket >= nLines || dashes) problems.push(`odds: "Has a market" left ${withMarket} rows, ${dashes} without a market`);
    await shot("odds-filtered");
    await p.locator(".odds-chips .chip.clear").click();
  } else {
    await p.locator(".sheet-open").click();
    await settle(400);
    if (!(await p.locator(".odds-sheet[open]").count())) problems.push("odds: the sort and filter sheet did not open");
    await shot("odds-sheet");
    const sheetOver = await p.evaluate(() => { const s = document.querySelector(".odds-sheet"); const r = s.getBoundingClientRect(); return { over: s.scrollWidth - s.clientWidth, right: r.right - innerWidth }; });
    if (sheetOver.over > 0 || sheetOver.right > 0.5) problems.push("odds: the sheet is wider than the screen");
    await p.locator(".sort-option", { hasText: "Odds now" }).click();
    await p.locator(".odds-sheet .chip", { hasText: "Has a market" }).click();
    await p.locator(".sheet-done").click();
    await settle(300);
    if (await p.locator(".odds-sheet[open]").count()) problems.push("odds: the sheet did not close");
    const order = await p.evaluate(() => [...document.querySelectorAll(".odds-item .oi-odds b")].map((b) => parseInt(b.textContent)).filter((n) => !Number.isNaN(n)));
    if (order.some((v, i) => i && v > order[i - 1])) problems.push("odds: phone sort by odds now is not descending");
    const n = await p.locator(".odds-list .odds-item").count();
    if (!n || n >= nLines) problems.push(`odds: phone filter left ${n} rows`);
    await layout("odds-filtered");
    await shot("odds-filtered");
    await p.locator(".sheet-open").click();
    await settle(300);
    await p.locator(".odds-sheet .chip.clear").click();
    await p.locator(".sheet-done").click();
    await settle(300);
  }
  const row = p.locator(`.view-odds [data-line="${DEEP}"]`).first();
  await row.scrollIntoViewIfNeeded();
  const rowTitle = await p.evaluate((id) => { const e = document.querySelector(`.view-odds [data-line="${id}"]`); return (e.querySelector(".odds-open, .oi-title")?.childNodes[1]?.textContent ?? "").trim(); }, DEEP);
  await (dev === "d" ? p.locator(`.view-odds tr[data-line="${DEEP}"] td.c-when`) : row).click();
  await settle(300);
  if (!(await p.evaluate((id) => location.hash === `#line-${id}`, DEEP))) problems.push("odds: opening a drawer did not name the line in the URL");
  await drawer("odds", rowTitle);
  if (!(await p.evaluate(() => location.hash === "#odds"))) problems.push("odds: closing the drawer did not return the URL to #odds");

  // 4. The book from the top bar, then back and forward.
  await p.locator('.topbar-views a[data-view="book"]').click();
  await settle(600);
  await expectView("book", "book via top bar");
  await p.goBack(); await settle(500);
  await expectView("odds", "back from the book");
  await p.goBack(); await settle(500);
  await expectView("week", "back again");
  await p.goForward(); await settle(500);
  await expectView("odds", "forward");

  // 5. Deep links: #line-<id> opens Odds with the drawer; an old #story-<id> opens the book at that page.
  await p.goto("about:blank");
  await p.goto(BASE + "#line-" + DEEP, { waitUntil: "networkidle" });
  await settle(700);
  await expectView("odds", "deep link");
  await shot("deep-link");
  await drawer("deep-link", rowTitle);
  await p.goto("about:blank");
  await p.goto(BASE + "#story-" + OLD, { waitUntil: "networkidle" });
  await settle(900);
  await expectView("book", "old story link");
  const pos = await p.evaluate((id) => { const r = document.getElementById("story-" + id)?.getBoundingClientRect(); return r ? { top: r.top, bottom: r.bottom } : null; }, OLD);
  if (!pos || pos.top > innerHeightOf(dev) * 0.5 || pos.bottom < 0) problems.push(`old story link: page not in view (${JSON.stringify(pos)})`);
  await shot("old-link");

  // 6. Deep in the book, to Odds and back (top bar, then the back button): the same page sits in the same place.
  await p.goto("about:blank");
  await p.goto(BASE + "#book", { waitUntil: "networkidle" });
  await settle(600);
  await p.evaluate((id) => { const el = document.getElementById("story-" + id); scrollTo({ top: scrollY + el.getBoundingClientRect().top - innerHeight / 2 + 40, behavior: "instant" }); }, DEEP);
  await settle(700);
  const centred = () => p.evaluate(() => {
    const mid = innerHeight / 2;
    const page = [...document.querySelectorAll(".view-book [data-story-stop]")].find((e) => { const r = e.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; });
    return page ? { id: page.id, top: Math.round(page.getBoundingClientRect().top), y: Math.round(scrollY) } : null;
  });
  const before = await centred();
  if (!before || before.id !== "story-" + DEEP) problems.push(`book round trip: could not centre story-${DEEP} (${JSON.stringify(before)})`);
  await p.locator('.topbar-views a[data-view="odds"]').click();
  await settle(500);
  await p.locator('.topbar-views a[data-view="book"]').click();
  await settle(700);
  const afterBar = await centred();
  if (!afterBar || afterBar.id !== before?.id || Math.abs(afterBar.top - before.top) > 4) problems.push(`book round trip via top bar: ${JSON.stringify(before)} → ${JSON.stringify(afterBar)}`);
  await p.locator('.topbar-views a[data-view="week"]').click();
  await settle(500);
  await p.goBack(); await settle(700);
  await expectView("book", "book round trip via back");
  const afterBack = await centred();
  if (!afterBack || afterBack.id !== before?.id || Math.abs(afterBack.top - before.top) > 4) problems.push(`book round trip via back: ${JSON.stringify(before)} → ${JSON.stringify(afterBack)}`);

  const fontHost = /fonts\.(googleapis|gstatic)\.com/;
  const failedSet = [...new Set(failedUrls)];
  const blockedFonts = failedSet.filter((u) => fontHost.test(u));
  const badRequests = failedSet.filter((u) => !fontHost.test(u));
  if (badRequests.length) problems.push("failed requests: " + badRequests.join(" | "));
  // A console error is the font host's when its location or text names that host, or when it is a bare load failure and
  // the only failed requests were the font host's.
  const fresh = errs.filter((e) => !(fontHost.test(e.url) || fontHost.test(e.text) || (/Failed to load resource/.test(e.text) && !e.url && blockedFonts.length && !badRequests.length)));
  if (fresh.length) problems.push("console errors: " + fresh.map((e) => e.url ? `${e.text} (${e.url})` : e.text).join(" | "));
  out[dev] = { ok: problems.length === 0, problems, rows: nRows, weekItems: wk.items, bookRoundTrip: { before, afterBar, afterBack }, blockedFonts: blockedFonts.length };
  if (problems.length) failed = true;
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (failed) process.exitCode = 1;

function innerHeightOf(dev) { return dev === "d" ? 900 : devices["iPhone 13"].viewport.height; }
