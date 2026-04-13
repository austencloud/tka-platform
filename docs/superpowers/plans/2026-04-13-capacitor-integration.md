# Capacitor Native App Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap TKA Composer in Capacitor 8 to ship native iOS and Android apps, gaining native haptics, status bar control, push notifications, and future hardware API access.

**Architecture:** Monorepo integration — `ios/` and `android/` folders at project root, build pipeline extends existing `adapter-static` output. New `PlatformDetector` service in DI container gates native-only code paths. Existing `HapticFeedback` service gains a native branch. Service worker disabled via existing `DISABLE_PWA` flag for native builds.

**Tech Stack:** Capacitor 8, @capacitor/haptics, @capacitor/status-bar, @capacitor/push-notifications, @capacitor/splash-screen, @capacitor/keyboard, @capacitor/app

**Spec:** `docs/superpowers/specs/2026-04-13-capacitor-integration-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `capacitor.config.ts` | Capacitor project configuration |
| Create | `src/lib/shared/platform/services/contracts/IPlatformDetector.ts` | Platform detection interface |
| Create | `src/lib/shared/platform/services/implementations/PlatformDetector.ts` | Platform detection via Capacitor |
| Create | `src/lib/shared/platform/services/contracts/INativeInitializer.ts` | Native plugin initialization interface |
| Create | `src/lib/shared/platform/services/implementations/NativeInitializer.ts` | Boot-time native plugin setup |
| Create | `src/lib/shared/di/containers/platform-container.ts` | DI container for platform services |
| Create | `.github/workflows/ios-build.yml` | GitHub Actions iOS CI |
| Create | `tests/unit/PlatformDetector.test.ts` | Platform detection tests |
| Modify | `src/lib/shared/application/services/implementations/HapticFeedback.ts` | Add native haptic branch |
| Modify | `src/lib/shared/di/index.ts` | Wire platform container |
| Modify | `src/lib/shared/di/container-types.ts` | Add platform container types |
| Modify | `package.json` | Add Capacitor deps + scripts |
| Modify | `.gitignore` | Add ios/, android/ entries |

---

## Task 1: Install Capacitor and Generate Native Projects

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `capacitor.config.ts`

- [ ] **Step 1: Install Capacitor core packages**

```bash
npm install @capacitor/core@latest
npm install -D @capacitor/cli@latest
```

- [ ] **Step 2: Install platform packages**

```bash
npm install @capacitor/android@latest @capacitor/ios@latest
```

- [ ] **Step 3: Install V1 plugins**

```bash
npm install @capacitor/haptics @capacitor/status-bar @capacitor/push-notifications @capacitor/splash-screen @capacitor/keyboard @capacitor/app
```

- [ ] **Step 4: Create capacitor.config.ts**

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "com.tkaflowarts.composer",
	appName: "TKA Composer",
	webDir: "build",
	server: {
		androidScheme: "https",
	},
	plugins: {
		SplashScreen: {
			launchAutoHide: false,
			backgroundColor: "#0b1d2a",
			androidScaleType: "CENTER_CROP",
		},
		StatusBar: {
			style: "DARK",
			backgroundColor: "#0b1d2a",
		},
		Keyboard: {
			resize: "none",
			style: "dark",
		},
		PushNotifications: {
			presentationOptions: ["badge", "sound", "alert"],
		},
	},
};

export default config;
```

- [ ] **Step 5: Add native scripts to package.json**

Add these to the `"scripts"` section in `package.json`:

```json
"build:native": "DISABLE_PWA=true npm run build && npx cap sync",
"cap:sync": "npx cap sync",
"cap:android": "npx cap open android",
"cap:ios": "npx cap open ios"
```

- [ ] **Step 6: Add native project dirs to .gitignore**

Append to `.gitignore`:

```gitignore
# Capacitor native projects (generated, not tracked until CI is set up)
# ios/
# android/
```

Note: Commented out for now. These get uncommented once you're iterating locally and don't want to track generated files. When CI is set up, you'll commit them and remove the ignore entries.

- [ ] **Step 7: Build the web app and initialize native projects**

```bash
DISABLE_PWA=true npm run build
npx cap init "TKA Composer" "com.tkaflowarts.composer" --web-dir build
npx cap add android
```

Note: Skip `npx cap add ios` on Windows — iOS project generation requires macOS. It will be generated in the GitHub Actions CI workflow.

- [ ] **Step 8: Verify Android project was created**

```bash
ls android/app/src/main/
```

Expected: `AndroidManifest.xml`, `java/`, `res/` directories exist.

- [ ] **Step 9: Commit**

