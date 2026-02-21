# Ship Fire Effects to Production — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make fire effects user-facing by adding admin-to-Firestore persistence so Austen's Flame Lab tuning becomes the global default for all users, then release as v0.11.

**Architecture:** Two-layer config model. Admin layer: Austen tunes fire via Flame Lab, publishes to Firestore (`config/fireDefaults`). User layer: users toggle fire on/off, pick Small/Medium/Large intensity tier, and choose Natural/Colored. The 3 tiers are intensity multipliers on the admin baseline — fire point positions and wick sizes are locked. A `FireDefaultsLoader` fetches published config on startup with localStorage write-through cache for offline resilience. A `FireDefaultsPublisher` writes from Flame Lab (admin-gated).

**Tech Stack:** Svelte 5, TypeScript, Firebase Firestore, ITI DI, WebGL2

---

## Task 1: Add Firestore Security Rule for `config/fireDefaults`

**Files:**
- Modify: `firestore.rules:57-73`
- Modify: `deployment/firestore.rules` (same change)

**Step 1: Add the rule**

Add after the `config/quickPerformers` block (line 73) in both files:

```
    // Fire defaults configuration - readable by all (including anonymous), writable by admins
    match /config/fireDefaults {
      allow read: if true;
      allow write: if isAdmin();
    }
```

Read is open to all (including unauthenticated) because fire rendering needs these defaults whether or not the user is signed in. Write is admin-only.

**Step 2: Commit**

```bash
git add firestore.rules deployment/firestore.rules
git commit -m "feat(fire): add Firestore security rule for fire defaults config"
```

---

## Task 2: Define the `FireDefaultsDocument` Domain Type

**Files:**
- Create: `src/lib/shared/animation-engine/domain/types/FireDefaultsDocument.ts`

**Step 1: Create the type**

```typescript
import type { FirePhysicsParams } from "./FireTypes";
import type { PropFirePointConfig } from "./PropFirePoints";

/**
 * Firestore document shape for admin-published fire defaults.
 * Stored at: config/fireDefaults
 *
 * Admin tunes fire in Flame Lab, then publishes here.
 * All users read these as the baseline fire configuration.
 */
export interface FireDefaultsDocument {
  /** Per-prop fire point positions + wick sizes (from Fire Point Editor) */
  firePoints: Record<string, PropFirePointConfig>;

  /** Per-prop physics baseline (from Tuning Tab). Falls back to globalPhysics if absent. */
  propPhysics: Record<string, FirePhysicsParams>;

  /** Global physics baseline — the admin's tuned "Fire Spin" default */
  globalPhysics: FirePhysicsParams;

  /** Firestore server timestamp */
  updatedAt: unknown;

  /** UID of the admin who published */
  updatedBy: string;
}

/**
 * Intensity tier multipliers applied on top of admin physics baseline.
 * Users pick Small/Medium/Large; these scale intensity + flameHeight.
 */
export type FireIntensityTier = "small" | "medium" | "large";

export const FIRE_INTENSITY_TIERS: Record<FireIntensityTier, { intensity: number; flameHeight: number }> = {
  small: { intensity: 0.5, flameHeight: 0.6 },
  medium: { intensity: 1.0, flameHeight: 1.0 },
  large: { intensity: 1.5, flameHeight: 1.4 },
};
```

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/FireDefaultsDocument.ts
git commit -m "feat(fire): add FireDefaultsDocument domain type and intensity tiers"
```

---

## Task 3: Create `IFireDefaultsLoader` Contract

**Files:**
- Create: `src/lib/shared/animation-engine/services/contracts/IFireDefaultsLoader.ts`

**Step 1: Write the interface**

```typescript
import type { FirePhysicsParams } from "../../domain/types/FireTypes";
import type { PropFirePointConfig } from "../../domain/types/PropFirePoints";

/**
 * Loads admin-published fire defaults from Firestore.
 * Provides the baseline fire configuration for all users.
 * Uses localStorage as a write-through cache for offline resilience.
 */
