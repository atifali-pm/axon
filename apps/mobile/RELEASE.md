# Axon Mobile — Release Playbook

One-time setup, then a per-release checklist. This covers Android (Play Store) and iOS (App Store). The automated `mobile.yml` GitHub Actions workflow runs EAS builds; submission is intentionally manual.

## One-time setup

### 1. Expo account

```bash
npm install -g eas-cli
eas login
```

### 2. Link the app

```bash
cd apps/mobile
eas init
```

This creates an EAS project and writes the `projectId` into `app.json` (`extra.eas.projectId`). Replace the current `REPLACE_WITH_EAS_PROJECT_ID` placeholder.

### 3. Generate real assets

See `apps/mobile/assets/README.md`. Add:
- `icon.png` (1024×1024)
- `adaptive-icon.png` (1024×1024)
- `splash.png` (1242×2436)
- `favicon.png` (48×48)

Then uncomment the asset references in `app.json`.

### 4. Android Play Store

1. Pay the $25 Google Play developer fee (one-time).
2. Create a new app in the Play Console under the package name `ai.axon.mobile`.
3. Fill out the required metadata: short description, long description, screenshots (phone + tablet), feature graphic, content rating questionnaire, target audience.
4. Link the privacy policy URL (`https://axon.dev/privacy` — served by the web app; see `docs/privacy-policy.md`).
5. Create a Google Cloud service account with Play Publishing permissions, download the JSON key, save it as `apps/mobile/secrets/google-play-key.json` (gitignored).
6. Add the key path to `eas.json`'s `submit.production.android.serviceAccountKeyPath` (already there).

### 5. iOS App Store

1. Enroll in the Apple Developer Program ($99/yr).
2. In App Store Connect, create a new app with bundle id `ai.axon.mobile`.
3. Fill out `eas.json`'s `submit.production.ios`:
   - `appleId`: your Apple ID email
   - `ascAppId`: App Store Connect app id (numeric, e.g. `1234567890`)
   - `appleTeamId`: from the Apple Developer portal
4. `eas credentials` walks you through provisioning profile + distribution certificate creation.

### 6. Firebase Cloud Messaging (production Android push)

Expo Push works in dev + Expo Go without FCM. Production Android builds require an FCM project to actually deliver notifications:

1. Create a Firebase project.
2. Add an Android app with package `ai.axon.mobile`, download `google-services.json`.
3. Run `eas credentials:configure -p android --profile production` and upload the JSON when prompted.

iOS push works automatically through APNs once the Apple Developer cert is in place (EAS handles it).

### 7. GitHub Actions secret

Add `EXPO_TOKEN` to repo secrets (get it from `eas whoami --token` or the Expo web dashboard). Flip the `MOBILE_BUILDS_ENABLED` repo variable to `true` so `.github/workflows/mobile.yml` starts running on every push to `apps/mobile/`.

## Per-release checklist

1. Bump the app version in `app.json` (`"version"`) for user-visible releases.
2. `eas.json`'s production profile has `"autoIncrement": true`, so the build number ticks up automatically.
3. Merge to `main` — the CI workflow builds a `preview` APK.
4. Download the APK from the EAS dashboard and sanity-test on a real device.
5. When ready for the store:

   ```bash
   cd apps/mobile
   eas build --profile production --platform android
   eas submit --profile production --platform android --latest

   eas build --profile production --platform ios
   eas submit --profile production --platform ios --latest
   ```

6. iOS: wait ~24h for App Store review. Android: 1–3 days the first time, minutes for subsequent updates.
7. After approval: flip the release from draft → production in each store dashboard.

## Rollback

- **Android**: in the Play Console, halt the rollout of the bad version. Users on the bad version stay there until you ship a fix; users on the prior version are unaffected.
- **iOS**: revert to a prior build in App Store Connect. Distribute the fix as a new version; App Store doesn't support true rollback.
- **OTA updates** (Expo Updates): for JS-only regressions, `eas update --branch production --message "revert: ..."` can push a fix within minutes without a store re-submission. Native changes (new permissions, new native deps) still require a store release.

## Troubleshooting

- **"Missing icon.png"** during `eas build`: create the asset (see `assets/README.md`) or temporarily remove the icon reference from `app.json`.
- **Push delivered in dev but not after store install**: FCM not configured. Run `eas credentials:configure -p android --profile production`.
- **"Invalid Expo push token"** 400 from the API: mobile is still using the dev token against a production build. Reinstall the app to trigger a fresh `getExpoPushTokenAsync`.
- **Builds hang in queue > 1h**: EAS free tier has limited concurrency. Upgrade or wait.