```bash
git add capacitor.config.ts package.json package-lock.json .gitignore
git commit -m "feat: install Capacitor 8 with native plugins and Android project"
```

---

## Task 2: Create PlatformDetector Service

**Files:**
- Create: `src/lib/shared/platform/services/contracts/IPlatformDetector.ts`
- Create: `src/lib/shared/platform/services/implementations/PlatformDetector.ts`
- Create: `tests/unit/PlatformDetector.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/unit/PlatformDetector.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// We can't import Capacitor directly in tests (no native runtime),
// so we test the logic by mocking @capacitor/core
vi.mock("@capacitor/core", () => ({
	Capacitor: {
		isNativePlatform: vi.fn(() => false),
		getPlatform: vi.fn(() => "web"),
	},
}));

import { PlatformDetector } from "$lib/shared/platform/services/implementations/PlatformDetector";
import { Capacitor } from "@capacitor/core";

describe("PlatformDetector", () => {
	let detector: PlatformDetector;

	beforeEach(() => {
		detector = new PlatformDetector();
	});

	it("reports web platform when not in native shell", () => {
		expect(detector.isNative).toBe(false);
		expect(detector.isWeb).toBe(true);
		expect(detector.isIOS).toBe(false);
		expect(detector.isAndroid).toBe(false);
		expect(detector.platform).toBe("web");
	});

	it("reports iOS when running in iOS native shell", () => {
		vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
		vi.mocked(Capacitor.getPlatform).mockReturnValue("ios");

		expect(detector.isNative).toBe(true);
		expect(detector.isIOS).toBe(true);
		expect(detector.isAndroid).toBe(false);
		expect(detector.isWeb).toBe(false);
		expect(detector.platform).toBe("ios");
	});

	it("reports Android when running in Android native shell", () => {
		vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
		vi.mocked(Capacitor.getPlatform).mockReturnValue("android");

		expect(detector.isNative).toBe(true);
		expect(detector.isAndroid).toBe(true);
		expect(detector.isIOS).toBe(false);
		expect(detector.platform).toBe("android");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/unit/PlatformDetector.test.ts
```

Expected: FAIL — module `$lib/shared/platform/services/implementations/PlatformDetector` not found.

- [ ] **Step 3: Create the interface**

```typescript
// src/lib/shared/platform/services/contracts/IPlatformDetector.ts
export interface IPlatformDetector {
	readonly isNative: boolean;
	readonly isIOS: boolean;
	readonly isAndroid: boolean;
	readonly isWeb: boolean;
	readonly platform: "ios" | "android" | "web";
}
```

- [ ] **Step 4: Create the implementation**

```typescript
// src/lib/shared/platform/services/implementations/PlatformDetector.ts
import { Capacitor } from "@capacitor/core";
import type { IPlatformDetector } from "../contracts/IPlatformDetector";

export class PlatformDetector implements IPlatformDetector {
	get isNative(): boolean {
		return Capacitor.isNativePlatform();
	}

	get isIOS(): boolean {
		return Capacitor.getPlatform() === "ios";
	}

	get isAndroid(): boolean {
		return Capacitor.getPlatform() === "android";
	}

	get isWeb(): boolean {
		return Capacitor.getPlatform() === "web";
	}

	get platform(): "ios" | "android" | "web" {
		return Capacitor.getPlatform() as "ios" | "android" | "web";
	}
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- --run tests/unit/PlatformDetector.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/platform/ tests/unit/PlatformDetector.test.ts
git commit -m "feat: add PlatformDetector service with Capacitor runtime detection"
```

---

## Task 3: Create NativeInitializer Service

This service runs once on app boot and sets up all native plugins (status bar, keyboard, splash screen, app lifecycle). It's a no-op on web.

**Files:**
- Create: `src/lib/shared/platform/services/contracts/INativeInitializer.ts`
- Create: `src/lib/shared/platform/services/implementations/NativeInitializer.ts`

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/shared/platform/services/contracts/INativeInitializer.ts
export interface INativeInitializer {
	initialize(): Promise<void>;
}
```

- [ ] **Step 2: Create the implementation**

```typescript
// src/lib/shared/platform/services/implementations/NativeInitializer.ts
import type { IPlatformDetector } from "../contracts/IPlatformDetector";
import type { INativeInitializer } from "../contracts/INativeInitializer";

export class NativeInitializer implements INativeInitializer {
	constructor(private readonly platformDetector: IPlatformDetector) {}

	async initialize(): Promise<void> {
		if (!this.platformDetector.isNative) return;

		await Promise.all([
			this.initStatusBar(),
			this.initKeyboard(),
			this.initSplashScreen(),
			this.initAppLifecycle(),
		]);
	}