export interface IFireDefaultsLoader {
  /** Load fire defaults from Firestore (or localStorage cache). Call once on app startup. */
  load(): Promise<void>;

  /** Whether defaults have been loaded (from Firestore or cache). */
  isLoaded(): boolean;

  /** Get admin-published fire points for a prop type. Returns null if no admin override. */
  getFirePoints(propType: string): PropFirePointConfig | null;

  /** Get admin-published physics for a prop type. Falls back to global physics. */
  getPhysics(propType: string): FirePhysicsParams | null;

  /** Get the global physics baseline (admin's tuned default). Returns null if not published. */
  getGlobalPhysics(): FirePhysicsParams | null;

  /** Subscribe to real-time updates from Firestore. */
  subscribe(callback: () => void): void;

  /** Clean up Firestore listener. */
  dispose(): void;
}
```

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/services/contracts/IFireDefaultsLoader.ts
git commit -m "feat(fire): add IFireDefaultsLoader contract"
```

---

## Task 4: Create `FireDefaultsLoader` Implementation

**Files:**
- Create: `src/lib/shared/animation-engine/services/implementations/FireDefaultsLoader.ts`

**Step 1: Write the implementation**

Follow the `GlobalFeatureFlagPersister` pattern exactly: Firestore-first load with localStorage write-through cache, onSnapshot subscription for real-time updates.

```typescript
import {
  doc,
  getDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { FirePhysicsParams } from "../../domain/types/FireTypes";
import type { PropFirePointConfig } from "../../domain/types/PropFirePoints";
import type { FireDefaultsDocument } from "../../domain/types/FireDefaultsDocument";
import type { IFireDefaultsLoader } from "../contracts/IFireDefaultsLoader";

const LOG_PREFIX = "[FireDefaultsLoader]";
const FIRESTORE_DOC_PATH = "config/fireDefaults";
const LOCAL_CACHE_KEY = "tka-fire-defaults-cache";

export class FireDefaultsLoader implements IFireDefaultsLoader {
  private firePoints: Map<string, PropFirePointConfig> = new Map();
  private propPhysics: Map<string, FirePhysicsParams> = new Map();
  private globalPhysics: FirePhysicsParams | null = null;
  private loaded = false;
  private unsubscribe: Unsubscribe | null = null;
  private observers: Set<() => void> = new Set();

  private async getDocRef() {
    const firestore = await getFirestoreInstance();
    return doc(firestore, FIRESTORE_DOC_PATH);
  }

  async load(): Promise<void> {
    try {
      const docRef = await this.getDocRef();
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        this.applyDocument(snap.data() as FireDefaultsDocument);
        this.writeLocalCache();
        this.loaded = true;
        return;
      }

      // No Firestore doc yet — try localStorage cache
      this.readLocalCache();
      this.loaded = true;
    } catch (error) {
      console.warn(`${LOG_PREFIX} Firestore load failed, falling back to cache:`, error);
      this.readLocalCache();
      this.loaded = true;
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getFirePoints(propType: string): PropFirePointConfig | null {
    return this.firePoints.get(propType.toLowerCase()) ?? null;
  }

  getPhysics(propType: string): FirePhysicsParams | null {
    return this.propPhysics.get(propType.toLowerCase()) ?? this.globalPhysics;
  }

  getGlobalPhysics(): FirePhysicsParams | null {
    return this.globalPhysics;
  }

  subscribe(callback: () => void): void {
    this.observers.add(callback);

    // Set up Firestore real-time listener (once)
    if (!this.unsubscribe) {
      this.getDocRef()
        .then((docRef) => {
          this.unsubscribe = onSnapshot(
            docRef,
            (snap) => {
              if (snap.exists()) {
                this.applyDocument(snap.data() as FireDefaultsDocument);
                this.writeLocalCache();
                this.notifyObservers();
              }
            },
            (error) => {
              console.error(`${LOG_PREFIX} Snapshot listener error:`, error);
            }
          );
        })
        .catch((error) => {
          console.error(`${LOG_PREFIX} Failed to set up snapshot listener:`, error);
        });
    }
  }

  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.observers.clear();
  }

  private applyDocument(data: FireDefaultsDocument): void {
    this.firePoints.clear();
    this.propPhysics.clear();

    if (data.firePoints) {
      for (const [key, config] of Object.entries(data.firePoints)) {
        if (this.isValidFirePointConfig(config)) {
          this.firePoints.set(key.toLowerCase(), config);
        }
      }
    }

    if (data.propPhysics) {
      for (const [key, params] of Object.entries(data.propPhysics)) {
        if (typeof params === "object" && params !== null) {
          this.propPhysics.set(key.toLowerCase(), params as FirePhysicsParams);
        }
      }
    }

    if (data.globalPhysics && typeof data.globalPhysics === "object") {
      this.globalPhysics = data.globalPhysics;
    }
  }

  private isValidFirePointConfig(config: unknown): config is PropFirePointConfig {
    if (typeof config !== "object" || config === null) return false;
    const c = config as Record<string, unknown>;
    if (!Array.isArray(c.points)) return false;
    return c.points.every(
      (p: unknown) =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as Record<string, unknown>).dx === "number" &&
        typeof (p as Record<string, unknown>).dy === "number" &&
        typeof (p as Record<string, unknown>).flameScale === "number"
    );
  }

  private notifyObservers(): void {
    for (const cb of this.observers) {
      try {
        cb();
      } catch (error) {
        console.error(`${LOG_PREFIX} Observer error:`, error);
      }
    }
  }

  private writeLocalCache(): void {
    try {
      const cache = {
        firePoints: Object.fromEntries(this.firePoints),
        propPhysics: Object.fromEntries(this.propPhysics),
        globalPhysics: this.globalPhysics,
      };
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // localStorage might be full or unavailable
    }
  }

  private readLocalCache(): void {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.firePoints) {
        for (const [key, config] of Object.entries(parsed.firePoints)) {
          if (this.isValidFirePointConfig(config)) {
            this.firePoints.set(key.toLowerCase(), config);
          }
        }
      }
      if (parsed.propPhysics) {
        for (const [key, params] of Object.entries(parsed.propPhysics)) {
          if (typeof params === "object" && params !== null) {
            this.propPhysics.set(key.toLowerCase(), params as FirePhysicsParams);
          }
        }
      }
      if (parsed.globalPhysics && typeof parsed.globalPhysics === "object") {
        this.globalPhysics = parsed.globalPhysics as FirePhysicsParams;
      }
    } catch {
      // Ignore parse errors
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/FireDefaultsLoader.ts
git commit -m "feat(fire): implement FireDefaultsLoader with Firestore + localStorage cache"
```

