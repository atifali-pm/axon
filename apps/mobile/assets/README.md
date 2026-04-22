# Mobile Assets

These assets are required before `eas build --profile production`. Expo Go uses defaults for missing files, so dev works without them.

## Required

| File | Dimensions | Purpose |
|---|---|---|
| `icon.png` | 1024×1024 | App icon (iOS + Android stores) |
| `adaptive-icon.png` | 1024×1024 | Android adaptive-icon foreground (safe area: center 672×672) |
| `splash.png` | 1242×2436 or similar | Launch screen |
| `favicon.png` | 48×48 | Web build favicon |

## Generating

The simplest path is a single 1024×1024 square with the Axon logo centered, on a dark background (`#0a0a0a` to match the app). Export from any design tool (Figma, Sketch, etc.).

After adding the files, update `app.json` to point at them:

```json
"icon": "./assets/icon.png",
"splash": { "image": "./assets/splash.png", ... },
"android": { "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", ... } },
"web": { "favicon": "./assets/favicon.png" }
```

`eas build --profile preview` will hard-fail without `icon.png`; dev/Expo Go tolerates the absence.
