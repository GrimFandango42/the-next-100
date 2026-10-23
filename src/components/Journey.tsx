import { useEffect, useMemo, useRef, useState } from "react";
import { data } from "../data";
import { fmt, lerp, metricKF } from "../lib";
import { DOMAIN_META, type Branch, type Domain, type ForecastEvent, type Hero } from "../schema";
import { useStore } from "../store";
import { useNarrow } from "../hooks";
import World, { type Effect } from "./World";

/**
 * One way to move: scroll always moves through time. Zoom changes how much of time you see.
 *   0 · Century — the whole forecast on one screen, a cursor rides the spine as you scroll
 *   1 · Decade  — a window of years slides past a fixed cursor, every prediction labelled
 *   2 · Moment  — one prediction per screen, full detail
 * Pinch, Ctrl/⌘ + scroll, the − / + pill, or the − and + keys change the zoom. Tapping a prediction dives into it.
 */
type Era = (typeof data.eras)[number];
type Beat =
  | { kind: "intro"; year: number }
  | { kind: "era"; year: number; era: Era; n: number }
  | { kind: "event"; year: number; ev: ForecastEvent }
  | { kind: "hinge"; year: number; ev: ForecastEvent }
  | { kind: "outro"; year: number };
type Zoom = 0 | 1 | 2;
const ZOOM_NAME = ["Century", "Decade", "Moment"] as const;

