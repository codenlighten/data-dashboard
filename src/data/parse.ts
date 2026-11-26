import type { ParseResult, Quake } from "./types";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Finite is not enough. A date beyond JavaScript's range throws when formatted, one far outside the
// feed's period would stretch the daily chart over years, and the magnitude sets how many chart buckets
// are built. The longest feed covers 30 days; the magnitude limits are wider than anything recorded.
const DAY = 86_400_000;
const OLDEST_DAYS = 45;
const AHEAD_DAYS = 2;
const MIN_MAGNITUDE = -5;
const MAX_MAGNITUDE = 10;

/**
 * Validates a USGS GeoJSON earthquake feed. The network is untrusted input:
 * malformed features are dropped and counted, never allowed to crash the UI.
 * Throws only when the document is not a feed at all.
 */
export function parseFeed(json: unknown): ParseResult {
  if (!isObj(json) || json.type !== "FeatureCollection" || !Array.isArray(json.features)) {
    throw new Error("Response is not a GeoJSON FeatureCollection");
  }
  const meta = isObj(json.metadata) ? num(json.metadata.generated) : null;
  // Event times are judged against when the feed was made, or the clock if it does not say.
  const made = meta !== null && Number.isFinite(new Date(meta).getTime()) ? meta : Date.now();
  const period = { from: made - OLDEST_DAYS * DAY, to: made + AHEAD_DAYS * DAY };
  const quakes: Quake[] = [];
  let skipped = 0;
  for (const f of json.features as unknown[]) {
    const q = parseFeature(f, period);
    if (q) quakes.push(q);
    else skipped += 1;
  }
  return { quakes, skipped, generated: meta };
}

function parseFeature(f: unknown, period: { from: number; to: number }): Quake | null {
  if (!isObj(f) || !isObj(f.properties) || !isObj(f.geometry)) return null;
  const coords = f.geometry.coordinates;
  if (!Array.isArray(coords) || coords.length < 3) return null;
  const [lon, lat, depth] = [num(coords[0]), num(coords[1]), num(coords[2])];
  const time = num(f.properties.time);
  if (lon === null || lat === null || depth === null || time === null) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  if (typeof f.id !== "string" || f.id === "") return null;
  if (time < period.from || time > period.to) return null;
  // No magnitude yet is normal. Anything else must be a usable number.
  const given = f.properties.mag ?? null;
  const mag = num(given);
  if (given !== null && (mag === null || mag < MIN_MAGNITUDE || mag > MAX_MAGNITUDE)) return null;
  return {
    id: f.id,
    mag,
    place: typeof f.properties.place === "string" ? f.properties.place : "Unknown location",
    time,
    lon,
    lat,
    depth,
    url: typeof f.properties.url === "string" && f.properties.url.startsWith("https://") ? f.properties.url : "",
  };
}
