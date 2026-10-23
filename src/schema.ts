import { z } from "zod";

export const Domain = z.enum(["ai", "bio", "energy", "climate", "space", "society", "risk"]);
export type Domain = z.infer<typeof Domain>;

export const Confidence = z.enum(["high", "moderate", "speculative"]);
export type Confidence = z.infer<typeof Confidence>;

export const Branch = z.enum(["pluralism", "concentration"]);
export type Branch = z.infer<typeof Branch>;

/** What has happened to a forecast line since it was written. */
export const Status = z.enum([
  "forecast", // still ahead of us
  "happened", // resolved true on roughly the predicted schedule
  "partial", // resolved true in part
  "early", // happened earlier than forecast
  "late", // happened later than forecast
  "missed", // the window closed and it did not happen
  "retired", // withdrawn because the framing stopped making sense
]);
export type Status = z.infer<typeof Status>;

export const Revision = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  change: z.string().min(1),
  reason: z.string().min(1),
  sources: z.array(z.string().url()).default([]),
});
export type Revision = z.infer<typeof Revision>;

export const ForecastEvent = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  year: z.number().int().min(2026).max(2200),
  /** Inclusive end of the window when the event spans years. */
  yearEnd: z.number().int().min(2026).max(2200).optional(),
  domain: Domain,
  title: z.string().min(3).max(90),
  summary: z.string().min(1).max(280),
  detail: z.string().min(1),
  confidence: Confidence,
  /** 0..1, where stated. */
  probability: z.number().min(0).max(1).optional(),
  cornerstone: z.boolean().default(false),
  /** Only meaningful in one branch of the hinge. */
  branch: Branch.optional(),
  status: Status.default("forecast"),
  resolvedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Concrete things in the news that would move this line. */
  signals: z.array(z.string()).default([]),
  /** What depends on this. */
  leadsTo: z.array(z.string()).default([]),
  history: z.array(Revision).default([]),
});
export type ForecastEvent = z.infer<typeof ForecastEvent>;

export const Era = z.object({
  id: z.string(),
  from: z.number().int(),
  to: z.number().int(),
  name: z.string(),
  thesis: z.string(),
  good: z.array(z.string()),
  bad: z.array(z.string()),
});
export type Era = z.infer<typeof Era>;

export const Keyframe = z.tuple([z.number(), z.number()]);

export const Metric = z.object({
  id: z.string(),
  label: z.string(),
  unit: z.string(),
  format: z.enum(["fixed1", "int", "pct", "temp", "people", "hours"]),
  scale: z.enum(["linear", "log"]).default("linear"),
  /** Shared keyframes, or per-branch when the hinge changes the path. */
  keyframes: z.array(Keyframe).optional(),
  byBranch: z.record(Branch, z.array(Keyframe)).optional(),
  note: z.string().optional(),
  observed: z.array(z.object({ date: z.string(), value: z.number(), source: z.string().url().optional() })).default([]),
});
export type Metric = z.infer<typeof Metric>;

export const Scenario = z.object({
  id: z.string(),
  label: z.string(),
  tone: z.enum(["good", "warn", "bad"]),
  description: z.string(),
  unconditional: z.number().min(0).max(100),
  byBranch: z.record(Branch, z.number().min(0).max(100)),
});
export type Scenario = z.infer<typeof Scenario>;

export const Indicator = z.object({
  id: z.string(),
  watch: z.string(),
  pluralism: z.string(),
  concentration: z.string(),
  window: z.string(),
  /** Where the needle sits today, -1 (concentration) .. +1 (pluralism). */
  reading: z.number().min(-1).max(1).default(0),
  lastChecked: z.string().optional(),
  note: z.string().optional(),
});
export type Indicator = z.infer<typeof Indicator>;

export const ChangelogEntry = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["checkin", "revision", "launch", "note"]),
  headline: z.string(),
  body: z.string(),
  touched: z.array(z.string()).default([]),
  sources: z.array(z.string().url()).default([]),
});
export type ChangelogEntry = z.infer<typeof ChangelogEntry>;

export const Meta = z.object({
  title: z.string(),
  tagline: z.string(),
  written: z.string(),
  lastCheckin: z.string(),
  hinge: z.object({
    resolvesBy: z.number().int(),
    pluralismProbability: z.number().min(0).max(1),
    pluralism: z.string(),
    concentration: z.string(),
  }),
  forces: z.array(z.object({ name: z.string(), text: z.string() })),
  caveat: z.string(),
});
export type Meta = z.infer<typeof Meta>;

export const Dataset = z.object({
  meta: Meta,
  events: z.array(ForecastEvent),
  eras: z.array(Era),
  metrics: z.array(Metric),
  clock: z.object({ byBranch: z.record(Branch, z.array(Keyframe)), notes: z.array(z.object({ until: z.number(), pluralism: z.string(), concentration: z.string() })) }),
  scenarios: z.array(Scenario),
  indicators: z.array(Indicator),
  changelog: z.array(ChangelogEntry),
});
export type Dataset = z.infer<typeof Dataset>;

export const DOMAIN_META: Record<Domain, { name: string; color: string }> = {
  ai: { name: "AI", color: "#6fb3ff" },
  bio: { name: "Bio & health", color: "#5ec48f" },
  energy: { name: "Energy & robots", color: "#f3b64a" },
  climate: { name: "Climate", color: "#67d4d0" },
  space: { name: "Space", color: "#c69cff" },
  society: { name: "Society & politics", color: "#ff9d7a" },
  risk: { name: "Risk", color: "#f06a6a" },
};
