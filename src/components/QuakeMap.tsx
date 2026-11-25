import { useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { depthClass } from "@/data/depth";
import type { Quake } from "@/data/types";

const W = 760;
const H = 400;
const projection = geoNaturalEarth1().fitSize([W, H], { type: "Sphere" });
const path = geoPath(projection);
const land = feature(
  world as unknown as Topology<{ countries: GeometryCollection }>,
  (world as unknown as Topology<{ countries: GeometryCollection }>).objects.countries,
);

const radius = (mag: number | null) => 2 + Math.max(0, mag ?? 0) ** 1.6 / 3;

/** Plots at most `limit` events (strongest first) so the SVG stays light on 30-day feeds. */
export function QuakeMap({ quakes, limit = 1500 }: { quakes: readonly Quake[]; limit?: number }) {
  const shown = useMemo(
    () => [...quakes].sort((a, b) => (b.mag ?? -1) - (a.mag ?? -1)).slice(0, limit),
    [quakes, limit],
  );
  const landPath = useMemo(() => path(land) ?? "", []);

  return (
    <figure className="chart">
      <figcaption>Epicentres, sized by magnitude, coloured by depth</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`World map with ${shown.length} earthquake epicentres. The same events are listed in the table below.`}
      >
        <path d={path({ type: "Sphere" }) ?? ""} className="sphere" />
        <path d={landPath} className="land" />
        {shown.map((q) => {
          const p = projection([q.lon, q.lat]);
          return p ? (
            <circle key={q.id} cx={p[0]} cy={p[1]} r={radius(q.mag)} className={`quake ${depthClass(q.depth)}`}>
              <title>{`M ${q.mag ?? "?"}, ${q.place}, ${Math.round(q.depth)} km deep`}</title>
            </circle>
          ) : null;
        })}
      </svg>
      <p className="legend">
        <span className="swatch shallow" /> shallow (&lt; 70 km) <span className="swatch mid" /> intermediate (70–300 km){" "}
        <span className="swatch deep" /> deep (&gt; 300 km)
        {quakes.length > shown.length && ` · showing the strongest ${shown.length} of ${quakes.length}`}
      </p>
    </figure>
  );
}
