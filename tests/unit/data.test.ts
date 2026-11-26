import { describe, expect, it } from "vitest";
import fixture from "../../third_party/usgs/week.json";
import { parseFeed } from "@/data/parse";
import { applyFilters } from "@/data/filter";
import { dailyCounts, magnitudeHistogram, summarize } from "@/data/stats";
import { filtersFromSearch, filtersToSearch } from "@/data/urlState";
import { DEFAULT_FILTERS, type Quake } from "@/data/types";

const q = (over: Partial<Quake>): Quake => ({
  id: "x", mag: 3, place: "Somewhere", time: Date.UTC(2026, 10, 20, 12), lon: 0, lat: 0, depth: 10, url: "", ...over,
});

describe("parseFeed", () => {
  it("parses the real trimmed USGS sample without dropping anything", () => {
    const r = parseFeed(fixture);
    expect(r.quakes.length).toBe(fixture.features.length);
    expect(r.skipped).toBe(0);
    expect(r.quakes.some((e) => e.mag === null)).toBe(true);
  });

  it("drops and counts malformed features instead of throwing", () => {
    const good = fixture.features[0];
    const r = parseFeed({
      type: "FeatureCollection",
      metadata: fixture.metadata,
      features: [
        good,
        null,
        { ...good, id: "" },
        { ...good, geometry: { coordinates: [1, 2] } },
        { ...good, geometry: { coordinates: [999, 0, 5] } },
        { ...good, properties: { ...good.properties, time: "yesterday" } },
      ],
    });
    expect(r.quakes).toHaveLength(1);
    expect(r.skipped).toBe(5);
  });

  it("drops events whose time or magnitude no earthquake could have", () => {
    const good = fixture.features[0];
    const withProps = (id: string, over: Record<string, unknown>) => ({ ...good, id, properties: { ...good.properties, ...over } });
    const r = parseFeed({
      type: "FeatureCollection",
      metadata: fixture.metadata,
      features: [
        withProps("t-high", { time: 1e20 }),
        withProps("t-low", { time: -1e20 }),
        withProps("m-high", { mag: 1e9 }),
        withProps("m-low", { mag: -100 }),
        withProps("ok-small", { mag: -1.2 }),
        withProps("ok-great", { mag: 9.5 }),
        withProps("ok-unrated", { mag: null }),
      ],
    });
    expect(r.quakes.map((e) => e.id)).toEqual(["ok-small", "ok-great", "ok-unrated"]);
    expect(r.skipped).toBe(4);
  });

  it("drops events far outside the period a feed can cover, so one record cannot stretch the daily chart", () => {
    const good = fixture.features[0];
    const at = (id: string, days: number) => ({
      ...good, id, properties: { ...good.properties, time: fixture.metadata.generated + days * 86_400_000 },
    });
    const r = parseFeed({ ...fixture, features: [at("year-old", -365), at("next-month", 30), at("month-old", -30), at("now", 0)] });
    expect(r.quakes.map((e) => e.id)).toEqual(["month-old", "now"]);
    expect(dailyCounts(r.quakes)).toHaveLength(31);
  });

  it("judges the period by the clock when the feed does not say when it was made", () => {
    const good = fixture.features[0];
    const at = (id: string, time: number) => ({ ...good, id, properties: { ...good.properties, time } });
    const features = [at("old", Date.now() - 365 * 86_400_000), at("recent", Date.now() - 3_600_000)];
    expect(parseFeed({ type: "FeatureCollection", features }).quakes.map((e) => e.id)).toEqual(["recent"]);
  });

  it("drops a magnitude that is present but is not a usable number", () => {
    const good = fixture.features[0];
    const withMag = (id: string, mag: unknown) => ({ ...good, id, properties: { ...good.properties, mag } });
    const r = parseFeed({
      ...fixture,
      features: [withMag("text", "1000000000"), withMag("infinite", Infinity), withMag("object", {}), withMag("none", null)],
    });
    expect(r.quakes.map((e) => e.id)).toEqual(["none"]);
    expect(r.skipped).toBe(3);
  });

  it("rejects documents that are not a feed, and non-https links", () => {
    expect(() => parseFeed({ hello: "world" })).toThrow(/FeatureCollection/);
    expect(() => parseFeed(null)).toThrow();
    const f = { ...fixture.features[0], properties: { ...fixture.features[0].properties, url: "javascript:alert(1)" } };
    expect(parseFeed({ type: "FeatureCollection", metadata: fixture.metadata, features: [f] }).quakes[0].url).toBe("");
  });
});

describe("applyFilters", () => {
  const data = [q({ id: "a", mag: 1 }), q({ id: "b", mag: 2.5, place: "Near Tokyo" }), q({ id: "c", mag: null })];
  it("min magnitude is inclusive and excludes unrated events", () => {
    expect(applyFilters(data, { ...DEFAULT_FILTERS, minMag: 2.5 }).map((e) => e.id)).toEqual(["b"]);
  });
  it("minMag 0 means no minimum: negative magnitudes are kept too", () => {
    const small = [q({ id: "n", mag: -0.5 }), q({ id: "u", mag: null })];
    expect(applyFilters(small, { ...DEFAULT_FILTERS, minMag: 0 }).map((e) => e.id)).toEqual(["n", "u"]);
    expect(applyFilters(small, { ...DEFAULT_FILTERS, minMag: 0.5 })).toEqual([]);
  });
  it("minMag 0 keeps unrated events", () => {
    expect(applyFilters(data, { ...DEFAULT_FILTERS, minMag: 0 })).toHaveLength(3);
  });
  it("query is a case-insensitive substring on the place", () => {
    expect(applyFilters(data, { ...DEFAULT_FILTERS, minMag: 0, query: " TOKYO " }).map((e) => e.id)).toEqual(["b"]);
  });
});

