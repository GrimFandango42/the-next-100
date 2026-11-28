import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { data, THIS_YEAR } from "../data";
import { fmt, lerp, metricKF, clockLabel } from "../lib";
import { MARKET_HISTORY, MARKET_LINKS, dayNum, shortDate, venueName } from "../markets";
import { DOMAIN_META, type ForecastEvent } from "../schema";
import { useStore } from "../store";
import { SOON_YEARS, oddsRows, pct, signedPoints, type OddsRow } from "../views";
import {
  AXIS, BOARD_H, BOARD_W, COLS, COL_W, COMPARE_COLORS, COMPARE_MAX, ERA_COLS, GUTTER, LANES, LANE_GAP, LANE_H, LENSES, R, ROWS_PER_LANE,
  THREAD_NAME, axisYears, cellCenter, hexPoints, inkFor, layoutBoard, lensById, linksAmong, nearestInDirection, sourceCount,
  toggleCompare, xOfCol, xOfYear, yearOfCol, type LensId, type Placed,
} from "../board";
import { Sparkline } from "./OddsView";
import { when } from "./StoryJourney";

const todayIso = (): string => new Date().toISOString().slice(0, 10);
/** World-panel labels short enough for one line; the full label is the tooltip. */
const SHORT: Record<string, string> = { population: "People", lifespan: "Lifespan, rich countries", "ai-share": "Work done by AI", "work-hours": "Work week", warming: "Warming", "off-earth": "Living off Earth", "frontier-actors": "Frontier actors" };
/** Clip a mono label to a width in SVG units (about 6.1 units a character at the era-name size). */
const fitLabel = (t: string, w: number): string => { const n = Math.floor(w / 6.1); return t.length <= n ? t : `${t.slice(0, Math.max(2, n - 1)).trimEnd()}…`; };
const EXPLORED_KEY = "next100-explored";
const LENS_KEY = "next100-lens";
type Highlight = null | "moved" | "gap" | "soon" | `thread:${string}`;

function readExplored(): Set<string> {
  try { const v = JSON.parse(localStorage.getItem(EXPLORED_KEY) ?? "[]"); return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []); } catch { return new Set(); }
}
function readLens(): LensId {
  try { const v = localStorage.getItem(LENS_KEY); return LENSES.some((l) => l.id === v) ? (v as LensId) : "odds"; } catch { return "odds"; }
}

const matchesHighlight = (r: OddsRow, h: Highlight, thisYear: number): boolean =>
  h === null ? true
  : h === "moved" ? r.moves > 0
  : h === "gap" ? r.gap !== null && Math.abs(r.gap) >= 0.1
  : h === "soon" ? r.event.status === "forecast" && r.due <= thisYear + SOON_YEARS
  : r.event.force === h.slice(7);

/**
 * The century on one board. Opened from the book's strip (and with "-"), it replaces the old list overview: years run
 * across, domains run down, every line is a hex token. A lens repaints the tokens by one measure; a token opens a card;
 * cards go into a tray to be compared side by side. The year marker drives the world panel; the path pill flips the fork.
 */
