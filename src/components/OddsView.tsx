import { useEffect, useMemo, useRef, useState } from "react";
import { data } from "../data";
import { useNarrow } from "../hooks";
import { MARKET_HISTORY, MARKET_LINKS, dayNum, shortDate, venueName, type ForecastSeries, type HistoryRow, type MarketLink } from "../markets";
import { DOMAIN_META, type Domain, type ForecastEvent } from "../schema";
import { useStore } from "../store";
import { FIRST_DIR, NO_FILTERS, SOON_YEARS, SORT_LABEL, activeFilterCount, filterRows, oddsRows, pct, signedPoints, sortRows, type Filters, type OddsRow, type SortDir, type SortKey } from "../views";
import { when } from "./StoryJourney";

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const DOMAINS = Object.keys(DOMAIN_META) as Domain[];
const COLUMNS: { key: SortKey; label: string; title?: string }[] = [
  { key: "title", label: "Line" },
  { key: "when", label: "When" },
  { key: "now", label: "Odds now" },
  { key: "change", label: "Since launch", title: "Change in points since the forecast was written" },
  { key: "trend", label: "Trend", title: "The forecast's odds since launch, and the market's where one is linked. Sorts by most recent move." },
  { key: "market", label: "Market" },
  { key: "gap", label: "Gap", title: "Forecast minus market, in points. Sorts by size." },
  { key: "match", label: "Match", title: "How closely the market's question matches the line's" },
];

interface SparkProps { series: ForecastSeries | null; market: readonly HistoryRow[]; d0: number; d1: number; w?: number; h?: number }

/** The odds over time, small: the forecast as a step line, the primary market as a thin line where one is linked. */
export function Sparkline({ series, market, d0, d1, w = 104, h = 26 }: SparkProps) {
  if (!series) return <span className="spark-none" aria-hidden="true">—</span>;
  const span = Math.max(1, d1 - d0);
  const rows = market.filter((r) => { const d = dayNum(r.date); return d >= d0 && d <= d1; });
  const vals = [...series.steps.map((s) => s.p), ...rows.map((r) => r.p)];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 0.2) { const mid = (lo + hi) / 2; lo = Math.max(0, Math.min(0.8, mid - 0.1)); hi = lo + 0.2; }
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const x = (d: number) => r1(2 + ((d - d0) / span) * (w - 6));
  const y = (p: number) => r1(3 + (1 - (p - lo) / (hi - lo)) * (h - 6));
  const step = series.steps.map((s, i) => (i === 0 ? `M${x(d0)} ${y(s.p)}` : `H${x(Math.min(d1, dayNum(s.date)))}V${y(s.p)}`)).join("") + `H${x(d1)}`;
  const line = rows.map((r, i) => `${i === 0 || dayNum(r.date) - dayNum(rows[i - 1].date) > 7 ? "M" : "L"}${x(dayNum(r.date))} ${y(r.p)}`).join("");
  return (
    <svg className="odds-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {line && <path className="spark-market" data-series="market" d={line} />}
      <path className="spark-forecast" data-series="forecast" d={step} />
      <circle className="spark-end" cx={x(d1)} cy={y(series.end)} r={2.2} />
    </svg>
  );
}

function FilterChips({ filters, setFilters, thisYear }: { filters: Filters; setFilters: (f: Filters) => void; thisYear: number }) {
  const toggleDomain = (d: Domain) => { const n = new Set(filters.domains); if (n.has(d)) n.delete(d); else n.add(d); setFilters({ ...filters, domains: n }); };
  return (
    <div className="odds-chips" role="group" aria-label="Filters">
      {DOMAINS.map((d) => (
        <button key={d} type="button" className="chip dom" aria-pressed={filters.domains.has(d)} style={{ ["--d" as string]: DOMAIN_META[d].color }} onClick={() => toggleDomain(d)}><i />{DOMAIN_META[d].name}</button>
      ))}
      <button type="button" className="chip" aria-pressed={filters.moved} onClick={() => setFilters({ ...filters, moved: !filters.moved })}>Moved</button>
      <button type="button" className="chip" aria-pressed={filters.market} onClick={() => setFilters({ ...filters, market: !filters.market })}>Has a market</button>
      <button type="button" className="chip" aria-pressed={filters.soon} title={`Open lines due by ${thisYear + SOON_YEARS}`} onClick={() => setFilters({ ...filters, soon: !filters.soon })}>Due within {SOON_YEARS} years</button>
      {activeFilterCount(filters) > 0 && <button type="button" className="chip clear" onClick={() => setFilters({ ...filters, domains: new Set(), moved: false, market: false, soon: false })}>Clear</button>}
    </div>
  );
}

