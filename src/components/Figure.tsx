import { useEffect, useState } from "react";
import { interpolateRdYlBu } from "d3";
import { data } from "../data";
import { fmt, lerp, metricKF } from "../lib";
import { DOMAIN_META, type Branch, type ForecastEvent, type Metric } from "../schema";

/**
 * One figure per prediction, drawn from the forecast's own numbers.
 *   stripes  · warming, one bar per year 2026–2200
 *   field    · a share of 100: tasks done by AI, or the odds of the prediction itself
 *   curve    · a metric across the century, both branches, the current year marked
 *   clock    · seconds to midnight
 *   orbits   · Earth, Moon and Mars, lit when people live there
 * A hand-made image can sit behind any of them: drop public/moments/<event-id>.webp and it appears.
 */
type Kind = "stripes" | "field" | "curve" | "clock" | "orbits" | "ladder";
const W = 480, H = 360;

/** A few lines are about a specific share or quantity that is not a tracked metric; say what the 100 dots mean. */
const FIELD_OVERRIDE: Record<string, { value: number; label: string; invert?: boolean }> = {
  "entry-level-hiring-contracts": { value: 0.5, label: "of 100 entry-level roles at banks, law and consulting firms: gone", invert: true },
  "ai-chemistry-majority": { value: 0.55, label: "of 100 new FDA approvals, designed by AI" },
  "mass-casualty-event": { value: 0.15, label: "of 100 futures, millions die in one event" },
  "ai-runs-rd-programs": { value: 0.6, label: "of 100 futures, the research loop closes by 2028" },
};
const CURVE_OVERRIDE: Record<string, string> = { "labor-cost-irrelevant": "work-hours", "ubi-pilots-national": "work-hours", "humanoids-in-homes": "work-hours" };

function kindFor(ev: ForecastEvent): { kind: Kind; metric?: Metric } {
  const m = ev.hero?.metric;
  const metric = (id: string) => data.metrics.find((x) => x.id === id);
  if (ev.hero?.ladder?.length) return { kind: "ladder" };
  if (CURVE_OVERRIDE[ev.id]) return { kind: "curve", metric: metric(CURVE_OVERRIDE[ev.id]) };
  if (m === "warming") return { kind: "stripes", metric: metric(m) };
  if (m === "ai-share") return { kind: "field", metric: metric(m) };
  if (m === "clock") return { kind: "clock" };
  if (m === "off-earth") return { kind: "orbits", metric: metric(m) };
  if (m) return { kind: "curve", metric: metric(m) };
  const fx = ev.hero?.effect;
  if (fx === "moon" || fx === "mars" || fx === "orbit" || fx === "silence") return { kind: "orbits", metric: metric("off-earth") };
  if (fx === "alarm" || fx === "clock") return { kind: "clock" };
  if (fx === "heat" || fx === "cool") return { kind: "stripes", metric: metric("warming") };
  return { kind: "field" };
}

export default function Figure({ ev, branch, year, active }: { ev: ForecastEvent; branch: Branch; year: number; active: boolean }) {
  const { kind, metric } = kindFor(ev);
  const color = DOMAIN_META[ev.domain].color;
  const [img, setImg] = useState<string | null>(`/moments/${ev.id}.webp`);
  useEffect(() => setImg(`/moments/${ev.id}.webp`), [ev.id]);
  return (
    <div className={"figure" + (active ? " live" : "")} style={{ ["--d" as any]: color }} role="img" aria-label={`${ev.hero?.label ?? ev.title}: a figure drawn from the forecast's numbers`}>
      {img && <img className="fig-art" src={img} alt="" onError={() => setImg(null)} />}
      {kind === "stripes" && metric && <Stripes m={metric} branch={branch} year={year} ev={ev} />}
      {kind === "field" && <Field ev={ev} metric={metric} branch={branch} year={year} />}
      {kind === "curve" && metric && <Curve m={metric} branch={branch} year={year} ev={ev} />}
      {kind === "clock" && <Dial branch={branch} year={year} ev={ev} />}
      {kind === "orbits" && <Orbits m={metric} branch={branch} year={year} ev={ev} />}
      {kind === "ladder" && <Ladder ev={ev} active={active} />}
    </div>
  );
}

