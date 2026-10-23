import { useEffect, useRef, useState } from "react";
import { data } from "../data";
import { DOMAIN_META, type Branch, type Domain, type ForecastEvent } from "../schema";
import { useStore } from "../store";
import { FutureMap, Network, Workbench } from "./StoryArt";
import PredictionArt from "./PredictionArt";

const ordered = [...data.events].sort((a,b)=>a.year-b.year);
const domains = Object.entries(DOMAIN_META) as [Domain,{name:string;color:string}][];
type Era = typeof data.eras[number];
export const pageId = (event: ForecastEvent) => event.id === "agents-default-knowledge-work" ? "first-work" : event.id === "hinge-resolves" ? "the-fork" : `story-${event.id}`;
const chapterFor = (year: number) => data.eras.find((era,i)=>year>=era.from&&(year<era.to||i===data.eras.length-1)) ?? data.eras[0];
const pad = (n: number) => String(n).padStart(2,"0");

export function BranchChoice({ compact = false }: {compact?: boolean}) {
  const {branch,setBranch} = useStore();
  return <div className={compact?"branch-choice compact":"branch-choice"} role="group" aria-label="Future scenario">
    {(["pluralism","concentration"] as Branch[]).map(b=><button key={b} aria-pressed={branch===b} onClick={()=>setBranch(b)}>{b==="pluralism"?"Many hands":"One center"}</button>)}
  </div>;
}

function PageLinks({ index }: {index: number}) {
  const prev=ordered[index-1], next=ordered[index+1];
  const nextEra=next&&chapterFor(next.year), thisEra=chapterFor(ordered[index].year);
  const previousIsChapter=!prev||chapterFor(prev.year).id!==thisEra.id;
  const previousHref=previousIsChapter?`#chapter-${thisEra.id}`:`#${pageId(prev)}`;
  const nextHref=next ? nextEra!.id!==thisEra.id ? `#chapter-${nextEra!.id}` : `#${pageId(next)}` : "#end-of-story";
  return <div className="scene-bottom page-turns">
    <a href={previousHref} aria-label={previousIsChapter?`Back to chapter opening: ${thisEra.name}`:`Previous prediction: ${prev.title}`}>↑ <span>{previousIsChapter?"Chapter opening":"Previous page"}</span></a>
    <span className="page-folio">{pad(index+1)} / {ordered.length}</span>
    <a href={nextHref} aria-label={next?`Next prediction: ${next.title}`:"Finish the story"}><span>{next?(nextEra!.id!==thisEra.id?"Next chapter":"Turn the page"):"The final word"}</span> ↓</a>
  </div>;
}

function Confidence({ event }: {event: ForecastEvent}) {
  return <div className="forecast-confidence"><span>{event.probability!=null?`${Math.round(event.probability*100)}%`:"—"}</span><div>forecast probability<small>{event.yearEnd?`${event.year}–${event.yearEnd}`:`by ${event.year}`} · {event.confidence} confidence</small></div></div>;
}

function PredictionScene({ event, index, current }: {event: ForecastEvent; index: number; current: boolean}) {
  const {select,branch} = useStore();
  const words=event.title.split(" ");
  const tail=words.splice(-Math.min(3,Math.max(1,Math.floor(words.length/3)))).join(" ");
  const first=event.id==="agents-default-knowledge-work";
  return <section id={pageId(event)} className={`guide-scene event-scene ${first?"work-scene":""} ${index%2?"verso":"recto"} ${current?"is-current":""}`} data-story-stop data-year={event.year} data-event-id={event.id} data-domain={event.domain} aria-labelledby={`title-${event.id}`}>
    <div className="scene-copy">
      <div className="guide-kicker"><span>{pad(index+1)} / {DOMAIN_META[event.domain].name.toUpperCase()}</span><span>{event.year}{event.yearEnd?`–${event.yearEnd}`:""}</span></div>
      <h2 id={`title-${event.id}`}>{first?<>You set the goal.<br/><em>They do the legwork.</em></>:<>{words.join(" ")} <em>{tail}</em></>}</h2>
      <p className="guide-lead">{event.summary}</p>
      {event.branch&&<span className="conditional-note">Conditional on the {event.branch} path</span>}
      <Confidence event={event}/>
      <button className="guide-text-button" onClick={()=>select(event.id)}>Why this forecast? <span>↗</span></button>
    </div>
    <div className="scene-art">{first?<><div className="art-caption"><span>THE AGENT WORKBENCH</span><span>CONCEPT ILLUSTRATION</span></div><Workbench/></>:<PredictionArt event={event} branch={branch}/>}</div>
    <PageLinks index={index}/>
  </section>;
}

