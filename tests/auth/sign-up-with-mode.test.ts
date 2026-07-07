import { describe, expect, it, vi } from "vitest";

// Allow importing lib/auth/sign-up-with-mode.ts (which has `import "server-only"`) in
// Vitest's Node env.
vi.mock("server-only", () => ({}));

import type { AuthProvider, AuthUser } from "@/lib/auth/auth-provider";
import { signUpWithExperienceMode } from "@/lib/auth/sign-up-with-mode";
import type { ContentRepository } from "@/lib/db/content-repository";
import type { Profile } from "@/lib/db/schema";

const NEW_USER: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "new-user@example.com",
  role: "standard",
};

function makeAuthProviderStub(user: AuthUser, sessionId = "session-1"): AuthProvider {
  return {
    getCurrentUser: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn().mockResolvedValue({ sessionId, user }),
    createUser: vi.fn(),
    listUsers: vi.fn(),
    deleteUser: vi.fn(),
    createBootstrapAdmin: vi.fn(),
  };
}

/** Minimal in-memory repository fake — only `saveProfile`/`getProfile` are exercised. */
function makeFakeRepository(): ContentRepository {
  const state: { profile?: Profile } = {};
  return {
    getProfile: vi.fn(async () => state.profile),
    saveProfile: vi.fn(async (profile: Profile) => {
      state.profile = profile;
    }),
  } as unknown as ContentRepository;
}

describe("signUpWithExperienceMode", () => {
  it("creates the account then writes the chosen mode onto the new profile", async () => {
    const authProvider = makeAuthProviderStub(NEW_USER);
    const repo = makeFakeRepository();
    const getRepository = vi.fn().mockResolvedValue(repo);

    const result = await signUpWithExperienceMode(
      { email: "kid@example.com", password: "hunter2hunter", experienceMode: "kid" },
      authProvider,
      getRepository,
    );

    expect(authProvider.signUp).toHaveBeenCalledWith("kid@example.com", "hunter2hunter");
    expect(getRepository).toHaveBeenCalledWith(NEW_USER.id);
    expect(result).toEqual({ sessionId: "session-1", user: NEW_USER });

    const saved = await repo.getProfile();
    expect(saved).toEqual(
      expect.objectContaining({ experienceMode: "kid", goals: [], settings: {} }),
    );
  });

  it("writes adult mode when adult is chosen", async () => {
    const authProvider = makeAuthProviderStub(NEW_USER);
    const repo = makeFakeRepository();
    const getRepository = vi.fn().mockResolvedValue(repo);

    await signUpWithExperienceMode(
      { email: "adult@example.com", password: "hunter2hunter", experienceMode: "adult" },
      authProvider,
      getRepository,
    );

    const saved = await repo.getProfile();
    expect(saved?.experienceMode).toBe("adult");
  });

  it("only resolves the repository after sign-up returns the new user id", async () => {
    const order: string[] = [];
    const authProvider = makeAuthProviderStub(NEW_USER);
    (authProvider.signUp as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      order.push("signUp");
      return { sessionId: "s1", user: NEW_USER };
    });

    const repo = makeFakeRepository();
    (repo.saveProfile as ReturnType<typeof vi.fn>).mockImplementation(async (profile: Profile) => {
      order.push("saveProfile");
      return profile;
    });
    const getRepository = vi.fn().mockImplementation(async (userId: string) => {
      order.push(`getRepository:${userId}`);
      return repo;
    });

    await signUpWithExperienceMode(
      { email: "x@example.com", password: "hunter2hunter", experienceMode: "kid" },
      authProvider,
      getRepository,
    );

    expect(order).toEqual(["signUp", `getRepository:${NEW_USER.id}`, "saveProfile"]);
  });
});
