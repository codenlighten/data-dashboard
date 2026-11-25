import { useCallback, useEffect, useState } from "react";
import { fetchFeed } from "@/data/feed";
import type { ParseResult, WindowId } from "@/data/types";

export type QuakeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ParseResult };

/**
 * Loads one feed window. Changing the window or calling retry aborts the request in flight, and a
 * superseded request never writes its result, so a slow old response cannot replace a newer one.
 * Each stored result is also tagged with its request key, and "loading" is derived whenever the
 * stored result belongs to an older request.
 */
export function useQuakes(window: WindowId): { state: QuakeState; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: QuakeState } | null>(null);
  const key = `${window}:${attempt}`;

  useEffect(() => {
    const ctrl = new AbortController();
    fetchFeed(window, ctrl.signal).then(
      (data) => {
        if (ctrl.signal.aborted) return; // superseded: a late answer must not replace the current one
        setResult({ key, state: { status: "ready", data } });
      },
      (err: unknown) => {
        if (ctrl.signal.aborted) return;
        setResult({ key, state: { status: "error", message: err instanceof Error ? err.message : "Unknown error" } });
      },
    );
    return () => ctrl.abort();
  }, [window, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state: result?.key === key ? result.state : { status: "loading" }, retry };
}