export default function CenturyBoard({ open, onClose, thread }: { open: boolean; onClose: () => void; thread: { force: string; nonce: number } | null }) {
  const { year, setYear, branch, setBranch, playing, togglePlay, select, selected: drawerOpen } = useStore();
  const [lensId, setLensId] = useState<LensId>(readLens);
  const [focus, setFocus] = useState<string | null>(null);
  const [tray, setTray] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState<Highlight>(null);
  const [explored, setExplored] = useState<Set<string>>(readExplored);
  const [justFound, setJustFound] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const tokenRefs = useRef(new Map<string, SVGGElement>());

  const today = todayIso();
  const rows = useMemo(() => oddsRows(data.events, MARKET_LINKS, MARKET_HISTORY, data.meta.written, today), [today]);
  const rowOf = useMemo(() => new Map(rows.map((r) => [r.event.id, r])), [rows]);
  const placed = useMemo(() => layoutBoard(data.events, data.eras), []);
  const placedOf = useMemo(() => new Map(placed.map((p) => [p.event.id, p])), [placed]);
  const lens = lensById(lensId);
  const ctx = useMemo(() => ({ thisYear: THIS_YEAR, sources: sourceCount }), []);
  const q = query.trim().toLowerCase();
  const lit = useCallback((r: OddsRow) => matchesHighlight(r, highlight, THIS_YEAR) && (!q || `${r.event.title} ${r.event.summary} ${DOMAIN_META[r.event.domain].name}`.toLowerCase().includes(q)) && (!r.event.branch || r.event.branch === branch), [highlight, q, branch]);
  const litCount = rows.filter(lit).length;

  // A thread chosen in a chapter opens the board on the Threads lens with that thread lit.
  useEffect(() => { if (thread) { setLensId("threads"); setHighlight(`thread:${thread.force}`); } }, [thread]);
  useEffect(() => { try { localStorage.setItem(LENS_KEY, lensId); } catch { /* storage off */ } }, [lensId]);

  // Modal: the page behind is inert while the board is open (re-applied after the drawer, which shares those elements, closes).
  useEffect(() => {
    if (!open) return;
    const behind = document.querySelectorAll<HTMLElement>(".topbar, .view, .foot, .skip");
    behind.forEach((el) => { el.inert = true; });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { behind.forEach((el) => { el.inert = false; }); document.body.style.overflow = prev; };
  }, [open, drawerOpen]);
  useEffect(() => { if (open) requestAnimationFrame(() => root.current?.focus()); else { setComparing(false); } }, [open]);

  const openCard = useCallback((id: string) => {
    setFocus(id);
    setComparing(false);
    if (!explored.has(id)) {
      const next = new Set(explored); next.add(id); setExplored(next); setJustFound(id);
      try { localStorage.setItem(EXPLORED_KEY, JSON.stringify([...next])); } catch { /* storage off */ }
    } else setJustFound(null);
    requestAnimationFrame(() => tokenRefs.current.get(id)?.focus({ preventScroll: false }));
  }, [explored]);

  const onKey = (e: ReactKeyboardEvent) => {
    if (drawerOpen) return;
    const typing = (e.target as HTMLElement).closest("input,select,textarea");
    if (e.key === "Escape") { e.preventDefault(); if (typing && query) { setQuery(""); return; } if (comparing) setComparing(false); else if (focus) setFocus(null); else onClose(); return; }
    if (typing) return;
    if (e.key === "/") { e.preventDefault(); search.current?.focus(); return; }
    if (e.key === "l" || e.key === "L") { const i = LENSES.findIndex((l) => l.id === lensId); setLensId(LENSES[(i + (e.shiftKey ? LENSES.length - 1 : 1)) % LENSES.length].id); return; }
    if ((e.key === "c" || e.key === "C") && focus) { setTray((t) => toggleCompare(t, focus)); return; }
    const dir = ({ ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" } as const)[e.key as "ArrowLeft"];
    if (dir) {
      e.preventDefault();
      const from = focus ? placedOf.get(focus) : undefined;
      const next = from ? nearestInDirection(from, placed, dir) : placed[0];
      if (next) openCard(next.event.id);
    }
  };

  // The year marker: drag along the axis (or anywhere on the board's top strip) to move through the century.
  const scrub = (e: ReactPointerEvent<SVGRectElement>) => {
    if (e.type === "pointerdown") (e.target as Element).setPointerCapture(e.pointerId);
    else if (!(e.buttons & 1)) return;
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((e.clientX - box.left) / box.width) * BOARD_W;
    setYear(yearOfCol((x - GUTTER) / COL_W, data.eras));
  };

  if (!open) return null;
  const focused = focus ? rowOf.get(focus) : undefined;
  const focusedPlace = focus ? placedOf.get(focus) : undefined;
  const near = placed.filter((p) => Math.abs(p.event.year - year) <= 1.5);
  const tallies = [
    { id: "moved" as const, n: rows.filter((r) => r.moves > 0).length, label: "moved since launch" },
    { id: "gap" as const, n: rows.filter((r) => r.gap !== null && Math.abs(r.gap) >= 0.1).length, label: "10+ pts off the market" },
    { id: "soon" as const, n: rows.filter((r) => r.event.status === "forecast" && r.due <= THIS_YEAR + SOON_YEARS).length, label: `gradable by ${Math.floor(THIS_YEAR) + SOON_YEARS}` },
  ];

  return createPortal(
    <div className={"board-wrap" + (focused ? " with-card" : "")} role="dialog" aria-modal="true" aria-labelledby="board-title" ref={root} tabIndex={-1} onKeyDown={onKey}>
      <header className="board-head">
        <div className="board-brand"><span className="board-kicker">The Next 100 · {data.events.length} lines · check-in {shortDate(data.meta.lastCheckin)}</span><h2 id="board-title">The century board</h2></div>
        <div className="board-tallies" role="group" aria-label="Light up lines">
          {tallies.map((t) => <button key={t.id} type="button" aria-pressed={highlight === t.id} onClick={() => setHighlight(highlight === t.id ? null : t.id)}><b>{t.n}</b><span>{t.label}</span></button>)}
          <span className="board-explored" title="Lines whose card you have opened, on this device"><b>{explored.size}</b><span>/ {data.events.length} explored</span></span>
        </div>
        <label className="board-search"><span className="sr-only">Find a line</span><input ref={search} type="search" value={query} placeholder="Find a line  /" onChange={(e) => setQuery(e.target.value)} /></label>
        <button type="button" className="board-close" onClick={onClose} aria-label="Close the board">×</button>
      </header>

      <aside className="board-lenses" aria-label="Lenses">
        <div className="board-panel-title">Lenses <kbd>L</kbd></div>
        <div className="lens-list" role="radiogroup" aria-label="Paint the board by">
          {LENSES.map((l) => <button key={l.id} type="button" role="radio" aria-checked={l.id === lensId} className="lens-btn" onClick={() => setLensId(l.id)}>{l.name}</button>)}
        </div>
        <div className="lens-legend">
          <p className="lens-measure">{lens.measure}</p>
          <ul>{lens.legend.map((s) => <li key={s.label}><i style={{ background: s.color }} className={s.color === "transparent" ? "hollow" : ""} />{s.label}</li>)}</ul>
          {highlight?.startsWith("thread:") && <button type="button" className="lens-chip" onClick={() => setHighlight(null)}>Lit: {THREAD_NAME[highlight.slice(7)]} thread ×</button>}
          {(highlight || q) && <p className="lens-count" role="status">{litCount} of {rows.length} lines lit</p>}
        </div>
        <p className="board-howto">Years run left to right, domains top to bottom; every hex is one line. Pick one to open its card, add up to {COMPARE_MAX} to the tray to compare them, and drag along the years to move the marker.</p>
        <div className="board-keys" aria-hidden="true"><span><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> travel</span><span><kbd>C</kbd> compare</span><span><kbd>/</kbd> find</span></div>
      </aside>

      <main className="board-main">
        <div className="board-scroll">
          <svg ref={svg} className="board-svg" viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} role="group" aria-label={`The century from 2026 to 2200, ${data.events.length} lines by domain and year. Painted by ${lens.name}.`}>
            <defs>
              <pattern id="board-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#ffffff22" strokeWidth="1.5" /></pattern>
              <radialGradient id="board-glow"><stop offset="0" stopColor="#dec08b" stopOpacity=".35" /><stop offset="1" stopColor="#dec08b" stopOpacity="0" /></radialGradient>
            </defs>
            {/* Chapters as bands of terrain */}
            {data.eras.map((er, i) => {
              const c0 = ERA_COLS.slice(0, i).reduce((a, b) => a + b, 0), c1 = c0 + ERA_COLS[i];
              return <g key={er.id} className={`board-era era-${i % 2}`}>
                <rect x={xOfCol(c0)} y={AXIS - 6} width={xOfCol(c1) - xOfCol(c0)} height={BOARD_H - AXIS + 6} />
                <text className="era-name" x={xOfCol(c0) + 6} y={14}><title>{`Chapter ${i + 1}: ${er.name}, ${er.from}–${er.to}`}</title>{fitLabel(`${String(i + 1).padStart(2, "0")} ${er.name}`, xOfCol(c1) - xOfCol(c0) - 10)}</text>
              </g>;
            })}
            {/* Empty cells: the board's grain */}
            <g className="board-grain" aria-hidden="true">
              {LANES.map((_, lane) => Array.from({ length: ROWS_PER_LANE }, (_, row) => Array.from({ length: COLS }, (_, col) => { const c = cellCenter({ lane, row, col }); return <polygon key={`${lane}-${row}-${col}`} points={hexPoints(c.x, c.y, R - 1.5)} />; })))}
            </g>
            {/* Lanes */}
            {LANES.map((d, lane) => {
              const y = AXIS + lane * (LANE_H + LANE_GAP);
              return <g key={d} className="board-lane">
                <text x={10} y={y + LANE_H / 2 + 4} style={{ fill: DOMAIN_META[d].color }}>{DOMAIN_META[d].name}</text>
              </g>;
            })}
            {/* Axis */}
            <g className="board-axis" aria-hidden="true">
              {axisYears(data.eras).map((y) => <g key={y}><line x1={xOfYear(y, data.eras)} x2={xOfYear(y, data.eras)} y1={AXIS - 14} y2={AXIS - 4} /><text x={xOfYear(y, data.eras)} y={AXIS - 18} textAnchor={y === 2200 ? "end" : "middle"}>{y}</text></g>)}
              <line className="fork-line" x1={xOfYear(2039, data.eras)} x2={xOfYear(2039, data.eras)} y1={AXIS - 6} y2={BOARD_H - 4} /><text className="fork-label" x={xOfYear(2039, data.eras) - 4} y={BOARD_H - 6} textAnchor="end">the fork · 2039</text>
              <line className="today-line" x1={xOfYear(THIS_YEAR, data.eras)} x2={xOfYear(THIS_YEAR, data.eras)} y1={AXIS - 6} y2={BOARD_H} />
            </g>
            {/* Links from the focused line */}
            {focused && focusedPlace && <g className="board-links" aria-hidden="true">
              {placed.filter((p) => focused.event.leadsTo.includes(p.event.id) || p.event.leadsTo.includes(focused.event.id)).map((p) => {
                const out = focused.event.leadsTo.includes(p.event.id);
                const mx = (focusedPlace.x + p.x) / 2, my = Math.min(focusedPlace.y, p.y) - 30 - Math.abs(focusedPlace.x - p.x) * 0.08;
                return <path key={p.event.id} className={out ? "link-out" : "link-in"} d={`M${focusedPlace.x} ${focusedPlace.y} Q${mx} ${my} ${p.x} ${p.y}`} />;
              })}
            </g>}
            {/* Tokens */}
            <g className="board-tokens">
              {placed.map((p) => {
                const r = rowOf.get(p.event.id)!;
                const fill = lens.fill(r, ctx);
                const on = lit(r);
                const inTray = tray.indexOf(p.event.id);
                const isFocus = focus === p.event.id;
                const label = lens.label(r, ctx);
                return <g key={p.event.id} ref={(el) => { if (el) tokenRefs.current.set(p.event.id, el); else tokenRefs.current.delete(p.event.id); }}
                  className={`token${on ? "" : " dim"}${isFocus ? " focus" : ""}${near.includes(p) ? " near" : ""}${explored.has(p.event.id) ? " seen" : ""}`}
                  tabIndex={0} role="button" aria-pressed={isFocus}
                  aria-label={`${p.event.title}, ${when(p.event)}, ${r.now === null ? "scenario" : pct(r.now)}${r.market !== null ? `, market ${pct(r.market)}` : ""}`}
                  onClick={() => openCard(p.event.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(p.event.id); } }}
                  style={{ ["--d" as string]: DOMAIN_META[p.event.domain].color }}>
                  <title>{`${p.event.title} — ${when(p.event)}`}</title>
                  {isFocus && <circle cx={p.x} cy={p.y} r={R * 2.2} fill="url(#board-glow)" />}
                  <polygon className="hex" points={hexPoints(p.x, p.y, R - 1)} style={{ fill: fill ?? "transparent" }} />
                  {fill === null && <polygon className="hex-hatch" points={hexPoints(p.x, p.y, R - 3)} fill="url(#board-hatch)" />}
                  <text x={p.x} y={p.y + 4} style={{ fill: inkFor(fill) }}>{label}</text>
                  {inTray >= 0 && <circle className="tray-pip" cx={p.x + R * 0.72} cy={p.y - R * 0.62} r={4.5} style={{ fill: COMPARE_COLORS[inTray] }} />}
                  {explored.has(p.event.id) && <circle className="seen-pip" cx={p.x - R * 0.72} cy={p.y - R * 0.62} r={2.2} />}
                </g>;
              })}
            </g>
            {/* Year marker */}
            <g className="year-marker" aria-hidden="true">
              <line x1={xOfYear(year, data.eras)} x2={xOfYear(year, data.eras)} y1={AXIS - 8} y2={BOARD_H} />
              <rect className="year-flag" x={xOfYear(year, data.eras) - 22} y={AXIS - 10} width={44} height={16} rx={3} />
              <text x={xOfYear(year, data.eras)} y={AXIS + 2}>{year}</text>
            </g>
            <rect className="scrub-zone" x={GUTTER} y={0} width={BOARD_W - GUTTER} height={AXIS} onPointerDown={scrub} onPointerMove={scrub} />
          </svg>
        </div>
        <World year={year} setYear={setYear} branch={branch} setBranch={setBranch} playing={playing} togglePlay={togglePlay} near={near} onOpen={openCard} />
      </main>

      <aside className={"board-card" + (focused ? " has-card" : "")} aria-live="polite" hidden={!focused}>
        {focused ? <Card row={focused} found={justFound === focused.event.id} inTray={tray.includes(focused.event.id)} trayFull={tray.length >= COMPARE_MAX}
          onCompare={() => setTray((t) => toggleCompare(t, focused.event.id))} onHop={openCard} onClose={() => setFocus(null)}
          onRecord={() => select(focused.event.id)} onRead={() => { onClose(); requestAnimationFrame(() => document.getElementById(`story-${focused.event.id}`)?.scrollIntoView()); }} />
          : null}
      </aside>

      {tray.length > 0 && <div className="board-tray" role="region" aria-label="Compare tray">
        <span className="board-kicker">Compare</span>
        <ul>{tray.map((id, i) => { const e = rowOf.get(id)!.event; return <li key={id} style={{ ["--c" as string]: COMPARE_COLORS[i] }}><button type="button" className="tray-card" onClick={() => openCard(id)}><i />{e.title}</button><button type="button" className="tray-x" aria-label={`Remove ${e.title}`} onClick={() => setTray((t) => t.filter((x) => x !== id))}>×</button></li>; })}</ul>
        <button type="button" className="primary" disabled={tray.length < 2} onClick={() => setComparing(!comparing)}>{comparing ? "Back to the board" : tray.length < 2 ? "Add another to compare" : `Compare ${tray.length}`}</button>
      </div>}

      {comparing && tray.length >= 2 && <Compare rows={tray.map((id) => rowOf.get(id)!)} today={today} onOpen={openCard} onClose={() => setComparing(false)} />}
    </div>,
    document.body,
  );
}

