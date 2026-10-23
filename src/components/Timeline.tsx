import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { data, THIS_YEAR, YEAR_MAX, YEAR_MIN } from "../data";
import { DOMAIN_META, type Domain, type ForecastEvent } from "../schema";
import { useStore } from "../store";

const LANES: Domain[] = ["ai", "bio", "energy", "climate", "space", "society", "risk"];
const LANE_H = 46;
const ERA_H = 26;
const AXIS_H = 34;
const LEFT = 0;
const H = ERA_H + AXIS_H + LANES.length * LANE_H + 12;
const MIN_SPAN = 4; // years visible at max zoom
const CHAR_W = 6.6;

export default function Timeline() {
  const { year, setYear, branch, domains, selected, select, view, setView } = useStore();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [width, setWidth] = useState(960);
  const [hover, setHover] = useState<{ ev: ForecastEvent; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = useMemo(() => d3.scaleLinear().domain([YEAR_MIN, YEAR_MAX]).range([LEFT, width]), [width]);
  const xs = useMemo(() => d3.scaleLinear().domain(view).range([LEFT, width]), [view, width]);
  const pxPerYear = width / (view[1] - view[0]);

  // zoom behaviour
  useEffect(() => {
    const svg = d3.select(svgRef.current!);
    const z = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, (YEAR_MAX - YEAR_MIN) / MIN_SPAN])
      .translateExtent([[LEFT, 0], [width, H]])
      .extent([[LEFT, 0], [width, H]])
      .filter((e: any) => !e.button && !(e.type === "wheel" && !e.ctrlKey && !e.metaKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)))
      .on("zoom", (e) => {
        const nx = e.transform.rescaleX(base);
        setView([nx.invert(LEFT), nx.invert(width)]);
      });
    svg.call(z).on("dblclick.zoom", null);
    svg.on("dblclick", (e) => {
      const [mx] = d3.pointer(e);
      const y = xs.invert(mx);
      zoomTo(y - (view[1] - view[0]) / 6, y + (view[1] - view[0]) / 6);
    });
    zoomRef.current = z;
    // sync current view into the zoom transform
    const k = (YEAR_MAX - YEAR_MIN) / (view[1] - view[0]);
    const tx = -base(view[0]) * k + LEFT;
    svg.call(z.transform, d3.zoomIdentity.translate(tx, 0).scale(k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  function zoomTo(from: number, to: number, ms = 600) {
    from = Math.max(YEAR_MIN, from); to = Math.min(YEAR_MAX, to);
    if (to - from < MIN_SPAN) { const c = (from + to) / 2; from = c - MIN_SPAN / 2; to = c + MIN_SPAN / 2; }
    const k = (YEAR_MAX - YEAR_MIN) / (to - from);
    const tx = -base(from) * k + LEFT;
    d3.select(svgRef.current!).transition().duration(ms).ease(d3.easeCubicOut)
      .call(zoomRef.current!.transform, d3.zoomIdentity.translate(tx, 0).scale(k));
  }
  function zoomBy(f: number) {
    const c = (view[0] + view[1]) / 2, half = (view[1] - view[0]) / 2 / f;
    zoomTo(c - half, c + half, 350);
  }

  // expose for era chips
  useEffect(() => {
    (window as any).__tl = { zoomTo, zoomBy };
  });

  // ticks
  const step = pxPerYear > 40 ? 1 : pxPerYear > 14 ? 2 : pxPerYear > 6 ? 5 : pxPerYear > 2.4 ? 10 : 25;
  const ticks: number[] = [];
  for (let y = Math.ceil(view[0] / step) * step; y <= view[1]; y += step) ticks.push(y);

  // label layout per lane (greedy, left to right)
  const labelLevel = pxPerYear > 12 ? 2 : pxPerYear > 3.5 ? 1 : 0;
  const placed = useMemo(() => {
    const out = new Map<string, boolean>();
    for (const lane of LANES) {
      const evs = data.events.filter((e) => e.domain === lane && e.year <= view[1] + 10 && (e.yearEnd ?? e.year) >= view[0] - 10)
        .sort((a, b) => (a.cornerstone === b.cornerstone ? a.year - b.year : a.cornerstone ? -1 : 1));
      const taken: [number, number][] = [];
      for (const e of evs) {
        const want = labelLevel === 2 || e.cornerstone || (labelLevel === 1 && e.confidence === "high");
        if (!want) { out.set(e.id, false); continue; }
        const x0 = xs(e.year) + 12, x1 = x0 + Math.min(e.title.length, 44) * CHAR_W;
        const clash = taken.some(([a, b]) => x0 < b && x1 > a);
        out.set(e.id, !clash);
        if (!clash) taken.push([x0, x1]);
      }
    }
    return out;
  }, [view, width, labelLevel, xs]);

  const cursorX = xs(year);
  const nowX = xs(THIS_YEAR);

  return (
    <div className="tl-wrap" ref={wrapRef}>
      <div className="tl-toolbar">
        <div className="tl-chips">
          {data.eras.map((er) => {
            const active = view[0] <= er.from + 0.5 && view[1] >= er.to - 0.5 && view[1] - view[0] < (er.to - er.from) * 1.3;
            return <button key={er.id} className={"chip" + (active ? " on" : "")} onClick={() => zoomTo(er.from - 0.5, er.to + 0.5)}>{er.from}s · {er.name}</button>;
          })}
          <button className="chip" onClick={() => zoomTo(YEAR_MIN, YEAR_MAX)}>All 175 years</button>
        </div>
        <div className="tl-zoom">
          <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.8)}>−</button>
          <span className="mono">{Math.round(view[0])}–{Math.round(view[1])}</span>
          <button aria-label="Zoom in" onClick={() => zoomBy(1.8)}>+</button>
        </div>
      </div>

      <svg ref={svgRef} className="tl" width={width} height={H} role="application" aria-label="Zoomable forecast timeline. Scroll or pinch to zoom, drag to pan, click an event for detail.">
        <defs>
          <clipPath id="tl-clip"><rect x={LEFT} y={0} width={width - LEFT} height={H} /></clipPath>
          <linearGradient id="era-fade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.16" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g clipPath="url(#tl-clip)">
          {/* era bands */}
          {data.eras.map((er, i) => {
            const x0 = xs(er.from), x1 = xs(er.to);
            const w = x1 - x0;
            const inEra = year >= er.from && year < er.to + (i === data.eras.length - 1 ? 1 : 0);
            return (
              <g key={er.id} className="era" onClick={() => zoomTo(er.from - 0.5, er.to + 0.5)} style={{ cursor: "zoom-in" }}>
                <rect x={x0} y={0} width={w} height={H} fill={i % 2 ? "var(--panel)" : "transparent"} opacity={0.55} />
                {inEra && <rect x={x0} y={ERA_H} width={w} height={H - ERA_H} fill="url(#era-fade)" />}
                <rect x={x0} y={0} width={w} height={ERA_H} fill={inEra ? "var(--accent)" : "var(--panel-2)"} opacity={inEra ? 0.9 : 1} />
                {w > 44 && <text x={x0 + 10} y={17} className="era-label" fill={inEra ? "var(--accent-ink)" : "var(--muted)"}>{w > (er.name.length + 12) * 7.2 + 20 ? `${er.from}–${er.to} · ${er.name}` : w > er.name.length * 7.2 + 20 ? er.name : `${er.from}s`}</text>}
              </g>
            );
          })}
          {/* lanes */}
          {LANES.map((d, i) => {
            const y = ERA_H + AXIS_H + i * LANE_H;
            const on = domains.has(d);
            return (
              <g key={d} opacity={on ? 1 : 0.18}>
                <line x1={LEFT} x2={width} y1={y + LANE_H} y2={y + LANE_H} stroke="var(--line)" />
                <text x={LEFT + 8} y={y + 14} className="lane-label" fill={DOMAIN_META[d].color}>{DOMAIN_META[d].name}</text>
              </g>
            );
          })}
          {/* axis */}
          {ticks.map((t) => (
            <g key={t} transform={`translate(${xs(t)},${ERA_H})`}>
              <line y1={0} y2={H - ERA_H} stroke="var(--line)" strokeDasharray={t % 10 === 0 ? undefined : "2 4"} opacity={t % 10 === 0 ? 1 : 0.6} />
              <text y={AXIS_H - 12} x={4} className="tick" fill="var(--muted)">{t}</text>
            </g>
          ))}
          {/* now line */}
          {nowX >= LEFT && nowX <= width && (
            <g transform={`translate(${nowX},${ERA_H})`}>
              <line y1={0} y2={H - ERA_H} stroke="var(--fg)" strokeDasharray="3 3" opacity={0.5} />
              <text y={AXIS_H - 12} x={-4} textAnchor="end" className="tick" fill="var(--fg)" opacity={0.7}>today</text>
            </g>
          )}
          {/* events */}
          {data.events.map((e) => {
            const lane = LANES.indexOf(e.domain);
            const cy = ERA_H + AXIS_H + lane * LANE_H + LANE_H / 2 + 4;
            const cx = xs(e.year);
            if (cx < LEFT - 200 || cx > width + 200) return null;
            const on = domains.has(e.domain);
            const future = e.year > year;
            const color = DOMAIN_META[e.domain].color;
            const isSel = selected === e.id;
            const r = e.cornerstone ? 7 : 5;
            const showLabel = placed.get(e.id);
            const bad = e.status === "missed" || e.status === "retired";
            const done = e.status === "happened" || e.status === "partial" || e.status === "early" || e.status === "late";
            return (
              <g key={e.id} className="ev" opacity={on ? (future ? 0.42 : 1) : 0.08} style={{ cursor: "pointer" }}
                onClick={() => { select(isSel ? null : e.id); setYear(e.year); }}
                onMouseEnter={(ev) => setHover({ ev: e, x: ev.clientX, y: ev.clientY })}
                onMouseMove={(ev) => setHover({ ev: e, x: ev.clientX, y: ev.clientY })}
                onMouseLeave={() => setHover(null)}>
                {e.yearEnd && <rect x={cx} y={cy - 4} width={Math.max(2, xs(e.yearEnd) - cx)} height={8} rx={4} fill={color} opacity={0.28} />}
                {e.cornerstone && <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.8} className={future ? "" : "pulse"} />}
                {isSel && <circle cx={cx} cy={cy} r={r + 11} fill="none" stroke="var(--fg)" strokeWidth={1} opacity={0.7} />}
                <circle cx={cx} cy={cy} r={r} fill={bad ? "var(--bg)" : color} stroke={bad ? "var(--bad)" : color} strokeWidth={2} />
                {done && <path d={`M${cx - 3} ${cy}l2 2 4-4`} stroke="var(--bg)" strokeWidth={1.8} fill="none" />}
                {bad && <path d={`M${cx - 2.5} ${cy - 2.5}l5 5M${cx + 2.5} ${cy - 2.5}l-5 5`} stroke="var(--bad)" strokeWidth={1.6} />}
                {showLabel && (
                  <text x={cx + r + 6} y={cy + 4} className={"ev-label" + (e.cornerstone ? " key" : "")} fill="var(--fg)">
                    {e.title.length > 44 ? e.title.slice(0, 42) + "…" : e.title}
                  </text>
                )}
              </g>
            );
          })}
          {/* year cursor */}
          <g transform={`translate(${cursorX},${ERA_H})`} pointerEvents="none">
            <line y1={0} y2={H - ERA_H} stroke="var(--accent)" strokeWidth={2} />
            <rect x={-22} y={AXIS_H - 26} width={44} height={18} rx={9} fill="var(--accent)" />
            <text y={AXIS_H - 13} textAnchor="middle" className="tick strong" fill="var(--accent-ink)">{year}</text>
          </g>
        </g>
      </svg>

      <Minimap width={width} view={view} onJump={(y) => { const span = view[1] - view[0]; zoomTo(y - span / 2, y + span / 2, 250); }} />

      {hover && (
        <div className="tip" style={{ left: Math.min(hover.x + 14, window.innerWidth - 300), top: hover.y + 14 }}>
          <div className="tip-y mono" style={{ color: DOMAIN_META[hover.ev.domain].color }}>{hover.ev.year}{hover.ev.yearEnd ? `–${hover.ev.yearEnd}` : ""} · {DOMAIN_META[hover.ev.domain].name}</div>
          <div className="tip-t">{hover.ev.title}</div>
          <div className="tip-s">{hover.ev.summary}</div>
        </div>
      )}
      <p className="hint">Scroll or pinch to zoom · drag to pan · double-click to dive in · click a dot for the full line of reasoning. Rings mark cornerstones; the gold cursor is the year you're viewing.</p>
    </div>
  );
}

function Minimap({ width, view, onJump }: { width: number; view: [number, number]; onJump: (y: number) => void }) {
  const h = 22;
  const x = d3.scaleLinear().domain([YEAR_MIN, YEAR_MAX]).range([0, width]);
  const { year, branch } = useStore();
  return (
    <svg className="mini" width={width} height={h} onClick={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); onJump(x.invert(e.clientX - r.left)); }} role="presentation">
      <rect x={0} y={0} width={width} height={h} rx={5} fill="var(--panel-2)" />
      {data.events.filter((e) => !e.branch || e.branch === branch).map((e) => (
        <rect key={e.id} x={x(e.year) - 1} y={e.cornerstone ? 4 : 8} width={2} height={e.cornerstone ? 14 : 6} fill={DOMAIN_META[e.domain].color} opacity={0.8} />
      ))}
      <rect x={x(view[0])} y={1} width={Math.max(6, x(view[1]) - x(view[0]))} height={h - 2} rx={4} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
      <line x1={x(year)} x2={x(year)} y1={0} y2={h} stroke="var(--accent)" strokeWidth={2} />
    </svg>
  );
}
