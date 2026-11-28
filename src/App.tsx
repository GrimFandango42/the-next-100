import { lazy, Suspense, useEffect, useLayoutEffect, useRef, type MouseEvent } from "react";
import RevisionDigest from "./components/RevisionDigest";
import { data } from "./data";
import Journey from "./components/StoryJourney";
import { BranchChoice } from "./components/StoryJourney";
import EventDrawer from "./components/EventDrawer";
import TopBar from "./components/TopBar";
import ThisWeek from "./components/ThisWeek";
import OddsView from "./components/OddsView";
import Clock from "./components/Clock";
import { Changelog, Indicators, MarketGap, Method, Scorecard, TrackRecord } from "./components/Sections";
import { VIEW_LABEL, type View } from "./route";
import { useStore } from "./store";
const WorldState = lazy(() => import("./components/WorldState"));

const HEADING: Record<View, string> = { week: "week-title", odds: "odds-title", book: "guide-title" };

/** Book pages and evidence sections, in document order: the places the book's reading position is kept against. */
const BOOK_MARKS = ".view-book [data-story-stop], .view-book #explore, .view-book #explore section[id]";
interface Mark { id: string; top: number }

/** The last mark whose top is above the middle of the screen, and where its top sits. Null while the book is hidden. */
function bookMark(): Mark | null {
  const book = document.querySelector<HTMLElement>(".view-book");
  if (!book || book.hidden) return null;
  const mid = innerHeight / 2;
  let best: Mark | null = null;
  for (const el of document.querySelectorAll<HTMLElement>(BOOK_MARKS)) {
    const top = el.getBoundingClientRect().top;
    if (top > mid) break;
    if (el.id) best = { id: el.id, top };
  }
  return best;
}

/** Puts the mark's top back where it was. Returns false when the mark is gone. */
function restoreMark(m: Mark): boolean {
  const el = document.getElementById(m.id);
  if (!el) return false;
  scrollTo({ top: scrollY + el.getBoundingClientRect().top - m.top, behavior: "instant" as ScrollBehavior });
  return true;
}

/**
 * Keeps each view's place, so moving between This week, Odds and the book returns the reader to where they were. The book's
 * place is kept as the page in the middle of the screen, not a pixel offset: hiding and showing the book can change the
 * height of what sits above, and a raw scrollY would then land on the page before. A link to a place in the book
 * (#story-…, #chapter-…) scrolls there instead.
 */
function useViewScroll(view: View, anchor: string | undefined) {
  const saved = useRef<Record<View, number>>({ week: 0, odds: 0, book: 0 });
  const mark = useRef<Mark | null>(null);
  const shown = useRef<View | null>(null);
  useEffect(() => {
    try { history.scrollRestoration = "manual"; } catch { /* older browsers */ }
    let frame = 0;
    const on = () => {
      const v = shown.current;
      if (!v || document.querySelector<HTMLElement>(`.view-${v}`)?.hidden) return;
      saved.current[v] = scrollY;
      if (v === "book" && !frame) frame = requestAnimationFrame(() => { frame = 0; if (shown.current === "book") mark.current = bookMark() ?? mark.current; });
    };
    addEventListener("scroll", on, { passive: true });
    return () => { removeEventListener("scroll", on); cancelAnimationFrame(frame); };
  }, []);
  useLayoutEffect(() => {
    const first = shown.current === null;
    const changed = !first && shown.current !== view;
    shown.current = view;
    document.title = view === "book" ? data.meta.title : `${VIEW_LABEL[view]} · ${data.meta.title}`;
    if (anchor && (first || changed)) { requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "instant" as ScrollBehavior })); }
    else if (changed && view === "book" && mark.current) {
      const m = mark.current;
      restoreMark(m);
      // Figures and the reader strip settle a frame later; put the page back once more after they do.
      requestAnimationFrame(() => requestAnimationFrame(() => { if (shown.current === "book") restoreMark(m); }));
    }
    else if (changed) scrollTo({ top: saved.current[view], behavior: "instant" as ScrollBehavior });
    // Moving to This week or Odds puts focus on its heading, so a screen reader announces the new view.
    if (changed && view !== "book") document.getElementById(HEADING[view])?.focus({ preventScroll: true });
  }, [view, anchor]);
}

/** Three views under one bar: This week, Odds, and the book (with the evidence below it). One drawer per line serves all three. */
export default function App() {
  const { route } = useStore();
  useViewScroll(route.view, route.anchor);
  const skip = (ev: MouseEvent<HTMLAnchorElement>) => {
    ev.preventDefault();
    const target = route.view === "book" ? document.getElementById("explore") : document.getElementById(HEADING[route.view]);
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus();
    target.scrollIntoView({ block: "start" });
  };
  return (
    <>
      <a className="skip" href={`#${route.view}`} onClick={skip}>{route.view === "book" ? "Skip to the evidence" : "Skip to content"}</a>
      <TopBar />
      <div className="view view-week" hidden={route.view !== "week"}><ThisWeek /></div>
      <div className="view view-odds" hidden={route.view !== "odds"}><OddsView /></div>
      <div className="view view-book" hidden={route.view !== "book"}>
        <Journey visible={route.view === "book"} />
        <div id="explore" className="explore">
          <header className="explore-head">
            <div className="eyebrow">Behind the forecast · written {data.meta.written} · last check-in {data.meta.lastCheckin}</div>
            <h2 className="explore-title">The numbers, the odds, and how the forecast grades itself.</h2>
          </header>
          <main>
            <RevisionDigest />
            <div className="evidence-scenario"><p>Compare the two futures. Your choice updates the charts and outcome estimates.</p><BranchChoice compact /></div>
            <section id="world">
              <div className="sec-head"><div><div className="eyebrow">World state</div><h2>Drag across any chart to stand in a different year.</h2></div></div>
              <div className="world-grid">
                <Suspense fallback={<p className="note">Loading the evidence charts…</p>}><WorldState /></Suspense>
                <details className="risk-detail"><summary>Explore the Doomsday Clock forecast</summary><div className="clock-card"><div className="eyebrow">Doomsday Clock · forecast</div><Clock /></div></details>
              </div>
            </section>
            <section id="outcomes">
              <div className="sec-head"><div><div className="eyebrow">Outcomes</div><h2>Does humanity make it?</h2></div></div>
              <BranchChoice compact />
              <Scorecard />
              <div className="sec-head" style={{ marginTop: 32 }}><div><div className="eyebrow">Against the markets</div><h2>Where the forecast and the betting markets disagree.</h2></div></div>
              <MarketGap />
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
      </div>
      <footer className="foot">The Next 100 · a living forecast · <a href="https://github.com/GrimFandango42/the-next-100" target="_blank" rel="noreferrer">source and data on GitHub</a></footer>
      <EventDrawer />
    </>
  );
}
