/**
 * Scores a resolved line against the probability it carried in the EARLIEST frozen vintage that holds the same question
 * (same title and same year window). That is the number the forecast was first willing to be judged on.
 * If the resolution test was reworded after that vintage, the score is kept and the drift is reported as a caveat.
 * Lines marked as narrative scenarios, and partial / retired outcomes, are never scored.
 */
export type Scorable = {
  id: string; title: string; year: number; yearEnd?: number; status?: string; resolvedOn?: string;
  resolution?: { version?: string; mode?: string; test?: string };
  adjudication?: { definitionVersion?: string; outcome: 0 | 1; rationale: string; sources: string[] };
};
export type Vintage = { date: string; events: Record<string, { probability: number | null; title?: string; year?: number; yearEnd?: number | null; resolution?: { version?: string; test?: string } | null }> };

export function scoreEvent(e: Scorable, vintages: Vintage[]) {
  const unscored = (reason: string) => ({ id: e.id, score: null as number | null, caveat: null as string | null, reason });
  if (e.resolution?.mode === "scenario") return unscored("Narrative scenario; no binary test, never scored.");
  const status = e.status ?? "forecast";
  if (status === "forecast") return unscored("Still open.");
  if (status === "partial" || status === "retired") return unscored(`${status}: listed, not scored.`);
  const outcome = e.adjudication?.outcome ?? (["happened", "early", "late"].includes(status) ? 1 : status === "missed" ? 0 : null);
  if (outcome == null || !e.resolvedOn) return unscored("Needs a status and a resolvedOn date.");
  const sorted = [...vintages].sort((a, b) => a.date.localeCompare(b.date));
  const v = sorted.find((x) => { const o = x.events[e.id]; return o && x.date < e.resolvedOn! && (o.title == null || o.title === e.title) && (o.year == null || o.year === e.year); });
  if (!v) return unscored("No pre-resolution vintage holds this question as written.");
  const p = v.events[e.id].probability;
  if (p == null) return unscored(`Vintage ${v.date} has no probability for it.`);
  const old = v.events[e.id].resolution;
  const drift = old?.test && e.resolution?.test && old.test !== e.resolution.test ? `resolution test reworded after ${v.date} (${old.version ?? "unversioned"} → ${e.resolution.version ?? "unversioned"})` : null;
  const evidence = e.adjudication?.sources?.length ? null : "no adjudication sources recorded";
  const caveat = [drift, evidence].filter(Boolean).join("; ") || null;
  return { id: e.id, score: (p - outcome) ** 2, caveat, reason: `written at ${p} (vintage ${v.date}); outcome ${outcome} on ${e.resolvedOn}` };
}