---

## Task 5: Create `IFireDefaultsPublisher` Contract and Implementation

**Files:**
- Create: `src/lib/shared/animation-engine/services/contracts/IFireDefaultsPublisher.ts`
- Create: `src/lib/shared/animation-engine/services/implementations/FireDefaultsPublisher.ts`

**Step 1: Write the contract**

```typescript
import type { FirePhysicsParams } from "../../domain/types/FireTypes";
import type { PropFirePointConfig } from "../../domain/types/PropFirePoints";

/**
 * Publishes admin-tuned fire defaults to Firestore.
 * Admin-only: writes to config/fireDefaults.
 */
export interface IFireDefaultsPublisher {
  /** Publish fire points + physics to Firestore. Throws if not admin. */
  publish(data: {
    firePoints: Record<string, PropFirePointConfig>;
    propPhysics: Record<string, FirePhysicsParams>;
    globalPhysics: FirePhysicsParams;
  }): Promise<void>;
}
```

**Step 2: Write the implementation**

```typescript
import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, getFirestoreInstance } from "$lib/shared/auth/firebase";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import type { FirePhysicsParams } from "../../domain/types/FireTypes";
import type { PropFirePointConfig } from "../../domain/types/PropFirePoints";
import type { IFireDefaultsPublisher } from "../contracts/IFireDefaultsPublisher";

const FIRESTORE_DOC_PATH = "config/fireDefaults";

export class FireDefaultsPublisher implements IFireDefaultsPublisher {
  async publish(data: {
    firePoints: Record<string, PropFirePointConfig>;
    propPhysics: Record<string, FirePhysicsParams>;
    globalPhysics: FirePhysicsParams;
  }): Promise<void> {
    const firestore = await getFirestoreInstance();
    const docRef = doc(firestore, FIRESTORE_DOC_PATH);
    const uid = auth.currentUser?.uid ?? "unknown";

    await trackWrite(() =>
      setDoc(
        docRef,
        {
          firePoints: data.firePoints,
          propPhysics: data.propPhysics,
          globalPhysics: data.globalPhysics,
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        },
        { merge: true }
      )
    );
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/contracts/IFireDefaultsPublisher.ts src/lib/shared/animation-engine/services/implementations/FireDefaultsPublisher.ts
git commit -m "feat(fire): add FireDefaultsPublisher for admin Firestore writes"
```

