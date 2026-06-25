import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.LANGTUTOR_DB_PATH ?? "./langtutor.db",
  },
});
