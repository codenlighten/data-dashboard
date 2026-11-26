import { useMemo } from "react";
import { applyFilters } from "@/data/filter";
import { dailyCounts, magnitudeHistogram, summarize } from "@/data/stats";
import { feedUrl } from "@/data/feed";
import { useFilters } from "@/hooks/useFilters";
import { useQuakes } from "@/hooks/useQuakes";
import { BarChart } from "@/components/BarChart";
import { Controls } from "@/components/Controls";
import { QuakeMap } from "@/components/QuakeMap";
import { QuakeTable } from "@/components/QuakeTable";
import { SummaryTiles } from "@/components/SummaryTiles";

export default function App() {
  const [filters, setFilters] = useFilters();
  const { state, retry } = useQuakes(filters.window);
  const ready = state.status === "ready" ? state.data : null;

  const visible = useMemo(() => (ready ? applyFilters(ready.quakes, filters) : []), [ready, filters]);
  const summary = useMemo(() => summarize(visible), [visible]);
  const histogram = useMemo(() => magnitudeHistogram(visible), [visible]);
  const rated = histogram.reduce((n, b) => n + b.count, 0);
  const unrated = visible.length - rated;
  const daily = useMemo(() => dailyCounts(visible), [visible]);

  return (
    <>
      <header>
        <h1>Earthquakes, live from USGS</h1>
        <p>
          An interactive dashboard over the public USGS feed. Filters live in the URL, so any view can be shared.
        </p>
      </header>
      <main>
        <Controls filters={filters} onChange={setFilters} />

        {state.status === "loading" && (
          <p role="status" aria-live="polite">
            Loading the {filters.window} feed…
          </p>
        )}
        {state.status === "error" && (
          <div role="alert" className="error">
            <p>Could not load the feed: {state.message}.</p>
            <button type="button" onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {ready && (
          <>
            <SummaryTiles summary={summary} />
            {ready.skipped > 0 && (
              <p role="status" className="note">
                {ready.skipped} malformed feature{ready.skipped === 1 ? "" : "s"} in the feed {ready.skipped === 1 ? "was" : "were"} skipped.
              </p>
            )}
            <QuakeMap quakes={visible} />
            <div className="charts">
              <BarChart
                title="Events by magnitude"
                bars={histogram.map((b) => ({ label: b.from < 0 ? "<0" : `${b.from}`, value: b.count }))}
                summary={`${rated} rated event${rated === 1 ? "" : "s"} in magnitude buckets of one unit.`}
                note={
                  unrated > 0
                    ? `${unrated} event${unrated === 1 ? "" : "s"} without a magnitude ${unrated === 1 ? "is" : "are"} not in this chart.`
                    : undefined
                }
              />
              <BarChart
                title="Events per day (UTC)"
                bars={daily.map((d) => ({ label: d.day.slice(5), value: d.count }))}
                summary={`${visible.length} events over ${daily.length} day${daily.length === 1 ? "" : "s"}.`}
              />
            </div>
            <QuakeTable quakes={visible} />
          </>
        )}
      </main>
      <footer>
        Data: <a href={feedUrl(filters.window)}>USGS Earthquake Hazards Program</a> (public domain), fetched by your
        browser. Magnitudes of recent events are automatic and get revised. Not for safety decisions.
      </footer>
    </>
  );
}
