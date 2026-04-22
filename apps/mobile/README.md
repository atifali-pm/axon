# @axon/mobile

Expo (React Native) companion app for Axon. Ships the same chat + document experience as the web, authenticates via Better Auth's `bearer()` plugin against the Axon API.

## Stack

- **Expo SDK 52** with Expo Router (file-based routing)
- **NativeWind 4** (Tailwind CSS for React Native)
- **react-native-sse** for streaming chat tokens
- **expo-secure-store** for the session token

## Run

From the repo root:

```bash
pnpm --filter @axon/mobile start
# or: pnpm --filter @axon/mobile android | ios | web
```

Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`:

| Target | Value |
|---|---|
| Android emulator | `http://10.0.2.2:4000` (default) |
| iOS simulator | `http://localhost:4000` |
| Physical device | `http://<your-lan-ip>:4000` |
| Production | `https://api.axon.xyz` |

The API and worker and agents service must be running (see the repo root `CLAUDE.md` for the dev quickstart).

## Routes

- `/` root → redirects to `/chat` if signed in, `/login` otherwise
- `/login` email/password sign-in + sign-up
- `/chat` streaming chat (bearer token, SSE)
- `/documents` list docs with chunk counts (upload coming in part 2)

## Auth model

- `POST /api/auth/sign-in/email` returns `{ token }` (bearer plugin)
- Token stored in `expo-secure-store` under `axon.session.token`
- `request()` in `src/lib/api.ts` attaches `Authorization: Bearer <token>` automatically
- Sign-out calls `/api/auth/sign-out` and clears the local token

## Coming in parts 2–3

- Push notifications for async agent runs (Expo Push + BullMQ event subscription)
- Document upload via `expo-document-picker`
- Offline message queue (replay on reconnect)
- EAS builds for Play Store + App Store
- GitHub Actions workflow running `eas build` on main

## Phase 9 status

Part 1 shipped 2026-04-20. See `docs/end_to_end_saas_blueprint.md` phase 9 section (to be written).
