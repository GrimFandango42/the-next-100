import { useState } from "react";
import { data } from "../data";
import { MARKET_HISTORY, MARKET_LINKS, isThin, latestRow, shortDate, venueName, type HistoryRow, type MarketLink } from "../markets";
import { DOMAIN_META, type ChangelogEntry, type ForecastEvent } from "../schema";
import { STATUS_LABEL } from "../lib";
import { useStore } from "../store";
import { checkinDates, comingDue, gapMoves, latestCheckin, movesSince, pct, resolvedSince, signedPoints, sinceFor } from "../views";
import { when } from "./StoryJourney";

interface Props {
  events?: readonly ForecastEvent[];
  changelog?: readonly ChangelogEntry[];
  links?: readonly MarketLink[];
  rows?: readonly HistoryRow[];
  /** Overrides the stored edition (tests). */
  lastSeen?: string | null;
}

/** This week: the latest check-in, then what changed since the reader's last visit, which market gaps moved, and what comes due next. Every item opens its line's drawer. */
export default function ThisWeek({ events = data.events, changelog = data.changelog, links = MARKET_LINKS, rows = MARKET_HISTORY, lastSeen }: Props) {
  const store = useStore();
  const [full, setFull] = useState(false);
  const seen = lastSeen === undefined ? store.lastSeen : lastSeen;
  const entry = latestCheckin(changelog);
  const checkins = checkinDates(changelog);
  const lastCheckin = entry?.date ?? data.meta.lastCheckin;
  const since = sinceFor(seen, lastCheckin, checkins, data.meta.written);
  const moved = movesSince(events, since.date);
  const resolved = resolvedSince(events, since.date);
  const gaps = gapMoves(events, links, rows, checkins, data.meta.written);
  const due = comingDue(events);
  const open = (id: string) => store.select(id);
  const span = since.mode === "visit" ? `since your last visit (check-ins after ${shortDate(since.date)})` : `at the ${shortDate(since.checkin)} check-in`;
  const dot = (e: ForecastEvent) => <i className="wk-dot" aria-hidden="true" style={{ background: DOMAIN_META[e.domain].color }} />;

  return (
    <main className="view-main week-view" aria-labelledby="week-title">
      <header className="view-head week-head">
        <div className="eyebrow">This week · check-in of {entry ? shortDate(entry.date) : shortDate(lastCheckin)}, {lastCheckin.slice(0, 4)}</div>
        <h1 id="week-title" tabIndex={-1}>{entry?.headline ?? "No check-in yet."}</h1>
        {entry && <p id="week-body" className={"week-body" + (entry.body.length > 420 && !full ? " clamped" : "")}>{entry.body}</p>}
        {entry && entry.body.length > 420 && <button type="button" className="week-more" aria-expanded={full} aria-controls="week-body" onClick={() => setFull(!full)}>{full ? "Show less" : "Read the whole check-in"}</button>}
      </header>

      {moved.length === 0 && resolved.length === 0 ? (
        <p className="wk-quiet" data-card="quiet">Nothing moved and nothing resolved {span}.</p>
      ) : (
        <div className="wk-grid">
          <section className="wk-card" data-card="moved" aria-labelledby="wk-moved">
            <h2 id="wk-moved">Moved {span}</h2>
            {moved.length === 0 ? <p className="wk-none">No line moved.</p> : (
              <ul className="wk-list">
                {moved.map((m) => (
                  <li key={m.event.id}>
                    <button type="button" className="wk-item" data-line={m.event.id} onClick={() => open(m.event.id)}>
                      <span className="wk-title">{dot(m.event)}{m.event.title}</span>
                      <span className="wk-move mono"><span className="was">{pct(m.from)}</span> → <b className={m.to > m.from ? "up" : "down"}>{pct(m.to)}</b> <small>{signedPoints(m.to - m.from)} pts</small></span>
                      <span className="wk-reason">{m.reason}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {resolved.length > 0 && (
            <section className="wk-card" data-card="resolved" aria-labelledby="wk-resolved">
              <h2 id="wk-resolved">Resolved {span}</h2>
              <ul className="wk-list">
                {resolved.map((e) => (
                  <li key={e.id}>
                    <button type="button" className="wk-item" data-line={e.id} onClick={() => open(e.id)}>
                      <span className="wk-title">{dot(e)}{e.title}</span>
                      <span className="wk-move"><span className={"pill status " + e.status}>{STATUS_LABEL[e.status]}</span> <small className="mono">{e.resolvedOn}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <div className="wk-grid">
        {gaps.moves.length > 0 && gaps.baseline && (
          <section className="wk-card" data-card="gaps" aria-labelledby="wk-gaps">
            <h2 id="wk-gaps">Gaps with the markets that moved 10 points or more since {shortDate(gaps.baseline)}</h2>
            <ul className="wk-list">
              {gaps.moves.map((g) => (
                <li key={g.event.id}>
                  <button type="button" className="wk-item" data-line={g.event.id} onClick={() => open(g.event.id)}>
                    <span className="wk-title">{dot(g.event)}{g.event.title}</span>
                    <span className="wk-move mono">gap <span className="was">{signedPoints(g.then)}</span> → <b>{signedPoints(g.now)}</b> pts</span>
                    <span className="wk-reason">Forecast {pct(g.forecast)}, {venueName(g.link)} {pct(g.market)} on {shortDate(g.date)}{isThin(g.link, latestRow(g.link, rows)) ? ", a thin market" : ""}.</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="wk-card" data-card="due" aria-labelledby="wk-due">
          <h2 id="wk-due">Coming due next</h2>
          <ul className="wk-list">
            {due.map((e) => (
              <li key={e.id}>
                <button type="button" className="wk-item" data-line={e.id} onClick={() => open(e.id)}>
                  <span className="wk-title">{dot(e)}{e.title}</span>
                  <span className="wk-move mono">{when(e)} · <b>{e.probability != null ? pct(e.probability) : "—"}</b></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
