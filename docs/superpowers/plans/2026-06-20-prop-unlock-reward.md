# Prop Unlock Reward System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reward engagement by unlocking new props through play — after milestone numbers of sequence creations, surprise the user with a pick screen and a 4-fold tunnel reveal of the chosen prop.

**Architecture:** A dedicated `PropUnlockManager` service (isolated from the member-only gamification services) owns a guest-capable creation counter, the unlocked-prop set, and persistence (localStorage for guests, Firestore for members, union/max/sum merge on account upgrade). Pure domain helpers drive milestones and merge logic. A rune-state module mirrors the collection for the UI; a celebration modal renders the pick grid and the tunnel reveal (`rotateSequence` + `AnimatorCanvas` `additionalLayers`).

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Firebase Firestore, localStorage, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-20-prop-unlock-reward-design.md`

**House rules that bind this plan:**
- Tests are Vitest. Run a single file: `npx vitest run <path>`. Full check before commit: `npm run check`.
- Commit ONLY your own files with an explicit pathspec: `git commit -m "..." -- <paths>`. Never a bare `git commit`.
- No `<input type="checkbox">` anywhere. Toggles are buttons.
- Reuse primitives — read the referenced existing file before rendering anything new.
- Verify before claiming done (build/check output or runtime evidence).

---

## File Structure

**Create:**
- `src/lib/shared/gamification/domain/prop-pool.ts` — `CORE_PROPS`, `UNLOCKABLE_POOL`, `milestoneThreshold(n)`, `milestonesReached(count)`.
- `src/lib/shared/gamification/domain/prop-pool.test.ts` — unit tests.
- `src/lib/shared/gamification/domain/prop-collection.ts` — `PropCollection` type + pure helpers (`defaultCollection`, `isUnlocked`, `remainingLocked`, `applyClaim`, `mergeCollections`, `recordOne`).
- `src/lib/shared/gamification/domain/prop-collection.test.ts` — unit tests.
- `src/lib/shared/gamification/services/prop-collection-persistence.ts` — localStorage load/save.
- `src/lib/shared/gamification/services/prop-collection-persistence.test.ts` — unit tests.
- `src/lib/shared/gamification/state/prop-collection-state.svelte.ts` — rune state mirror.
- `src/lib/shared/gamification/state/prop-celebration-state.svelte.ts` — rune state for the celebration modal open/close.
- `src/lib/shared/gamification/services/prop-unlock-manager.ts` — the service.
- `src/lib/shared/gamification/get-prop-unlock-manager.ts` — singleton getter.
- `src/lib/shared/gamification/data/prop-demo-loop.ts` — generate-once-and-cache demo loop.
- `src/lib/shared/gamification/components/PropUnlockCelebration.svelte` — pick + tunnel reveal modal.

**Modify:**
- `src/lib/features/create/generate/state/generate-actions.svelte.ts` — `recordCreation("generate")` at the two generate completion sites.
- `src/lib/features/create/shared/state/assemble-tab-state.svelte.ts` — `recordCreation("construct")` edge-triggered on builder phase → `complete`.
- `src/lib/shared/auth/services/anonymous-upgrade.ts` — `mergeGuestCollection()` on upgrade success.
- `src/lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte` — locked-prop states.
- `src/lib/shared/pictograph/prop/components/PropIndicatorButton.svelte` — redemption badge.
- `src/lib/features/create/shared/components/CreateModule.svelte` — mount `PropUnlockCelebration`.

---

## Task 1: Prop pool + milestone math (pure)

**Files:**
- Create: `src/lib/shared/gamification/domain/prop-pool.ts`
- Test: `src/lib/shared/gamification/domain/prop-pool.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/shared/gamification/domain/prop-pool.test.ts
import { describe, expect, it } from "vitest";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  CORE_PROPS,
  UNLOCKABLE_POOL,
  milestoneThreshold,
  milestonesReached,
} from "./prop-pool";

