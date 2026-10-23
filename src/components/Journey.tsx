import { useEffect, useMemo, useRef, useState } from "react";
import { data } from "../data";
import { fmt, lerp, metricKF } from "../lib";
import { DOMAIN_META, type Domain, type ForecastEvent } from "../schema";
import { useStore } from "../store";
import { useNarrow } from "../hooks";
import World from "./World";
import { Detail } from "./EventDrawer";

/**
 * The film, told in beats. One beat = one moment: the intro, an era title, an event, the fork, the ending.
 * Every beat gets the same scroll distance, so scrolling steps through the story at the reader's pace,
 * and the page settles on each beat (CSS scroll-snap, proximity). Years interpolate between beats.
 */
type Beat =
  | { kind: "intro"; year: number }
  | { kind: "era"; year: number; era: (typeof data.eras)[number] }
  | { kind: "event"; year: number; ev: ForecastEvent }
  | { kind: "hinge"; year: number; ev: ForecastEvent }
  | { kind: "outro"; year: number };

const BEAT_VH = 70;
const DWELL = { intro: 2.5, era: 3.6, event: 4.6, cornerstone: 7, hinge: 7, outro: 0 }; // seconds per beat when auto-playing
const GLIDE = 1.3; // seconds to glide between beats

function buildBeats(branch: string): Beat[] {
  const evs = data.events.filter((e) => !e.branch || e.branch === branch).sort((a, b) => a.year - b.year || Number(b.cornerstone) - Number(a.cornerstone));
  const out: Beat[] = [{ kind: "intro", year: 2026 }];
  data.eras.forEach((era, i) => {
    out.push({ kind: "era", year: era.from, era });
    const last = i === data.eras.length - 1;
    for (const ev of evs.filter((e) => e.year >= era.from && (e.year < era.to || (last && e.year <= era.to)))) {
      out.push(ev.id === "hinge-resolves" ? { kind: "hinge", year: ev.year, ev } : { kind: "event", year: ev.year, ev });
    }
  });
  out.push({ kind: "outro", year: 2200 });
  return out;
}