const oddsText = (r: OddsRow): string => (r.scenario ? "Scenario" : r.now !== null ? pct(r.now) : "—");
const changeClass = (d: number | null): string => (d === null || Math.round(d * 100) === 0 ? "flat" : d > 0 ? "up" : "down");
const marketTitle = (r: OddsRow): string | undefined => (r.link && r.market !== null && r.marketDate ? `${venueName(r.link)}, ${shortDate(r.marketDate)}` : r.link ? `${venueName(r.link)}: no price yet` : undefined);

function Table({ rows, sort, setSort, d0, d1, onOpen }: { rows: OddsRow[]; sort: { key: SortKey; dir: SortDir }; setSort: (k: SortKey) => void; d0: number; d1: number; onOpen: (id: string) => void }) {
  return (
    <table className="odds-table">
      <caption className="sr-only">Every line with its odds now, change since launch, trend, market odds, gap and match. Column headers sort.</caption>
      <thead>
        <tr>
          {COLUMNS.map((c) => (
            <th key={c.key} scope="col" className={"c-" + c.key} aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
              <button type="button" title={c.title} onClick={() => setSort(c.key)}>{c.label}<span className="sort-mark" aria-hidden="true">{sort.key === c.key ? (sort.dir === "asc" ? "↑" : "↓") : ""}</span></button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.event.id} data-line={r.event.id} onClick={() => onOpen(r.event.id)}>
            <th scope="row" className="c-title"><button type="button" className="odds-open" style={{ ["--d" as string]: DOMAIN_META[r.event.domain].color }} onClick={(ev) => { ev.stopPropagation(); onOpen(r.event.id); }}><i aria-hidden="true" />{r.event.title}</button></th>
            <td className="c-when">{when(r.event)}</td>
            <td className={"c-now mono" + (r.scenario ? " scenario" : "")}>{oddsText(r)}</td>
            <td className={"c-change mono " + changeClass(r.change)}>{r.change === null ? "—" : signedPoints(r.change)}</td>
            <td className="c-trend"><Sparkline series={r.series} market={r.marketRows} d0={d0} d1={d1} /></td>
            <td className="c-market mono" title={marketTitle(r)}>{r.market === null ? "—" : pct(r.market)}</td>
            <td className="c-gap mono">{r.gap === null ? "—" : signedPoints(r.gap)}</td>
            <td className="c-match">{r.link ? <span className={"pill match-" + r.link.match}>{r.link.match}</span> : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function List({ rows, d0, d1, onOpen }: { rows: OddsRow[]; d0: number; d1: number; onOpen: (id: string) => void }) {
  return (
    <ol className="odds-list">
      {rows.map((r) => (
        <li key={r.event.id}>
          <button type="button" className="odds-item" data-line={r.event.id} style={{ ["--d" as string]: DOMAIN_META[r.event.domain].color }} onClick={() => onOpen(r.event.id)}>
            <span className="oi-title"><i aria-hidden="true" />{r.event.title}<small>{when(r.event)}{r.market !== null && r.link ? ` · ${venueName(r.link)} ${pct(r.market)}` : ""}</small></span>
            <Sparkline series={r.series} market={r.marketRows} d0={d0} d1={d1} w={72} h={24} />
            <span className="oi-odds"><b className="mono">{oddsText(r)}</b>{r.change !== null && <small className={"mono " + changeClass(r.change)}>{signedPoints(r.change)}</small>}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function SortSheet({ open, onClose, sort, setSortExact, filters, setFilters, thisYear, shown }: { open: boolean; onClose: () => void; sort: { key: SortKey; dir: SortDir }; setSortExact: (s: { key: SortKey; dir: SortDir }) => void; filters: Filters; setFilters: (f: Filters) => void; thisYear: number; shown: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    else if (!open && d.open) d.close();
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  return (
    <dialog ref={ref} className="odds-sheet" aria-labelledby="odds-sheet-title" onClose={onClose} onCancel={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="odds-sheet-body">
        <div className="sheet-handle" aria-hidden="true" />
        <h2 id="odds-sheet-title">Sort and filter</h2>
        <fieldset>
          <legend>Sort by</legend>
          <div className="sort-options">
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <label key={k} className="sort-option"><input type="radio" name="odds-sort" checked={sort.key === k} onChange={() => setSortExact({ key: k, dir: FIRST_DIR[k] })} />{SORT_LABEL[k]}</label>
            ))}
          </div>
          <div className="sort-dir" role="group" aria-label="Direction">
            <button type="button" aria-pressed={sort.dir === "asc"} onClick={() => setSortExact({ ...sort, dir: "asc" })}>Low to high ↑</button>
            <button type="button" aria-pressed={sort.dir === "desc"} onClick={() => setSortExact({ ...sort, dir: "desc" })}>High to low ↓</button>
          </div>
        </fieldset>
        <fieldset>
          <legend>Show</legend>
          <FilterChips filters={filters} setFilters={setFilters} thisYear={thisYear} />
        </fieldset>
        <button type="button" className="primary sheet-done" onClick={onClose}>Show {shown} {shown === 1 ? "line" : "lines"}</button>
      </div>
    </dialog>
  );
}

interface Props { events?: readonly ForecastEvent[]; links?: readonly MarketLink[]; rows?: readonly HistoryRow[]; today?: string }

/** Odds: every line in one table, sortable by any column, with chips to narrow it. On a phone, a list with sort and filters in a sheet. */
export default function OddsView({ events = data.events, links = MARKET_LINKS, rows = MARKET_HISTORY, today = todayIso() }: Props) {
  const { select } = useStore();
  const narrow = useNarrow();
  const [sort, setSortExact] = useState<{ key: SortKey; dir: SortDir }>({ key: "when", dir: "asc" });
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const all = useMemo(() => oddsRows(events, links, rows, data.meta.written, today), [events, links, rows, today]);
  const thisYear = Number(today.slice(0, 4));
  const shown = sortRows(filterRows(all, filters, thisYear), sort.key, sort.dir);
  const d0 = dayNum(data.meta.written), d1 = Math.max(dayNum(today), d0 + 14);
  const setSort = (key: SortKey) => setSortExact(sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: FIRST_DIR[key] });
  const n = activeFilterCount(filters);
  const linked = all.filter((r) => r.link).length;
  return (
    <main className="view-main odds-view" aria-labelledby="odds-title">
      <header className="view-head">
        <div className="eyebrow">Odds · {all.length} lines · {linked} with a market · last check-in {shortDate(data.meta.lastCheckin)}</div>
        <h1 id="odds-title" tabIndex={-1}>Every line and its odds.</h1>
      </header>
      <div className="odds-tools">
        <label className="odds-search"><span className="sr-only">Find a line</span><input type="search" value={filters.query} placeholder="Find a line: fusion, Mars, elections…" onChange={(e) => setFilters({ ...filters, query: e.target.value })} /></label>
        {narrow
          ? <button type="button" className="sheet-open" aria-haspopup="dialog" aria-expanded={sheet} onClick={() => setSheet(true)}>Sort and filter{n > 0 ? ` · ${n}` : ""}</button>
          : <FilterChips filters={filters} setFilters={setFilters} thisYear={thisYear} />}
      </div>
      <p className="odds-count" role="status">{shown.length === all.length ? `All ${all.length} lines` : `${shown.length} of ${all.length} lines`}{narrow ? ` · sorted by ${SORT_LABEL[sort.key].toLowerCase()} ${sort.dir === "asc" ? "↑" : "↓"}` : ""}</p>
      {shown.length === 0 ? <p className="odds-empty">No line matches. <button type="button" className="ghost" onClick={() => setFilters(NO_FILTERS)}>Clear the filters</button></p>
        : narrow ? <List rows={shown} d0={d0} d1={d1} onOpen={select} /> : <Table rows={shown} sort={sort} setSort={setSort} d0={d0} d1={d1} onOpen={select} />}
      {narrow && <SortSheet open={sheet} onClose={() => setSheet(false)} sort={sort} setSortExact={setSortExact} filters={filters} setFilters={setFilters} thisYear={thisYear} shown={shown.length} />}
      <p className="note odds-key">Odds are the forecast's; the trend line is the forecast since {shortDate(data.meta.written)}, with the linked market's daily price beside it. Gap is forecast minus market. A market is a neighbour of a line, not the same question; open a line to see how they differ.</p>
    </main>
  );
}
