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

  it("rejects documents that are not a feed, and non-https links", () => {
    expect(() => parseFeed({ hello: "world" })).toThrow(/FeatureCollection/);
    expect(() => parseFeed(null)).toThrow();
    const f = { ...fixture.features[0], properties: { ...fixture.features[0].properties, url: "javascript:alert(1)" } };
    expect(parseFeed({ type: "FeatureCollection", features: [f] }).quakes[0].url).toBe("");
  });
});

describe("applyFilters", () => {
  const data = [q({ id: "a", mag: 1 }), q({ id: "b", mag: 2.5, place: "Near Tokyo" }), q({ id: "c", mag: null })];
  it("min magnitude is inclusive and excludes unrated events", () => {
    expect(applyFilters(data, { ...DEFAULT_FILTERS, minMag: 2.5 }).map((e) => e.id)).toEqual(["b"]);
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
  it("histogram puts a boundary value in the higher bucket and loses no events", () => {
    const h = magnitudeHistogram([q({ mag: 1 }), q({ mag: 1.99 }), q({ mag: 2 }), q({ mag: -0.5 })]);
    expect(h.find((b) => b.from === 1)?.count).toBe(2);
    expect(h.find((b) => b.from === 2)?.count).toBe(1);
    expect(h.find((b) => b.from === 0)?.count).toBe(1);
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
});

describe("depthClass", () => {
  it("uses the 70 km and 300 km boundaries (lower bound inclusive in the deeper band)", async () => {
    const { depthClass } = await import("@/data/depth");
    expect([0, 69.9, 70, 299.9, 300, 650].map(depthClass)).toEqual(["shallow", "shallow", "mid", "mid", "deep", "deep"]);
  });
});