const HUD = [
  { id: "population", label: "people" },
  { id: "warming", label: "warming" },
  { id: "ai-share", label: "of work done by AI" },
  { id: "off-earth", label: "living off-Earth" },
] as const;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function Journey() {
  const { branch, setBranch, setYear, select, selected } = useStore();
  const narrow = useNarrow();
  const ref = useRef<HTMLElement>(null);
  const beats = useMemo(() => buildBeats(branch), [branch]);
  const [bf, setBf] = useState(0); // fractional beat index
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [modal, setModal] = useState(false);
  const speedRef = useRef(speed); speedRef.current = speed;

  const vh = () => window.innerHeight / 100;
  const top = () => (ref.current ? ref.current.getBoundingClientRect().top + window.scrollY : 0);
  const beatTop = (i: number) => top() + i * BEAT_VH * vh();
  const totalVh = (beats.length - 1) * BEAT_VH + 100;

  useEffect(() => {
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setBf(Math.max(0, (window.scrollY - top()) / (BEAT_VH * vh())))); };
    on();
    addEventListener("scroll", on, { passive: true }); addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);

  const i0 = Math.min(beats.length - 1, Math.floor(bf)), i1 = Math.min(beats.length - 1, i0 + 1);
  const frac = Math.min(1, bf - i0);
  // hold the year steady for the first part of a beat, then move: the number settles while you read
  const yf = beats[i0].year + (beats[i1].year - beats[i0].year) * ease(Math.max(0, Math.min(1, (frac - 0.35) / 0.65)));
  const ai = Math.min(beats.length - 1, Math.round(bf));
  const beat = beats[ai];
  const y = Math.round(yf);
  const inFilm = bf <= beats.length - 1 + 0.3;
  useEffect(() => { if (inFilm) setYear(y); }, [y]); // eslint-disable-line react-hooks/exhaustive-deps

  // autoplay: dwell on a beat, then glide to the next
  useEffect(() => {
    if (!playing) return;
    const html = document.documentElement;
    const prev = { sb: html.style.scrollBehavior, snap: html.style.scrollSnapType };
    html.style.scrollBehavior = "auto"; html.style.scrollSnapType = "none";
    let raf = 0, cancelled = false, timer = 0;
    let idx = Math.max(0, Math.round((window.scrollY - top()) / (BEAT_VH * vh())));
    const stop = () => setPlaying(false);
    addEventListener("wheel", stop, { passive: true }); addEventListener("touchstart", stop, { passive: true }); addEventListener("keydown", stop);
    const dwellFor = (b: Beat) => (b.kind === "event" ? (b.ev.cornerstone ? DWELL.cornerstone : DWELL.event) : DWELL[b.kind]);
    const glideTo = (to: number, done: () => void) => {
      const from = window.scrollY, target = beatTop(to), t0 = performance.now(), dur = (GLIDE * 1000) / speedRef.current;
      const step = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - t0) / dur);
        window.scrollTo(0, from + (target - from) * ease(t));
        if (t < 1) raf = requestAnimationFrame(step); else done();
      };
      raf = requestAnimationFrame(step);
    };
    const next = () => {
      if (cancelled) return;
      if (idx >= beats.length - 1) { setPlaying(false); return; }
      idx += 1;
      glideTo(idx, () => { timer = window.setTimeout(next, (dwellFor(beats[idx]) * 1000) / speedRef.current); });
    };
    if (idx === 0) next(); else glideTo(idx, () => { timer = window.setTimeout(next, (dwellFor(beats[idx]) * 1000) / speedRef.current); });
    return () => {
      cancelled = true; cancelAnimationFrame(raf); clearTimeout(timer);
      html.style.scrollBehavior = prev.sb; html.style.scrollSnapType = prev.snap;
      removeEventListener("wheel", stop); removeEventListener("touchstart", stop); removeEventListener("keydown", stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const era = data.eras.find((e) => yf >= e.from && yf < e.to) ?? data.eras[data.eras.length - 1];
  const dist = Math.abs(bf - ai);
  const contentOpacity = dist < 0.36 ? 1 : Math.max(0, 1 - (dist - 0.36) / 0.12);
  const nearBeat = dist < 0.36;
  const introOpacity = Math.max(0, 1 - bf / 0.6);
  const open = (e: ForecastEvent) => { select(e.id); if (!narrow) setModal(true); setPlaying(false); };
  const jump = (i: number) => window.scrollTo({ top: beatTop(i), behavior: "smooth" });
  const eraIdx = beats.map((b, i) => (b.kind === "era" ? i : -1)).filter((i) => i >= 0);
  const focusDomain: Domain | null = beat.kind === "event" || beat.kind === "hinge" ? beat.ev.domain : null;
  const pulse = (beat.kind === "event" && beat.ev.cornerstone) || beat.kind === "hinge";

  return (
    <section className="journey" ref={ref} style={{ height: totalVh + "vh" }} aria-label="The Next 100, as a film you scroll through">
      {beats.map((_, i) => <div key={i} className="snap" style={{ top: i * BEAT_VH + "vh" }} aria-hidden="true" />)}

      <div className="stage" data-era={era.id}>
        <World year={yf} branch={branch} focus={nearBeat ? focusDomain : null} pulse={pulse && nearBeat} className="stage-world" />

        <header className="stage-top">
          <span className="brand">The Next <span>100</span></span>
          <a href="#explore" className="stage-explore">Explore the forecast ↓</a>
        </header>

        <div className="intro" style={{ opacity: introOpacity, pointerEvents: introOpacity > 0.3 ? "auto" : "none" }}>
          <div className="eyebrow">A living forecast · written {data.meta.written} · checked weekly</div>
          <h1>What happens to us, <em>year by year</em>, from here to 2200.</h1>
          <p>{data.events.length} predictions, one at a time. The planet is drawn from the forecast itself, so it changes as you go.</p>
          <div className="intro-cta">
            <button className="primary big" onClick={() => jump(1)}>Begin <span className="arrow">↓</span></button>
            <button className="ghost" onClick={() => setPlaying(true)}>▶ Auto-play</button>
          </div>
        </div>
        <div className="scroll-cue" style={{ opacity: introOpacity }} aria-hidden="true"><span /></div>

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

        <ul className="legend" style={{ opacity: beat.kind === "era" && ai < 3 && nearBeat ? 1 : 0 }} aria-label="How to read the planet">
          <li><i className="lg-city" />each light ≈ 15 million people</li>
          <li><i className="lg-glow" />glow = warming</li>
          <li><i className="lg-web" />web = AI's share of the work</li>
          <li><i className="lg-arc" />red arc = Doomsday Clock</li>
        </ul>

        <div className={"beat" + (beat.kind === "intro" || contentOpacity < 0.5 ? " inactive" : "")} style={{ opacity: beat.kind === "intro" ? 0 : contentOpacity }} key={ai}>
          {beat.kind === "era" && (
            <div className="era-title">
              <span className="mono">Chapter {eraIdx.indexOf(ai) + 1} of {eraIdx.length} · {beat.era.from}–{beat.era.to}</span>
              <h2><Words text={beat.era.name} /></h2>
              <p>{beat.era.thesis}</p>
              <div className="era-gb"><span className="g">▲ {beat.era.good[0]}</span><span className="b">▼ {beat.era.bad[0]}</span></div>
            </div>
          )}
          {beat.kind === "event" && <EventBeat ev={beat.ev} onOpen={() => open(beat.ev)} />}
          {beat.kind === "hinge" && (
            <div className="hinge-moment">
              <div className="moment-kicker"><span className="dot" />2039 · the hinge · cornerstone</div>
              <h2><Words text="Here the future forks." /></h2>
              <p>Does capability stay spread across many hands, or does one actor pull away for good? Pick one and watch the planet's web rewire.</p>
              <div className="fork">
                <button className={branch === "pluralism" ? "on" : ""} onClick={() => setBranch("pluralism")}>
                  <b>Pluralism</b><span>{Math.round(data.meta.hinge.pluralismProbability * 100)}% likely</span><small>{data.meta.hinge.pluralism}</small>
                </button>
                <button className={branch === "concentration" ? "on conc" : "conc"} onClick={() => setBranch("concentration")}>
                  <b>Concentration</b><span>{Math.round((1 - data.meta.hinge.pluralismProbability) * 100)}% likely</span><small>{data.meta.hinge.concentration}</small>
                </button>
              </div>
              <button className="link-btn" onClick={() => open(beat.ev)}>Read the reasoning →</button>
            </div>
          )}
          {beat.kind === "outro" && (
            <div className="outro">
              <div className="moment-kicker"><span className="dot" />2200 · {branch === "pluralism" ? "if pluralism won" : "if concentration won"}</div>
              <h2><Words text="Does humanity make it?" /></h2>
              <div className="outro-bars">
                {data.scenarios.map((s) => (
                  <div key={s.id} className={"ob " + s.tone}><span className="ob-n mono">{s.byBranch[branch]}%</span><span className="ob-bar"><i style={{ width: s.byBranch[branch] + "%" }} /></span><span className="ob-l">{s.label}</span></div>
                ))}
              </div>
              <div className="intro-cta"><a className="btn primary" href="#explore">Explore all {data.events.length} predictions ↓</a><button className="ghost" onClick={() => setBranch(branch === "pluralism" ? "concentration" : "pluralism")}>See the other branch</button></div>
            </div>
          )}
        </div>

        <nav className="beats-rail" aria-label="Jump to a moment" style={{ opacity: 1 - introOpacity * 0.7 }} onClick={(e) => { if (!narrow) return; const r = e.currentTarget.getBoundingClientRect(); jump(1 + Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (beats.length - 2))); }}>
          <span className="beats-track" />
          <span className="beats-fill" style={{ ["--p" as any]: Math.min(1, bf / (beats.length - 1)) }} />
          {beats.map((b, i) => {
            if (b.kind === "intro") return null;
            const label = b.kind === "era" ? `${b.era.from} · ${b.era.name}` : b.kind === "outro" ? "2200 · Does humanity make it?" : `${b.ev.year} · ${b.ev.title}`;
            const corner = b.kind === "hinge" || (b.kind === "event" && b.ev.cornerstone);
            const color = b.kind === "event" || b.kind === "hinge" ? DOMAIN_META[b.ev.domain].color : undefined;
            return (
              <button key={i} className={"bd " + b.kind + (corner ? " cs-dot" : "") + (i === ai ? " on" : "") + (i < bf - 0.4 ? " past" : "")} style={{ ["--t" as any]: ((i - 1) / (beats.length - 2)) * 100 + "%", ["--d" as any]: color }} aria-label={label} title={label} tabIndex={narrow ? -1 : 0} onClick={(e) => { if (narrow) return; e.stopPropagation(); jump(i); }}>
                {b.kind === "era" && <span className="bd-l">{b.era.from}</span>}
              </button>
            );
          })}
        </nav>

        <div className="stage-ctl">
          <span className="beat-count mono">{String(Math.max(1, ai)).padStart(2, "0")}<i> / </i>{beats.length - 1}</span>
          <button className="icon primary" aria-label={playing ? "Pause" : "Auto-play"} onClick={() => setPlaying(!playing)}>{playing ? "❚❚" : "▶"}</button>
          <button className="speed" aria-label="Playback speed" onClick={() => setSpeed(speed === 1 ? 1.5 : speed === 1.5 ? 0.75 : 1)}>{speed}×</button>
        </div>
        <div className="scroll-tip" style={{ opacity: ai === 1 && nearBeat && !playing ? 1 : 0 }}>Scroll for the next moment ↓</div>
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

function EventBeat({ ev, onOpen }: { ev: ForecastEvent; onOpen: () => void }) {
  const p = Math.round((ev.probability ?? 0) * 100);
  const color = DOMAIN_META[ev.domain].color;
  return (
    <div className={"ev-beat" + (ev.cornerstone ? " corner" : "")} style={{ ["--d" as any]: color }}>
      <div className="ev-beat-head">
        <Glyph domain={ev.domain} />
        <div className="moment-kicker"><span>{ev.year}{ev.yearEnd ? `–${ev.yearEnd}` : ""}</span><span>·</span><span style={{ color }}>{DOMAIN_META[ev.domain].name}</span>{ev.cornerstone && <><span>·</span><span className="cs">cornerstone</span></>}</div>
      </div>
      <h2><Words text={ev.title} /></h2>
      <p>{ev.summary}</p>
      <div className="ev-beat-foot">
        <Ring p={p} />
        <div className="ring-l"><b>{p}% likely</b><span>{ev.confidence} confidence</span></div>
        <button className="ghost" onClick={onOpen}>Read the reasoning →</button>
      </div>
    </div>
  );
}

function Words({ text }: { text: string }) {
  return <>{text.split(" ").map((w, i) => <span key={i}><span className="w" style={{ animationDelay: i * 45 + "ms" }}>{w}</span>{" "}</span>)}</>;
}

function Ring({ p }: { p: number }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <svg className="ring" width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="5" />
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--d)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 26 26)" className="ring-arc" />
    </svg>
  );
}

const GLYPHS: Record<Domain, JSX.Element> = {
  ai: <><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
  bio: <path d="M7 3c0 6 10 6 10 12s-10 3-10 6M17 3c0 6-10 6-10 12M9 7h6M8 12h8M9 17h6" />,
  energy: <path d="M13 2 5 13h6l-1 9 8-11h-6z" />,
  climate: <><path d="M12 3a2 2 0 0 0-2 2v9a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2z" /><path d="M12 10v6" /></>,
  space: <><circle cx="12" cy="12" r="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-25 12 12)" /></>,
  society: <><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><path d="M3 20c0-4 3-6 5-6s5 2 5 6M11 20c0-4 3-6 5-6s5 2 5 6" /></>,
  risk: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17v.5" /></>,
};
function Glyph({ domain }: { domain: Domain }) {
  return <span className="glyph"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{GLYPHS[domain]}</svg></span>;
}
