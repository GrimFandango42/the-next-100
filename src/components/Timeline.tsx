import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { data, DEFAULT_VIEW, THIS_YEAR, YEAR_MAX, YEAR_MIN } from "../data";
import { DOMAIN_META, type Domain, type ForecastEvent } from "../schema";
import { useStore } from "../store";

const LANES: Domain[] = ["ai", "bio", "energy", "climate", "space", "society", "risk"];
const LANE_H = 46;
const ERA_H = 26;
const AXIS_H = 34;
const GUTTER = 138; // fixed column for lane names; the zoomable plot starts here
const H = ERA_H + AXIS_H + LANES.length * LANE_H + 12;
const MIN_SPAN = 6; // years visible at max zoom
const CHAR_W = 6.6;

export const eraChipLabel = (from: number, to: number) => (to - from <= 10 ? `${from}–${String(to).slice(2)}` : `${from}s`);

export default function Timeline() {
  const { year, setYear, branch, domains, selected, select, view, setView } = useStore();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const viewRef = useRef(view); viewRef.current = view;
  const [width, setWidth] = useState(960);
  const [hover, setHover] = useState<{ ev: ForecastEvent; x: number; y: number } | null>(null);
  const [wheelHint, setWheelHint] = useState(false);
  const hintTimer = useRef<number>(0);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const L = GUTTER;

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(480, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = useMemo(() => d3.scaleLinear().domain([YEAR_MIN, YEAR_MAX]).range([L, width]), [width, L]);
  const xs = useMemo(() => d3.scaleLinear().domain(view).range([L, width]), [view, width, L]);
  const pxPerYear = (width - L) / (view[1] - view[0]);
  const visibleEvents = data.events.filter((e) => (!e.branch || e.branch === branch));

  function transformFor(from: number, to: number) {
    const k = (YEAR_MAX - YEAR_MIN) / (to - from);
    // rescaleX maps year y to k·base(y) + tx; pin `from` to the plot's left edge
    return d3.zoomIdentity.translate(L - k * base(from), 0).scale(k);
  }

  // zoom behaviour
  useEffect(() => {
    const svg = d3.select(svgRef.current!);
    const z = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, (YEAR_MAX - YEAR_MIN) / MIN_SPAN])
      .translateExtent([[L, 0], [width, H]])
      .extent([[L, 0], [width, H]])
      // Plain wheel scrolls the page (no scroll trap). Ctrl/⌘ + wheel and trackpad pinch zoom. Drag and touch pan/pinch.
      .filter((e: any) => !e.button && !e.shiftKey && (e.type !== "wheel" || e.ctrlKey || e.metaKey) && e.type !== "dblclick")
      .wheelDelta((e: any) => -e.deltaY * (e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.0015))
      .on("zoom", (e) => {
        const nx = e.transform.rescaleX(base);
        setView([nx.invert(L), nx.invert(width)]);
      });
    svg.call(z).on("dblclick.zoom", null);
    svg.on("wheel.pan", (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        z.translateBy(svg as any, -e.deltaX / (d3.zoomTransform(svg.node()!).k || 1), 0);
      } else {
        setWheelHint(true);
        clearTimeout(hintTimer.current); hintTimer.current = window.setTimeout(() => setWheelHint(false), 1400);
      }
    }, { passive: false } as any);
    svg.on("dblclick", (e: MouseEvent) => {
      const [mx] = d3.pointer(e);
      if (mx < L) return;
      const v = viewRef.current;
      const at = (mx - L) / (width - L) * (v[1] - v[0]) + v[0];
      const f = e.shiftKey ? 2 : 0.5; // zoom in 2× around the pointer; shift zooms out
      zoomTo(at - (at - v[0]) * f, at + (v[1] - at) * f, 350);
    });
    zoomRef.current = z;
    svg.call(z.transform, transformFor(viewRef.current[0], viewRef.current[1]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  function zoomTo(from: number, to: number, ms = 600) {
    let span = Math.max(MIN_SPAN, to - from);
    span = Math.min(span, YEAR_MAX - YEAR_MIN);
    from = Math.max(YEAR_MIN, Math.min(from, YEAR_MAX - span));
    to = from + span;
    d3.select(svgRef.current!).transition().duration(ms).ease(d3.easeCubicOut)
      .call(zoomRef.current!.transform, transformFor(from, to));
  }
  function zoomBy(f: number) {
    const c = (view[0] + view[1]) / 2, half = (view[1] - view[0]) / 2 / f;
    zoomTo(c - half, c + half, 350);
  }

  useEffect(() => { (window as any).__tl = { zoomTo, zoomBy }; });

  // keep the year cursor in view while playing or scrubbing
  useEffect(() => {
    const v = viewRef.current, span = v[1] - v[0];
    if (year < v[0] || year > v[1]) zoomTo(year - span * 0.2, year + span * 0.8, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  function onKey(e: React.KeyboardEvent) {
    const span = view[1] - view[0];
    if (e.target !== e.currentTarget && !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    if (e.key === "ArrowLeft") { zoomTo(view[0] - span * 0.15, view[1] - span * 0.15, 200); e.preventDefault(); }
    else if (e.key === "ArrowRight") { zoomTo(view[0] + span * 0.15, view[1] + span * 0.15, 200); e.preventDefault(); }
    else if (e.key === "+" || e.key === "=") { zoomBy(1.6); e.preventDefault(); }
    else if (e.key === "-" || e.key === "_") { zoomBy(1 / 1.6); e.preventDefault(); }
    else if (e.key === "0") { zoomTo(YEAR_MIN, YEAR_MAX); e.preventDefault(); }
  }

  // ticks
  // smallest round step whose labels (~4 digits) have room to breathe
  const step = [1, 2, 5, 10, 25, 50].find((st) => st * pxPerYear >= 52) ?? 50;
  const ticks: number[] = [];
  for (let y = Math.ceil(view[0] / step) * step; y <= view[1]; y += step) ticks.push(y);

  // label layout per lane: a label shows only where it clears every other dot and label
  const labelLevel = pxPerYear > 12 ? 2 : pxPerYear > 3.5 ? 1 : 0;
  const placed = useMemo(() => {
    const out = new Map<string, false | "r" | "l">();
    for (const lane of LANES) {
      const evs = visibleEvents.filter((e) => e.domain === lane && e.year <= view[1] + 10 && (e.yearEnd ?? e.year) >= view[0] - 10)
        .sort((a, b) => (a.cornerstone === b.cornerstone ? a.year - b.year : a.cornerstone ? -1 : 1));
      const dotsX = evs.map((e) => xs(e.year));
      const taken: [number, number][] = [];
      for (const e of evs) {
        const want = labelLevel === 2 || e.cornerstone || (labelLevel === 1 && e.confidence === "high");
        if (!want) { out.set(e.id, false); continue; }
        const cx = xs(e.year);
        const len = Math.min(e.title.length, 44) * CHAR_W;
        const endX = e.yearEnd ? xs(e.yearEnd) : cx;
        const fits = (x0: number, x1: number) => !(dotsX.some((d) => d !== cx && d + 9 > x0 && d - 9 < x1) || x0 < L + 4 || x1 > width - 4 || taken.some(([a, b]) => x0 < b && x1 > a));
        const right: [number, number] = [endX + 12, endX + 12 + len], left: [number, number] = [cx - 12 - len, cx - 12];
        const side = fits(...right) ? "r" : fits(...left) ? "l" : false;
        out.set(e.id, side);
        if (side) taken.push(side === "r" ? right : left);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, width, labelLevel, xs, branch]);

  const inView = visibleEvents.filter((e) => domains.has(e.domain) && (e.yearEnd ?? e.year) >= view[0] && e.year <= view[1]);
  const nearest = inView.length ? null : [...visibleEvents].filter((e) => domains.has(e.domain)).sort((a, b) => Math.abs(a.year - (view[0] + view[1]) / 2) - Math.abs(b.year - (view[0] + view[1]) / 2))[0];

  const cursorX = xs(year);
  const nowX = xs(THIS_YEAR);
  const chipX = Math.max(L + 24, Math.min(width - 24, cursorX));

  const openEvent = (e: ForecastEvent, isSel: boolean) => { setHover(null); select(isSel ? null : e.id); };

  return (
    <div className="tl-wrap" ref={wrapRef}>
      <div className="tl-toolbar">
        <div className="tl-chips" role="group" aria-label="Jump to an era">
          {data.eras.map((er) => {
            const active = Math.abs(view[0] - (er.from - 0.5)) < 1.5 && Math.abs(view[1] - (er.to + 0.5)) < 1.5;
            return <button key={er.id} className={"chip" + (active ? " on" : "")} title={er.name} onClick={() => { zoomTo(er.from - 0.5, er.to + 0.5); if (year < er.from || year > er.to) setYear(er.from); }}>{eraChipLabel(er.from, er.to)} · {er.name}</button>;
          })}
          <button className={"chip" + (view[1] - view[0] > 170 ? " on" : "")} onClick={() => zoomTo(YEAR_MIN, YEAR_MAX)}>All 175 years</button>
        </div>
        <div className="tl-zoom">
          <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.8)}>−</button>
          <span className="mono">{Math.round(view[0])}–{Math.round(view[1])}</span>
          <button aria-label="Zoom in" onClick={() => zoomBy(1.8)}>+</button>
        </div>
      </div>

      <div className="tl-stage">
        {wheelHint && <div className="wheel-hint" role="status">Hold {isMac ? "⌘" : "Ctrl"} and scroll to zoom, or pinch</div>}
        {nearest && (
          <div className="tl-empty">
            <span>No forecast lines between {Math.round(view[0])} and {Math.round(view[1])}.</span>
            <button className="ghost" onClick={() => { const span = view[1] - view[0]; zoomTo(nearest.year - span / 2, nearest.year + span / 2, 400); }}>Nearest: {nearest.year} · {nearest.title.slice(0, 40)}{nearest.title.length > 40 ? "…" : ""} →</button>
          </div>
        )}
        <svg ref={svgRef} className="tl" width={width} height={H} tabIndex={0} onKeyDown={onKey} role="application" aria-label="Forecast timeline. Arrow keys pan, plus and minus zoom, 0 shows everything. Tab moves through events; Enter opens one.">
          <defs>
            <clipPath id="tl-clip"><rect x={L} y={0} width={width - L} height={H} /></clipPath>
            <linearGradient id="era-fade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.14" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* fixed gutter: lane names */}
          <rect x={0} y={0} width={L} height={H} fill="var(--panel)" />
          <rect x={0} y={0} width={L} height={ERA_H} fill="var(--panel-2)" />
          <text x={12} y={17} className="era-label" fill="var(--muted)">Era</text>
          <text x={12} y={ERA_H + AXIS_H - 12} className="tick" fill="var(--muted)">Year</text>
          {LANES.map((d, i) => {
            const y = ERA_H + AXIS_H + i * LANE_H;
            const on = domains.has(d);
            return (
              <g key={d} opacity={on ? 1 : 0.3}>
                <line x1={0} x2={width} y1={y + LANE_H} y2={y + LANE_H} stroke="var(--line)" />
                <circle cx={16} cy={y + LANE_H / 2 + 4} r={4} fill={DOMAIN_META[d].color} />
                <text x={28} y={y + LANE_H / 2 + 8} className="lane-name" fill="var(--fg)">{DOMAIN_META[d].name}</text>
              </g>
            );
          })}
          <line x1={L} x2={L} y1={0} y2={H} stroke="var(--line)" />

          <g clipPath="url(#tl-clip)">
            {/* era bands */}
            {data.eras.map((er, i) => {
              const x0 = xs(er.from), x1 = xs(er.to);
              const w = x1 - x0;
              const inEra = year >= er.from && year < er.to + (i === data.eras.length - 1 ? 1 : 0);
              const full = `${er.from}–${er.to} · ${er.name}`, mid = er.name, short = eraChipLabel(er.from, er.to);
              const label = w > full.length * 7.4 + 24 ? full : w > mid.length * 7.4 + 24 ? mid : w > short.length * 7.4 + 24 ? short : "";
              const lx = Math.max(x0, L) + 10;
              return (
                <g key={er.id} className="era">
                  <rect x={x0} y={ERA_H} width={w} height={H - ERA_H} fill={i % 2 ? "var(--panel)" : "var(--bg)"} opacity={0.6} />
                  {inEra && <rect x={x0} y={ERA_H} width={w} height={H - ERA_H} fill="url(#era-fade)" />}
                  <rect x={x0} y={0} width={w} height={ERA_H} fill={inEra ? "var(--accent)" : "var(--panel-2)"} opacity={inEra ? 0.9 : 1} style={{ cursor: "zoom-in" }} onClick={() => zoomTo(er.from - 0.5, er.to + 0.5)}><title>{`Zoom to ${er.name}`}</title></rect>
                  <line x1={x0} x2={x0} y1={0} y2={H} stroke="var(--line)" />
                  {label && lx + label.length * 7.4 < x1 && <text x={lx} y={17} className="era-label" fill={inEra ? "var(--accent-ink)" : "var(--muted)"}>{label}</text>}
                </g>
              );
            })}
            {/* axis */}
            {ticks.map((t) => {
              const tx = xs(t);
              const hidden = Math.abs(tx - chipX) < 34 || (nowX > L && Math.abs(tx - nowX) < 26 && Math.abs(chipX - nowX) > 40);
              return (
                <g key={t} transform={`translate(${tx},${ERA_H})`}>
                  <line y1={AXIS_H - 6} y2={H - ERA_H} stroke="var(--line)" strokeDasharray={t % 10 === 0 ? undefined : "2 4"} opacity={t % 10 === 0 ? 0.9 : 0.5} />
                  {!hidden && <text y={AXIS_H - 12} textAnchor="middle" className="tick" fill="var(--muted)">{t}</text>}
                </g>
              );
            })}
            {/* now line */}
            {nowX >= L && nowX <= width && (
              <g transform={`translate(${nowX},${ERA_H})`} pointerEvents="none">
                <line y1={AXIS_H - 6} y2={H - ERA_H} stroke="var(--fg)" strokeDasharray="3 3" opacity={0.45} />
                {Math.abs(chipX - nowX) > 40 && <text y={AXIS_H - 12} textAnchor="middle" className="tick" fill="var(--fg)">today</text>}
              </g>
            )}
            {/* events */}
            {visibleEvents.map((e) => {
              const lane = LANES.indexOf(e.domain);
              const cy = ERA_H + AXIS_H + lane * LANE_H + LANE_H / 2 + 4;
              const cx = xs(e.year);
              if (cx < L - 200 || cx > width + 200) return null;
              const on = domains.has(e.domain);
              const future = e.year > year;
              const color = DOMAIN_META[e.domain].color;
              const isSel = selected === e.id;
              const r = e.cornerstone ? 7 : 5.5;
              const showLabel = placed.get(e.id);
              const bad = e.status === "missed" || e.status === "retired";
              const done = e.status === "happened" || e.status === "partial" || e.status === "early" || e.status === "late";
              const reachable = on && cx >= L && cx <= width;
              return (
                <g key={e.id} className={"ev" + (isSel ? " sel" : "")} opacity={on ? 1 : 0.1} style={{ cursor: "pointer" }}
                  tabIndex={reachable ? 0 : -1} role="button" aria-pressed={isSel}
                  aria-label={`${e.year}, ${DOMAIN_META[e.domain].name}: ${e.title}. ${e.confidence}${e.probability != null ? ", " + Math.round(e.probability * 100) + " percent" : ""}`}
                  onKeyDown={(k) => { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); k.stopPropagation(); openEvent(e, isSel); } }}
                  onFocus={(ev) => { const b = (ev.currentTarget as SVGGElement).getBoundingClientRect(); if (!isSel) setHover({ ev: e, x: b.right, y: b.bottom }); }}
                  onBlur={() => setHover(null)}
                  onClick={() => openEvent(e, isSel)}
                  onMouseEnter={(ev) => !isSel && setHover({ ev: e, x: ev.clientX, y: ev.clientY })}
                  onMouseMove={(ev) => !isSel && setHover({ ev: e, x: ev.clientX, y: ev.clientY })}
                  onMouseLeave={() => setHover(null)}>
                  <circle cx={cx} cy={cy} r={14} fill="transparent" />
                  {e.yearEnd && <rect x={cx} y={cy - 4} width={Math.max(2, xs(e.yearEnd) - cx)} height={8} rx={4} fill={color} opacity={0.25} />}
                  {isSel && <circle cx={cx} cy={cy} r={r + 9} fill={color} opacity={0.22} />}
                  {isSel && <circle cx={cx} cy={cy} r={r + 9} fill="none" stroke="var(--fg)" strokeWidth={2} />}
                  {e.cornerstone && <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="var(--accent)" strokeWidth={1.5} className={future ? "" : "pulse"} />}
                  <circle cx={cx} cy={cy} r={r} fill={bad ? "var(--panel)" : future ? "var(--panel)" : color} stroke={bad ? "var(--bad)" : color} strokeWidth={2.2} />
                  {done && <path d={`M${cx - 3} ${cy}l2 2 4-4`} stroke="var(--bg)" strokeWidth={1.8} fill="none" />}
                  {bad && <path d={`M${cx - 2.5} ${cy - 2.5}l5 5M${cx + 2.5} ${cy - 2.5}l-5 5`} stroke="var(--bad)" strokeWidth={1.6} />}
                  {showLabel && (
                    <text x={showLabel === "r" ? (e.yearEnd ? xs(e.yearEnd) : cx) + r + 7 : cx - r - 7} textAnchor={showLabel === "r" ? "start" : "end"} y={cy + 4} className={"ev-label" + (e.cornerstone ? " key" : "")} fill={future ? "var(--muted)" : "var(--fg)"}>
                      {e.title.length > 44 ? e.title.slice(0, 42) + "…" : e.title}
                    </text>
                  )}
                </g>
              );
            })}
            {/* year cursor */}
            <g pointerEvents="none">
              <line x1={cursorX} x2={cursorX} y1={ERA_H + AXIS_H - 6} y2={H} stroke="var(--accent)" strokeWidth={2} />
              <rect x={chipX - 22} y={ERA_H + AXIS_H - 26} width={44} height={18} rx={9} fill="var(--accent)" />
              <text x={chipX} y={ERA_H + AXIS_H - 13} textAnchor="middle" className="tick strong" fill="var(--accent-ink)">{year}</text>
            </g>
          </g>
        </svg>
      </div>

      <Minimap width={width} left={L} view={view} onPan={(c) => { const span = view[1] - view[0]; zoomTo(c - span / 2, c + span / 2, 0); }} onJump={(c) => { const span = view[1] - view[0]; zoomTo(c - span / 2, c + span / 2, 250); }} />

      {hover && (
        <div className="tip" style={{ left: Math.min(hover.x + 14, window.innerWidth - 300), top: hover.y + 14 }}>
          <div className="tip-y mono" style={{ color: DOMAIN_META[hover.ev.domain].color }}>{hover.ev.year}{hover.ev.yearEnd ? `–${hover.ev.yearEnd}` : ""} · {DOMAIN_META[hover.ev.domain].name}{hover.ev.probability != null ? ` · ${Math.round(hover.ev.probability * 100)}%` : ""}</div>
          <div className="tip-t">{hover.ev.title}</div>
          <div className="tip-s">Click for the reasoning, signals and history.</div>
        </div>
      )}
      <p className="hint">{isMac ? "⌘" : "Ctrl"} + scroll or pinch to zoom · drag to pan · double-click to zoom in (⇧ to zoom out) · drag the strip below to move · ← → + − on the keyboard. Filled dots are behind the gold year line; outlined dots are still ahead. Rings mark cornerstones.</p>
    </div>
  );
}

function Minimap({ width, left, view, onPan, onJump }: { width: number; left: number; view: [number, number]; onPan: (c: number) => void; onJump: (c: number) => void }) {
  const h = 26;
  const x = d3.scaleLinear().domain([YEAR_MIN, YEAR_MAX]).range([left, width]);
  const { year, branch } = useStore();
  const drag = useRef<{ off: number } | null>(null);
  const toYear = (e: React.PointerEvent) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); return x.invert(e.clientX - r.left); };
  const center = (view[0] + view[1]) / 2;
  return (
    <svg className="mini" width={width} height={h} role="slider" aria-label="Overview: drag to move the timeline window" aria-valuemin={YEAR_MIN} aria-valuemax={YEAR_MAX} aria-valuenow={Math.round(center)} tabIndex={-1}
      onPointerDown={(e) => { const y = toYear(e); const inside = y >= view[0] && y <= view[1]; (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId); drag.current = { off: inside ? y - center : 0 }; if (!inside) onJump(y); }}
      onPointerMove={(e) => { if (drag.current) onPan(toYear(e) - drag.current.off); }}
      onPointerUp={() => { drag.current = null; }}>
      <text x={12} y={17} className="tick" fill="var(--muted)">Overview</text>
      <rect x={left} y={0} width={width - left} height={h} rx={6} fill="var(--panel-2)" />
      {data.eras.map((er) => <line key={er.id} x1={x(er.from)} x2={x(er.from)} y1={0} y2={h} stroke="var(--line)" />)}
      {data.events.filter((e) => !e.branch || e.branch === branch).map((e) => (
        <rect key={e.id} x={x(e.year) - 1} y={e.cornerstone ? 5 : 9} width={2} height={e.cornerstone ? 16 : 8} fill={DOMAIN_META[e.domain].color} />
      ))}
      <rect x={x(view[0])} y={1} width={Math.max(8, x(view[1]) - x(view[0]))} height={h - 2} rx={5} fill="var(--accent)" fillOpacity={0.12} stroke="var(--accent)" strokeWidth={1.5} style={{ cursor: "grab" }} />
      <line x1={x(year)} x2={x(year)} y1={0} y2={h} stroke="var(--accent)" strokeWidth={2} />
    </svg>
  );
}
