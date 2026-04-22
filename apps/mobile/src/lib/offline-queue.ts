/**
 * Offline message queue.
 *
 * When the chat screen can't reach the API (no network, API 5xx, stream
 * failure), we persist the user's message in SecureStore and retry on the
 * next successful sign-in check or explicit user action. Each entry carries
 * its conversationId so the replay lands in the right thread.
 *
 * We use SecureStore (not AsyncStorage) because the messages may contain
 * sensitive prompts — case files, client data, etc. SecureStore is encrypted
 * at rest by the OS keychain/keystore.
 *
 * Size: SecureStore has a ~2KB-per-key limit on some Android versions, so we
 * store the whole queue as one JSON blob under `axon.chat.outbox` and truncate
 * if the array grows past ~20 entries.
 */
import * as SecureStore from "expo-secure-store";

const KEY = "axon.chat.outbox";
const MAX_ENTRIES = 20;

export type QueuedMessage = {
  id: string;
  conversationId: string | null;
  text: string;
  enqueuedAt: number;
  attempts: number;
};

async function readQueue(): Promise<QueuedMessage[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedMessage[]): Promise<void> {
  const trimmed = items.slice(-MAX_ENTRIES);
  await SecureStore.setItemAsync(KEY, JSON.stringify(trimmed));
}

export async function enqueue(entry: Omit<QueuedMessage, "id" | "enqueuedAt" | "attempts">): Promise<QueuedMessage> {
  const full: QueuedMessage = {
    ...entry,
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enqueuedAt: Date.now(),
    attempts: 0,
  };
  const items = await readQueue();
  items.push(full);
  await writeQueue(items);
  return full;
}

export async function peek(): Promise<QueuedMessage[]> {
  return readQueue();
}

export async function remove(id: string): Promise<void> {
  const items = await readQueue();
  await writeQueue(items.filter((x) => x.id !== id));
}

export async function markAttempt(id: string): Promise<void> {
  const items = await readQueue();
  await writeQueue(
    items.map((x) => (x.id === id ? { ...x, attempts: x.attempts + 1 } : x)),
  );
}

export async function clear(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
