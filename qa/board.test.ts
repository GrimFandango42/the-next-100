/**
 * The century board, offline: every line gets exactly one cell, in its own domain's lane, near its year; the year scale
 * round-trips; every lens paints every line (or marks it hollow on purpose); the compare tray keeps its limit; arrow travel
 * moves the way the arrow points.
 * Run: node --import tsx --test qa/board.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { data } from "../src/data";
import { MARKET_HISTORY, MARKET_LINKS } from "../src/markets";
import { oddsRows } from "../src/views";
import {
  COLS, COMPARE_MAX, LANES, LENSES, ROWS_PER_LANE, colOfYear, inkFor, layoutBoard, linksAmong, nearestInDirection, sourceCount, toggleCompare, yearOfCol,
} from "../src/board";

const placed = layoutBoard(data.events, data.eras);

test("every line is on the board once, each in a cell of its own", () => {
  assert.equal(placed.length, data.events.length);
  assert.equal(new Set(placed.map((p) => p.event.id)).size, data.events.length);
  const cells = placed.map((p) => `${p.cell.lane}:${p.cell.row}:${p.cell.col}`);
  assert.equal(new Set(cells).size, cells.length, "two lines share a cell");
  for (const p of placed) {
    assert.ok(p.cell.row >= 0 && p.cell.row < ROWS_PER_LANE);
    assert.ok(p.cell.col >= 0 && p.cell.col < COLS);
  }
});

test("a line sits in its domain's lane, within two columns of its year", () => {
  for (const p of placed) {
    assert.equal(LANES[p.cell.lane], p.event.domain, p.event.id);
    const e = p.event;
    const ideal = colOfYear(e.year + (e.yearEnd && e.timing === "window" ? (e.yearEnd - e.year) / 2 : 0), data.eras);
    assert.ok(Math.abs(p.cell.col + 0.5 - ideal) <= 2.5, `${e.id} is ${(p.cell.col - ideal).toFixed(1)} columns from its year`);
  }
});

test("the layout is deterministic", () => {
  assert.deepEqual(layoutBoard([...data.events].reverse(), data.eras).map((p) => p.event.id + p.cell.col + p.cell.row).sort(), placed.map((p) => p.event.id + p.cell.col + p.cell.row).sort());
});

test("year → column → year round-trips across every chapter", () => {
  for (const y of [2026, 2028.5, 2030, 2039, 2045, 2060, 2099, 2150, 2200]) assert.ok(Math.abs(yearOfCol(colOfYear(y, data.eras), data.eras) - y) < 1e-6, String(y));
  assert.equal(colOfYear(2026, data.eras), 0);
  assert.equal(colOfYear(2200, data.eras), COLS);
  for (let y = 2027; y <= 2200; y++) assert.ok(colOfYear(y, data.eras) > colOfYear(y - 1, data.eras));
});

test("every lens paints every line, hollow only where the measure is absent", () => {
  const rows = oddsRows(data.events, MARKET_LINKS, MARKET_HISTORY, data.meta.written, "2026-11-28");
  const ctx = { thisYear: 2026.9, sources: sourceCount };
  for (const lens of LENSES) {
    assert.ok(lens.measure.length > 20 && lens.legend.length >= 2, lens.id);
    for (const r of rows) {
      const fill = lens.fill(r, ctx);
      if (fill === null) {
        const why = lens.id === "crowd" ? r.gap === null : lens.id === "threads" ? !r.event.force : r.now === null;
        assert.ok(why, `${lens.id} left ${r.event.id} hollow without a reason`);
      } else assert.match(fill, /^(rgb\(|#)/, `${lens.id} ${r.event.id}`);
      assert.equal(typeof lens.label(r, ctx), "string");
    }
  }
});

test("token ink contrasts with its fill", () => {
  assert.equal(inkFor("rgb(233, 201, 141)"), "#14201a");
  assert.equal(inkFor("rgb(35, 54, 44)"), "#eeeadd");
  assert.equal(inkFor(null), "#eeeadd");
});

test("the compare tray holds four and drops the oldest", () => {
  let t: string[] = [];
  for (const id of ["a", "b", "c", "d", "e"]) t = toggleCompare(t, id);
  assert.equal(t.length, COMPARE_MAX);
  assert.deepEqual(t, ["b", "c", "d", "e"]);
  assert.deepEqual(toggleCompare(t, "c"), ["b", "d", "e"]);
});

test("links among compared lines follow leadsTo", () => {
  const a = data.events.find((e) => e.leadsTo.length > 0)!;
  const b = data.events.find((e) => e.id === a.leadsTo[0])!;
  assert.deepEqual(linksAmong([a, b]).map((l) => [l.from.id, l.to.id]).filter(([f]) => f === a.id), [[a.id, b.id]]);
});

test("arrow travel goes the way the arrow points", () => {
  const mid = placed[Math.floor(placed.length / 2)];
  const right = nearestInDirection(mid, placed, "right"), left = nearestInDirection(mid, placed, "left");
  const down = nearestInDirection(mid, placed, "down"), up = nearestInDirection(mid, placed, "up");
  if (right) assert.ok(right.x > mid.x);
  if (left) assert.ok(left.x < mid.x);
  if (down) assert.ok(down.y > mid.y);
  if (up) assert.ok(up.y < mid.y);
  assert.ok(right || left);
});
