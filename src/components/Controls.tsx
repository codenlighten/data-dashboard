import type { Filters, WindowId } from "@/data/types";

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
      <label>
        Minimum magnitude: <output>{filters.minMag.toFixed(1)}</output>
        <input
          type="range"
          min={0}
          max={7}
          step={0.5}
          value={filters.minMag}
          onChange={(e) => onChange({ minMag: Number(e.target.value) })}
        />
      </label>
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
