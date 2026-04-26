# Creator Intent & Compositional Finalization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `intendedProp` with a broader `creatorIntent` field, implement entry-point prop resolution with a contextual chip, split MotionData into domain/derived types, and stop persisting `steps` to Firestore.

**Architecture:** `CreatorIntent` is a new type on `SequenceData` capturing the creator's full presentation choices (prop config + effort timeline). A `PresentationResolver` service resolves which props to show based on entry-point context (`"notation"` vs `"creator-expression"`). `DerivedMotionData extends MotionData` separates viewer concerns from domain data. The compositional model (`blueSoloProp` + `redSoloProp` + `stepPairings`) becomes the sole persisted form; `steps` is derived on read.

**Tech Stack:** Svelte 5 + TypeScript + ITI DI + Firebase Firestore

**Spec:** `docs/superpowers/specs/2026-03-14-creator-intent-and-compositional-finalization-design.md`

---

## Chunk 1: CreatorIntent Type + PresentationResolver Service

### Task 1: Define CreatorIntent type

**Files:**
- Create: `src/lib/shared/foundation/domain/models/CreatorIntent.ts`

- [ ] **Step 1: Create the CreatorIntent interface**

```typescript
// src/lib/shared/foundation/domain/models/CreatorIntent.ts
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { EffortTimeline } from "$lib/features/phrase-effort-lab/domain/effort-timeline-types";

export interface CreatorIntent {
  readonly propConfig: {
    readonly bluePropType: PropType;
    readonly redPropType: PropType;
    readonly catDogMode: boolean;
  };
  readonly effortTimeline?: EffortTimeline | null;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS (new file, no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/foundation/domain/models/CreatorIntent.ts
git commit -m "feat: define CreatorIntent type"
```

---

### Task 2: Add creatorIntent to SequenceData

**Files:**
- Modify: `src/lib/shared/foundation/domain/models/SequenceData.ts`

- [ ] **Step 1: Add import and field**

At `SequenceData.ts:1`, add import:
```typescript
import type { CreatorIntent } from "./CreatorIntent";
```

After line 115 (`intendedProp` closing `}`), add:
```typescript
  /** Creator's full presentation intent: prop config + effort + future fields.
   * Replaces intendedProp (prop only) and top-level effortTimeline.
   * null = legacy sequence with no intent recorded. */
  readonly creatorIntent?: CreatorIntent | null;
```

- [ ] **Step 2: Add creatorIntent passthrough in createSequenceData()**

After line 210 (`...(data.intendedProp !== undefined && { intendedProp: data.intendedProp }),`), add:
```typescript
    ...(data.creatorIntent !== undefined && { creatorIntent: data.creatorIntent }),
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/foundation/domain/models/SequenceData.ts
git commit -m "feat: add creatorIntent field to SequenceData"
```

---

### Task 3: Build PresentationResolver service

**Files:**
- Create: `src/lib/shared/sequence-viewer/services/contracts/IPresentationResolver.ts`
- Create: `src/lib/shared/sequence-viewer/services/implementations/PresentationResolver.ts`

- [ ] **Step 1: Create the contract**

```typescript
// src/lib/shared/sequence-viewer/services/contracts/IPresentationResolver.ts
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { EffortTimeline } from "$lib/features/phrase-effort-lab/domain/effort-timeline-types";

export type ViewingContext = "notation" | "creator-expression";

export interface ResolvedPresentation {
  readonly bluePropType: PropType;
  readonly redPropType: PropType;
  readonly catDogMode: boolean;
  readonly effortTimeline: EffortTimeline | null;
  readonly source: "creator-intent" | "viewer-settings";
}

export interface IPresentationResolver {
  resolve(
    sequence: SequenceData,
    viewingContext: ViewingContext,
    viewerBlue: PropType,
    viewerRed: PropType,
    viewerCatDog: boolean
  ): ResolvedPresentation;
}
```

- [ ] **Step 2: Create the implementation**

