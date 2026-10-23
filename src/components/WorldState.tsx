import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { data, YEAR_MAX, YEAR_MIN } from "../data";
import { fmt, lerp, metricKF } from "../lib";
import type { Branch, Metric } from "../schema";
import { useStore } from "../store";

const other = (b: Branch): Branch => (b === "pluralism" ? "concentration" : "pluralism");

export default function WorldState() {
  const { year, branch } = useStore();
  const [focus, setFocus] = useState(data.metrics[0].id);
  const m = data.metrics.find((x) => x.id === focus)!;
  return (
    <div className="ws">
      <div className="tiles">
        {data.metrics.map((mm) => {
          const now = lerp(metricKF(mm, branch), year);
          const alt = lerp(metricKF(mm, other(branch)), year);
          const v = fmt(mm, now);
          const diff = mm.byBranch && Math.abs(now - alt) / Math.max(1e-9, Math.abs(alt)) > 0.015;
          const pct = diff ? Math.round(((now - alt) / Math.abs(alt)) * 100) : 0;
          return (
            <button key={mm.id} className={"tile" + (mm.id === focus ? " on" : "")} onClick={() => setFocus(mm.id)} aria-pressed={mm.id === focus}>
              <div className="lbl">{mm.label}</div>
              <div className="v mono">{v.value}<small>{v.unit}</small></div>
              <div className={"delta" + (diff ? "" : " none")}>{diff ? `${pct > 0 ? "+" : ""}${Math.abs(pct) > 999 ? "≫" : pct}% vs ${other(branch)}` : mm.byBranch ? "same in both branches here" : "same in both branches"}</div>
              <Spark m={mm} />
            </button>
          );
        })}
      </div>
      <Explorer m={m} />
    </div>
  );
}

