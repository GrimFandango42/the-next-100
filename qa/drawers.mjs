// Shared by book.mjs and overflow.mjs: open three drawers and check the "How the odds moved" chart in each.
// One line with two markets, one with none, one inverted. Checks: the sheet opens, the page and the sheet do not scroll sideways,
// nothing under the chart overlaps, the end labels do not collide or leave the chart, and a hover/tap shows a tooltip inside the chart.
import { mkdirSync } from "node:fs";

export const DRAWERS = [
  { id: "next-pandemic", what: "two markets" },
  { id: "agents-default-knowledge-work", what: "no market" },
  { id: "the-silence", what: "inverted market" },
];

const box = (r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom });
const hit = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;

/** Opens each drawer from its book page. `errs` is the page's console/page-error list; new entries during a drawer count against it. */
export async function checkDrawers(p, dev, errs, { shots = true } = {}) {
  if (shots) mkdirSync("qa/out", { recursive: true });
  const results = [];
  for (const { id, what } of DRAWERS) {
    const before = errs.length;
    await p.keyboard.press("Escape");
    await p.waitForTimeout(250);
    const top = await p.evaluate((id) => { const s = document.querySelector(`section[data-event-id="${id}"]`); return s ? s.getBoundingClientRect().top + scrollY : null; }, id);
    const r = { id, what, ok: false, problems: [] };
    results.push(r);
    if (top === null) { r.problems.push("no book page for this line"); continue; }
    await p.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), top);
    await p.waitForTimeout(400);
    await p.locator(`section[data-event-id="${id}"] .page-actions .guide-text-button`).first().click({ force: true });
    await p.waitForTimeout(500);
    const open = await p.locator(".sheet").isVisible().catch(() => false);
    if (!open) { r.problems.push("drawer did not open"); continue; }
    await p.locator(".sheet .odds-history").scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(350); // the chart measures itself on a ResizeObserver tick

    const m = await p.evaluate(() => {
      const sheet = document.querySelector(".sheet");
      const h = sheet.querySelector(".odds-history");
      const chart = h?.querySelector(".odds-chart");
      const rect = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
      return {
        pageOver: document.documentElement.scrollWidth - innerWidth,
        sheetOver: sheet.scrollWidth - sheet.clientWidth,
        hasChart: !!chart,
        sheet: rect(sheet),
        chart: chart ? rect(chart) : null,
        parts: h ? [...h.children].map((c) => ({ cls: c.className, ...rect(c) })) : [],
        ends: chart ? [...chart.querySelectorAll("text.end")].map(rect) : [],
        series: chart ? [...chart.querySelectorAll("[data-series]")].map((s) => s.getAttribute("data-series")) : [],
        markets: h ? h.querySelectorAll(".odds-markets li").length : 0,
        wide: h ? [...h.querySelectorAll("*")].filter((e) => !e.closest("svg") && e.getBoundingClientRect().right > h.getBoundingClientRect().right + 1).map((e) => e.tagName + "." + e.className).slice(0, 3) : [],
      };
    });
    if (!m.hasChart) r.problems.push("no chart");
    if (m.pageOver > 0) r.problems.push(`page scrolls sideways by ${m.pageOver}px`);
    if (m.sheetOver > 0) r.problems.push(`sheet scrolls sideways by ${m.sheetOver}px`);
    if (m.wide.length) r.problems.push(`content wider than its section: ${m.wide.join(", ")}`);
    for (let i = 1; i < m.parts.length; i++) if (m.parts[i].top < m.parts[i - 1].bottom - 1) r.problems.push(`"${m.parts[i].cls}" overlaps "${m.parts[i - 1].cls}"`);
    for (const part of m.parts) if (part.right > m.sheet.right + 1 || part.left < m.sheet.left - 1) r.problems.push(`"${part.cls}" leaves the sheet`);
    for (let i = 0; i < m.ends.length; i++) {
      if (m.chart && m.ends[i].right > m.chart.right + 1) r.problems.push("an end label runs off the chart");
      for (let j = i + 1; j < m.ends.length; j++) if (hit(box(m.ends[i]), box(m.ends[j]))) r.problems.push("two end labels overlap");
    }
    const wantMarkets = what === "no market" ? 0 : what === "two markets" ? 2 : 1;
    if (m.markets !== wantMarkets) r.problems.push(`expected ${wantMarkets} market note(s), found ${m.markets}`);
    r.series = m.series;

    // hover on desktop, tap on a phone: the tooltip must appear and stay inside the chart
    const cap = await p.locator(".sheet .odds-chart .capture").boundingBox();
    if (cap) {
      const at = { x: cap.x + cap.width * 0.7, y: cap.y + cap.height / 2 };
      if (dev === "m") await p.touchscreen.tap(at.x, at.y); else await p.mouse.move(at.x, at.y);
      await p.waitForTimeout(250);
      const tip = await p.evaluate(() => { const t = document.querySelector(".sheet .odds-tip"); const c = document.querySelector(".sheet .odds-chart"); if (!t) return null; const a = t.getBoundingClientRect(), b = c.getBoundingClientRect(); return { inside: a.left >= b.left - 1 && a.right <= b.right + 1, rows: t.querySelectorAll("div").length }; });
      if (!tip) r.problems.push("no tooltip on hover/tap");
      else if (!tip.inside) r.problems.push("tooltip leaves the chart");
      else if (tip.rows < 1) r.problems.push("tooltip lists no series");
      else r.tipRows = tip.rows;
    }
    if (shots) await p.locator(".sheet").screenshot({ path: `qa/out/${dev}-odds-${id}.png` });
    if (errs.length > before) r.problems.push(`console errors: ${errs.slice(before).join(" | ")}`);
    r.ok = r.problems.length === 0;
  }
  await p.keyboard.press("Escape");
  await p.waitForTimeout(250);
  return results;
}
