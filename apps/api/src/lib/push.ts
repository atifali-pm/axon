/**
 * Expo Push dispatcher. Shared between the API (`/api/push/register`) and
 * potentially webhook routes. The worker has its own copy in
 * apps/worker/src/lib/push.ts because the two runtimes have separate
 * dependency trees.
 *
 * Expo Push works out of the box in Expo Go for development. For store
 * builds on Android you must wire an FCM project (EAS credentials:configure),
 * and on iOS an APNs key. Neither is required for dev/demo.
 */
import { db, schema } from "@axon/db";
import { eq } from "drizzle-orm";
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";

const expo = new Expo();

export type PushPayload = {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
};

export async function pushToUser(
  userId: string,
  payload: PushPayload,
): Promise<ExpoPushTicket[]> {
  const tokens = await db
    .select({ token: schema.pushTokens.token })
    .from(schema.pushTokens)
    .where(eq(schema.pushTokens.userId, userId));

  const valid = tokens
    .map((t) => t.token)
    .filter((t) => Expo.isExpoPushToken(t));
  if (!valid.length) return [];

  const messages: ExpoPushMessage[] = valid.map((to) => ({
    to,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data,
    priority: "high",
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];
  for (const chunk of chunks) {
    try {
      const received = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...received);
    } catch (err) {
      // swallow; the caller logs. one bad chunk shouldn't abort the rest.
      console.error("[push] chunk failed:", err);
    }
  }
  return tickets;
}
