import { DEFAULT_FILTERS, MIN_MAG_SLIDER, type Filters, type WindowId } from "./types";

const WINDOWS: readonly WindowId[] = ["hour", "day", "week", "month"];

const onSlider = (m: number) => m >= MIN_MAG_SLIDER.min && m <= MIN_MAG_SLIDER.max && Number.isInteger(m / MIN_MAG_SLIDER.step);

/** Reads filters from a query string. Anything missing or invalid falls back to the default. */
export function filtersFromSearch(search: string): Filters {
  const p = new URLSearchParams(search);
  const w = p.get("window");
  const raw = p.get("mag") ?? "";
  const m = /^\d(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
  return {
    window: WINDOWS.includes(w as WindowId) ? (w as WindowId) : DEFAULT_FILTERS.window,
    minMag: onSlider(m) ? m : DEFAULT_FILTERS.minMag,
    query: (p.get("q") ?? "").slice(0, 80),
  };
}

/** Writes only non-default values, so the shared URL stays short. */
export function filtersToSearch(f: Filters): string {
  const p = new URLSearchParams();
  if (f.window !== DEFAULT_FILTERS.window) p.set("window", f.window);
  if (f.minMag !== DEFAULT_FILTERS.minMag) p.set("mag", String(f.minMag));
  if (f.query) p.set("q", f.query);
  const s = p.toString();
  return s ? `?${s}` : "";
}
