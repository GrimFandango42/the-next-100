import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
const URL = process.argv[2] || "http://localhost:4174/";
mkdirSync("qa/out/zoom", { recursive: true });
const b = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
const out = {};
for (const [dev, opts] of [["d", { viewport: { width: 1440, height: 900 } }], ["m", devices["iPhone 13"]]]) {
  const ctx = await b.newContext({ ...opts, colorScheme: "dark" });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(URL, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `qa/out/zoom/${dev}-intro.png` });
  const overlaps = async () => p.evaluate(() => {
    const layer = document.querySelector(".layer.on"); if (!layer) return "no layer";
    const els = [...layer.querySelectorAll(".cs-l,.callout,.row,.cur-y,.seg-l,.tick span,.dec-era,.axis-hint")].filter((e) => +getComputedStyle(e).opacity > 0.3 && e.getBoundingClientRect().width > 2);
    const bx = els.map((e) => ({ c: e.className, t: (e.textContent || "").slice(0, 20), r: e.getBoundingClientRect() }));
    const ov = [];
    for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) { const A = bx[i].r, B = bx[j].r; const ix = Math.min(A.right, B.right) - Math.max(A.left, B.left), iy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top); if (ix > 3 && iy > 3) ov.push(`${bx[i].c}[${bx[i].t}] × ${bx[j].c}[${bx[j].t}]`); }
    const off = bx.filter((x) => x.r.right > innerWidth + 1 || x.r.left < -1).map((x) => x.c + ":" + x.t);
    return { ov, off, sw: document.documentElement.scrollWidth, iw: innerWidth };
  });
  const res = [];
  for (const f of [3, 9, 17, 26, 38]) {
    await p.evaluate((f) => { document.documentElement.classList.add("no-snap"); scrollTo({ top: f * 0.7 * innerHeight, behavior: "instant" }); }, f);
    await p.waitForTimeout(500);
    for (const z of [0, 1, 2]) {
      // set zoom via the pill
      for (let k = 0; k < 3; k++) { const lbl = await p.locator(".zoom-l").textContent(); const cur = ["Century", "Decade", "Moment"].indexOf(lbl); if (cur === z) break; await p.click(cur > z ? '[aria-label="Zoom out"]' : '[aria-label="Zoom in"]'); await p.waitForTimeout(700); }
      await p.evaluate((f) => scrollTo({ top: f * 0.7 * innerHeight, behavior: "instant" }), f);
      await p.waitForTimeout(900);
      await p.screenshot({ path: `qa/out/zoom/${dev}-${String(f).padStart(2, "0")}-z${z}.png` });
      if (z < 2) res.push({ f, z, ...(await overlaps()) });
    }
  }
  // ctrl+wheel and keys
  let wheel = null;
  if (dev === "d") {
    await p.mouse.move(700, 450); await p.keyboard.down("Control"); await p.mouse.wheel(0, 120); await p.keyboard.up("Control"); await p.waitForTimeout(600);
    const a = await p.locator(".zoom-l").textContent();
    await p.keyboard.press("-"); await p.waitForTimeout(600); const c = await p.locator(".zoom-l").textContent();
    await p.keyboard.press("="); await p.waitForTimeout(600); const d2 = await p.locator(".zoom-l").textContent();
    wheel = [a, c, d2];
  }
  // click a dot in century → moment on that event
  await p.click('[aria-label="Zoom out"]').catch(() => {}); await p.waitForTimeout(500); await p.click('[aria-label="Zoom out"]').catch(() => {}); await p.waitForTimeout(700);
  await p.locator(".layer.on .dot").nth(10).click({ force: true }); await p.waitForTimeout(1000);
  const dive = { zoom: await p.locator(".zoom-l").textContent(), title: await p.locator(".layer.on .ev-beat h2").textContent().catch(() => null) };
  await p.screenshot({ path: `qa/out/zoom/${dev}-dive.png` });
  await p.locator(".layer.on .ev-beat .ghost").click(); await p.waitForTimeout(600);
  const sheet = await p.locator(".sheet").isVisible();
  await p.screenshot({ path: `qa/out/zoom/${dev}-why.png` });
  out[dev] = { errs, res: res.filter((r) => r.ov?.length || r.off?.length || r.sw > r.iw), wheel, dive, sheet };
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
