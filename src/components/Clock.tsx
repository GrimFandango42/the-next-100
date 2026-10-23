import { data } from "../data";
import { clamp, clockLabel, lerp } from "../lib";
import { useStore } from "../store";

export default function Clock() {
  const { year, branch } = useStore();
  const sec = lerp(data.clock.byBranch[branch] as [number, number][], year);
  const note = data.clock.notes.find((n) => year < n.until) ?? data.clock.notes[data.clock.notes.length - 1];
  const deg = -(clamp(sec, 0, 1800) / 60) * 6; // minute hand: 6° per minute
  const ticks = Array.from({ length: 60 }, (_, i) => i);
  return (
    <div className="clock">
      <svg viewBox="0 0 220 220" role="img" aria-label={`Doomsday clock forecast: ${clockLabel(sec)} to midnight in ${year}`}>
        <circle cx={110} cy={110} r={100} fill="none" stroke="var(--line)" strokeWidth={2} />
        {ticks.map((i) => { const a = (i / 60) * Math.PI * 2; const r1 = i % 5 ? 94 : 88; return <line key={i} x1={110 + Math.sin(a) * r1} y1={110 - Math.cos(a) * r1} x2={110 + Math.sin(a) * 100} y2={110 - Math.cos(a) * 100} stroke="var(--muted)" strokeWidth={i % 5 ? 1 : 2} />; })}
        <path d={describeArc(110, 110, 82, deg, 0)} fill="var(--bad)" opacity={0.18} />
        <text x={110} y={24} textAnchor="middle" className="tick" fill="var(--muted)">12</text>
        <line x1={110} y1={110} x2={110} y2={30} stroke="var(--accent)" strokeWidth={4} strokeLinecap="round" style={{ transformOrigin: "110px 110px", transform: `rotate(${deg}deg)`, transition: "transform .4s" }} />
        <line x1={110} y1={110} x2={110} y2={52} stroke="var(--fg)" strokeWidth={5} strokeLinecap="round" style={{ transformOrigin: "110px 110px", transform: "rotate(-28deg)" }} />
        <circle cx={110} cy={110} r={5} fill="var(--fg)" />
      </svg>
      <div className="clock-v"><span className="mono">{clockLabel(sec)}</span><small> to midnight</small></div>
      <p className="note">{note[branch]}</p>
    </div>
  );
}

function describeArc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${cx} ${cy}L${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}Z`;
}
