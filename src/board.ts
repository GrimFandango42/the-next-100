/**
 * The century board: every line as a hex token on one board, years across, domains down. Pure: layout, lenses and the
 * tallies are functions of the data, so they are tested without a browser (qa/board.test.ts).
 *
 * The board borrows a field guide's grammar. A lens repaints every token by one real measure, and the legend always
 * states that measure. A token opens a card. Cards can be laid side by side to compare.
 */
import { interpolateLab } from "d3";
import type { Domain, Era, ForecastEvent } from "./schema";
import type { OddsRow } from "./views";

// ----------------------------------------------------------------------------------------------------------- geometry

/** Lanes top to bottom: the forecast's engine first, then what it moves. */
export const LANES: Domain[] = ["ai", "society", "risk", "bio", "energy", "climate", "space"];
export const ROWS_PER_LANE = 3;
/** Columns given to each era, in order. The early chapters hold most of the lines, so they get most of the board. */
export const ERA_COLS = [10, 8, 6, 4, 4];
export const COLS = ERA_COLS.reduce((a, b) => a + b, 0);

/** Hex radius and the derived grid, in SVG units (the SVG scales to its box). Pointy-top hexes, odd rows shifted half a column. */
export const R = 18;
export const COL_W = Math.sqrt(3) * R;
export const ROW_H = 1.5 * R;
export const LANE_GAP = 14;
export const GUTTER = 128;
export const AXIS = 46;
export const LANE_H = (ROWS_PER_LANE - 1) * ROW_H + 2 * R;
export const BOARD_W = GUTTER + (COLS + 0.5) * COL_W + 12;
export const BOARD_H = AXIS + LANES.length * (LANE_H + LANE_GAP);

export interface EraSpan { from: number; to: number }

/** Year → column position (fractional, in columns from the board's left edge). Linear inside each era. */
export function colOfYear(year: number, eras: readonly EraSpan[]): number {
  let start = 0;
  for (let i = 0; i < eras.length; i++) {
    const e = eras[i], n = ERA_COLS[i] ?? 4, last = i === eras.length - 1;
    if (year < e.to || last) {
      const t = Math.max(0, Math.min(1, (year - e.from) / (e.to - e.from)));
      return start + t * n;
    }
    start += n;
  }
  return start;
}

/** Column position → year, the inverse of colOfYear; used by the year marker. */
export function yearOfCol(col: number, eras: readonly EraSpan[]): number {
  let start = 0;
  for (let i = 0; i < eras.length; i++) {
    const e = eras[i], n = ERA_COLS[i] ?? 4;
    if (col <= start + n || i === eras.length - 1) return e.from + Math.max(0, Math.min(1, (col - start) / n)) * (e.to - e.from);
    start += n;
  }
  return eras[eras.length - 1].to;
}

export const xOfCol = (col: number): number => GUTTER + col * COL_W;
export const xOfYear = (year: number, eras: readonly EraSpan[]): number => xOfCol(colOfYear(year, eras));

export interface Cell { lane: number; row: number; col: number }

export function cellCenter(c: Cell): { x: number; y: number } {
  const shift = c.row % 2 === 1 ? 0.5 : 0;
  return { x: xOfCol(c.col + 0.5 + shift) - COL_W * 0.25, y: AXIS + c.lane * (LANE_H + LANE_GAP) + R + c.row * ROW_H };
}

/** The six corners of a pointy-top hex, as an SVG points string. */
export function hexPoints(cx: number, cy: number, r = R): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

export interface Placed { event: ForecastEvent; cell: Cell; x: number; y: number }

/**
 * Every line gets one cell in its domain's lane, as near its year as the lane allows: the middle row first, then the
 * nearest free cell either side. Deterministic: lines are placed in year order, ties by id.
 */
