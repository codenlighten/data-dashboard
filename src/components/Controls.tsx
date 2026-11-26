import { MIN_MAG_SLIDER, type Filters, type WindowId } from "@/data/types";

const WINDOWS: { id: WindowId; label: string }[] = [
  { id: "hour", label: "Past hour" },
  { id: "day", label: "Past day" },
  { id: "week", label: "Past 7 days" },
  { id: "month", label: "Past 30 days" },
];

export function Controls({ filters, onChange }: { filters: Filters; onChange: (p: Partial<Filters>) => void }) {
  return (
    <form className="controls" onSubmit={(e) => e.preventDefault()} aria-label="Filters">
      <label>
        Time window
        <select value={filters.window} onChange={(e) => onChange({ window: e.target.value as WindowId })}>
          {WINDOWS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
      </label>
      <div className="field">
        {/* Explicit htmlFor: a wrapping label would bind to the <output> (also labelable), leaving the slider unnamed. */}
        <label htmlFor="min-mag">
          Minimum magnitude: <output htmlFor="min-mag">{filters.minMag.toFixed(1)}</output>
        </label>
        <input
          id="min-mag"
          type="range"
          {...MIN_MAG_SLIDER}
          value={filters.minMag}
          onChange={(e) => onChange({ minMag: Number(e.target.value) })}
        />
      </div>
      <label>
        Place contains
        <input
          type="search"
          value={filters.query}
          maxLength={80}
          placeholder="e.g. Alaska"
          onChange={(e) => onChange({ query: e.target.value })}
        />
      </label>
    </form>
  );
}
