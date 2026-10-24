# VorldX Employee App

Employee-only companion app for the VorldX attendance system. It runs on Android and iOS with
Expo (React Native) and talks to the same Supabase project as the web dashboard.

## What employees can do

- Sign in with their work email and password (Admin and HR accounts are blocked and told to use the web dashboard).
- See a dashboard with today's attendance, weekly hours, month mix, quick actions and a shift card.
- Scan the office QR display to check in and check out.
- Use an approved WFH passcode twice: once to check in, once to check out.
- Request work from home and leave, and follow every decision with passcodes and review notes.
- Read their attendance calendar, month log and approved leave.
- Read feedback shared by Admin or HR.
- Read company policies (set by Admin).
- Change their password, sign out, and clear the offline cache.

## Requirements

- Node.js 20 or newer, npm.
- Expo Go app on a phone, or a development build for full native modules.
- Access to the VorldX Supabase project (URL and publishable key).

## Setup

```bash
npm install
copy .env.example .env   # Windows
cp .env.example .env     # macOS / Linux
```

Fill in `.env`:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Publishable (anon) key. Only public keys belong in a mobile app. |
| `EXPO_PUBLIC_WEB_URL` | Deployed web app URL, used for password reset and "Open web app". |

During local development the app derives the reset URL from the Expo dev-server host when
`EXPO_PUBLIC_WEB_URL` is empty.

## Run

```bash
npx expo start          # dev server + QR code
npx expo start --web    # browser preview (layouts only, no camera)
```

Open the QR code with [Expo Go](https://expo.dev/go), or press `a` to launch an Android
emulator/device.

### Camera note

QR scanning needs a physical phone. On simulators and browsers the Scan tab explains that the
camera is unavailable and points to the WFH fallback, because the iOS simulator has no camera
hardware.

## Quality checks

```bash
npx tsc --noEmit    # typecheck
npx expo lint       # eslint (eslint-config-expo + react-hooks compiler rules)
npx expo-doctor     # dependency and config health
npx expo export --platform android   # verify the production bundle builds
```

## Build and share

`eas.json` ships four profiles:

| Profile | Use |
| --- | --- |
| `development` | Dev client with native modules. |
| `preview` | Internal APK for Android phones. |
| `production` | Store builds, auto-incrementing versions. |
| `ios-simulator` | iOS simulator build for hosted simulator services (no Apple Developer account needed). |

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android   # shareable APK
npx eas-cli@latest build --profile ios-simulator                # simulator .app for Appetize.io etc.
```

## Project structure

```
src/
  app/            Expo Router routes (auth group, tab group, stack screens)
  components/     UI primitives, SVG charts, three.js orb (native) with web fallback
  constants/      Theme tokens (colors, gradients, fonts, spacing, tones)
  hooks/          React Query data hooks and smaller utility hooks
  lib/            Supabase client, auth provider, API wrappers, date/attendance helpers
  screens/        Feature screens rendered by the route files
```

## Notes

- Reads are cached with React Query and AsyncStorage so attendance and requests stay readable
  offline; the Profile tab can clear that cache.
- The orb animation uses three.js through `@react-three/fiber` on native and a CSS fallback on
  web. It respects the system reduce-motion setting.
- three 0.180+ ships an ESM-only build. `@react-three/fiber`'s native build loads three with
  `require()`, which hits three's CommonJS shim and crashes on `process.emitWarning`. `metro.config.js`
  points every `three` import at `three/build/three.module.js`.
- The app never writes policies, feedback or other employees' data. RLS on Supabase enforces the
  same rules server-side.