---

## Task 6: Register Services in DI Container

**Files:**
- Modify: `src/lib/shared/di/containers/flame-lab-container.ts`

**Step 1: Add registrations**

The existing container registers `firePointOverrideProvider`. Add the two new services:

```typescript
import { createContainer } from "iti";
import { FirePointOverrideProvider } from "$lib/features/flame-lab/services/implementations/FirePointOverrideProvider";
import { setFirePointOverrideProvider } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import { FireDefaultsLoader } from "$lib/shared/animation-engine/services/implementations/FireDefaultsLoader";
import { FireDefaultsPublisher } from "$lib/shared/animation-engine/services/implementations/FireDefaultsPublisher";

export const flameLabContainer = createContainer().add({
	firePointOverrideProvider: () => {
		const provider = new FirePointOverrideProvider();
		setFirePointOverrideProvider((propType) => provider.getOverride(propType));
		return provider;
	},
	fireDefaultsLoader: () => new FireDefaultsLoader(),
	fireDefaultsPublisher: () => new FireDefaultsPublisher(),
});
```

**Step 2: Commit**

```bash
git add src/lib/shared/di/containers/flame-lab-container.ts
git commit -m "feat(fire): register FireDefaultsLoader and FireDefaultsPublisher in DI"
```

---

## Task 7: Wire `FireDefaultsLoader` into the Override Provider

**Files:**
- Modify: `src/lib/shared/animation-engine/domain/types/PropFirePoints.ts:270-284`

The existing `setFirePointOverrideProvider` callback pattern already lets us layer override sources. The change is in `flame-lab-container.ts` — we need to make the override provider check published defaults (from Firestore) as a fallback when no local edit override exists.

**Step 1: Modify `FirePointOverrideProvider` to accept a fallback source**

Modify: `src/lib/features/flame-lab/services/implementations/FirePointOverrideProvider.ts`

Add a method to set the published defaults fallback:

```typescript
// Add to the class:
private publishedDefaults: Map<string, PropFirePointConfig> = new Map();

/** Load published fire point defaults from Firestore config. */
loadPublishedDefaults(defaults: Record<string, PropFirePointConfig>): void {
  this.publishedDefaults.clear();
  for (const [key, config] of Object.entries(defaults)) {
    this.publishedDefaults.set(key.toLowerCase(), config);
  }
}
```

Modify `getOverride` to include the fallback chain — local edit > user default > published default:

```typescript
getOverride(propType: string): PropFirePointConfig | null {
  const key = propType.toLowerCase();
  // 1. Local working edit (auto-saved in Flame Lab)
  const local = this.cache.get(key);
  if (local) return this.deepCopy(local);
  // 2. User-set default (from "Set as Default" button)
  const userDefault = this.defaultsCache.get(key);
  if (userDefault) return this.deepCopy(userDefault);
  // 3. Published admin default (from Firestore)
  const published = this.publishedDefaults.get(key);
  if (published) return this.deepCopy(published);
  return null;
}
```

Also add to `IFirePointOverrideProvider.ts`:

```typescript
/** Load published fire point defaults from admin config. */
loadPublishedDefaults(defaults: Record<string, PropFirePointConfig>): void;
```

