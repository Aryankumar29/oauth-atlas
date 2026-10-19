import { expect, test } from "@playwright/test";

// Smoke suite for T-013. Runs against `npm run dev` with MOCK_LLM=1 (see playwright.config.ts),
// or against a deployed preview via E2E_BASE_URL.

test("home page loads", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBe(true);
  await expect(page.locator("h1").first()).toBeVisible();
});

test("library shows 100 tracked and the difficulty filter narrows the cards", async ({ page }) => {
  await page.goto("/apps");

  const stats = page.getByTestId("library-stats");
  await expect(stats).toContainText("100 tracked");

  const cards = page.getByTestId("app-card");
  await expect(cards).toHaveCount(100);

  const guideCount = Number((await stats.textContent())?.match(/(\d+)\s+guides/)?.[1] ?? 0);
  const filter = page.getByTestId("filter-difficulty");
  const options = (await filter.locator("option").evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value)))
    .filter((v) => v !== "all");
  expect(options.length).toBeGreaterThan(0);

  // Retry the first selection until the client component has hydrated and reacts.
  await expect(async () => {
    await filter.selectOption(options[0]);
    await expect(cards).not.toHaveCount(100, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });

  const counts: number[] = [];
  for (const value of options) {
    await filter.selectOption(value);
    const n = await cards.count();
    expect(n).toBeLessThan(100);
    counts.push(n);
  }
  // Once guides exist, at least one difficulty bucket must be non-empty.
  if (guideCount > 0) expect(Math.max(...counts)).toBeGreaterThan(0);

  await filter.selectOption("all");
  await expect(cards).toHaveCount(100);
});

test("queued app cards link to live generation", async ({ page }) => {
  await page.goto("/apps");
  await page.getByTestId("filter-tier").selectOption("queued");
  const href = await page.getByTestId("app-card").first().getAttribute("href");
  expect(href).toMatch(/^\/generate\?app=[a-z0-9-]+$/);
});

test("gmail guide shows the Composio box and three milestones", async ({ page }) => {
  await page.goto("/apps/gmail");
  await expect(page.getByTestId("composio-box")).toBeVisible();
  await expect(page.getByTestId("milestone")).toHaveCount(3);
});

// Locally (MOCK_LLM=1) this asserts the MOCK banner. Against a deployment (E2E_BASE_URL) Miro is normally a
// demo-cache hit, so it asserts there is no MOCK banner and the guide is labeled cached or live-generated.
const deployed = !!process.env.E2E_BASE_URL;

test("generate Miro streams steps and lands on the run page", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/generate");
  await page.getByLabel(/app name or website/i).fill("Miro");
  await page.getByRole("button", { name: /generate/i }).click();

  await expect(page.getByTestId("generate-step").first()).toBeVisible();
  await expect.poll(() => page.getByTestId("generate-step").count()).toBeGreaterThan(1);

  await page.waitForURL(/\/generate\/[^/?#]+$/, { timeout: 150_000 });
  if (deployed) {
    await expect(page.getByText(/MOCK MODE/)).toHaveCount(0);
    await expect(page.getByText(/Cached demo guide|Live-generated/).first()).toBeVisible();
  } else {
    // The /generate banner can linger in the DOM during the client transition; assert on the visible one.
    await expect(page.getByText(/MOCK MODE/).locator("visible=true")).toHaveCount(1);
  }
  await expect(page.getByTestId("composio-box")).toBeVisible();
  await expect(page.getByTestId("milestone")).toHaveCount(3);
});