/* ── warming stripes ── */
function Stripes({ m, branch, year, ev }: { m: Metric; branch: Branch; year: number; ev: ForecastEvent }) {
  const kf = metricKF(m, branch);
  const years = Array.from({ length: 2200 - 2026 + 1 }, (_, i) => 2026 + i);
  const bw = W / years.length;
  const vs = kf.map((k) => k[1]), lo = Math.min(...vs) - 0.15, hi = Math.max(...vs) + 0.1;
  const col = (v: number) => interpolateRdYlBu(1 - Math.max(0, Math.min(1, (v - lo) / (hi - lo))));
  const yr = Math.round(year), v = lerp(kf, year);
  const x = (y: number) => (y - 2026) * bw;
  const peak = kf.reduce((a, b) => (b[1] > a[1] ? b : a), kf[0]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fig">
      {years.map((y) => <rect key={y} x={x(y)} y={70} width={bw + 0.6} height={200} fill={col(lerp(kf, y))} opacity={y <= yr ? 1 : 0.28} />)}
      <line x1={x(yr) + bw / 2} x2={x(yr) + bw / 2} y1={56} y2={284} stroke="#fff" strokeWidth={2} />
      <text x={x(yr) + bw / 2} y={44} textAnchor={yr > 2150 ? "end" : yr < 2070 ? "start" : "middle"} className="fig-big">{fmt(m, v).value}{fmt(m, v).unit}</text>
      <text x={x(peak[0]) + bw / 2} y={302} textAnchor="middle" className="fig-mono fig-dim">peak {fmt(m, peak[1]).value}° · {peak[0]}</text>
      <text x={0} y={330} className="fig-mono fig-dim">2026</text>
      <text x={W} y={330} textAnchor="end" className="fig-mono fig-dim">2200</text>
      <text x={W / 2} y={330} textAnchor="middle" className="fig-mono fig-dim">one bar per year · {ev.year} marked</text>
      <line x1={x(ev.year) + bw / 2} x2={x(ev.year) + bw / 2} y1={270} y2={284} stroke="var(--d)" strokeWidth={3} />
    </svg>
  );
}

/* ── a field of 100 ── */
function Field({ ev, metric, branch, year }: { ev: ForecastEvent; metric?: Metric; branch: Branch; year: number }) {
  const ov = FIELD_OVERRIDE[ev.id];
  const share = ov ? ov.value : metric ? lerp(metricKF(metric, branch), Math.max(year, ev.year)) / 100 : (ev.probability ?? 0.5);
  const n = Math.round(share * 100);
  const [lit, setLit] = useState(0);
  useEffect(() => { const t = setTimeout(() => setLit(n), 60); return () => clearTimeout(t); }, [n]);
  const cell = 30, pad = (W - 10 * cell) / 2, top = 40;
  const label = ov ? `${n} ${ov.label}` : metric ? `${n} of 100 units of cognitive work, done by AI` : `${n} of 100 futures, this happens`;
  const gone = !!ov?.invert;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fig">
      {Array.from({ length: 100 }, (_, i) => {
        const r = Math.floor(i / 10), c = i % 10, on = i < lit;
        const cx = pad + c * cell + cell / 2, cy = top + r * cell + cell / 2;
        if (gone) return on ? <g key={i} stroke="var(--d)" strokeWidth={2} strokeLinecap="round" style={{ transition: `opacity .5s ${i * 6}ms` }}><line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} /><line x1={cx + 5} y1={cy - 5} x2={cx - 5} y2={cy + 5} /></g> : <circle key={i} cx={cx} cy={cy} r={8} fill="rgba(255,255,255,.55)" />;
        return <circle key={i} cx={cx} cy={cy} r={on ? 9 : 5} fill={on ? "var(--d)" : "rgba(255,255,255,.14)"} style={{ transition: `r .5s ${i * 6}ms, fill .5s ${i * 6}ms` }} />;
      })}
      <text x={W / 2} y={H - 18} textAnchor="middle" className="fig-mono fig-dim">{label}</text>
    </svg>
  );
}

