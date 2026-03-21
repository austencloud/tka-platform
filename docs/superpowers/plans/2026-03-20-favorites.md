# Generate Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local preset system with Firebase-backed favorites — one favorite per user, browsable community favorites.

**Architecture:** New `FavoriteConfigRepository` service reads/writes `favoriteConfig` on user documents. New `createFavoriteState()` replaces `createPresetState()`. Existing PresetCard/PresetDrawer get renamed and extended.

**Tech Stack:** Svelte 5, TypeScript, Firebase Firestore, ITI DI, existing Drawer pattern.

**Spec:** `docs/superpowers/specs/2026-03-20-favorites-design.md`

---

### Task 1: Create FavoriteConfig domain model

**Files:**
- Create: `src/lib/features/create/generate/domain/models/favorite-config.ts`

- [ ] **Step 1: Create the model file**

```typescript
import type { UIGenerationConfig } from "../../state/generate-config.svelte";
import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";

export interface FavoriteConfig {
  config: UIGenerationConfig;
  startEndOptions?: StartEndOptions | null;
  setAt: Date;
}

export interface CommunityFavorite {
  userId: string;
  displayName: string;
  avatar?: string;
  config: UIGenerationConfig;
  startEndOptions?: StartEndOptions | null;
  setAt: Date;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/generate/domain/models/favorite-config.ts
git commit -m "feat(generate): add FavoriteConfig domain model"
```

---

### Task 2: Create IFavoriteConfigRepository contract

**Files:**
- Create: `src/lib/features/create/generate/services/contracts/IFavoriteConfigRepository.ts`

- [ ] **Step 1: Create the interface**

```typescript
import type { FavoriteConfig, CommunityFavorite } from "../../domain/models/favorite-config";
import type { UIGenerationConfig } from "../../state/generate-config.svelte";
import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";

export interface IFavoriteConfigRepository {
  getMyFavorite(userId: string): Promise<FavoriteConfig | null>;
  setMyFavorite(
    userId: string,
    config: UIGenerationConfig,
    startEndOptions?: StartEndOptions | null
  ): Promise<void>;
  clearMyFavorite(userId: string): Promise<void>;
  getCommunityFavorites(limit?: number): Promise<CommunityFavorite[]>;
}
```

- [ ] **Step 2: Verify build, commit**

```bash
git add src/lib/features/create/generate/services/contracts/IFavoriteConfigRepository.ts
git commit -m "feat(generate): add IFavoriteConfigRepository contract"
```

---

### Task 3: Implement FavoriteConfigRepository

**Files:**
- Create: `src/lib/features/create/generate/services/implementations/FavoriteConfigRepository.ts`

- [ ] **Step 1: Implement the repository**

Follow the codebase's Firebase patterns:
- Use `getFirestoreInstance()` for lazy Firestore access
- Use `doc()`, `getDoc()`, `updateDoc()`, `deleteField()` from Firebase SDK
- Wrap writes with `trackWrite()` from `$lib/shared/offline/state/sync-status-state.svelte`
- Use `getEffectiveUserId()` pattern for auth
- Error handling: try/catch, console.error with `[FavoriteConfigRepository]` prefix, return null for reads

