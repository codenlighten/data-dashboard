import type { ParseResult, Quake } from "./types";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Finite is not enough: a date beyond JavaScript's range throws when formatted, and the magnitude sets
// how many chart buckets are built. These limits are far wider than anything a seismometer records.
const EARLIEST = Date.UTC(1900, 0, 1);
const LATEST = Date.UTC(2100, 0, 1);
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
  const quakes: Quake[] = [];
  let skipped = 0;
  for (const f of json.features as unknown[]) {
    const q = parseFeature(f);
    if (q) quakes.push(q);
    else skipped += 1;
  }
  const meta = isObj(json.metadata) ? num(json.metadata.generated) : null;
  return { quakes, skipped, generated: meta };
}

function parseFeature(f: unknown): Quake | null {
  if (!isObj(f) || !isObj(f.properties) || !isObj(f.geometry)) return null;
  const coords = f.geometry.coordinates;
  if (!Array.isArray(coords) || coords.length < 3) return null;
  const [lon, lat, depth] = [num(coords[0]), num(coords[1]), num(coords[2])];
  const time = num(f.properties.time);
  if (lon === null || lat === null || depth === null || time === null) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  if (typeof f.id !== "string" || f.id === "") return null;
  if (time < EARLIEST || time > LATEST) return null;
  const mag = num(f.properties.mag);
  if (mag !== null && (mag < MIN_MAGNITUDE || mag > MAX_MAGNITUDE)) return null;
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