/* ── a metric across the century ── */
function Curve({ m, branch, year, ev }: { m: Metric; branch: Branch; year: number; ev: ForecastEvent }) {
  const other: Branch = branch === "pluralism" ? "concentration" : "pluralism";
  const a = metricKF(m, branch), b = metricKF(m, other);
  const log = m.scale === "log";
  const vals = [...a, ...b, ...(m.reference[0]?.points ?? [])].map((k) => k[1]);
  const lo = log ? Math.log10(Math.max(1, Math.min(...vals))) : Math.min(...vals) * 0.92, hi = log ? Math.log10(Math.max(...vals)) : Math.max(...vals) * 1.05;
  const px = 64, py = 40, pw = W - px - 24, ph = H - py - 60;
  const X = (y: number) => px + ((y - 2026) / 174) * pw;
  const Y = (v: number) => py + ph - (((log ? Math.log10(Math.max(1, v)) : v) - lo) / (hi - lo || 1)) * ph;
  const path = (kf: [number, number][]) => kf.map((k, i) => `${i ? "L" : "M"}${X(k[0]).toFixed(1)},${Y(k[1]).toFixed(1)}`).join(" ");
  const ref = m.reference[0];
  const v = lerp(a, year), f = fmt(m, v);
  const yr = Math.round(year);
  const same = a === b;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fig">
      <title>{m.label}: {f.value}{f.unit} in {yr} on the {branch} path{ref ? `; ${ref.label} shown dotted` : ""}{m.observed.length ? `; ${m.observed.length} observed point${m.observed.length > 1 ? "s" : ""}` : ""}.</title>
      <line x1={px} x2={px + pw} y1={py + ph} y2={py + ph} stroke="rgba(255,255,255,.18)" />
      {[0, 0.5, 1].map((t) => { const vv = log ? Math.pow(10, lo + (hi - lo) * t) : lo + (hi - lo) * t; const yy = py + ph - t * ph; return <g key={t}><line x1={px - 6} x2={px + pw} y1={yy} y2={yy} stroke="rgba(255,255,255,.08)" /><text x={px - 10} y={yy + 4} textAnchor="end" className="fig-mono fig-dim">{fmt(m, vv).value}{fmt(m, vv).unit}</text></g>; })}
      {!same && <path d={path(b)} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth={1.5} strokeDasharray="4 5" />}
      {ref && <path d={path(ref.points as [number, number][])} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={2} strokeDasharray="1 6" strokeLinecap="round" />}
      {ref && <text x={X(ref.points[ref.points.length - 1][0]) + 8} y={Y(ref.points[ref.points.length - 1][1]) + 4} textAnchor="start" className="fig-mono fig-dim">{ref.label}: {fmt(m, ref.points[ref.points.length - 1][1]).value}{fmt(m, ref.points[ref.points.length - 1][1]).unit}</text>}
      <path d={path(a) + ` L${X(2200).toFixed(1)},${(py + ph).toFixed(1)} L${X(2026).toFixed(1)},${(py + ph).toFixed(1)} Z`} fill="var(--d)" opacity={0.12} />
      <path d={path(a)} fill="none" stroke="var(--d)" strokeWidth={3} strokeLinejoin="round" />
      {m.observed.map((o) => { const oy = Number(String(o.date).slice(0, 4)); return <circle key={o.date} cx={X(oy)} cy={Y(o.value)} r={5} fill="#fff" stroke="var(--d)" strokeWidth={2}><title>Observed {o.date}: {fmt(m, o.value).value}{fmt(m, o.value).unit}</title></circle>; })}
      <line x1={X(yr)} x2={X(yr)} y1={py} y2={py + ph} stroke="#fff" strokeOpacity={0.5} />
      <circle cx={X(yr)} cy={Y(v)} r={7} fill="#fff" stroke="var(--d)" strokeWidth={3} />
      <text x={X(yr) + (yr > 2130 ? -14 : 14)} y={Y(v) - 14} textAnchor={yr > 2130 ? "end" : "start"} className="fig-big">{f.value}<tspan className="fig-unit">{f.unit}</tspan></text>
      <text x={px} y={H - 18} className="fig-mono fig-dim">2026</text>
      <text x={px + pw} y={H - 18} textAnchor="end" className="fig-mono fig-dim">2200</text>
      <text x={px + pw / 2} y={H - 18} textAnchor="middle" className="fig-mono fig-dim">{m.label}{same ? "" : ` · dashed: if ${other} wins`}{m.observed.length ? " · ○ observed" : ""}</text>
      <line x1={X(ev.year)} x2={X(ev.year)} y1={py + ph} y2={py + ph + 10} stroke="var(--d)" strokeWidth={3} />
    </svg>
  );
}

