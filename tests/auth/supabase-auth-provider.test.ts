import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCreateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockGetUser = vi.fn();
const mockSignUp = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      getUser: mockGetUser,
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
      },
    },
  })),
}));

type UserRow = { id: string; email: string; role: "admin" | "standard" };

let usersRows: UserRow[] = [];

function createQueryResult(rows: UserRow[]) {
  const result = {
    limit: vi.fn(async (count?: number) => (count ? rows.slice(0, count) : rows)),
    where: vi.fn(() => createQueryResult(rows)),
    then: (resolve: (value: UserRow[]) => void) => resolve(rows),
  };
  return result;
}

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => createQueryResult(usersRows)),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(async () => undefined),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(async () => undefined),
  })),
};

vi.mock("@/lib/config/env", () => ({
  env: {
    LANGTUTOR_MODE: "cloud",
    LANGTUTOR_ADMIN_EMAIL: "admin@example.com",
    LANGTUTOR_ADMIN_PASSWORD: "adminPass99",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  },
}));

vi.mock("@/lib/db/drizzle/postgres-client", () => ({
  getPostgresDrizzleClient: vi.fn(async () => mockDb),
}));

import { SupabaseAuthProvider } from "@/lib/auth/supabase-auth-provider";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  usersRows = [];

  mockCreateUser.mockResolvedValue({
    data: { user: { id: ADMIN_ID, email: "admin@example.com" } },
    error: null,
  });
  mockSignInWithPassword.mockResolvedValue({
    data: {
      session: {
        access_token: "access-token-123",
        user: { id: USER_ID, email: "user@example.com" },
      },
    },
    error: null,
  });
  mockGetUser.mockResolvedValue({
    data: { user: { id: USER_ID, email: "user@example.com" } },
    error: null,
  });
});

describe("SupabaseAuthProvider bootstrap", () => {
  it("creates the admin user when the users table is empty", async () => {
    const provider = new SupabaseAuthProvider();
    const users = await provider.listUsers();

    expect(mockCreateUser).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "adminPass99",
      email_confirm: true,
    });
    expect(mockDb.insert).toHaveBeenCalled();
    expect(users).toEqual([]);
  });

  it("skips bootstrap when users already exist", async () => {
    usersRows = [{ id: ADMIN_ID, email: "admin@example.com", role: "admin" }];

    const provider = new SupabaseAuthProvider();
    await provider.listUsers();

    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});

describe("SupabaseAuthProvider auth flows", () => {
  beforeEach(() => {
    usersRows = [{ id: ADMIN_ID, email: "admin@example.com", role: "admin" }];
  });

  it("signIn returns the Supabase access token as sessionId", async () => {
    usersRows = [{ id: USER_ID, email: "user@example.com", role: "standard" }];

    const provider = new SupabaseAuthProvider();
    const result = await provider.signIn("user@example.com", "passWord123");

    expect(result.sessionId).toBe("access-token-123");
    expect(result.user.email).toBe("user@example.com");
    expect(result.user.role).toBe("standard");
  });

  it("getCurrentUser resolves role from the users table", async () => {
    usersRows = [{ id: USER_ID, email: "user@example.com", role: "admin" }];

    const provider = new SupabaseAuthProvider();
    const user = await provider.getCurrentUser("access-token-123");

    expect(mockGetUser).toHaveBeenCalledWith("access-token-123");
    expect(user).toEqual({
      id: USER_ID,
      email: "user@example.com",
      role: "admin",
    });
  });

  it("createBootstrapAdmin is not available in cloud mode", async () => {
    const provider = new SupabaseAuthProvider();
    await expect(provider.createBootstrapAdmin("a@b.com", "password1")).rejects.toThrow(
      "Cloud mode bootstraps the admin",
    );
  });
});

describe("SupabaseAuthProvider signUp", () => {
  const NEW_USER_ID = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    usersRows = [{ id: ADMIN_ID, email: "admin@example.com", role: "admin" }];

    mockSignUp.mockResolvedValue({
      data: {
        session: {
          access_token: "signup-token-abc",
          user: { id: NEW_USER_ID, email: "newuser@example.com" },
        },
        user: { id: NEW_USER_ID, email: "newuser@example.com" },
      },
      error: null,
    });
  });

  it("calls supabase.auth.signUp (not admin.createUser) and returns a session", async () => {
    const provider = new SupabaseAuthProvider();
    const result = await provider.signUp("newuser@example.com", "securePass1");

    expect(mockSignUp).toHaveBeenCalledWith({
      email: "newuser@example.com",
      password: "securePass1",
    });
    expect(mockCreateUser).not.toHaveBeenCalledWith(
      expect.objectContaining({ email: "newuser@example.com" }),
    );
    expect(result.sessionId).toBe("signup-token-abc");
    expect(result.user.email).toBe("newuser@example.com");
    expect(result.user.role).toBe("standard");
  });

  it("inserts the new user into our users table with standard role", async () => {
    const provider = new SupabaseAuthProvider();
    await provider.signUp("newuser@example.com", "securePass1");

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("throws when Supabase returns an error", async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Email already registered" },
    });

    const provider = new SupabaseAuthProvider();
    await expect(provider.signUp("taken@example.com", "securePass1")).rejects.toThrow(
      "Email already registered",
    );
  });
});
