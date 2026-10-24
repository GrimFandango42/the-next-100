import { data } from "../data";
const COLOR: Record<string, string> = { ai: "#91b8dc", hinge: "#e1bb83", demography: "#b6d6a4", planet: "#8ccfc7" };
/** Where each of the four forces stands in this chapter, and a way to follow one through the book. */
export default function ChapterWeave({ index, onThread }: { index: number; onThread: (id: string) => void }) {
  const era = data.eras[index];
  const last = index === data.eras.length - 1;
  return <div className="chapter-weave">
    <div className="signature-kicker">FOUR THREADS <span>CHAPTER {String(index + 1).padStart(2, "0")}</span></div>
    <h3>Nothing changes alone.</h3>
    <ul className="thread-list">
      {data.meta.forces.map((f) => {
        const count = data.events.filter((e) => e.force === f.id && e.year >= era.from && (e.year < era.to || last)).length;
        return <li key={f.id} style={{ ["--thread" as any]: COLOR[f.id] }}>
          <button onClick={() => onThread(f.id)} aria-label={`Follow the ${f.short ?? f.name} thread through the book`}><i /><b>{f.short ?? f.name}</b><small>{count} in this chapter ↗</small></button>
          {era.threads[f.id] && <p>{era.threads[f.id]}</p>}
        </li>;
      })}
    </ul>
    <p className="weave-note">Tap a thread to see it across the whole century.</p>
  </div>;
}
