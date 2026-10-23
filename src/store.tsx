import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Branch, Domain } from "./schema";
import { YEAR_MAX, YEAR_MIN } from "./data";

type State = {
  year: number; setYear: (y: number) => void;
  branch: Branch; setBranch: (b: Branch) => void;
  playing: boolean; togglePlay: () => void; reset: () => void;
  domains: Set<Domain>; toggleDomain: (d: Domain) => void;
  selected: string | null; select: (id: string | null) => void;
  /** Timeline visible window [from, to] in years. */
  view: [number, number]; setView: (v: [number, number]) => void;
};

const Ctx = createContext<State | null>(null);
const ALL: Domain[] = ["ai", "bio", "energy", "climate", "space", "society", "risk"];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [year, setYearRaw] = useState(YEAR_MIN);
  const [branch, setBranchRaw] = useState<Branch>(() => (location.hash.includes("concentration") ? "concentration" : "pluralism"));
  const [playing, setPlaying] = useState(false);
  const [domains, setDomains] = useState<Set<Domain>>(new Set(ALL));
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<[number, number]>([YEAR_MIN, YEAR_MAX]);
  const raf = useRef<number>(0);
  const last = useRef(0);

  const setYear = (y: number) => setYearRaw(Math.round(Math.max(YEAR_MIN, Math.min(YEAR_MAX, y))));

  useEffect(() => {
    if (!playing) return;
    const tick = (ts: number) => {
      if (ts - last.current > 110) {
        last.current = ts;
        setYearRaw((y) => {
          if (y >= YEAR_MAX) { setPlaying(false); return y; }
          return y + 1;
        });
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const value = useMemo<State>(() => ({
    year, setYear,
    branch, setBranch: (b) => { setBranchRaw(b); try { history.replaceState(null, "", b === "concentration" ? "#concentration" : "#pluralism"); } catch { /* ignore */ } },
    playing,
    togglePlay: () => { if (!playing && year >= YEAR_MAX) setYearRaw(YEAR_MIN); setPlaying((p) => !p); },
    reset: () => { setPlaying(false); setYearRaw(YEAR_MIN); setView([YEAR_MIN, YEAR_MAX]); setSelected(null); },
    domains,
    toggleDomain: (d) => setDomains((s) => { const n = new Set(s); if (n.has(d) && n.size > 1) n.delete(d); else n.add(d); return n; }),
    selected, select: setSelected,
    view, setView,
  }), [year, branch, playing, domains, selected, view]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider missing");
  return s;
}
