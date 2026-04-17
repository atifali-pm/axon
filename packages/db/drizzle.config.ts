import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { defineConfig } from "drizzle-kit";

dotenvExpand.expand(dotenv.config({ path: "../../.env" }));

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
