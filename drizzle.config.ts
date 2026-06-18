import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema:  "./db/schema.ts",
  out:     "./db/drizzle",   // generated migration files (separate from manual SQL in /db/migrations)
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
