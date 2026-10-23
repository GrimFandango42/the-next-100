import type { Branch, Metric } from "./schema";

export type KF = [number, number][];

export function lerp(kf: KF, y: number): number {
  if (y <= kf[0][0]) return kf[0][1];
  for (let i = 1; i < kf.length; i++) {
    if (y <= kf[i][0]) {
      const [a, va] = kf[i - 1];
      const [b, vb] = kf[i];
      return va + (vb - va) * ((y - a) / (b - a));
    }
  }
  return kf[kf.length - 1][1];
}

export function metricKF(m: Metric, branch: Branch): KF {
  return (m.byBranch?.[branch] ?? m.keyframes ?? [[2026, 0]]) as KF;
}

export function fmt(m: Metric, v: number): { value: string; unit: string } {
  switch (m.format) {
    case "fixed1": return { value: v.toFixed(1), unit: m.unit };
    case "int": return { value: String(Math.round(v)), unit: m.unit };
    case "pct": return { value: String(Math.round(v)), unit: "%" };
    case "temp": return { value: "+" + v.toFixed(1), unit: "°C" };
    case "hours": return { value: String(Math.round(v)), unit: "h" };
    case "people":
      if (v >= 1e6) return { value: (v / 1e6).toFixed(1), unit: "M" };
      if (v >= 1e3) return { value: String(Math.round(v / 1e3)), unit: "k" };
      return { value: String(Math.round(v)), unit: "" };
  }
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function clockLabel(sec: number): string {
  return Math.round(sec).toLocaleString("en-US") + " sec";
}

export const CONF_LABEL = { high: "High", moderate: "Moderate", speculative: "Speculative" } as const;
export const STATUS_LABEL = {
  forecast: "Forecast", happened: "Happened", partial: "Partly happened", early: "Happened early",
  late: "Happened late", missed: "Missed", retired: "Retired",
} as const;
