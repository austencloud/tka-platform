# Favorite Prop System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let creators declare their favorite props, silently capture intended props on sequence save, add a prop switcher to the sequence viewer, and enable prop-based creator filtering.

**Architecture:** Three new services (PropPreferencePersister, IntendedPropResolver, CreatorPropFilter) registered in DI. New fields on UserProfile and SequenceData. Prop switcher integrated into the existing SequenceViewerOrchestrator context. Account popover gets a "My Props" section. Creators list gets prop filter chips.

**Tech Stack:** Svelte 5 + TypeScript + ITI DI + Firebase Firestore

**Firestore composite index required:** `users` collection: `propsISpinWith` (array-contains) + `lastActivityDate` (desc). This index will be auto-suggested by Firestore on first query failure — follow the link in the error message to create it. Alternatively, add to `firestore.indexes.json`.

---

## Chunk 1: Data Model & Core Services

### Task 1: Add `intendedProp` to SequenceData

**Files:**
- Modify: `src/lib/shared/foundation/domain/models/SequenceData.ts`

- [ ] **Step 1: Add IntendedPropConfig type and field to SequenceData interface**

In `SequenceData.ts`, after the `PropType` import (line 17), the type is already imported. After the `effortTimeline` field (line 105), add:

```typescript
/** Prop configuration the creator intended this sequence to be viewed with.
 * Captured silently at save time from the viewer's current prop settings.
 * null = legacy sequence with no intent recorded. */
readonly intendedProp?: {
  readonly bluePropType: PropType;
  readonly redPropType: PropType;
  readonly catDogMode: boolean;
} | null;
```

- [ ] **Step 2: Add intendedProp to createSequenceData factory**

After the `effortTimeline` spread (line 181), add:

```typescript
...(data.intendedProp !== undefined && { intendedProp: data.intendedProp }),
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/foundation/domain/models/SequenceData.ts
git commit -m "feat(props): add intendedProp field to SequenceData"
```

---

### Task 2: Add prop preference fields to UserProfile

**Files:**
- Modify: `src/lib/shared/community/domain/models/enhanced-user-profile.ts`

- [ ] **Step 1: Import PropType**

Add at top of file after the existing imports (line 7):
```typescript
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
```

- [ ] **Step 2: Add fields to UserProfile interface**

After `pronouns?: string;` (line 29), add:

```typescript
// Prop preferences
/** Props this creator uses (e.g. ["staff", "fan", "club"]) */
propsISpinWith?: PropType[];
/** Their single primary identity prop */
favoriteProp?: PropType | null;
/** Optional catdog combo favorite */
favoriteCatdog?: {
  bluePropType: PropType;
  redPropType: PropType;
} | null;
```

- [ ] **Step 3: Add CreatorSortCriteria value**

Update the `CreatorSortCriteria` type (line 80) to include the new sort option:

```typescript
export type CreatorSortCriteria = "lastActive" | "joinedDate" | "favoriteProp";
```

- [ ] **Step 4: Add prop filter to CreatorQueryOptions**

Update `CreatorQueryOptions` (line 82) to add:

```typescript
export interface CreatorQueryOptions {
  filter?: CreatorFilterType;
  sortBy?: CreatorSortCriteria;
  limit?: number;
  offset?: number;
  /** Filter to creators who spin with these props */
  propFilter?: PropType[];
}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: No new errors (all new fields are optional)

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/community/domain/models/enhanced-user-profile.ts
git commit -m "feat(props): add prop preference fields to UserProfile"
```

---

### Task 3: Create PropPreferencePersister service

**Files:**
- Create: `src/lib/shared/community/services/contracts/IPropPreferencePersister.ts`
- Create: `src/lib/shared/community/services/implementations/PropPreferencePersister.ts`

Note: The `src/lib/shared/community/services/` directory already exists (contains `contracts/IUserRepository.ts`, `implementations/UserRepository.ts`, etc.).

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/shared/community/services/contracts/IPropPreferencePersister.ts
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export interface CatdogCombo {
  bluePropType: PropType;
  redPropType: PropType;
}

export interface PropPreferences {
  propsISpinWith: PropType[];
  favoriteProp: PropType | null;
  favoriteCatdog: CatdogCombo | null;
}

export interface IPropPreferencePersister {
  /** Load prop preferences for a user. Returns null defaults if none set. */
  load(userId: string): Promise<PropPreferences>;

  /** Save prop preferences to user profile. Validates constraints before writing. */
  save(userId: string, prefs: PropPreferences): Promise<void>;

  /** Add a prop to propsISpinWith. No-op if already present. */
  addProp(userId: string, prop: PropType): Promise<void>;

  /** Remove a prop from propsISpinWith. Clears favorite if it was the removed prop. */
  removeProp(userId: string, prop: PropType): Promise<void>;

  /** Set the favorite prop. Must be in propsISpinWith. */
  setFavorite(userId: string, prop: PropType): Promise<void>;

  /** Set catdog favorite combo. Both props must be in propsISpinWith. */
  setCatdogFavorite(userId: string, combo: CatdogCombo | null): Promise<void>;
}
```

- [ ] **Step 2: Create the implementation**

```typescript
// src/lib/shared/community/services/implementations/PropPreferencePersister.ts
import {
  doc,
  getDoc,
  updateDoc,
  getFirestore,
} from "firebase/firestore";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type {
  IPropPreferencePersister,
  PropPreferences,
  CatdogCombo,
} from "../contracts/IPropPreferencePersister";

const DEFAULT_PREFS: PropPreferences = {
  propsISpinWith: [],
  favoriteProp: null,
  favoriteCatdog: null,
};

export class PropPreferencePersister implements IPropPreferencePersister {
  async load(userId: string): Promise<PropPreferences> {
    const db = getFirestore();
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return { ...DEFAULT_PREFS };

    const data = userDoc.data();
    return {
      propsISpinWith: (data.propsISpinWith as PropType[]) ?? [],
      favoriteProp: (data.favoriteProp as PropType) ?? null,
      favoriteCatdog: (data.favoriteCatdog as CatdogCombo) ?? null,
    };
  }

