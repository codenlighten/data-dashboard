import { parseFeed } from "./parse";
import type { ParseResult, WindowId } from "./types";

export const FEED_BASE = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary";

export const feedUrl = (w: WindowId) => `${FEED_BASE}/all_${w}.geojson`;

/** Fetches and validates a feed. The caller's AbortSignal cancels it; a 15 s timeout is added on top. */
export async function fetchFeed(w: WindowId, signal: AbortSignal): Promise<ParseResult> {
  const res = await fetch(feedUrl(w), { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
  if (!res.ok) throw new Error(`The earthquake feed answered HTTP ${res.status}`);
  return parseFeed(await res.json());
}
