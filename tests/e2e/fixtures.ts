/**
 * Playwright test fixture that stubs every Mac-facing API before each test.
 * Import `{ expect, test }` from here instead of `@playwright/test` in e2e specs.
 */
import { test as base, expect } from "@playwright/test";

import { stubMacApis } from "./stub-mac-apis";

export { expect };
export type { Page } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, provide) => {
    await stubMacApis(page);
    await provide(page);
  },
});