```typescript
// src/lib/shared/sequence-viewer/services/implementations/PresentationResolver.ts
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  IPresentationResolver,
  ViewingContext,
  ResolvedPresentation,
} from "../contracts/IPresentationResolver";

export class PresentationResolver implements IPresentationResolver {
  resolve(
    sequence: SequenceData,
    viewingContext: ViewingContext,
    viewerBlue: PropType,
    viewerRed: PropType,
    viewerCatDog: boolean
  ): ResolvedPresentation {
    // Resolve creatorIntent from either new field or legacy intendedProp
    const intent = sequence.creatorIntent;
    const legacyProp = sequence.intendedProp;

    // Effort is always from creator intent (choreographic, not a preference)
    const effortTimeline =
      intent?.effortTimeline ?? sequence.effortTimeline ?? null;

    if (viewingContext === "creator-expression") {
      // Creator-expression mode: use intent if available
      if (intent?.propConfig) {
        return {
          bluePropType: intent.propConfig.bluePropType,
          redPropType: intent.propConfig.redPropType,
          catDogMode: intent.propConfig.catDogMode,
          effortTimeline,
          source: "creator-intent",
        };
      }
      // Fallback to legacy intendedProp
      if (legacyProp) {
        return {
          bluePropType: legacyProp.bluePropType,
          redPropType: legacyProp.redPropType,
          catDogMode: legacyProp.catDogMode,
          effortTimeline,
          source: "creator-intent",
        };
      }
    }

    // Notation mode or no intent: use viewer settings
    return {
      bluePropType: viewerBlue,
      redPropType: viewerRed,
      catDogMode: viewerCatDog,
      effortTimeline,
      source: "viewer-settings",
    };
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/contracts/IPresentationResolver.ts src/lib/shared/sequence-viewer/services/implementations/PresentationResolver.ts
git commit -m "feat: add PresentationResolver service"
```

---

### Task 4: Write PresentationResolver tests

**Files:**
- Create: `tests/unit/prop-system/PresentationResolver.test.ts`

- [ ] **Step 1: Write tests covering all resolution paths**

```typescript
// tests/unit/prop-system/PresentationResolver.test.ts
import { describe, it, expect } from "vitest";
import { PresentationResolver } from "$lib/shared/sequence-viewer/services/implementations/PresentationResolver";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

function makeResolver() {
  return new PresentationResolver();
}

function sequenceWithCreatorIntent() {
  return createSequenceData({
    word: "TEST",
    creatorIntent: {
      propConfig: {
        bluePropType: PropType.FAN,
        redPropType: PropType.FAN,
        catDogMode: false,
      },
      effortTimeline: {
        phrases: [{ id: "p1", effortId: "glide", startBeat: 1, endBeat: 4 }],
        transition: "hard",
      },
    },
  });
}

function sequenceWithLegacyIntendedProp() {
  return createSequenceData({
    word: "LEGACY",
    intendedProp: {
      bluePropType: PropType.CLUB,
      redPropType: PropType.CLUB,
      catDogMode: false,
    },
  });
}

function bareSequence() {
  return createSequenceData({ word: "BARE" });
}

describe("PresentationResolver", () => {
  const resolver = makeResolver();
  const viewerBlue = PropType.STAFF;
  const viewerRed = PropType.STAFF;

  describe("creator-expression mode", () => {
    it("uses creatorIntent when present", () => {
      const result = resolver.resolve(
        sequenceWithCreatorIntent(),
        "creator-expression",
        viewerBlue, viewerRed, false
      );
      expect(result.bluePropType).toBe(PropType.FAN);
      expect(result.redPropType).toBe(PropType.FAN);
      expect(result.source).toBe("creator-intent");
      expect(result.effortTimeline?.phrases).toHaveLength(1);
    });

    it("falls back to legacy intendedProp", () => {
      const result = resolver.resolve(
        sequenceWithLegacyIntendedProp(),
        "creator-expression",
        viewerBlue, viewerRed, false
      );
      expect(result.bluePropType).toBe(PropType.CLUB);
      expect(result.source).toBe("creator-intent");
    });

    it("falls back to viewer settings when no intent exists", () => {
      const result = resolver.resolve(
        bareSequence(),
        "creator-expression",
        viewerBlue, viewerRed, false
      );
      expect(result.bluePropType).toBe(PropType.STAFF);
      expect(result.source).toBe("viewer-settings");
    });
  });

  describe("notation mode", () => {
    it("always uses viewer settings for props", () => {
      const result = resolver.resolve(
        sequenceWithCreatorIntent(),
        "notation",
        viewerBlue, viewerRed, false
      );
      expect(result.bluePropType).toBe(PropType.STAFF);
      expect(result.source).toBe("viewer-settings");
    });

    it("still includes effort from creator intent", () => {
      const result = resolver.resolve(
        sequenceWithCreatorIntent(),
        "notation",
        viewerBlue, viewerRed, false
      );
      expect(result.effortTimeline?.phrases).toHaveLength(1);
    });

    it("reads effort from top-level effortTimeline when no creatorIntent", () => {
      const seq = createSequenceData({
        word: "OLD",
        effortTimeline: {
          phrases: [{ id: "p2", effortId: "press", startBeat: 1, endBeat: 4 }],
          transition: "hard",
        },
      });
      const result = resolver.resolve(
        seq, "notation", viewerBlue, viewerRed, false
      );
      expect(result.effortTimeline?.phrases).toHaveLength(1);
      expect(result.effortTimeline?.phrases[0]?.effortId).toBe("press");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/prop-system/PresentationResolver.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/prop-system/PresentationResolver.test.ts
git commit -m "test: add PresentationResolver unit tests"
```