**Step 2: Wire loader into provider in DI container**

Modify `flame-lab-container.ts` to connect the loader to the provider:

```typescript
firePointOverrideProvider: ({ fireDefaultsLoader }) => {
  const provider = new FirePointOverrideProvider();
  setFirePointOverrideProvider((propType) => provider.getOverride(propType));

  // Load published defaults from Firestore and subscribe to updates
  fireDefaultsLoader.load().then(() => {
    const firePoints = fireDefaultsLoader.getAllFirePoints();
    if (firePoints) provider.loadPublishedDefaults(firePoints);
  });
  fireDefaultsLoader.subscribe(() => {
    const firePoints = fireDefaultsLoader.getAllFirePoints();
    if (firePoints) provider.loadPublishedDefaults(firePoints);
  });

  return provider;
},
```

Note: This requires adding `getAllFirePoints()` to `IFireDefaultsLoader`:

```typescript
/** Get all published fire point configs as a Record. */
getAllFirePoints(): Record<string, PropFirePointConfig>;
```

And implementing it in `FireDefaultsLoader`:

```typescript
getAllFirePoints(): Record<string, PropFirePointConfig> {
  return Object.fromEntries(this.firePoints);
}
```

**Step 3: Commit**

```bash
git add src/lib/features/flame-lab/services/contracts/IFirePointOverrideProvider.ts src/lib/features/flame-lab/services/implementations/FirePointOverrideProvider.ts src/lib/shared/animation-engine/services/contracts/IFireDefaultsLoader.ts src/lib/shared/animation-engine/services/implementations/FireDefaultsLoader.ts src/lib/shared/di/containers/flame-lab-container.ts
git commit -m "feat(fire): wire Firestore defaults into fire point override chain"
```

---

## Task 8: Rewire `AnimationVisibilityStateManager` — Tier-Based Presets

**Files:**
- Modify: `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts`

The `firePreset` field currently stores preset IDs like `"candlewick"`, `"fire-spin"`, `"torch"`. Change it to store intensity tier IDs: `"small"`, `"medium"`, `"large"`.

**Step 1: Add migration logic in `loadFromStorage()`**

After the existing `flameColorMode` migrations (around line 148), add:

```typescript
// Migrate preset IDs to intensity tiers
if (parsed.firePreset === "candlewick") parsed.firePreset = "small";
else if (parsed.firePreset === "fire-spin") parsed.firePreset = "medium";
else if (parsed.firePreset === "torch") parsed.firePreset = "large";
// Any other preset ID → default to medium
else if (parsed.firePreset && !["small", "medium", "large"].includes(parsed.firePreset)) {
  parsed.firePreset = "medium";
}
```

**Step 2: Update the default**

In `getDefaultSettings()`, change:

```typescript
firePreset: "medium",  // was "fire-spin"
```

**Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts
git commit -m "feat(fire): migrate firePreset from preset IDs to intensity tiers"
```

---

## Task 9: Rewire `AnimationEngine` — Use Admin Defaults + Tier Multipliers

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

This is the critical integration point. The engine currently maps `firePreset` to a `FIRE_PRESETS` entry and uses its `params`. Change it to:

1. Load admin-published physics from `FireDefaultsLoader` as the baseline
2. Apply the user's intensity tier (Small/Medium/Large) as multipliers

**Step 1: Import new types**

```typescript
import { FIRE_INTENSITY_TIERS, type FireIntensityTier } from "../../domain/types/FireDefaultsDocument";
import type { IFireDefaultsLoader } from "../contracts/IFireDefaultsLoader";
```

**Step 2: Accept `fireDefaultsLoader` as a dependency**

The `AnimationEngine` constructor or `initialize()` method needs access to the loader. Add it as a parameter to `initialize()` or inject it. Check how the engine currently receives dependencies and follow the same pattern.

**Step 3: Replace preset lookup with admin defaults + tier**

In the visibility subscription block where fire preset changes are handled, replace:

```typescript
// OLD: Map preset ID to FIRE_PRESETS params
const preset = getFirePreset(firePresetId);
if (preset) {
  this.setFireConfig({ physicsPreset: preset.params });
}
```

With:

```typescript
// NEW: Get admin baseline, apply tier multipliers
const tier = FIRE_INTENSITY_TIERS[firePresetId as FireIntensityTier] ?? FIRE_INTENSITY_TIERS.medium;
const adminPhysics = this.fireDefaultsLoader?.getGlobalPhysics() ?? null;

