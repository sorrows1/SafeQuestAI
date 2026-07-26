import { expect, test } from "@playwright/test";
import { stubPublicHealth } from "./fixtures";

test("new learner can reach the registration entry point", async ({ page }) => {
  await stubPublicHealth(page);
  await page.goto("/");
  await page.getByRole("link", { name: /sign up free/i }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test("landing visual baseline", async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_VISUAL !== "1", "Run through test:visual or CI visual job.");
  await stubPublicHealth(page);
  await page.goto("/");
  await expect(page).toHaveScreenshot("landing-chromium.png", { fullPage: true, maxDiffPixelRatio: 0.01 });
});
