# Capacitor Native App Integration — Design Spec

**Date:** 2026-04-13
**Status:** Draft
**Goal:** Wrap TKA Composer in Capacitor to ship native iOS and Android apps from the existing SvelteKit static build, gaining native API access (haptics, status bar, push notifications, and future hardware features).

---

## Decisions

| Decision | Answer |
|----------|--------|
| App ID | `com.tkaflowarts.composer` |
| App Store name | TKA Composer |
| Capacitor version | 8 (latest, Node 22+ — project runs Node 24) |
| Repo structure | Monorepo — `ios/` and `android/` at project root |
| Platform priority | Both iOS and Android, Android first (builds on Windows) |
| iOS build strategy | GitHub Actions macOS runners (free tier: 25 min/month) |
| Cloud service | None for now — free CI only |
| Release strategy | Iterative — v1 with core plugins, add hardware features over time |
| Web/native coexistence | Native for mobile, web for desktop. Same codebase. |
| PWA behavior in Capacitor | Service worker disabled inside native shell |

---

## Architecture

### How Capacitor Works

Capacitor wraps a static web build inside a native WebView (WKWebView on iOS, Android WebView on Android). The web code runs identically to the browser, but gains access to native APIs through JavaScript bridges provided by Capacitor plugins.

```
┌─────────────────────────────────┐
│         Native Shell            │
│  (Xcode project / Android      │
│   Studio project)               │
│                                 │
│  ┌───────────────────────────┐  │
│  │      WebView              │  │
│  │  ┌─────────────────────┐  │  │
│  │  │  SvelteKit static   │  │  │
│  │  │  build output       │  │  │
│  │  │  (build/)           │  │  │
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
│                                 │
│  Native Plugins (Swift/Kotlin)  │
│  ├── Haptics                    │
│  ├── StatusBar                  │
│  ├── PushNotifications          │
│  ├── SplashScreen               │
│  ├── Keyboard                   │
│  └── App (lifecycle)            │
└─────────────────────────────────┘
```

### Project Structure Changes

```
tka-platform/
├── src/                          # Unchanged
├── build/                        # SvelteKit static output (exists)
├── capacitor.config.ts           # NEW — Capacitor configuration
├── android/                      # NEW — Android Studio project (generated)
├── ios/                          # NEW — Xcode project (generated)
├── .github/workflows/
│   └── ios-build.yml             # NEW — GitHub Actions iOS build
└── package.json                  # MODIFIED — add Capacitor deps
```

### Build Pipeline

```
Development (local, Android):
  npm run build → npx cap sync → npx cap open android → run from Android Studio

Development (local, browser):
  npm run dev  (unchanged, port 5173)

iOS build (CI):
  Push to main → GitHub Actions → npm run build → cap sync → xcodebuild → TestFlight

Production web:
  npm run build → deploy to Cloudflare (unchanged)
```

New npm scripts:
```json
{
  "build:native": "npm run build && npx cap sync",
  "cap:android": "npx cap open android",
  "cap:ios": "npx cap open ios",
  "cap:sync": "npx cap sync"
}
```

---

## Platform Detection

A thin detection layer lets the codebase branch on platform when needed.

```typescript
// src/lib/shared/platform/services/contracts/IPlatformDetector.ts
export interface IPlatformDetector {
  readonly isNative: boolean;
  readonly isIOS: boolean;
  readonly isAndroid: boolean;
  readonly isWeb: boolean;
  readonly platform: 'ios' | 'android' | 'web';
}
```

```typescript
// src/lib/shared/platform/services/implementations/PlatformDetector.ts
import { Capacitor } from '@capacitor/core';

export class PlatformDetector implements IPlatformDetector {
  get isNative() { return Capacitor.isNativePlatform(); }
  get isIOS() { return Capacitor.getPlatform() === 'ios'; }
  get isAndroid() { return Capacitor.getPlatform() === 'android'; }
  get isWeb() { return Capacitor.getPlatform() === 'web'; }
  get platform() { return Capacitor.getPlatform() as 'ios' | 'android' | 'web'; }
}
```

Registered in the DI container. All platform-specific branching goes through this — never call `Capacitor.isNativePlatform()` directly in components.

---

## V1 Plugins (Ship to Stores)

### 1. Haptics — `@capacitor/haptics`

Replace the current checkbox-switch hack with native Taptic Engine / Android vibration.

