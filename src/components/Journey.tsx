import { useEffect, useMemo, useRef, useState } from "react";
import { data } from "../data";
import { fmt, lerp, metricKF } from "../lib";
import { DOMAIN_META, type ForecastEvent } from "../schema";
import { useStore } from "../store";
import { useNarrow } from "../hooks";
import World from "./World";
import { Detail } from "./EventDrawer";

/**
 * The film. The page scrolls; time moves. Segment lengths are in viewport heights (vh) and set how long
 * each stretch of the century lasts on screen; `secs` is how long it takes when playing at 1x.
 */
type Seg = { from: number; to: number; vh: number; secs: number; kind?: "intro" | "hinge" | "outro" };
const SEGS: Seg[] = [
  { from: 2026, to: 2026, vh: 70, secs: 0, kind: "intro" },
  { from: 2026, to: 2030, vh: 150, secs: 9 },
  { from: 2030, to: 2039, vh: 260, secs: 18 },
  { from: 2039, to: 2039, vh: 110, secs: 5, kind: "hinge" },
  { from: 2039, to: 2060, vh: 230, secs: 16 },
  { from: 2060, to: 2100, vh: 190, secs: 13 },
  { from: 2100, to: 2200, vh: 150, secs: 11 },
  { from: 2200, to: 2200, vh: 110, secs: 0, kind: "outro" },
];
const TOTAL_VH = SEGS.reduce((a, s) => a + s.vh, 0) + 100;
const CORNER_HOLD = 3.2; // seconds a cornerstone stays on screen while playing

function locate(posVh: number) {
  let acc = 0;
  for (const s of SEGS) {
    if (posVh <= acc + s.vh) {
      const f = s.vh ? Math.max(0, (posVh - acc) / s.vh) : 0;
      return { year: s.from + (s.to - s.from) * f, seg: s, f };
    }
    acc += s.vh;
  }
  const s = SEGS[SEGS.length - 1];
  return { year: s.to, seg: s, f: 1 };
}
function segStart(seg: Seg) { let acc = 0; for (const s of SEGS) { if (s === seg) return acc; acc += s.vh; } return acc; }
function posForYear(y: number) {
  let acc = 0;
  for (const s of SEGS) {
    if (!s.kind && y >= s.from && y <= s.to) return acc + ((y - s.from) / (s.to - s.from)) * s.vh;
    acc += s.vh;
  }
  return acc;
}

const HUD = [
  { id: "population", label: "people" },
  { id: "warming", label: "warming" },
  { id: "ai-share", label: "of work done by AI" },
  { id: "off-earth", label: "living off-Earth" },
] as const;