function ForkScene({ event, index, current }: {event: ForecastEvent; index: number; current: boolean}) {
  const {branch,setBranch,setYear,select} = useStore();
  return <section id="the-fork" className={`guide-scene fork-scene event-scene ${current?"is-current":""}`} data-story-stop data-year={event.year} data-event-id={event.id} aria-labelledby="fork-title">
    <div className="fork-intro"><div className="guide-kicker"><span>{pad(index+1)} / THE BIG QUESTION</span><span>{event.year}</span></div><h2 id="fork-title">Who gets to hold<br/><em>the future?</em></h2><p>The forecast turns on one question: do the most capable systems stay in many hands, or concentrate in a few?</p></div>
    <div className="fork-options">
      {(["pluralism","concentration"] as Branch[]).map(b=><button className={"future-option "+b} key={b} aria-pressed={branch===b} onClick={()=>{setBranch(b);setYear(event.year);}}>
        <span className="option-top"><span>{b==="pluralism"?"PATH A":"PATH B"}</span><span className="option-check">{branch===b?"✓ Selected":"Explore this path ↗"}</span></span>
        <Network concentrated={b==="concentration"}/><span className="option-title">{b==="pluralism"?"Many hands.":"One center."}</span>
        <span className="option-subtitle">{b==="pluralism"?"Pluralism":"Concentration"} · {Math.round((b==="pluralism"?data.meta.hinge.pluralismProbability:1-data.meta.hinge.pluralismProbability)*100)}% estimated chance</span>
        <span className="option-description">{b==="pluralism"?"Open models and competing actors. More voices at the table. Messier, but broadly free.":"A decisive lead compounds. Faster coordination, with extraordinary power in very few hands."}</span>
      </button>)}
    </div>
    <div className="fork-response" aria-live="polite"><span><i/> Following the <b>{branch}</b> path. Explore what follows, or choose the other path.</span><button className="guide-text-button" onClick={()=>select(event.id)}>Read the reasoning ↗</button></div>
    <PageLinks index={index}/>
  </section>;
}

function ChapterPage({ era, index, current }: {era: Era; index: number; current: boolean}) {
  const events=ordered.filter(e=>chapterFor(e.year).id===era.id);
  return <section id={`chapter-${era.id}`} className={`guide-scene chapter-scene ${current?"is-current":""}`} data-story-stop data-year={era.from} aria-labelledby={`chapter-title-${era.id}`}>
    <div className="chapter-copy"><div className="guide-kicker">CHAPTER {pad(index+1)} / {pad(data.eras.length)}</div><div className="chapter-dates">{era.from} — {era.to}</div><h2 id={`chapter-title-${era.id}`}>{era.name}<em>.</em></h2><p className="guide-lead">{era.thesis}</p>{events[0]&&<a className="guide-cta" href={`#${pageId(events[0])}`}>Open this chapter <span>↓</span></a>}</div>
    <div className="chapter-plate" aria-hidden="true"><span className="chapter-numeral">{pad(index+1)}</span><svg viewBox="0 0 600 500">{Array.from({length:9},(_,i)=><path key={i} d={`M${70+i*11} 440C${60+i*23} ${290-index*12} ${490-i*24} ${340-index*18} ${510-i*11} 60`} fill="none" stroke={i===4?"#dbc08b":"#79a58b"} strokeOpacity={i===4?.9:.15+i*.035}/>)}<circle cx="300" cy="250" r="156" fill="none" stroke="#b9c897" strokeOpacity=".2" strokeDasharray="2 12"/></svg><span className="chapter-plate-label">{events.length} PREDICTIONS · ONE POSSIBLE ERA</span></div>
    <div className="scene-bottom"><a href="#opening">↑ Return to the cover</a><span>A NEW CHAPTER. THE SAME OPEN FUTURE.</span></div>
  </section>;
}