// --------------------------------------------------------------------------------------------------------------- card

function Card({ row, found, inTray, trayFull, onCompare, onHop, onClose, onRecord, onRead }: {
  row: OddsRow; found: boolean; inTray: boolean; trayFull: boolean;
  onCompare: () => void; onHop: (id: string) => void; onClose: () => void; onRecord: () => void; onRead: () => void;
}) {
  const e = row.event;
  const d0 = dayNum(data.meta.written), d1 = dayNum(todayIso());
  const out = data.events.filter((x) => e.leadsTo.includes(x.id));
  const into = data.events.filter((x) => x.leadsTo.includes(e.id) && !e.leadsTo.includes(x.id));
  const chip = (x: ForecastEvent) => <button key={x.id} type="button" className="card-link" style={{ ["--d" as string]: DOMAIN_META[x.domain].color }} onClick={() => onHop(x.id)}><i /><span className="mono">{x.year}</span>{x.title}</button>;
  return <article className="card" style={{ ["--d" as string]: DOMAIN_META[e.domain].color }}>
    <div className="card-top">
      <span className="board-kicker" style={{ color: DOMAIN_META[e.domain].color }}>{DOMAIN_META[e.domain].name} · {when(e)}{e.force ? ` · ${THREAD_NAME[e.force]}` : ""}</span>
      <button type="button" className="card-x" aria-label="Close the card" onClick={onClose}>×</button>
    </div>
    {found && <div className="card-stamp" aria-label="Newly explored">Explored</div>}
    <h3>{e.title}</h3>
    <div className="card-odds">
      <b>{row.now === null ? "Scenario" : pct(row.now)}</b>
      <span>{row.now === null ? "illustrative, unscored" : <>{row.change !== null && <em className={row.change > 0 ? "up" : row.change < 0 ? "down" : ""}>{signedPoints(row.change)} since launch</em>}{e.confidence} confidence</>}</span>
    </div>
    <p className="card-summary">{e.summary}</p>
    {row.series && <figure className="card-chart">
      <Sparkline series={row.series} market={row.marketRows} d0={d0} d1={d1} w={300} h={70} />
      <figcaption><span className="k-forecast">Forecast</span>{row.link && <span className="k-market">{venueName(row.link)}{row.market !== null ? ` ${pct(row.market)}` : ""}</span>}<span className="muted">{shortDate(data.meta.written)} → today</span></figcaption>
    </figure>}
    {row.link && row.gap !== null && <p className="card-gap">The forecast is <b>{signedPoints(row.gap)}</b> points from the market <span className={`match ${row.link.match}`}>{row.link.match} match</span>. {row.link.differs}</p>}
    {out.length > 0 && <div className="card-links"><span className="board-kicker">May lead to</span>{out.map(chip)}</div>}
    {into.length > 0 && <div className="card-links"><span className="board-kicker">Fed by</span>{into.map(chip)}</div>}
    <div className="card-actions">
      <button type="button" className={inTray ? "ghost" : "primary"} onClick={onCompare}>{inTray ? "In the tray ✓" : "Add to compare"} <kbd>C</kbd></button>
      <button type="button" onClick={onRecord}>Full record</button>
      <button type="button" onClick={onRead}>Read its page →</button>
    </div>
    <p className="card-foot muted">{sourceCount(e)} sources cited · {row.moves} move{row.moves === 1 ? "" : "s"} since launch{trayFull && !inTray ? " · tray full: adding drops the oldest" : ""}</p>
  </article>;
}

