/**
 * Two scores, both honest, both shown. This is the policy; it is also written in CHECKIN.md so it stops being re-litigated.
 *
 *   founding  — Brier against the probability in the EARLIEST pre-resolution vintage that holds this line as the same
 *               question in plain terms: same title and same window. That is the number the forecast was first willing
 *               to be judged on. If the resolution test was reworded after that vintage, the score is kept and the
 *               rewording is reported as a caveat. Status is enough to score (happened / early / late = 1, missed = 0).
 *   strict    — Brier against the earliest pre-resolution vintage whose resolution version and text, window, timing
 *               and branch are identical to the line as graded, and only when an explicit adjudication with rationale
 *               and sources is recorded. Null when any of that is missing.
 *
 * Narrative scenarios, partial and retired outcomes are never scored under either rule.
 */
export type Question = {
  title?: string; year?: number; yearEnd?: number | null; timing?: string; branch?: string | null;
  resolution?: { version?: string; mode?: string; test?: string } | null;
};
export type Scorable = Question & {
  id: string; title: string; year: number; status?: string; resolvedOn?: string;
  adjudication?: { definitionVersion?: string; outcome: 0 | 1; rationale: string; sources: string[] };
};
export type Vintage = { date: string; events: Record<string, Question & { probability: number | null }> };
export type Score = { id: string; founding: number | null; strict: number | null; caveat: string | null; reason: string };

export function sameQuestion(a: Question, b: Question) {
  return !!a.resolution?.version && !!a.resolution.test && a.resolution.version === b.resolution?.version
    && a.resolution.test === b.resolution.test && (a.resolution.mode ?? "testable") === (b.resolution?.mode ?? "testable")
    && a.year === b.year && (a.yearEnd ?? null) === (b.yearEnd ?? null)
    && (a.timing ?? "around") === (b.timing ?? "around") && (a.branch ?? null) === (b.branch ?? null);
}
const sameClaim = (a: Question & { title?: string }, b: Question & { title?: string }) =>
  (b.title == null || a.title === b.title) && (b.year == null || a.year === b.year) && ((a.yearEnd ?? null) === (b.yearEnd ?? null));

export function scoreEvent(e: Scorable, vintages: Vintage[]): Score {
  const none = (reason: string): Score => ({ id: e.id, founding: null, strict: null, caveat: null, reason });
  if (e.resolution?.mode === "scenario") return none("Narrative scenario; no binary test, never scored.");
  const status = e.status ?? "forecast";
  if (status === "forecast") return none("Still open.");
  if (status === "partial" || status === "retired") return none(`${status}: listed, not scored.`);
  if (!e.resolvedOn) return none("Needs a resolvedOn date.");
  const outcome = e.adjudication?.outcome ?? (["happened", "early", "late"].includes(status) ? 1 : status === "missed" ? 0 : null);
  if (outcome == null) return none("Needs an outcome.");
  const previous = [...vintages].sort((a, b) => a.date.localeCompare(b.date)).filter((v) => v.date < e.resolvedOn! && v.events[e.id]);
  const fv = previous.find((v) => sameClaim(e, v.events[e.id]) && v.events[e.id].probability != null);
  const founding = fv ? (fv.events[e.id].probability! - outcome) ** 2 : null;
  const a = e.adjudication;
  const sv = a && a.rationale?.trim() && a.sources?.length && a.definitionVersion === e.resolution?.version
    ? previous.find((v) => sameQuestion(e, v.events[e.id]) && v.events[e.id].probability != null) : undefined;
  const strict = sv ? (sv.events[e.id].probability! - a!.outcome) ** 2 : null;
  const caveats: string[] = [];
  if (fv && fv.events[e.id].resolution?.test && e.resolution?.test && fv.events[e.id].resolution!.test !== e.resolution.test) caveats.push(`test reworded after ${fv.date}`);
  if (!a) caveats.push("graded by status; no adjudication recorded"); else if (!a.sources?.length) caveats.push("adjudication has no sources");
  if (fv && !sv) caveats.push("strict score unavailable: no vintage holds this exact definition");
  const reason = fv ? `founding ${fv.events[e.id].probability} (vintage ${fv.date})${sv ? `; strict ${sv.events[e.id].probability} (vintage ${sv.date})` : ""}; outcome ${outcome} on ${e.resolvedOn}` : "no pre-resolution vintage holds this claim as written";
  return { id: e.id, founding, strict, caveat: caveats.join("; ") || null, reason };
}
