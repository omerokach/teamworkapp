import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  ...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : {}),
});
