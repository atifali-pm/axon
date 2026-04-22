import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";
import { registerForPush } from "./push";

type Me = {
  user: { id: string; email: string; name: string | null };
  organization: { id: string; plan: string; name: string } | null;
  role: string | null;
};

type AuthState = {
  loading: boolean;
  me: Me | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setMe(null);
      return;
    }
    const meResp = await api.me();
    if (meResp) {
      setMe({
        user: meResp.user,
        organization: meResp.organization,
        role: meResp.role,
      });
      // Fire-and-forget push registration. /api/push/register is idempotent
      // (upsert by user_id+token), so safe to call on every refresh.
      void registerForPush();
    } else {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { token } = await api.signIn({ email, password });
    await setToken(token);
    await refresh();
  }, [refresh]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { token } = await api.signUp({ name, email, password });
    await setToken(token);
    await refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await api.signOut();
    } catch {
      // ignore server-side errors; wipe token anyway
    }
    await setToken(null);
    setMe(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ loading, me, signIn, signUp, signOut, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}
