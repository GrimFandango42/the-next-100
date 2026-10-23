import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Branch, Domain } from "./schema";
import { data, DEFAULT_VIEW, YEAR_MAX, YEAR_MIN } from "./data";

type State = {
  year: number; setYear: (y: number) => void;
  branch: Branch; setBranch: (b: Branch) => void;
  playing: boolean; pausedOnce: boolean; togglePlay: () => void; reset: () => void;
  domains: Set<Domain>; toggleDomain: (d: Domain) => void;
  selected: string | null; select: (id: string | null) => void;
  /** Timeline visible window [from, to] in years. */
  view: [number, number]; setView: (v: [number, number]) => void;
};

const Ctx = createContext<State | null>(null);
const ALL: Domain[] = ["ai", "bio", "energy", "climate", "space", "society", "risk"];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [year, setYearRaw] = useState(YEAR_MIN);
  const initialHash = typeof location !== "undefined" && !location.hash.startsWith("#m-") ? location.hash.slice(1) : "";
  const initialEvent = data.events.find((e) => e.id === initialHash);
  const [branch, setBranchRaw] = useState<Branch>(() => (new URLSearchParams(location.search).get("b") === "concentration" || initialHash === "concentration" ? "concentration" : "pluralism"));
  const [playing, setPlaying] = useState(false);
  const [pausedOnce, setPausedOnce] = useState(false);
  const [domains, setDomains] = useState<Set<Domain>>(new Set(ALL));
  const [selected, setSelectedRaw] = useState<string | null>(initialEvent?.id ?? null);
  const setSelected = (id: string | null) => {
    setSelectedRaw(id);
    try { history.replaceState(null, "", location.pathname + location.search + (id ? "#" + id : "")); } catch { /* sandboxed */ }
  };
  useEffect(() => { if (initialEvent) setYearRaw(initialEvent.year); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useState<[number, number]>(DEFAULT_VIEW);
  const raf = useRef<number>(0);
  const last = useRef(0);

  const setYear = useCallback((y: number) => setYearRaw(Math.round(Math.max(YEAR_MIN, Math.min(YEAR_MAX, y)))), []);

  useEffect(() => {
    if (!playing) return;
    // ~8 years a second; hold on cornerstone years so the moment registers. Reduced motion steps a decade at a time.
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cornerstones = new Set(data.events.filter((e) => e.cornerstone).map((e) => e.year));
    let wait = 0;
    const tick = (ts: number) => {
      if (ts - last.current > (reduced ? 900 : 260) + wait) {
        last.current = ts;
        setYearRaw((y) => {
          if (y >= YEAR_MAX) { setPlaying(false); return y; }
          const n = Math.min(YEAR_MAX, y + (reduced ? 10 : 1));
          wait = !reduced && cornerstones.has(n) ? 2600 : n > 2100 ? -180 : n > 2060 ? -120 : 0;
          return n;
        });
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const value = useMemo<State>(() => ({
    year, setYear,
    branch, setBranch: (b) => {
      setBranchRaw(b);
      try { const url = new URL(location.href); url.searchParams.set("b", b); history.replaceState(null, "", url); } catch { /* sandboxed */ }
    },
    playing,
    pausedOnce,
    togglePlay: () => {
      if (playing) { setPausedOnce(true); setPlaying(false); return; }
      if (year >= YEAR_MAX) { setYearRaw(YEAR_MIN); setPausedOnce(false); }
      setPlaying(true);
    },
    reset: () => { setPlaying(false); setYearRaw(YEAR_MIN); setView(DEFAULT_VIEW); setSelected(null); setPausedOnce(false); },
    domains,
    toggleDomain: (d) => setDomains((s) => { const n = new Set(s); if (n.has(d) && n.size > 1) n.delete(d); else n.add(d); return n; }),
    selected, select: setSelected,
    view, setView,
  }), [year, branch, playing, pausedOnce, domains, selected, view]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider missing");
  return s;
}
