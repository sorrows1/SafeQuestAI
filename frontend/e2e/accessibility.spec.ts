import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { stubPublicHealth } from "./fixtures";

test("public landing has no automated WCAG A/AA violations", async ({ page }) => {
  await stubPublicHealth(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /where families explore digital safety together/i })).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(scan.violations).toEqual([]);
});
