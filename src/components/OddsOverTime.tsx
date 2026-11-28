import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { data } from "../data";
import { MARKET_HISTORY, MARKET_LINKS, dayNum, forecastSeries, isThin, isoDay, marketLines, marketUrl, readoutAt, shortDate, venueName, type HistoryRow, type MarketLine, type MarketLink } from "../markets";
import type { ForecastEvent } from "../schema";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const pct = (p: number): string => `${Math.round(p * 100)}%`;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

function useWidth(ref: React.RefObject<HTMLElement>, initial = 640): number {
  const [w, setW] = useState(initial);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setW(Math.max(260, Math.round(el.clientWidth)));
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** Axis bounds in percent: tight around the data, never narrower than 30 points, always on a multiple of 10. */
function yDomain(values: number[]): [number, number] {
  let lo = Math.max(0, Math.floor((Math.min(...values) * 100 - 6) / 10) * 10);
  let hi = Math.min(100, Math.ceil((Math.max(...values) * 100 + 6) / 10) * 10);
  while (hi - lo < 30) { if (lo > 0) lo -= 10; if (hi - lo < 30 && hi < 100) hi += 10; }
  return [lo, hi];
}

/** Push labels apart so none overlap, keeping their order. */
function spread(ys: number[], gap: number, min: number, max: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 0; k < order.length; k++) order[k].y = Math.max(order[k].y, k ? order[k - 1].y + gap : min);
  for (let k = order.length - 1; k >= 0; k--) order[k].y = Math.min(order[k].y, k < order.length - 1 ? order[k + 1].y - gap : max);
  const out: number[] = [];
  for (const o of order) out[o.i] = o.y;
  return out;
}

interface Props { event: ForecastEvent; links?: readonly MarketLink[]; rows?: readonly HistoryRow[]; today?: string }

/**
 * How the odds moved: the forecast as a step line against the market's daily price, on one percent axis.
 * Pure over its props, so it draws the forecast alone before any market price exists.
 */