```typescript
// Updated HapticFeedback service
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

// When native:
//   "selection" → Haptics.impact({ style: ImpactStyle.Light })
//   "success"   → Haptics.notification({ type: NotificationType.Success })
//   "warning"   → Haptics.notification({ type: NotificationType.Warning })
//   "error"     → Haptics.notification({ type: NotificationType.Error })
//
// When web:
//   Keep existing behavior (Vibration API on Android Chrome, checkbox hack on Safari)
```

The existing `IHapticFeedback` interface stays the same. Only the implementation changes — it checks `isNative` and delegates to the Capacitor plugin or falls back to the current web implementation. No consumer code changes.

### 2. Status Bar — `@capacitor/status-bar`

Native control over the iOS status bar instead of CSS `env(safe-area-inset-top)` hacks.

```typescript
import { StatusBar, Style } from '@capacitor/status-bar';

// On app init (native only):
StatusBar.setStyle({ style: Style.Dark });           // Light text on dark bg
StatusBar.setBackgroundColor({ color: '#0b1d2a' });  // Match theme
StatusBar.setOverlaysWebView({ overlay: true });     // Content extends under status bar
```

The existing `env(safe-area-inset-*)` CSS stays — it still works and provides the padding. The native plugin just gives us reliable control over the status bar appearance, which should fix the issue you're seeing on your iPhone.

### 3. Push Notifications — `@capacitor/push-notifications`

Native APNs (iOS) and FCM (Android) instead of Firebase web push.

```typescript
import { PushNotifications } from '@capacitor/push-notifications';

// On app init (native only):
// 1. Request permission
// 2. Register for push
// 3. Get device token
// 4. Send token to Firebase (same backend, different delivery channel)
// 5. Listen for received/action events
```

The existing Firebase messaging backend stays unchanged. The only difference is the delivery path: native APNs/FCM instead of the web push API. The `firebase-messaging-sw.js` service worker is only used in web mode.

### 4. Splash Screen — `@capacitor/splash-screen`

Native splash screen replaces the 18 CSS-based iOS splash images in `app.html`.

```typescript
import { SplashScreen } from '@capacitor/splash-screen';

// Auto-shown on launch by native runtime
// Hide after app is ready:
SplashScreen.hide({ fadeOutDuration: 300 });
```

The existing splash `<link>` tags in `app.html` stay for the web PWA. Native splash is configured in the Xcode/Android Studio projects separately.

### 5. Keyboard — `@capacitor/keyboard`

Prevents the iOS keyboard from pushing the WebView up and breaking layout.

```typescript
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';

// On app init (native only):
Keyboard.setResizeMode({ mode: KeyboardResize.None });  // We handle it via CSS
Keyboard.setScroll({ isDisabled: true });                // Prevent scroll jump
```

### 6. App Lifecycle — `@capacitor/app`

Handle back button (Android), app state changes, deep links.

```typescript
import { App } from '@capacitor/app';

// Android back button
App.addListener('backButton', ({ canGoBack }) => {
  if (canGoBack) window.history.back();
  else App.exitApp();
});

// Deep links (tkaflowarts.com/sequence/abc → open in app)
App.addListener('appUrlOpen', ({ url }) => {
  // Parse URL and navigate via SvelteKit router
});
```

---

## Service Worker Strategy

The PWA service worker must be disabled inside Capacitor. Capacitor bundles all assets locally — the service worker would intercept requests to `capacitor://localhost` and break things.

**Implementation:** Use the existing `__PWA_ENABLED__` build flag.

```typescript
// src/hooks.client.ts — already has this pattern:
if (browser && !dev && typeof __PWA_ENABLED__ !== "undefined" && __PWA_ENABLED__) {
  // register SW
}
```

For native builds, we set `DISABLE_PWA=true` in the build command:
```bash
DISABLE_PWA=true npm run build && npx cap sync
```

No code changes needed — the flag already exists and is wired up.

---

## V2+ Plugins (Future Roadmap)

These are not part of the initial release but are the reason we're choosing Capacitor over a simpler wrapper:

| Feature | Plugin | TKA Use Case |
|---------|--------|-------------|
| Camera/Motion | `@capacitor/camera` + ML Kit | Sequence capture from video |
| NFC | `@nickkostov/capacitor-nfc` | NFC-enabled cards/merch |
| Bluetooth LE | `@capacitor-community/bluetooth-le` | LED prop pattern sync |
| File System | `@capacitor/filesystem` | Local sequence storage, export |
| Share | `@capacitor/share` | Native share sheet for sequences |
| In-App Purchase | `@capawesome/capacitor-purchases` | Premium subscriptions |
| Biometrics | `@nickkostov/capacitor-native-biometric` | Secure login |

