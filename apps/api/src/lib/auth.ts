import { db } from "@axon/db";
import { createAuth } from "@axon/shared/auth";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.BETTER_AUTH_SECRET;

if (!secret) {
  throw new Error("BETTER_AUTH_SECRET is not set");
}

const extraOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const auth = createAuth({
  db,
  baseUrl: appUrl,
  secret,
  trustedOrigins: [appUrl, ...extraOrigins],
});