export default function OddsOverTime({ event, links = MARKET_LINKS, rows = MARKET_HISTORY, today = todayIso() }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const [hover, setHover] = useState<number | null>(null);
  const checkins = data.changelog.filter((c) => c.kind === "checkin").map((c) => c.date);
  const f = forecastSeries(event, data.meta.written, checkins, today);
  if (!f) return null;
  const lines = marketLines(event.id, links, rows);

  const d0 = dayNum(data.meta.written);
  const lastRow = Math.max(0, ...lines.flatMap((m) => m.rows.map((r) => dayNum(r.date))));
  const d1 = Math.max(dayNum(today), lastRow, dayNum(f.steps[f.steps.length - 1].date), d0 + 14);
  const inWindow = (m: MarketLine) => m.rows.filter((r) => { const d = dayNum(r.date); return d >= d0 && d <= d1; });
  const mrows = lines.map(inWindow);

  const narrow = width < 480;
  const H = narrow ? 210 : 250;
  const M = { l: 38, r: narrow ? 40 : 46, t: 12, b: 26 };
  const pw = width - M.l - M.r, ph = H - M.t - M.b;
  const [lo, hi] = yDomain([...f.steps.map((s) => s.p), ...mrows.flat().map((r) => r.p)]);
  const x = (d: number) => M.l + ((d - d0) / (d1 - d0)) * pw;
  const y = (p: number) => M.t + (1 - (p * 100 - lo) / (hi - lo)) * ph;
  const r1 = (n: number) => Math.round(n * 10) / 10;

  const stepPath = f.steps.map((s, i) => (i === 0 ? `M${r1(x(d0))} ${r1(y(s.p))}` : `H${r1(x(dayNum(s.date)))}V${r1(y(s.p))}`)).join("") + `H${r1(x(d1))}`;
  const linePath = (rs: HistoryRow[]) => rs.map((r, i) => `${i === 0 || dayNum(r.date) - dayNum(rs[i - 1].date) > 7 ? "M" : "L"}${r1(x(dayNum(r.date)))} ${r1(y(r.p))}`).join("");

  const yStep = hi - lo <= 40 ? 10 : 20;
  const yTicks: number[] = [];
  for (let t = Math.ceil(lo / yStep) * yStep; t <= hi; t += yStep) yTicks.push(t);
  const nx = narrow ? 3 : 5;
  const xTicks = Array.from({ length: nx }, (_, i) => Math.round(d0 + ((d1 - d0) * i) / (nx - 1)));

  // end labels, in the right-hand gutter
  const ends = [{ key: "forecast", p: f.end }, ...lines.map((m, i) => ({ key: m.key, p: mrows[i].length ? mrows[i][mrows[i].length - 1].p : null }))].filter((e): e is { key: string; p: number } => e.p !== null);
  const endY = spread(ends.map((e) => y(e.p)), 13, M.t + 6, H - M.b - 2);

  const dayAt = (clientX: number, el: Element): number => {
    const r = el.getBoundingClientRect();
    const px = ((clientX - r.left) * width) / (r.width || width);
    return Math.max(d0, Math.min(d1, Math.round(d0 + ((px - M.l) / pw) * (d1 - d0))));
  };
  const onPointer = (ev: PointerEvent<SVGRectElement>) => setHover(dayAt(ev.clientX, ev.currentTarget));
  const onKey = (ev: KeyboardEvent<HTMLDivElement>) => {
    const step = ev.key === "ArrowLeft" ? -1 : ev.key === "ArrowRight" ? 1 : 0;
    if (ev.key === "Home") { ev.preventDefault(); setHover(d0); }
    else if (ev.key === "End") { ev.preventDefault(); setHover(d1); }
    else if (step) { ev.preventDefault(); setHover(Math.max(d0, Math.min(d1, (hover ?? d1) + step))); }
  };

  const tip = hover === null ? null : { day: hover, iso: isoDay(hover), items: readoutAt(isoDay(hover), f, lines) };
  const moves = f.steps.filter((s) => s.moved);
  const label = `How the odds moved. Forecast ${pct(f.steps[0].p)} on ${shortDate(data.meta.written)}, ${pct(f.end)} now after ${moves.length} recorded ${moves.length === 1 ? "move" : "moves"}.` +
    lines.map((m, i) => (mrows[i].length ? ` ${m.name} ${pct(mrows[i][mrows[i].length - 1].p)} on ${shortDate(mrows[i][mrows[i].length - 1].date)}.` : ` ${m.name}: no price yet.`)).join("") + " Use the left and right arrow keys to read each day.";

  return (
    <div className="odds-history">
      <div className="eyebrow">How the odds moved</div>
      <div className="odds-legend" aria-hidden="true">
        <span><i className="sw forecast" />Forecast</span>
        {lines.map((m) => <span key={m.key}><i className={"sw " + m.key} />{m.name}</span>)}
        {moves.length > 0 && <span><i className="dot move" />moved</span>}
        {f.held.length > 0 && <span><i className="dot held" />held at a check-in</span>}
      </div>
      <div className="odds-chart" ref={box} tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onBlur={() => setHover(null)}>
        <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} aria-hidden="true">
          {yTicks.map((t) => (
            <g key={t}>
              <line className="grid" x1={M.l} x2={width - M.r} y1={r1(y(t / 100))} y2={r1(y(t / 100))} />
              <text className="tick" x={M.l - 6} y={r1(y(t / 100)) + 3.5} textAnchor="end">{t}%</text>
            </g>
          ))}
          {xTicks.map((d, i) => <text key={d} className="tick" x={r1(x(d))} y={H - 7} textAnchor={i === 0 ? "start" : i === nx - 1 ? "end" : "middle"}>{shortDate(isoDay(d))}</text>)}
          {lines.map((m, i) => mrows[i].length > 0 && (
            <path key={m.key} className={"line " + m.key} data-series={"market-" + m.key} data-days={mrows[i].length} d={linePath(mrows[i])} />
          ))}
          <path className="line forecast" data-series="forecast" data-steps={f.steps.length} d={stepPath} />
          {f.held.map((d) => <circle key={d} className="dot held" data-held cx={r1(x(dayNum(d)))} cy={r1(y(f.steps.filter((s) => s.date <= d).at(-1)!.p))} r={2.4} />)}
          {moves.map((s) => <circle key={s.date + s.p} className="dot move" data-move cx={r1(x(dayNum(s.date)))} cy={r1(y(s.p))} r={4.5} />)}
          {ends.map((e, i) => <text key={e.key} className={"end " + e.key} x={width - M.r + 6} y={r1(endY[i]) + 4}>{pct(e.p)}</text>)}
          {tip && (
            <g>
              <line className="cross" x1={r1(x(tip.day))} x2={r1(x(tip.day))} y1={M.t} y2={H - M.b} />
              {tip.items.map((it) => it.p !== null && <circle key={it.key} className={"hit " + it.key} cx={r1(x(tip.day))} cy={r1(y(it.p))} r={4} />)}
            </g>
          )}
          <rect className="capture" x={M.l} y={M.t} width={pw} height={ph} onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={(ev) => { if (ev.pointerType === "mouse") setHover(null); }} />
        </svg>
        {tip && (
          <div className="odds-tip" style={x(tip.day) > width / 2 ? { right: width - x(tip.day) + 8, top: M.t + 4 } : { left: x(tip.day) + 8, top: M.t + 4 }}>
            <time dateTime={tip.iso}>{shortDate(tip.iso)}</time>
            {tip.items.map((it) => <div key={it.key}><i className={"sw " + it.key} /><span>{it.name}</span><b>{it.p === null ? "no price" : pct(it.p)}</b></div>)}
          </div>
        )}
      </div>
      {lines.length > 0 && (
        <ul className="odds-markets">
          {lines.map((m, i) => {
            const last = mrows[i][mrows[i].length - 1];
            return (
              <li key={m.key} data-market={m.key}>
                <div className="odds-market-head"><i className={"sw " + m.key} /><b>{m.link.label}</b><span className={"pill match-" + m.link.match}>{m.link.match}</span>{isThin(m.link, last) && <span className="pill">thin</span>}</div>
                <p className="small muted">{m.link.differs}</p>
                <p className="small">
                  {m.link.resolved ? <span className="muted">Settled {m.link.resolved.outcome} on {shortDate(m.link.resolved.on)}. </span> : last ? <span className="muted mono">{pct(last.p)} on {shortDate(last.date)}. </span> : <span className="muted">No price pulled yet. </span>}
                  <a href={marketUrl(m.link)} target="_blank" rel="noreferrer">See it on {venueName(m.link)} ↗</a>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
