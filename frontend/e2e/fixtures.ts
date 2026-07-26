import type { Page } from "@playwright/test";

/**
 * Deterministic browser fixtures belong here. They only expose public scenario
 * content and never model an answer key, companion reasoning, or invite secret.
 */
export async function stubPublicHealth(page: Page) {
  await page.route("**/api/health", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "ok", llm_available: false }) });
  });
}