  async save(userId: string, prefs: PropPreferences): Promise<void> {
    this.validate(prefs);
    const db = getFirestore();
    await updateDoc(doc(db, "users", userId), {
      propsISpinWith: prefs.propsISpinWith,
      favoriteProp: prefs.favoriteProp,
      favoriteCatdog: prefs.favoriteCatdog,
    });
  }

  async addProp(userId: string, prop: PropType): Promise<void> {
    const prefs = await this.load(userId);
    if (prefs.propsISpinWith.includes(prop)) return;
    prefs.propsISpinWith.push(prop);
    await this.save(userId, prefs);
  }

  async removeProp(userId: string, prop: PropType): Promise<void> {
    const prefs = await this.load(userId);
    prefs.propsISpinWith = prefs.propsISpinWith.filter((p) => p !== prop);

    if (prefs.favoriteProp === prop) {
      prefs.favoriteProp = null;
    }

    if (
      prefs.favoriteCatdog &&
      (prefs.favoriteCatdog.bluePropType === prop ||
        prefs.favoriteCatdog.redPropType === prop)
    ) {
      prefs.favoriteCatdog = null;
    }

    await this.save(userId, prefs);
  }

  async setFavorite(userId: string, prop: PropType): Promise<void> {
    const prefs = await this.load(userId);
    if (!prefs.propsISpinWith.includes(prop)) {
      prefs.propsISpinWith.push(prop);
    }
    prefs.favoriteProp = prop;
    await this.save(userId, prefs);
  }

  async setCatdogFavorite(
    userId: string,
    combo: CatdogCombo | null
  ): Promise<void> {
    const prefs = await this.load(userId);
    if (combo) {
      if (!prefs.propsISpinWith.includes(combo.bluePropType)) {
        prefs.propsISpinWith.push(combo.bluePropType);
      }
      if (!prefs.propsISpinWith.includes(combo.redPropType)) {
        prefs.propsISpinWith.push(combo.redPropType);
      }
    }
    prefs.favoriteCatdog = combo;
    await this.save(userId, prefs);
  }