export function layoutBoard(events: readonly ForecastEvent[], eras: readonly EraSpan[]): Placed[] {
  const taken = new Set<string>();
  const out: Placed[] = [];
  const sorted = [...events].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
  for (const event of sorted) {
    const lane = Math.max(0, LANES.indexOf(event.domain));
    const ideal = colOfYear(event.year + (event.yearEnd && event.timing === "window" ? (event.yearEnd - event.year) / 2 : 0), eras);
    let best: Cell | null = null, bestCost = Infinity;
    for (let row = 0; row < ROWS_PER_LANE; row++) {
      const shift = row % 2 === 1 ? 0.5 : 0;
      for (let col = 0; col < COLS; col++) {
        if (taken.has(`${lane}:${row}:${col}`)) continue;
        const cost = Math.abs(col + 0.5 + shift - 0.25 - ideal) + (row === 1 ? 0 : 0.35);
        if (cost < bestCost) { bestCost = cost; best = { lane, row, col }; }
      }
    }
    if (!best) throw new Error(`No room on the board for ${event.id}`);
    taken.add(`${best.lane}:${best.row}:${best.col}`);
    out.push({ event, cell: best, ...cellCenter(best) });
  }
  return out;
}

/** The years marked on the axis: each chapter's start and the end. The fork (2039) is drawn as its own line. */
export function axisYears(eras: readonly Era[]): number[] {
  return [...new Set([...eras.map((e) => e.from), eras[eras.length - 1].to])].sort((a, b) => a - b);
}