	private async initStatusBar(): Promise<void> {
		const { StatusBar, Style } = await import("@capacitor/status-bar");
		await StatusBar.setStyle({ style: Style.Dark });
		await StatusBar.setOverlaysWebView({ overlay: true });

		if (this.platformDetector.isAndroid) {
			await StatusBar.setBackgroundColor({ color: "#0b1d2a" });
		}
	}

	private async initKeyboard(): Promise<void> {
		const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
		await Keyboard.setResizeMode({ mode: KeyboardResize.None });
		await Keyboard.setScroll({ isDisabled: true });
	}

	private async initSplashScreen(): Promise<void> {
		const { SplashScreen } = await import("@capacitor/splash-screen");
		await SplashScreen.hide({ fadeOutDuration: 300 });
	}

	private async initAppLifecycle(): Promise<void> {
		const { App } = await import("@capacitor/app");

		if (this.platformDetector.isAndroid) {
			await App.addListener("backButton", ({ canGoBack }) => {
				if (canGoBack) {
					window.history.back();
				} else {
					App.exitApp();
				}
			});
		}

		await App.addListener("appUrlOpen", ({ url }) => {
			const path = new URL(url).pathname;
			if (path) {
				window.location.href = path;
			}
		});
	}
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/platform/services/contracts/INativeInitializer.ts src/lib/shared/platform/services/implementations/NativeInitializer.ts
git commit -m "feat: add NativeInitializer service for boot-time native plugin setup"
```

---

## Task 4: Wire Platform Services into DI Container

**Files:**
- Create: `src/lib/shared/di/containers/platform-container.ts`
- Modify: `src/lib/shared/di/container-types.ts`
- Modify: `src/lib/shared/di/index.ts`

- [ ] **Step 1: Create the platform container**

```typescript
// src/lib/shared/di/containers/platform-container.ts
import { createContainer } from "iti";
import { PlatformDetector } from "$lib/shared/platform/services/implementations/PlatformDetector";
import { NativeInitializer } from "$lib/shared/platform/services/implementations/NativeInitializer";

export function createPlatformContainer() {
	return createContainer()
		.add({
			platformDetector: () => new PlatformDetector(),
		})
		.add((deps) => ({
			nativeInitializer: () => new NativeInitializer(deps.platformDetector),
		}));
}

export type PlatformContainer = ReturnType<typeof createPlatformContainer>;
```

- [ ] **Step 2: Add platform container types to container-types.ts**

In `src/lib/shared/di/container-types.ts`, add the import alongside other container imports:

```typescript
import type { PlatformContainer } from "./containers/platform-container";
```

Add the items extraction alongside other container items:

```typescript
type PlatformItems = ItemsOf<PlatformContainer>;
```

Add `PlatformItems` to the `IAppContainerItems` intersection type (at the end, before the closing semicolon):

```typescript
& PlatformItems
```

- [ ] **Step 3: Wire platform container into index.ts**

In `src/lib/shared/di/index.ts`, add the import:

```typescript
import { createPlatformContainer } from "./containers/platform-container";
```

Add instantiation near the top of the container section (before `coreContainer` or alongside simple containers):

```typescript
const platformContainer = createPlatformContainer();
```

In the `buildAppContainer()` function, add the platform container to the merge chain. Find the pattern where containers are added via `.add(() => containerX.items)` and add:

```typescript
.add(() => platformContainer.items)
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run check
```

Expected: No new type errors related to platform container.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/di/containers/platform-container.ts src/lib/shared/di/container-types.ts src/lib/shared/di/index.ts
git commit -m "feat: wire PlatformDetector and NativeInitializer into DI container"
```

---

## Task 5: Update HapticFeedback to Use Native Haptics

**Files:**
- Modify: `src/lib/shared/application/services/implementations/HapticFeedback.ts`

- [ ] **Step 1: Add native haptic trigger method**

At the top of `HapticFeedback.ts`, add an import for the platform detector interface:

```typescript
import type { IPlatformDetector } from "$lib/shared/platform/services/contracts/IPlatformDetector";
```

Add a private field and modify the constructor to accept an optional platform detector:

Replace the existing constructor:
```typescript
constructor() {
    this.initializeService();
}
```

With:
```typescript
private platformDetector: IPlatformDetector | null;

constructor(platformDetector?: IPlatformDetector) {
    this.platformDetector = platformDetector ?? null;
    this.initializeService();
}
```

- [ ] **Step 2: Add native haptic trigger method to the class**

Add this private method alongside the existing `triggerIOSHaptic` and `triggerVibrationAPI` methods:

```typescript
private async triggerNativeHaptic(type: HapticFeedbackType): Promise<boolean> {
    try {
        const { Haptics, ImpactStyle, NotificationType } = await import(
            "@capacitor/haptics"
        );

        switch (type) {
            case "selection":
                await Haptics.impact({ style: ImpactStyle.Light });
                break;
            case "success":
                await Haptics.notification({ type: NotificationType.Success });
                break;
            case "warning":
                await Haptics.notification({ type: NotificationType.Warning });
                break;
            case "error":
                await Haptics.notification({ type: NotificationType.Error });
                break;
            default:
                await Haptics.impact({ style: ImpactStyle.Medium });
        }
        return true;
    } catch {
        return false;
    }
}
```

- [ ] **Step 3: Update the trigger method to prefer native**

In the existing `trigger()` method, add a native check at the top of the method body, before the existing web-based logic:

```typescript
// At the start of trigger(), after the throttle/enabled checks:
if (this.platformDetector?.isNative) {
    this.triggerNativeHaptic(type);
    this.lastFeedbackTime = now;
    return true;
}
```

The rest of the method (Vibration API, iOS checkbox hack) remains unchanged as the web fallback.

- [ ] **Step 4: Update the isSupported method**

In the existing `isSupported()` method, add native check at the top:

```typescript
// At the start of isSupported():
if (this.platformDetector?.isNative) return true;
```

- [ ] **Step 5: Update DI registration to pass platformDetector**

In `src/lib/shared/di/containers/core-container.ts`, update the hapticFeedback factory.

Change:
```typescript
hapticFeedback: () => new HapticFeedback(),
```

To:
```typescript
hapticFeedback: () => new HapticFeedback(platformContainer.items.platformDetector),
```

Add the import at the top of core-container.ts:
```typescript
import { platformContainer } from "../index";
```

Note: If circular import is an issue, pass `platformDetector` as a dependency parameter to `createCoreContainer` instead. Check that the platform container is instantiated before the core container in `index.ts`.

If circular import occurs, the alternative is:

In `index.ts`, instantiate `platformContainer` before `coreContainer`, then pass the detector:

```typescript
const platformContainer = createPlatformContainer();
const coreContainer = createCoreContainer();
// After both exist, set the reference:
coreContainer.items.hapticFeedback.setPlatformDetector(platformContainer.items.platformDetector);
```

And add a `setPlatformDetector` method to HapticFeedback:
```typescript
setPlatformDetector(detector: IPlatformDetector): void {
    this.platformDetector = detector;
}
```

Choose whichever approach avoids circular imports in your container wiring.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npm run check
```

Expected: No type errors.

- [ ] **Step 7: Run existing haptic tests to verify no regression**

```bash
npm test -- --run tests/unit/EffortHapticMapper.test.ts
```

Expected: All existing tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/application/services/implementations/HapticFeedback.ts src/lib/shared/di/containers/core-container.ts src/lib/shared/di/index.ts
git commit -m "feat: add native Capacitor haptic feedback with web fallback"
```

---

## Task 6: Call NativeInitializer on App Boot

**Files:**
- Modify: `src/routes/+layout.svelte` (or the root app component that runs on mount)

- [ ] **Step 1: Find the root mount point**

The app's root `+layout.svelte` runs on every page load. Find where it initializes services (likely an `onMount` or `$effect`).

- [ ] **Step 2: Add native initialization call**

In the root layout's initialization logic, add:

```typescript
import { container } from "$lib/shared/di";

// Inside onMount or initialization $effect:
if (typeof window !== "undefined") {
    container.items.nativeInitializer.initialize().catch((err) => {
        console.warn("Native initialization failed (expected on web):", err);
    });
}
```

This is a fire-and-forget call. On web, `initialize()` returns immediately (the `isNative` check short-circuits). On native, it sets up status bar, keyboard, splash screen, and app lifecycle handlers.

- [ ] **Step 3: Verify the app still loads in browser**

```bash
npm run build
```

Expected: Build succeeds. The native plugins are dynamically imported (`await import(...)`) so they won't be loaded or crash on web.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: call NativeInitializer on app boot for Capacitor plugin setup"
```

---

## Task 7: Add Native Build Scripts and Sync

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Verify the build:native script works**

```bash
DISABLE_PWA=true npm run build && npx cap sync android
```

Expected: Web build completes, then Capacitor copies `build/` contents into `android/app/src/main/assets/public/`. Console shows "√ copy android" and "√ update android".

- [ ] **Step 2: Verify Android project can open**

If Android Studio is installed:

```bash
npx cap open android
```

Expected: Android Studio opens with the TKA Composer project. If Android Studio is not installed, skip — this confirms the project structure is valid.

- [ ] **Step 3: Commit any sync-generated changes**

```bash
git add package.json
git commit -m "feat: add native build and sync scripts"
```

---

## Task 8: Create GitHub Actions iOS Build Workflow

**Files:**
- Create: `.github/workflows/ios-build.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/ios-build.yml
name: iOS Build

on:
  workflow_dispatch:
    inputs:
      upload_to_testflight:
        description: "Upload to TestFlight"
        required: false
        default: "false"
        type: boolean
  push:
    tags:
      - "v*"

jobs:
  build-ios:
    runs-on: macos-latest
    timeout-minutes: 20

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build web app (PWA disabled)
        run: DISABLE_PWA=true npm run build