// ------------------------------------------------------------------------------------------------------------- world

function World({ year, setYear, branch, setBranch, playing, togglePlay, near, onOpen }: {
  year: number; setYear: (y: number) => void; branch: "pluralism" | "concentration"; setBranch: (b: "pluralism" | "concentration") => void;
  playing: boolean; togglePlay: () => void; near: Placed[]; onOpen: (id: string) => void;
}) {
  const clock = lerp((data.clock.byBranch[branch] ?? data.clock.byBranch.pluralism) as [number, number][], year);
  return <section className="board-world" aria-label={`The world in ${year}`}>
    <div className="world-controls">
      <button type="button" className="world-play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play the century"}>{playing ? "❚❚" : "▶"}</button>
      <label className="world-year"><span className="sr-only">Year</span><input type="range" min={2026} max={2200} value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
      <b className="world-y">{year}</b>
      <button type="button" className={"path-pill " + branch} onClick={() => setBranch(branch === "pluralism" ? "concentration" : "pluralism")} title="Which side of the 2039 fork the world panel follows">
        <i />{branch === "pluralism" ? "Many hands" : "One center"}
      </button>
    </div>
    <dl className="world-stats">
      {data.metrics.map((m) => { const v = fmt(m, lerp(metricKF(m, branch), year)); return <div key={m.id} title={m.label}><dt>{SHORT[m.id] ?? m.label}</dt><dd>{v.value}<small>{v.unit}</small></dd></div>; })}
      <div><dt>Doomsday Clock</dt><dd>{clockLabel(clock).replace(" sec", "")}<small>sec</small></dd></div>
    </dl>
    <p className="world-near">{near.length ? <>Around {year}: {near.slice(0, 4).map((p, i) => <span key={p.event.id}>{i ? " · " : ""}<button type="button" className="text-btn" onClick={() => onOpen(p.event.id)}>{p.event.title}</button></span>)}{near.length > 4 ? ` · +${near.length - 4}` : ""}</> : <span className="muted">No line lands within a year and a half of {year}.</span>}</p>
  </section>;
}

