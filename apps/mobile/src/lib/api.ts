/**
 * Axon API client for mobile.
 *
 * Auth model: the web uses Better Auth session cookies. Mobile uses the
 * `bearer()` plugin's Authorization header — we store the token in
 * expo-secure-store and attach it on every request.
 *
 * Configure the API base via `EXPO_PUBLIC_API_URL` in `.env`. Defaults:
 *   - Android emulator: 10.0.2.2 maps to the host
 *   - iOS simulator:    localhost works
 *   - Physical device:  replace with your LAN IP (e.g. 192.168.x.y)
 */
import * as SecureStore from "expo-secure-store";

const DEFAULT_URL = "http://10.0.2.2:4000";

export function apiUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_URL;
}

const TOKEN_KEY = "axon.session.token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${apiUrl()}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export const api = {
  async me(): Promise<{ user: { id: string; email: string; name: string | null }; organization: { id: string; plan: string; name: string }; role: string } | null> {
    try {
      return await request("/api/me");
    } catch {
      return null;
    }
  },
  async signUp(payload: { name: string; email: string; password: string }): Promise<{ token: string; user: { id: string; email: string } }> {
    return request(`/api/auth/sign-up/email`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async signIn(payload: { email: string; password: string }): Promise<{ token: string; user: { id: string; email: string } }> {
    return request(`/api/auth/sign-in/email`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async signOut(): Promise<void> {
    await request(`/api/auth/sign-out`, { method: "POST" });
  },
  async organizations(): Promise<Array<{ id: string; name: string; slug: string }>> {
    return request(`/api/auth/organization/list`);
  },
  async createOrg(name: string, slug: string): Promise<{ id: string; name: string; slug: string }> {
    return request(`/api/auth/organization/create`, {
      method: "POST",
      body: JSON.stringify({ name, slug }),
    });
  },
  async setActiveOrg(organizationId: string): Promise<unknown> {
    return request(`/api/auth/organization/set-active`, {
      method: "POST",
      body: JSON.stringify({ organizationId }),
    });
  },
  async documents(): Promise<{ documents: Array<{ id: string; title: string; chunkCount: number; createdAt: string }> }> {
    return request(`/api/documents`);
  },
  async agents(): Promise<{ templates: Array<{ id: string; name: string; slug: string; description: string | null }> }> {
    return request(`/api/agents`);
  },
  async rateMessage(messageId: string, rating: 1 | -1, reason?: string): Promise<{ ok: boolean }> {
    return request(`/api/chat/messages/${messageId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ rating, reason }),
    });
  },
  async unrateMessage(messageId: string): Promise<{ ok: boolean }> {
    return request(`/api/chat/messages/${messageId}/feedback`, { method: "DELETE" });
  },
  async uploadDocument(asset: { uri: string; name: string; mimeType?: string | null }): Promise<{ document: { id: string; title: string }; jobId: string }> {
    const token = await getToken();
    if (!token) throw new Error("not signed in");
    const form = new FormData();
    // React Native supports the {uri, name, type} shape on FormData.append.
    // Cast to Blob so TS types are happy across RN + web.
    form.append("file", {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? "application/octet-stream",
    } as unknown as Blob);
    const res = await fetch(`${apiUrl()}/api/documents/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${res.status}: ${text.slice(0, 400)}`);
    }
    return JSON.parse(text);
  },
};