/* ── seconds to midnight ── */
function Dial({ branch, year, ev }: { branch: Branch; year: number; ev: ForecastEvent }) {
  const sec = lerp(data.clock.byBranch[branch] as [number, number][], Math.max(year, ev.year));
  const cx = W / 2, cy = H / 2 + 8, R = 140;
  const deg = -(Math.max(0, Math.min(1800, sec)) / 60) * 6;
  const p = (a: number, r: number) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
  const [x0, y0] = p(deg, R - 18);
  const retired = ev.id === "clock-retired";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fig">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={2} />
      {Array.from({ length: 60 }, (_, i) => { const a = i * 6; const [x1, y1] = p(a, i % 5 ? R - 7 : R - 13), [x2, y2] = p(a, R); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,.4)" strokeWidth={i % 5 ? 1 : 2} />; })}
      {!retired && <path d={`M${cx} ${cy}L${x0} ${y0}A${R - 18} ${R - 18} 0 0 1 ${cx} ${cy - (R - 18)}Z`} fill="var(--d)" opacity={0.22} />}
      <text x={cx} y={cy - R + 34} textAnchor="middle" className="fig-mono fig-dim">12</text>
      <line x1={cx} y1={cy} x2={cx} y2={cy - R + 24} stroke={retired ? "rgba(255,255,255,.3)" : "var(--d)"} strokeWidth={5} strokeLinecap="round" style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${retired ? -90 : deg}deg)`, transition: "transform .6s cubic-bezier(.2,.8,.2,1)" }} />
      <line x1={cx} y1={cy} x2={cx} y2={cy - 58} stroke="#fff" strokeWidth={6} strokeLinecap="round" style={{ transformOrigin: `${cx}px ${cy}px`, transform: "rotate(-28deg)" }} />
      <circle cx={cx} cy={cy} r={6} fill="#fff" />
      <text x={cx} y={cy + 70} textAnchor="middle" className="fig-big">{retired ? "—" : Math.round(sec).toLocaleString("en-US")}</text>
      <text x={cx} y={cy + 92} textAnchor="middle" className="fig-mono fig-dim">{retired ? "the clock is retired" : "seconds to midnight"}</text>
    </svg>
  );
}

/* ── Earth, Moon, Mars ── */
function Orbits({ m, branch, year, ev }: { m?: Metric; branch: Branch; year: number; ev: ForecastEvent }) {
  const y = Math.max(year, ev.year);
  const off = m ? lerp(metricKF(m, branch), y) : 0;
  const moonY = data.events.find((e) => e.id === "lunar-base-occupied")?.year ?? 2035;
  const marsY = data.events.find((e) => e.id === "mars-outpost")?.year ?? 2052;
  const moonOn = y >= moonY, marsOn = y >= marsY;
  const ex = 120, ey = H / 2;
  const silence = ev.id === "the-silence";
  const f = m ? fmt(m, off) : { value: "", unit: "" };
  const dots = Math.min(60, Math.round(Math.log10(Math.max(1, off)) * 12));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fig">
      {silence && [1, 2, 3, 4].map((k) => <circle key={k} cx={ex} cy={ey} r={40 + k * 60} fill="none" stroke="rgba(255,255,255,.14)" strokeDasharray="2 10" />)}
      <ellipse cx={ex} cy={ey} rx={86} ry={30} fill="none" stroke="rgba(255,255,255,.22)" />
      <ellipse cx={ex} cy={ey} rx={300} ry={104} fill="none" stroke="rgba(255,255,255,.14)" />
      <circle cx={ex} cy={ey} r={30} fill="#3f7fd6" />
      <circle cx={ex} cy={ey} r={30} fill={`url(#shade-${ev.id})`} />
      <defs><radialGradient id={`shade-${ev.id}`} cx="35%" cy="35%" r="70%"><stop offset="0" stopColor="#fff" stopOpacity=".25" /><stop offset="1" stopColor="#000" stopOpacity=".55" /></radialGradient></defs>
      <circle cx={ex + 86} cy={ey + 6} r={9} fill={moonOn ? "#f3e7c6" : "#6a6f80"} style={{ filter: moonOn ? "drop-shadow(0 0 10px #f3e7c6)" : "none", transition: "fill .6s" }} />
      <circle cx={ex + 300} cy={ey - 12} r={14} fill={marsOn ? "#ff8b5a" : "#6b4a40"} style={{ filter: marsOn ? "drop-shadow(0 0 14px #ff8b5a)" : "none", transition: "fill .6s" }} />
      {Array.from({ length: dots }, (_, i) => { const a = (i / Math.max(1, dots)) * Math.PI * 2; const r = 44 + (i % 3) * 6; return <circle key={i} cx={(marsOn && i % 2 ? ex + 300 : moonOn ? ex + 86 : ex) + Math.cos(a) * (moonOn ? r * 0.45 : r)} cy={(marsOn && i % 2 ? ey - 12 : moonOn ? ey + 6 : ey) + Math.sin(a) * (moonOn ? r * 0.45 : r)} r={2} fill="var(--d)" />; })}
      <text x={ex} y={ey + 56} textAnchor="middle" className="fig-mono fig-dim">Earth</text>
      <text x={ex + 86} y={ey + 30} textAnchor="middle" className="fig-mono fig-dim">Moon{moonOn ? " · lived on" : ""}</text>
      <text x={ex + 300} y={ey + 16} textAnchor="middle" className="fig-mono fig-dim">Mars{marsOn ? " · lived on" : ""}</text>
      {m && <text x={W - 24} y={44} textAnchor="end" className="fig-big">{f.value}{f.unit}</text>}
      {m && <text x={W - 24} y={66} textAnchor="end" className="fig-mono fig-dim">people living off-Earth · {Math.round(y)}</text>}
      {silence && <text x={W / 2} y={H - 18} textAnchor="middle" className="fig-mono fig-dim">no signal from anyone else, still</text>}
    </svg>
  );
}

/* ── what has to happen, in order ── */
function Ladder({ ev, active }: { ev: ForecastEvent; active: boolean }) {
  const steps = ev.hero!.ladder!;
  const n = steps.length, x0 = 70, gap = (H - 60) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fig ladder">
      <line x1={x0} x2={x0} y1={gap / 2 + 20} y2={gap * (n - 0.5) + 20} stroke="rgba(255,255,255,.18)" strokeWidth={2} />
      {steps.map((st, i) => {
        const y = gap * (i + 0.5) + 20, done = st.state === "done", now = st.state === "now";
        return (
          <g key={i} style={{ opacity: active ? 1 : 0.6, transition: `opacity .4s ${i * 90}ms` }}>
            {i > 0 && <line x1={x0} x2={x0} y1={y - gap + 10} y2={y - 10} stroke={done || now ? "var(--d)" : "rgba(255,255,255,.18)"} strokeWidth={2} />}
            <circle cx={x0} cy={y} r={done ? 9 : now ? 11 : 7} fill={done ? "var(--d)" : "transparent"} stroke={done || now ? "var(--d)" : "rgba(255,255,255,.35)"} strokeWidth={now ? 3 : 2} />
            {done && <path d={`M${x0 - 4} ${y}l3 3 6-6`} stroke="#04060f" strokeWidth={2} fill="none" strokeLinecap="round" />}
            {now && <circle cx={x0} cy={y} r={4} fill="var(--d)" />}
            <text x={x0 + 26} y={y - (st.note ? 2 : -5)} className={done || now ? "fig-step" : "fig-step fig-dim"}>{st.label}</text>
            {st.note && <text x={x0 + 26} y={y + 16} className="fig-mono fig-dim">{st.note}</text>}
            <text x={x0 - 24} y={y + 4} textAnchor="end" className="fig-mono fig-dim">{done ? "done" : now ? "now" : ""}</text>
          </g>
        );
      })}
    </svg>
  );
}
