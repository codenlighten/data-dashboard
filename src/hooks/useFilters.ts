import { useCallback, useState } from "react";
import { filtersFromSearch, filtersToSearch } from "@/data/urlState";
import type { Filters } from "@/data/types";

/** Filter state that lives in the URL, so a view can be shared or reloaded. */
export function useFilters(): [Filters, (patch: Partial<Filters>) => void] {
  const [filters, setFilters] = useState(() => filtersFromSearch(window.location.search));
  const update = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      window.history.replaceState(null, "", `${window.location.pathname}${filtersToSearch(next)}`);
      return next;
    });
  }, []);
  return [filters, update];
}
