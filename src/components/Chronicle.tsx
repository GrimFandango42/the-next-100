import { useEffect, useMemo, useRef } from "react";
import { data } from "../data";
import { DOMAIN_META } from "../schema";
import { CONF_LABEL } from "../lib";
import { useStore } from "../store";

/**
 * Phone timeline. Time runs down the page: scrolling is time travel.
 * The card nearest the reading line sets the year, so the header HUD (population, warming, clock) moves as you scroll.
 * Play and the slider scroll the chronicle in return.
 */
export default function Chronicle() {
  const { year, setYear, domains, select, selected, playing, branch } = useStore();
  const listRef = useRef<HTMLOListElement>(null);
  const source = useRef<"scroll" | "external">("external");
  const lastExternal = useRef(year);

  const events = useMemo(
    () => data.events.filter((e) => domains.has(e.domain) && (!e.branch || e.branch === branch)).sort((a, b) => a.year - b.year),
    [domains, branch],
  );
  const groups = useMemo(() => data.eras.map((er, i) => ({
    er,
    evs: events.filter((e) => e.year >= er.from && (e.year < er.to || (i === data.eras.length - 1 && e.year <= er.to))),
  })), [events]);

  // scroll -> year
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (playing) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const list = listRef.current; if (!list) return;
        const r = list.getBoundingClientRect();
        if (r.top > innerHeight * 0.55 || r.bottom < innerHeight * 0.3) return; // chronicle not in view
        const line = innerHeight * 0.42;
        let best: HTMLElement | null = null, bestD = 1e9;
        list.querySelectorAll<HTMLElement>("[data-year]").forEach((el) => {
          const b = el.getBoundingClientRect(); const d = Math.abs(b.top + b.height / 2 - line);
          if (d < bestD) { bestD = d; best = el; }
        });
        if (best) {
          const y = Number((best as HTMLElement).dataset.year);
          if (y !== lastExternal.current) { source.current = "scroll"; lastExternal.current = y; setYear(y); }
        }
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => { removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [playing, setYear]);

  // year (from play / slider) -> scroll
  useEffect(() => {
    if (source.current === "scroll") { source.current = "external"; return; }
    lastExternal.current = year;
    const list = listRef.current; if (!list) return;
    const r = list.getBoundingClientRect();
    if (!playing && (r.top > innerHeight || r.bottom < 0)) return; // don't yank the page from other sections
    const target = [...list.querySelectorAll<HTMLElement>("[data-year]")].find((el) => Number(el.dataset.year) >= year);
    if (!target) return;
    const top = target.getBoundingClientRect().top + scrollY - innerHeight * 0.42 + 20;
    scrollTo({ top, behavior: playing ? "auto" : "smooth" });
  }, [year, playing]);

  return (
    <ol className="chron" ref={listRef}>
      {groups.map(({ er, evs }) => (
        <li key={er.id} className="chron-era">
          <div className="chron-era-head">
            <span className="mono">{er.from}–{er.to}</span>
            <b>{er.name}</b>
          </div>
          <p className="chron-thesis">{er.thesis}</p>
          {evs.length === 0 && <p className="muted small">No lines in the selected domains.</p>}
          <ol className="chron-list">
            {evs.map((e) => {
              const c = DOMAIN_META[e.domain].color;
              const past = e.year <= year;
              return (
                <li key={e.id} data-year={e.year} className={"chron-item" + (e.cornerstone ? " key" : "") + (past ? " past" : "") + (selected === e.id ? " sel" : "")} style={{ ["--d" as any]: c }}>
                  <button className="chron-card" onClick={() => { select(e.id); }}>
                    <span className="chron-year mono">{e.year}{e.yearEnd ? `–${String(e.yearEnd).slice(2)}` : ""}</span>
                    <span className="chron-body">
                      <span className="chron-dom">{DOMAIN_META[e.domain].name}{e.cornerstone && <em> · cornerstone</em>}</span>
                      <span className="chron-title">{e.title}</span>
                      <span className="chron-sum">{e.summary}</span>
                      <span className="chron-meta">
                        <span className={"pill " + e.confidence}>{CONF_LABEL[e.confidence]}{e.probability != null && ` · ${Math.round(e.probability * 100)}%`}</span>
                        <span className="chron-more">Details ›</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
