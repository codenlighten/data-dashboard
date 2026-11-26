import { scaleBand, scaleLinear } from "d3-scale";

export interface Bar {
  label: string;
  value: number;
}

const W = 520;
const H = 220;
const M = { top: 12, right: 8, bottom: 34, left: 40 };

/** A small accessible SVG bar chart. The data is also available as a table elsewhere on the page. */
export function BarChart({ bars, title, summary, note }: { bars: Bar[]; title: string; summary: string; note?: string }) {
  const x = scaleBand<string>()
    .domain(bars.map((b) => b.label))
    .range([M.left, W - M.right])
    .padding(0.15);
  const top = Math.max(1, ...bars.map((b) => b.value));
  const y = scaleLinear().domain([0, top]).nice().range([H - M.bottom, M.top]);
  const labelEvery = Math.ceil(bars.length / 8);

  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${summary}`}>
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tick">
              {t}
            </text>
          </g>
        ))}
        {bars.map((b, i) => (
          <g key={b.label}>
            <rect x={x(b.label)} y={y(b.value)} width={x.bandwidth()} height={y(0) - y(b.value)} className="bar">
              <title>{`${b.label}: ${b.value}`}</title>
            </rect>
            {i % labelEvery === 0 && (
              <text x={(x(b.label) ?? 0) + x.bandwidth() / 2} y={H - M.bottom + 16} textAnchor="middle" className="tick">
                {b.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {note && <p className="note">{note}</p>}
    </figure>
  );
}