  private validate(prefs: PropPreferences): void {
    if (
      prefs.favoriteProp &&
      !prefs.propsISpinWith.includes(prefs.favoriteProp)
    ) {
      throw new Error(
        `favoriteProp "${prefs.favoriteProp}" must be in propsISpinWith`
      );
    }
    if (prefs.favoriteCatdog) {
      if (!prefs.propsISpinWith.includes(prefs.favoriteCatdog.bluePropType)) {
        throw new Error(
          `catdog blue "${prefs.favoriteCatdog.bluePropType}" must be in propsISpinWith`
        );
      }
      if (!prefs.propsISpinWith.includes(prefs.favoriteCatdog.redPropType)) {
        throw new Error(
          `catdog red "${prefs.favoriteCatdog.redPropType}" must be in propsISpinWith`
        );
      }
    }
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/community/services/contracts/IPropPreferencePersister.ts src/lib/shared/community/services/implementations/PropPreferencePersister.ts
git commit -m "feat(props): add PropPreferencePersister service"
```

---

### Task 4: Create IntendedPropResolver service

**Files:**
- Create: `src/lib/shared/sequence-viewer/services/contracts/IIntendedPropResolver.ts`
- Create: `src/lib/shared/sequence-viewer/services/implementations/IntendedPropResolver.ts`

Note: The `src/lib/shared/sequence-viewer/services/` directory already exists.

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/shared/sequence-viewer/services/contracts/IIntendedPropResolver.ts
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/** Resolved prop configuration for rendering */
export interface ResolvedPropConfig {
  bluePropType: PropType;
  redPropType: PropType;
  catDogMode: boolean;
  /** Where this config came from */
  source: "intended" | "creator-favorite" | "viewer-settings";
}

export interface IIntendedPropResolver {
  /**
   * Resolve which props to render a sequence with, following the cascade:
   * 1. Sequence's intendedProp (if set)
   * 2. Creator's favoriteProp (if set)
   * 3. Viewer's own settings (fallback)
   */
  resolve(
    sequence: SequenceData,
    creatorFavoriteProp: PropType | null,
    viewerBlue: PropType,
    viewerRed: PropType,
    viewerCatDog: boolean
  ): ResolvedPropConfig;
}
```

- [ ] **Step 2: Create the implementation**

```typescript
// src/lib/shared/sequence-viewer/services/implementations/IntendedPropResolver.ts
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  IIntendedPropResolver,
  ResolvedPropConfig,
} from "../contracts/IIntendedPropResolver";

export class IntendedPropResolver implements IIntendedPropResolver {
  resolve(
    sequence: SequenceData,
    creatorFavoriteProp: PropType | null,
    viewerBlue: PropType,
    viewerRed: PropType,
    viewerCatDog: boolean
  ): ResolvedPropConfig {
    // Priority 1: Sequence's explicit intended prop
    if (sequence.intendedProp) {
      return {
        bluePropType: sequence.intendedProp.bluePropType,
        redPropType: sequence.intendedProp.redPropType,
        catDogMode: sequence.intendedProp.catDogMode,
        source: "intended",
      };
    }

    // Priority 2: Creator's favorite prop (same prop for both hands)
    if (creatorFavoriteProp) {
      return {
        bluePropType: creatorFavoriteProp,
        redPropType: creatorFavoriteProp,
        catDogMode: false,
        source: "creator-favorite",
      };
    }

    // Priority 3: Viewer's own settings
    return {
      bluePropType: viewerBlue,
      redPropType: viewerRed,
      catDogMode: viewerCatDog,
      source: "viewer-settings",
    };
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/contracts/IIntendedPropResolver.ts src/lib/shared/sequence-viewer/services/implementations/IntendedPropResolver.ts
git commit -m "feat(props): add IntendedPropResolver service"
```

---

### Task 5: Create CreatorPropFilter service

**Files:**
- Create: `src/lib/features/browse/creators/services/contracts/ICreatorPropFilter.ts`
- Create: `src/lib/features/browse/creators/services/implementations/CreatorPropFilter.ts`

Note: Create `src/lib/features/browse/creators/services/`, `services/contracts/`, and `services/implementations/` directories — they don't exist yet.

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/lib/features/browse/creators/services/contracts src/lib/features/browse/creators/services/implementations
```

- [ ] **Step 2: Create the interface**

```typescript
// src/lib/features/browse/creators/services/contracts/ICreatorPropFilter.ts
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";

export interface ICreatorPropFilter {
  /** Query creators who spin with a specific prop. Returns user profiles. */
  queryByProp(
    prop: PropType,
    limit: number
  ): Promise<UserProfile[]>;

  /** Client-side filter: narrow a list of profiles to those matching ALL selected props. */
  filterByProps(
    profiles: UserProfile[],
    requiredProps: PropType[]
  ): UserProfile[];

  /** Client-side group: group profiles by their favoriteProp. */
  groupByFavoriteProp(
    profiles: UserProfile[]
  ): Map<PropType | "none", UserProfile[]>;
}
```

- [ ] **Step 3: Create the implementation**

**Important:** The Firestore `users` collection stores the timestamp as `lastActivityDate`, not `lastActiveAt`. The `lastActiveAt` field exists only in the in-app UserProfile model after mapping.

```typescript
// src/lib/features/browse/creators/services/implementations/CreatorPropFilter.ts
import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  getFirestore,
} from "firebase/firestore";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
import type { ICreatorPropFilter } from "../contracts/ICreatorPropFilter";

export class CreatorPropFilter implements ICreatorPropFilter {
  async queryByProp(
    prop: PropType,
    maxResults: number
  ): Promise<UserProfile[]> {
    const db = getFirestore();
    // NOTE: Firestore field is "lastActivityDate" (raw doc), mapped to "lastActiveAt" in app models
    const q = query(
      collection(db, "users"),
      where("propsISpinWith", "array-contains", prop),
      orderBy("lastActivityDate", "desc"),
      firestoreLimit(maxResults)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as UserProfile[];
  }

  filterByProps(
    profiles: UserProfile[],
    requiredProps: PropType[]
  ): UserProfile[] {
    if (requiredProps.length === 0) return profiles;

    return profiles.filter((profile) => {
      const userProps = profile.propsISpinWith ?? [];
      return requiredProps.every((prop) => userProps.includes(prop));
    });
  }

  groupByFavoriteProp(
    profiles: UserProfile[]
  ): Map<PropType | "none", UserProfile[]> {
    const groups = new Map<PropType | "none", UserProfile[]>();

    for (const profile of profiles) {
      const key = profile.favoriteProp ?? "none";
      const group = groups.get(key) ?? [];
      group.push(profile);
      groups.set(key, group);
    }

    return groups;
  }
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/browse/creators/services/contracts/ICreatorPropFilter.ts src/lib/features/browse/creators/services/implementations/CreatorPropFilter.ts
git commit -m "feat(props): add CreatorPropFilter service"
```

---

### Task 6: Register new services in DI

**Files:**
- Modify: `src/lib/shared/di/containers/community-container.ts`
- Modify: `src/lib/shared/di/container-types.ts`

The three new services should be registered in `community-container.ts` since PropPreferencePersister and CreatorPropFilter are community-related. IntendedPropResolver is stateless and lightweight — register it there too for simplicity.

- [ ] **Step 1: Add imports and registrations to community-container.ts**

In `src/lib/shared/di/containers/community-container.ts`, add imports after existing imports (line 17):

```typescript
import { PropPreferencePersister } from "$lib/shared/community/services/implementations/PropPreferencePersister";
import { IntendedPropResolver } from "$lib/shared/sequence-viewer/services/implementations/IntendedPropResolver";
import { CreatorPropFilter } from "$lib/features/browse/creators/services/implementations/CreatorPropFilter";
```

Add to the `.add({})` block (after line 28):

```typescript
propPreferencePersister: () => new PropPreferencePersister(),
intendedPropResolver: () => new IntendedPropResolver(),
creatorPropFilter: () => new CreatorPropFilter(),
```

- [ ] **Step 2: Verify container-types.ts picks up the new services**

`container-types.ts` already imports `CommunityContainer` (line 23) and extracts `CommunityItems = ItemsOf<CommunityContainer>` (line 95). Because we're adding to the existing `communityContainer`, the type system picks up the new services automatically. No changes needed to `container-types.ts`.

Verify by running `npm run check`. The new services should be accessible as:
- `container.items.propPreferencePersister`
- `container.items.intendedPropResolver`
- `container.items.creatorPropFilter`

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/di/containers/community-container.ts
git commit -m "feat(props): register prop services in DI container"
```

---

## Chunk 2: Sequence Save & Viewer Prop Switcher

### Task 7: Capture intendedProp on sequence save

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` (lines 948-966, `handleSave` function)

The save path works as follows:
1. `SequenceViewerOrchestrator.handleSave()` (line 948) calls `libraryRepo.saveSequence(sequence)`
2. `LibraryRepository.saveSequence()` (line 236) builds the Firestore document via `...libSeq` spread (line 353)
3. The spread includes all fields on the SequenceData object, so `intendedProp` will flow through automatically IF we attach it to the sequence before calling `saveSequence`.

- [ ] **Step 1: Attach intendedProp to sequence before save**

In `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`, modify the `handleSave` function (line 948). Before `await libraryRepo.saveSequence(sequence)` (line 960), create an enriched sequence with the current prop config:

```typescript
async function handleSave() {
  hapticService?.trigger("selection");
  if (!authState.isAuthenticated) {
    showToast("Sign in to save sequences", "info");
    return;
  }
  if (!sequence) {
    showToast("No sequence to save", "info");
    return;
  }
  try {
    const libraryRepo = container.items.libraryRepository;
    // Attach current prop config as intended prop
    const sequenceWithIntent = createSequenceData({
      ...sequence,
      intendedProp: {
        bluePropType: bluePropType ?? PropType.STAFF,
        redPropType: redPropType ?? PropType.STAFF,
        catDogMode: catDogModeEnabled ?? false,
      },
    });
    await libraryRepo.saveSequence(sequenceWithIntent);
    showToast("Saved to library", "success");
  } catch (error) {
    console.error("Failed to save sequence:", error);
    showToast("Failed to save sequence", "error");
  }
}
```

Add import at top of `<script lang="ts">` section:
```typescript
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "feat(props): capture intendedProp on sequence save"
```

---

### Task 8: Add prop source state to SequenceViewerOrchestrator

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`

- [ ] **Step 1: Add prop source tracking to OrchestratorContext**

In the `OrchestratorContext` interface (starts at line 46), add after `catDogModeEnabled` (line 89):

```typescript
// Prop source tracking
propSource: "intended" | "creator-favorite" | "viewer-settings" | "quick-switch";
hasIntendedProp: boolean;
handlePropSourceChange: (source: "intended" | "viewer-settings" | "quick-switch") => void;
handleQuickSwitchProp: (blue: PropType, red: PropType, catDog: boolean) => void;
handleSetAsIntended: () => Promise<void>;
```

- [ ] **Step 2: Implement the prop source state**

In the `<script lang="ts">` section, after the existing settings derivations (lines 295-297 where `bluePropType`, `redPropType`, `catDogModeEnabled` are derived from `settings`), add:

```typescript
// Prop source tracking — which prop config is currently active
let propSourceOverride = $state<"intended" | "viewer-settings" | "quick-switch" | null>(null);
let quickSwitchBlue = $state<PropType | undefined>(undefined);
let quickSwitchRed = $state<PropType | undefined>(undefined);
let quickSwitchCatDog = $state<boolean>(false);

const hasIntendedProp = $derived(!!sequence?.intendedProp);

// Default to "intended" if sequence has intendedProp, otherwise "viewer-settings"
const propSource = $derived(
  propSourceOverride ?? (hasIntendedProp ? "intended" : "viewer-settings")
);

// Resolve the active prop config based on source
const activeBlueProp = $derived.by(() => {
  if (propSource === "intended" && sequence?.intendedProp) {
    return sequence.intendedProp.bluePropType;
  }
  if (propSource === "quick-switch" && quickSwitchBlue) {
    return quickSwitchBlue;
  }
  return bluePropType; // viewer settings
});

const activeRedProp = $derived.by(() => {
  if (propSource === "intended" && sequence?.intendedProp) {
    return sequence.intendedProp.redPropType;
  }
  if (propSource === "quick-switch" && quickSwitchRed) {
    return quickSwitchRed;
  }
  return redPropType; // viewer settings
});

const activeCatDog = $derived.by(() => {
  if (propSource === "intended" && sequence?.intendedProp) {
    return sequence.intendedProp.catDogMode;
  }
  if (propSource === "quick-switch") {
    return quickSwitchCatDog;
  }
  return catDogModeEnabled; // viewer settings
});
```

- [ ] **Step 3: Add handler functions**

Add these near the other handler functions (around line 948):

```typescript
function handlePropSourceChange(source: "intended" | "viewer-settings" | "quick-switch") {
  propSourceOverride = source;
}

function handleQuickSwitchProp(blue: PropType, red: PropType, catDog: boolean) {
  quickSwitchBlue = blue;
  quickSwitchRed = red;
  quickSwitchCatDog = catDog;
  propSourceOverride = "quick-switch";
}

async function handleSetAsIntended() {
  if (!sequence || !isOwned) return;
  const currentBlue = activeBlueProp;
  const currentRed = activeRedProp;
  const currentCatDog = activeCatDog;
  if (!currentBlue || !currentRed) return;

  try {
    const libraryRepo = container.items.libraryRepository;
    const updatedSequence = createSequenceData({
      ...sequence,
      intendedProp: {
        bluePropType: currentBlue,
        redPropType: currentRed,
        catDogMode: currentCatDog ?? false,
      },
    });
    await libraryRepo.saveSequence(updatedSequence);
    showToast("Intended prop updated", "success");
  } catch (error) {
    console.error("Failed to update intended prop:", error);
    showToast("Failed to update intended prop", "error");
  }
}
```

- [ ] **Step 4: Wire active props into the context object**

Replace the existing `bluePropType`, `redPropType`, `catDogModeEnabled` references in the context object (around line 1166-1168) with the active prop values:

```typescript
bluePropType: activeBlueProp,
redPropType: activeRedProp,
catDogModeEnabled: activeCatDog,
propSource,
hasIntendedProp,
handlePropSourceChange,
handleQuickSwitchProp,
handleSetAsIntended,
```

Also update the `splitPanePropRendering` assembly (around line 1247-1249) to use the active values:

```typescript
splitPanePropRendering: {
  bluePropType: activeBlueProp,
  redPropType: activeRedProp,
  catDogModeEnabled: activeCatDog,
},
```

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "feat(props): add prop source state to viewer orchestrator"
```

---

### Task 9: Create PropSwitcher UI component

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/PropSwitcher.svelte`

- [ ] **Step 1: Create the component**

The `getPropTypeDisplayInfo` function is exported from `$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry.ts`.

```svelte
<!--
  PropSwitcher.svelte

  Compact prop source toggle for the sequence viewer.
  Lets the viewer switch between creator's intended prop and their own settings.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

  interface Props {
    propSource: "intended" | "creator-favorite" | "viewer-settings" | "quick-switch";
    hasIntendedProp: boolean;
    bluePropType: PropType | undefined;
    redPropType: PropType | undefined;
    isOwned: boolean;
    onSourceChange: (source: "intended" | "viewer-settings" | "quick-switch") => void;
    onQuickSwitch: (blue: PropType, red: PropType, catDog: boolean) => void;
    onSetAsIntended: () => Promise<void>;
  }

  let {
    propSource,
    hasIntendedProp,
    bluePropType,
    redPropType,
    isOwned,
    onSourceChange,
    onQuickSwitch,
    onSetAsIntended,
  }: Props = $props();

  const sourceLabel = $derived.by(() => {
    switch (propSource) {
      case "intended": return "Creator's choice";
      case "creator-favorite": return "Creator's favorite";
      case "viewer-settings": return "My settings";
      case "quick-switch": return "Custom";
    }
  });

  const propLabel = $derived.by(() => {
    if (!bluePropType) return "";
    if (bluePropType === redPropType) {
      return getPropTypeDisplayInfo(bluePropType).label;
    }
    return `${getPropTypeDisplayInfo(bluePropType).label} / ${getPropTypeDisplayInfo(redPropType!).label}`;
  });

  function handleToggle() {
    if (!hasIntendedProp) {
      // No intended prop — nothing to toggle between
      return;
    }

    // Cycle: intended → viewer-settings → intended
    if (propSource === "intended") {
      onSourceChange("viewer-settings");
    } else {
      onSourceChange("intended");
    }
  }
</script>

<div class="prop-switcher">
  <button
    type="button"
    class="prop-toggle"
    class:has-intended={hasIntendedProp}
    onclick={handleToggle}
    aria-label="Switch prop display: {sourceLabel}"
  >
    <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
    <span class="source-label">{sourceLabel}</span>
    {#if propLabel}
      <span class="prop-label">{propLabel}</span>
    {/if}
  </button>

  {#if isOwned && propSource === "quick-switch"}
    <button
      type="button"
      class="set-intended-btn"
      onclick={() => onSetAsIntended()}
      aria-label="Set current prop as intended for this sequence"
    >
      <i class="fas fa-thumbtack" aria-hidden="true"></i>
      Set as intended
    </button>
  {/if}
</div>

<style>
  .prop-switcher {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .prop-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .prop-toggle:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .prop-toggle.has-intended {
    border-color: color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .prop-toggle i {
    font-size: 12px;
    opacity: 0.7;
  }

  .source-label {
    font-weight: 600;
  }

  .prop-label {
    opacity: 0.6;
  }

  .set-intended-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: 6px;
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .set-intended-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
  }

  .set-intended-btn i {
    font-size: 10px;
  }

  @media (prefers-reduced-motion: reduce) {
    .prop-toggle,
    .set-intended-btn {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/PropSwitcher.svelte
git commit -m "feat(props): add PropSwitcher component for viewer"
```

---

### Task 10: Integrate PropSwitcher into ViewerFooter

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`
- Modify: `src/routes/sequence/[id]/+page.svelte`

- [ ] **Step 1: Add prop switcher props to ViewerFooter**

In `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte`, add to the `Props` interface (line 25) after `onDeleteRequest` (line 48):

```typescript
// Prop switcher
propSource?: "intended" | "creator-favorite" | "viewer-settings" | "quick-switch";
hasIntendedProp?: boolean;
bluePropType?: PropType;
redPropType?: PropType;
onPropSourceChange?: (source: "intended" | "viewer-settings" | "quick-switch") => void;
onQuickSwitchProp?: (blue: PropType, red: PropType, catDog: boolean) => void;
onSetAsIntended?: () => Promise<void>;
```

Add import:
```typescript
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import PropSwitcher from "./PropSwitcher.svelte";
```

Destructure the new props in the `let { ... } = $props()` block.

- [ ] **Step 2: Add PropSwitcher to the desktop layout**

In the desktop layout's `.footer-right .actions-section` div (around line 280), add PropSwitcher BEFORE the action buttons:

```svelte
{#if hasIntendedProp || isOwned}
  <PropSwitcher
    propSource={propSource ?? "viewer-settings"}
    hasIntendedProp={hasIntendedProp ?? false}
    {bluePropType}
    {redPropType}
    isOwned={isOwned ?? false}
    onSourceChange={onPropSourceChange ?? (() => {})}
    onQuickSwitch={onQuickSwitchProp ?? (() => {})}
    onSetAsIntended={onSetAsIntended ?? (async () => {})}
  />
{/if}
```

- [ ] **Step 3: Add PropSwitcher to ViewerMorphToolbar**

In `src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte`, add the same prop interface additions and render PropSwitcher within the toolbar's action chip area. The MorphToolbar uses a chip-based layout — add a prop switcher chip that opens the toggle.

- [ ] **Step 4: Wire from SequenceViewerDrawerHost**

In `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`, the orchestrator context `ctx` is passed to child components. Where ViewerFooter is rendered (search for `<ViewerFooter`), add the new prop fields from `ctx`:

```svelte
propSource={ctx.propSource}
hasIntendedProp={ctx.hasIntendedProp}
bluePropType={ctx.bluePropType}
redPropType={ctx.redPropType}
onPropSourceChange={ctx.handlePropSourceChange}
onQuickSwitchProp={ctx.handleQuickSwitchProp}
onSetAsIntended={ctx.handleSetAsIntended}
```

- [ ] **Step 5: Wire from route page**

In `src/routes/sequence/[id]/+page.svelte`, find where ViewerFooter is rendered and add the same props from the orchestrator context.

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerFooter.svelte src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte src/routes/sequence/[id]/+page.svelte
git commit -m "feat(props): integrate PropSwitcher into viewer footer"
```

---

## Chunk 3: Account UI & Onboarding

### Task 11: Create prop-preference-state factory

**Files:**
- Create: `src/lib/shared/community/state/prop-preference-state.svelte.ts`

Note: Create `src/lib/shared/community/state/` directory if it doesn't exist.

- [ ] **Step 1: Create the reactive state factory**

```typescript
// src/lib/shared/community/state/prop-preference-state.svelte.ts
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type {
  IPropPreferencePersister,
  CatdogCombo,
} from "../services/contracts/IPropPreferencePersister";

export function createPropPreferenceState(
  persister: IPropPreferencePersister,
  userId: string
) {
  let propsISpinWith = $state<PropType[]>([]);
  let favoriteProp = $state<PropType | null>(null);
  let favoriteCatdog = $state<CatdogCombo | null>(null);
  let loading = $state(true);
  let saving = $state(false);

  async function load() {
    loading = true;
    try {
      const prefs = await persister.load(userId);
      propsISpinWith = prefs.propsISpinWith;
      favoriteProp = prefs.favoriteProp;
      favoriteCatdog = prefs.favoriteCatdog;
    } finally {
      loading = false;
    }
  }

  async function toggleProp(prop: PropType) {
    saving = true;
    try {
      if (propsISpinWith.includes(prop)) {
        propsISpinWith = propsISpinWith.filter((p) => p !== prop);
        if (favoriteProp === prop) favoriteProp = null;
        if (
          favoriteCatdog &&
          (favoriteCatdog.bluePropType === prop || favoriteCatdog.redPropType === prop)
        ) {
          favoriteCatdog = null;
        }
        await persister.removeProp(userId, prop);
      } else {
        propsISpinWith = [...propsISpinWith, prop];
        await persister.addProp(userId, prop);
      }
    } finally {
      saving = false;
    }
  }

  async function setFavorite(prop: PropType) {
    saving = true;
    try {
      if (!propsISpinWith.includes(prop)) {
        propsISpinWith = [...propsISpinWith, prop];
      }
      favoriteProp = prop;
      await persister.setFavorite(userId, prop);
    } finally {
      saving = false;
    }
  }

  async function setCatdogFavorite(combo: CatdogCombo | null) {
    saving = true;
    try {
      if (combo) {
        if (!propsISpinWith.includes(combo.bluePropType)) {
          propsISpinWith = [...propsISpinWith, combo.bluePropType];
        }
        if (!propsISpinWith.includes(combo.redPropType)) {
          propsISpinWith = [...propsISpinWith, combo.redPropType];
        }
      }
      favoriteCatdog = combo;
      await persister.setCatdogFavorite(userId, combo);
    } finally {
      saving = false;
    }
  }

  // Auto-load on creation
  void load();

  return {
    get propsISpinWith() { return propsISpinWith; },
    get favoriteProp() { return favoriteProp; },
    get favoriteCatdog() { return favoriteCatdog; },
    get loading() { return loading; },
    get saving() { return saving; },
    toggleProp,
    setFavorite,
    setCatdogFavorite,
    reload: load,
  };
}

export type PropPreferenceState = ReturnType<typeof createPropPreferenceState>;
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/community/state/prop-preference-state.svelte.ts
git commit -m "feat(props): add prop-preference-state factory"
```

---

### Task 12: Create MyPropsCard component for Account popover

**Files:**
- Create: `src/lib/shared/navigation/components/account/MyPropsCard.svelte`
- Modify: `src/lib/shared/navigation/components/account/AccountPopover.svelte`

- [ ] **Step 1: Create MyPropsCard component**

```svelte
<!--
  MyPropsCard.svelte

  Compact section in Account popover showing the user's prop preferences.
  Tapping opens a drawer/sheet for full prop selection using BentoPropGrid.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import { createPropPreferenceState } from "$lib/shared/community/state/prop-preference-state.svelte";
  import type { IPropPreferencePersister } from "$lib/shared/community/services/contracts/IPropPreferencePersister";

  interface Props {
    onOpenPropEditor: () => void;
  }

  let { onOpenPropEditor }: Props = $props();

  const userId = $derived(authState.user?.uid);

  // Create prop preference state when userId is available
  const propState = $derived.by(() => {
    if (!userId) return null;
    const persister = container.items.propPreferencePersister as IPropPreferencePersister;
    return createPropPreferenceState(persister, userId);
  });

  const favoriteProp = $derived(propState?.favoriteProp);
  const propsCount = $derived(propState?.propsISpinWith.length ?? 0);
  const loading = $derived(propState?.loading ?? true);
</script>

{#if !loading}
  <button
    class="my-props-card"
    onclick={onOpenPropEditor}
    aria-label={favoriteProp ? `My props: ${getPropTypeDisplayInfo(favoriteProp).label}` : "Pick your props"}
  >
    <div class="props-icon">
      {#if favoriteProp}
        <img
          src={getPropTypeDisplayInfo(favoriteProp).image}
          alt={getPropTypeDisplayInfo(favoriteProp).label}
          class="fav-prop-img"
        />
      {:else}
        <i class="fas fa-fire" aria-hidden="true"></i>
      {/if}
    </div>
    <div class="props-info">
      {#if favoriteProp}
        <span class="props-label">{getPropTypeDisplayInfo(favoriteProp).label}</span>
        {#if propsCount > 1}
          <span class="props-count">+{propsCount - 1} more</span>
        {/if}
      {:else}
        <span class="props-label">Pick your props</span>
        <span class="props-count">What do you spin?</span>
      {/if}
    </div>
    <i class="fas fa-chevron-right props-arrow" aria-hidden="true"></i>
  </button>
{/if}

<style>
  .my-props-card {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    margin: 0 4px;
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .my-props-card:hover {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 35%, transparent);
  }

  .my-props-card:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .props-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--theme-accent, #6366f1);
    font-size: 16px;
  }

  .fav-prop-img {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }

  .props-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .props-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .props-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .props-arrow {
    font-size: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .my-props-card {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Add MyPropsCard to AccountPopover**

In `src/lib/shared/navigation/components/account/AccountPopover.svelte`:

Add import:
```typescript
import MyPropsCard from "./MyPropsCard.svelte";
```

In the template, after the identity header closing `</div>` (line 151) and before the actions `<div class="actions">` (line 154), add:

```svelte
{#if isAuthenticated}
  <div class="props-section">
    <MyPropsCard onOpenPropEditor={() => { /* TODO: open prop editor drawer/settings */ onClose(); }} />
  </div>
{/if}
```

Add CSS for the new section:
```css
.props-section {
  padding: 4px 8px;
  border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/navigation/components/account/MyPropsCard.svelte src/lib/shared/navigation/components/account/AccountPopover.svelte
git commit -m "feat(props): add My Props card to account popover"
```

---

### Task 13: Wire onboarding favoriteProp to Firestore profile

**Files:**
- Modify: `src/lib/shared/onboarding/components/first-run/FirstRunWizard.svelte`

- [ ] **Step 1: Add Firestore profile persistence to handlePropComplete**

In `FirstRunWizard.svelte`, the `handlePropComplete` function (line 198) currently calls `settingsService.updateSettings()`. After that call (after line 206), add:

```typescript
// Persist to user profile as prop preference
try {
  const userId = authState.user?.uid;
  if (userId) {
    const persister = container.items.propPreferencePersister as IPropPreferencePersister;
    await persister.save(userId, {
      propsISpinWith: [prop],
      favoriteProp: prop,
      favoriteCatdog: null,
    });
  }
} catch (error) {
  console.error("Failed to save prop preference to profile:", error);
  // Non-blocking — onboarding continues even if profile save fails
}
```

- [ ] **Step 2: Add required imports**

Add at top of `<script>`:
```typescript
import { container } from "$lib/shared/di";
import type { IPropPreferencePersister } from "$lib/shared/community/services/contracts/IPropPreferencePersister";
```

Check if `authState` is already imported — it likely is. If not:
```typescript
import { authState } from "$lib/shared/auth/state/authState.svelte";
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/onboarding/components/first-run/FirstRunWizard.svelte
git commit -m "feat(props): wire onboarding favoriteProp to Firestore profile"
```

---

## Chunk 4: Creator Cards, Profile & Filtering

### Task 14: Add favorite prop icon to CreatorCard

**Files:**
- Modify: `src/lib/features/browse/creators/components/CreatorCard.svelte`

- [ ] **Step 1: Read current CreatorCard implementation**

Read the full file at `src/lib/features/browse/creators/components/CreatorCard.svelte` to understand the layout before modifying.

- [ ] **Step 2: Add prop icon display**

Import `getPropTypeDisplayInfo` from `$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry`.

Add a small prop icon badge to the card. Position it in the stats area near the username:

```svelte
{#if user.favoriteProp}
  <div class="favorite-prop-badge" title={getPropTypeDisplayInfo(user.favoriteProp).label}>
    <img
      src={getPropTypeDisplayInfo(user.favoriteProp).image}
      alt={getPropTypeDisplayInfo(user.favoriteProp).label}
      class="prop-icon"
    />
  </div>
{/if}
```

CSS:
```css
.favorite-prop-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.prop-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  opacity: 0.8;
}
```

If `favoriteCatdog` is set, show both prop icons with blue/red tint instead of a single icon.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/creators/components/CreatorCard.svelte
git commit -m "feat(props): show favorite prop icon on creator cards"
```

---

### Task 15: Add propsISpinWith display to UserProfilePanel

**Files:**
- Modify: `src/lib/features/browse/creators/components/UserProfilePanel.svelte`

This is the full creator profile view (opened when you tap a creator card).

- [ ] **Step 1: Read current UserProfilePanel**

Read `src/lib/features/browse/creators/components/UserProfilePanel.svelte` to understand layout.

- [ ] **Step 2: Add props row to profile view**

After the user's bio/stats area, add a row of prop icons showing `propsISpinWith`:

```svelte
{#if user.propsISpinWith && user.propsISpinWith.length > 0}
  <div class="props-row">
    {#each user.propsISpinWith as prop}
      <div
        class="profile-prop-icon"
        class:favorite={prop === user.favoriteProp}
        title={getPropTypeDisplayInfo(prop).label}
      >
        <img
          src={getPropTypeDisplayInfo(prop).image}
          alt={getPropTypeDisplayInfo(prop).label}
        />
        {#if prop === user.favoriteProp}
          <span class="favorite-star" aria-label="Favorite">★</span>
        {/if}
      </div>
    {/each}
  </div>
{/if}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/creators/components/UserProfilePanel.svelte
git commit -m "feat(props): show props row on creator profile view"
```

---

### Task 16: Wire IntendedPropResolver into browse gallery rendering

**Files:**
- Modify: `src/lib/features/browse/sequences/display/components/SequenceDetailContent.svelte` (or wherever browse gallery sequences are rendered)

The IntendedPropResolver implements the cascade: (1) sequence intendedProp → (2) creator favoriteProp → (3) viewer settings. This needs to be called where browse gallery sequences are rendered to determine which props to show.

- [ ] **Step 1: Find where browse sequences render with prop types**

Read `src/lib/features/browse/sequences/display/components/SequenceDetailContent.svelte` and trace how `bluePropType`/`redPropType` are currently passed for rendering.

- [ ] **Step 2: Replace hardcoded viewer props with resolved props**

Where the viewer's prop settings are used for rendering sequences in the browse gallery, call the IntendedPropResolver:

```typescript
const resolver = container.items.intendedPropResolver as IIntendedPropResolver;
const resolved = resolver.resolve(
  sequence,
  sequence.ownerFavoriteProp ?? null,  // will need to be loaded/available
  settings.bluePropType,
  settings.redPropType,
  settings.catDogMode
);
```

Use `resolved.bluePropType` and `resolved.redPropType` for rendering.

Note: The creator's `favoriteProp` needs to be available alongside the sequence data. If browse sequences already include `ownerId`, the resolver can be called at render time. If `favoriteProp` isn't on the sequence data, it may need to be loaded separately or denormalized onto the public sequence index.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(props): wire IntendedPropResolver into browse rendering"
```

---

### Task 17: Add prop filter chips to creators list

**Files:**
- Create: `src/lib/features/browse/creators/components/PropFilterChips.svelte`
- Modify: `src/lib/features/browse/creators/state/creators-data-state.svelte.ts`
- Modify: `src/lib/features/browse/creators/components/CreatorsPanel.svelte`

- [ ] **Step 1: Create PropFilterChips component**

```svelte
<!--
  PropFilterChips.svelte

  Horizontally scrollable prop filter chips for the creators list.
  Tap a chip to filter creators by that prop. Multi-select supported.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

  interface Props {
    selectedProps: PropType[];
    onToggle: (prop: PropType) => void;
  }

  let { selectedProps, onToggle }: Props = $props();

  // Most common props to show as filter chips
  const FILTER_PROPS: PropType[] = [
    PropType.STAFF,
    PropType.FAN,
    PropType.CLUB,
    PropType.BUUGENG,
    PropType.MINIHOOP,
    PropType.TRIAD,
    PropType.POI,
    PropType.SWORD,
  ];
</script>

<div class="prop-filter-row" role="group" aria-label="Filter creators by prop">
  {#each FILTER_PROPS as prop}
    {@const info = getPropTypeDisplayInfo(prop)}
    {@const isSelected = selectedProps.includes(prop)}
    <button
      type="button"
      class="prop-chip"
      class:selected={isSelected}
      onclick={() => onToggle(prop)}
      aria-pressed={isSelected}
      aria-label="{info.label} filter"
    >
      <img src={info.image} alt="" class="chip-icon" aria-hidden="true" />
      <span class="chip-label">{info.label}</span>
    </button>
  {/each}
</div>

<style>
  .prop-filter-row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 4px 0;
    scrollbar-width: none;
  }

  .prop-filter-row::-webkit-scrollbar {
    display: none;
  }

  .prop-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .prop-chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .prop-chip.selected {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    color: var(--theme-accent, #6366f1);
  }

  .prop-chip:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .chip-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .chip-label {
    font-weight: 600;
  }

  @media (prefers-reduced-motion: reduce) {
    .prop-chip {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Add prop filter state to creators-data-state**

In `src/lib/features/browse/creators/state/creators-data-state.svelte.ts`, add:

```typescript
let selectedPropFilters = $state<PropType[]>([]);

function togglePropFilter(prop: PropType) {
  if (selectedPropFilters.includes(prop)) {
    selectedPropFilters = selectedPropFilters.filter((p) => p !== prop);
  } else {
    selectedPropFilters = [...selectedPropFilters, prop];
  }
  // Reset pagination and reload with filters
  void loadCreators();
}
```

Modify the `loadCreators` function to incorporate prop filtering:
- If `selectedPropFilters` is non-empty, use `creatorPropFilter.queryByProp(selectedPropFilters[0], limit)` for the Firestore query
- Apply remaining filters client-side via `creatorPropFilter.filterByProps(results, selectedPropFilters)`

Export `selectedPropFilters` and `togglePropFilter` in the returned state object.

- [ ] **Step 3: Add PropFilterChips to CreatorsPanel**

In `src/lib/features/browse/creators/components/CreatorsPanel.svelte` (line 33, after `CreatorsSortBar` import), add:

```typescript
import PropFilterChips from "./PropFilterChips.svelte";
```

In the template, after `<CreatorsSortBar>` and before the `<VirtualizedCreatorGrid>`, add:

```svelte
<PropFilterChips
  selectedProps={creatorsDataState.selectedPropFilters}
  onToggle={creatorsDataState.togglePropFilter}
/>
```

- [ ] **Step 4: Add empty state for prop filter**

When prop filters are active and no results match, show a friendly message:

```svelte
{#if selectedPropFilters.length > 0 && users.length === 0 && !isLoading}
  <div class="empty-filter-state">
    <p>No one's picked that prop yet.</p>
  </div>
{/if}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/browse/creators/components/PropFilterChips.svelte src/lib/features/browse/creators/state/creators-data-state.svelte.ts src/lib/features/browse/creators/components/CreatorsPanel.svelte
git commit -m "feat(props): add prop filter chips to creators list"
```

---

### Task 18: Add "Group by prop" sort option

**Files:**
- Modify: `src/lib/features/browse/creators/state/creators-data-state.svelte.ts`
- Modify: `src/lib/features/browse/creators/components/CreatorsSortBar.svelte`

- [ ] **Step 1: Handle favoriteProp sort in creators-data-state**

When `sortBy === "favoriteProp"`, after loading creators, use `creatorPropFilter.groupByFavoriteProp()` to cluster them. Flatten the groups: prop groups first (ordered by group size descending), "none" group last.

- [ ] **Step 2: Add sort option to CreatorsSortBar**

In `src/lib/features/browse/creators/components/CreatorsSortBar.svelte`, add "Group by prop" as a new sort option alongside existing options (lastActive, joinedDate).

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/creators/state/creators-data-state.svelte.ts src/lib/features/browse/creators/components/CreatorsSortBar.svelte
git commit -m "feat(props): add group-by-prop sort option for creators"
```

---

### Task 19: Final integration & typecheck

**Files:**
- All modified files

- [ ] **Step 1: Run full typecheck**

Run: `npm run check`
Fix any remaining type errors.

- [ ] **Step 2: Run build**

Run: `npm run build`
Verify the full build succeeds.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(props): resolve type errors from favorite prop integration"
```
