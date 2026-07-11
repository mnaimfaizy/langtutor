/**
 * Issue #109 — learner audio approval gate: pending clips 404 until approved,
 * and resolve responses must not be immutable-cached across regenerate.
 */
import { expect, test } from "./fixtures";

test.describe("learner audio approval gate", () => {
  test.beforeEach(async ({ request }) => {
    const reset = await request.post("/api/test/reset");
    expect(reset.ok()).toBe(true);
  });

  test.afterEach(async ({ request }) => {
    await request.post("/api/test/media-asset", {
      data: { action: "purge", kind: "audio", key: "zebra" },
    });
  });

  test("pending audio is hidden until approved, without immutable cache", async ({ request }) => {
    const pendingSeed = await request.post("/api/test/media-asset", {
      data: { action: "put-pending", kind: "audio", key: "zebra" },
    });
    expect(pendingSeed.ok()).toBe(true);

    const pendingResolve = await request.get("/api/audio/resolve?word=zebra&style=default");
    expect(pendingResolve.status()).toBe(404);

    const approvedSeed = await request.post("/api/test/media-asset", {
      data: { action: "put-approved", kind: "audio", key: "zebra" },
    });
    expect(approvedSeed.ok()).toBe(true);

    const approvedResolve = await request.get("/api/audio/resolve?word=zebra&style=default");
    expect(approvedResolve.ok()).toBe(true);
    expect(approvedResolve.headers()["content-type"]).toMatch(/audio\/wav/i);
    expect(approvedResolve.headers()["cache-control"]).toMatch(/no-store/i);
    expect(approvedResolve.headers()["cache-control"]).not.toMatch(/immutable/i);
  });
});
