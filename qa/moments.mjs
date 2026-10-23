import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
mkdirSync("qa/out/figs", { recursive: true });
const b = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
const out = {};
for (const [dev, opts] of [["d", { viewport: { width: 1440, height: 900 } }], ["m", devices["iPhone 13"]]]) {
  const ctx = await b.newContext({ ...opts, colorScheme: "dark" });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && !m.text().includes("moments/") && errs.push(m.text()));
  await p.goto(process.argv[2] || "http://localhost:4174/", { waitUntil: "networkidle" });
  const n = await p.evaluate(() => Math.round(document.querySelector(".journey").getBoundingClientRect().height / innerHeight / 0.7));
  const issues = [];
  for (let i = 2; i <= 38; i++) {
    await p.evaluate((i) => scrollTo({ top: i * 0.7 * innerHeight, behavior: "instant" }), i);
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const vis = (e) => { let n = e; while (n && n !== document.body) { const c = getComputedStyle(n); if (c.display === "none" || c.visibility === "hidden" || +c.opacity < 0.3) return false; n = n.parentElement; } return true; };
      const sel = [".figure", ".ev-beat", ".stage-year", ".zoom-ctl", ".ruler", ".chapter", ".outro", ".hinge-copy"];
      const bx = []; for (const s of sel) for (const e of document.querySelectorAll(s)) if (vis(e)) { const r = e.getBoundingClientRect(); if (r.width > 2) bx.push({ s, r }); }
      const ov = []; for (let a = 0; a < bx.length; a++) for (let c = a + 1; c < bx.length; c++) { const A = bx[a].r, B = bx[c].r; const ix = Math.min(A.right, B.right) - Math.max(A.left, B.left), iy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top); if (ix > 6 && iy > 6) ov.push(`${bx[a].s}×${bx[c].s}(${Math.round(ix)}x${Math.round(iy)})`); }
      const off = bx.filter((x) => x.r.right > innerWidth + 1 || x.r.bottom > innerHeight + 1 || x.r.top < -1).map((x) => x.s);
      return { ov, off, kind: document.querySelector(".fig") ? "fig" : "-", title: document.querySelector(".beat h2")?.textContent?.slice(0, 30) };
    });
    if (r.ov.length || r.off.length) issues.push({ i, ...r });
    await p.screenshot({ path: `qa/out/figs/${dev}-${String(i).padStart(2, "0")}.png` });
  }
  out[dev] = { n, errs, issues };
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
