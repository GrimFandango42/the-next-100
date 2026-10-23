import { data, YEAR_MAX, YEAR_MIN } from "../data";
import { useStore } from "../store";

export default function Dial() {
  const { year, setYear, playing, togglePlay, reset, branch, setBranch } = useStore();
  const era = data.eras.find((e) => year >= e.from && year <= e.to) ?? data.eras[data.eras.length - 1];
  const h = data.meta.hinge;
  return (
    <div className="dial">
      <div className="dial-row">
        <div className="dial-year mono" aria-live="polite">{year}</div>
        <div className="dial-era">{era.name}<small>{era.from}–{era.to}</small></div>
        <div className="dial-slider">
          <input id="year-range" type="range" min={YEAR_MIN} max={YEAR_MAX} value={year} step={1} aria-label="Year" onChange={(e) => setYear(+e.target.value)} />
          <div className="dial-ticks mono"><span>2026</span><span>2050</span><span>2100</span><span>2150</span><span>2200</span></div>
        </div>
        <div className="dial-btns">
          <button className="primary" onClick={togglePlay}>{playing ? "❚❚ Pause" : year >= YEAR_MAX ? "▶ Play again" : year > YEAR_MIN ? "▶ Resume" : "▶ Play the century"}</button>
          <button onClick={reset}>Reset</button>
        </div>
      </div>
      <div className="dial-row hinge">
        <span className="hinge-label">The hinge <small>resolves ~{h.resolvesBy}</small></span>
        <span className="seg" role="group" aria-label="Branch of the hinge">
          <button aria-pressed={branch === "pluralism"} onClick={() => setBranch("pluralism")}>Pluralism · {Math.round(h.pluralismProbability * 100)}%</button>
          <button aria-pressed={branch === "concentration"} onClick={() => setBranch("concentration")}>Concentration · {Math.round((1 - h.pluralismProbability) * 100)}%</button>
        </span>
        <span className="hinge-note">{branch === "pluralism" ? h.pluralism : h.concentration}</span>
      </div>
    </div>
  );
}