this.setFireConfig({
  intensity: tier.intensity,
  flameHeight: tier.flameHeight,
  physicsPreset: adminPhysics ?? undefined,
});
```

Do the same for the initial setup in `initialize()`.

**Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts
git commit -m "feat(fire): wire AnimationEngine to admin defaults + intensity tiers"
```

---

## Task 10: Rewire Settings UI — Small/Medium/Large Labels

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/visibility/AnimationDesktopControls.svelte`
- Modify: `src/lib/shared/settings/components/tabs/visibility/AnimationMobileControls.svelte`

**Step 1: Update button value mapping in both files**

Change the 3 preset buttons from:

```
Small → "candlewick"
Medium → "fire-spin"
Large → "torch"
```

To:

```
Small → "small"
Medium → "medium"
Large → "large"
```

The `onFirePresetChange` callback signature stays the same (it takes a string). The button labels stay the same. Only the string values change.

**Step 2: Update the `firePreset ===` checks for active state styling**

Replace `firePreset === "candlewick"` with `firePreset === "small"`, etc.

**Step 3: Commit**

```bash
git add src/lib/shared/settings/components/tabs/visibility/AnimationDesktopControls.svelte src/lib/shared/settings/components/tabs/visibility/AnimationMobileControls.svelte
git commit -m "feat(fire): update settings UI to use intensity tier IDs"
```

---

## Task 11: Add "Publish to Production" Button to Flame Lab

**Files:**
- Modify: `src/lib/features/flame-lab/components/FlameLabTuningTab.svelte`

**Step 1: Add admin detection**

Import auth state and check admin status:

```typescript
import { container } from "$lib/shared/di";
import type { IFireDefaultsPublisher } from "$lib/shared/animation-engine/services/contracts/IFireDefaultsPublisher";
import type { IFirePointOverrideProvider } from "../services/contracts/IFirePointOverrideProvider";
```

Get admin state from `authState`:

```typescript
import { authState } from "$lib/shared/auth/state/authState.svelte";

let isAdmin = $derived(authState.isAdmin());
```

**Step 2: Add the publish function**

```typescript
let publishing = $state(false);
let publishConfirm = $state(false);

