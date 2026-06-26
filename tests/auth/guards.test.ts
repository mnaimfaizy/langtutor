import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/resolve-current-user", () => ({ resolveCurrentUser: vi.fn() }));

import { redirect } from "next/navigation";

import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { requireAdmin, requireUser } from "@/lib/auth/guards";

const ADMIN = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@example.com",
  role: "admin" as const,
};
const STANDARD = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "user@example.com",
  role: "standard" as const,
};

function makeRedirectThrow() {
  vi.mocked(redirect).mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
}

describe("requireUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the user when authenticated", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(ADMIN);
    const user = await requireUser();
    expect(user).toBe(ADMIN);
  });

  it("redirects to /login when no session exists", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(null);
    makeRedirectThrow();
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the user when authenticated as admin", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(ADMIN);
    const user = await requireAdmin();
    expect(user).toBe(ADMIN);
    expect(user.role).toBe("admin");
  });

  it("redirects to /login when authenticated as a standard user", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(STANDARD);
    makeRedirectThrow();
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when not authenticated", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(null);
    makeRedirectThrow();
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
