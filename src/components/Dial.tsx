import { data, YEAR_MAX, YEAR_MIN } from "../data";
import { clockLabel, fmt, lerp, metricKF } from "../lib";
import { useNarrow } from "../hooks";
import { useStore } from "../store";

const HUD = ["population", "warming", "ai-share"] as const;

export default function Dial() {
  const { year, setYear, playing, pausedOnce, togglePlay, reset, branch, setBranch } = useStore();
  const narrow = useNarrow();
  const era = data.eras.find((e) => year >= e.from && year <= e.to) ?? data.eras[data.eras.length - 1];
  const h = data.meta.hinge;
  const clock = lerp(data.clock.byBranch[branch] as [number, number][], year);
  const pct = ((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;

  const slider = (
    <div className="dial-slider" style={{ ["--pct" as any]: pct + "%" }}>
      <div className="dial-eras" aria-hidden="true">
        {data.eras.map((er) => (
          <span key={er.id} className={year >= er.from && year <= er.to ? "on" : ""} style={{ left: ((er.from - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100 + "%", width: ((er.to - er.from) / (YEAR_MAX - YEAR_MIN)) * 100 + "%" }} />
        ))}
      </div>
      <input id="year-range" type="range" min={YEAR_MIN} max={YEAR_MAX} value={year} step={1} aria-label="Year" aria-valuetext={`${year}, ${era.name}`} onChange={(e) => setYear(+e.target.value)} />
      {!narrow && (
        <div className="dial-ticks mono" aria-hidden="true">
          {[2026, 2050, 2100, 2150, 2200].map((t) => <span key={t} style={{ left: `calc(${((t - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100}% + ${8 - ((t - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 16}px)` }}>{t}</span>)}
        </div>
      )}
    </div>
  );

  if (narrow) {
    return (
      <div className="dial compact">
        <div className="dial-row top">
          <div className="dial-year mono" aria-live="polite">{year}</div>
          <div className="hud">
            {HUD.map((id) => { const m = data.metrics.find((x) => x.id === id)!; const v = fmt(m, lerp(metricKF(m, branch), year)); return <span key={id}><b className="mono">{v.value}<small>{v.unit}</small></b><i>{id === "population" ? "people" : id === "warming" ? "warming" : "AI work"}</i></span>; })}
            <span className="hud-clock"><b className="mono">{Math.round(clock).toLocaleString("en-US")}s</b><i>to midnight</i></span>
          </div>
          <button className="icon primary" aria-label={playing ? "Pause" : "Play the century"} onClick={togglePlay}>{playing ? "❚❚" : "▶"}</button>
        </div>
        <div className="dial-row mid">
          <span className="dial-era-name">{era.name}</span>
          <span className="seg sm" role="group" aria-label="Branch of the hinge">
            <button aria-pressed={branch === "pluralism"} onClick={() => setBranch("pluralism")}>Pluralism</button>
            <button aria-pressed={branch === "concentration"} onClick={() => setBranch("concentration")}>Concentration</button>
          </span>
        </div>
        {slider}
      </div>
    );
  }

  return (
    <div className="dial">
      <div className="dial-row">
        <div className="dial-year mono" aria-live="polite">{year}</div>
        <div className="dial-era">{era.name}<small>{era.from}–{era.to}</small></div>
        {slider}
        <div className="dial-btns">
          <button className="primary" onClick={togglePlay}>{playing ? "❚❚ Pause" : year >= YEAR_MAX ? "▶ Play again" : pausedOnce ? "▶ Resume" : year > YEAR_MIN ? `▶ Play from ${year}` : "▶ Play the century"}</button>
          <button onClick={reset}>Reset</button>
        </div>
      </div>
      <div className="dial-row hinge">
        <span className="hinge-label">What if, after {h.resolvesBy}…</span>
        <span className="seg" role="group" aria-label="Which branch of the hinge to show">
          <button aria-pressed={branch === "pluralism"} onClick={() => setBranch("pluralism")}>Pluralism wins <small>{Math.round(h.pluralismProbability * 100)}% likely</small></button>
          <button aria-pressed={branch === "concentration"} onClick={() => setBranch("concentration")}>Concentration wins <small>{Math.round((1 - h.pluralismProbability) * 100)}%</small></button>
        </span>
        <span className="hinge-note">{branch === "pluralism" ? h.pluralism : h.concentration}</span>
      </div>
    </div>
  );
}