async function publishToProduction() {
  publishing = true;
  try {
    const publisher = container.items.fireDefaultsPublisher as IFireDefaultsPublisher;
    const overrideProvider = container.items.firePointOverrideProvider as IFirePointOverrideProvider;

    await publisher.publish({
      firePoints: overrideProvider.exportAll(),
      propPhysics: {},  // Per-prop physics — expand later when Flame Lab supports per-prop tuning
      globalPhysics: adjustedPhysics,
    });

    publishConfirm = false;
  } catch (error) {
    console.error("[FlameLabTuningTab] Publish failed:", error);
  } finally {
    publishing = false;
  }
}
```

**Step 3: Add the button UI**

Add in the controls section, only visible to admins:

```svelte
{#if isAdmin}
  <div class="publish-section">
    {#if !publishConfirm}
      <button class="publish-btn" onclick={() => publishConfirm = true}>
        <i class="fas fa-upload" aria-hidden="true"></i>
        Publish to Production
      </button>
    {:else}
      <div class="publish-confirm">
        <span>Push these fire settings to all users?</span>
        <button class="confirm-btn" onclick={publishToProduction} disabled={publishing}>
          {publishing ? "Publishing..." : "Yes, Publish"}
        </button>
        <button class="cancel-btn" onclick={() => publishConfirm = false}>Cancel</button>
      </div>
    {/if}
  </div>
{/if}
```

**Step 4: Add scoped CSS for the publish section**

```css
.publish-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
}

.publish-btn {
  width: 100%;
  padding: 10px 16px;
  background: var(--semantic-warning, #f59e0b);
  color: #000;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.publish-confirm {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: center;
  color: var(--theme-text, #fff);
}

.confirm-btn {
  padding: 10px;
  background: var(--semantic-success, #22c55e);
  color: #000;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  padding: 8px;
  background: transparent;
  color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  border-radius: 8px;
  cursor: pointer;
}
```

**Step 5: Commit**

```bash
git add src/lib/features/flame-lab/components/FlameLabTuningTab.svelte
git commit -m "feat(fire): add admin Publish to Production button in Flame Lab"
```

---

## Task 12: Deploy Firestore Rules

**Step 1: Deploy just the Firestore rules**

```bash
npx firebase deploy --only firestore:rules
```

**Step 2: Verify the rule is active**

Check the Firebase console or try a test write/read.

**Step 3: Commit — no code changes, just verify deployment**

---

## Task 13: Build Verification

**Step 1: Run TypeScript check**

```bash
npm run check
```

Expected: 0 errors. If there are errors, fix them before proceeding.

**Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 3: Manual test (ask user)**

Ask user to:
1. Open Flame Lab → verify tuning controls work as before
2. Check admin status → verify "Publish to Production" button appears
3. Publish fire defaults → verify no errors
4. Open Settings → Visibility → verify fire toggle + Small/Medium/Large still work
5. Enable fire → verify fire renders with published physics

---

## Task 14: Commit All Uncommitted Changes and Release v0.11.0

**Step 1: Review and commit any remaining uncommitted changes**

The git status at conversation start shows several modified files. Review which changes are related to fire/flame lab and commit them in logical groups.

**Step 2: Run /release to create v0.11.0**

Follow the release workflow in `.claude/rules/release-workflow.md`. Fire effects are a new user-facing capability (users literally could not do this before) → minor bump to 0.11.0.

---

## Summary of All Files

### Created (7 files)
| File | Purpose |
|------|---------|
| `src/lib/shared/animation-engine/domain/types/FireDefaultsDocument.ts` | Domain type + intensity tiers |
| `src/lib/shared/animation-engine/services/contracts/IFireDefaultsLoader.ts` | Loader contract |
| `src/lib/shared/animation-engine/services/implementations/FireDefaultsLoader.ts` | Firestore loader + localStorage cache |
| `src/lib/shared/animation-engine/services/contracts/IFireDefaultsPublisher.ts` | Publisher contract |
| `src/lib/shared/animation-engine/services/implementations/FireDefaultsPublisher.ts` | Admin Firestore writer |

### Modified (8 files)
| File | Change |
|------|--------|
| `firestore.rules` | Add `config/fireDefaults` rule |
| `deployment/firestore.rules` | Same rule |
| `src/lib/shared/di/containers/flame-lab-container.ts` | Register 2 new services, wire loader→provider |
| `src/lib/features/flame-lab/services/contracts/IFirePointOverrideProvider.ts` | Add `loadPublishedDefaults` method |
| `src/lib/features/flame-lab/services/implementations/FirePointOverrideProvider.ts` | Published defaults fallback chain |
| `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts` | Migrate preset IDs to tier IDs |
| `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` | Use admin defaults + tier multipliers |
| `src/lib/shared/settings/components/tabs/visibility/AnimationDesktopControls.svelte` | Tier ID strings |
| `src/lib/shared/settings/components/tabs/visibility/AnimationMobileControls.svelte` | Tier ID strings |
| `src/lib/features/flame-lab/components/FlameLabTuningTab.svelte` | Publish button |

### Unchanged
| File | Why |
|------|-----|
| `WebGLFireRenderer.ts` | Rendering layer doesn't change |
| `FireTipTracker.ts` | Tip tracking doesn't change |
| `PropFirePoints.ts` | Override callback pattern stays as-is |
| `FirePresets.ts` | 8 presets remain as Flame Lab starting points |