export default function Journey() {
  const { branch, setBranch, setYear, select, selected } = useStore();
  const narrow = useNarrow();
  const ref = useRef<HTMLElement>(null);
  const [pos, setPos] = useState(0); // vh into the film
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [modal, setModal] = useState(false);
  const playRef = useRef({ playing, speed }); playRef.current = { playing, speed };

  const vh = () => window.innerHeight / 100;
  const top = () => (ref.current ? ref.current.getBoundingClientRect().top + window.scrollY : 0);

  // scroll -> position
  useEffect(() => {
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setPos(Math.max(0, (window.scrollY - top()) / vh()))); };
    on();
    addEventListener("scroll", on, { passive: true }); addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);

  const { year: yf, seg } = locate(pos);
  const y = Math.round(yf);
  useEffect(() => { if (pos < TOTAL_VH - 100) setYear(y); }, [y]); // eslint-disable-line react-hooks/exhaustive-deps

  // play: advance the scroll position at a cinematic pace; hold on cornerstones and at the hinge
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now(), hold = 0, held = new Set<string>();
    let p = Math.max(pos, SEGS[0].vh);
    const stopOnUser = () => setPlaying(false);
    const html = document.documentElement, prevSB = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto"; // site-wide smooth scrolling would restart on every frame
    addEventListener("wheel", stopOnUser, { passive: true }); addEventListener("touchstart", stopOnUser, { passive: true }); addEventListener("keydown", stopOnUser);
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000) * playRef.current.speed; last = now;
      if (hold > 0) hold -= dt;
      else {
        const { seg: s, year: yy } = locate(p);
        if (s.kind === "outro" || p >= TOTAL_VH - 100) { setPlaying(false); return; }
        const rate = s.secs ? s.vh / s.secs : 200;
        p += rate * dt;
        const c = data.events.find((e) => e.cornerstone && !held.has(e.id) && (!e.branch || e.branch === branch) && Math.abs(e.year - yy) < 0.35);
        if (c) { held.add(c.id); hold = CORNER_HOLD; }
      }
      window.scrollTo({ top: top() + p * vh(), behavior: "auto" });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { html.style.scrollBehavior = prevSB; cancelAnimationFrame(raf); removeEventListener("wheel", stopOnUser); removeEventListener("touchstart", stopOnUser); removeEventListener("keydown", stopOnUser); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const events = useMemo(() => data.events.filter((e) => !e.branch || e.branch === branch), [branch]);
  const moment = events.find((e) => e.cornerstone && Math.abs(e.year - yf) < 0.9 && seg.kind !== "hinge");
  const recent = events.filter((e) => !e.cornerstone && e.year <= yf + 0.2 && e.year > yf - 3.2).sort((a, b) => b.year - a.year).slice(0, narrow ? 2 : 3);
  const era = data.eras.find((e) => yf >= e.from && yf < e.to) ?? data.eras[data.eras.length - 1];
  const eraFresh = !moment && seg.kind !== "hinge" && seg.kind !== "intro" && Math.abs(yf - era.from) < (era.to - era.from) * 0.12;
  const introOpacity = Math.max(0, 1 - pos / (SEGS[0].vh * 0.8));
  const outro = seg.kind === "outro" || pos >= TOTAL_VH - 120;

  const open = (e: ForecastEvent) => { select(e.id); if (!narrow) setModal(true); setPlaying(false); };
  const jump = (vhPos: number) => window.scrollTo({ top: top() + vhPos * vh(), behavior: "smooth" });

  return (
    <section className="journey" ref={ref} style={{ height: TOTAL_VH + "vh" }} aria-label="The Next 100, as a film you scroll through">
      <div className="stage">
        <World year={yf} branch={branch} className="stage-world" />

        <header className="stage-top">
          <span className="brand">The Next <span>100</span></span>
          <a href="#explore" className="stage-explore">Explore the forecast ↓</a>
        </header>

        {/* intro */}
        <div className="intro" style={{ opacity: introOpacity, pointerEvents: introOpacity > 0.3 ? "auto" : "none" }}>
          <div className="eyebrow">A living forecast · written {data.meta.written} · checked weekly</div>
          <h1>What happens to us, <em>year by year</em>, from here to 2200.</h1>
          <p>{data.events.length} predictions across seven domains. The planet is drawn from the forecast itself: watch it change as you scroll.</p>
          <div className="intro-cta">
            <button className="primary big" onClick={() => setPlaying(true)}>▶ Play the century <small>about 90 seconds</small></button>
            <span className="scroll-hint">or scroll ↓</span>
          </div>
        </div>

        {/* year + HUD */}
        <div className="stage-year" style={{ opacity: 1 - introOpacity }}>
          <div className="yr">{y}</div>
          <div className="era-name">{era.name}</div>
          <dl className="hud-big">
            {HUD.map((h) => {
              const m = data.metrics.find((x) => x.id === h.id)!;
              const v = fmt(m, lerp(metricKF(m, branch), yf));
              return <div key={h.id} className={"hud-" + h.id}><dt className="mono">{v.value}<small>{v.unit}</small></dt><dd>{h.label}</dd></div>;
            })}
            <div className="hud-clock"><dt className="mono">{Math.round(lerp(data.clock.byBranch[branch] as [number, number][], yf))}<small>s</small></dt><dd>to midnight</dd></div>
          </dl>
        </div>

        <ul className="legend" style={{ opacity: moment || seg.kind === "hinge" || outro || eraFresh ? 0 : 1 - introOpacity }} aria-label="How to read the planet">
          <li><i className="lg-city" />each light ≈ 15 million people</li>
          <li><i className="lg-glow" />glow = warming</li>
          <li><i className="lg-web" />web = AI's share of the work</li>
          <li><i className="lg-arc" />red arc = Doomsday Clock</li>
        </ul>

        {/* era title */}
        {eraFresh && <div className="era-title" key={era.id}><span className="mono">{era.from}–{era.to}</span><h2>{era.name}</h2><p>{era.thesis}</p></div>}

        {/* cornerstone moment */}
        {moment && (
          <div className="moment" key={moment.id} style={{ ["--d" as any]: DOMAIN_META[moment.domain].color }}>
            <div className="moment-kicker"><span className="dot" />{moment.year}{moment.yearEnd ? `–${moment.yearEnd}` : ""} · cornerstone · {Math.round((moment.probability ?? 0) * 100)}% likely</div>
            <h2>{moment.title}</h2>
            <p>{moment.summary}</p>
            <button className="ghost" onClick={() => open(moment)}>Read the reasoning →</button>
          </div>
        )}

        {/* the hinge */}
        {seg.kind === "hinge" && (
          <div className="hinge-moment">
            <div className="moment-kicker"><span className="dot" />2039 · the hinge</div>
            <h2>Here the future forks.</h2>
            <p>Does capability stay spread across many hands, or does one actor pull away for good? Choose, and watch the planet's web change.</p>
            <div className="fork">
              <button className={branch === "pluralism" ? "on" : ""} onClick={() => setBranch("pluralism")}>
                <b>Pluralism</b><span>{Math.round(data.meta.hinge.pluralismProbability * 100)}% likely</span><small>{data.meta.hinge.pluralism}</small>
              </button>
              <button className={branch === "concentration" ? "on conc" : "conc"} onClick={() => setBranch("concentration")}>
                <b>Concentration</b><span>{Math.round((1 - data.meta.hinge.pluralismProbability) * 100)}% likely</span><small>{data.meta.hinge.concentration}</small>
              </button>
            </div>
          </div>
        )}

        {/* event cards */}
        {!moment && seg.kind !== "hinge" && !outro && (
          <ol className="cards">
            {recent.map((e) => (
              <li key={e.id} style={{ ["--d" as any]: DOMAIN_META[e.domain].color }}>
                <button onClick={() => open(e)}>
                  <span className="card-k"><span className="dot" />{e.year} · {DOMAIN_META[e.domain].name}</span>
                  <span className="card-t">{e.title}</span>
                  <span className="card-p mono">{Math.round((e.probability ?? 0) * 100)}%</span>
                </button>
              </li>
            ))}
          </ol>
        )}

        {/* ending */}
        {outro && (
          <div className="outro">
            <div className="moment-kicker"><span className="dot" />2200 · {branch === "pluralism" ? "if pluralism won" : "if concentration won"}</div>
            <h2>Does humanity make it?</h2>
            <div className="outro-bars">
              {data.scenarios.map((s) => (
                <div key={s.id} className={"ob " + s.tone}><span className="ob-n mono">{s.byBranch[branch]}%</span><span className="ob-bar"><i style={{ width: s.byBranch[branch] + "%" }} /></span><span className="ob-l">{s.label}</span></div>
              ))}
            </div>
            <div className="intro-cta"><a className="btn primary" href="#explore">Explore all {data.events.length} predictions ↓</a><button className="ghost" onClick={() => { setBranch(branch === "pluralism" ? "concentration" : "pluralism"); }}>See the other branch</button></div>
          </div>
        )}

        {/* progress rail */}
        <nav className="rail" aria-label="Jump through the century">
          {data.eras.map((er) => {
            const a = posForYear(er.from + 0.01), b = posForYear(er.to - 0.01);
            const fill = Math.max(0, Math.min(1, (pos - a) / (b - a)));
            return (
              <button key={er.id} className={yf >= er.from && yf < er.to ? "on" : ""} onClick={() => jump(a + 1)} style={{ flexGrow: b - a }}>
                <span className="rail-fill" style={{ ["--f" as any]: fill }} />
                <span className="rail-l">{er.from}</span>
              </button>
            );
          })}
        </nav>

        <div className="stage-ctl">
          <button className="icon primary" aria-label={playing ? "Pause" : "Play the century"} onClick={() => { if (!playing && outro) jump(SEGS[0].vh); setPlaying(!playing); }}>{playing ? "❚❚" : "▶"}</button>
          <button className="speed" aria-label="Playback speed" onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 0.5 : 1)}>{speed}×</button>
        </div>
      </div>

      {modal && selected && (
        <div className="sheet-wrap modal" onClick={(ev) => { if (ev.target === ev.currentTarget) { setModal(false); select(null); } }}>
          <div className="sheet" role="dialog" aria-modal="true">
            <button className="x modal-x" aria-label="Close" onClick={() => { setModal(false); select(null); }}>×</button>
            <Detail />
          </div>
        </div>
      )}
    </section>
  );
}

export { segStart };
