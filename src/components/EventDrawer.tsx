import { useEffect } from "react";
import { data } from "../data";
import { CONF_LABEL, STATUS_LABEL } from "../lib";
import { DOMAIN_META } from "../schema";
import { useStore } from "../store";

export default function EventDrawer() {
  const { selected, select, setYear, year } = useStore();
  const e = data.events.find((x) => x.id === selected);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") select(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);
  if (!e) return (
    <aside className="drawer empty">
      <div className="eyebrow">Event detail</div>
      <p className="muted">Click any dot on the timeline. You'll get the full reasoning, the signals a weekly check-in watches for, what the event leads to, and every revision since it was written.</p>
      <Upcoming />
    </aside>
  );
  const color = DOMAIN_META[e.domain].color;
  const next = data.events.filter((x) => e.leadsTo.includes(x.id));
  const prev = data.events.filter((x) => x.leadsTo.includes(e.id));
  return (
    <aside className="drawer" aria-live="polite">
      <div className="drawer-top">
        <div className="eyebrow" style={{ color }}>{DOMAIN_META[e.domain].name} · {e.year}{e.yearEnd ? `–${e.yearEnd}` : ""}</div>
        <button className="x" aria-label="Close" onClick={() => select(null)}>×</button>
      </div>
      <h3>{e.title}{e.cornerstone && <span className="corner">cornerstone</span>}</h3>
      <div className="badges">
        <span className={"pill " + e.confidence}>{CONF_LABEL[e.confidence]}{e.probability != null && ` · ${Math.round(e.probability * 100)}%`}</span>
        <span className={"pill status " + e.status}>{STATUS_LABEL[e.status]}{e.resolvedOn ? ` · ${e.resolvedOn}` : ""}</span>
        {e.branch && <span className="pill">{e.branch} branch only</span>}
      </div>
      <p className="lede">{e.summary}</p>
      <p>{e.detail}</p>
      {e.signals.length > 0 && (
        <div className="block"><div className="eyebrow">What the check-in watches for</div><ul>{e.signals.map((s) => <li key={s}>{s}</li>)}</ul></div>
      )}
      {(prev.length > 0 || next.length > 0) && (
        <div className="block links">
          {prev.length > 0 && <div><div className="eyebrow">Follows from</div>{prev.map((p) => <button key={p.id} className="link" onClick={() => { select(p.id); setYear(p.year); }}>{p.year} · {p.title}</button>)}</div>}
          {next.length > 0 && <div><div className="eyebrow">Leads to</div>{next.map((p) => <button key={p.id} className="link" onClick={() => { select(p.id); setYear(p.year); }}>{p.year} · {p.title}</button>)}</div>}
        </div>
      )}
      <div className="block">
        <div className="eyebrow">Revision history</div>
        {e.history.length === 0 ? <p className="muted small">Unchanged since written on {data.meta.written}.</p> : (
          <ul className="hist">{e.history.map((h, i) => <li key={i}><span className="mono">{h.date}</span> <b>{h.change}</b><br /><span className="muted">{h.reason}</span>{h.sources.length > 0 && <span className="src">{h.sources.map((s, j) => <a key={j} href={s} target="_blank" rel="noreferrer">[{j + 1}]</a>)}</span>}</li>)}</ul>
        )}
      </div>
      {e.year > year && <button className="ghost" onClick={() => setYear(e.year)}>Jump the world to {e.year} →</button>}
    </aside>
  );
}

function Upcoming() {
  const { year, select, setYear, branch } = useStore();
  const next = data.events.filter((e) => e.year >= year && (!e.branch || e.branch === branch)).sort((a, b) => a.year - b.year).slice(0, 5);
  return (
    <div className="block">
      <div className="eyebrow">Next up from {year}</div>
      {next.map((e) => <button key={e.id} className="link" onClick={() => { select(e.id); setYear(e.year); }}><span className="mono" style={{ color: DOMAIN_META[e.domain].color }}>{e.year}</span> {e.title}</button>)}
    </div>
  );
}
