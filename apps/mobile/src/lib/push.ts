/**
 * Expo push registration for mobile. On first sign-in we request notification
 * permissions, fetch the Expo push token, and POST it to /api/push/register
 * so the worker can notify this device when long-running agent jobs complete.
 *
 * Limitations:
 * - Push only works on physical devices; Android emulators + iOS simulators
 *   return null. Skipped quietly in that case.
 * - Production Android builds need an FCM project configured via EAS
 *   (`eas credentials:configure --platform android`). Dev + Expo Go is fine.
 */
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { request } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;

  // Android requires a notification channel to actually show heads-up alerts.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#3b82f6",
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") return null;

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    undefined;

  let tokenResp: Awaited<ReturnType<typeof Notifications.getExpoPushTokenAsync>>;
  try {
    tokenResp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  } catch {
    return null;
  }
  const token = tokenResp?.data;
  if (!token) return null;

  try {
    await request("/api/push/register", {
      method: "POST",
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? undefined,
      }),
    });
  } catch {
    // non-fatal; device just won't receive push this session
  }
  return token;
}
