import { useEffect, useRef, useState } from "react";
import { data } from "../data";
import { DOMAIN_META, type Branch, type Domain } from "../schema";
import { useStore } from "../store";
import { FutureMap, Network, Workbench } from "./StoryArt";

const first = data.events.find(e=>e.id==="agents-default-knowledge-work")!;
const hinge = data.events.find(e=>e.id==="hinge-resolves")!;
const domains = Object.entries(DOMAIN_META) as [Domain,{name:string;color:string}][];

export function BranchChoice({ compact = false }: {compact?: boolean}) {
  const {branch,setBranch} = useStore();
  return <div className={compact?"branch-choice compact":"branch-choice"} role="group" aria-label="Future scenario">
    {(["pluralism","concentration"] as Branch[]).map(b=><button key={b} aria-pressed={branch===b} onClick={()=>setBranch(b)}>{b==="pluralism"?"Many hands":"One center"}</button>)}
  </div>;
}

export default function StoryJourney() {
  const {setYear,select,branch,setBranch} = useStore();
  const [active,setActive] = useState("opening");
  const [filter,setFilter] = useState<Domain|"all">("all");
  const root = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const observer = new IntersectionObserver(entries=>{
      const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(visible){setActive(visible.target.id); const y=Number((visible.target as HTMLElement).dataset.year);if(y)setYear(y);}
    },{rootMargin:"-15% 0px -35% 0px",threshold:0});
    root.current?.querySelectorAll("[data-story-stop]").forEach(el=>observer.observe(el));
    return ()=>observer.disconnect();
  },[setYear]);
  useEffect(()=>{
    const id=location.hash.slice(1);
    // Keep old moment links useful; event-detail hashes remain owned by the store.
    if(id.startsWith("m-")){const ev=data.events.find(e=>e.id===id.slice(2));if(ev){setYear(ev.year);select(ev.id);}}
  },[]); // eslint-disable-line react-hooks/exhaustive-deps
  const events=data.events.filter(e=>filter==="all"||e.domain===filter).sort((a,b)=>a.year-b.year);
  return <div className="field-guide" ref={root}>
    <header className="guide-nav">
      <a href="#opening" className="guide-brand" aria-label="The Next 100 home">The Next <em>100</em><span>A FIELD GUIDE TO THE FUTURE</span></a>
      <nav aria-label="Main navigation"><a href="#first-work" aria-current={active==="first-work"?"location":undefined}>The story</a><a href="#forecast-index" aria-current={active==="forecast-index"?"location":undefined}>All {data.events.length} predictions <span>↗</span></a><a href="#explore">The evidence</a></nav>
      <span className="guide-live"><i/> A living forecast</span>
    </header>
    <section id="opening" className="guide-scene opening-scene" data-story-stop data-year="2026" aria-labelledby="guide-title">
      <div className="scene-copy">
        <div className="guide-kicker"><span>01 / AN OPEN FUTURE</span><span>2026 — 2200</span></div>
        <h1 id="guide-title">The future isn’t<br/>a straight <em>line.</em></h1>
        <p className="guide-lead">AI. Longer lives. A changing planet.<br/>The next century could go many ways.<br/>Let’s follow a few of them.</p>
        <a className="guide-cta" href="#first-work">Step into tomorrow <span>↓</span></a>
        <div className="guide-footnote">{data.events.length} predictions. Two possible paths.<br/>Written in public. Revised as the world changes.</div>
      </div>
      <div className="scene-art"><FutureMap/></div>
      <div className="scene-bottom"><span>AN ILLUSTRATED FORECAST, NOT A CERTAINTY.</span><span>SCROLL TO EXPLORE ↓</span></div>
    </section>
    <section id="first-work" className="guide-scene work-scene" data-story-stop data-year="2027" aria-labelledby="work-title">
      <div className="scene-copy">
        <div className="guide-kicker"><span>02 / THE WAY WE WORK</span><span>2027</span></div>
        <h2 id="work-title">You set the goal.<br/><em>They do the legwork.</em></h2>
        <p className="guide-lead">Research. Analyze. Draft. Repeat.<br/>AI agents become the default for routine knowledge work. The human’s job shifts toward direction and judgment.</p>
        <div className="forecast-confidence"><span>{Math.round(first.probability!*100)}%</span><div>forecast probability<small>by {first.year} · {first.confidence} confidence</small></div></div>
        <button className="guide-text-button" onClick={()=>select(first.id)}>Why this forecast? <span>↗</span></button>
      </div>
      <div className="scene-art"><div className="art-caption"><span>THE AGENT WORKBENCH</span><span>AN ILLUSTRATION OF THE SHIFT</span></div><Workbench/></div>
      <div className="scene-bottom"><a href="#opening">↑ Back to today</a><a href="#the-fork">Next: who holds the power? ↓</a></div>
    </section>
    <section id="the-fork" className="guide-scene fork-scene" data-story-stop data-year="2039" aria-labelledby="fork-title">
      <div className="fork-intro"><div className="guide-kicker"><span>03 / THE BIG QUESTION</span><span>2039</span></div><h2 id="fork-title">Who gets to hold<br/><em>the future?</em></h2><p>The forecast turns on one question: do the most capable systems stay in many hands, or concentrate in a few?</p></div>
      <div className="fork-options">
        {(["pluralism","concentration"] as Branch[]).map(b=><button className={"future-option "+b} key={b} aria-pressed={branch===b} onClick={()=>{setBranch(b);setYear(2039);}}>
          <span className="option-top"><span>{b==="pluralism"?"PATH A":"PATH B"}</span><span className="option-check">{branch===b?"✓ Selected":"Explore this path ↗"}</span></span>
          <Network concentrated={b==="concentration"}/><span className="option-title">{b==="pluralism"?"Many hands.":"One center."}</span>
          <span className="option-subtitle">{b==="pluralism"?"Pluralism":"Concentration"} · {Math.round((b==="pluralism"?data.meta.hinge.pluralismProbability:1-data.meta.hinge.pluralismProbability)*100)}% estimated chance</span>
          <span className="option-description">{b==="pluralism"?"Open models and competing actors. More voices at the table. Messier, but broadly free.":"A decisive lead compounds. Faster coordination, with extraordinary power in very few hands."}</span>
        </button>)}
      </div>
      <div className="fork-response" aria-live="polite"><span><i/> Following the <b>{branch}</b> path. The evidence below now reflects this choice.</span><button className="guide-text-button" onClick={()=>select(hinge.id)}>Read the reasoning ↗</button></div>
      <div className="scene-bottom"><a href="#first-work">↑ The way we work</a><a href="#forecast-index">Explore the rest of the forecast ↓</a></div>
    </section>
    <section id="forecast-index" className="forecast-index" data-story-stop aria-labelledby="index-title">
      <div className="index-heading"><div><div className="guide-kicker">THE FULL FIELD GUIDE</div><h2 id="index-title">{data.events.length} bets<br/>on <em>what comes next.</em></h2></div><p>A date is a forecast, not an appointment.<br/>Open any prediction for its reasoning,<br/>signals, and revision history.</p></div>
      <div className="index-filters" role="group" aria-label="Filter predictions by topic"><button aria-pressed={filter==="all"} onClick={()=>setFilter("all")}>All predictions</button>{domains.map(([id,d])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{d.name}</button>)}</div>
      <div className="index-results" aria-live="polite">{events.length} predictions{filter!=="all"?` · ${DOMAIN_META[filter].name}`:` · ${Math.min(...data.events.map(e=>e.year))}–${Math.max(...data.events.map(e=>e.yearEnd??e.year))}`}</div>
      <ol className="prediction-list">{events.map(e=><li key={e.id}><button onClick={()=>{setYear(e.year);select(e.id);}}><span className="prediction-year">{e.year}{e.yearEnd&&<small>–{e.yearEnd}</small>}</span><span className="prediction-name">{e.title}<small>{DOMAIN_META[e.domain].name}</small></span><span className="prediction-odds">{e.probability!=null?`${Math.round(e.probability*100)}%`:"—"}<small>{e.confidence}</small></span><span className="prediction-arrow">↗</span></button></li>)}</ol>
      <a className="guide-cta" href="#explore">Go behind the forecast <span>↓</span></a>
    </section>
  </div>;
}
