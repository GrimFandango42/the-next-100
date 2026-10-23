import { useEffect, useRef } from "react";
import { data } from "../data";
import { lerp, metricKF } from "../lib";
import type { Branch, Hero } from "../schema";

/**
 * The living planet, drawn from the forecast:
 *  city lights = population · atmosphere glow = warming · the web = AI's share of work
 *  (a mesh under pluralism, one hub under concentration) · Moon and Mars when people live there ·
 *  the red arc = the Doomsday Clock. One `effect` at a time makes the current moment's idea the loud thing.
 */
export type Effect = Hero["effect"] | "none";
type Layout = { cx: number; cy: number; r: number }; // fractions of the canvas
type Props = { year: number; branch: Branch; effect?: Effect; dim?: number; forceBranch?: Branch; layout?: Layout; className?: string };

const N_MAX = 720;
const TILT = 0.32;
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function land(x: number, y: number, z: number) { return Math.sin(x * 2.1 + 0.4) * Math.cos(y * 2.7 - 0.9) + 0.6 * Math.sin(z * 3.3 + x * 1.2) + 0.35 * Math.cos(x * 5.1 - z * 4.2 + y) - 0.25 * Math.abs(y); }

type Pt = { x: number; y: number; z: number; nb: number[]; hue: number };
let CACHE: { pts: Pt[]; stars: [number, number, number][]; glow: HTMLCanvasElement } | null = null;
function geometry() {
  if (CACHE) return CACHE;
  const rnd = mulberry32(100);
  const grid: [number, number, number, number][] = [];
  for (let lat = -78; lat <= 80; lat += 2.4) {
    const r = Math.cos((lat * Math.PI) / 180), y = Math.sin((lat * Math.PI) / 180), step = 2.4 / Math.max(0.18, r);
    for (let lon = 0; lon < 360; lon += step) { const x = r * Math.cos((lon * Math.PI) / 180), z = r * Math.sin((lon * Math.PI) / 180); grid.push([x, -y, z, land(x, -y, z)]); }
  }
  const sorted = grid.map((g) => g[3]).sort((p, q) => q - p); const thr = sorted[Math.floor(sorted.length * 0.3)];
  const pool = grid.filter((g) => g[3] >= thr).map((g) => ({ g, k: rnd() * (1.4 - (g[3] - thr)) })).sort((p, q) => p.k - q.k);
  const pts: Pt[] = pool.slice(0, N_MAX).map(({ g }) => ({ x: g[0] + (rnd() - 0.5) * 0.02, y: g[1] + (rnd() - 0.5) * 0.02, z: g[2] + (rnd() - 0.5) * 0.02, nb: [], hue: rnd() }));
  for (const p of pts) { const d = pts.map((q, j) => [(p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2, j] as [number, number]).sort((u, v) => u[0] - v[0]); p.nb = [d[1][1], d[2][1], d[3][1]]; }
  const sr = mulberry32(7);
  const stars: [number, number, number][] = Array.from({ length: 300 }, () => [sr(), sr(), sr()]);
  const glow = document.createElement("canvas"); glow.width = glow.height = 32;
  const g = glow.getContext("2d")!; const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "rgba(255,236,190,1)"); gr.addColorStop(0.18, "rgba(255,206,130,.85)"); gr.addColorStop(0.5, "rgba(255,170,80,.18)"); gr.addColorStop(1, "rgba(255,170,80,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  CACHE = { pts, stars, glow };
  return CACHE;
}

const smooth = (a: number, b: number, t: number) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const metric = (id: string, b: Branch, y: number) => { const m = data.metrics.find((x) => x.id === id)!; return lerp(metricKF(m, b), y); };
const lerpColor = (a: number[], b: number[], t: number) => { t = Math.max(0, Math.min(1, t)); return a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(","); };
const EFFECTS = ["web", "hub", "bloom", "dim", "peak", "heat", "cool", "sun", "moon", "mars", "orbit", "alarm", "clock", "merge", "silence", "ripple"] as const;

export default function World({ year, branch, effect = "none", dim = 0, forceBranch, layout, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef({ year, branch: forceBranch ?? branch, effect, dim, layout });
  target.current = { year, branch: forceBranch ?? branch, effect, dim, layout };

  useEffect(() => {
    const canvas = ref.current!, ctx = canvas.getContext("2d")!;
    const { pts, stars, glow: sprite } = geometry();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, rot = 0.6, last = performance.now();
    const fx: Record<string, number> = {};
    const s = { year: target.current.year, conc: target.current.branch === "concentration" ? 1 : 0, dim: 0, t: 0, effectSince: 0, lastEffect: "", moonAng: 0.4 };

    const frame = (now: number) => {
      const dt = Math.min(64, now - last); last = now; s.t += dt;
      const t = target.current;
      s.year += (t.year - s.year) * Math.min(1, dt / 240);
      s.conc += ((t.branch === "concentration" ? 1 : 0) - s.conc) * Math.min(1, dt / 800);
      s.dim += (t.dim - s.dim) * Math.min(1, dt / 400);
      if (t.effect !== s.lastEffect) { s.lastEffect = t.effect; s.effectSince = s.t; }
      for (const k of EFFECTS) fx[k] = (fx[k] ?? 0) + ((t.effect === k ? 1 : 0) - (fx[k] ?? 0)) * Math.min(1, dt / 600);
      const since = (s.t - s.effectSince) / 1000;
      if (!reduced) rot += dt * 0.00006;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (W < 8 || H < 8) { raf = requestAnimationFrame(frame); return; }
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);

      const y = s.year;
      const mix = (id: string) => metric(id, "pluralism", y) * (1 - s.conc) + metric(id, "concentration", y) * s.conc;
      const pop = mix("population"), warm = mix("warming"), ai = mix("ai-share") / 100, off = mix("off-earth");
      const clockSec = lerp(data.clock.byBranch.pluralism as [number, number][], y) * (1 - s.conc) + lerp(data.clock.byBranch.concentration as [number, number][], y) * s.conc;
      const hubOn = s.conc * smooth(2034, 2044, y);

      const wide = W > 900, phone = W <= 760;
      const L = t.layout ?? (wide ? { cx: 0.64, cy: 0.5, r: Math.min(0.25 * W, 0.3 * H) / Math.min(W, H) } : phone ? { cx: 0.5, cy: 0.42, r: Math.min(0.36 * W, 0.17 * H) / Math.min(W, H) } : { cx: 0.5, cy: 0.52, r: Math.min(0.3 * W, 0.26 * H) / Math.min(W, H) });
      let cx = L.cx * W, cy = L.cy * H, R = Math.max(4, L.r * Math.min(W, H));
      const toMoon = fx.moon, sil = fx.silence;
      R *= 1 - sil * 0.45 + toMoon * 0.1;
      cx += toMoon * -R * 0.55; cy += toMoon * R * 0.12;
      const alpha = 1 - s.dim * 0.75;

      // nebula tinted by era
      {
        const eraHue = y < 2040 ? lerpColor([40, 70, 160], [90, 50, 160], (y - 2026) / 14) : y < 2060 ? lerpColor([90, 50, 160], [40, 120, 150], (y - 2040) / 20) : y < 2100 ? lerpColor([40, 120, 150], [170, 90, 60], (y - 2060) / 40) : lerpColor([170, 90, 60], [40, 140, 120], (y - 2100) / 100);
        const drift = s.t * 0.00002;
        for (const [nx, ny, nr, a] of [[0.18 + Math.sin(drift) * 0.05, 0.3, 0.75, 0.2], [0.85, 0.78 + Math.cos(drift * 1.3) * 0.05, 0.6, 0.14]] as [number, number, number, number][]) {
          const g0 = ctx.createRadialGradient(nx * W, ny * H, 0, nx * W, ny * H, nr * Math.max(W, H));
          g0.addColorStop(0, `rgba(${eraHue},${a * alpha})`); g0.addColorStop(1, `rgba(${eraHue},0)`);
          ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
        }
      }
      for (const [sx, sy, sb] of stars) { ctx.globalAlpha = (0.15 + sb * 0.5) * (0.6 + sil * 0.6); ctx.fillStyle = "#cfd8ff"; const px = ((sx * W + rot * 8) % W + W) % W; ctx.fillRect(px, sy * H, sb > 0.9 ? 1.6 : 1, sb > 0.9 ? 1.6 : 1); }
      ctx.globalAlpha = 1;

      // atmosphere
      const w = Math.max(0, Math.min(1, (warm - 1.2) / 1.1));
      let atm = w < 0.6 ? lerpColor([96, 170, 255], [255, 184, 92], w / 0.6) : lerpColor([255, 184, 92], [255, 96, 72], (w - 0.6) / 0.4);
      if (fx.cool > 0.01) atm = lerpColor(atm.split(",").map(Number), [150, 210, 255], fx.cool * 0.7);
      const heatBoost = 1 + fx.heat * (1.2 + 0.3 * Math.sin(s.t / 400));
      const glow = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * (1.55 + fx.heat * 0.3));
      glow.addColorStop(0, `rgba(${atm},${0.42 * heatBoost * alpha})`); glow.addColorStop(0.35, `rgba(${atm},${0.12 * heatBoost * alpha})`); glow.addColorStop(1, `rgba(${atm},0)`);
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.9, 0, Math.PI * 2); ctx.fill();

      // sphere
      const SL = [-0.72, -0.38, 0.58], sl = Math.hypot(...SL), Lx = SL[0] / sl, Ly = SL[1] / sl, Lz = SL[2] / sl;
      const dayAt = (x: number, yy: number, z: number) => Math.max(0, Math.min(1, (x * Lx + yy * Ly + z * Lz) * 1.8 + 0.35));
      const sunUp = 1 + fx.sun * 0.9;
      const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      body.addColorStop(0, `rgb(${Math.round(34 * sunUp)},${Math.round(60 * sunUp)},${Math.round(118 * sunUp)})`); body.addColorStop(0.7, "#0c1530"); body.addColorStop(1, "#060a18");
      ctx.globalAlpha = alpha; ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;

      // cities
      const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(TILT), st = Math.sin(TILT);
      const peakK = fx.peak > 0.01 ? 1 - smooth(1.6, 4.5, since) * 0.45 * fx.peak : 1;
      const visible = Math.round(Math.min(N_MAX, pts.length) * Math.min(1, pop / 10) * (1 - fx.dim * 0.35) * peakK);
      const P: [number, number, number, number][] = new Array(visible);
      for (let i = 0; i < visible; i++) { const p = pts[i]; const x1 = p.x * cr + p.z * sr, z1 = -p.x * sr + p.z * cr; const y2 = p.y * ct - z1 * st, z2 = p.y * st + z1 * ct; P[i] = [cx + x1 * R, cy + y2 * R, z2, 1 - dayAt(x1, y2, z2)]; }

      // the web
      const hub: [number, number] = [cx + R * 0.05, cy - R * 1.22];
      const webBoost = 1 + fx.web * 1.1 + fx.merge * 0.8;
      const meshA = ai * (1 - hubOn) * 0.5 * webBoost * alpha;
      if (meshA > 0.01) {
        ctx.lineWidth = 0.75; ctx.strokeStyle = fx.merge > 0.5 ? `rgba(255,214,150,${meshA})` : `rgba(120,190,255,${meshA})`; ctx.beginPath();
        for (let i = 0; i < visible; i++) { const a = P[i]; if (a[2] < -0.05) continue; for (const j of pts[i].nb) { if (j >= visible) continue; const b = P[j]; if (b[2] < -0.05) continue; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } }
        ctx.stroke();
      }
      if (hubOn > 0.01) {
        ctx.strokeStyle = `rgba(255,120,110,${ai * hubOn * 0.22 * webBoost * alpha})`; ctx.lineWidth = 0.75; ctx.beginPath();
        for (let i = 0; i < visible; i += 2) { const a = P[i]; if (a[2] < 0.05) continue; ctx.moveTo(a[0], a[1]); ctx.lineTo(hub[0], hub[1]); }
        ctx.stroke();
        const hg = ctx.createRadialGradient(hub[0], hub[1], 0, hub[0], hub[1], 28);
        hg.addColorStop(0, `rgba(255,140,120,${0.9 * hubOn * alpha})`); hg.addColorStop(1, "rgba(255,140,120,0)");
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hub[0], hub[1], 28, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,230,220,${hubOn * alpha})`; ctx.beginPath(); ctx.arc(hub[0], hub[1], 4, 0, Math.PI * 2); ctx.fill();
      }

      // city lights
      const bloom = 1 + fx.bloom * 0.8 + (fx.peak > 0.01 ? smooth(0, 1.4, since) * 0.9 * peakK * fx.peak : 0);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < visible; i++) {
        const [px, py, pz, night] = P[i]; if (pz < -0.02) continue;
        const sz = (4 + pz * 6) * (0.75 + night * 0.55) * (1 + (bloom - 1) * 0.5);
        ctx.globalAlpha = Math.min(1, (0.16 + pz * 0.32 + night * 0.5) * bloom * alpha);
        ctx.drawImage(sprite, px - sz / 2, py - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";

      // shading
      const limb = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R);
      limb.addColorStop(0, "rgba(4,7,18,0)"); limb.addColorStop(1, "rgba(4,7,18,0.55)");
      ctx.fillStyle = limb; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      const tg = ctx.createLinearGradient(cx + Lx * R, cy + Ly * R, cx - Lx * R, cy - Ly * R);
      tg.addColorStop(0, `rgba(140,190,255,${0.16 * sunUp})`); tg.addColorStop(0.45, "rgba(60,90,160,0.04)"); tg.addColorStop(0.62, "rgba(2,4,12,0.28)"); tg.addColorStop(1, "rgba(2,4,12,0.5)");
      ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      const ang = Math.atan2(Ly, Lx);
      ctx.strokeStyle = `rgba(${atm},${0.9 * alpha})`; ctx.lineWidth = 2.2 + fx.sun * 1.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(cx, cy, R - 1, ang - 1.1, ang + 1.1); ctx.stroke();
      if (s.dim > 0.01) { ctx.fillStyle = `rgba(4,6,15,${s.dim * 0.6})`; ctx.beginPath(); ctx.arc(cx, cy, R * 1.9, 0, Math.PI * 2); ctx.fill(); }

      // off-Earth
      const orbitN = Math.round(Math.max(0, Math.log10(Math.max(1, off)) - 1) * 6 * (1 + fx.orbit * 1.5));
      for (let k = 0; k < orbitN; k++) {
        const ring = 1.16 + (k % 3) * 0.08, a = rot * (3.2 - (k % 3) * 0.7) * 6 + k * 2.399;
        const ox = cx + Math.cos(a) * R * ring, oy = cy + Math.sin(a) * R * ring * 0.3;
        if (Math.sin(a) < 0 && Math.hypot(ox - cx, oy - cy) < R) continue;
        const os = 1.6 + fx.orbit * 1.4; ctx.fillStyle = `rgba(220,235,255,${0.9 * alpha})`; ctx.fillRect(ox - os / 2, oy - os / 2, os, os);
      }
      const moonOn = smooth(2033, 2036, y);
      if (moonOn > 0) {
        if (fx.moon > 0.5) s.moonAng += (0.15 - s.moonAng) * Math.min(1, dt / 500); else s.moonAng += dt * 0.00012;
        const ma = s.moonAng, mr = R * (0.06 + fx.moon * 0.07);
        const mx = cx + Math.cos(ma) * R * (1.32 + fx.moon * 0.25), my = cy + Math.sin(ma) * R * 0.38 - R * 0.12;
        if (!(Math.sin(ma) < 0 && Math.abs(mx - cx) < R * 1.05)) {
          ctx.globalAlpha = moonOn * alpha;
          const mgr = ctx.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, mr * 0.1, mx, my, mr); mgr.addColorStop(0, "#e8ebf2"); mgr.addColorStop(1, "#5d6476");
          ctx.fillStyle = mgr; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = "lighter"; const gs = 10 + fx.moon * 14; ctx.drawImage(sprite, mx - gs / 2 + mr * 0.2, my - mr * 0.35 - gs / 2, gs, gs); ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1;
        }
      }
      const marsOn = smooth(2050, 2053, y);
      if (marsOn > 0) {
        const mx = Math.min(cx + R * 1.75, W - 40) - fx.mars * R * 0.5, my = cy - R * 0.95 + fx.mars * R * 0.25, mr = R * (0.045 + fx.mars * 0.08);
        ctx.globalAlpha = marsOn * alpha;
        const mg = ctx.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, 0, mx, my, mr); mg.addColorStop(0, "#ffb08a"); mg.addColorStop(1, "#7a2a14");
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "lighter"; const gs = 10 + fx.mars * 10; ctx.drawImage(sprite, mx - gs / 2, my - gs / 2, gs, gs); ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }

      // Doomsday arc
      const clockFade = 1 - fx.clock * smooth(0.5, 2.5, since);
      if (clockFade > 0.01) {
        const close = Math.max(0, Math.min(1, 1 - clockSec / 900)), ringR = R * 1.36;
        const alarm = fx.alarm * (0.5 + 0.5 * Math.sin(s.t / 220));
        ctx.lineWidth = 1; ctx.strokeStyle = `rgba(255,255,255,${0.06 * clockFade})`; ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,96,96,${(0.28 + close * 0.3 + alarm * 0.5) * clockFade * alpha})`; ctx.lineWidth = 1.6 + fx.alarm * 1.5; ctx.lineCap = "round";
        const a0 = -Math.PI / 2 - close * Math.PI * 2;
        ctx.beginPath(); ctx.arc(cx, cy, ringR, a0, -Math.PI / 2); ctx.stroke();
        ctx.fillStyle = `rgba(255,122,122,${clockFade})`; ctx.beginPath(); ctx.arc(cx + Math.cos(a0) * ringR, cy + Math.sin(a0) * ringR, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.7 * clockFade})`; ctx.fillRect(cx - 0.75, cy - ringR - 6, 1.5, 12);
        if (fx.alarm > 0.02) { const rg = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.9); rg.addColorStop(0, `rgba(255,60,60,${0.25 * fx.alarm * (0.6 + 0.4 * Math.sin(s.t / 220))})`); rg.addColorStop(1, "rgba(255,60,60,0)"); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.9, 0, Math.PI * 2); ctx.fill(); }
      }

      // ripple / merge: a soft ring leaving the planet every 2.6s
      if ((fx.ripple > 0.02 || fx.merge > 0.02) && !reduced) {
        const k = ((s.t - s.effectSince) % 2600) / 2600;
        ctx.strokeStyle = fx.merge > fx.ripple ? `rgba(255,214,150,${0.5 * (1 - k) * fx.merge})` : `rgba(243,182,74,${0.45 * (1 - k) * fx.ripple})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, R * (1.02 + k * 0.8), 0, Math.PI * 2); ctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
