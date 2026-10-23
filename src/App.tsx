import { data } from "./data";
import Journey from "./components/Journey";
import EventDrawer from "./components/EventDrawer";
import WorldState from "./components/WorldState";
import Clock from "./components/Clock";
import { Changelog, Indicators, Method, Scorecard, TrackRecord } from "./components/Sections";

/** The film on top; below it, the evidence. One page, one direction: down. */
export default function App() {
  return (
    <>
      <a className="skip" href="#explore">Skip to the evidence</a>
      <Journey />
      <div id="explore" className="explore">
        <header className="explore-head">
          <div className="eyebrow">Behind the forecast · written {data.meta.written} · last check-in {data.meta.lastCheckin}</div>
          <h2 className="explore-title">The numbers, the odds, and how the forecast grades itself.</h2>
        </header>
        <main>
          <section id="world">
            <div className="sec-head"><div><div className="eyebrow">World state</div><h2>Drag across any chart to stand in a different year.</h2></div></div>
            <div className="world-grid">
              <WorldState />
              <div className="clock-card"><div className="eyebrow">Doomsday Clock · forecast</div><Clock /></div>
            </div>
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
      </div>
      <footer className="foot">The Next 100 · a living forecast · <a href="https://github.com/GrimFandango42/the-next-100" target="_blank" rel="noreferrer">source and data on GitHub</a></footer>
      <EventDrawer />
    </>
  );
}
