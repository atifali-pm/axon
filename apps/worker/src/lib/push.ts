import { db, schema } from "@axon/db";
import { eq } from "drizzle-orm";
import { Expo, type ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export type PushPayload = {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
};

/** Fire-and-forget push to every registered device for the user. */
export async function pushToUser(userId: string, payload: PushPayload): Promise<void> {
  const tokens = await db
    .select({ token: schema.pushTokens.token })
    .from(schema.pushTokens)
    .where(eq(schema.pushTokens.userId, userId));

  const valid = tokens.map((t) => t.token).filter((t) => Expo.isExpoPushToken(t));
  if (!valid.length) return;

  const messages: ExpoPushMessage[] = valid.map((to) => ({
    to,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data,
    priority: "high",
  }));

  try {
    const chunks = expo.chunkPushNotifications(messages);
    await Promise.all(chunks.map((c) => expo.sendPushNotificationsAsync(c)));
  } catch {
    // intentionally swallowed; push failure is non-critical compared to the
    // core job completing. See receipts API for dead-token cleanup (future).
  }
}
