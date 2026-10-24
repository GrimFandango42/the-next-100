import { useEffect, useRef, useState } from "react";
import { data } from "../data";
import { fmt, lerp, metricKF } from "../lib";
import { DOMAIN_META, type Branch, type ForecastEvent } from "../schema";
import { useStore } from "../store";
import { exhibitFor } from "./Exhibit";
import { FutureMap, Network } from "./StoryArt";
import Figure, { figureCaption } from "./Figure";

/**
 * The book. One way to move: scroll. One strip at the top tells you where you are and opens the overview
 * (the whole century on one screen) when you want to zoom out. Every page shows one prediction with a figure
 * drawn from the forecast's own numbers.
 */
const ordered = [...data.events].sort((a, b) => a.year - b.year || Number(b.cornerstone) - Number(a.cornerstone));
type Era = (typeof data.eras)[number];
export const pageId = (event: ForecastEvent) => `story-${event.id}`;
const chapterFor = (year: number) => data.eras.find((era, i) => year >= era.from && (year < era.to || i === data.eras.length - 1)) ?? data.eras[0];
const pad = (n: number) => String(n).padStart(2, "0");
export const when = (e: ForecastEvent) => e.timing === "window" ? `${e.year}–${e.yearEnd}` : e.timing === "through" ? `through ${e.year}` : e.timing === "by" ? `by ${e.year}` : `around ${e.year}`;

export function BranchChoice({ compact = false }: { compact?: boolean }) {
  const { branch, setBranch } = useStore();
  return <div className={compact ? "branch-choice compact" : "branch-choice"} role="group" aria-label="Future scenario">
    {(["pluralism", "concentration"] as Branch[]).map((b) => <button key={b} aria-pressed={branch === b} onClick={() => setBranch(b)}>{b === "pluralism" ? "Many hands" : "One center"}</button>)}
  </div>;
}

function Odds({ event }: { event: ForecastEvent }) {
  return <div className="forecast-confidence"><span>{event.probability != null ? `${Math.round(event.probability * 100)}%` : "—"}</span><div>likely<small>{when(event)} · {event.resolution?.mode === "scenario" ? "illustrative scenario · unscored" : "subjective forecast"}{event.cornerstone ? " · cornerstone" : ""}</small></div></div>;
}

function PredictionScene({ event, index, current }: { event: ForecastEvent; index: number; current: boolean }) {
  const { select, branch } = useStore();
  const words = event.title.split(" ");
  const tail = words.splice(-Math.min(3, Math.max(1, Math.floor(words.length / 3)))).join(" ");
  return <section id={pageId(event)} className={`guide-scene event-scene ${index % 2 ? "verso" : "recto"} ${current ? "is-current" : ""}`} data-story-stop data-year={event.year} data-event-id={event.id} data-domain={event.domain} aria-labelledby={`title-${event.id}`} style={{ ["--d" as any]: DOMAIN_META[event.domain].color }}>
    <div className="scene-copy">
      <div className="guide-kicker"><span>{pad(index + 1)} / {DOMAIN_META[event.domain].name.toUpperCase()}</span><span>{event.year}{event.yearEnd ? `–${event.yearEnd}` : ""}</span></div>
      <h2 id={`title-${event.id}`}>{words.join(" ")} <em>{tail}</em></h2>
      <p className="guide-lead">{event.summary}</p>
      {event.branch && <span className="conditional-note">Only on the {event.branch} path</span>}
      <Odds event={event} />
      <details className="forecast-details"><summary>Evidence & what would count</summary>
        {event.resolution && <p className="counts"><b>What counts.</b> {event.resolution.test}</p>}
        <p className="counts"><b>Evidence status.</b> {event.evidenceNote ?? "Sources provide context; the probability is an editorial judgment, not a published scientific estimate."}</p>
        <Drivers event={event} />
      </details>
      <div className="page-actions"><button className="guide-text-button" onClick={() => select(event.id)}>Why this forecast? <span>↗</span></button><Cited event={event} /></div>
    </div>
    <div className="scene-art"><Figure ev={event} branch={branch} year={event.year} active={current} />{!exhibitFor(event) && <div className="art-caption"><span>{figureCaption(event)}</span><span>{event.hero?.ladder ? "MILESTONES · STATUS AS OF LAST REVIEW" : "OBSERVATIONS AND FORECASTS ARE DISTINCT"}</span></div>}</div>
  </section>;
}