describe("prop-pool", () => {
  it("core and pool are disjoint", () => {
    for (const p of CORE_PROPS) {
      expect(UNLOCKABLE_POOL).not.toContain(p);
    }
  });

  it("core holds the everyday props", () => {
    expect(CORE_PROPS).toContain(PropType.STAFF);
    expect(CORE_PROPS).toContain(PropType.CLUB);
    expect(CORE_PROPS).toContain(PropType.FAN);
    expect(CORE_PROPS).toContain(PropType.BUUGENG);
    expect(CORE_PROPS).toContain(PropType.TRIAD);
    expect(CORE_PROPS).toContain(PropType.MINIHOOP);
  });

  it("pool holds the exotic + variant props", () => {
    expect(UNLOCKABLE_POOL).toContain(PropType.SWORD);
    expect(UNLOCKABLE_POOL).toContain(PropType.BIGSTAFF);
    expect(UNLOCKABLE_POOL.length).toBeGreaterThanOrEqual(15);
  });

  it("milestoneThreshold is triangular", () => {
    expect(milestoneThreshold(1)).toBe(1);
    expect(milestoneThreshold(2)).toBe(3);
    expect(milestoneThreshold(3)).toBe(6);
    expect(milestoneThreshold(4)).toBe(10);
    expect(milestoneThreshold(19)).toBe(190);
  });

  it("milestonesReached inverts the triangular thresholds", () => {
    expect(milestonesReached(0)).toBe(0);
    expect(milestonesReached(1)).toBe(1);
    expect(milestonesReached(2)).toBe(1);
    expect(milestonesReached(3)).toBe(2);
    expect(milestonesReached(5)).toBe(2);
    expect(milestonesReached(6)).toBe(3);
    expect(milestonesReached(10)).toBe(4);
    expect(milestonesReached(190)).toBe(19);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/gamification/domain/prop-pool.test.ts`
Expected: FAIL — `Cannot find module './prop-pool'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/shared/gamification/domain/prop-pool.ts
/**
 * Prop unlock pool + milestone math.
 *
 * CORE_PROPS are always selectable (preserve "play with everything"); they are
 * never stored. UNLOCKABLE_POOL is the play-earned set. Milestones use triangular
 * thresholds: milestone n fires when creationCount reaches n(n+1)/2.
 */
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

/** Everyday spinning props — always open, never stored. */
export const CORE_PROPS: readonly PropType[] = [
  PropType.STAFF,
  PropType.CLUB,
  PropType.FAN,
  PropType.BUUGENG,
  PropType.TRIAD,
  PropType.MINIHOOP,
];

/** Exotic + variant props earned through play. */
export const UNLOCKABLE_POOL: readonly PropType[] = [
  PropType.SWORD,
  PropType.CHICKEN,
  PropType.DOUBLESTAR,
  PropType.QUIAD,
  PropType.TRIQUETRA,
  PropType.TRIQUETRA2,
  PropType.TRIGENG,
  PropType.EIGHTRINGS,
  PropType.TORCH,
  PropType.DOUBLECONTACTBALL,
  PropType.BIGSTAFF,
  PropType.BIGCLUB,
  PropType.BIGTRIAD,
  PropType.BIGHOOP,
  PropType.BIGBUUGENG,
  PropType.BIGEIGHTRINGS,
  PropType.BIGTORCH,
  PropType.BIGCHICKEN,
  PropType.BIGDOUBLESTAR,
];

/** Triangular threshold for milestone n (1-based): n(n+1)/2. */
export function milestoneThreshold(n: number): number {
  return (n * (n + 1)) / 2;
}

/** Largest n whose triangular threshold is <= count. */
export function milestonesReached(count: number): number {
  if (count < 1) return 0;
  return Math.floor((Math.sqrt(8 * count + 1) - 1) / 2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/gamification/domain/prop-pool.test.ts`
Expected: PASS (all 6 tests).

> If any `PropType` member above does not exist, open
> `src/lib/shared/pictograph/prop/domain/enums/prop-type.ts` and use the exact
> enum names; the spec lists these as active props.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/gamification/domain/prop-pool.ts src/lib/shared/gamification/domain/prop-pool.test.ts
git commit -m "feat(gamification): prop unlock pool + triangular milestone math" -- src/lib/shared/gamification/domain/prop-pool.ts src/lib/shared/gamification/domain/prop-pool.test.ts
```

---

## Task 2: PropCollection domain helpers (pure)

**Files:**
- Create: `src/lib/shared/gamification/domain/prop-collection.ts`
- Test: `src/lib/shared/gamification/domain/prop-collection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/shared/gamification/domain/prop-collection.test.ts
import { describe, expect, it } from "vitest";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { UNLOCKABLE_POOL } from "./prop-pool";
import {
  defaultCollection,
  isUnlocked,
  remainingLocked,
  applyClaim,
  mergeCollections,
  recordOne,
} from "./prop-collection";

describe("prop-collection", () => {
  it("defaults to empty earned set", () => {
    const c = defaultCollection();
    expect(c.unlockedPropTypes).toEqual([]);
    expect(c.creationCount).toBe(0);
    expect(c.pendingPicks).toBe(0);
  });

  it("core props are always unlocked, locked pool props are not", () => {
    const c = defaultCollection();
    expect(isUnlocked(c, PropType.STAFF)).toBe(true);
    expect(isUnlocked(c, PropType.SWORD)).toBe(false);
  });

  it("remainingLocked excludes earned props", () => {
    const c = { ...defaultCollection(), unlockedPropTypes: [PropType.SWORD] };
    expect(remainingLocked(c)).not.toContain(PropType.SWORD);
    expect(remainingLocked(c).length).toBe(UNLOCKABLE_POOL.length - 1);
  });

  it("recordOne increments count and earns a pick when a milestone is crossed", () => {
    // 0 -> 1 crosses milestone 1
    const c1 = recordOne(defaultCollection());
    expect(c1.creationCount).toBe(1);
    expect(c1.pendingPicks).toBe(1);
    // 1 -> 2 crosses nothing (next threshold is 3)
    const c2 = recordOne(c1);
    expect(c2.creationCount).toBe(2);
    expect(c2.pendingPicks).toBe(1);
    // 2 -> 3 crosses milestone 2
    const c3 = recordOne(c2);
    expect(c3.pendingPicks).toBe(2);
  });

  it("pendingPicks never exceeds the remaining locked pool", () => {
    let c = defaultCollection();
    // Pump way past all milestones.
    for (let i = 0; i < 300; i++) c = recordOne(c);
    expect(c.pendingPicks).toBeLessThanOrEqual(UNLOCKABLE_POOL.length);
  });

  it("applyClaim adds a locked prop and spends a pick", () => {
    const c = { unlockedPropTypes: [], creationCount: 1, pendingPicks: 1 };
    const next = applyClaim(c, PropType.SWORD);
    expect(next.unlockedPropTypes).toContain(PropType.SWORD);
    expect(next.pendingPicks).toBe(0);
  });

  it("applyClaim is a no-op with no pending picks or for a non-pool prop", () => {
    const noPending = applyClaim({ unlockedPropTypes: [], creationCount: 1, pendingPicks: 0 }, PropType.SWORD);
    expect(noPending.unlockedPropTypes).toEqual([]);
    const corePick = applyClaim({ unlockedPropTypes: [], creationCount: 1, pendingPicks: 1 }, PropType.STAFF);
    expect(corePick.unlockedPropTypes).toEqual([]);
    expect(corePick.pendingPicks).toBe(1);
  });

  it("mergeCollections unions unlocked, takes max count, sums picks, clamps", () => {
    const guest = { unlockedPropTypes: [PropType.SWORD], creationCount: 5, pendingPicks: 1 };
    const member = { unlockedPropTypes: [PropType.TORCH], creationCount: 3, pendingPicks: 1 };
    const merged = mergeCollections(guest, member);
    expect(merged.unlockedPropTypes).toContain(PropType.SWORD);
    expect(merged.unlockedPropTypes).toContain(PropType.TORCH);
    expect(merged.creationCount).toBe(5);
    expect(merged.pendingPicks).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/gamification/domain/prop-collection.test.ts`
Expected: FAIL — `Cannot find module './prop-collection'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/shared/gamification/domain/prop-collection.ts
/**
 * Pure helpers over the user's prop collection. No I/O — the manager owns
 * persistence; these functions are deterministic and unit-tested.
 */
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { CORE_PROPS, UNLOCKABLE_POOL, milestonesReached } from "./prop-pool";

export interface PropCollection {
  /** Earned props only — CORE_PROPS are implicit and never stored. */
  unlockedPropTypes: PropType[];
  creationCount: number;
  pendingPicks: number;
}

export function defaultCollection(): PropCollection {
  return { unlockedPropTypes: [], creationCount: 0, pendingPicks: 0 };
}

export function isUnlocked(c: PropCollection, prop: PropType): boolean {
  return CORE_PROPS.includes(prop) || c.unlockedPropTypes.includes(prop);
}

export function remainingLocked(c: PropCollection): PropType[] {
  return UNLOCKABLE_POOL.filter((p) => !c.unlockedPropTypes.includes(p));
}

/** Clamp pending picks so we never owe more than the user can still claim. */
function clampPending(c: PropCollection): PropCollection {
  const claimable = remainingLocked(c).length;
  return c.pendingPicks > claimable ? { ...c, pendingPicks: claimable } : c;
}

/** Count one creation; award a pick for each milestone newly crossed. */
export function recordOne(c: PropCollection): PropCollection {
  const newCount = c.creationCount + 1;
  const earned = milestonesReached(newCount) - milestonesReached(c.creationCount);
  return clampPending({
    ...c,
    creationCount: newCount,
    pendingPicks: c.pendingPicks + earned,
  });
}

/** Claim a locked pool prop, spending one pending pick. No-op otherwise. */
export function applyClaim(c: PropCollection, prop: PropType): PropCollection {
  const inPool = UNLOCKABLE_POOL.includes(prop);
  const already = c.unlockedPropTypes.includes(prop);
  if (!inPool || already || c.pendingPicks <= 0) return c;
  return {
    ...c,
    unlockedPropTypes: [...c.unlockedPropTypes, prop],
    pendingPicks: c.pendingPicks - 1,
  };
}

/** Merge a guest collection into a member collection on account upgrade. */
export function mergeCollections(
  guest: PropCollection,
  member: PropCollection
): PropCollection {
  const union = Array.from(
    new Set([...member.unlockedPropTypes, ...guest.unlockedPropTypes])
  );
  return clampPending({
    unlockedPropTypes: union,
    creationCount: Math.max(guest.creationCount, member.creationCount),
    pendingPicks: guest.pendingPicks + member.pendingPicks,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/gamification/domain/prop-collection.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/gamification/domain/prop-collection.ts src/lib/shared/gamification/domain/prop-collection.test.ts
git commit -m "feat(gamification): pure prop-collection helpers (record/claim/merge)" -- src/lib/shared/gamification/domain/prop-collection.ts src/lib/shared/gamification/domain/prop-collection.test.ts
```

---

## Task 3: localStorage persistence (guest)

**Files:**
- Create: `src/lib/shared/gamification/services/prop-collection-persistence.ts`
- Test: `src/lib/shared/gamification/services/prop-collection-persistence.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/shared/gamification/services/prop-collection-persistence.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  PROP_COLLECTION_KEY,
  loadGuestCollection,
  saveGuestCollection,
  clearGuestCollection,
} from "./prop-collection-persistence";

describe("prop-collection-persistence", () => {
  beforeEach(() => localStorage.clear());

  it("returns defaults when nothing stored", () => {
    expect(loadGuestCollection()).toEqual({
      unlockedPropTypes: [],
      creationCount: 0,
      pendingPicks: 0,
    });
  });

  it("round-trips a saved collection", () => {
    const c = { unlockedPropTypes: [PropType.SWORD], creationCount: 4, pendingPicks: 1 };
    saveGuestCollection(c);
    expect(loadGuestCollection()).toEqual(c);
  });

  it("clear removes the key", () => {
    saveGuestCollection({ unlockedPropTypes: [PropType.TORCH], creationCount: 1, pendingPicks: 0 });
    clearGuestCollection();
    expect(localStorage.getItem(PROP_COLLECTION_KEY)).toBeNull();
  });

  it("falls back to defaults on corrupt JSON", () => {
    localStorage.setItem(PROP_COLLECTION_KEY, "{not json");
    expect(loadGuestCollection().creationCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/gamification/services/prop-collection-persistence.test.ts`
Expected: FAIL — module not found.

> Vitest in this repo runs in a jsdom-like environment that provides
> `localStorage`. If `localStorage` is undefined in the test run, add
> `// @vitest-environment jsdom` as the first line of the test file.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/shared/gamification/services/prop-collection-persistence.ts
/**
 * Guest persistence for the prop collection. localStorage only — members use
 * Firestore (owned by PropUnlockManager). Mirrors the house localStorage idiom
 * (browser guard + try/catch + tka- prefixed key).
 */
import { browser } from "$app/environment";
import {
  defaultCollection,
  type PropCollection,
} from "../domain/prop-collection";

export const PROP_COLLECTION_KEY = "tka-prop-collection-v1";

export function loadGuestCollection(): PropCollection {
  if (!browser && typeof localStorage === "undefined") return defaultCollection();
  try {
    const raw = localStorage.getItem(PROP_COLLECTION_KEY);
    if (!raw) return defaultCollection();
    const parsed = JSON.parse(raw) as Partial<PropCollection>;
    return {
      unlockedPropTypes: parsed.unlockedPropTypes ?? [],
      creationCount: parsed.creationCount ?? 0,
      pendingPicks: parsed.pendingPicks ?? 0,
    };
  } catch (error) {
    console.error("[prop-collection] failed to load guest collection:", error);
    return defaultCollection();
  }
}

export function saveGuestCollection(c: PropCollection): void {
  if (!browser && typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PROP_COLLECTION_KEY, JSON.stringify(c));
  } catch (error) {
    console.error("[prop-collection] failed to save guest collection:", error);
  }
}

export function clearGuestCollection(): void {
  if (!browser && typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PROP_COLLECTION_KEY);
  } catch (error) {
    console.error("[prop-collection] failed to clear guest collection:", error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/gamification/services/prop-collection-persistence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/gamification/services/prop-collection-persistence.ts src/lib/shared/gamification/services/prop-collection-persistence.test.ts
git commit -m "feat(gamification): guest localStorage persistence for prop collection" -- src/lib/shared/gamification/services/prop-collection-persistence.ts src/lib/shared/gamification/services/prop-collection-persistence.test.ts
```

---

## Task 4: Rune state modules

**Files:**
- Create: `src/lib/shared/gamification/state/prop-collection-state.svelte.ts`
- Create: `src/lib/shared/gamification/state/prop-celebration-state.svelte.ts`

- [ ] **Step 1: Write the collection state module**

```ts
// src/lib/shared/gamification/state/prop-collection-state.svelte.ts
/**
 * Reactive mirror of the user's prop collection. The PropUnlockManager is the
 * writer; UI reads these values. Follows the gamification module's "export
 * $state + action functions" pattern (see notification-state.svelte.ts).
 */
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  defaultCollection,
  isUnlocked as isUnlockedPure,
  remainingLocked as remainingLockedPure,
  type PropCollection,
} from "../domain/prop-collection";

export const propCollection = $state<PropCollection>(defaultCollection());

/** Replace the mirrored collection (called by the manager after every change). */
export function setPropCollection(next: PropCollection): void {
  propCollection.unlockedPropTypes = next.unlockedPropTypes;
  propCollection.creationCount = next.creationCount;
  propCollection.pendingPicks = next.pendingPicks;
}

export function isPropUnlocked(prop: PropType): boolean {
  return isUnlockedPure(propCollection, prop);
}

export function remainingLockedProps(): PropType[] {
  return remainingLockedPure(propCollection);
}
```

- [ ] **Step 2: Write the celebration state module**

```ts
// src/lib/shared/gamification/state/prop-celebration-state.svelte.ts
/**
 * Open/close state for the prop-unlock celebration modal. The manager opens it
 * automatically on the first milestone; the redemption badge opens it on demand.
 */
export const propCelebration = $state<{ isOpen: boolean }>({ isOpen: false });

export function openPropCelebration(): void {
  propCelebration.isOpen = true;
}

export function closePropCelebration(): void {
  propCelebration.isOpen = false;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -iE "prop-collection-state|prop-celebration-state" || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/gamification/state/prop-collection-state.svelte.ts src/lib/shared/gamification/state/prop-celebration-state.svelte.ts
git commit -m "feat(gamification): prop collection + celebration rune state" -- src/lib/shared/gamification/state/prop-collection-state.svelte.ts src/lib/shared/gamification/state/prop-celebration-state.svelte.ts
```

---

## Task 5: PropUnlockManager service + getter

**Files:**
- Create: `src/lib/shared/gamification/services/prop-unlock-manager.ts`
- Create: `src/lib/shared/gamification/get-prop-unlock-manager.ts`

**Context:** This is the orchestrator. It loads the right source (guest localStorage
or member Firestore), mirrors into rune state, counts creations, fires the
auto-open on milestone #1, claims picks, and merges on upgrade. Firestore idiom is
copied from `streak-tracker.ts` (imports `auth`, `getFirestoreInstance` from
`$lib/shared/auth/firebase`; `doc`/`getDoc`/`setDoc` from `firebase/firestore`). No
Dexie cache (spec: Firestore's built-in offline persistence covers a 19-item set).

- [ ] **Step 1: Write the getter**

```ts
// src/lib/shared/gamification/get-prop-unlock-manager.ts
import { browser } from "$app/environment";
import { PropUnlockManager } from "./services/prop-unlock-manager";

let instance: PropUnlockManager | null = null;

export function getPropUnlockManager(): PropUnlockManager {
  if (!browser) throw new Error("getPropUnlockManager() is browser-only");
  return (instance ??= new PropUnlockManager());
}
```

- [ ] **Step 2: Write the service**

```ts
// src/lib/shared/gamification/services/prop-unlock-manager.ts
/**
 * PropUnlockManager — owns the creation counter, the unlocked set, persistence,
 * and milestone firing. Guest-capable (localStorage); members persist to
 * Firestore. Isolated from the member-only achievement services.
 */
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, getFirestoreInstance } from "$lib/shared/auth/firebase";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  applyClaim,
  defaultCollection,
  mergeCollections,
  recordOne,
  type PropCollection,
} from "../domain/prop-collection";
import { milestonesReached } from "../domain/prop-pool";
import {
  clearGuestCollection,
  loadGuestCollection,
  saveGuestCollection,
} from "./prop-collection-persistence";
import { setPropCollection } from "../state/prop-collection-state.svelte";
import { openPropCelebration } from "../state/prop-celebration-state.svelte";

function propCollectionPath(uid: string): string {
  return `users/${uid}/gamification/propCollection`;
}

/** True when authenticated AND not an anonymous guest. */
function isMember(): boolean {
  const user = auth.currentUser;
  return !!user && !user.isAnonymous;
}

export class PropUnlockManager {
  private collection: PropCollection = defaultCollection();
  private loaded = false;

  /** Load the right source and mirror into rune state. Idempotent per session. */
  async load(): Promise<void> {
    if (this.loaded) return;
    this.collection = isMember()
      ? await this.loadMember()
      : loadGuestCollection();
    setPropCollection(this.collection);
    this.loaded = true;
  }

  private async loadMember(): Promise<PropCollection> {
    const user = auth.currentUser!;
    try {
      const firestore = await getFirestoreInstance();
      const ref = doc(firestore, propCollectionPath(user.uid));
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const fresh = defaultCollection();
        await setDoc(ref, fresh);
        return fresh;
      }
      const data = snap.data() as Partial<PropCollection>;
      return {
        unlockedPropTypes: data.unlockedPropTypes ?? [],
        creationCount: data.creationCount ?? 0,
        pendingPicks: data.pendingPicks ?? 0,
      };
    } catch (error) {
      console.error("[prop-unlock] failed to load member collection:", error);
      return defaultCollection();
    }
  }

  private async persist(): Promise<void> {
    setPropCollection(this.collection);
    if (isMember()) {
      const user = auth.currentUser!;
      try {
        const firestore = await getFirestoreInstance();
        await setDoc(doc(firestore, propCollectionPath(user.uid)), this.collection);
      } catch (error) {
        console.error("[prop-unlock] failed to persist member collection:", error);
      }
    } else {
      saveGuestCollection(this.collection);
    }
  }

  /** Count one created sequence; fire the celebration on the first milestone. */
  async recordCreation(_source: "generate" | "construct"): Promise<void> {
    await this.load();
    const before = milestonesReached(this.collection.creationCount);
    this.collection = recordOne(this.collection);
    const after = milestonesReached(this.collection.creationCount);
    await this.persist();
    // First milestone ever auto-opens the celebration (onboarding delight).
    // Later milestones rely on the redemption badge (Task 8) — no auto-pop.
    if (after > before && after === 1) {
      openPropCelebration();
    }
  }

  /** Claim a locked prop, spending a pending pick. */
  async claimPick(prop: PropType): Promise<void> {
    await this.load();
    this.collection = applyClaim(this.collection, prop);
    await this.persist();
  }

  /** Merge the guest localStorage collection into the member Firestore doc. */
  async mergeGuestCollection(): Promise<void> {
    if (!isMember()) return;
    const guest = loadGuestCollection();
    const member = await this.loadMember();
    this.collection = mergeCollections(guest, member);
    this.loaded = true;
    await this.persist();
    clearGuestCollection();
  }

  get pendingPicks(): number {
    return this.collection.pendingPicks;
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -iE "prop-unlock-manager|get-prop-unlock-manager" || echo "clean"`
Expected: `clean`. Fix any import that does not resolve (confirm the exact export names in `$lib/shared/auth/firebase` by reading `src/lib/shared/gamification/services/streak-tracker.ts` lines 1–10).

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/gamification/services/prop-unlock-manager.ts src/lib/shared/gamification/get-prop-unlock-manager.ts
git commit -m "feat(gamification): PropUnlockManager service + singleton getter" -- src/lib/shared/gamification/services/prop-unlock-manager.ts src/lib/shared/gamification/get-prop-unlock-manager.ts
```

---

## Task 6: Demo loop (generate-once-and-cache)

**Files:**
- Create: `src/lib/shared/gamification/data/prop-demo-loop.ts`

**Context:** The reveal needs one short loopable sequence. No literal ships and MCP
is unavailable at runtime, so generate once via `generationOrchestrator` (the proven
`test/prop-tunnel` path) and cache the promise.

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/shared/gamification/data/prop-demo-loop.ts
/**
 * One short loopable demo sequence for the prop-unlock tunnel reveal. Generated
 * once at runtime and cached (module-level promise). The prop rendered on top is
 * swapped per reveal — the motion is shared.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { generationOrchestrator } from "$lib/shared/create/services/generation-orchestrator";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { DifficultyLevel } from "$lib/shared/foundation/domain/models/generation/generate-models";

let cached: Promise<SequenceData> | null = null;

export function getPropDemoLoop(): Promise<SequenceData> {
  return (cached ??= generationOrchestrator.generateSequence({
    length: 8,
    gridMode: GridMode.DIAMOND,
    propType: PropType.STAFF, // generation prop is irrelevant; render prop is set on the canvas
    difficulty: DifficultyLevel.INTERMEDIATE,
    constraintPreset: "smooth",
  }));
}
```

- [ ] **Step 2: Typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -iE "prop-demo-loop" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/gamification/data/prop-demo-loop.ts
git commit -m "feat(gamification): cached demo loop for prop reveal" -- src/lib/shared/gamification/data/prop-demo-loop.ts
```

---

## Task 7: PropUnlockCelebration component (pick + tunnel reveal)

**Files:**
- Create: `src/lib/shared/gamification/components/PropUnlockCelebration.svelte`

**Context:** Two-state modal. PICK = grid of remaining locked props as tiles. REVEAL
= a 4-fold tunnel (`rotateSequence` 90/180/270 + `AnimatorCanvas` `additionalLayers`)
of the chosen prop at ~0.3 beats/sec. Reuse `BaseModal class="chromeless"`. The
working tunnel wiring already exists at `src/routes/test/prop-tunnel/+page.svelte` —
copy its sequence/rotation/playhead/interpolation logic. For the prop tiles, read
`src/lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte` to find the
exact accessor it uses for each prop's image + label, and reuse that accessor (do not
hand-roll a new image map).

- [ ] **Step 1: Read the references**

Read these and note exact prop names / accessors before writing:
- `src/routes/test/prop-tunnel/+page.svelte` — the proven tunnel wiring.
- `src/lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte` — how a prop's image + label are resolved (the display registry accessor).
- `src/lib/shared/foundation/ui/modal/BaseModal.svelte` — the `open` / `onclose` / `size` / `class` props.

- [ ] **Step 2: Write the component**

```svelte
<!-- src/lib/shared/gamification/components/PropUnlockCelebration.svelte -->
<!--
  Prop unlock celebration. PICK (grid of locked props) → REVEAL (4-fold tunnel of
  the chosen prop) → Confirm commits the claim. Backdrop/Escape dismiss via
  BaseModal; pending picks persist so dismissing loses nothing.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/trail-capture-types";
  import { interpolatePropAngles } from "$lib/shared/animation-engine/services/prop-interpolator";
  import { rotateSequence } from "$lib/shared/create/services/sequence-transforms";
  import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";
  import { getPropDemoLoop } from "../data/prop-demo-loop";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

  import { propCelebration, closePropCelebration } from "../state/prop-celebration-state.svelte";
  import { remainingLockedProps } from "../state/prop-collection-state.svelte";
  import { getPropUnlockManager } from "../get-prop-unlock-manager";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  // NOTE: import the prop image+label accessor used by BentoPropGrid (confirmed in Step 1),
  // e.g. `import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";`

  const DEFAULT_PROP_STATE: PropState = { centerPathAngle: 0, staffRotationAngle: 0 };

  let phase = $state<"pick" | "reveal">("pick");
  let chosen = $state<PropType | null>(null);

  const locked = $derived(remainingLockedProps());
  const isGuest = $derived(!authState.isFullAccount);

  // ── Tunnel sequences (built when a prop is chosen) ──────────
  let base = $state<SequenceData | null>(null);
  let rotated = $state<SequenceData[]>([]);
  let playheadBeat = $state(0);
  const SPEED = 0.3; // beats/sec — 4-fold reads best slow (validated)

  async function choose(prop: PropType) {
    chosen = prop;
    phase = "reveal";
    base = null;
    rotated = [];
    playheadBeat = 0;
    const seq = await getPropDemoLoop();
    const copies = await Promise.all([
      rotateSequence(seq, 2, motionQueryHandler),
      rotateSequence(seq, 4, motionQueryHandler),
      rotateSequence(seq, 6, motionQueryHandler),
    ]);
    base = seq;
    rotated = copies;
  }

  onMount(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (base && base.steps.length > 0) {
        playheadBeat = (playheadBeat + dt * SPEED) % base.steps.length;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  type LayerProps = { blue: PropState; red: PropState; step: StepData | null; stepOneBased: number };
  function propsFor(seq: SequenceData | null): LayerProps {
    if (!seq || seq.steps.length === 0) {
      return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE }, step: null, stepOneBased: 1 };
    }
    const n = seq.steps.length;
    const idx = Math.min(n - 1, Math.max(0, Math.floor(playheadBeat)));
    const progress = Math.max(0, Math.min(0.9999, playheadBeat - Math.floor(playheadBeat)));
    const step = seq.steps[idx] ?? null;
    if (!step) return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE }, step: null, stepOneBased: idx + 1 };
    const r = interpolatePropAngles(step, progress);
    return {
      blue: r.isValid ? (r.blueAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
      red: r.isValid ? (r.redAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
      step,
      stepOneBased: idx + 1,
    };
  }
  const baseLayer = $derived(propsFor(base));
  const additionalLayers = $derived<AdditionalLayerProps[]>(
    rotated.map((seq) => {
      const p = propsFor(seq);
      return { blueProp: p.blue, redProp: p.red };
    }),
  );
  const chosenStr = $derived(chosen ? String(chosen) : null);
  const gridMode = $derived(base?.gridMode ?? GridMode.DIAMOND);

  function reset() {
    phase = "pick";
    chosen = null;
    base = null;
    rotated = [];
  }

  async function confirm() {
    if (!chosen) return;
    await getPropUnlockManager().claimPick(chosen);
    const label = chosenStr ?? "prop"; // replace with display label accessor from Step 1
    toast.success(`${label} added to your props.`);
    closePropCelebration();
    reset();
  }

  function onClose() {
    closePropCelebration();
    reset();
  }

  function signUpToKeep() {
    authDrawerState.show("signup");
  }
</script>

<BaseModal open={propCelebration.isOpen} size="fit" class="chromeless" onclose={onClose}>
  <div class="celebration">
    {#if phase === "pick"}
      <h2 data-animate="1">You've earned a new prop</h2>
      <p class="sub" data-animate="2">Pick one to add to your collection.</p>
      <div class="grid" data-animate="3">
        {#each locked as prop (prop)}
          <button class="tile" onclick={() => choose(prop)}>
            <!-- Replace with the image+label accessor confirmed in Step 1 -->
            <span class="tile-label">{String(prop)}</span>
          </button>
        {/each}
      </div>
      {#if isGuest}
        <button class="keep" data-animate="4" onclick={signUpToKeep}>Sign up to keep your collection</button>
      {/if}
    {:else}
      <h2 data-animate="1">Meet your {chosenStr}</h2>
      <div class="stage" data-animate="2">
        {#if base}
          <AnimatorCanvas
            blueProp={baseLayer.blue}
            redProp={baseLayer.red}
            {additionalLayers}
            bluePropType={chosenStr}
            redPropType={chosenStr}
            sequenceData={base}
            stepData={baseLayer.step}
            currentStep={baseLayer.stepOneBased}
            isPlaying={true}
            {gridMode}
            gridVisible={true}
            hideHeader={true}
            hideProgressBar={true}
            hideTkaGlyph={true}
            hideStepNumbers={true}
            fillContainer={true}
            fireConfig={{ disableFrameCache: true }}
          />
        {:else}
          <div class="loading">Summoning…</div>
        {/if}
      </div>
      <div class="actions">
        <button class="back" onclick={reset}>Back</button>
        <button class="confirm" onclick={confirm}>Add to my props</button>
      </div>
    {/if}
  </div>
</BaseModal>

<style>
  .celebration {
    width: min(420px, calc(100vw - 32px));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255 255 255 / 0.1));
    border-radius: 20px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    color: var(--theme-text, #fff);
    text-align: center;
  }
  h2 { margin: 0; font-size: 1.3rem; }
  .sub { margin: 0; opacity: 0.7; font-size: 0.9rem; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 10px;
    max-height: 320px;
    overflow-y: auto;
  }
  .tile {
    aspect-ratio: 1 / 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: rgba(255 255 255 / 0.05);
    border: 1px solid rgba(255 255 255 / 0.12);
    border-radius: 12px;
    color: inherit;
    cursor: pointer;
    transition: transform 0.15s, background 0.15s, border-color 0.15s;
  }
  .tile:hover {
    transform: scale(1.05);
    background: rgba(255 255 255 / 0.1);
    border-color: rgba(150 120 240 / 0.6);
  }
  .tile-label { font-size: 0.72rem; opacity: 0.85; }
  .keep {
    background: none;
    border: none;
    color: var(--theme-accent, #b14ddb);
    font-size: 0.82rem;
    cursor: pointer;
    text-decoration: underline;
  }
  .stage {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 14px;
    overflow: hidden;
    background: #07070b;
    border: 1px solid rgba(255 255 255 / 0.1);
  }
  .loading { width: 100%; height: 100%; display: grid; place-items: center; opacity: 0.5; }
  .actions { display: flex; gap: 10px; justify-content: center; }
  .back, .confirm {
    padding: 10px 18px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 0.9rem;
    border: 1px solid rgba(255 255 255 / 0.15);
    background: rgba(255 255 255 / 0.06);
    color: inherit;
  }
  .confirm {
    background: linear-gradient(135deg, #6d5ef0, #b14ddb);
    border-color: transparent;
    color: #fff;
  }
  @media (prefers-reduced-motion: reduce) {
    .tile { transition: none; }
    .tile:hover { transform: none; }
  }
</style>
```

> Reduced-motion fold step-down (drop to 2-fold) is a refinement; the
> `prefers-reduced-motion` CSS guard above removes the tile animation. If you want
> the 2-fold reduced-motion variant, gate the `rotated` array in `choose()` on
> `window.matchMedia("(prefers-reduced-motion: reduce)").matches` to push only the
> 180° copy. This is optional polish, not required for the task to pass.

- [ ] **Step 3: Replace the placeholder prop tile + label**

Using the accessor confirmed in Step 1 (e.g. `getPropTypeDisplayInfo(prop)`),
render the prop's `image` inside `.tile` (an `<img>` or inline SVG per how
`BentoPropGrid` does it) and use its `label` for `.tile-label` and the confirm
toast. Replace `String(prop)` / `chosenStr` display strings with the real label.

- [ ] **Step 4: Typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -iE "PropUnlockCelebration" || echo "clean"`
Expected: `clean`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/gamification/components/PropUnlockCelebration.svelte
git commit -m "feat(gamification): prop unlock celebration with tunnel reveal" -- src/lib/shared/gamification/components/PropUnlockCelebration.svelte
```

---

## Task 8: Mount the celebration + redemption badge

**Files:**
- Modify: `src/lib/features/create/shared/components/CreateModule.svelte`
- Modify: `src/lib/shared/pictograph/prop/components/PropIndicatorButton.svelte`

- [ ] **Step 1: Mount the celebration in CreateModule**

Read `src/lib/features/create/shared/components/CreateModule.svelte`. In the
`<script>` add:

```ts
import PropUnlockCelebration from "$lib/shared/gamification/components/PropUnlockCelebration.svelte";
import { getPropUnlockManager } from "$lib/shared/gamification/get-prop-unlock-manager";
```

In the existing `onMount` (the same one that calls `appEntryState.offerCreateTutorial()`),
add a load so the collection mirrors into rune state on entry:

```ts
void getPropUnlockManager().load();
```

Near the other top-level overlays/modals in the markup, add:

```svelte
<PropUnlockCelebration />
```

- [ ] **Step 2: Add the redemption badge to PropIndicatorButton**

Read `src/lib/shared/pictograph/prop/components/PropIndicatorButton.svelte`. In the
`<script>` add:

```ts
import { propCollection } from "$lib/shared/gamification/state/prop-collection-state.svelte";
import { openPropCelebration } from "$lib/shared/gamification/state/prop-celebration-state.svelte";

const hasPendingPick = $derived(propCollection.pendingPicks > 0);
```

In the button markup, after the prop preview (around line 57, after
`<PropCompositionPreview .../>`), add a badge:

```svelte
{#if hasPendingPick}
  <span class="redeem-dot" aria-label="Claim your new prop"></span>
{/if}
```

Add styles:

```css
.redeem-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6d5ef0, #b14ddb);
  box-shadow: 0 0 0 2px var(--theme-panel-bg, #14141f);
}
```

(Ensure the button element is `position: relative` so the dot anchors. Add it if
the existing rule lacks it.)

- [ ] **Step 3: Open the celebration when a pending pick exists**

In `PropIndicatorButton.svelte`, the click handler currently calls
`propDrawerState.toggle()` (around line 46). Change it so a pending pick routes to
the celebration instead of the normal drawer:

```ts
function onPropButtonClick() {
  if (hasPendingPick) {
    openPropCelebration();
    return;
  }
  propDrawerState.toggle();
}
```

Wire `onclick={onPropButtonClick}` on the button (replace the inline
`propDrawerState.toggle()`).

- [ ] **Step 4: Typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -iE "CreateModule|PropIndicatorButton" || echo "clean"`
Expected: `clean`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/components/CreateModule.svelte src/lib/shared/pictograph/prop/components/PropIndicatorButton.svelte
git commit -m "feat(gamification): mount prop celebration + redemption badge" -- src/lib/features/create/shared/components/CreateModule.svelte src/lib/shared/pictograph/prop/components/PropIndicatorButton.svelte
```

---

## Task 9: Locked-prop states in the picker grid

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte`

**Context:** Pool props the user hasn't earned render dimmed + locked and are not
selectable; a tap shows an inline "Earn by creating" tip. Core + earned props render
normally.

- [ ] **Step 1: Read the component**

Read `src/lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte`. Note
how it iterates props and fires `onSelect(prop)`.

- [ ] **Step 2: Add unlocked gating**

In the `<script>`:

```ts
import { isPropUnlocked } from "$lib/shared/gamification/state/prop-collection-state.svelte";
```

For each rendered prop tile, compute `isPropUnlocked(prop)`. When locked:
- add a `locked` class (dimmed, lock glyph),
- do NOT call `onSelect` on click; instead set a local `lockedTipFor = prop` state
  and show a small inline tip "Earn by creating" near that tile (auto-clears after a
  few seconds or on next interaction).

```ts
let lockedTipFor = $state<PropType | null>(null);
function handleTileClick(prop: PropType) {
  if (isPropUnlocked(prop)) {
    onSelect(prop);
  } else {
    lockedTipFor = prop;
  }
}
```

Apply `class:locked={!isPropUnlocked(prop)}` and `onclick={() => handleTileClick(prop)}`
to the tile button, and render a lock glyph + the tip when `lockedTipFor === prop`.

Styles:

```css
.locked { opacity: 0.4; }
.locked:hover { opacity: 0.55; }
.lock-glyph { position: absolute; bottom: 4px; right: 4px; font-size: 0.7rem; opacity: 0.8; }
.earn-tip { font-size: 0.65rem; opacity: 0.85; }
```

> Do NOT introduce any Scribe/premium pitch here — the tip is informational only.
> Do NOT use a checkbox for any of this (house rule).

- [ ] **Step 3: Typecheck + verify no checkbox introduced**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -iE "BentoPropGrid" || echo "clean"`
Expected: `clean`.
Run: `git diff -- src/lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte | grep -i 'type="checkbox"' || echo "no checkbox"`
Expected: `no checkbox`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte
git commit -m "feat(gamification): locked-prop states in the prop picker grid" -- src/lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte
```

---

## Task 10: Counting seams (generate + construct)

**Files:**
- Modify: `src/lib/features/create/generate/state/generate-actions.svelte.ts`
- Modify: `src/lib/features/create/shared/state/assemble-tab-state.svelte.ts`

- [ ] **Step 1: Generate seam**

Read `src/lib/features/create/generate/state/generate-actions.svelte.ts`. At the
top, add:

```ts
import { getPropUnlockManager } from "$lib/shared/gamification/get-prop-unlock-manager";
```

Immediately after the freeform completion (`await updateWorkbenchWithSequence(generatedSequence);`,
around line 172) and after the spell completion
(`await updateWorkbenchWithSequence(loopedSequence);`, around line 411), add:

```ts
void getPropUnlockManager().recordCreation("generate");
```

(Two call sites — one per path. Placing it at the call sites, not inside
`updateWorkbenchWithSequence`, avoids counting non-generate workbench updates.)

- [ ] **Step 2: Construct seam (edge-triggered)**

Read `src/lib/features/create/shared/state/assemble-tab-state.svelte.ts`. The builder
exposes `builderState.phase`. Add an edge-triggered effect that fires once per
transition into `complete`. At the top:

```ts
import { getPropUnlockManager } from "$lib/shared/gamification/get-prop-unlock-manager";
```

After the reactive bridge is established (after `startReactiveBridge()` near line 186),
add:

```ts
let prevAssemblePhase: string | null = null;
$effect(() => {
  const phase = builderState.phase;
  if (phase === "complete" && prevAssemblePhase !== "complete") {
    void getPropUnlockManager().recordCreation("construct");
  }
  prevAssemblePhase = phase;
});
```

> Confirm `builderState.phase` reaches a `"complete"` value in this file. If the
> terminal phase is named differently (e.g. `"finished"`), use that exact string —
> read the builder state's phase type before wiring. Do NOT count on every reactive
> tick; the `prevAssemblePhase` guard makes it edge-triggered (one count per
> completed construct).

- [ ] **Step 3: Typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -iE "generate-actions|assemble-tab-state" || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/create/generate/state/generate-actions.svelte.ts src/lib/features/create/shared/state/assemble-tab-state.svelte.ts
git commit -m "feat(gamification): count generate + construct creations toward prop unlocks" -- src/lib/features/create/generate/state/generate-actions.svelte.ts src/lib/features/create/shared/state/assemble-tab-state.svelte.ts
```

---

## Task 11: Account-upgrade carryover

**Files:**
- Modify: `src/lib/shared/auth/services/anonymous-upgrade.ts`

**Context:** When an anonymous guest links to a full account, merge their
localStorage collection into Firestore. The success path is `notifyUpgradeSignup()`
(reached by all three link paths: Google/Facebook/Email).

- [ ] **Step 1: Add the merge call**

Read `src/lib/shared/auth/services/anonymous-upgrade.ts`. At the top:

```ts
import { getPropUnlockManager } from "$lib/shared/gamification/get-prop-unlock-manager";
```

Inside `notifyUpgradeSignup()` (after the success toast around line 86), add:

```ts
void getPropUnlockManager().mergeGuestCollection();
```

`mergeGuestCollection()` reads `auth.currentUser` itself (same uid after linking),
unions the guest collection into the member doc, then clears localStorage. No argument
needed.

- [ ] **Step 2: Typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -iE "anonymous-upgrade" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/auth/services/anonymous-upgrade.ts
git commit -m "feat(gamification): carry guest prop collection over on account upgrade" -- src/lib/shared/auth/services/anonymous-upgrade.ts
```

---

## Task 12: Full check + runtime verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npm run check`
Expected: no new errors attributable to the new/modified files. Fix any that appear,
re-run until clean.

- [ ] **Step 2: Guest runtime walkthrough**

In a clean guest browser context at `http://localhost:5173` (Create module):
1. Generate one sequence → the celebration auto-opens (milestone #1).
2. Pick a prop → the 4-fold tunnel reveal plays that prop, slow and gorgeous.
3. Confirm → toast, modal closes, the prop is now selectable in the prop picker
   (no longer dimmed/locked).
4. Generate two more (counts 2, 3) → at count 3 the redemption badge appears on the
   prop button (no auto-pop). Tap it → celebration opens → claim.
5. Reload → collection persists (localStorage).
6. Open the prop picker → locked pool props are dimmed with a lock; tapping one shows
   "Earn by creating" and does not select it.

- [ ] **Step 3: Carryover check**

As the same guest with a non-empty collection, sign up (link). Confirm the unlocked
props survive (now backed by Firestore) and localStorage `tka-prop-collection-v1` is
cleared.

- [ ] **Step 4: Capture evidence**

Record the runtime result (screenshot or a short note of each step's observed
outcome). Per the verification rule, do not claim "done" without this evidence.

---

## Self-Review notes (for the executor)

- **Demo loop generation** depends on the engine being initialized; the first reveal
  may take a beat to generate — the `Summoning…` placeholder covers it. Subsequent
  reveals reuse the cached promise.
- **`auth.currentUser.isAnonymous`** is the guest/member discriminator inside the
  service (matches `isFullAccountUser` semantics). The component uses
  `authState.isFullAccount` for the "sign up to keep" line.
- **No bare commits** — every commit above carries an explicit `-- <paths>` pathspec.
- **Prop enum names** in Task 1 must match `prop-type.ts` exactly; verify before
  finalizing Task 1.
