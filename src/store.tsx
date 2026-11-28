import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Branch, Domain } from "./schema";
import { data, DEFAULT_VIEW, YEAR_MAX, YEAR_MIN } from "./data";
import { defaultView, hashFor, parseHash, readEdition, writeEdition, type Route } from "./route";

type State = {
  year: number; setYear: (y: number) => void;
  branch: Branch; setBranch: (b: Branch) => void;
  playing: boolean; pausedOnce: boolean; togglePlay: () => void; reset: () => void;
  domains: Set<Domain>; toggleDomain: (d: Domain) => void;
  selected: string | null; select: (id: string | null) => void;
  /** Timeline visible window [from, to] in years. */
  view: [number, number]; setView: (v: [number, number]) => void;
  /** Which reader view is showing (This week, Odds, the book), from the URL hash. */
  route: Route;
  /** The check-in the reader had seen before this visit; null on a first visit. */
  lastSeen: string | null;
};

const Ctx = createContext<State | null>(null);
const ALL: Domain[] = ["ai", "bio", "energy", "climate", "space", "society", "risk"];
const LINE_IDS = new Set(data.events.map((e) => e.id));
const currentHash = () => (typeof location !== "undefined" ? location.hash : "");

export function StoreProvider({ children }: { children: ReactNode }) {
  const [year, setYearRaw] = useState(YEAR_MIN);
  // Read once per visit: whether the reader has been here before decides the default view, and the edition they last saw is what This week compares against.
  const [lastSeen] = useState(readEdition);
  const [route, setRoute] = useState<Route>(() => parseHash(currentHash(), LINE_IDS, defaultView(lastSeen)));
  const routeRef = useRef(route);
  routeRef.current = route;
  const initialEvent = route.line ? data.events.find((e) => e.id === route.line) : undefined;
  const [branch, setBranchRaw] = useState<Branch>(() => (typeof location !== "undefined" && (new URLSearchParams(location.search).get("b") === "concentration" || currentHash() === "#concentration") ? "concentration" : "pluralism"));
  const [playing, setPlaying] = useState(false);
  const [pausedOnce, setPausedOnce] = useState(false);
  const [domains, setDomains] = useState<Set<Domain>>(new Set(ALL));
  const [selected, setSelectedRaw] = useState<string | null>(initialEvent?.id ?? null);
  /** Opening a drawer in Odds names the line in the URL (#line-<id>) without adding a history entry; the other views keep their hash. */
  const setSelected = useCallback((id: string | null) => {
    setSelectedRaw(id);
    if (routeRef.current.view !== "odds") return;
    try { history.replaceState(history.state, "", location.pathname + location.search + hashFor({ view: "odds", line: id ?? undefined })); } catch { /* sandboxed */ }
  }, []);
  useEffect(() => { if (initialEvent) setYearRaw(initialEvent.year); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { writeEdition(data.meta.lastCheckin); }, []);
  // Back, forward and every link to #week / #odds / #book / #line-… / #story-… land here.
  useEffect(() => {
    const onHash = () => {
      const r = parseHash(currentHash(), LINE_IDS, defaultView(lastSeen));
      setRoute(r);
      setSelectedRaw(r.line ?? null);
      const ev = r.line ? data.events.find((e) => e.id === r.line) : undefined;
      if (ev) setYearRaw(ev.year);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, [lastSeen]);
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
    route, lastSeen,
  }), [year, branch, playing, pausedOnce, domains, selected, view, route, lastSeen, setSelected]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider missing");
  return s;
}