/** The nearest token in a direction from (x, y), for arrow-key travel across the board. Null at an edge. */
export function nearestInDirection(from: { x: number; y: number }, all: readonly Placed[], dir: "left" | "right" | "up" | "down"): Placed | null {
  let best: Placed | null = null, bestD = Infinity;
  for (const p of all) {
    const dx = p.x - from.x, dy = p.y - from.y;
    if (dx === 0 && dy === 0) continue;
    const along = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
    const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    if (along <= 0) continue;
    const d = along + across * 2.2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// ------------------------------------------------------------------------------------------------------------ lenses

export type LensId = "odds" | "momentum" | "crowd" | "evidence" | "threads" | "horizon";

export interface LegendStop { color: string; label: string }
export interface Lens {
  id: LensId;
  /** The board's word for it. */
  name: string;
  /** The real measure, stated plainly; the legend shows it every time. */
  measure: string;
  legend: LegendStop[];
  /** Token fill, or null for a hollow token (no value under this lens). */
  fill: (r: OddsRow, ctx: LensContext) => string | null;
  /** What the token shows inside, short. */
  label: (r: OddsRow, ctx: LensContext) => string;
}

export interface LensContext { thisYear: number; sources: (e: ForecastEvent) => number }

const BASE = "#2a4034";
const odds = interpolateLab("#23362c", "#e9c98d");
const up = interpolateLab(BASE, "#5ec48f"), down = interpolateLab(BASE, "#f06a6a");
const mkt = interpolateLab(BASE, "#6fb3ff"), fc = interpolateLab(BASE, "#dec08b");
const ev = interpolateLab("#23362c", "#67d4d0");
const soon = interpolateLab("#23362c", "#f3b64a");
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const pts = (p: number): number => Math.round(p * 100);
const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

export const THREAD_COLOR: Record<string, string> = { ai: "#6fb3ff", hinge: "#c69cff", demography: "#ff9d7a", planet: "#5ec48f" };
export const THREAD_NAME: Record<string, string> = { ai: "Intelligence", hinge: "Institutions", demography: "People", planet: "Planet" };

/** Years until a line can first be graded, from `thisYear`. */
const dueIn = (r: OddsRow, thisYear: number): number => Math.max(0, r.due - thisYear);

export const LENSES: Lens[] = [
  {
    id: "odds", name: "Odds",
    measure: "The forecast's probability today. Brighter is likelier. Scenarios are unscored and drawn hollow.",
    legend: [{ color: odds(0.1), label: "10%" }, { color: odds(0.5), label: "50%" }, { color: odds(0.9), label: "90%" }, { color: "transparent", label: "Scenario" }],
    fill: (r) => (r.now === null ? null : odds(r.now)),
    label: (r) => (r.now === null ? "S" : String(pts(r.now))),
  },
  {
    id: "momentum", name: "Momentum",
    measure: "Change in points since the forecast was written on 22 October 2026. Full colour at 15 points.",
    legend: [{ color: down(1), label: "−15" }, { color: BASE, label: "held" }, { color: up(1), label: "+15" }],
    fill: (r) => (r.change === null ? null : r.change >= 0 ? up(clamp01(r.change / 0.15)) : down(clamp01(-r.change / 0.15))),
    label: (r) => (r.change === null ? "S" : signed(pts(r.change))),
  },
  {
    id: "crowd", name: "Crowd gap",
    measure: "Forecast minus the linked prediction market (Kalshi or Polymarket), in points. Gold: the forecast is more confident. Blue: the market is. Hollow: no market.",
    legend: [{ color: mkt(1), label: "market −30" }, { color: BASE, label: "agree" }, { color: fc(1), label: "forecast +30" }, { color: "transparent", label: "no market" }],
    fill: (r) => (r.gap === null ? null : r.gap >= 0 ? fc(clamp01(r.gap / 0.3)) : mkt(clamp01(-r.gap / 0.3))),
    label: (r) => (r.gap === null ? "" : signed(pts(r.gap))),
  },
  {
    id: "evidence", name: "Evidence",
    measure: "Distinct sources cited in the line's revision history. Full colour at 10. A dark token is a line still waiting for a source.",
    legend: [{ color: ev(0), label: "0" }, { color: ev(0.5), label: "5" }, { color: ev(1), label: "10+" }],
    fill: (r, c) => ev(clamp01(c.sources(r.event) / 10)),
    label: (r, c) => String(c.sources(r.event)),
  },
  {
    id: "threads", name: "Threads",
    measure: "Which of the forecast's four forces the line belongs to. Lines outside the four are drawn hollow.",
    legend: [...Object.keys(THREAD_COLOR).map((k) => ({ color: THREAD_COLOR[k], label: THREAD_NAME[k] })), { color: "transparent", label: "none" }],
    fill: (r) => (r.event.force ? THREAD_COLOR[r.event.force] : null),
    label: (r) => (r.event.force ? THREAD_NAME[r.event.force][0] : ""),
  },
  {
    id: "horizon", name: "Horizon",
    measure: "Years until the line can first be graded: the end of its window, or a year after an \"around\" date. Brighter is sooner.",
    legend: [{ color: soon(1), label: "now" }, { color: soon(0.55), label: "10 y" }, { color: soon(0.25), label: "40 y" }, { color: soon(0), label: "100+ y" }],
    fill: (r, c) => soon(clamp01(1 - Math.log10(1 + dueIn(r, c.thisYear)) / 2)),
    label: (r, c) => String(Math.round(dueIn(r, c.thisYear))),
  },
];

export const lensById = (id: string): Lens => LENSES.find((l) => l.id === id) ?? LENSES[0];

/** Ink for text on a fill: dark on light fills, light on dark ones. */
export function inkFor(fill: string | null): string {
  if (!fill || fill === "transparent") return "#eeeadd";
  const m = fill.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) ?? fill.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return "#eeeadd";
  const [r, g, b] = fill.startsWith("#") ? [1, 2, 3].map((i) => parseInt(m[i], 16)) : [1, 2, 3].map((i) => Number(m[i]));
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? "#14201a" : "#eeeadd";
}

// ----------------------------------------------------------------------------------------------------------- compare

export const COMPARE_MAX = 4;
export const COMPARE_COLORS = ["#dec08b", "#6fb3ff", "#ff9d7a", "#c69cff"];

/** Add or remove a line from the compare tray; a full tray drops its oldest card. */
export function toggleCompare(tray: readonly string[], id: string): string[] {
  if (tray.includes(id)) return tray.filter((x) => x !== id);
  const next = [...tray, id];
  return next.length > COMPARE_MAX ? next.slice(next.length - COMPARE_MAX) : next;
}

/** Links among the compared lines, so the compare panel can say how they bear on each other. */
export function linksAmong(events: readonly ForecastEvent[]): { from: ForecastEvent; to: ForecastEvent }[] {
  const ids = new Set(events.map((e) => e.id));
  return events.flatMap((from) => from.leadsTo.filter((t) => ids.has(t) && t !== from.id).map((t) => ({ from, to: events.find((e) => e.id === t)! })));
}

/** Distinct sources cited across a line's history. */
export const sourceCount = (e: ForecastEvent): number => new Set(e.history.flatMap((h) => h.sources)).size;