---

### Task 5: Register PresentationResolver in DI, deprecate IntendedPropResolver

**Files:**
- Modify: `src/lib/shared/di/containers/community-container.ts:18,33`
- Modify: `src/lib/shared/di/container-types.ts` (if `intendedPropResolver` is referenced in type)

- [ ] **Step 1: Add PresentationResolver import and registration**

In `community-container.ts`, add import (after line 18):
```typescript
import { PresentationResolver } from "$lib/shared/sequence-viewer/services/implementations/PresentationResolver";
```

In the `.add({` block, after line 33 (`intendedPropResolver`), add:
```typescript
    presentationResolver: () => new PresentationResolver(),
```

Keep `intendedPropResolver` for now — consumers will migrate incrementally.

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/di/containers/community-container.ts
git commit -m "feat: register PresentationResolver in DI container"
```

---

### Task 6: Add creatorIntent to PublicSequenceIndex

**Files:**
- Modify: `src/lib/features/library/domain/models/PublicSequenceIndex.ts:18,128,147`

- [ ] **Step 1: Add import and field**

At `PublicSequenceIndex.ts`, add import after line 19:
```typescript
import type { CreatorIntent } from "$lib/shared/foundation/domain/models/CreatorIntent";
```

After line 128 (`readonly redSoloHash?: string;`), add a new section:
```typescript

  // ============================================================
  // CREATOR INTENT
  // ============================================================

  /** Creator's presentation intent (prop config + effort timeline) */
  readonly creatorIntent?: CreatorIntent | null;
```

- [ ] **Step 2: Update createPublicSequenceIndex factory**

The factory function (line 147) needs `creatorIntent` in its input type. Add to the sequence parameter type:
```typescript
    creatorIntent?: CreatorIntent | null;