These require no architectural changes — just `npm install`, register in the DI container, and use behind `isNative` checks.

---

## Capacitor Configuration

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tkaflowarts.composer',
  appName: 'TKA Composer',
  webDir: 'build',
  server: {
    // In dev, load from Vite dev server for hot reload
    // url: 'http://YOUR_LOCAL_IP:5174',  // Uncomment for live reload dev
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,        // We hide manually after app ready
      backgroundColor: '#0b1d2a',
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b1d2a',
    },
    Keyboard: {
      resize: 'none',
      style: 'dark',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
```

---

## iOS Build via GitHub Actions

```yaml
# .github/workflows/ios-build.yml
name: iOS Build
on:
  workflow_dispatch:          # Manual trigger only (saves minutes)
  push:
    tags: ['v*']              # Or on version tags

jobs:
  build:
    runs-on: macos-latest     # Free tier: 25 min/month
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm ci
      - run: DISABLE_PWA=true npm run build
      - run: npx cap sync ios
      - run: xcodebuild -workspace ios/App/App.xcworkspace
               -scheme App -configuration Release
               -archivePath build/App.xcarchive archive
      - run: xcodebuild -exportArchive
               -archivePath build/App.xcarchive
               -exportPath build/output
               -exportOptionsPlist ios/exportOptions.plist
      # Upload to TestFlight via fastlane or xcrun altool
```

Triggered manually or on version tags to conserve the 25 free minutes. Android builds happen locally on your Windows machine via Android Studio.

---

## Android Local Development

Android development works fully on Windows:

1. Install Android Studio (free)
2. `npm run build:native` (builds web + syncs to native)
3. `npx cap open android` (opens in Android Studio)
4. Run on connected device or emulator

For live reload during development:
```bash
# Terminal 1: Start Vite on port 5174
vite --port 5174 --host

# Terminal 2: Run with live reload
npx cap run android --livereload --external --port 5174
```

---

## App Store Requirements

### Google Play
- Developer account: $25 one-time fee
- APK/AAB signing key (generated in Android Studio)
- Store listing: screenshots, description, privacy policy (you have `/privacy`)
- Content rating questionnaire

### Apple App Store
- Developer account: $99/year
- App signing via Xcode (handled in CI)
- App Review guidelines compliance
- Store listing: screenshots, description, privacy policy
- TestFlight for beta testing (free, no review needed for internal testers)

---

## What Does NOT Change

- SvelteKit source code structure
- DI container architecture (new services added, none changed)
- Firebase backend
- Web deployment pipeline
- Desktop browser experience
- All existing components and features
- CSS safe area handling (kept as fallback, works in both web and native)

---

## Migration Path for Existing Services

Only one service changes implementation: `HapticFeedback`. All others are new additions.

| Service | Change | Consumer Impact |
|---------|--------|----------------|
| `HapticFeedback` | Add native branch behind `isNative` check | None — same interface |
| `PlatformDetector` | New service | None — new capability |
| `NativeStatusBar` | New service, init on app boot | None — new capability |
| `NativePushHandler` | New service, replaces web push on native | None — same notification UX |
| `NativeKeyboardHandler` | New service, init on app boot | None — prevents layout bugs |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| iOS build fails in CI | Medium | Test locally on borrowed Mac first, or use Capgo trial |
| WebView rendering differences | Low | Capacitor uses standard WKWebView/Android WebView — same engines as browsers |
| App Store rejection | Low | App is a real product with real content, not a web wrapper shell |
| Three.js performance in WebView | Low | WebView supports WebGL; test on physical devices |
| Service worker conflicts | Eliminated | Already have `DISABLE_PWA` flag |
| Firebase auth in WebView | Low | Firebase JS SDK works in WebView; deep link auth may need custom URL scheme |

---

## Success Criteria

1. Android APK builds from Windows and runs on physical Android device
2. iOS IPA builds from GitHub Actions and installs via TestFlight on physical iPhone
3. Haptic feedback fires on both platforms (native Taptic Engine / Android vibration)
4. Status bar renders correctly with proper styling on iPhone SE
5. Push notifications work via native delivery (APNs + FCM)
6. Web version continues to work identically on desktop
7. Build pipeline: `npm run build:native` takes < 60 seconds