      - name: Add iOS platform
        run: npx cap add ios

      - name: Sync Capacitor
        run: npx cap sync ios

      - name: Build iOS archive
        run: |
          xcodebuild -workspace ios/App/App.xcworkspace \
            -scheme App \
            -configuration Release \
            -destination "generic/platform=iOS" \
            -archivePath build/App.xcarchive \
            archive \
            CODE_SIGN_IDENTITY="" \
            CODE_SIGNING_REQUIRED=NO \
            CODE_SIGNING_ALLOWED=NO

      - name: Upload archive artifact
        uses: actions/upload-artifact@v4
        with:
          name: ios-archive
          path: build/App.xcarchive
          retention-days: 7
```

Note: This builds an unsigned archive. Signing and TestFlight upload require an Apple Developer account ($99/year) and provisioning profiles — those get added when you're ready to submit.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ios-build.yml
git commit -m "ci: add GitHub Actions workflow for iOS builds"
```

---

## Task 9: Fix the ArenaBattleView Direct Vibration Call

The audit found one place that bypasses the HapticFeedback service.

**Files:**
- Modify: `src/lib/features/arena/components/battle/ArenaBattleView.svelte`

- [ ] **Step 1: Find the raw navigator.vibrate call**

Search the file for `navigator.vibrate`. It should be a direct `navigator.vibrate(10)` call during a vote action.

- [ ] **Step 2: Replace with haptic service call**

Replace:
```typescript
if (navigator.vibrate) {
    navigator.vibrate(10);
}
```

With:
```typescript
container.items.hapticFeedback.trigger("selection");
```

Ensure `container` is already imported in the file. If not, add:
```typescript
import { container } from "$lib/shared/di";
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run check
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/arena/components/battle/ArenaBattleView.svelte
git commit -m "fix: use HapticFeedback service instead of raw navigator.vibrate in arena"
```

---

## Task 10: Verify Full Build Pipeline

**Files:** None — verification only.

- [ ] **Step 1: Clean build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: TypeScript check**

```bash
npm run check
```

Expected: No type errors.

- [ ] **Step 3: Run all unit tests**

```bash
npm test -- --run
```

Expected: All tests pass, including new PlatformDetector tests.

- [ ] **Step 4: Native build sync**

```bash
DISABLE_PWA=true npm run build && npx cap sync android
```

Expected: Sync completes without errors.

- [ ] **Step 5: Verify web app still works**

Open `http://localhost:5173` in browser (user's dev server). Confirm the app loads and functions normally. Capacitor code should be invisible — all native imports are behind `isNative` checks or dynamic `await import()`.

- [ ] **Step 6: Final commit if any cleanup needed**

```bash
git status
# If there are any remaining changes:
git add -A && git commit -m "chore: capacitor integration cleanup"
```

---

## Summary

| Task | What it does | Estimated effort |
|------|-------------|-----------------|
| 1 | Install Capacitor, generate Android project | Setup |
| 2 | PlatformDetector service + tests | Small |
| 3 | NativeInitializer service | Small |
| 4 | Wire into DI container | Small |
| 5 | Update HapticFeedback with native branch | Medium |
| 6 | Call initializer on app boot | Small |
| 7 | Verify native build scripts | Verification |
| 8 | GitHub Actions iOS workflow | Small |
| 9 | Fix arena direct vibrate call | Tiny |
| 10 | Full pipeline verification | Verification |

After this plan is complete, TKA Composer will be Capacitor-ready. To actually ship to stores, you'll need:
1. Google Play Developer account ($25) + signing key + store listing
2. Apple Developer account ($99/year) + provisioning profiles + store listing
3. Run on physical Android device to test haptics and status bar
4. Trigger iOS build via GitHub Actions, install via TestFlight on iPhone