```

And in the return object (before `publishedAt`):
```typescript
    ...(sequence.creatorIntent && { creatorIntent: sequence.creatorIntent }),
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/library/domain/models/PublicSequenceIndex.ts
git commit -m "feat: add creatorIntent to PublicSequenceIndex"
```

---

### Task 7: Wire creatorIntent into save path and public index sync

**Files:**
- Modify: `src/lib/features/library/services/implementations/PublicIndexSyncer.ts`

**Note:** `creatorIntent` is populated by the **caller** (e.g., `SequenceViewerOrchestrator` lines 1028-1074) before calling `LibraryRepository.saveSequence()`, not inside the repository. This matches how `intendedProp` is set today. The repository just passes through whatever `creatorIntent` is on the sequence. No changes to `LibraryRepository` needed for population — it already spreads the full `libSeq` object.

- [ ] **Step 1: Include creatorIntent in PublicIndexSyncer**

In `PublicIndexSyncer.ts`, find where the sync data object is built (the `publicData` object around line 112-147 that includes `blueSoloHash`, `redSoloHash`, etc.). Add alongside the other compositional fields:
```typescript
      ...(sequence.creatorIntent && { creatorIntent: sequence.creatorIntent }),
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/library/services/implementations/PublicIndexSyncer.ts
git commit -m "feat: include creatorIntent in public index sync"
```

---

### Task 8: Update Phrase Effort Lab to write creatorIntent.effortTimeline

**Files:**
- Modify: `src/lib/features/phrase-effort-lab/PhraseEffortLabModule.svelte:449-458`

- [ ] **Step 1: Change the Firestore merge write**

Find the save block (around line 449):
```typescript
      await setDoc(
        sequenceRef,
        {
          effortTimeline: timeline,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
```

Replace with:
```typescript
      // Build the full creatorIntent object — Firestore dot-notation only works
      // if the parent map exists, so we write the full object to be safe.
      const updatedIntent: CreatorIntent = {
        propConfig: sequence.creatorIntent?.propConfig ?? {
          bluePropType: settingsService.settings.bluePropType ?? PropType.STAFF,
          redPropType: settingsService.settings.redPropType ?? PropType.STAFF,
          catDogMode: settingsService.settings.catDogMode ?? false,
        },
        effortTimeline: timeline,
      };

      await setDoc(
        sequenceRef,
        {
          effortTimeline: timeline,
          creatorIntent: updatedIntent,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
```

This writes to both `effortTimeline` (legacy compat) and `creatorIntent` (new canonical). If `creatorIntent` doesn't exist on the document yet, it creates the full object including `propConfig` from current settings.

Add imports at the top of the `<script>` block:
```typescript
  import type { CreatorIntent } from "$lib/shared/foundation/domain/models/CreatorIntent";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
```

- [ ] **Step 2: Update local state to reflect creatorIntent**

After the setDoc, update the local sequence state (around line 458):
```typescript
      sequence = {
        ...sequence,
        effortTimeline: timeline,
        creatorIntent: updatedIntent,
      };
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/phrase-effort-lab/PhraseEffortLabModule.svelte
git commit -m "feat: update Phrase Effort Lab to write creatorIntent.effortTimeline"
```

---

### Task 9: Add read-time creatorIntent migration in SequenceHydrator

**Files:**
- Modify: `src/lib/shared/foundation/services/implementations/SequenceHydrator.ts`

**IMPORTANT:** This must happen before wiring PresentationResolver into components. Otherwise, legacy sequences with `intendedProp` but no `creatorIntent` won't have `creatorIntent` populated when the chip checks it.

- [ ] **Step 1: Add creatorIntent migration to hydrate()**

In `SequenceHydrator.hydrate()`, before the compositional hydration (line 17), add:

```typescript
    // Read-time migration: construct creatorIntent from legacy fields
    if (!sequence.creatorIntent) {
      const legacyPropConfig = sequence.intendedProp;
      const legacyEffort = sequence.effortTimeline;

      if (legacyPropConfig || legacyEffort) {
        sequence = {
          ...sequence,
          creatorIntent: {
            propConfig: legacyPropConfig
              ? {
                  bluePropType: legacyPropConfig.bluePropType,
                  redPropType: legacyPropConfig.redPropType,
                  catDogMode: legacyPropConfig.catDogMode,
                }
              : { bluePropType: PropType.STAFF, redPropType: PropType.STAFF, catDogMode: false },
            ...(legacyEffort && { effortTimeline: legacyEffort }),
          },
        };
      }
    }
```

Add the `PropType` import at the top of the file:
```typescript
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/foundation/services/implementations/SequenceHydrator.ts
git commit -m "feat: add read-time creatorIntent migration from legacy fields"
```

---

## Chunk 2: PropContextChip + Wiring Into Detail Viewer

### Task 10: Create PropContextChip component

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/PropContextChip.svelte`

- [ ] **Step 1: Create the chip component**

```svelte
<!--
PropContextChip - Shows which prop config is active and lets the user switch.

Shows nothing when:
- No creatorIntent on the sequence
- Creator's props match the viewer's props
-->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

  const {
    creatorDisplayName,
    creatorBlueProp,
    creatorRedProp,
    viewerBlueProp,
    viewerRedProp,
    source,
    onSwitch,
  } = $props<{
    creatorDisplayName: string;
    creatorBlueProp: PropType;
    creatorRedProp: PropType;
    viewerBlueProp: PropType;
    viewerRedProp: PropType;
    source: "creator-intent" | "viewer-settings";
    onSwitch: () => void;
  }>();

  // Only show if props differ
  const propsDiffer = $derived(
    creatorBlueProp !== viewerBlueProp || creatorRedProp !== viewerRedProp
  );

  // Format prop name for display (e.g., "STAFF" → "staves", "FAN" → "fans")
  function formatPropName(blue: PropType, red: PropType): string {
    if (blue === red) {
      return pluralizeProp(blue);
    }
    return `${pluralizeProp(blue)} / ${pluralizeProp(red)}`;
  }

  function pluralizeProp(prop: PropType): string {
    const name = String(prop).toLowerCase();
    if (name === "staff") return "staves";
    if (name === "fan") return "fans";
    if (name === "club") return "clubs";
    if (name === "poi") return "poi";
    if (name === "buugeng") return "buugeng";
    return name + "s";
  }

  const creatorPropLabel = $derived(formatPropName(creatorBlueProp, creatorRedProp));
  const viewerPropLabel = $derived(formatPropName(viewerBlueProp, viewerRedProp));
</script>

{#if propsDiffer}
  <div class="prop-context-chip">
    {#if source === "creator-intent"}
      <span class="chip-text">
        {creatorDisplayName} saved this with {creatorPropLabel}. Displaying as {creatorPropLabel}.
      </span>
      <button class="chip-switch" onclick={onSwitch}>
        Show with my {viewerPropLabel}
      </button>
    {:else}
      <span class="chip-text">
        You're viewing with {viewerPropLabel}. {creatorDisplayName} saved this with {creatorPropLabel}.
      </span>
      <button class="chip-switch" onclick={onSwitch}>
        Show as intended
      </button>
    {/if}
  </div>
{/if}

<style>
  .prop-context-chip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .chip-text {
    flex: 1;
    min-width: 0;
  }

  .chip-switch {
    background: none;
    border: 1px solid var(--theme-accent, #6366f1);
    color: var(--theme-accent, #6366f1);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }

  .chip-switch:hover {
    background: var(--theme-accent, #6366f1);
    color: white;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/PropContextChip.svelte
git commit -m "feat: add PropContextChip component"
```

---

### Task 11: Wire PresentationResolver + chip into SequenceDetailContent

**Files:**
- Modify: `src/lib/features/browse/sequences/display/components/SequenceDetailContent.svelte:97-117`

- [ ] **Step 1: Add imports**

After line 34, add:
```typescript
  import PropContextChip from "$lib/shared/sequence-viewer/components/PropContextChip.svelte";
  import type { IPresentationResolver, ViewingContext } from "$lib/shared/sequence-viewer/services/contracts/IPresentationResolver";
```

- [ ] **Step 2: Add viewingContext prop**

Update the `$props<{...}>()` destructuring (around line 75) to include:
```typescript
    viewingContext?: ViewingContext;
```

And destructure it with default:
```typescript
    viewingContext = "notation",
```

- [ ] **Step 3: Replace inline prop resolution with PresentationResolver**

Replace the existing `propSettings` block (lines 97-117):

```typescript
  // Ephemeral override: user toggled the chip
  let contextOverride = $state<ViewingContext | null>(null);
  const activeContext = $derived(contextOverride ?? viewingContext);

  const presentation = $derived.by(() => {
    const resolver = container.items.presentationResolver as IPresentationResolver;
    const viewerBlue = settingsService.settings.bluePropType as PropType;
    const viewerRed = settingsService.settings.redPropType as PropType;
    const viewerCatDog = settingsService.settings.catDogMode ?? false;

    return resolver.resolve(
      sequence,
      activeContext,
      viewerBlue,
      viewerRed,
      viewerCatDog
    );
  });

  const propSettings = $derived({
    bluePropType: presentation.bluePropType,
    redPropType: presentation.redPropType,
    catDogMode: presentation.catDogMode,
  });

  function togglePropContext() {
    contextOverride = activeContext === "creator-expression"
      ? "notation"
      : "creator-expression";
  }
```

- [ ] **Step 4: Add the PropContextChip in the template**

Find where the sequence metadata/header is rendered. Add the chip after it:

```svelte
{#if sequence.creatorIntent?.propConfig || sequence.intendedProp}
  <PropContextChip
    creatorDisplayName={sequence.ownerDisplayName ?? "Creator"}
    creatorBlueProp={sequence.creatorIntent?.propConfig?.bluePropType ?? sequence.intendedProp?.bluePropType ?? ("staff" as PropType)}
    creatorRedProp={sequence.creatorIntent?.propConfig?.redPropType ?? sequence.intendedProp?.redPropType ?? ("staff" as PropType)}
    viewerBlueProp={settingsService.settings.bluePropType as PropType}
    viewerRedProp={settingsService.settings.redPropType as PropType}
    source={presentation.source}
    onSwitch={togglePropContext}
  />
{/if}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/browse/sequences/display/components/SequenceDetailContent.svelte
git commit -m "feat: wire PresentationResolver + PropContextChip into detail view"
```

---

### Task 12: Wire PresentationResolver into SequenceViewerOrchestrator

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte:309-349`

The orchestrator currently has its own inline prop resolution with `propSourceOverride`, `hasIntendedProp`, and a `"quick-switch"` mode (lines 309-350). This replacement **removes the quick-switch feature** — the ephemeral prop switching is now handled by the `PropContextChip` toggle in the detail view instead. The `PropSwitcher` component and `handleQuickSwitchProp` / `handlePropSourceChange` functions become dead code and should be removed. Search for `quick-switch`, `quickSwitch`, `PropSwitcher` in the orchestrator and remove all related code.

- [ ] **Step 1: Add import**

```typescript
  import type { IPresentationResolver, ViewingContext } from "../services/contracts/IPresentationResolver";
```

- [ ] **Step 2: Replace the inline resolution**

Find the block starting at line 309 (`let propSourceOverride = $state...`) through line 349. Replace with:

```typescript
  let contextOverride = $state<ViewingContext | null>(null);
  const activeContext = $derived(contextOverride ?? "notation"); // Default to notation; parent can pass viewingContext

  const presentation = $derived.by(() => {
    const resolver = container.items.presentationResolver as IPresentationResolver;
    return resolver.resolve(
      sequence!,
      activeContext,
      bluePropType ?? PropType.STAFF,
      redPropType ?? PropType.STAFF,
      catDogModeEnabled ?? false
    );
  });

  const activeBlueProp = $derived(presentation.bluePropType);
  const activeRedProp = $derived(presentation.redPropType);
  const activeCatDog = $derived(presentation.catDogMode);
```

Keep the existing downstream consumers of `activeBlueProp`, `activeRedProp`, `activeCatDog` unchanged.

- [ ] **Step 3: Update save functions to use creatorIntent**

Find the save blocks (around lines 1028-1074) that set `intendedProp`. Update to also set `creatorIntent`:

```typescript
        creatorIntent: {
          propConfig: {
            bluePropType: bluePropType ?? PropType.STAFF,
            redPropType: redPropType ?? PropType.STAFF,
            catDogMode: catDogModeEnabled ?? false,
          },
          ...(sequence.effortTimeline && { effortTimeline: sequence.effortTimeline }),
        },
        // Keep intendedProp for backwards compat during migration
        intendedProp: {
          bluePropType: bluePropType ?? PropType.STAFF,
          redPropType: redPropType ?? PropType.STAFF,
          catDogMode: catDogModeEnabled ?? false,
        },
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "feat: wire PresentationResolver into SequenceViewerOrchestrator"
```

---

### Task 13: Update SequenceAnimationOrchestrator to read effort from creatorIntent

**Files:**
- Modify: `src/lib/features/compose/services/implementations/SequenceAnimationOrchestrator.ts:119`

- [ ] **Step 1: Update effort timeline source**

Find line 119:
```typescript
      this.effortTimeline = sequenceData.effortTimeline ?? null;
```

Replace with:
```typescript
      this.effortTimeline = sequenceData.creatorIntent?.effortTimeline ?? sequenceData.effortTimeline ?? null;
```

This reads from `creatorIntent` first (new canonical), falls back to top-level `effortTimeline` (legacy).

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/services/implementations/SequenceAnimationOrchestrator.ts
git commit -m "feat: read effort timeline from creatorIntent with legacy fallback"
```

---

## Chunk 3: MotionData Type Split

### Task 14: Create DerivedMotionData type

**Files:**
- Modify: `src/lib/shared/pictograph/shared/domain/models/MotionData.ts`

- [ ] **Step 1: Add DerivedMotionData interface**

After the `MotionData` interface (after line 57), add:

```typescript
/**
 * Runtime/rendered form of MotionData — extends domain data with viewer concerns.
 *
 * StepDeriver produces DerivedMotionData by injecting propType, color, and
 * isVisible from the resolved presentation. All rendering consumers should
 * type their inputs as DerivedMotionData.
 *
 * The base MotionData is the persisted/domain form without viewer concerns.
 */
export interface DerivedMotionData extends MotionData {
  readonly propType: PropType;
  readonly color: MotionColor;
  readonly isVisible: boolean;
}
```

- [ ] **Step 2: Keep MotionData unchanged for now**

Do NOT remove `propType`, `color`, `isVisible` from `MotionData` yet. The base type keeps these fields during the transition so existing consumers don't break. They'll be removed in a separate task after all consumers are migrated.

The current `MotionData` effectively IS `DerivedMotionData` — the new interface just formalizes the separation. Consumer migration (typing things as `DerivedMotionData`) can happen incrementally.

- [ ] **Step 3: Export DerivedMotionData**

Verify the export is at the top level of the module. The import statement for consumers will be:
```typescript
import type { DerivedMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS (additive change only)

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/pictograph/shared/domain/models/MotionData.ts
git commit -m "feat: define DerivedMotionData extending MotionData with viewer concerns"
```

---

### Task 15: Update StepDeriver to accept and pass through presentation props

**Files:**
- Modify: `src/lib/shared/foundation/services/contracts/IStepDeriver.ts:7-9,19-24`
- Modify: `src/lib/shared/foundation/services/implementations/StepDeriver.ts`

- [ ] **Step 1: Expand ViewerPreferences to include full prop config**

In `IStepDeriver.ts`, update `ViewerPreferences`:

```typescript
export interface ViewerPreferences {
  readonly bluePropType: PropType;
  readonly redPropType: PropType;
  readonly catDogMode: boolean;
}
```

Add the `PropType` import if not already present. The existing `propType: PropType` single field becomes the two-color form.

- [ ] **Step 2: Update StepDeriver implementation**

Read `src/lib/shared/foundation/services/implementations/StepDeriver.ts` and update the `deriveSteps` method to inject `propType` and `color` from `ViewerPreferences` when building each motion:

- Blue motions get `color: MotionColor.BLUE`, `propType: viewerPrefs.bluePropType`
- Red motions get `color: MotionColor.RED`, `propType: viewerPrefs.redPropType`
- If `catDogMode` is false, both get `viewerPrefs.bluePropType`
- All get `isVisible: true`

- [ ] **Step 3: Update SequenceHydrator to pass ViewerPreferences**

In `SequenceHydrator.ts:23`, the `deriveSteps` call currently doesn't pass viewer prefs. For now, pass a default:

```typescript
const steps = this.stepDeriver.deriveSteps(
  sequence.blueSoloProp,
  sequence.redSoloProp,
  sequence.stepPairings,
  { bluePropType: PropType.STAFF, redPropType: PropType.STAFF, catDogMode: false }
);
```

This is fine for hydration (props are overridden at render time anyway). The viewer-specific resolution happens in the presentation layer.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Run existing tests**

Run: `npm test`
Expected: All pass (StepDeriver tests may need `viewerPrefs` updated)

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/foundation/services/contracts/IStepDeriver.ts src/lib/shared/foundation/services/implementations/StepDeriver.ts src/lib/shared/foundation/services/implementations/SequenceHydrator.ts
git commit -m "feat: expand ViewerPreferences to include full prop config"
```

---

## Chunk 4: Stop Persisting Steps + Cleanup

### Task 16: Stop writing steps to Firestore

**Files:**
- Modify: `src/lib/features/library/services/implementations/LibraryRepository.ts:387-405`

- [ ] **Step 1: Strip steps from Firestore write data**

Find the write data construction (around line 389):
```typescript
    const rawWriteData = {
      ...libSeq,
```

After the spread, add explicit removals:
```typescript
    const rawWriteData = {
      ...libSeq,
      // Steps are derived from compositional fields on read — don't persist
      steps: undefined,
      startPosition: undefined,
      startingPosition: undefined,
      startingPositionGroup: undefined,
```

The existing `filter(([, v]) => v !== undefined)` on line 403 will strip these.

- [ ] **Step 2: Verify compositional fields are always present before write**

The `ensureComposition` call (line 375-385) already guarantees `blueSoloProp`, `redSoloProp`, `stepPairings`, and hashes are populated. The steps omission is safe.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/library/services/implementations/LibraryRepository.ts
git commit -m "feat: stop persisting steps array to Firestore"
```

---

### Task 17: Delete IntendedPropResolver (Phase 3 cleanup)

**Files:**
- Delete: `src/lib/shared/sequence-viewer/services/implementations/IntendedPropResolver.ts`
- Delete: `src/lib/shared/sequence-viewer/services/contracts/IIntendedPropResolver.ts`
- Delete: `tests/unit/prop-system/IntendedPropResolver.test.ts`
- Modify: `src/lib/shared/di/containers/community-container.ts:18,33`

- [ ] **Step 1: Verify no remaining consumers of IntendedPropResolver**

Run: `grep -r "IntendedPropResolver\|intendedPropResolver\|IIntendedPropResolver" src/ --include="*.ts" --include="*.svelte" -l`

Expected: Only the files being deleted + community-container.ts. If other files reference it, migrate them first.

- [ ] **Step 2: Remove from DI container**

In `community-container.ts`, remove line 18 (import) and line 33 (registration):
```typescript
// Remove: import { IntendedPropResolver } from ...
// Remove: intendedPropResolver: () => new IntendedPropResolver(),
```

- [ ] **Step 3: Delete the files**

```bash
rm src/lib/shared/sequence-viewer/services/implementations/IntendedPropResolver.ts
rm src/lib/shared/sequence-viewer/services/contracts/IIntendedPropResolver.ts
rm tests/unit/prop-system/IntendedPropResolver.test.ts
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove deprecated IntendedPropResolver"
```

---

### Task 18: Update three-tier spec annotation

**Files:**
- Modify: `docs/superpowers/specs/2026-03-12-three-tier-sequence-model-design.md:235`

- [ ] **Step 1: Change "REMOVED" to "DERIVED"**

Find line 235:
```
  // readonly steps: readonly StepData[];           // REMOVED: derived from solo props + pairings
```

Replace with:
```
  // readonly steps: readonly StepData[];           // DERIVED (not persisted): populated at read time from solo props + pairings
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-03-12-three-tier-sequence-model-design.md
git commit -m "docs: clarify steps is DERIVED not REMOVED in three-tier spec"
```

---

### Task 19: Final verification

- [ ] **Step 1: Run full typecheck**

Run: `npm run check`
Expected: PASS with 0 errors

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Verify save path works**

Verify by reading the code path: `LibraryRepository.saveSequence()` → `ensureComposition()` → strips `steps` from write data → writes `creatorIntent` + compositional fields.

- [ ] **Step 5: Verify read path works**

Verify: `SequenceHydrator.hydrate()` → migrates legacy `intendedProp`/`effortTimeline` to `creatorIntent` → derives `steps` from compositional fields.
