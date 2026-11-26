import { useMemo, useState } from "react";
import type { Quake } from "@/data/types";

type SortKey = "time" | "mag" | "depth";
const PAGE = 25;

const fmtTime = (t: number) => new Date(t).toISOString().replace("T", " ").slice(0, 16) + " UTC";

export function QuakeTable({ quakes }: { quakes: readonly Quake[] }) {
  const [key, setKey] = useState<SortKey>("time");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  // New data (another filter or feed) starts at the first page; a remembered page would otherwise
  // reappear as soon as the list grew long enough again.
  const [shown, setShown] = useState(quakes);
  if (shown !== quakes) {
    setShown(quakes);
    setPage(0);
  }

  const sorted = useMemo(() => {
    const sign = dir === "asc" ? 1 : -1;
    // Unrated events (null magnitude) always sort last, whichever direction is chosen.
    return [...quakes].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * sign;
    });
  }, [quakes, key, dir]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const current = Math.min(page, pages - 1);
  const rows = sorted.slice(current * PAGE, (current + 1) * PAGE);

  function sortBy(k: SortKey) {
    if (k === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setKey(k);
      setDir("desc");
    }
    setPage(0);
  }
  const ariaSort = (k: SortKey) => (k === key ? (dir === "asc" ? "ascending" : "descending") : "none");
  const head = (k: SortKey, label: string) => (
    <th scope="col" aria-sort={ariaSort(k)}>
      <button type="button" onClick={() => sortBy(k)}>
        {label}
        {k === key && <span aria-hidden="true">{dir === "asc" ? " ▲" : " ▼"}</span>}
      </button>
    </th>
  );

  return (
    <section aria-labelledby="events-h">
      <h2 id="events-h">Events</h2>
      {sorted.length === 0 ? (
        <p role="status">No events match these filters. Lower the minimum magnitude or widen the time window.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {head("time", "Time")}
                  {head("mag", "Mag")}
                  <th scope="col">Place</th>
                  {head("depth", "Depth (km)")}
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <tr key={q.id}>
                    <td>{fmtTime(q.time)}</td>
                    <td>{q.mag === null ? "n/a" : q.mag.toFixed(1)}</td>
                    <td>{q.url ? <a href={q.url} rel="noreferrer">{q.place}</a> : q.place}</td>
                    <td>{Math.round(q.depth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pager" aria-label="Table pages">
            <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>
              Previous
            </button>
            <span>
              Page {current + 1} of {pages}
            </span>
            <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
