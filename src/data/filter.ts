import type { Filters, Quake } from "./types";

export function applyFilters(quakes: readonly Quake[], f: Filters): Quake[] {
  const q = f.query.trim().toLowerCase();
  return quakes.filter((e) => {
    if (f.minMag > 0 && (e.mag === null || e.mag < f.minMag)) return false;
    if (q && !e.place.toLowerCase().includes(q)) return false;
    return true;
  });
}