function Drivers({ event }: { event: ForecastEvent }) {
  const before = data.events.filter((e) => e.leadsTo.includes(event.id));
  const after = data.events.filter((e) => event.leadsTo.includes(e.id));
  if (!before.length && !after.length) return null;
  const chip = (e: ForecastEvent, kind: string) => <a key={e.id} className="drv" href={`#${pageId(e)}`} style={{ ["--d" as any]: DOMAIN_META[e.domain].color }}><i /><span className="mono">{e.year}</span>{e.title}<small>{kind}</small></a>;
  return <div className="drivers">
    {before.length > 0 && <div><span className="drv-k">Related drivers · not prerequisites</span>{before.map(e=>chip(e,e.relationshipKinds[event.id] ?? "related"))}</div>}
    {after.length > 0 && <div><span className="drv-k">May influence</span>{after.map(e=>chip(e,event.relationshipKinds[e.id] ?? "related"))}</div>}
  </div>;
}

function Cited({ event }: { event: ForecastEvent }) {
  const urls = new Set(event.history.flatMap((h) => h.sources));
  if (!urls.size) return <span className="cited none" title="No source has been cited for this line yet">No sources cited yet</span>;
  return <span className="cited">{urls.size} source{urls.size === 1 ? "" : "s"} · {event.history.length} revision{event.history.length === 1 ? "" : "s"}</span>;
}

function differs(branch: Branch) {
  const other: Branch = branch === "pluralism" ? "concentration" : "pluralism";
  const at = (id: string, y: number, b: Branch) => { const m = data.metrics.find((x) => x.id === id)!; const v = fmt(m, lerp(metricKF(m, b), y)); return v.value + v.unit; };
  const fl = data.scenarios.find((s) => s.id === "flourish")!;
  return [
    { what: "Actors at the AI frontier, 2060", a: at("frontier-actors", 2060, branch), b: at("frontier-actors", 2060, other) },
    { what: "Life expectancy, rich countries, 2080", a: at("lifespan", 2080, branch), b: at("lifespan", 2080, other) },
    { what: "Full-time paid hours a week, 2060", a: at("work-hours", 2060, branch), b: at("work-hours", 2060, other) },
    { what: "Seconds to midnight, 2050", a: String(Math.round(lerp(data.clock.byBranch[branch] as [number, number][], 2050))), b: String(Math.round(lerp(data.clock.byBranch[other] as [number, number][], 2050))) },
    { what: "Chance we flourish by 2200", a: fl.byBranch[branch] + "%", b: fl.byBranch[other] + "%" },
  ];
}

function ForkScene({ event, index, current }: { event: ForecastEvent; index: number; current: boolean }) {
  const { branch, setBranch, setYear, select } = useStore();
  const rows = differs(branch);
  return <section id={pageId(event)} className={`guide-scene fork-scene event-scene ${current ? "is-current" : ""}`} data-story-stop data-year={event.year} data-event-id={event.id} aria-labelledby="fork-title">
    <div className="fork-intro"><div className="guide-kicker"><span>{pad(index + 1)} / THE HINGE</span><span>{event.year}</span></div><h2 id="fork-title">Who gets to hold<br /><em>the future?</em></h2><p>{event.summary} The scenario-dependent figures respond to the path you pick. Other forecasts remain unchanged.</p><button className="guide-text-button" onClick={() => select(event.id)}>Read the reasoning <span>↗</span></button></div>
    <div className="fork-options">
      {(["pluralism", "concentration"] as Branch[]).map((b) => <button className={"future-option " + b} key={b} aria-pressed={branch === b} onClick={() => { setBranch(b); setYear(event.year); }}>
        <span className="option-top"><span>{b === "pluralism" ? "PATH A" : "PATH B"}</span><span className="option-check">{branch === b ? "✓ Following" : "Follow this path ↗"}</span></span>
        <Network concentrated={b === "concentration"} /><span className="option-title">{b === "pluralism" ? "Many hands." : "One center."}</span>
        <span className="option-subtitle">{b === "pluralism" ? "Pluralism" : "Concentration"} · {Math.round((b === "pluralism" ? data.meta.hinge.pluralismProbability : 1 - data.meta.hinge.pluralismProbability) * 100)}% likely</span>
        <span className="option-description">{b === "pluralism" ? "Open models and competing actors. More voices at the table. Messier, but broadly free." : "A decisive lead compounds. Faster coordination, with extraordinary power in very few hands."}</span>
      </button>)}
      <table className="differs" aria-label="What differs between the two paths">
        <thead><tr><th>What differs</th><th>{branch === "pluralism" ? "Many hands" : "One center"}<small>you're following</small></th><th>{branch === "pluralism" ? "One center" : "Many hands"}</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.what}><td>{r.what}</td><td className="mono on">{r.a}</td><td className="mono">{r.b}</td></tr>)}</tbody>
      </table>
    </div>
  </section>;
}

