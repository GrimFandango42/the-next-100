/**
 * "How the odds moved" and "Forecast against the markets", offline. Rows are built from the recorded market responses in
 * qa/fixtures/markets through the same pull() the site's data comes from, so nothing here needs data/market-history or the network.
 * Run: node --import tsx --test qa/odds.test.tsx qa/markets.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { data } from "../src/data";
import OddsOverTime from "../src/components/OddsOverTime";
import { MarketGapFigure } from "../src/components/Sections";
import { forecastSeries, gapRows, linksFor, marketLines, readoutAt, type HistoryRow, type MarketLink } from "../src/markets";
import { fixtureAdapter, kalshiDayPrice, pull } from "../scripts/markets-pull";
import { MarketLinks } from "../scripts/markets-schema";

const repo = resolve(import.meta.dirname, "..");
const fx = resolve(repo, "qa/fixtures/markets");
const seed: MarketLink[] = MarketLinks.parse(JSON.parse(readFileSync(resolve(fx, "links-seed.json"), "utf8")));
const { rows } = await pull({ links: seed, adapter: fixtureAdapter(fx), history: [], defaultSince: "2026-10-16" });
const TODAY = "2026-11-27";
const event = (id: string) => data.events.find((e) => e.id === id)!;
const drawer = (id: string, r: readonly HistoryRow[] = rows, l: readonly MarketLink[] = seed) => renderToStaticMarkup(<OddsOverTime event={event(id)} links={l} rows={r} today={TODAY} />);
const moves = (id: string) => event(id).history.filter((h) => h.from != null && h.to != null).length;
const count = (html: string, needle: string | RegExp) => (html.match(typeof needle === "string" ? new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g") : needle) ?? []).length;
const forecasts = data.events.filter((e) => e.probability != null && e.resolution?.mode !== "scenario");

test("fixtures give daily rows for every link, so the offline renders below have prices to draw", () => {
  assert.ok(rows.length > 400);
  for (const l of seed) assert.ok(rows.some((r) => r.eventId === l.eventId && r.market === (l.venue === "kalshi" ? l.market.ticker : l.market.slug)), l.label);
});

test("forecast step line: one step per recorded move plus the starting value, ending on today's probability", () => {
  for (const e of forecasts) {
    const html = drawer(e.id);
    assert.equal(count(html, 'data-series="forecast"'), 1, e.id);
    assert.ok(html.includes(`data-steps="${moves(e.id) + 1}"`), `${e.id}: steps`);
    assert.equal(count(html, "data-move"), moves(e.id), `${e.id}: filled dots`);
    const f = forecastSeries(e, data.meta.written, [], TODAY)!;
    assert.equal(f.end, e.probability, `${e.id}: the last recorded move lands on the stated probability`);
    assert.equal(f.steps[0].date, data.meta.written);
  }
});

test("held check-ins are the check-in dates with no move on that line", () => {
  const e = event("the-silence");
  const checkins = data.changelog.filter((c) => c.kind === "checkin").map((c) => c.date);
  const f = forecastSeries(e, data.meta.written, checkins, TODAY)!;
  const moved = new Set(e.history.map((h) => h.date));
  assert.ok(f.held.length > 0 && f.held.every((d) => d > data.meta.written && !moved.has(d)));
  assert.equal(count(drawer("the-silence"), "data-held"), f.held.length);
});

test("a line with two markets draws the primary and a dashed second series; a line with one draws only the primary", () => {
  const two = drawer("next-pandemic");
  assert.equal(count(two, 'data-series="market-primary"'), 1);
  assert.equal(count(two, 'data-series="market-second"'), 1);
  assert.equal(count(two, "data-market="), 2);
  for (const e of forecasts) {
    const n = linksFor(e.id, seed).length;
    const html = drawer(e.id);
    assert.equal(count(html, 'data-series="market-second"'), n > 1 ? 1 : 0, e.id);
    assert.equal(count(html, 'data-series="market-primary"'), n > 0 ? 1 : 0, e.id);
  }
});

test("every number on the chart is a percent between 0 and 100", () => {
  for (const id of ["next-pandemic", "the-silence", "ai-equity-drawdown", "agents-default-knowledge-work"]) {
    const labels = [...drawer(id).matchAll(/>(-?\d+)%</g)].map((m) => Number(m[1]));
    assert.ok(labels.length >= 3, id);
    assert.ok(labels.every((n) => n >= 0 && n <= 100), `${id}: ${labels}`);
  }
});

test("the end label of each series is its latest value", () => {
  const html = drawer("next-pandemic");
  const lines = marketLines("next-pandemic", seed, rows);
  const forecastEnd = Math.round(event("next-pandemic").probability! * 100);
  assert.match(html, new RegExp(`class="end forecast"[^>]*>${forecastEnd}%<`));
  for (const m of lines) {
    const last = m.rows[m.rows.length - 1];
    assert.match(html, new RegExp(`class="end ${m.key}"[^>]*>${Math.round(last.p * 100)}%<`), m.name);
  }
});

test("an inverted market is drawn as 1 minus the recorded price", () => {
  const l = seed.find((x) => x.eventId === "the-silence")!;
  assert.equal(l.inverted, true);
  assert.equal(l.venue, "kalshi");
  const picked = (JSON.parse(readFileSync(resolve(fx, "kalshi-picked-2026-11-27.json"), "utf8")) as { ticker: string; history: { d: string; bid: unknown; ask: unknown; last: unknown }[] }[]).find((e) => e.ticker === (l.venue === "kalshi" ? l.market.ticker : ""))!;
  const mine = rows.filter((r) => r.eventId === "the-silence" && r.venue === "kalshi");
  let checked = 0;
  for (const r of mine) {
    const d = picked.history.find((h) => h.d === r.date)!;
    const n = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
    const raw = kalshiDayPrice({ bid: n(d.bid), ask: n(d.ask), last: n(d.last) })!;
    assert.equal(r.p, Math.round((1 - raw) * 10000) / 10000, r.date);
    checked++;
  }
  assert.ok(checked > 20);
  const last = mine[mine.length - 1];
  assert.match(drawer("the-silence"), new RegExp(`class="end primary"[^>]*>${Math.round(last.p * 100)}%<`));
  assert.match(drawer("the-silence"), /loose/);
});

test("a line with no market shows the forecast alone: no market series, no market notes", () => {
  const free = forecasts.find((e) => linksFor(e.id, seed).length === 0)!;
  assert.ok(free);
  const html = drawer(free.id);
  assert.equal(count(html, 'data-series="forecast"'), 1);
  assert.equal(count(html, 'data-series="market-'), 0);
  assert.equal(count(html, "odds-markets"), 0);
  assert.equal(count(html, "odds-tip"), 0);
});

test("before any price is pulled the markets are named but nothing is drawn for them, and the page still renders", () => {
  const html = drawer("next-pandemic", []);
  assert.equal(count(html, 'data-series="forecast"'), 1);
  assert.equal(count(html, 'data-series="market-'), 0);
  assert.equal(count(html, "No price pulled yet"), 2);
  assert.equal(count(html, 'class="end '), 1);
});

test("under the chart: the market's label, its match grade, how it differs, and a link to the market page", () => {
  const html = drawer("next-pandemic");
  for (const l of linksFor("next-pandemic", seed)) {
    assert.ok(html.includes(l.label.replace(/&/g, "&amp;")) || html.includes(l.label), l.label);
    assert.ok(html.includes(`pill match-${l.match}`));
    assert.ok(html.includes(l.differs.replace(/'/g, "&#x27;").replace(/"/g, "&quot;").replace(/&(?!amp;)/g, "&amp;")) || html.includes(l.differs), `differs: ${l.differs}`);
  }
  assert.match(html, /href="https:\/\/kalshi\.com\/markets\/[a-z0-9-]+"/);
  assert.match(html, /href="https:\/\/polymarket\.com\/event\/[a-z0-9-]+"/);
  assert.ok(!/href="[^"]*[A-Z]{3,}[^"]*kalshi/.test(html));
});

test("scenario lines have no odds history to draw", () => {
  const scenario = data.events.find((e) => e.resolution?.mode === "scenario");
  if (scenario) assert.equal(drawer(scenario.id), "");
});

test("the crosshair readout lists every series on the day, and says 'no price' when a market has no row that day", () => {
  const f = forecastSeries(event("next-pandemic"), data.meta.written, [], TODAY)!;
  const lines = marketLines("next-pandemic", seed, rows);
  const day = lines[0].rows[lines[0].rows.length - 1].date;
  const full = readoutAt(day, f, lines);
  assert.deepEqual(full.map((i) => i.key), ["forecast", "primary", "second"]);
  assert.ok(full.every((i) => i.p !== null && i.p >= 0 && i.p <= 1));
  assert.equal(readoutAt("2026-01-01", f, lines).filter((i) => i.p === null).length, 2);
  const one = marketLines("the-silence", seed, rows);
  assert.equal(readoutAt(day, forecastSeries(event("the-silence"), data.meta.written, [], TODAY)!, one).length, 2);
});

test("a step line holds its value until the date of the next move", () => {
  const e = event("first-ai-election");
  const f = forecastSeries(e, data.meta.written, [], TODAY)!;
  assert.equal(f.steps.length, 3);
  const [a, b, c] = f.steps;
  assert.equal(readoutAt(a.date, f, [])[0].p, a.p);
  assert.equal(readoutAt(b.date, f, [])[0].p, b.p);
  assert.equal(readoutAt(c.date, f, [])[0].p, c.p);
  const dayBefore = new Date(Date.parse(`${b.date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  assert.equal(readoutAt(dayBefore, f, [])[0].p, a.p);
});

// ------------------------------------------------------------------------------------------ the Explore figure

const gap = (r: readonly HistoryRow[]) => renderToStaticMarkup(<MarketGapFigure events={data.events} links={seed} rows={r} onSelect={() => {}} />);

test("Explore figure: one row per line with a primary market, widest forecast-to-market gap first", () => {
  const html = gap(rows);
  const attrs = [...html.matchAll(/data-event="([^"]+)" data-gap="([^"]*)"/g)].map((m) => ({ id: m[1], gap: m[2] === "" ? null : Number(m[2]) }));
  assert.equal(attrs.length, 19);
  assert.ok(attrs.every((a) => a.gap !== null));
  for (let i = 1; i < attrs.length; i++) assert.ok(attrs[i - 1].gap! >= attrs[i].gap!, `${attrs[i - 1].id} before ${attrs[i].id}`);
  const list = gapRows(data.events, seed, rows);
  assert.deepEqual(list.map((r) => r.event.id), attrs.map((a) => a.id));
  for (const r of list) assert.equal(Math.round(r.gap! * 1e4), Math.round(Math.abs(r.forecast - r.market!) * 1e4));
  assert.equal(count(html, 'class="gap-ring" style'), 19, "a ring on every row");
  assert.ok(/pill match-(close|related|loose)/.test(html));
});

test("Explore figure: an inverted line is compared on the line's own side, and every row opens its drawer", () => {
  const silence = gapRows(data.events, seed, rows).find((r) => r.event.id === "the-silence")!;
  const last = rows.filter((r) => r.eventId === "the-silence" && r.venue === "kalshi").at(-1)!;
  assert.equal(silence.market, last.p);
  const clicks: string[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!React.isValidElement(n)) return;
    const p = n.props as { onClick?: () => void; children?: unknown };
    if (p.onClick) p.onClick();
    walk(p.children);
  };
  walk(MarketGapFigure({ events: data.events, links: seed, rows, onSelect: (id) => clicks.push(id) }));
  assert.equal(clicks.length, 19);
  assert.equal(new Set(clicks).size, 19);
  assert.match(gap(rows), /<button class="gap-row"/);
});

test("Explore figure: a line is 'thin' only when its latest row's liquidity is under its venue's floor", () => {
  const l = seed.find((x) => x.primary && x.venue === "kalshi")!;
  const id = l.market.ticker;
  const mk = (liquidity: number | null): HistoryRow[] => [{ eventId: l.eventId, venue: "kalshi", market: id, date: "2026-11-27", p: 0.5, liquidity }];
  const one = (liq: number | null) => renderToStaticMarkup(<MarketGapFigure events={data.events.filter((e) => e.id === l.eventId)} links={seed} rows={mk(liq)} onSelect={() => {}} />);
  assert.equal(count(one(50), ">thin<"), 1);
  assert.equal(count(one(999999), ">thin<"), 0);
  assert.equal(count(one(null), ">thin<"), 0);
});

test("Explore figure: before any price, every row says so and no ring is drawn", () => {
  const html = gap([]);
  assert.equal(count(html, "no price yet"), 19);
  assert.equal(count(html, 'class="gap-ring" style'), 0);
  assert.equal(count(html, 'class="gap-dot" style'), 19);
});

test("the site's data layer does not import the 530 KB of vintages", () => {
  for (const f of ["src/data.ts", "src/markets.ts", "src/components/OddsOverTime.tsx", "src/components/Sections.tsx"]) assert.doesNotMatch(readFileSync(resolve(repo, f), "utf8"), /vintages/, f);
});