describe("stats", () => {
  it("summarize handles empty and unrated-only input", () => {
    expect(summarize([])).toMatchObject({ count: 0, strongest: null, medianMag: null, medianDepth: null });
    expect(summarize([q({ mag: null })]).strongest).toBeNull();
  });
  it("summarize finds the strongest and the medians", () => {
    const s = summarize([q({ id: "a", mag: 2, depth: 5 }), q({ id: "b", mag: 6, depth: 15 }), q({ id: "c", mag: 4, depth: 10 })]);
    expect(s.strongest?.id).toBe("b");
    expect(s.medianMag).toBe(4);
    expect(s.medianDepth).toBe(10);
  });
  it("histogram gives negative magnitudes their own bucket, only when there are any", () => {
    const h = magnitudeHistogram([q({ mag: -0.5 }), q({ mag: 0 }), q({ mag: null })]);
    expect(h[0]).toEqual({ from: -Infinity, to: 0, count: 1 });
    expect(h[1]).toEqual({ from: 0, to: 1, count: 1 });
    expect(magnitudeHistogram([q({ mag: 0 })])[0]?.from).toBe(0);
  });
  it("histogram puts a boundary value in the higher bucket and loses no events", () => {
    const h = magnitudeHistogram([q({ mag: 1 }), q({ mag: 1.99 }), q({ mag: 2 }), q({ mag: -0.5 })]);
    expect(h.find((b) => b.from === 1)?.count).toBe(2);
    expect(h.find((b) => b.from === 2)?.count).toBe(1);
    expect(h.find((b) => b.from === -Infinity)?.count).toBe(1);
    expect(h.reduce((n, b) => n + b.count, 0)).toBe(4);
  });
  it("histogram axis stays at least 0-8 and grows for a huge event", () => {
    expect(magnitudeHistogram([]).at(-1)?.to).toBe(8);
    expect(magnitudeHistogram([q({ mag: 9.1 })]).at(-1)?.to).toBeGreaterThanOrEqual(10);
  });
  it("dailyCounts uses UTC days and zero-fills gaps", () => {
    const d = dailyCounts([
      q({ time: Date.UTC(2026, 10, 1, 23, 59) }),
      q({ time: Date.UTC(2026, 10, 2, 0, 0) }),
      q({ time: Date.UTC(2026, 10, 4, 5) }),
    ]);
    expect(d).toEqual([
      { day: "2026-11-01", count: 1 },
      { day: "2026-11-02", count: 1 },
      { day: "2026-11-03", count: 0 },
      { day: "2026-11-04", count: 1 },
    ]);
    expect(dailyCounts([])).toEqual([]);
  });
  it("summary of the real sample is sane", () => {
    const { quakes } = parseFeed(fixture);
    const s = summarize(quakes);
    expect(s.count).toBe(quakes.length);
    expect(s.strongest?.mag).toBe(Math.max(...quakes.flatMap((e) => (e.mag === null ? [] : [e.mag]))));
  });
});

describe("URL state", () => {
  it("round-trips non-default filters and omits defaults", () => {
    const f = { window: "day" as const, minMag: 4, query: "chile" };
    expect(filtersFromSearch(filtersToSearch(f))).toEqual(f);
    expect(filtersToSearch(DEFAULT_FILTERS)).toBe("");
  });
  it("falls back to defaults for hostile or invalid values", () => {
    expect(filtersFromSearch("?window=year&mag=abc&q=" + "x".repeat(500))).toEqual({
      ...DEFAULT_FILTERS,
      query: "x".repeat(80),
    });
    expect(filtersFromSearch("?mag=-3").minMag).toBe(DEFAULT_FILTERS.minMag);
    expect(filtersFromSearch("?mag=0").minMag).toBe(0);
  });
  it("accepts only magnitudes the slider can show", () => {
    for (const bad of ["8", "9", "7.5", "2.7", "0.25", "", "1e1"]) {
      expect(filtersFromSearch(`?mag=${bad}`).minMag, bad).toBe(DEFAULT_FILTERS.minMag);
    }
    for (const good of [0, 0.5, 6.5, 7]) expect(filtersFromSearch(`?mag=${good}`).minMag).toBe(good);
  });
});

describe("depthClass", () => {
  it("uses the 70 km and 300 km boundaries (lower bound inclusive in the deeper band)", async () => {
    const { depthClass } = await import("@/data/depth");
    expect([0, 69.9, 70, 299.9, 300, 650].map(depthClass)).toEqual(["shallow", "shallow", "mid", "mid", "deep", "deep"]);
  });
});