function ChapterPage({ era, index, current }: { era: Era; index: number; current: boolean }) {
  const events = ordered.filter((e) => chapterFor(e.year).id === era.id);
  return <section id={`chapter-${era.id}`} className={`guide-scene chapter-scene ${current ? "is-current" : ""}`} data-story-stop data-year={era.from} aria-labelledby={`chapter-title-${era.id}`}>
    <div className="chapter-copy"><div className="guide-kicker">CHAPTER {pad(index + 1)} / {pad(data.eras.length)}</div><div className="chapter-dates">{era.from} — {era.to}</div><h2 id={`chapter-title-${era.id}`}>{era.name}<em>.</em></h2><p className="guide-lead">{era.thesis}</p>{era.life && <p className="era-life"><b>What changes for you.</b> {era.life}</p>}{era.uncertainty && <p className="era-life"><b>The open question.</b> {era.uncertainty}</p>}<div className="era-gb"><span className="g">▲ {era.good[0]}</span><span className="b">▼ {era.bad[0]}</span></div></div>
    <div className="chapter-plate" aria-hidden="true"><span className="chapter-numeral">{pad(index + 1)}</span><svg viewBox="0 0 600 500">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${70 + i * 11} 440C${60 + i * 23} ${290 - index * 12} ${490 - i * 24} ${340 - index * 18} ${510 - i * 11} 60`} fill="none" stroke={i === 4 ? "#dbc08b" : "#79a58b"} strokeOpacity={i === 4 ? .9 : .15 + i * .035} />)}<circle cx="300" cy="250" r="156" fill="none" stroke="#b9c897" strokeOpacity=".2" strokeDasharray="2 12" /></svg><span className="chapter-plate-label">{events.length} PREDICTIONS · {events.filter((e) => e.cornerstone).length} CORNERSTONE{events.filter((e) => e.cornerstone).length === 1 ? "" : "S"}</span></div>
  </section>;
}

/** The one strip: where you are, the chapters, and the overview (zoom out). */
function ReaderBar({ active }: { active: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const { year, branch, setBranch } = useStore();

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest?.("input,textarea")) return; if (e.key === "Escape") setOpen(false); if (e.key === "-" || e.key === "_") setOpen(true); };
    addEventListener("keydown", key); return () => removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else if (dialog.current?.open) { dialog.current.close(); opener.current?.focus({preventScroll:true}); }
    const previous = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  const event = ordered.find((e) => pageId(e) === active);
  const era = event ? chapterFor(event.year) : data.eras.find((e) => `chapter-${e.id}` === active) ?? data.eras[0];
  const index = event ? ordered.indexOf(event) : -1;
  const progress = event ? (index + 1) / ordered.length : Math.max(0, ordered.findIndex((e) => chapterFor(e.year).id === era.id)) / ordered.length;
  return <>
    <div className="reader-bar" aria-label="Where you are">
      <a className="reader-cover" href="#opening" aria-label="Back to the cover">N<span>100</span></a>
      <nav className="chapter-rail" aria-label="Chapters">{data.eras.map((er, i) => <a key={er.id} href={`#chapter-${er.id}`} aria-label={`Chapter ${i + 1}: ${er.name}`} aria-current={er.id === era.id ? "location" : undefined}><span>{pad(i + 1)}</span><span className="rail-name">{er.name}</span><span className="rail-years">{er.from}</span></a>)}</nav>
      <span className="reader-position" aria-live="polite"><b>{active === "opening" ? 2026 : year}</b><span>{event ? `${pad(index + 1)} / ${ordered.length}` : `CHAPTER ${pad(data.eras.indexOf(era) + 1)}`}</span></span>
      <button className={"path-pill " + branch} onClick={() => setBranch(branch === "pluralism" ? "concentration" : "pluralism")} title="The path you're following. Tap to flip." aria-label={`Following the ${branch} path; tap to follow the other`}><i />{branch === "pluralism" ? "Many hands" : "One center"}</button>
      <button ref={opener} className="overview-btn" aria-expanded={open} aria-controls="overview" onClick={() => setOpen(!open)} title="The whole century on one screen (−)">{open ? "Close ×" : "Overview"} {!open && <span>☷</span>}</button>
      <div className="reader-progress" aria-hidden="true"><i style={{ width: `${progress * 100}%` }} /></div>
    </div>
    <dialog ref={dialog} onCancel={() => setOpen(false)} id="overview" className="overview" aria-label="The whole century" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="overview-panel">
        <div className="overview-head"><button className="guide-text-button" autoFocus onClick={() => setOpen(false)}>Close overview ×</button><div className="guide-kicker">THE WHOLE CENTURY · {ordered.length} PREDICTIONS · TAP ONE TO OPEN ITS PAGE</div></div>
        {data.eras.map((er, i) => <div key={er.id} className="ov-era">
          <a className="ov-chapter" href={`#chapter-${er.id}`} onClick={() => setOpen(false)}><span className="mono">{pad(i + 1)} · {er.from}–{er.to}</span><b>{er.name}</b></a>
          <ol className="ov-list">{ordered.filter((e) => chapterFor(e.year).id === er.id).map((e) => <li key={e.id} className={e.id === event?.id ? "here" : ""}><a href={`#${pageId(e)}`} onClick={() => setOpen(false)}><span className="mono ov-y">{e.year}</span><i className="ov-dot" style={{ background: DOMAIN_META[e.domain].color }} /><span className="ov-t">{e.title}</span><span className="mono ov-p">{e.probability != null ? Math.round(e.probability * 100) + "%" : ""}</span></a></li>)}</ol>
        </div>)}
        <a className="ov-chapter" href="#explore" onClick={() => setOpen(false)}><span className="mono">BELOW THE BOOK</span><b>The evidence: numbers, odds, indicators, track record</b></a>
      </div>
    </dialog>
  </>;
}

