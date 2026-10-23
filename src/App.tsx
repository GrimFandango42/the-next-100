import { useEffect, useRef } from "react";
import { data } from "./data";
import { DOMAIN_META, type Domain } from "./schema";
import { useStore } from "./store";
import Dial from "./components/Dial";
import Timeline from "./components/Timeline";
import Chronicle from "./components/Chronicle";
import { useNarrow } from "./hooks";
import EventDrawer from "./components/EventDrawer";
import WorldState from "./components/WorldState";
import Clock from "./components/Clock";
import { Changelog, Eras, Indicators, Method, Scorecard, TrackRecord } from "./components/Sections";

const DOMAINS = Object.keys(DOMAIN_META) as Domain[];

export default function App() {
  const { domains, toggleDomain } = useStore();
  const narrow = useNarrow();
  const stickyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stickyRef.current!;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--sticky-h", el.offsetHeight + "px"));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <>
      <a className="skip" href="#timeline">Skip to the timeline</a>
      <header className="hero">
        <nav className="nav">
          <a className="brand" href="#top">The Next <span>100</span></a>
          <div className="nav-links">
            <a href="#timeline">Timeline</a><a href="#world">World state</a><a href="#odds">Odds</a><a href="#signals">Signals</a><a href="#log">Log</a><a href="#method">Method</a>
          </div>
        </nav>
        <div className="hero-body" id="top">
          <div className="eyebrow">Written {data.meta.written} · last check-in {data.meta.lastCheckin} · {data.events.length} forecast lines</div>
          <h1>What happens to us, <em>year by year</em>, from here to 2200.</h1>
          <p className="lede">{data.meta.tagline} {narrow ? "Scroll the timeline and watch the world change in the bar above." : "Zoom the timeline, scrub the year, flip the hinge, and see how every number on the page moves."}</p>
        </div>
      </header>

      <div className="sticky" ref={stickyRef}><Dial /></div>

      <main>
        <section id="timeline">
          <div className="sec-head">
            <div><div className="eyebrow">Timeline</div><h2>{narrow ? "Scroll down to move through time." : "Zoom in on any decade. Zoom out to see the shape."}</h2></div>
            <div className="filters" role="group" aria-label="Show domains">
              {DOMAINS.map((d) => <button key={d} className="chip dom" style={{ ["--d" as any]: DOMAIN_META[d].color }} aria-pressed={domains.has(d)} onClick={() => toggleDomain(d)}><i />{DOMAIN_META[d].name}</button>)}
            </div>
          </div>
          {narrow ? (<><Chronicle /><EventDrawer /></>) : (
            <div className="tl-grid">
              <Timeline />
              <EventDrawer />
            </div>
          )}
        </section>

        <section id="world">
          <div className="sec-head"><div><div className="eyebrow">World state</div><h2>The dashboard of the year you're standing in.</h2></div></div>
          <div className="world-grid">
            <WorldState />
            <div className="clock-card"><div className="eyebrow">Doomsday Clock · forecast</div><Clock /></div>
          </div>
        </section>

        <section id="eras">
          <div className="sec-head"><div><div className="eyebrow">Eras</div><h2>Five periods, each with its own weather.</h2></div></div>
          <Eras />
        </section>

        <section id="odds">
          <div className="sec-head"><div><div className="eyebrow">Odds</div><h2>Does humanity make it?</h2></div></div>
          <Scorecard />
        </section>

        <section id="signals">
          <div className="sec-head"><div><div className="eyebrow">Leading indicators</div><h2>Which branch are we on? The needles move with the news.</h2></div></div>
          <Indicators />
        </section>

        <section id="log">
          <div className="sec-head"><div><div className="eyebrow">Track record</div><h2>The forecast grades itself.</h2></div></div>
          <TrackRecord />
          <div className="sec-head" style={{ marginTop: 32 }}><div><div className="eyebrow">Change log</div><h2>Every revision, with its reason.</h2></div></div>
          <Changelog />
        </section>

        <section id="method">
          <div className="sec-head"><div><div className="eyebrow">Method</div><h2>Three forces, three confidence tiers, one hinge.</h2></div></div>
          <Method />
        </section>
      </main>
      <footer className="foot">The Next 100 · a living forecast · <a href="https://github.com/GrimFandango42/the-next-100" target="_blank" rel="noreferrer">source and data on GitHub</a></footer>
    </>
  );
}
