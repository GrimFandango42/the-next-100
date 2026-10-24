import { data } from "../data";
import { STATUS_LABEL } from "../lib";
import { DOMAIN_META } from "../schema";
import { useStore } from "../store";
import { Cite } from "./EventDrawer";

export function Eras() {
  const { year, setYear } = useStore();
  return (
    <div className="eras">
      {data.eras.map((er) => (
        <article key={er.id} className={"era-card" + (year >= er.from && year <= er.to ? " on" : "")} onClick={() => { setYear(er.from); (window as any).__tl?.zoomTo(er.from - 0.5, er.to + 0.5); document.getElementById("timeline")?.scrollIntoView({ behavior: "smooth" }); }}>
          <div className="top"><h3>{er.name}</h3><span className="span mono">{er.from}–{er.to}</span></div>
          <p className="muted">{er.thesis}</p>
          <div className="gb">
            <div><b>What goes right</b><ul>{er.good.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div className="bad"><b>What goes wrong</b><ul>{er.bad.map((x) => <li key={x}>{x}</li>)}</ul></div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function Scorecard() {
  const { branch } = useStore();
  return (
    <div>
      <div className="bars">
        {data.scenarios.map((s) => {
          const v = s.byBranch[branch] ?? s.unconditional;
          return (
            <div key={s.id} className="bar">
              <div><div className="bar-l">{s.label}</div><div className="muted small">{s.description}</div></div>
              <div className="track"><div className={"fill " + s.tone} style={{ width: v + "%" }} /><span className="tick-mark" style={{ left: s.unconditional + "%" }} title={`${s.unconditional}% overall`} /></div>
              <div className="n"><b className="mono">{v}%</b><small>if {branch}</small><small className="muted">{s.unconditional}% overall</small></div>
            </div>
          );
        })}
      </div>
      <p className="note">Bars show the odds if {branch} wins. The thin mark on each bar is the overall estimate, with the two branches weighted {Math.round(data.meta.hinge.pluralismProbability * 100)}/{Math.round((1 - data.meta.hinge.pluralismProbability) * 100)}. Use the scenario buttons above to compare.</p>
    </div>
  );
}

export function Indicators() {
  return (
    <div className="inds">
      <div className="inds-head"><span>← concentration</span><span>pluralism →</span></div>
      {data.indicators.map((i) => (
        <div key={i.id} className="ind">
          <div className="ind-top"><b>{i.watch}</b><span className="mono muted">{i.window}</span></div>
          <div className="needle-track" title={`Reading ${i.reading > 0 ? "+" : ""}${i.reading.toFixed(1)}`}>
            <div className="mid" />
            <div className="needle" style={{ left: `calc(${(i.reading + 1) * 50}% - 6px)`, background: i.reading > 0.05 ? "var(--good)" : i.reading < -0.05 ? "var(--bad)" : "var(--muted)" }} />
          </div>
          <div className="ind-readings"><span className="c">{i.concentration}</span><span className="p">{i.pluralism}</span></div>
          {i.note && <p className="small muted">{i.note}{i.lastChecked && <span className="mono"> · checked {i.lastChecked}</span>}</p>}
          {i.sources.length > 0 && <details className="ind-src"><summary>{i.sources.length} sources</summary><ul className="cites">{i.sources.map((u) => <Cite key={u} url={u} />)}</ul></details>}
        </div>
      ))}
    </div>
  );
}

export function TrackRecord() {
  const { select } = useStore();
  const counts = data.events.reduce<Record<string, number>>((a, e) => { a[e.status] = (a[e.status] ?? 0) + 1; return a; }, {});
  const resolved = data.events.filter((e) => e.status !== "forecast");
  const due = data.events.filter((e) => e.status === "forecast" && e.resolution?.assessAfter && e.resolution.assessAfter < new Date().toISOString().slice(0,10));
  return (
    <div className="record">
      {resolved.length > 0 && <div className="record-tiles">
        {(["forecast", "happened", "partial", "early", "late", "missed", "retired"] as const).map((s) => (
          <div key={s} className={"rt " + s}><div className="v mono">{counts[s] ?? 0}</div><div className="lbl">{STATUS_LABEL[s]}</div></div>
        ))}
      </div>}
      <p className="note">Scoring: a resolved line is Brier-scored against the probability in the earliest frozen vintage that holds the same question (title and window); if its resolution test was reworded after that vintage, the score is shown with that caveat rather than thrown out. Partial and retired lines and the unscored scenarios are listed, not scored. {resolved.length === 0 ? "Nothing has resolved yet; the first lines come due in 2027." : `${resolved.length} resolved so far.`}</p>
      {due.length > 0 && <p className="note">Past due and unresolved: {due.map((e) => e.title).join("; ")}. The next check-in has to grade these.</p>}
      {resolved.length > 0 && (
        <ul className="resolved">
          {resolved.sort((a, b) => a.year - b.year).map((e) => <li key={e.id}><span className="mono" style={{ color: DOMAIN_META[e.domain].color }}>{e.year}</span> <span className={"pill status " + e.status}>{STATUS_LABEL[e.status]}</span> {e.title}</li>)}
        </ul>
      )}
      {resolved.length === 0 && (() => {
        const first = Math.min(...data.events.filter(e=>e.resolution?.assessAfter).map(e=>Number(e.resolution!.assessAfter!.slice(0,4))));
        const due = data.events.filter(e=>Number(e.resolution?.assessAfter?.slice(0,4)) === first);
        return <div className="first-due"><div className="eyebrow">First scheduled adjudications · {first}</div><p>Nothing has resolved yet. {due.length} line{due.length === 1 ? "" : "s"} have the earliest scheduled adjudication:</p><ul>{due.map((e) => <li key={e.id}><button className="link" onClick={() => select(e.id)}>{e.title} <span className="muted mono">{Math.round((e.probability ?? 0) * 100)}%</span></button></li>)}</ul></div>;
      })()}
    </div>
  );
}

export function Changelog() {
  const { select } = useStore();
  const log = [...data.changelog].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <ol className="log">
      {log.map((c, i) => (
        <li key={i} className={"log-" + c.kind}>
          <div className="log-date mono">{c.date} <span className="pill">{c.kind}</span></div>
          <div><b>{c.headline}</b><p className="muted">{c.body}</p>
            {c.touched.length > 0 && <div className="touched">{c.touched.map((id) => { const e = data.events.find((x) => x.id === id); return e ? <button key={id} className="link" onClick={() => { select(e.id); document.getElementById("timeline")?.scrollIntoView({ behavior: "smooth" }); }}>{e.year} · {e.title}</button> : null; })}</div>}
            {c.sources.length > 0 && <div className="src">{c.sources.map((s, j) => <a key={j} href={s} target="_blank" rel="noreferrer">source {j + 1}</a>)}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Method() {
  return (
    <div className="method">
      <div className="forces">
        {data.meta.forces.map((f, i) => <div key={i} className="force"><div className="eyebrow">Force {i + 1}</div><b>{f.name}</b><p className="muted">{f.text}</p></div>)}
      </div>
      <p className="note">The tiers are about likelihood, not how strong the evidence is; what would count, and what the sources actually show, sit on each line.</p>
      <div className="legend">
        <div><span className="pill high">High</span> 70%+ · I'd be surprised if it didn't happen roughly on schedule</div>
        <div><span className="pill moderate">Moderate</span> 45–70% · a real bet either way; timing could slip a decade</div>
        <div><span className="pill speculative">Speculative</span> under 45% · included because it matters if it happens</div>
      </div>
      <p>{data.meta.caveat}</p>
      <p className="muted">How updates work: every week an automated check-in reads the news against each event's signals and the leading indicators, then edits the data files in the <a href="https://github.com/GrimFandango42/the-next-100" target="_blank" rel="noreferrer">public repository</a>. Each change carries a date, a reason and its sources, and the site redeploys itself. Nothing is ever silently rewritten; the revision history on every event is the audit trail.</p>
    </div>
  );
}
