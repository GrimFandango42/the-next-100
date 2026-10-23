import { useEffect, useRef } from "react";
import { data } from "../data";
import { lerp, metricKF } from "../lib";
import type { Branch } from "../schema";

/**
 * The living planet. Every visual property is a forecast value:
 *  - city lights      = world population (each light ≈ 15 million people)
 *  - atmosphere hue    = warming above pre-industrial
 *  - the web of links  = share of cognitive work done by AI; under concentration it collapses into one hub
 *  - orbiting lights   = humans living off-Earth (log scale); Moon base from 2035, Mars from 2052
 *  - the red arc       = the Doomsday Clock (longer arc = closer to midnight)
 */

type Props = { year: number; branch: Branch; className?: string };

const N_MAX = 720;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// continents: a cheap smooth field on the sphere; lights only appear on "land"
function land(x: number, y: number, z: number) {
  return Math.sin(x * 2.1 + 0.4) * Math.cos(y * 2.7 - 0.9) + 0.6 * Math.sin(z * 3.3 + x * 1.2) + 0.35 * Math.cos(x * 5.1 - z * 4.2 + y) - 0.25 * Math.abs(y);
}

type Pt = { x: number; y: number; z: number; nb: number[]; hue: number };
type Geo = { land: [number, number, number][]; pts: Pt[]; stars: [number, number, number][]; glow: HTMLCanvasElement };
let CACHE: Geo | null = null;
function geometry(): Geo {
  if (CACHE) return CACHE;
  const rnd = mulberry32(100);
  // a lat/lon grid of dots; the top third by the land field become continents
  const grid: [number, number, number, number][] = [];
  for (let lat = -78; lat <= 80; lat += 2.4) {
    const r = Math.cos((lat * Math.PI) / 180), y = Math.sin((lat * Math.PI) / 180);
    const step = 2.4 / Math.max(0.18, r);
    for (let lon = 0; lon < 360; lon += step) {
      const x = r * Math.cos((lon * Math.PI) / 180), z = r * Math.sin((lon * Math.PI) / 180);
      grid.push([x, -y, z, land(x, -y, z)]);
    }
  }
  const sorted = grid.map((g) => g[3]).sort((p, q) => q - p);
  const thr = sorted[Math.floor(sorted.length * 0.3)];
  const landPts = grid.filter((g) => g[3] >= thr).map((g) => [g[0], g[1], g[2]] as [number, number, number]);
  // cities: a random subset of land, densest where the field is strongest, revealed in rank order as population grows
  const pool = grid.filter((g) => g[3] >= thr).map((g) => ({ g, k: rnd() * (1.4 - (g[3] - thr)) }));
  pool.sort((p, q) => p.k - q.k);
  const pts: Pt[] = pool.slice(0, N_MAX).map(({ g }) => ({ x: g[0] + (rnd() - 0.5) * 0.02, y: g[1] + (rnd() - 0.5) * 0.02, z: g[2] + (rnd() - 0.5) * 0.02, nb: [], hue: rnd() }));
  for (const p of pts) {
    const d = pts.map((q, j) => [(p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2, j] as [number, number]).sort((u, v) => u[0] - v[0]);
    p.nb = [d[1][1], d[2][1], d[3][1]];
  }
  const sr = mulberry32(7);
  const stars: [number, number, number][] = Array.from({ length: 320 }, () => [sr(), sr(), sr()]);
  // one soft glow sprite, reused for every city light
  const glow = document.createElement("canvas"); glow.width = glow.height = 32;
  const g = glow.getContext("2d")!; const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "rgba(255,236,190,1)"); gr.addColorStop(0.18, "rgba(255,206,130,.85)"); gr.addColorStop(0.5, "rgba(255,170,80,.18)"); gr.addColorStop(1, "rgba(255,170,80,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  CACHE = { land: landPts, pts, stars, glow };
  return CACHE;
}

const smooth = (a: number, b: number, t: number) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const metric = (id: string, b: Branch, y: number) => { const m = data.metrics.find((x) => x.id === id)!; return lerp(metricKF(m, b), y); };

export default function World({ year, branch, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef({ year, branch });
  target.current = { year, branch };

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const { pts, stars, land: landPts, glow: glowSprite } = geometry();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, rot = 0.6, last = performance.now();
    // smoothed state
    const s = { year: target.current.year, conc: target.current.branch === "concentration" ? 1 : 0 };

    const frame = (now: number) => {
      const dt = Math.min(64, now - last); last = now;
      const t = target.current;
      s.year += (t.year - s.year) * Math.min(1, dt / 220);
      s.conc += ((t.branch === "concentration" ? 1 : 0) - s.conc) * Math.min(1, dt / 700);
      if (!reduced) rot += dt * 0.00007;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const y = s.year;
      const bP = "pluralism" as Branch, bC = "concentration" as Branch;
      const mix = (id: string) => metric(id, bP, y) * (1 - s.conc) + metric(id, bC, y) * s.conc;
      const pop = mix("population"), warm = mix("warming"), ai = mix("ai-share") / 100, off = mix("off-earth");
      const clockSec = lerp(data.clock.byBranch.pluralism as [number, number][], y) * (1 - s.conc) + lerp(data.clock.byBranch.concentration as [number, number][], y) * s.conc;
      const hubOn = s.conc * smooth(2034, 2044, y); // concentration only bites once the hinge resolves

      const wide = W > 900, phone = W <= 760;
      const cx = wide ? W * 0.62 : W * 0.5, cy = wide ? H * 0.5 : phone ? H * 0.43 : H * 0.52;
      const R = wide ? Math.min(W * 0.26, H * 0.31) : phone ? Math.min(W * 0.36, H * 0.17) : Math.min(W * 0.3, H * 0.26);

      // stars
      for (const [sx, sy, sb] of stars) {
        ctx.globalAlpha = 0.15 + sb * 0.5;
        ctx.fillStyle = "#cfd8ff";
        const px = ((sx * W + rot * 8) % W + W) % W;
        ctx.fillRect(px, sy * H, sb > 0.9 ? 1.6 : 1, sb > 0.9 ? 1.6 : 1);
      }
      ctx.globalAlpha = 1;

      // atmosphere: blue at 1.2°C, amber by 2°C, red past 2.3°C
      const w = Math.max(0, Math.min(1, (warm - 1.2) / 1.1));
      const atm = w < 0.6 ? lerpColor([96, 170, 255], [255, 184, 92], w / 0.6) : lerpColor([255, 184, 92], [255, 96, 72], (w - 0.6) / 0.4);
      const glow = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.55);
      glow.addColorStop(0, `rgba(${atm},0.42)`); glow.addColorStop(0.35, `rgba(${atm},0.12)`); glow.addColorStop(1, `rgba(${atm},0)`);
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.55, 0, Math.PI * 2); ctx.fill();

      // orb
      const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      body.addColorStop(0, "#1b2a52"); body.addColorStop(0.7, "#0c1530"); body.addColorStop(1, "#060a18");
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(${atm},0.55)`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

      // continents: faint dots, front hemisphere only
      {
        const cr0 = Math.cos(rot), sr0 = Math.sin(rot), ct0 = Math.cos(0.32), st0 = Math.sin(0.32);
        ctx.fillStyle = "rgba(120,150,210,0.55)";
        for (const [lx, ly, lz] of landPts) {
          const x1 = lx * cr0 + lz * sr0, z1 = -lx * sr0 + lz * cr0;
          const y2 = ly * ct0 - z1 * st0, z2 = ly * st0 + z1 * ct0;
          if (z2 < 0.02) continue;
          ctx.globalAlpha = 0.18 + z2 * 0.5;
          const sz = 0.9 + z2 * 0.9;
          ctx.fillRect(cx + x1 * R - sz / 2, cy + y2 * R - sz / 2, sz, sz);
        }
        ctx.globalAlpha = 1;
      }

      // project
      const cr = Math.cos(rot), sr = Math.sin(rot), tilt = 0.32, ct = Math.cos(tilt), st = Math.sin(tilt);
      const visible = Math.round(Math.min(N_MAX, pts.length) * Math.min(1, pop / 10));
      const P = new Array(visible);
      for (let i = 0; i < visible; i++) {
        const p = pts[i];
        const x1 = p.x * cr + p.z * sr, z1 = -p.x * sr + p.z * cr;
        const y2 = p.y * ct - z1 * st, z2 = p.y * st + z1 * ct;
        P[i] = [cx + x1 * R, cy + y2 * R, z2];
      }

      // AI web: mesh between neighbours (pluralism) or spokes to one hub (concentration)
      const hub = [cx + R * 0.05, cy - R * 1.22];
      if (ai > 0.02) {
        ctx.lineWidth = 0.7;
        const meshA = ai * (1 - hubOn) * 0.55;
        if (meshA > 0.01) {
          ctx.strokeStyle = `rgba(120,190,255,${meshA})`;
          ctx.beginPath();
          for (let i = 0; i < visible; i++) {
            const a = P[i]; if (a[2] < -0.05) continue;
            for (const j of pts[i].nb) { if (j >= visible) continue; const b = P[j]; if (b[2] < -0.05) continue; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
          }
          ctx.stroke();
        }
        if (hubOn > 0.01) {
          ctx.strokeStyle = `rgba(255,120,110,${ai * hubOn * 0.22})`;
          ctx.beginPath();
          for (let i = 0; i < visible; i += 2) { const a = P[i]; if (a[2] < 0.05) continue; ctx.moveTo(a[0], a[1]); ctx.lineTo(hub[0], hub[1]); }
          ctx.stroke();
          const hg = ctx.createRadialGradient(hub[0], hub[1], 0, hub[0], hub[1], 26);
          hg.addColorStop(0, `rgba(255,140,120,${0.9 * hubOn})`); hg.addColorStop(1, "rgba(255,140,120,0)");
          ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hub[0], hub[1], 26, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(255,230,220,${hubOn})`; ctx.beginPath(); ctx.arc(hub[0], hub[1], 4, 0, Math.PI * 2); ctx.fill();
        }
      }

      // city lights: additive glow, brighter facing us
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < visible; i++) {
        const [px, py, pz] = P[i];
        if (pz < -0.02) continue;
        const sz = 5 + pz * 7;
        ctx.globalAlpha = 0.35 + pz * 0.6;
        ctx.drawImage(glowSprite, px - sz / 2, py - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";

      // limb shading so the globe reads as a sphere
      const limb = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R);
      limb.addColorStop(0, "rgba(4,7,18,0)"); limb.addColorStop(1, "rgba(4,7,18,0.55)");
      ctx.fillStyle = limb; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

      // off-Earth: orbiting lights, Moon base, Mars
      const nOrbit = Math.round(Math.max(0, Math.log10(Math.max(1, off))) * 9);
      for (let k = 0; k < nOrbit; k++) {
        const ring = 1.18 + (k % 3) * 0.09;
        const ang = rot * (3.2 - (k % 3) * 0.7) * 6 + k * 2.399;
        const ox = cx + Math.cos(ang) * R * ring, oy = cy + Math.sin(ang) * R * ring * 0.32;
        if (Math.sin(ang) < 0 && Math.hypot(ox - cx, oy - cy) < R) continue; // behind the planet
        ctx.fillStyle = "rgba(220,235,255,0.85)"; ctx.fillRect(ox - 1, oy - 1, 2, 2);
      }
      const moonOn = smooth(2033, 2036, y);
      if (moonOn > 0) {
        const ma = rot * 2.2 + 0.4;
        const mx = cx + Math.cos(ma) * R * 1.32, my = cy + Math.sin(ma) * R * 0.38 - R * 0.12;
        const behind = Math.sin(ma) < 0 && Math.abs(mx - cx) < R * 1.05;
        if (!behind) {
          ctx.globalAlpha = moonOn;
          const mr = R * 0.06;
          const mgr = ctx.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, mr * 0.1, mx, my, mr);
          mgr.addColorStop(0, "#e8ebf2"); mgr.addColorStop(1, "#5d6476");
          ctx.fillStyle = mgr; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = "lighter"; ctx.drawImage(glowSprite, mx - 7, my - mr * 0.3 - 7, 14, 14); ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1;
        }
      }
      const marsOn = smooth(2050, 2053, y);
      if (marsOn > 0) {
        const mx = Math.min(cx + R * 1.75, W - 36), my = cy - R * 0.95;
        ctx.globalAlpha = marsOn;
        const mr = R * 0.045;
        const mg = ctx.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, 0, mx, my, mr);
        mg.addColorStop(0, "#ffb08a"); mg.addColorStop(1, "#7a2a14");
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "lighter"; ctx.drawImage(glowSprite, mx - 6, my - 6, 12, 12); ctx.globalCompositeOperation = "source-over";
        ctx.font = "11px 'IBM Plex Mono', monospace"; ctx.fillStyle = "rgba(255,190,160,.8)"; ctx.textAlign = "center";
        ctx.fillText("Mars", mx, my + mr + 14);
        ctx.globalAlpha = 1;
      }

      // Doomsday arc: the gap at the top is the time left before midnight (a full ring = 15 minutes)
      const close = Math.max(0, Math.min(1, 1 - clockSec / 900));
      const ringR = R * 1.36;
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,96,96,${0.28 + close * 0.3})`; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      const a0 = -Math.PI / 2 - close * Math.PI * 2;
      ctx.beginPath(); ctx.arc(cx, cy, ringR, a0, -Math.PI / 2); ctx.stroke();
      ctx.fillStyle = "#ff7a7a"; ctx.beginPath(); ctx.arc(cx + Math.cos(a0) * ringR, cy + Math.sin(a0) * ringR, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fillRect(cx - 0.75, cy - ringR - 6, 1.5, 12);
      ctx.font = "11px 'IBM Plex Mono', monospace"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,160,160,.85)";
      if (!phone) ctx.fillText(`${Math.round(clockSec)}s to midnight`, cx + Math.cos(a0 - 0.0) * ringR * 0.0 + 0, cy - ringR - 12);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

function lerpColor(a: number[], b: number[], t: number) {
  t = Math.max(0, Math.min(1, t));
  return a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",");
}
