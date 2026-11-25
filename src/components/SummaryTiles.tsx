import type { Summary } from "@/data/stats";

const fmt = (n: number | null, digits = 1) => (n === null ? "n/a" : n.toFixed(digits));

export function SummaryTiles({ summary }: { summary: Summary }) {
  return (
    <dl className="tiles">
      <div>
        <dt>Events</dt>
        <dd>{summary.count.toLocaleString("en-US")}</dd>
      </div>
      <div>
        <dt>Strongest</dt>
        <dd>
          {summary.strongest ? `M ${fmt(summary.strongest.mag)}` : "n/a"}
          {summary.strongest && <small>{summary.strongest.place}</small>}
        </dd>
      </div>
      <div>
        <dt>Median magnitude</dt>
        <dd>{fmt(summary.medianMag)}</dd>
      </div>
      <div>
        <dt>Median depth</dt>
        <dd>{fmt(summary.medianDepth, 0)} km</dd>
      </div>
    </dl>
  );
}
