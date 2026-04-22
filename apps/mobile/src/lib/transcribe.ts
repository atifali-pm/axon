import { apiUrl, getToken } from "./api";

export async function transcribeAudio(uri: string, mime = "audio/m4a"): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error("not signed in");
  const form = new FormData();
  form.append("file", {
    uri,
    name: "voice.m4a",
    type: mime,
  } as unknown as Blob);
  const res = await fetch(`${apiUrl()}/api/chat/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  }
  const parsed = JSON.parse(text) as { text?: string };
  return (parsed.text ?? "").trim();
}
