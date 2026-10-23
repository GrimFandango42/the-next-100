import { useEffect, useMemo, useRef, useState } from "react";
import { data } from "../data";
import { fmt, lerp, metricKF } from "../lib";
import { DOMAIN_META, type Branch, type Domain, type ForecastEvent, type Hero } from "../schema";
import { useStore } from "../store";
import { useNarrow } from "../hooks";
import World, { type Effect } from "./World";
import { Detail } from "./EventDrawer";

/** One beat = one moment. Every beat gets the same scroll distance; the page settles on each. */
type Era = (typeof data.eras)[number];
type Beat =
  | { kind: "intro"; year: number }
  | { kind: "era"; year: number; era: Era; n: number }
  | { kind: "event"; year: number; ev: ForecastEvent }
  | { kind: "hinge"; year: number; ev: ForecastEvent }
  | { kind: "outro"; year: number };

const BEAT_VH = 70;
const DWELL = { intro: 2.5, era: 4, event: 5, cornerstone: 7.5, hinge: 9, outro: 0 };
const GLIDE = 1.3;
const DOMAIN_STAT: Record<Domain, string> = { ai: "ai-share", bio: "lifespan", energy: "work-hours", climate: "warming", space: "off-earth", society: "population", risk: "clock" };
const STAT_LABEL: Record<string, string> = { population: "people", lifespan: "yrs life expectancy", "ai-share": "of work by AI", "work-hours": "paid hours a week", warming: "warming", "off-earth": "off-Earth", "frontier-actors": "at the frontier", clock: "to midnight" };