function Spark({ m }: { m: Metric }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { year, branch } = useStore();
  useEffect(() => {
    const c = ref.current!, ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = 34;
    c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const series = (b: Branch) => { const kf = metricKF(m, b); const raw: number[] = []; for (let y = YEAR_MIN; y <= YEAR_MAX; y++) raw.push(lerp(kf, y)); return m.scale === "log" ? raw.map((v) => Math.log10(v + 1)) : raw; };
    const cur = series(branch), alt = m.byBranch ? series(other(branch)) : null;
    const all = alt ? cur.concat(alt) : cur;
    const mn = Math.min(...all), mx = Math.max(...all);
    const X = (i: number) => (i / (YEAR_MAX - YEAR_MIN)) * W, Y = (v: number) => H - 3 - ((v - mn) / ((mx - mn) || 1)) * (H - 6);
    const css = getComputedStyle(document.documentElement);
    const acc = css.getPropertyValue("--accent").trim(), mut = css.getPropertyValue("--muted").trim();
    if (alt) { ctx.beginPath(); alt.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.strokeStyle = mut; ctx.globalAlpha = 0.45; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    ctx.beginPath(); cur.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.strokeStyle = mut; ctx.lineWidth = 1.5; ctx.stroke();
    const i = year - YEAR_MIN;
    ctx.beginPath(); ctx.arc(X(i), Y(cur[i]), 3.4, 0, Math.PI * 2); ctx.fillStyle = acc; ctx.fill();
  }, [m, year, branch]);
  return <canvas ref={ref} className="spark" height={34} aria-hidden="true" />;
}

function Explorer({ m }: { m: Metric }) {
  const wrap = useRef<HTMLDivElement>(null);
  const { year, branch, setYear } = useStore();
  const [w, setW] = useState(800);
  const [peek, setPeek] = useState<number | null>(null);
  const dragging = useRef(false);
  useEffect(() => { const ro = new ResizeObserver(([e]) => setW(e.contentRect.width)); ro.observe(wrap.current!); return () => ro.disconnect(); }, []);
  const H = 240, ML = 52, MR = 16, MT = 22, MB = 28;
  const x = d3.scaleLinear().domain([YEAR_MIN, YEAR_MAX]).range([ML, w - MR]);
  const series = (["pluralism", "concentration"] as const).map((b) => ({ b, pts: d3.range(YEAR_MIN, YEAR_MAX + 1).map((y) => [y, lerp(metricKF(m, b), y)] as [number, number]) }));
  const all = series.flatMap((s) => s.pts.map((p) => p[1]));
  const y = (m.scale === "log" ? d3.scaleLog().domain([Math.max(1, d3.min(all)!), d3.max(all)!]) : d3.scaleLinear().domain([Math.min(0, d3.min(all)!), d3.max(all)! * 1.08])).range([H - MB, MT]).nice();
  const line = d3.line<[number, number]>().x((p) => x(p[0])).y((p) => y(p[1])).curve(d3.curveMonotoneX);
  const area = d3.area<[number, number]>().x((p) => x(p[0])).y0(H - MB).y1((p) => y(p[1])).curve(d3.curveMonotoneX);
  const gap = d3.area<[number, number]>().x((_, i) => x(series[0].pts[i][0])).y0((_, i) => y(series[0].pts[i][1])).y1((_, i) => y(series[1].pts[i][1])).curve(d3.curveMonotoneX);
  const cur = lerp(metricKF(m, branch), year);
  const diverges = !!m.byBranch;
  const obs = m.observed ?? [];
  const yearAt = (e: React.PointerEvent) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); return Math.round(Math.max(YEAR_MIN, Math.min(YEAR_MAX, x.invert(e.clientX - r.left)))); };
  const pv = peek != null ? lerp(metricKF(m, branch), peek) : null;
  return (
    <div className="explorer" ref={wrap}>
      <div className="explorer-head">
        <div><div className="eyebrow">{m.label}</div><div className="explorer-v mono">{fmt(m, cur).value}<small>{fmt(m, cur).unit}</small> <span className="muted">in {year}</span></div></div>
        {m.note && <p className="note">{m.note}</p>}
      </div>
      <svg width={w} height={H} role="img" aria-label={`${m.label} from ${YEAR_MIN} to ${YEAR_MAX}. Click or drag to set the year.`} style={{ touchAction: "pan-y" }}
        onPointerMove={(e) => { const yy = yearAt(e); setPeek(yy); if (dragging.current) setYear(yy); }}
        onPointerLeave={() => { setPeek(null); dragging.current = false; }}
        onPointerDown={(e) => { dragging.current = true; setYear(yearAt(e)); }}
        onPointerUp={() => { dragging.current = false; }}>
        {y.ticks(5).map((t) => (
          <g key={t} transform={`translate(0,${y(t)})`}><line x1={ML} x2={w - MR} stroke="var(--line)" /><text x={ML - 8} y={4} textAnchor="end" className="tick" fill="var(--muted)">{m.format === "people" ? d3.format("~s")(t) : t}</text></g>
        ))}
        {[YEAR_MIN, ...x.ticks(8).filter((t) => t > YEAR_MIN + 6)].map((t) => <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className="tick" fill="var(--muted)">{t}</text>)}
        <rect x={x(2100)} y={MT} width={x(YEAR_MAX) - x(2100)} height={H - MB - MT} fill="var(--panel-2)" opacity={0.5} />
        <text x={x(2100) + 8} y={MT + 14} className="tick" fill="var(--muted)">sketch · low confidence</text>
        {diverges && <path d={gap(series[0].pts) ?? ""} fill="var(--accent)" opacity={0.1} />}
        {series.map((s) => (
          <g key={s.b} opacity={s.b === branch ? 1 : diverges ? 0.55 : 0}>
            {s.b === branch && !diverges && <path d={area(s.pts) ?? ""} fill="var(--accent)" opacity={0.1} />}
            <path d={line(s.pts) ?? ""} fill="none" stroke={s.b === branch ? "var(--accent)" : "var(--muted)"} strokeWidth={s.b === branch ? 2.4 : 1.5} strokeDasharray={s.b === branch ? undefined : "4 4"} />
          </g>
        ))}
        {obs.map((o, i) => <circle key={i} cx={x(+o.date.slice(0, 4) + (+o.date.slice(5, 7) - 1) / 12)} cy={y(o.value)} r={3.5} fill="var(--fg)" />)}
        <line x1={x(year)} x2={x(year)} y1={MT} y2={H - MB} stroke="var(--accent)" strokeWidth={1.5} />
        <circle cx={x(year)} cy={y(cur)} r={5} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />
        {peek != null && pv != null && peek !== year && (
          <g pointerEvents="none">
            <line x1={x(peek)} x2={x(peek)} y1={MT} y2={H - MB} stroke="var(--fg)" strokeDasharray="2 3" opacity={0.5} />
            <circle cx={x(peek)} cy={y(pv)} r={3.5} fill="var(--fg)" />
            <text x={x(peek) > w - 200 ? x(peek) - 8 : x(peek) + 8} textAnchor={x(peek) > w - 200 ? "end" : "start"} y={MT + 30} className="tick" fill="var(--fg)">{peek}: {fmt(m, pv).value}{fmt(m, pv).unit} · click to go</text>
          </g>
        )}
        {diverges && <text x={w - MR} y={MT - 8} textAnchor="end" className="tick" fill="var(--muted)">solid: {branch} · dashed: {other(branch)} · shaded: the gap</text>}
      </svg>
    </div>
  );
}