function BookNavigation({ active }: {active: string}) {
  const contents=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{if(contents.current)contents.current.open=false;},[active]);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(contents.current&&!contents.current.contains(event.target as Node))contents.current.open=false;};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"&&contents.current?.open){contents.current.open=false;contents.current.querySelector("summary")?.focus();}};
    document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[]);
  const event=ordered.find(e=>pageId(e)===active);
  const era=event?chapterFor(event.year):data.eras.find(e=>`chapter-${e.id}`===active)??data.eras[0];
  const index=event?ordered.indexOf(event):-1;
  return <div className="reader-bar" aria-label="Book navigation">
    <a className="reader-cover" href="#opening" aria-label="Return to the cover">N<span>100</span></a>
    <nav className="chapter-rail" aria-label="Chapters">{data.eras.map((er,i)=><a key={er.id} href={`#chapter-${er.id}`} aria-label={`Chapter ${i+1}: ${er.name}`} aria-current={er.id===era.id?"location":undefined}><span>{pad(i+1)}</span><span className="rail-name">{er.name}</span><span className="rail-years">{er.from}</span></a>)}</nav>
    <span className="reader-position" aria-live="polite">{event?<><b>{event.year}</b><span>{pad(index+1)} / {ordered.length}</span></>:<><b>{era.from}–{era.to}</b><span>CHAPTER {pad(data.eras.indexOf(era)+1)}</span></>}</span>
    <details className="book-contents" ref={contents}><summary>Contents <span>☷</span></summary><div className="contents-panel"><div className="contents-heading">YOUR FIELD GUIDE <a href="#forecast-index" onClick={()=>{if(contents.current)contents.current.open=false;}}>Compact index ↗</a></div>{data.eras.map((er,i)=><div key={er.id}><a className="contents-chapter" href={`#chapter-${er.id}`} onClick={()=>{if(contents.current)contents.current.open=false;}}>{pad(i+1)} · {er.name}<span>{er.from}–{er.to}</span></a>{ordered.filter(e=>chapterFor(e.year).id===er.id).map(e=><a className="contents-event" key={e.id} href={`#${pageId(e)}`} onClick={()=>{if(contents.current)contents.current.open=false;}}><span>{e.year}</span>{e.title}</a>)}</div>)}</div></details>
    <div className="reader-progress" aria-hidden="true"><i style={{width:`${event?(index+1)/ordered.length*100:Math.max(0,ordered.findIndex(e=>chapterFor(e.year).id===era.id))/ordered.length*100}%`}}/></div>
  </div>;
}

