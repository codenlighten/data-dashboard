export interface Quake {
  id: string;
  /** Magnitude. Null when the network has not assigned one. */
  mag: number | null;
  place: string;
  /** Milliseconds since the Unix epoch (UTC). */
  time: number;
  lon: number;
  lat: number;
  /** Depth in km. */
  depth: number;
  url: string;
}

export type WindowId = "hour" | "day" | "week" | "month";

export interface Filters {
  window: WindowId;
  /** Minimum magnitude, inclusive. Events without a magnitude are excluded when above 0. */
  minMag: number;
  /** Case-insensitive substring match on the place name. */
  query: string;
}

export const DEFAULT_FILTERS: Filters = { window: "week", minMag: 2.5, query: "" };

export interface ParseResult {
  quakes: Quake[];
  /** Features that were dropped because they were malformed. */
  skipped: number;
  generated: number | null;
}