const BEAT_VH = 70;
const DOMAIN_STAT: Record<Domain, string> = { ai: "ai-share", bio: "lifespan", energy: "work-hours", climate: "warming", space: "off-earth", society: "population", risk: "clock" };
const clampZ = (z: number) => Math.max(0, Math.min(2, z)) as Zoom;
const hasEv = (b: Beat): b is Extract<Beat, { ev: ForecastEvent }> => b.kind === "event" || b.kind === "hinge";

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
  const { branch, setBranch, setYear, select } = useStore();
  const narrow = useNarrow();
  const ref = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const beats = useMemo(() => buildBeats(branch), [branch]);
  const [bf, setBf] = useState(0);
  const [zoom, setZoom] = useState<Zoom>(2);
  const [chosen, setChosen] = useState<Branch | null>(null);
  const [size, setSize] = useState({ W: window.innerWidth, H: window.innerHeight });

  const vh = () => window.innerHeight / 100;
  const top = () => (ref.current ? ref.current.getBoundingClientRect().top + window.scrollY : 0);
  const beatTop = (f: number) => top() + f * BEAT_VH * vh();
  const toBeat = (f: number, smooth = false) => window.scrollTo({ top: beatTop(f), behavior: (smooth ? "smooth" : "instant") as ScrollBehavior });
  const totalVh = (beats.length - 1) * BEAT_VH + 130;

  // scroll → position in the story
  useEffect(() => {
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setBf(Math.max(0, (window.scrollY - top()) / (BEAT_VH * vh())))); };
    on(); addEventListener("scroll", on, { passive: true }); addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => {
    const el = stageRef.current!;
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // deep link: #m-<event-id>
  useEffect(() => {
    const h = location.hash;
    if (!h.startsWith("#m-")) return;
    const i = beats.findIndex((b) => hasEv(b) && b.ev.id === h.slice(3));
    if (i > 0) requestAnimationFrame(() => toBeat(i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // zoom gestures: pinch, Ctrl/⌘ + wheel, − / + keys
  const zoomBy = useRef((_d: number) => {});
  zoomBy.current = (d: number) => {
    const next = clampZ(zoom + d);
    if (next === zoom) return;
    setZoom(next);
    if (next === 2) requestAnimationFrame(() => toBeat(Math.round((window.scrollY - top()) / (BEAT_VH * vh())), true));
  };
  useEffect(() => {
    const el = stageRef.current!;
    let acc = 0, last = 0, d0 = 0;
    const step = (d: number) => { const now = performance.now(); if (now - last < 450) return false; last = now; zoomBy.current(d); return true; };
    const wheel = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); acc += e.deltaY; if (Math.abs(acc) > 24) { step(acc > 0 ? -1 : 1); acc = 0; } };
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const ts = (e: TouchEvent) => { d0 = e.touches.length === 2 ? dist(e.touches) : 0; };
    const tm = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !d0) return;
      e.preventDefault();
      const r = dist(e.touches) / d0;
      if ((r < 0.8 || r > 1.25) && step(r > 1 ? 1 : -1)) d0 = dist(e.touches);
    };
    const te = (e: TouchEvent) => { if (e.touches.length < 2) d0 = 0; };
    const gesture = (e: Event) => e.preventDefault(); // iOS: keep the page itself from pinch-zooming
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      const r = ref.current!.getBoundingClientRect();
      if (r.bottom < innerHeight * 0.5) return; // only while the film is on screen
      if (e.key === "-" || e.key === "_") zoomBy.current(-1);
      else if (e.key === "+" || e.key === "=") zoomBy.current(1);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("touchstart", ts, { passive: true }); el.addEventListener("touchmove", tm, { passive: false }); el.addEventListener("touchend", te);
    el.addEventListener("gesturestart", gesture); el.addEventListener("gesturechange", gesture);
    addEventListener("keydown", key);
    return () => {
      el.removeEventListener("wheel", wheel); el.removeEventListener("touchstart", ts); el.removeEventListener("touchmove", tm); el.removeEventListener("touchend", te);
      el.removeEventListener("gesturestart", gesture); el.removeEventListener("gesturechange", gesture); removeEventListener("keydown", key);
    };
  }, []);
  // free scrolling when zoomed all the way out; snap to moments otherwise
  useEffect(() => { document.documentElement.classList.toggle("no-snap", zoom === 0); }, [zoom]);

  const n = beats.length;
  const i0 = Math.min(n - 1, Math.floor(bf)), i1 = Math.min(n - 1, i0 + 1);
  const frac = Math.min(1, bf - i0);
  const yf = beats[i0].year + (beats[i1].year - beats[i0].year) * ease(Math.max(0, Math.min(1, (frac - 0.35) / 0.65)));
  const ai = Math.min(n - 1, Math.round(bf));
  const beat = beats[ai];
  const y = Math.round(yf);
  useEffect(() => { if (bf <= n - 1 + 0.3) setYear(y); }, [y]); // eslint-disable-line react-hooks/exhaustive-deps

  const era = data.eras.find((e) => yf >= e.from && yf < e.to) ?? data.eras[data.eras.length - 1];
  const dist = Math.abs(bf - ai);
  const near = dist < 0.36;
  const contentOpacity = near ? 1 : Math.max(0, 1 - (dist - 0.36) / 0.12);
  const introOpacity = Math.max(0, 1 - bf / 0.6);
  const open = (e: ForecastEvent) => select(e.id);
  const pick = (e: ForecastEvent) => {
    const i = beats.findIndex((b) => hasEv(b) && b.ev.id === e.id);
    setZoom(2);
    if (i >= 0) toBeat(i);
  };

  const hero: Hero | null = hasEv(beat) ? beat.ev.hero ?? null : null;
  const isMoment = zoom === 2;
  const effect: Effect = !isMoment || beat.kind === "era" || beat.kind === "intro" ? "none" : beat.kind === "outro" ? "bloom" : hero?.effect ?? "none";
  const isHinge = isMoment && beat.kind === "hinge" && near;
  const planetDim = !isMoment ? (narrow ? 0.62 : 0.15) : beat.kind === "era" && near ? 1 : 0;
  const layout = !isMoment && !narrow ? { cx: 0.8, cy: 0.52, r: Math.min(0.2 * size.W, 0.27 * size.H) / Math.min(size.W, size.H) } : undefined;
  const drift = (ai - bf) * (narrow ? 60 : 90);

  return (
    <section className="journey" ref={ref} style={{ height: totalVh + "vh" }} aria-label="The Next 100: scroll through time, pinch to zoom">
      {beats.map((_, i) => <div key={i} className="snap" style={{ top: i * BEAT_VH + "vh" }} aria-hidden="true" />)}

      <div ref={stageRef} className={"stage z" + zoom + (isHinge ? " at-hinge" : "") + (beat.kind === "outro" ? " at-outro" : "")} data-era={era.id}>
        <World year={yf} branch={branch} effect={isHinge ? "none" : effect} dim={isHinge ? 1 : planetDim} layout={layout} className="stage-world" />

        {/* ── zoomed out: the century ── */}
        <div className={"layer" + (zoom === 0 ? " on" : zoom > 0 ? " past" : "")} aria-hidden={zoom !== 0}>
          <CenturyAxis beats={beats} ai={ai} yf={yf} W={size.W} H={size.H} narrow={narrow} onPick={pick} active={zoom === 0} />
        </div>

        {/* ── mid: a decade ── */}
        <div className={"layer" + (zoom === 1 ? " on" : zoom > 1 ? " past" : " ahead")} aria-hidden={zoom !== 1}>
          <DecadeAxis beats={beats} ai={ai} yf={yf} W={size.W} H={size.H} narrow={narrow} onPick={pick} active={zoom === 1} />
        </div>

        {/* ── zoomed in: one moment ── */}
        <div className={"layer moment-layer" + (isMoment ? " on" : " ahead")} aria-hidden={!isMoment}>
          {beat.kind === "hinge" && (
            <div className={"fork-stage" + (chosen ? " chosen-" + chosen : "")} style={{ opacity: contentOpacity }}>
              {(["pluralism", "concentration"] as Branch[]).map((b) => (
                <button key={b} className={"fork-side " + b + (branch === b ? " on" : "")} onClick={() => { setBranch(b); setChosen(b); }} aria-pressed={branch === b} tabIndex={isMoment ? 0 : -1}>
                  {isMoment && <World year={2046} branch={b} forceBranch={b} effect={b === "pluralism" ? "web" : "hub"} layout={{ cx: 0.5, cy: narrow ? 0.42 : 0.46, r: narrow ? 0.34 : 0.26 }} className="fork-world" />}
                  <span className="fork-label">
                    <b>{b === "pluralism" ? "Pluralism" : "Concentration"}</b>
                    <span>{Math.round((b === "pluralism" ? data.meta.hinge.pluralismProbability : 1 - data.meta.hinge.pluralismProbability) * 100)}% likely</span>
                    <small>{b === "pluralism" ? "Many hands. A mesh." : "One actor. A hub."}</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="intro" style={{ opacity: introOpacity, pointerEvents: introOpacity > 0.3 ? "auto" : "none" }}>
            <div className="eyebrow">A living forecast · written {data.meta.written} · checked weekly</div>
            <h1>What happens to us, <em>year by year</em>, from here to 2200.</h1>
            <p>{data.events.length} predictions. The planet is drawn from the forecast, so it changes as you go.</p>
            <ul className="how" aria-label="How to move">
              <li><Kbd>{narrow ? "Swipe" : "Scroll"}</Kbd> move through time</li>
              <li><Kbd>{narrow ? "Pinch" : "−"}</Kbd> zoom out to the whole century</li>
            </ul>
          </div>
          <div className="scroll-cue" style={{ opacity: introOpacity }} aria-hidden="true"><span /></div>

          <div className="stage-year" style={{ opacity: (1 - introOpacity) * (beat.kind === "era" && near ? 0 : 1) }}>
            <div className="yr" aria-label={String(y)}>{String(y).split("").map((d, k) => <span key={k + "-" + d} className="digit">{d}</span>)}</div>
            <div className="era-name">{era.name}</div>
          </div>

          <div className={"beat" + (beat.kind === "intro" || contentOpacity < 0.5 || !isMoment ? " inactive" : "")} style={{ opacity: beat.kind === "intro" ? 0 : contentOpacity, transform: `translateY(${drift}px)` }} key={ai}>
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
                <p>{chosen ? (branch === "pluralism" ? "Many actors stay at the frontier. Chaotic, contested, broadly free." : "One actor pulls away for good. The century's best or worst outcomes.") : "Pick a planet. Everything after this follows your choice."}</p>
                <button className="link-btn" onClick={() => open(beat.ev)}>Read the reasoning →</button>
              </div>
            )}
            {beat.kind === "outro" && <Outro branch={branch} onFlip={() => setBranch(branch === "pluralism" ? "concentration" : "pluralism")} />}
          </div>
        </div>

        <header className="stage-top">
          <span className="brand">The Next <span>100</span></span>
          <div className="zoom-ctl" role="group" aria-label="Zoom">
            <button onClick={() => zoomBy.current(-1)} disabled={zoom === 0} aria-label="Zoom out">−</button>
            <span className="zoom-l" aria-live="polite">{ZOOM_NAME[zoom]}</span>
            <button onClick={() => zoomBy.current(1)} disabled={zoom === 2} aria-label="Zoom in">+</button>
          </div>
        </header>

        {zoom > 0 && <Ruler beats={beats} bf={bf} year={y} toBeat={toBeat} />}
      </div>
    </section>
  );
}

/* ───────────────────────────── century ───────────────────────────── */

const CU = (y: number) => Math.pow(Math.max(0, Math.min(1, (y - 2026) / 174)), 0.5); // early decades get more room: that's where the predictions are

function CenturyAxis({ beats, ai, yf, W, H, narrow, onPick, active }: AxisProps) {
  const t = narrow ? 96 : 110, b = H - (narrow ? 64 : 72);
  const Y = (yr: number) => t + CU(yr) * (b - t);
  const x = narrow ? 70 : Math.round(Math.min(W * 0.3, 470));
  const cy = Y(yf);
  const cur = beats[ai];
  const evs = beats.filter(hasEv).map((bt) => bt.ev);
  const sameYear = new Map<number, number>();
  const calloutH = narrow ? 92 : 96;
  const tab = active ? 0 : -1;
  const curEra = data.eras.find((e) => yf >= e.from && yf < e.to) ?? data.eras[data.eras.length - 1];
  const csLabels: { ev: ForecastEvent; top: number }[] = [];
  for (const ev of evs.filter((e) => e.cornerstone && !(hasEv(cur) && cur.ev.id === e.id))) {
    const ly = Math.max(Y(ev.year), (csLabels[csLabels.length - 1]?.top ?? -99) + 24);
    csLabels.push({ ev, top: ly });
  }
  for (let i = csLabels.length - 1; i >= 0; i--) if (Math.abs(csLabels[i].top - cy) < calloutH / 2 + 12) csLabels.splice(i, 1);

  return (
    <div className="axis century" style={{ ["--x" as any]: x + "px" }}>
      {/* the spine, one segment per era */}
      {data.eras.map((e, k) => (
        <div key={e.id} className={"cseg" + (e === curEra ? " on" : "")} style={{ top: Y(e.from) + 2, height: Math.max(2, Y(e.to) - Y(e.from) - 4) }}>
          <span className="cseg-l" style={{ opacity: Math.abs(Y(e.from) - cy) < 26 ? 0 : 1 }}>
            <b className="mono">{e.from}</b>{!narrow && <span>{e.name}</span>}
          </span>
          {k === data.eras.length - 1 && <span className="cseg-l end" style={{ top: Y(e.to) - Y(e.from) - 4 }}><b className="mono">{e.to}</b></span>}
        </div>
      ))}

      {/* every prediction is a dot; size is odds, colour is domain */}
      {evs.map((ev) => {
        const k = sameYear.get(ev.year) ?? 0; sameYear.set(ev.year, k + 1);
        const on = hasEv(cur) && cur.ev.id === ev.id;
        const d = ev.cornerstone ? 14 : 6 + 6 * (ev.probability ?? 0.5);
        return (
          <button key={ev.id} className={"dot" + (on ? " on" : "") + (ev.cornerstone ? " cs" : "")} tabIndex={tab}
            style={{ left: x + k * 13, top: Y(ev.year), width: d, height: d, ["--d" as any]: DOMAIN_META[ev.domain].color }}
            onClick={() => onPick(ev)} aria-label={`${ev.year}: ${ev.title}`} title={narrow ? undefined : `${ev.year} · ${ev.title}`} />
        );
      })}

      {/* cornerstones keep a label (stacked so they never collide), unless the cursor is sitting on them */}
      {csLabels.map(({ ev, top: ly }) => (
        <button key={ev.id} className="cs-l" tabIndex={tab} style={{ top: ly, ["--d" as any]: DOMAIN_META[ev.domain].color }} onClick={() => onPick(ev)}>
          <b className="mono">{ev.year}</b><span>{ev.title}</span>
        </button>
      ))}

      {/* the cursor: where scrolling has taken you */}
      <div className="cursor" style={{ top: cy }}>
        <span className="cur-line" />
        <span className="cur-y mono">{Math.round(yf)}</span>
      </div>
      <Callout cur={cur} yf={yf} era={curEra} top={cy} onPick={onPick} tab={tab} />

      <p className="axis-hint">{narrow ? "Swipe to move the cursor · tap a dot or pinch to zoom in" : "Scroll to move the cursor · click a dot or press + to zoom in"}</p>
    </div>
  );
}

function Callout({ cur, yf, era, top, onPick, tab }: { cur: Beat; yf: number; era: Era; top: number; onPick: (e: ForecastEvent) => void; tab: number }) {
  if (hasEv(cur)) {
    const ev = cur.ev, p = Math.round((ev.probability ?? 0) * 100);
    return (
      <button className="callout" tabIndex={tab} style={{ top, ["--d" as any]: DOMAIN_META[ev.domain].color }} onClick={() => onPick(ev)}>
        <span className="co-k"><i />{DOMAIN_META[ev.domain].name} · {p}% likely</span>
        <span className="co-t">{ev.title}</span>
      </button>
    );
  }
  const label = cur.kind === "intro" ? "Today" : cur.kind === "outro" ? "Where the century ends up" : era.name;
  return (
    <div className="callout plain" style={{ top }}>
      <span className="co-k"><i />{cur.kind === "era" ? `Chapter ${cur.n} · ${cur.era.from}–${cur.era.to}` : Math.round(yf)}</span>
      <span className="co-t">{label}</span>
    </div>
  );
}

/* ───────────────────────────── decade ───────────────────────────── */

type AxisProps = { beats: Beat[]; ai: number; yf: number; W: number; H: number; narrow: boolean; onPick: (e: ForecastEvent) => void; active: boolean };

function DecadeAxis({ beats, ai, yf, W, H, narrow, onPick, active }: AxisProps) {
  const span = narrow ? 12 : 16;
  const t = narrow ? 96 : 104, b = H - (narrow ? 40 : 48);
  const mid = (t + b) / 2, ppy = (b - t) / span;
  const Y = (yr: number) => mid + (yr - yf) * ppy;
  const x = narrow ? 70 : Math.round(Math.min(W * 0.3, 470));
  const lineH = narrow ? 46 : 44;
  const cur = beats[ai];
  const tab = active ? 0 : -1;

  // lay labels out top to bottom without overlap, then pull back up from the bottom edge
  const evs = beats.filter(hasEv).map((bt) => bt.ev).filter((ev) => Y(ev.year) > t - 60 && Y(ev.year) < b + 60);
  const pos = evs.map((ev) => Y(ev.year));
  for (let i = 1; i < pos.length; i++) pos[i] = Math.max(pos[i], pos[i - 1] + lineH);
  // keep the current one as close to the cursor as possible: centre the stack on it
  const ci = evs.findIndex((ev) => hasEv(cur) && cur.ev.id === ev.id);
  if (ci >= 0) { const shift = pos[ci] - Math.max(Y(evs[ci].year), mid - 6); for (let i = 0; i < pos.length; i++) pos[i] -= shift; }
  const fade = (p: number) => Math.max(0, Math.min(1, Math.min(p - (t - 10), b + 10 - p) / 50));

  const y0 = Math.floor(yf - span / 2) - 1, y1 = Math.ceil(yf + span / 2) + 1;
  const ticks: number[] = []; for (let k = y0; k <= y1; k++) if (k >= 2026 && k <= 2200) ticks.push(k);
  const bounds = data.eras.filter((e) => e.from > 2026 && Y(e.from) > t && Y(e.from) < b);
  const every = narrow ? 2 : 1;
  const curEra = data.eras.find((e) => yf >= e.from && yf < e.to) ?? data.eras[data.eras.length - 1];

  return (
    <div className="axis decade" style={{ ["--x" as any]: x + "px" }}>
      <div className="spine" style={{ top: Math.max(t, Y(2026)), bottom: H - Math.min(b, Y(2200)) }} />
      {ticks.map((k) => (
        <div key={k} className={"tick" + (k % 10 === 0 ? " ten" : "")} style={{ top: Y(k), opacity: fade(Y(k)) }}>
          {k % every === 0 && Math.abs(Y(k) - mid) > 16 && <span className="mono">{k}</span>}
        </div>
      ))}
      {bounds.map((e) => (
        <div key={e.id} className="era-line" style={{ top: Y(e.from), opacity: fade(Y(e.from)) }}>{Math.abs(Y(e.from) - mid) > 30 && <span>{e.name}</span>}</div>
      ))}

      <svg className="leaders" width={W} height={H} aria-hidden="true">
        {evs.map((ev, i) => Math.abs(pos[i] - Y(ev.year)) > 3 && <path key={ev.id} d={`M${x + 7},${Y(ev.year)} C${x + 16},${Y(ev.year)} ${x + 12},${pos[i]} ${x + 22},${pos[i]}`} stroke={DOMAIN_META[ev.domain].color} style={{ opacity: 0.5 * fade(pos[i]) }} fill="none" />)}
      </svg>

      {evs.map((ev, i) => {
        const on = hasEv(cur) && cur.ev.id === ev.id;
        const p = Math.round((ev.probability ?? 0) * 100);
        const op = fade(pos[i]);
        return (
          <div key={ev.id}>
            <span className={"dot" + (on ? " on" : "") + (ev.cornerstone ? " cs" : "")} style={{ left: x, top: Y(ev.year), opacity: fade(Y(ev.year)), ["--d" as any]: DOMAIN_META[ev.domain].color }} />
            <button className={"row" + (on ? " on" : "") + (ev.cornerstone ? " cs" : "")} tabIndex={op > 0.5 ? tab : -1} style={{ top: pos[i], opacity: op, pointerEvents: op > 0.5 ? "auto" : "none", ["--d" as any]: DOMAIN_META[ev.domain].color }} onClick={() => onPick(ev)}>
              <span className="row-t">{ev.title}</span>
              <span className="row-m mono">{ev.year} · {DOMAIN_META[ev.domain].name} · <b>{p}%</b></span>
            </button>
          </div>
        );
      })}

      <div className="cursor" style={{ top: mid }}>
        <span className="cur-line" />
        <span className="cur-y mono">{Math.round(yf)}</span>
      </div>
      <p className="dec-era">{curEra.name} · {curEra.from}–{curEra.to}</p>
    </div>
  );
}

/* ───────────────────────────── the ruler ───────────────────────────── */

function Ruler({ beats, bf, year, toBeat }: { beats: Beat[]; bf: number; year: number; toBeat: (f: number, smooth?: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const n = beats.length - 1;
  const at = (cy: number) => { const r = ref.current!.getBoundingClientRect(); return Math.max(0, Math.min(1, (cy - r.top) / r.height)) * n; };
  const p = Math.min(1, bf / n);
  const marks = beats.map((b, i) => ({ b, i })).filter(({ b }) => b.kind === "era");
  const release = () => document.documentElement.classList.remove("no-snap-drag");
  return (
    <div
      ref={ref} className={"ruler" + (drag ? " drag" : "")} role="slider" tabIndex={0} aria-label="Year" aria-valuemin={2026} aria-valuemax={2200} aria-valuenow={year}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); document.documentElement.classList.add("no-snap-drag"); toBeat(at(e.clientY)); }}
      onPointerMove={(e) => { if (drag) toBeat(at(e.clientY)); }}
      onPointerUp={(e) => { setDrag(false); release(); toBeat(Math.round(at(e.clientY)), true); }}
      onPointerCancel={() => { setDrag(false); release(); }}
      onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); toBeat(Math.min(n, Math.round(bf) + 1), true); } if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); toBeat(Math.max(0, Math.round(bf) - 1), true); } }}
    >
      <span className="r-track" />
      <span className="r-fill" style={{ height: p * 100 + "%" }} />
      {beats.map((b, i) => hasEv(b) && <span key={i} className="r-ev" style={{ top: (i / n) * 100 + "%", background: DOMAIN_META[b.ev.domain].color }} />)}
      {marks.map(({ b, i }) => <span key={i} className="r-mark mono" style={{ top: (i / n) * 100 + "%", opacity: Math.abs(i / n - p) < 0.045 ? 0 : 1 }}>{b.year}</span>)}
      <span className="r-head" style={{ top: p * 100 + "%" }}><span className="mono">{year}</span></span>
    </div>
  );
}