// ----------------------------------------------------------------------------------------------------------- compare

function Compare({ rows, today, onOpen, onClose }: { rows: OddsRow[]; today: string; onOpen: (id: string) => void; onClose: () => void }) {
  const d0 = dayNum(data.meta.written), d1 = dayNum(today);
  const W = 640, H = 220, L = 36, B = 22, T = 10, Rr = 10;
  const x = (d: number) => L + ((d - d0) / Math.max(1, d1 - d0)) * (W - L - Rr);
  const y = (p: number) => T + (1 - p) * (H - T - B);
  const links = linksAmong(rows.map((r) => r.event));
  const facts: { k: string; v: (r: OddsRow) => string }[] = [
    { k: "When", v: (r) => when(r.event) },
    { k: "Odds now", v: (r) => (r.now === null ? "Scenario" : pct(r.now)) },
    { k: "Since launch", v: (r) => (r.change === null ? "—" : `${signedPoints(r.change)} pts`) },
    { k: "Market", v: (r) => (r.link && r.market !== null ? `${venueName(r.link)} ${pct(r.market)}` : "—") },
    { k: "Gap", v: (r) => (r.gap === null ? "—" : `${signedPoints(r.gap)} pts`) },
    { k: "Domain", v: (r) => DOMAIN_META[r.event.domain].name },
    { k: "Thread", v: (r) => (r.event.force ? THREAD_NAME[r.event.force] : "—") },
    { k: "Sources", v: (r) => String(sourceCount(r.event)) },
  ];
  return <section className="board-compare" aria-label="Compare">
    <div className="compare-head"><h3>Side by side</h3><button type="button" className="card-x" aria-label="Back to the board" onClick={onClose}>×</button></div>
    <svg viewBox={`0 0 ${W} ${H}`} className="compare-chart" role="img" aria-label={`Odds over time for ${rows.map((r) => r.event.title).join(", ")}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => <g key={p}><line x1={L} x2={W - Rr} y1={y(p)} y2={y(p)} className="grid" /><text x={L - 6} y={y(p) + 4} textAnchor="end">{p * 100}%</text></g>)}
      <text x={L} y={H - 4}>{shortDate(data.meta.written)}</text><text x={W - Rr} y={H - 4} textAnchor="end">{shortDate(today)}</text>
      {rows.map((r, i) => {
        if (!r.series) return null;
        const c = COMPARE_COLORS[i];
        const step = r.series.steps.map((s, j) => (j === 0 ? `M${x(d0)} ${y(s.p)}` : `H${x(Math.min(d1, dayNum(s.date)))}V${y(s.p)}`)).join("") + `H${x(d1)}`;
        const m = r.marketRows.filter((row) => dayNum(row.date) >= d0).map((row, j) => `${j ? "L" : "M"}${x(dayNum(row.date))} ${y(row.p)}`).join("");
        return <g key={r.event.id} transform={`translate(0 ${(i - (rows.length - 1) / 2) * 2.2})`}>{m && <path d={m} className="cmp-market" style={{ stroke: c }} />}<path d={step} className="cmp-forecast" style={{ stroke: c }} /><circle cx={x(d1)} cy={y(r.series.end)} r={3.5} style={{ fill: c }} /></g>;
      })}
    </svg>
    <p className="compare-key muted">Solid: the forecast. Dotted: its market, where one is linked.</p>
    <div className="compare-table" role="table" style={{ gridTemplateColumns: `110px repeat(${rows.length}, minmax(0, 1fr))` }}>
      <div role="row" className="cmp-row cmp-titles"><span role="columnheader" />{rows.map((r, i) => <span role="columnheader" key={r.event.id} style={{ ["--c" as string]: COMPARE_COLORS[i] }}><button type="button" className="text-btn" onClick={() => onOpen(r.event.id)}><i />{r.event.title}</button></span>)}</div>
      {facts.map((f) => <div role="row" className="cmp-row" key={f.k}><span role="rowheader">{f.k}</span>{rows.map((r) => <span role="cell" key={r.event.id}>{f.v(r)}</span>)}</div>)}
    </div>
    {links.length > 0 ? <ul className="compare-links">{links.map((l) => <li key={l.from.id + l.to.id}><b>{l.from.title}</b> may lead to <b>{l.to.title}</b></li>)}</ul>
      : <p className="muted compare-links">None of these lines names another as a driver.</p>}
  </section>;
}

