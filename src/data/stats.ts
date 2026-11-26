import { bin, max, median } from "d3-array";
import type { Quake } from "./types";

export interface Summary {
  count: number;
  strongest: Quake | null;
  medianMag: number | null;
  medianDepth: number | null;
}

export function summarize(quakes: readonly Quake[]): Summary {
  const withMag = quakes.filter((q): q is Quake & { mag: number } => q.mag !== null);
  const top = max(withMag, (q) => q.mag);
  return {
    count: quakes.length,
    strongest: top === undefined ? null : (withMag.find((q) => q.mag === top) ?? null),
    medianMag: median(withMag, (q) => q.mag) ?? null,
    medianDepth: median(quakes, (q) => q.depth) ?? null,
  };
}

export interface Bucket {
  from: number;
  to: number;
  count: number;
}

/**
 * Fixed 1-magnitude-unit buckets from 0, so the axis does not jump between filter changes. Small events
 * can have negative magnitudes; when there are any, they get a bucket of their own below 0. Events
 * without a magnitude are in no bucket.
 */
export function magnitudeHistogram(quakes: readonly Quake[]): Bucket[] {
  const mags = quakes.flatMap((q) => (q.mag === null ? [] : [q.mag]));
  const positive = mags.filter((m) => m >= 0);
  const top = Math.max(8, Math.ceil(max(positive) ?? 0) + 1);
  const bins = bin<number, number>().domain([0, top]).thresholds(Array.from({ length: top - 1 }, (_, i) => i + 1))(positive);
  const buckets = bins.map((b) => ({ from: b.x0 ?? 0, to: b.x1 ?? 0, count: b.length }));
  const negative = mags.length - positive.length;
  return negative > 0 ? [{ from: -Infinity, to: 0, count: negative }, ...buckets] : buckets;
}

export interface DayCount {
  /** UTC calendar day, YYYY-MM-DD. */
  day: string;
  count: number;
}

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Counts per UTC day, with zero-filled gaps between the first and last day. */
export function dailyCounts(quakes: readonly Quake[]): DayCount[] {
  if (quakes.length === 0) return [];
  const counts = new Map<string, number>();
  let lo = Infinity;
  let hi = -Infinity;
  for (const q of quakes) {
    counts.set(dayKey(q.time), (counts.get(dayKey(q.time)) ?? 0) + 1);
    lo = Math.min(lo, q.time);
    hi = Math.max(hi, q.time);
  }
  const out: DayCount[] = [];
  const end = dayKey(hi);
  for (let t = Date.UTC(...ymd(dayKey(lo))); dayKey(t) <= end; t += 86_400_000) {
    out.push({ day: dayKey(t), count: counts.get(dayKey(t)) ?? 0 });
  }
  return out;
}

function ymd(key: string): [number, number, number] {
  const [y, m, d] = key.split("-").map(Number);
  return [y, m - 1, d];
}