function buildBeats(branch: string): Beat[] {
  const evs = data.events.filter((e) => !e.branch || e.branch === branch).sort((a, b) => a.year - b.year || Number(b.cornerstone) - Number(a.cornerstone));
  const out: Beat[] = [{ kind: "intro", year: 2026 }];
  data.eras.forEach((era, i) => {
    out.push({ kind: "era", year: era.from, era, n: i + 1 });
    const last = i === data.eras.length - 1;
    for (const ev of evs.filter((e) => e.year >= era.from && (e.year < era.to || (last && e.year <= era.to)))) out.push(ev.id === "hinge-resolves" ? { kind: "hinge", year: ev.year, ev } : { kind: "event", year: ev.year, ev });
  });
  out.push({ kind: "outro", year: 2200 });
  return out;
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function statValue(id: string, branch: Branch, y: number): { value: string; unit: string } {
  if (id === "clock") return { value: String(Math.round(lerp(data.clock.byBranch[branch] as [number, number][], y))), unit: "s" };
  const m = data.metrics.find((x) => x.id === id)!;
  return fmt(m, lerp(metricKF(m, branch), y));
}

export default function Journey() {
  const { branch, setBranch, setYear, select, selected } = useStore();
  const narrow = useNarrow();
  const ref = useRef<HTMLElement>(null);
  const beats = useMemo(() => buildBeats(branch), [branch]);
  const [bf, setBf] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [modal, setModal] = useState(false);
  const [chosen, setChosen] = useState<Branch | null>(null); // the fork, once picked this visit
  const speedRef = useRef(speed); speedRef.current = speed;

  const vh = () => window.innerHeight / 100;
  const top = () => (ref.current ? ref.current.getBoundingClientRect().top + window.scrollY : 0);
  const beatTop = (i: number) => top() + i * BEAT_VH * vh();
  const totalVh = (beats.length - 1) * BEAT_VH + 130;

  useEffect(() => {
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setBf(Math.max(0, (window.scrollY - top()) / (BEAT_VH * vh())))); };
    on(); addEventListener("scroll", on, { passive: true }); addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);

  const i0 = Math.min(beats.length - 1, Math.floor(bf)), i1 = Math.min(beats.length - 1, i0 + 1);
  const frac = Math.min(1, bf - i0);
  const yf = beats[i0].year + (beats[i1].year - beats[i0].year) * ease(Math.max(0, Math.min(1, (frac - 0.35) / 0.65)));
  const ai = Math.min(beats.length - 1, Math.round(bf));
  const beat = beats[ai];
  const y = Math.round(yf);
  useEffect(() => { if (bf <= beats.length - 1 + 0.3) setYear(y); }, [y]); // eslint-disable-line react-hooks/exhaustive-deps

  // autoplay: dwell, then glide
  useEffect(() => {
    if (!playing) return;
    const html = document.documentElement; const prev = { sb: html.style.scrollBehavior, snap: html.style.scrollSnapType };
    html.style.scrollBehavior = "auto"; html.style.scrollSnapType = "none";
    let raf = 0, cancelled = false, timer = 0;
    let idx = Math.max(0, Math.round((window.scrollY - top()) / (BEAT_VH * vh())));
    const stop = () => setPlaying(false);
    addEventListener("wheel", stop, { passive: true }); addEventListener("touchstart", stop, { passive: true }); addEventListener("keydown", stop);
    const dwellFor = (b: Beat) => (b.kind === "event" ? (b.ev.cornerstone ? DWELL.cornerstone : DWELL.event) : DWELL[b.kind]);
    const glideTo = (to: number, done: () => void) => {
      const from = window.scrollY, target = beatTop(to), t0 = performance.now(), dur = (GLIDE * 1000) / speedRef.current;
      const step = (now: number) => { if (cancelled) return; const t = Math.min(1, (now - t0) / dur); window.scrollTo(0, from + (target - from) * ease(t)); if (t < 1) raf = requestAnimationFrame(step); else done(); };
      raf = requestAnimationFrame(step);
    };
    const next = () => { if (cancelled) return; if (idx >= beats.length - 1) { setPlaying(false); return; } idx += 1; glideTo(idx, () => { timer = window.setTimeout(next, (dwellFor(beats[idx]) * 1000) / speedRef.current); }); };
    if (idx === 0) next(); else glideTo(idx, () => { timer = window.setTimeout(next, (dwellFor(beats[idx]) * 1000) / speedRef.current); });
    return () => { cancelled = true; cancelAnimationFrame(raf); clearTimeout(timer); html.style.scrollBehavior = prev.sb; html.style.scrollSnapType = prev.snap; removeEventListener("wheel", stop); removeEventListener("touchstart", stop); removeEventListener("keydown", stop); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const era = data.eras.find((e) => yf >= e.from && yf < e.to) ?? data.eras[data.eras.length - 1];
  const dist = Math.abs(bf - ai);
  const near = dist < 0.36;
  const contentOpacity = near ? 1 : Math.max(0, 1 - (dist - 0.36) / 0.12);
  const introOpacity = Math.max(0, 1 - bf / 0.6);
  const open = (e: ForecastEvent) => { select(e.id); if (!narrow) setModal(true); setPlaying(false); };
  const jump = (i: number) => window.scrollTo({ top: beatTop(i), behavior: "smooth" });

  // what the planet does, what the one stat is
  const hero: Hero | null = beat.kind === "event" || beat.kind === "hinge" ? beat.ev.hero ?? null : null;
  const effect: Effect = beat.kind === "era" || beat.kind === "intro" ? "none" : beat.kind === "outro" ? "bloom" : hero?.effect ?? "none";
  const statId = beat.kind === "event" || beat.kind === "hinge" ? hero?.metric ?? DOMAIN_STAT[beat.ev.domain] : "population";
  const stat = statValue(statId, branch, yf);
  const isHinge = beat.kind === "hinge" && near;
  const planetDim = beat.kind === "era" && near ? 1 : 0;

  return (
    <section className="journey" ref={ref} style={{ height: totalVh + "vh" }} aria-label="The Next 100, as a film you scroll through">
      {beats.map((_, i) => <div key={i} className="snap" style={{ top: i * BEAT_VH + "vh" }} aria-hidden="true" />)}

      <div className={"stage" + (isHinge ? " at-hinge" : "") + (beat.kind === "outro" ? " at-outro" : "")} data-era={era.id}>
        <World year={yf} branch={branch} effect={isHinge ? "none" : effect} dim={isHinge ? 1 : planetDim} className="stage-world" />

        {/* the fork: two planets, pick one */}
        {beat.kind === "hinge" && (
          <div className={"fork-stage" + (chosen ? " chosen-" + chosen : "")} style={{ opacity: contentOpacity }}>
            {(["pluralism", "concentration"] as Branch[]).map((b) => (
              <button key={b} className={"fork-side " + b + (branch === b ? " on" : "")} onClick={() => { setBranch(b); setChosen(b); }} aria-pressed={branch === b}>
                <World year={2046} branch={b} forceBranch={b} effect={b === "pluralism" ? "web" : "hub"} layout={{ cx: 0.5, cy: narrow ? 0.42 : 0.46, r: narrow ? 0.34 : 0.26 }} className="fork-world" />
                <span className="fork-label">
                  <b>{b === "pluralism" ? "Pluralism" : "Concentration"}</b>
                  <span>{Math.round((b === "pluralism" ? data.meta.hinge.pluralismProbability : 1 - data.meta.hinge.pluralismProbability) * 100)}% likely</span>
                  <small>{b === "pluralism" ? "Many hands. A mesh." : "One actor. A hub."}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        <header className="stage-top">
          <span className="brand">The Next <span>100</span></span>
          <a href="#explore" className="stage-explore">Explore the forecast ↓</a>
        </header>

        {/* intro */}
        <div className="intro" style={{ opacity: introOpacity, pointerEvents: introOpacity > 0.3 ? "auto" : "none" }}>
          <div className="eyebrow">A living forecast · written {data.meta.written} · checked weekly</div>
          <h1>What happens to us, <em>year by year</em>, from here to 2200.</h1>
          <p>{data.events.length} predictions, one at a time. The planet is drawn from the forecast, so it changes as you go.</p>
          <div className="intro-cta">
            <button className="primary big" onClick={() => jump(1)}>Begin <span className="arrow">↓</span></button>
            <button className="ghost" onClick={() => setPlaying(true)}>▶ Auto-play</button>
          </div>
        </div>
        <div className="scroll-cue" style={{ opacity: introOpacity }} aria-hidden="true"><span /></div>

        {/* year · chapter · the one stat */}
        <div className="stage-year" style={{ opacity: (1 - introOpacity) * (beat.kind === "era" && near ? 0 : 1) }}>
          <div className="yr">{y}</div>
          <div className="era-name">{era.name}</div>
          {!(hero?.metric) && beat.kind !== "outro" && <div className="one-stat" key={statId}><b className="mono">{stat.value}<small>{stat.unit}</small></b><span>{STAT_LABEL[statId] ?? statId}</span></div>}
        </div>

        {/* the beat */}
        <div className={"beat" + (beat.kind === "intro" || contentOpacity < 0.5 ? " inactive" : "")} style={{ opacity: beat.kind === "intro" ? 0 : contentOpacity }} key={ai}>
          {beat.kind === "era" && (
            <div className="chapter">
              <span className="mono">Chapter {beat.n} of {data.eras.length} · {beat.era.from}–{beat.era.to}</span>
              <h2><Words text={beat.era.name} /></h2>
              <p>{beat.era.thesis}</p>
              <div className="era-gb"><span className="g">▲ {beat.era.good[0]}</span><span className="b">▼ {beat.era.bad[0]}</span></div>
            </div>
          )}
          {beat.kind === "event" && <EventBeat ev={beat.ev} branch={branch} year={yf} onOpen={() => open(beat.ev)} />}
          {beat.kind === "hinge" && (
            <div className="hinge-copy">
              <div className="moment-kicker"><span className="dot" />2039 · the hinge</div>
              <h2><Words text="Here the future forks." /></h2>
              <p>{chosen ? (branch === "pluralism" ? "Many actors stay at the frontier. Chaotic, contested, broadly free." : "One actor pulls away for good. The century's best or worst outcomes.") : "Pick a planet."}</p>
              <button className="link-btn" onClick={() => open(beat.ev)}>Read the reasoning →</button>
            </div>
          )}
          {beat.kind === "outro" && <Outro branch={branch} onFlip={() => setBranch(branch === "pluralism" ? "concentration" : "pluralism")} />}
        </div>

        {/* chapter strip */}
        <nav className="chapters" aria-label="Chapters" style={{ opacity: 1 - introOpacity * 0.7 }}>
          {data.eras.map((er, k) => {
            const a = beats.findIndex((b) => b.kind === "era" && b.era.id === er.id);
            const bEnd = k + 1 < data.eras.length ? beats.findIndex((b) => b.kind === "era" && b.era.id === data.eras[k + 1].id) : beats.length - 1;
            const fill = Math.max(0, Math.min(1, (bf - a) / (bEnd - a)));
            const on = bf >= a - 0.5 && bf < bEnd - 0.5;
            const color = (beat.kind === "event" || beat.kind === "hinge") && on ? DOMAIN_META[beat.ev.domain].color : "#f3b64a";
            return <button key={er.id} className={"ch" + (on ? " on" : "") + (fill >= 1 ? " done" : "")} style={{ ["--f" as any]: fill, ["--c" as any]: color }} onClick={() => jump(a)} aria-label={`${er.from}–${er.to} ${er.name}`}><span className="ch-l">{er.from}</span><span className="ch-bar" /></button>;
          })}
        </nav>

        <div className="stage-ctl">
          <button className="icon primary" aria-label={playing ? "Pause" : "Auto-play"} onClick={() => setPlaying(!playing)}>{playing ? "❚❚" : "▶"}</button>
          <button className="speed" aria-label="Playback speed" onClick={() => setSpeed(speed === 1 ? 1.5 : speed === 1.5 ? 0.75 : 1)}>{speed}×</button>
        </div>
        <div className="scroll-tip" style={{ opacity: ai === 1 && near && !playing ? 1 : 0 }}>Scroll for the next moment ↓</div>
      </div>

      {modal && selected && (
        <div className="sheet-wrap modal" onClick={(ev) => { if (ev.target === ev.currentTarget) { setModal(false); select(null); } }}>
          <div className="sheet" role="dialog" aria-modal="true"><button className="x modal-x" aria-label="Close" onClick={() => { setModal(false); select(null); }}>×</button><Detail /></div>
        </div>
      )}
    </section>
  );
}

function EventBeat({ ev, branch, year, onOpen }: { ev: ForecastEvent; branch: Branch; year: number; onOpen: () => void }) {
  const p = Math.round((ev.probability ?? 0) * 100);
  const color = DOMAIN_META[ev.domain].color;
  const h = ev.hero;
  let big: { num?: number; text?: string; prefix?: string; unit?: string } = { text: String(ev.year) };
  if (h?.metric) { const v = statValue(h.metric, branch, Math.max(year, ev.year)); big = { num: Number(v.value), unit: v.unit }; }
  else if (h?.num != null) big = { num: h.num, prefix: h.prefix, unit: h.unit };
  else if (h?.text) big = { text: h.text };
  return (
    <div className={"ev-beat" + (ev.cornerstone ? " corner" : "")} style={{ ["--d" as any]: color }}>
      <div className="ev-beat-head">
        <Glyph domain={ev.domain} />
        <div className="moment-kicker"><span>{ev.year}{ev.yearEnd ? `–${ev.yearEnd}` : ""}</span><span>·</span><span style={{ color }}>{DOMAIN_META[ev.domain].name}</span>{ev.cornerstone && <><span>·</span><span className="cs">cornerstone</span></>}</div>
      </div>
      <div className="hero-num" aria-live="polite">
        {big.num != null ? <><span className="pre">{big.prefix}</span><CountUp to={big.num} /><span className="unit">{big.unit}</span></> : <span className="txt">{big.text}</span>}
      </div>
      {h && <div className="hero-label">{h.label}</div>}
      <h2><Words text={ev.title} /></h2>
      <div className="ev-beat-foot">
        <Ring p={p} /><div className="ring-l"><b>{p}% likely</b><span>{ev.confidence} confidence</span></div>
        <button className="ghost" onClick={onOpen}>Why →</button>
      </div>
    </div>
  );
}

function Outro({ branch, onFlip }: { branch: Branch; onFlip: () => void }) {
  const fl = data.scenarios.find((s) => s.id === "flourish")!;
  const [showBars, setShowBars] = useState(false);
  useEffect(() => { setShowBars(false); const t = setTimeout(() => setShowBars(true), 1400); return () => clearTimeout(t); }, [branch]);
  return (
    <div className="outro">
      <div className="moment-kicker"><span className="dot" />2200 · {branch === "pluralism" ? "if pluralism won" : "if concentration won"}</div>
      <h2><Words text="Does humanity make it?" /></h2>
      <div className="hero-num big"><CountUp to={fl.byBranch[branch]!} /><span className="unit">%</span></div>
      <div className="hero-label">chance we flourish: long lives, abundance, humans still in the loop</div>
      <div className={"outro-bars" + (showBars ? " show" : "")}>
        {data.scenarios.map((s) => <div key={s.id} className={"ob " + s.tone}><span className="ob-n mono">{s.byBranch[branch]}%</span><span className="ob-bar"><i style={{ width: (showBars ? s.byBranch[branch] : 0) + "%" }} /></span><span className="ob-l">{s.label}</span></div>)}
      </div>
      <div className="intro-cta"><a className="btn primary" href="#explore">Explore all {data.events.length} predictions ↓</a><button className="ghost" onClick={onFlip}>Replay the other branch</button></div>
    </div>
  );
}

function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(to);
  const from = useRef(to); const start = useRef(0);
  useEffect(() => {
    const f = from.current; let raf = 0; start.current = performance.now();
    const tick = (now: number) => { const t = Math.min(1, (now - start.current) / 1100); const e = 1 - Math.pow(1 - t, 3); setV(f + (to - f) * e); if (t < 1) raf = requestAnimationFrame(tick); else from.current = to; };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = v; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);
  const dec = Number.isInteger(to) ? 0 : 1;
  return <span className="mono">{v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}</span>;
}

function Words({ text }: { text: string }) {
  return <>{text.split(" ").map((w, i) => <span key={i}><span className="w" style={{ animationDelay: i * 45 + "ms" }}>{w}</span>{" "}</span>)}</>;
}
function Ring({ p }: { p: number }) {
  const r = 20, c = 2 * Math.PI * r;
  return <svg className="ring" width="52" height="52" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="5" /><circle cx="26" cy="26" r={r} fill="none" stroke="var(--d)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 26 26)" className="ring-arc" /></svg>;
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
