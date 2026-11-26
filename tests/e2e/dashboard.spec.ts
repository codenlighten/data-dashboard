import { expect, test, type Page } from "@playwright/test";
import fixture from "../../third_party/usgs/week.json" with { type: "json" };

// The real USGS feed is never called: the browser's request is answered with a recorded sample.
async function mockFeed(page: Page, body: unknown = fixture, status = 200) {
  await page.route("**/earthquake.usgs.gov/**", (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

test("loads, filters, sorts and keeps the filters in the URL", async ({ page }) => {
  await mockFeed(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Earthquakes/ })).toBeVisible();
  await expect(page.getByText("Strongest")).toBeVisible();

  await page.getByRole("slider", { name: /Minimum magnitude/ }).fill("5");
  await expect(page).toHaveURL(/mag=5/);
  const rows = page.locator("tbody tr");
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (const mag of await rows.locator("td:nth-child(2)").allTextContents()) expect(Number(mag)).toBeGreaterThanOrEqual(5);

  await page.getByRole("button", { name: /^Mag/ }).click();
  const mags = (await rows.locator("td:nth-child(2)").allTextContents()).map(Number);
  expect(mags).toEqual([...mags].sort((a, b) => b - a));

  await page.reload();
  await expect(page.getByRole("slider", { name: /Minimum magnitude/ })).toHaveValue("5");
});

test("a shared URL restores the view and an impossible filter shows the empty state", async ({ page }) => {
  await mockFeed(page);
  await page.goto("/?window=day&mag=0&q=zzzz-no-such-place");
  await expect(page.getByLabel("Time window")).toHaveValue("day");
  await expect(page.getByText(/No events match these filters/)).toBeVisible();
});

test("shows an error and recovers on retry", async ({ page }) => {
  let calls = 0;
  await page.route("**/earthquake.usgs.gov/**", (route) => {
    calls += 1;
    return calls === 1
      ? route.fulfill({ status: 503, body: "down" })
      : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("HTTP 503");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Strongest")).toBeVisible();
});

test("charts are exposed to assistive technology and the map renders every plotted event", async ({ page }) => {
  await mockFeed(page);
  await page.goto("/?mag=0");
  await expect(page.getByRole("img", { name: /World map with \d+ earthquake epicentres/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Events by magnitude/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Events per day/ })).toBeVisible();
  const label = await page.getByRole("img", { name: /World map/ }).getAttribute("aria-label");
  const plotted = Number(label?.match(/with (\d+)/)?.[1]);
  await expect(page.locator("svg circle.quake")).toHaveCount(plotted);
});

test("works on a phone-sized screen without horizontal page scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockFeed(page);
  await page.goto("/");
  await expect(page.getByText("Strongest")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
