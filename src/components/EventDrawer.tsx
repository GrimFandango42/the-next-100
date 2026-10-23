import { useEffect, useRef } from "react";
import { data } from "../data";
import { useNarrow } from "../hooks";
import { CONF_LABEL, STATUS_LABEL } from "../lib";
import { DOMAIN_META } from "../schema";
import { useStore } from "../store";

export default function EventDrawer() {
  const { selected, select } = useStore();
  const narrow = useNarrow();
  const e = data.events.find((x) => x.id === selected);
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") select(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);
  useEffect(() => {
    if (!e) return;
    const trigger = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.scrollTo(0, 0);
    sheetRef.current?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = sheetRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || !Array.from(nodes).includes(document.activeElement as HTMLElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trap);
    const content = document.querySelectorAll<HTMLElement>(".field-guide, .explore, .foot, .skip");
    content.forEach(el => { el.inert = true; });
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", trap); content.forEach(el => { el.inert = false; }); trigger?.focus({ preventScroll: true }); };
  }, [narrow, e]);
  if (!e) return null;
  return (
    <div className={"sheet-wrap" + (narrow ? "" : " modal")} onClick={(ev) => { if (ev.target === ev.currentTarget) select(null); }}>
      <div className="sheet" ref={sheetRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={e.title}>
        {narrow && <div className="sheet-handle" aria-hidden="true" />}
        <Detail />
      </div>
    </div>
  );
}

export function Detail() {
  const { selected, select } = useStore();
  const e = data.events.find((x) => x.id === selected);
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
        <span className="drawer-actions">
          <button className="x" aria-label="Copy link to this event" title="Copy link" onClick={() => { const u = location.origin + location.pathname + location.search + "#" + e.id; navigator.clipboard?.writeText(u).catch(() => {}); }}>⧉</button>
          <button className="x" aria-label="Close" onClick={() => select(null)}>×</button>
        </span>
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
          {prev.length > 0 && <div><div className="eyebrow">Follows from</div>{prev.map((p) => <button key={p.id} className="link" onClick={() => select(p.id)}>{p.year} · {p.title}</button>)}</div>}
          {next.length > 0 && <div><div className="eyebrow">Leads to</div>{next.map((p) => <button key={p.id} className="link" onClick={() => select(p.id)}>{p.year} · {p.title}</button>)}</div>}
        </div>
      )}
      <div className="block">
        <div className="eyebrow">Revision history</div>
        {e.history.length === 0 ? <p className="muted small">Unchanged since written on {data.meta.written}.</p> : (
          <ul className="hist">{e.history.map((h, i) => <li key={i}><span className="mono">{h.date}</span> <b>{h.change}</b><br /><span className="muted">{h.reason}</span>{h.sources.length > 0 && <span className="src">{h.sources.map((s, j) => <a key={j} href={s} target="_blank" rel="noreferrer">[{j + 1}]</a>)}</span>}</li>)}</ul>
        )}
      </div>
    </aside>
  );
}

function Upcoming() {
  const { year, select, setYear, branch } = useStore();
  const next = data.events.filter((e) => e.year >= year && (!e.branch || e.branch === branch)).sort((a, b) => a.year - b.year).slice(0, 5);
  return (
    <div className="block">
      <div className="eyebrow">Next up from {year}</div>
      {next.map((e) => <button key={e.id} className="link" onClick={() => select(e.id)}><span className="mono" style={{ color: DOMAIN_META[e.domain].color }}>{e.year}</span> {e.title}</button>)}
    </div>
  );
}
