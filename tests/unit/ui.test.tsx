import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fixture from "../../third_party/usgs/week.json";
import App from "@/App";
import { QuakeTable } from "@/components/QuakeTable";
import type { Quake } from "@/data/types";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const q = (over: Partial<Quake>): Quake => ({
  id: "x", mag: 3, place: "P", time: 1_700_000_000_000, lon: 0, lat: 0, depth: 10, url: "", ...over,
});

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("QuakeTable", () => {
  const rows = [q({ id: "a", mag: 5, place: "Five" }), q({ id: "b", mag: null, place: "Unrated" }), q({ id: "c", mag: 2, place: "Two" })];
  const places = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[2].textContent);

  it("sorts by magnitude both ways and keeps unrated events last", async () => {
    render(<QuakeTable quakes={rows} />);
    await userEvent.click(screen.getByRole("button", { name: /^Mag/ }));
    expect(places()).toEqual(["Five", "Two", "Unrated"]);
    await userEvent.click(screen.getByRole("button", { name: /^Mag/ }));
    expect(places()).toEqual(["Two", "Five", "Unrated"]);
    expect(screen.getByRole("columnheader", { name: /Mag/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("pages 25 rows at a time and clamps the page when the data shrinks", async () => {
    const many = Array.from({ length: 60 }, (_, i) => q({ id: `e${i}`, place: `Place ${i}`, time: 1e12 + i }));
    const { rerender } = render(<QuakeTable quakes={many} />);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    rerender(<QuakeTable quakes={many.slice(0, 5)} />);
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(6);
  });

  it("does not jump back to an old page when the data widens again", async () => {
    const many = Array.from({ length: 60 }, (_, i) => q({ id: `e${i}`, place: `Place ${i}`, time: 1e12 + i }));
    const { rerender } = render(<QuakeTable quakes={many} />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    rerender(<QuakeTable quakes={many.slice(0, 5)} />);
    rerender(<QuakeTable quakes={many} />);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("shows an actionable empty state", () => {
    render(<QuakeTable quakes={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Lower the minimum magnitude/);
  });
});

describe("Controls accessibility", () => {
  it("gives the magnitude slider an accessible name (a wrapping label would bind to the <output> instead)", async () => {
    const { Controls } = await import("@/components/Controls");
    render(<Controls filters={{ window: "week", minMag: 2.5, query: "" }} onChange={() => {}} />);
    expect(screen.getByRole("slider", { name: /Minimum magnitude/ })).toHaveValue("2.5");
    expect(screen.getByRole("combobox", { name: "Time window" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: /Place contains/ })).toBeInTheDocument();
  });
});

describe("App", () => {
  it("loads the feed, shows the summary and reads filters from the URL", async () => {
    window.history.replaceState(null, "", "/?mag=0&q=zzzz-nothing");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(fixture)));
    render(<App />);
    expect(screen.getByText(/Loading the week feed/)).toBeInTheDocument();
    await screen.findByText("Events", { selector: "dt" });
    expect(screen.getByText(/No events match these filters/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Place contains/)).toHaveValue("zzzz-nothing");
  });

  it("shows an error with a working retry", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("nope", { status: 503 })).mockResolvedValue(ok(fixture));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/HTTP 503/);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Strongest");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports malformed features that were skipped", async () => {
    const dirty = { ...fixture, features: [...fixture.features, { nope: true }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(dirty)));
    render(<App />);
    await waitFor(() => expect(screen.getByText(/1 malformed feature in the feed was skipped/)).toBeInTheDocument());
  });

  it("survives records with impossible values and says they were skipped", async () => {
    const good = fixture.features[0];
    const bad = [
      { ...good, id: "bad-time", properties: { ...good.properties, time: 1e20 } },
      { ...good, id: "bad-mag", properties: { ...good.properties, mag: 1e9 } },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ ...fixture, features: [...fixture.features, ...bad] })));
    render(<App />);
    expect(await screen.findByText(/2 malformed features in the feed were skipped/)).toBeInTheDocument();
    expect(screen.getByText("Strongest")).toBeInTheDocument();
  });

  it("says how many events the magnitude chart leaves out for want of a magnitude", async () => {
    const good = fixture.features[0];
    const features = [
      { ...good, id: "rated", properties: { ...good.properties, mag: 3 } },
      { ...good, id: "unrated", properties: { ...good.properties, mag: null } },
    ];
    window.history.replaceState(null, "", "/?mag=0");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ ...fixture, features })));
    render(<App />);
    expect(await screen.findByText("1 event without a magnitude is not in this chart.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^Events by magnitude\. 1 rated event / })).toBeInTheDocument();
  });

  it("ignores a slow stale response when the window changed meanwhile", async () => {
    let releaseWeek!: (r: Response) => void;
    const slowWeek = new Promise<Response>((res) => (releaseWeek = res));
    const dayFeed = { ...fixture, features: fixture.features.slice(0, 3) };
    // This mock deliberately ignores the AbortSignal, like a response that was already on its way:
    // only the hook's request-key check can keep the old answer from overwriting the new one.
    const fetchMock = vi.fn((url: string) =>
      url.includes("all_week") ? slowWeek : Promise.resolve(ok(dayFeed)),
    );
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/?mag=0");
    render(<App />);
    await userEvent.selectOptions(screen.getByLabelText("Time window"), "day");
    await screen.findByText("3", { selector: "dd" });
    releaseWeek(ok(fixture)); // the old, slower response arrives last
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText("3", { selector: "dd" })).toBeInTheDocument();
  });
});