export default function StoryJourney() {
  const { setYear, select } = useStore();
  const [active, setActive] = useState("opening");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const visiblePages = new Map<Element, IntersectionObserverEntry>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) visiblePages.set(entry.target, entry); else visiblePages.delete(entry.target); });
      const distance = (entry: IntersectionObserverEntry) => { const r = entry.target.getBoundingClientRect(); return Math.abs(r.top + r.height / 2 - innerHeight * .475); };
      const visible = [...visiblePages.values()].sort((a, b) => distance(a) - distance(b))[0];
      if (visible) { setActive(visible.target.id); const y = Number((visible.target as HTMLElement).dataset.year); if (y) setYear(y); }
    }, { rootMargin: "-20% 0px -35% 0px", threshold: [0, .1, .25, .4] });
    root.current?.querySelectorAll("[data-story-stop]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [setYear]);
  useEffect(() => {
    const id = location.hash.slice(1);
    if (id.startsWith("m-")) { const ev = data.events.find((e) => e.id === id.slice(2)); if (ev) { setYear(ev.year); document.getElementById(pageId(ev))?.scrollIntoView(); select(ev.id); } }
    else if (id.startsWith("story-") || id.startsWith("chapter-")) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="field-guide full-book" ref={root}>
    <section id="opening" className="guide-scene opening-scene" data-story-stop data-year="2026" aria-labelledby="guide-title">
      <div className="scene-copy"><div className="guide-kicker"><span>THE NEXT 100 · A LIVING FORECAST</span><span>2026 — 2200</span></div><h1 id="guide-title">The future isn’t<br />a straight <em>line.</em></h1><p className="guide-lead">{ordered.length} predictions, year by year, each with its odds and what would prove it wrong. Checked against the news every week.</p><a className="guide-cta" href={`#chapter-${data.eras[0].id}`}>Open the first chapter <span>↓</span></a><div className="guide-footnote">Written {data.meta.written} · last check-in {data.meta.lastCheckin}. Scroll to read. Press − or Overview to see the whole century.</div></div>
      <div className="scene-art"><FutureMap /></div>
    </section>
    <div className="book-body"><ReaderBar active={active} />{data.eras.map((era, i) => <div className="book-chapter" key={era.id}><ChapterPage era={era} index={i} current={active === `chapter-${era.id}`} />{ordered.filter((e) => chapterFor(e.year).id === era.id).map((event) => event.id === "hinge-resolves" ? <ForkScene key={event.id} event={event} index={ordered.indexOf(event)} current={active === pageId(event)} /> : <PredictionScene key={event.id} event={event} index={ordered.indexOf(event)} current={active === pageId(event)} />)}</div>)}</div>
    <Endnote />
  </div>;
}

function Endnote() {
  const { branch, setBranch } = useStore();
  const fl = data.scenarios.find((s) => s.id === "flourish")!;
  return <section id="end-of-story" className="book-endnote" data-story-stop data-year="2200" aria-labelledby="endnote-title">
    <div className="guide-kicker">2200 · {branch === "pluralism" ? "IF MANY HANDS WON" : "IF ONE CENTER WON"}</div>
    <h2 id="endnote-title">Does humanity<br /><em>make it?</em></h2>
    <div className="end-odds">{data.scenarios.map((s) => <div key={s.id} className={"ob " + s.tone}><span className="ob-n mono">{s.byBranch[branch]}%</span><span className="ob-bar"><i style={{ width: s.byBranch[branch] + "%" }} /></span><span className="ob-l">{s.label}</span></div>)}</div>
    <p>{fl.byBranch[branch]}% that we flourish on this path: long lives, abundance, humans still in the loop. These are bets, not certainties. The point is to keep watching and change our minds in public.</p>
    <div><a className="guide-cta" href="#explore">See the evidence <span>↓</span></a><button className="guide-text-button" onClick={() => { setBranch(branch === "pluralism" ? "concentration" : "pluralism"); document.getElementById("story-hinge-resolves")?.scrollIntoView(); }}>Follow the other path ↑</button></div>
  </section>;
}