/* ───────────────────────────── moment pieces ───────────────────────────── */

function EventBeat({ ev, branch, year, onOpen }: { ev: ForecastEvent; branch: Branch; year: number; onOpen: () => void }) {
  const p = Math.round((ev.probability ?? 0) * 100);
  const color = DOMAIN_META[ev.domain].color;
  const h = ev.hero;
  let big: { num?: number; text?: string; prefix?: string; unit?: string } = { text: String(ev.year) };
  if (h?.metric) { const v = statValue(h.metric, branch, Math.max(year, ev.year)); big = { num: Number(v.value), unit: v.unit }; }
  else if (h?.num != null) big = { num: h.num, prefix: h.prefix, unit: h.unit };
  else if (h?.text) big = { text: h.text };
  else { const v = statValue(DOMAIN_STAT[ev.domain], branch, ev.year); big = { num: Number(v.value), unit: v.unit }; }
  return (
    <div className={"ev-beat" + (ev.cornerstone ? " is-corner" : "")} style={{ ["--d" as any]: color }}>
      <div className="ev-beat-head">
        <Glyph domain={ev.domain} />
        <div className="moment-kicker"><span style={{ color }}>{DOMAIN_META[ev.domain].name}</span>{ev.cornerstone && <><span>·</span><span className="cs">cornerstone</span></>}</div>
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
  useEffect(() => { setShowBars(false); const t = setTimeout(() => setShowBars(true), 1200); return () => clearTimeout(t); }, [branch]);
  return (
    <div className="outro">
      <div className="moment-kicker"><span className="dot" />2200 · {branch === "pluralism" ? "if pluralism won" : "if concentration won"}</div>
      <h2><Words text="Does humanity make it?" /></h2>
      <div className="hero-num big"><CountUp to={fl.byBranch[branch]!} /><span className="unit">%</span></div>
      <div className="hero-label">chance we flourish: long lives, abundance, humans still in the loop</div>
      <div className={"outro-bars" + (showBars ? " show" : "")}>
        {data.scenarios.map((s) => <div key={s.id} className={"ob " + s.tone}><span className="ob-n mono">{s.byBranch[branch]}%</span><span className="ob-bar"><i style={{ width: (showBars ? s.byBranch[branch] : 0) + "%" }} /></span><span className="ob-l">{s.label}</span></div>)}
      </div>
      <button className="ghost" onClick={onFlip}>See the other branch</button>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd>{children}</kbd>;
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
