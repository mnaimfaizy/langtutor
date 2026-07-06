import { describe, expect, it } from "vitest";

import type { AuthUser } from "@/lib/auth/auth-provider";
import { HOME_PATH, resolveRootRedirect } from "@/lib/auth/root-route";

const USER: AuthUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "user@example.com",
  role: "standard",
};

describe("resolveRootRedirect", () => {
  it("sends an authenticated visitor to the learning home", () => {
    expect(resolveRootRedirect(USER)).toBe(HOME_PATH);
  });

  it("leaves an anonymous visitor on the root (returns null)", () => {
    expect(resolveRootRedirect(null)).toBeNull();
  });
});
