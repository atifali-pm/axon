import { randomUUID } from "node:crypto";
import type { Db } from "@axon/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, organization } from "better-auth/plugins";

type AuthConfig = {
  db: Db;
  baseUrl: string;
  secret: string;
  trustedOrigins?: string[];
};

export function createAuth({ db, baseUrl, secret, trustedOrigins }: AuthConfig) {
  return betterAuth({
    baseURL: baseUrl,
    secret,
    trustedOrigins,
    database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
    advanced: {
      database: { generateId: () => randomUUID() },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 10,
    },
    session: {
      cookieCache: { enabled: true, maxAge: 60 * 5 },
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    plugins: [
      // Returns the session token in the POST /sign-in response and accepts
      // `Authorization: Bearer <token>` on subsequent requests. Mobile client
      // uses this instead of cookies because RN's fetch + secure-cookie
      // handling across hosts is painful.
      bearer(),
      organization({
        allowUserToCreateOrganization: true,
        creatorRole: "owner",
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