```typescript
import { doc, getDoc, updateDoc, deleteField, collection, query, where, orderBy, limit as firestoreLimit, getDocs } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/persistence/firebase/firebase-init";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import type { IFavoriteConfigRepository } from "../contracts/IFavoriteConfigRepository";
import type { FavoriteConfig, CommunityFavorite } from "../../domain/models/favorite-config";
import type { UIGenerationConfig } from "../../state/generate-config.svelte";
import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";

export class FavoriteConfigRepository implements IFavoriteConfigRepository {
  private readonly USERS_COLLECTION = "users";

  async getMyFavorite(userId: string): Promise<FavoriteConfig | null> {
    try {
      const db = await getFirestoreInstance();
      const userDoc = await getDoc(doc(db, this.USERS_COLLECTION, userId));

      if (!userDoc.exists()) return null;

      const data = userDoc.data();
      const fav = data.favoriteConfig;
      if (!fav || !fav.config) return null;

      return {
        config: fav.config as UIGenerationConfig,
        startEndOptions: (fav.startEndOptions as StartEndOptions) ?? null,
        setAt: fav.setAt?.toDate?.() ?? new Date(),
      };
    } catch (error) {
      console.error("[FavoriteConfigRepository] Error loading favorite:", error);
      return null;
    }
  }

  async setMyFavorite(
    userId: string,
    config: UIGenerationConfig,
    startEndOptions?: StartEndOptions | null
  ): Promise<void> {
    const db = await getFirestoreInstance();

    await trackWrite(
      () => updateDoc(doc(db, this.USERS_COLLECTION, userId), {
        favoriteConfig: {
          config,
          startEndOptions: startEndOptions ?? null,
          setAt: new Date(),
        },
      }),
      "favorites"
    );
  }

  async clearMyFavorite(userId: string): Promise<void> {
    const db = await getFirestoreInstance();

    await trackWrite(
      () => updateDoc(doc(db, this.USERS_COLLECTION, userId), {
        favoriteConfig: deleteField(),
      }),
      "favorites"
    );
  }

  async getCommunityFavorites(limit = 20): Promise<CommunityFavorite[]> {
    try {
      const db = await getFirestoreInstance();
      const q = query(
        collection(db, this.USERS_COLLECTION),
        where("favoriteConfig", "!=", null),
        orderBy("favoriteConfig"),
        firestoreLimit(limit)
      );

      const snapshot = await getDocs(q);
      const results: CommunityFavorite[] = [];

      for (const userDoc of snapshot.docs) {
        const data = userDoc.data();
        const fav = data.favoriteConfig;
        if (!fav?.config) continue;

        results.push({
          userId: userDoc.id,
          displayName: (data.displayName as string) ?? "Unknown",
          avatar: (data.photoURL as string) ?? undefined,
          config: fav.config as UIGenerationConfig,
          startEndOptions: (fav.startEndOptions as StartEndOptions) ?? null,
          setAt: fav.setAt?.toDate?.() ?? new Date(),
        });
      }

      return results;
    } catch (error) {
      console.error("[FavoriteConfigRepository] Error loading community favorites:", error);
      return [];
    }
  }
}
```

- [ ] **Step 2: Verify build, commit**

```bash
git add src/lib/features/create/generate/services/implementations/FavoriteConfigRepository.ts
git commit -m "feat(generate): implement FavoriteConfigRepository for Firebase"
```

---

### Task 4: Register in DI container

**Files:**
- Modify: `src/lib/shared/di/containers/community-container.ts` (or appropriate container)
- Modify: `src/lib/shared/di/container-types.ts`

- [ ] **Step 1: Register FavoriteConfigRepository**

In the community container (or create-container if one exists), add:

```typescript
import { FavoriteConfigRepository } from "$lib/features/create/generate/services/implementations/FavoriteConfigRepository";

// In the .add() chain:
favoriteConfigRepository: () => new FavoriteConfigRepository(),
```

- [ ] **Step 2: Add to container-types.ts**

Ensure the type is available via `container.items.favoriteConfigRepository`.

- [ ] **Step 3: Verify build, commit**

```bash
git commit -m "feat(generate): register FavoriteConfigRepository in DI container"
```

---

### Task 5: Create favorite-state.svelte.ts

**Files:**
- Create: `src/lib/features/create/generate/state/favorite-state.svelte.ts`

- [ ] **Step 1: Create the state factory**

Replace the preset state pattern with Firebase-backed favorite state:

```typescript
import { untrack } from "svelte";
import { container } from "$lib/shared/di";
import { getEffectiveUserId } from "$lib/shared/auth/state/authState.svelte";
import type { IFavoriteConfigRepository } from "../services/contracts/IFavoriteConfigRepository";
import type { FavoriteConfig, CommunityFavorite } from "../domain/models/favorite-config";
import type { UIGenerationConfig } from "./generate-config.svelte";
import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";

export function createFavoriteState() {
  let myFavorite = $state<FavoriteConfig | null>(null);
  let communityFavorites = $state<CommunityFavorite[]>([]);
  let isLoading = $state(true);
  let activeFavoriteId = $state<string | null>(null);

  // "mine" or a userId from community
  const activeFavorite = $derived(
    activeFavoriteId === "mine"
      ? myFavorite
      : activeFavoriteId
        ? communityFavorites.find((f) => f.userId === activeFavoriteId) ?? null
        : null
  );

  // Get the active config regardless of source
  const activeConfig = $derived(
    activeFavorite
      ? "config" in activeFavorite
        ? activeFavorite
        : null
      : null
  );

  const hasMyFavorite = $derived(myFavorite !== null);

  // Load on creation
  loadFavorites();

  async function loadFavorites() {
    const userId = getEffectiveUserId();
    if (!userId) {
      isLoading = false;
      return;
    }

    try {
      const repo = container.items.favoriteConfigRepository as IFavoriteConfigRepository;
      const [myFav, community] = await Promise.all([
        repo.getMyFavorite(userId),
        repo.getCommunityFavorites(20),
      ]);

      myFavorite = myFav;
      // Filter out own favorite from community list
      communityFavorites = community.filter((f) => f.userId !== userId);
    } catch (error) {
      console.error("[FavoriteState] Error loading favorites:", error);
    } finally {
      isLoading = false;
    }
  }

  async function saveMyFavorite(
    config: UIGenerationConfig,
    startEndOptions?: StartEndOptions | null
  ): Promise<void> {
    const userId = getEffectiveUserId();
    if (!userId) return;

    try {
      const repo = container.items.favoriteConfigRepository as IFavoriteConfigRepository;
      await repo.setMyFavorite(userId, config, startEndOptions);
      myFavorite = { config, startEndOptions, setAt: new Date() };
    } catch (error) {
      console.error("[FavoriteState] Error saving favorite:", error);
    }
  }

  async function clearMyFavorite(): Promise<void> {
    const userId = getEffectiveUserId();
    if (!userId) return;

    try {
      const repo = container.items.favoriteConfigRepository as IFavoriteConfigRepository;
      await repo.clearMyFavorite(userId);
      myFavorite = null;
      if (activeFavoriteId === "mine") {
        activeFavoriteId = null;
      }
    } catch (error) {
      console.error("[FavoriteState] Error clearing favorite:", error);
    }
  }

  function activateFavorite(id: string): void {
    activeFavoriteId = id;
  }

  function deactivateFavorite(): void {
    activeFavoriteId = null;
  }

  return {
    get myFavorite() { return myFavorite; },
    get communityFavorites() { return communityFavorites; },
    get isLoading() { return isLoading; },
    get activeFavoriteId() { return activeFavoriteId; },
    get activeFavorite() { return activeFavorite; },
    get hasMyFavorite() { return hasMyFavorite; },

    loadFavorites,
    saveMyFavorite,
    clearMyFavorite,
    activateFavorite,
    deactivateFavorite,
  };
}
```

- [ ] **Step 2: Verify build, commit**

```bash
git add src/lib/features/create/generate/state/favorite-state.svelte.ts
git commit -m "feat(generate): create Firebase-backed favorite state factory"
```

---

### Task 6: Update PresetCard to FavoriteCard

**Files:**
- Modify: `src/lib/features/create/generate/components/cards/PresetCard.svelte`

- [ ] **Step 1: Update display text**

Change the title from "Preset" to "Favorite". Change display value to show "My Fav" when user's own favorite is active, the community user's name when their favorite is active, or "Browse" when nothing is active.

Props change: accept `activeFavoriteId` and `activeFavoriteName` instead of `activePreset`.

- [ ] **Step 2: Verify build, commit**

```bash
git commit -m "feat(generate): update PresetCard to show favorite terminology"
```

---

### Task 7: Update PresetDrawer to favorites layout

**Files:**
- Modify: `src/lib/features/create/generate/components/presets/PresetDrawer.svelte`

- [ ] **Step 1: Restructure drawer with two sections**

