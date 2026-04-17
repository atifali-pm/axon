import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const pg = postgres(connectionString, {
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  prepare: false,
});

export const db = drizzle(pg, { schema, casing: "snake_case" });

export type Db = typeof db;
