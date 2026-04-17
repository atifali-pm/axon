import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// No baseURL: better-auth falls back to window.location.origin in the browser,
// so the app works regardless of which port the dev server is on.
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
