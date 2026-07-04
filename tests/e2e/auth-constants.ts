import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

export const ADMIN_EMAIL = process.env.LANGTUTOR_ADMIN_EMAIL ?? "admin@langtutor.test";
export const ADMIN_PASSWORD = process.env.LANGTUTOR_ADMIN_PASSWORD ?? "TestPassword1!";
export const AUTH_FILE = "tests/e2e/.auth/user.json";
