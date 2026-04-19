import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// No baseURL: better-auth falls back to window.location.origin in the browser,
// so the app works regardless of which port the dev server is on.
// The explicit `as any` here avoids a TS2742 "cannot be named" error from
// better-auth's deeply nested organization-plugin types.
// biome-ignore lint/suspicious/noExplicitAny: third-party type portability
export const authClient: any = createAuthClient({
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