The drawer now has:
1. **"Your Favorite" section** — shows saved favorite config, or "Save Current Config as My Favorite" button
2. **"Community Favorites" section** — list of other users' favorites with avatar + name + summary

Props change:
```typescript
{
  isOpen: boolean;
  myFavorite: FavoriteConfig | null;
  communityFavorites: CommunityFavorite[];
  activeFavoriteId: string | null;
  currentConfig: UIGenerationConfig;  // for "save current" button
  currentStartEndOptions: StartEndOptions | null;
  isLoading: boolean;
  onActivateMine: () => void;
  onActivateCommunity: (userId: string) => void;
  onSaveAsFavorite: () => void;
  onClose: () => void;
}
```

The "Your Favorite" section shows the saved config summary if set, with a tap to activate. If not set, show "Save Current Config" button.

The "Community Favorites" section shows each user's avatar (small circle, 32px), display name, and config summary.

- [ ] **Step 2: Verify build, commit**

```bash
git commit -m "feat(generate): update PresetDrawer with favorites layout"
```

---

### Task 8: Wire favorites into GeneratePanel and CardBasedSettingsContainer

**Files:**
- Modify: `src/lib/features/create/generate/components/GeneratePanel.svelte`
- Modify: `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte`

- [ ] **Step 1: Replace preset state with favorite state in GeneratePanel**

Replace `createPresetState()` with `createFavoriteState()`. Update the `handlePresetSelected` function to handle both "mine" and community favorites. Wire the "Save as Favorite" handler. Pass the new state to both CardBasedSettingsContainer and PresetDrawer.

- [ ] **Step 2: Update CardBasedSettingsContainer prop type**

Change the `presetState` prop type to accept the favorite state shape. The `withPresetDeselect` wrapper stays the same (just calls `deactivateFavorite()` instead of `deactivatePreset()`).

- [ ] **Step 3: Update PresetDrawer mounting in GeneratePanel**

Pass the new props: `myFavorite`, `communityFavorites`, `currentConfig`, `isLoading`, etc.

- [ ] **Step 4: Delete preset.svelte.ts**

Remove the old file. It's fully replaced.

- [ ] **Step 5: Verify build, commit**

```bash
git commit -m "feat(generate): wire Firebase favorites into generate panel"
```

---

### Task 9: Update card-colors.ts and CardHandlers

**Files:**
- Modify: `src/lib/features/create/generate/shared/domain/card-colors.ts`
- Modify: `src/lib/features/create/generate/shared/services/contracts/ICardConfigurator.ts`

- [ ] **Step 1: Rename preset references**

In `card-colors.ts`: rename `preset` key to `favorite` in `CardColors` interface, `DEFAULT_COLORS`, and `BRIGHT_BACKGROUND_COLORS`.

In `ICardConfigurator.ts`: update the `CardHandlers` interface — rename `activePreset` to `activeFavoriteId` and `activeFavoriteName`, remove `GenerationPreset` import.

- [ ] **Step 2: Update CardConfigurator.ts**

Update the preset card descriptor to pass `activeFavoriteId` and `activeFavoriteName` instead of `activePreset`.

- [ ] **Step 3: Update CardBasedSettingsContainer template**

Change `cardColors.preset` to `cardColors.favorite`.

- [ ] **Step 4: Verify build, commit**

```bash
git commit -m "feat(generate): rename preset references to favorite throughout"
```

---

### Task Summary

| Task | Description | Complexity |
|------|-------------|------------|
| 1 | FavoriteConfig model | Mechanical |
| 2 | IFavoriteConfigRepository contract | Mechanical |
| 3 | FavoriteConfigRepository implementation | Standard (Firebase) |
| 4 | DI container registration | Mechanical |
| 5 | favorite-state.svelte.ts | Standard (state factory) |
| 6 | PresetCard -> FavoriteCard rename | Mechanical |
| 7 | PresetDrawer two-section layout | Standard (UI) |
| 8 | Wire into GeneratePanel | Integration |
| 9 | Rename preset -> favorite everywhere | Mechanical |