export default function StoryJourney() {
  const {setYear,select} = useStore();
  const [active,setActive] = useState("opening");
  const [filter,setFilter] = useState<Domain|"all">("all");
  const root = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const visiblePages = new Map<Element, IntersectionObserverEntry>();
    const observer = new IntersectionObserver(entries=>{
      entries.forEach(entry=>{if(entry.isIntersecting)visiblePages.set(entry.target,entry);else visiblePages.delete(entry.target);});
      const distance=(entry:IntersectionObserverEntry)=>{const r=entry.target.getBoundingClientRect();return Math.abs(r.top+r.height/2-innerHeight*.475);};
      const visible=[...visiblePages.values()].sort((a,b)=>distance(a)-distance(b))[0];
      if(visible){setActive(visible.target.id);const y=Number((visible.target as HTMLElement).dataset.year);if(y)setYear(y);}
    },{rootMargin:"-20% 0px -35% 0px",threshold:[0,.1,.25,.4]});
    root.current?.querySelectorAll("[data-story-stop]").forEach(el=>observer.observe(el));
    return ()=>observer.disconnect();
  },[setYear]);
  useEffect(()=>{
    const id=location.hash.slice(1);
    if(id.startsWith("m-")){const ev=data.events.find(e=>e.id===id.slice(2));if(ev){setYear(ev.year);select(ev.id);}}
  },[]); // eslint-disable-line react-hooks/exhaustive-deps
  const events=ordered.filter(e=>filter==="all"||e.domain===filter);
  return <div className="field-guide full-book" ref={root}>
    <header className="guide-nav"><a href="#opening" className="guide-brand" aria-label="The Next 100 home">The Next <em>100</em><span>A FIELD GUIDE TO THE FUTURE</span></a><nav aria-label="Main navigation"><a href={`#chapter-${data.eras[0].id}`}>Read the book</a><a href="#forecast-index">All {data.events.length} predictions <span>↗</span></a><a href="#explore">The evidence</a></nav><span className="guide-live"><i/> A living forecast</span></header>
    <section id="opening" className="guide-scene opening-scene" data-story-stop data-year="2026" aria-labelledby="guide-title">
      <div className="scene-copy"><div className="guide-kicker"><span>PROLOGUE / AN OPEN FUTURE</span><span>2026 — 2200</span></div><h1 id="guide-title">The future isn’t<br/>a straight <em>line.</em></h1><p className="guide-lead">AI. Longer lives. A changing planet.<br/>The next century could go many ways.<br/>Let’s follow a few of them.</p><a className="guide-cta" href={`#chapter-${data.eras[0].id}`}>Open the first chapter <span>↓</span></a><div className="guide-footnote">{data.events.length} predictions. {data.eras.length} chapters. Two possible paths.<br/>Written in public. Revised as the world changes.</div></div>
      <div className="scene-art"><FutureMap/></div><div className="scene-bottom"><span>AN ILLUSTRATED FORECAST, NOT A CERTAINTY.</span><span>SCROLL TO TURN THE PAGES ↓</span></div>
    </section>
    <div className="book-body"><BookNavigation active={active}/>{data.eras.map((era,i)=><div className="book-chapter" key={era.id}><ChapterPage era={era} index={i} current={active===`chapter-${era.id}`}/>{ordered.filter(e=>chapterFor(e.year).id===era.id).map(event=>event.id==="hinge-resolves"?<ForkScene key={event.id} event={event} index={ordered.indexOf(event)} current={active===pageId(event)}/>:<PredictionScene key={event.id} event={event} index={ordered.indexOf(event)} current={active===pageId(event)}/>)}</div>)}</div>
    <section id="end-of-story" className="book-endnote" data-story-stop aria-labelledby="endnote-title"><div className="guide-kicker">EPILOGUE / STILL AN OPEN FUTURE</div><h2 id="endnote-title">The last page<br/><em>isn’t written.</em></h2><p>These are bets, not certainties. The point is to keep watching, keep questioning, and change our minds in public.</p><div><a className="guide-cta" href="#explore">Go behind the forecast <span>↓</span></a><a className="guide-text-button" href="#opening">Read again ↑</a></div></section>
    <section id="forecast-index" className="forecast-index" data-story-stop aria-labelledby="index-title">
      <div className="index-heading"><div><div className="guide-kicker">THE COMPACT INDEX</div><h2 id="index-title">{data.events.length} bets<br/>on <em>what comes next.</em></h2></div><p>A date is a forecast, not an appointment.<br/>Read a page, or open its reasoning,<br/>signals, and revision history.</p></div>
      <div className="index-filters" role="group" aria-label="Filter predictions by topic"><button aria-pressed={filter==="all"} onClick={()=>setFilter("all")}>All predictions</button>{domains.map(([id,d])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{d.name}</button>)}</div>
      <div className="index-results" aria-live="polite">{events.length} predictions{filter!=="all"?` · ${DOMAIN_META[filter].name}`:` · ${Math.min(...ordered.map(e=>e.year))}–${Math.max(...ordered.map(e=>e.yearEnd??e.year))}`}</div>
      <ol className="prediction-list">{events.map(e=><li key={e.id}><a className="prediction-read" href={`#${pageId(e)}`}><span className="prediction-year">{e.year}{e.yearEnd&&<small>–{e.yearEnd}</small>}</span><span className="prediction-name">{e.title}<small>{DOMAIN_META[e.domain].name} · Read the illustrated page ↗</small></span></a><button className="prediction-why" aria-label={`Reasoning: ${e.title}`} onClick={()=>{setYear(e.year);select(e.id);}}><span className="prediction-odds">{e.probability!=null?`${Math.round(e.probability*100)}%`:"—"}<small>Why? ↗</small></span></button></li>)}</ol>
      <a className="guide-cta" href="#explore">Go behind the forecast <span>↓</span></a>
    </section>
  </div>;
}
