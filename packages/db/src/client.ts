import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const adminUrl = process.env.DATABASE_URL;
if (!adminUrl) {
  throw new Error("DATABASE_URL is not set");
}

// Admin/superuser pool: used for migrations, Better Auth table mutations, and
// other privileged work. Bypasses RLS.
export const pg = postgres(adminUrl, {
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  prepare: false,
});

export const db = drizzle(pg, { schema, casing: "snake_case" });
export type Db = typeof db;

// App-role pool: used for tenant-scoped runtime queries. RLS applies.
// Falls back to the admin URL in dev if DATABASE_URL_APP is not set (warning).
const appUrl = process.env.DATABASE_URL_APP ?? adminUrl;
if (appUrl === adminUrl) {
  console.warn(
    "[db] DATABASE_URL_APP not set; falling back to superuser connection. RLS will NOT apply at runtime.",
  );
}

export const appPg = postgres(appUrl, {
  max: Number(process.env.DATABASE_APP_POOL_SIZE ?? 10),
  prepare: false,
});

export const appDb = drizzle(appPg, { schema, casing: "snake_case" });
export type AppDb = typeof appDb;

/**
 * Run a callback inside a transaction with `app.current_org_id` set via
 * `set_config(..., true)` (transaction-local). RLS policies on tenant-scoped
 * tables resolve to this value. The connection is released back to the pool
 * at end of transaction; on rollback, the GUC is reverted automatically.
 */
export async function withOrg<T>(orgId: string, fn: (tx: AppDb) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) {
    throw new Error("withOrg: orgId must be a UUID");
  }
  return appDb.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    return fn(tx as unknown as AppDb);
  });
}
