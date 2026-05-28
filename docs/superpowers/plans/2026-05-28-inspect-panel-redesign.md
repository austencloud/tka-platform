# Inspect Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the admin Step Editor inspect panel into a two-region layout — a live, clickable pictograph beside collapsible detail sections — with an explicit Global/Special-JSON/Prop-Geometry tier picker, AAA readability via theme tokens, and live WASD feedback for all three editable tiers.

**Architecture:** Restructure `PictographInspectModal` and its sub-components (no new pipeline math). Reuse `PictographContainer` (clickable arrows already wired to `selectedArrowState`), the existing WASD/numeric editor in `PipelineTraceSection`, and the per-tier repositories. The only genuinely new code is bringing `PropGeometryAdjustmentRepository` to full edit parity (local preview + persist + delete + a reusable key generator) so Prop Geometry becomes a first-class WASD-editable tier alongside Global and Special JSON.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest (`tests/config/vitest.config.ts`), Firestore, theme-token CSS system (`--theme-*` / `--semantic-*` / `--prop-*`).

**Repo conventions:**
- Tests live under `tests/unit/**` (NOT co-located). Use the `$lib` alias.
- Run unit tests: `npx vitest run --config tests/config/vitest.config.ts <test-path>`
- Typecheck: `npm run check`
- Build: `npm run build`
- Work happens on `main` (this repo bans branches/worktrees). Commit frequently.
- WASD edits are **base-space** values (rotated downstream by the directional-tuple processor). Do not change this.

**Reference spec:** `docs/superpowers/specs/2026-05-28-inspect-panel-redesign-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/shared/pictograph/arrow/positioning/prop-geometry/domain/prop-geometry-key-deriver.ts` | Build a `PropGeometryKey` from `PictographData` + `MotionData` + arrowColor | **Create** |
| `src/lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator.ts` | Reuse the new key deriver in `lookupPropGeometryAdjustment` | Modify |
| `src/lib/shared/pictograph/arrow/positioning/prop-geometry/state/PropGeometryAdjustmentState.svelte.ts` | Add exact `getAdjustment`/`hasAdjustment` | Modify |
| `src/lib/shared/pictograph/arrow/positioning/prop-geometry/services/implementations/PropGeometryAdjustmentPersister.ts` | Add `delete(keyString)` | Modify |
| `src/lib/shared/pictograph/arrow/positioning/prop-geometry/services/implementations/PropGeometryAdjustmentRepository.ts` | Add `getAdjustment`, `hasAdjustment`, `saveAdjustmentLocal`, `deleteAdjustment`, `deleteAdjustmentLocal` | Modify |
| `src/lib/features/admin/components/feature-flags/shared/CollapsibleSection.svelte` | Optional controlled `open` + `onToggle`; keep `defaultOpen` uncontrolled path | Modify |
| `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte` | Add prop-geometry edit target; readable tier-picker cards; theme tokens; export `enterEditMode()` | Modify |
| `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/MotionColumn.svelte` | Wrap in collapsible (controlled open); theme tokens + AAA type; expose `setOpen`/`enterEditMode` | Modify |
| `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/BasicInfoColumn.svelte` | Wrap in collapsible; theme tokens | Modify |
| `src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte` | Two-region layout; live pictograph; `selectedArrowState` wiring; color-scoped WASD; theme tokens | Modify |
| `tests/unit/prop-geometry/prop-geometry-key-deriver.test.ts` | Test the key deriver | **Create** |
| `tests/unit/prop-geometry/prop-geometry-repository.test.ts` | Test repo local/save/delete parity | **Create** |

---

## Phase A — Prop-Geometry Edit Parity (new code, TDD)

### Task 1: Extract the prop-geometry key deriver

**Files:**
- Create: `src/lib/shared/pictograph/arrow/positioning/prop-geometry/domain/prop-geometry-key-deriver.ts`
- Test: `tests/unit/prop-geometry/prop-geometry-key-deriver.test.ts`
- Modify: `src/lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator.ts:615-662`

The exact key-construction logic currently lives privately in `ArrowAdjustmentCalculator.lookupPropGeometryAdjustment` (lines 615-662). Extract it verbatim so both the calculator and the inspect editor build identical keys.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/prop-geometry/prop-geometry-key-deriver.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { derivePropGeometryKey } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/domain/prop-geometry-key-deriver";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

function makeMotion(over: Partial<MotionData> = {}): MotionData {
  return {
    color: "blue",
    motionType: "anti",
    startLocation: "w",
    endLocation: "n",
    startOrientation: "in",
    endOrientation: "out",
    rotationDirection: "ccw",
    turns: 1.5,
    propType: "staff",
    gridMode: "diamond",
    ...over,
  } as MotionData;
}

function makePictograph(blue: MotionData, red: MotionData): PictographData {
  return {
    id: "t",
    letter: "Q",
    startPosition: "gamma1",
    endPosition: "gamma15",
    motions: { blue, red },
  } as PictographData;
}

describe("derivePropGeometryKey", () => {
  it("builds a 9-dimension key from blue motion context", () => {
    const blue = makeMotion();
    const red = makeMotion({ color: "red", motionType: "static", endOrientation: "in", turns: 0 });
    const key = derivePropGeometryKey(makePictograph(blue, red), blue, "blue");
    expect(key).toEqual({
      gridMode: "diamond",
      propType: "staff",
      otherPropType: "staff",
      positionType: "gamma",
      endOrientation: "out",
      otherEndOrientation: "in",
      motionType: "anti",
      turns: "1.5",
      arrowColor: "blue",
    });
  });

  it("returns null when endPosition is missing", () => {
    const blue = makeMotion();
    const red = makeMotion({ color: "red" });
    const pg = makePictograph(blue, red);
    (pg as { endPosition?: string }).endPosition = undefined;
    expect(derivePropGeometryKey(pg, blue, "blue")).toBeNull();
  });

  it("returns null when a motion is absent", () => {
    const blue = makeMotion();
    const pg = { id: "t", letter: "Q", startPosition: "a", endPosition: "beta5", motions: { blue } } as unknown as PictographData;
    expect(derivePropGeometryKey(pg, blue, "blue")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/prop-geometry/prop-geometry-key-deriver.test.ts`
Expected: FAIL — cannot resolve module `prop-geometry-key-deriver`.

- [ ] **Step 3: Create the deriver**

Create `src/lib/shared/pictograph/arrow/positioning/prop-geometry/domain/prop-geometry-key-deriver.ts`:

```ts
/**
 * Derive a PropGeometryKey from pictograph + motion context.
 *
 * Extracted from ArrowAdjustmentCalculator.lookupPropGeometryAdjustment so the
 * inspect-panel editor and the rendering pipeline build identical keys.
 * Returns null when the scenario can't form a full key (missing motion or endPosition).
 */
import { deriveGridMode as _deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PropGeometryKey } from "./PropGeometryAdjustment";

export function derivePropGeometryKey(
  pictographData: PictographData,
  motionData: MotionData,
  arrowColor?: string
): PropGeometryKey | null {
  const blueMotion = pictographData.motions.blue;
  const redMotion = pictographData.motions.red;
  if (!blueMotion || !redMotion) return null;

  const gridMode = motionData.gridMode || _deriveGridMode(blueMotion, redMotion);

  const endPosition = pictographData.endPosition;
  if (!endPosition) return null;
  const positionType = endPosition.replace(/\d+$/, "");

  const color = arrowColor || motionData.color || "blue";
  const isBlue = color === "blue";
  const thisMotion = isBlue ? blueMotion : redMotion;
  const otherMotion = isBlue ? redMotion : blueMotion;

  return {
    gridMode,
    propType: thisMotion.propType?.toLowerCase() || "staff",
    otherPropType: otherMotion.propType?.toLowerCase() || "staff",
    positionType,
    endOrientation: thisMotion.endOrientation?.toLowerCase() || "in",
    otherEndOrientation: otherMotion.endOrientation?.toLowerCase() || "in",
    motionType: motionData.motionType?.toLowerCase() || "static",
    turns: String(motionData.turns ?? 0),
    arrowColor: color,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/prop-geometry/prop-geometry-key-deriver.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Reuse the deriver in the calculator**

In `ArrowAdjustmentCalculator.ts`, add the import near the other prop-geometry imports (after line 33):

```ts
import { derivePropGeometryKey } from "../../../prop-geometry/domain/prop-geometry-key-deriver";
```

Replace the body of `lookupPropGeometryAdjustment` (lines 615-662) with:

```ts
  private lookupPropGeometryAdjustment(
    pictographData: PictographData,
    motionData: MotionData,
    arrowColor?: string
  ): Point | null {
    const repo = getPropGeometryRepository();
    if (!repo?.isInitialized) return null;

    const propGeometryKey = derivePropGeometryKey(
      pictographData,
      motionData,
      arrowColor
    );
    if (!propGeometryKey) return null;

    const result = repo.getAdjustmentCascading(propGeometryKey);
    return result ? result.adjustment : null;
  }
```

The now-unused local import `PropGeometryKey` type (line 33) may remain if still referenced elsewhere; if `npm run check` flags it as unused, remove that import line.

- [ ] **Step 6: Verify nothing regressed**

Run: `npm run check`
Expected: no new errors in `ArrowAdjustmentCalculator.ts` or the new file.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/prop-geometry/domain/prop-geometry-key-deriver.ts tests/unit/prop-geometry/prop-geometry-key-deriver.test.ts src/lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator.ts
git commit -m "refactor(arrows): extract reusable prop-geometry key deriver"
```

---

### Task 2: Add exact getters to PropGeometryAdjustmentState

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/prop-geometry/state/PropGeometryAdjustmentState.svelte.ts`

The state currently exposes only `getAdjustmentCascading`. The editor needs an **exact** (non-cascading) lookup so it reads/writes the precise key it edits.

- [ ] **Step 1: Add `getAdjustment` and `hasAdjustment` to the returned object**

In `PropGeometryAdjustmentState.svelte.ts`, inside the returned object (after `getAdjustmentCascading`, before `setAdjustment` at line 62), add:

```ts
    /** Exact (non-cascading) lookup by full key. */
    getAdjustment(key: PropGeometryKey): { x: number; y: number } | null {
      const keyString = generatePropGeometryKeyString(key);
      const adjustment = adjustmentsMap.get(keyString);
      return adjustment
        ? { x: adjustment.adjustmentX, y: adjustment.adjustmentY }
        : null;
    },

    hasAdjustment(key: PropGeometryKey): boolean {
      return adjustmentsMap.has(generatePropGeometryKeyString(key));
    },
```

(`generatePropGeometryKeyString` and `PropGeometryKey` are already imported at the top of the file.)

- [ ] **Step 2: Verify typecheck**

Run: `npm run check`
Expected: no errors in `PropGeometryAdjustmentState.svelte.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/prop-geometry/state/PropGeometryAdjustmentState.svelte.ts
git commit -m "feat(arrows): add exact getAdjustment/hasAdjustment to prop-geometry state"
```

---

### Task 3: Add delete to PropGeometryAdjustmentPersister

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/prop-geometry/services/implementations/PropGeometryAdjustmentPersister.ts`

- [ ] **Step 1: Import `firestoreDelete`**

Change the firestore import (line 11) from:

```ts
import { firestoreList, firestoreSet } from "$lib/shared/firestore";
```

to:

```ts
import { firestoreList, firestoreSet, firestoreDelete } from "$lib/shared/firestore";
```

- [ ] **Step 2: Add the `delete` method**

After the `save` method (closes at line 101), add:

```ts
  async delete(keyString: string): Promise<void> {
    try {
      await firestoreDelete(COLLECTION_NAME, keyString);
      logger.success(`Deleted prop geometry: ${keyString}`);
    } catch (error) {
      logger.error(`Failed to delete prop geometry ${keyString}:`, error);
      throw error;
    }
  }
```

- [ ] **Step 3: Confirm `firestoreDelete` is exported from the barrel**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/prop-geometry/prop-geometry-key-deriver.test.ts` (sanity that the alias resolves) and `npm run check`.
Expected: no "firestoreDelete is not exported" error. If `$lib/shared/firestore` does not re-export it, import directly from `$lib/shared/firestore/firestore-crud` instead.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/prop-geometry/services/implementations/PropGeometryAdjustmentPersister.ts
git commit -m "feat(arrows): add delete to prop-geometry persister"
```

---

### Task 4: Add edit-parity methods to PropGeometryAdjustmentRepository

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/prop-geometry/services/implementations/PropGeometryAdjustmentRepository.ts`
- Test: `tests/unit/prop-geometry/prop-geometry-repository.test.ts`

Mirror the Global repo's local/save/delete trio. Reuse the state's `setAdjustment`/`removeAdjustment` for in-memory preview.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/prop-geometry/prop-geometry-repository.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PropGeometryAdjustmentRepository } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/services/implementations/PropGeometryAdjustmentRepository";
import type { PropGeometryAdjustmentInput, PropGeometryKey } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/domain/PropGeometryAdjustment";

// Force admin so the guard passes.
vi.mock("$lib/shared/auth/state/authState.svelte", () => ({
  authState: { user: { email: "austencloud@gmail.com" } },
}));

function makePersister() {
  return {
    loadAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => {}),
  };
}

const input: PropGeometryAdjustmentInput = {
  gridMode: "diamond",
  propType: "staff",
  otherPropType: "staff",
  positionType: "beta",
  endOrientation: "in",
  otherEndOrientation: "in",
  motionType: "static",
  turns: "0",
  arrowColor: "blue",
  adjustmentX: 12,
  adjustmentY: -8,
};

const key: PropGeometryKey = {
  gridMode: "diamond",
  propType: "staff",
  otherPropType: "staff",
  positionType: "beta",
  endOrientation: "in",
  otherEndOrientation: "in",
  motionType: "static",
  turns: "0",
  arrowColor: "blue",
};

describe("PropGeometryAdjustmentRepository edit parity", () => {
  let persister: ReturnType<typeof makePersister>;
  let repo: PropGeometryAdjustmentRepository;

  beforeEach(async () => {
    persister = makePersister();
    repo = new PropGeometryAdjustmentRepository(persister as never);
    await repo.initialize();
  });

  it("saveAdjustmentLocal updates in-memory state without persisting", () => {
    repo.saveAdjustmentLocal(input);
    expect(repo.getAdjustment(key)).toEqual({ x: 12, y: -8 });
    expect(repo.hasAdjustment(key)).toBe(true);
    expect(persister.save).not.toHaveBeenCalled();
  });

  it("deleteAdjustmentLocal removes from in-memory state without persisting", () => {
    repo.saveAdjustmentLocal(input);
    repo.deleteAdjustmentLocal(key);
    expect(repo.getAdjustment(key)).toBeNull();
    expect(persister.delete).not.toHaveBeenCalled();
  });

  it("deleteAdjustment persists the delete", async () => {
    await repo.deleteAdjustment(key);
    expect(persister.delete).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/prop-geometry/prop-geometry-repository.test.ts`
Expected: FAIL — `repo.saveAdjustmentLocal is not a function`.

- [ ] **Step 3: Implement the methods**

In `PropGeometryAdjustmentRepository.ts`, update imports. Change the domain import block (lines 8-14) to also pull the key type and a `Timestamp` type:

```ts
import {
  generatePropGeometryKeyString,
  parsePropGeometryKeyString,
  type PropGeometryAdjustment,
  type PropGeometryAdjustmentInput,
  type PropGeometryKey,
} from "../../domain/PropGeometryAdjustment";
import type { Timestamp } from "firebase/firestore";
```

Add these methods to the class, immediately after `getAdjustmentCascading` (which ends at line 102):

```ts
  /** Exact (non-cascading) lookup. */
  getAdjustment(key: PropGeometryKey): { x: number; y: number } | null {
    return this.state.getAdjustment(key);
  }

  hasAdjustment(key: PropGeometryKey): boolean {
    return this.state.hasAdjustment(key);
  }

  /** In-memory only — live WASD preview before persisting (admin only). */
  saveAdjustmentLocal(input: PropGeometryAdjustmentInput): void {
    if (!this.isAdmin()) {
      throw new Error("Only admin can save prop geometry adjustments");
    }
    const fakeTimestamp = {
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
      toDate: () => new Date(),
      toMillis: () => Date.now(),
      isEqual: () => false,
    } as unknown as Timestamp;

    this.state.setAdjustment({
      gridMode: input.gridMode,
      propType: input.propType,
      otherPropType: input.otherPropType,
      positionType: input.positionType,
      endOrientation: input.endOrientation,
      otherEndOrientation: input.otherEndOrientation,
      motionType: input.motionType,
      turns: input.turns,
      arrowColor: input.arrowColor,
      adjustmentX: input.adjustmentX,
      adjustmentY: input.adjustmentY,
      updatedAt: fakeTimestamp,
      updatedBy: authState.user?.email ?? "unknown",
    });
  }

  /** In-memory only — revert preview (admin only). */
  deleteAdjustmentLocal(key: PropGeometryKey): void {
    if (!this.isAdmin()) {
      throw new Error("Only admin can delete prop geometry adjustments");
    }
    this.state.removeAdjustment(key);
  }

  /** Persist a delete (admin only). */
  async deleteAdjustment(key: PropGeometryKey): Promise<void> {
    if (!this.isAdmin()) {
      throw new Error("Only admin can delete prop geometry adjustments");
    }
    await this.persister.delete(generatePropGeometryKeyString(key));
  }
```

Note: `parsePropGeometryKeyString` is already imported and used by the realtime subscription; keep it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/prop-geometry/prop-geometry-repository.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: no errors in the repository file.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/prop-geometry/services/implementations/PropGeometryAdjustmentRepository.ts tests/unit/prop-geometry/prop-geometry-repository.test.ts
git commit -m "feat(arrows): prop-geometry repo edit parity (local/save/delete)"
```

---

## Phase B — Controlled CollapsibleSection

### Task 5: Add optional controlled open state to CollapsibleSection

**Files:**
- Modify: `src/lib/features/admin/components/feature-flags/shared/CollapsibleSection.svelte`

Keep the existing uncontrolled `defaultOpen` behavior for current callers. Add an optional controlled mode: when `open` is passed (not `undefined`), it is the source of truth and clicks call `onToggle` instead of mutating internal state.

- [ ] **Step 1: Update the script block**

Replace the `<script>` block (lines 1-30) with:

```svelte
<script lang="ts">
  /**
   * CollapsibleSection
   * Expandable/collapsible section for grouping content.
   *
   * Two modes:
   * - Uncontrolled (default): manages its own open state, seeded by `defaultOpen`.
   * - Controlled: pass `open` (boolean) + `onToggle`; the parent owns the state.
   */

  interface Props {
    title: string;
    icon?: string;
    iconColor?: string;
    count?: number;
    defaultOpen?: boolean;
    /** Controlled open state. When provided, overrides internal state. */
    open?: boolean;
    /** Called with the requested next open value when the header is clicked (controlled mode). */
    onToggle?: (next: boolean) => void;
    children: import("svelte").Snippet;
  }

  let {
    title,
    icon,
    iconColor,
    count,
    defaultOpen = true,
    open = undefined,
    onToggle,
    children,
  }: Props = $props();

  let internalOpen = $state(true);
  $effect.pre(() => { internalOpen = defaultOpen; });

  const isControlled = $derived(open !== undefined);
  const isOpen = $derived(isControlled ? (open as boolean) : internalOpen);

  function handleClick() {
    const next = !isOpen;
    if (isControlled) {
      onToggle?.(next);
    } else {
      internalOpen = next;
    }
  }

  // Generate a stable ID from the title for aria-controls
  const sectionId = $derived(`section-${title.toLowerCase().replace(/\s+/g, "-")}`);
</script>
```

- [ ] **Step 2: Point the markup at the new handler**

In the markup, change the button's onclick (line 36) from:

```svelte
    onclick={() => (isOpen = !isOpen)}
```

to:

```svelte
    onclick={handleClick}
```

(The rest of the template — `class:open={isOpen}`, `aria-expanded={isOpen}`, the `{#if isOpen}` content block — is unchanged and now reads the derived `isOpen`.)

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: no errors in `CollapsibleSection.svelte`. Existing uncontrolled callers (admin feature-flags) still compile — they pass neither `open` nor `onToggle`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/admin/components/feature-flags/shared/CollapsibleSection.svelte
git commit -m "feat(ui): add optional controlled mode to CollapsibleSection"
```

---

## Phase C — PipelineTraceSection: prop-geometry target, tier-picker UI, theme tokens

### Task 6: Add prop-geometry as a third editable target (logic)

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte`

This task adds the prop-geometry edit path mirroring the existing global / special-json paths. UI restyle is Task 7.

- [ ] **Step 1: Add imports**

In the `<script>` of `PipelineTraceSection.svelte`, after the special-override imports (after line 31), add:

```ts
  import { getPropGeometryRepository } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/services/prop-geometry-singleton";
  import { derivePropGeometryKey } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/domain/prop-geometry-key-deriver";
  import type { PropGeometryKey } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/domain/PropGeometryAdjustment";
```

- [ ] **Step 2: Widen the editTarget type**

Change line 56 from:

```ts
  let editTarget = $state<"global" | "special-json">("global");
```

to:

```ts
  let editTarget = $state<"global" | "special-json" | "prop-geometry">("global");
```

- [ ] **Step 3: Add a derived prop-geometry key**

After the `specialOverrideKey` derived block (ends line 126), add:

```ts
  const propGeometryKey = $derived.by((): PropGeometryKey | null => {
    const motion = stepData.motions?.[color];
    if (!motion) return null;
    const pictographData: PictographData = {
      id: stepData.id,
      letter: stepData.letter ?? null,
      startPosition: stepData.startPosition,
      endPosition: stepData.endPosition,
      motions: stepData.motions as PictographData["motions"],
    };
    return derivePropGeometryKey(pictographData, motion, color);
  });
```

- [ ] **Step 4: Handle prop-geometry in `syncNumericInputs`**

In `syncNumericInputs` (lines 200-224), add a third branch before the closing brace of the function (after the `special-json` branch ends at line 223):

```ts
    } else if (editTarget === "prop-geometry") {
      const repo = getPropGeometryRepository();
      const existing = repo && propGeometryKey ? repo.getAdjustment(propGeometryKey) : null;
      if (existing) {
        editX = existing.x;
        editY = existing.y;
      } else if (diagnostics?.propGeometry) {
        editX = diagnostics.propGeometry.value.x;
        editY = diagnostics.propGeometry.value.y;
      } else {
        editX = 0;
        editY = 0;
      }
    }
```

- [ ] **Step 5: Widen `selectEditTarget`**

Change the signature (line 226) from:

```ts
  function selectEditTarget(tier: "global" | "special-json") {
```

to:

```ts
  function selectEditTarget(tier: "global" | "special-json" | "prop-geometry") {
```

- [ ] **Step 6: Route updates/save/delete to prop-geometry**

In `handleWASDMovement` (line 265-269), replace the `if/else` that routes by target with:

```ts
    if (editTarget === "global") {
      handleGlobalNumericUpdate();
    } else if (editTarget === "special-json") {
      handleSpecialJsonNumericUpdate();
    } else {
      handlePropGeometryNumericUpdate();
    }
```

Apply the same three-way routing in `handleNumericChange` (lines 330-336):

```ts
  function handleNumericChange() {
    if (editTarget === "global") {
      handleGlobalNumericUpdate();
    } else if (editTarget === "special-json") {
      handleSpecialJsonNumericUpdate();
    } else {
      handlePropGeometryNumericUpdate();
    }
  }
```

In `handleSave` (line 275-278), extend the early dispatch:

```ts
  async function handleSave() {
    if (editTarget === "special-json") {
      return handleSpecialJsonSave();
    }
    if (editTarget === "prop-geometry") {
      return handlePropGeometrySave();
    }
    // ...existing global save logic continues unchanged...
```

In `handleDelete` (line 306-309), extend the early dispatch:

```ts
  async function handleDelete() {
    if (editTarget === "special-json") {
      return handleSpecialJsonDelete();
    }
    if (editTarget === "prop-geometry") {
      return handlePropGeometryDelete();
    }
    // ...existing global delete logic continues unchanged...
```

- [ ] **Step 7: Add the prop-geometry handlers**

After `handleSpecialJsonDelete` (ends line 451), add:

```ts
  function buildPropGeometryInput(x: number, y: number) {
    if (!propGeometryKey) return null;
    return { ...propGeometryKey, adjustmentX: x, adjustmentY: y };
  }

  function handlePropGeometryNumericUpdate() {
    const repo = getPropGeometryRepository();
    const input = buildPropGeometryInput(editX, editY);
    if (!repo || !input) return;
    repo.saveAdjustmentLocal(input);
    pictographPreparer.clearCache();
    globalAdjustmentVersion.increment();
    hasLocalChanges = true;
  }

  async function handlePropGeometrySave() {
    const repo = getPropGeometryRepository();
    const input = buildPropGeometryInput(editX, editY);
    if (!repo || !input) return;
    try {
      saveState = "saving";
      await repo.saveAdjustment(input);
      saveState = "saved";
      hasLocalChanges = false;
      getHapticFeedback()?.trigger("success");
      onDiagnosticsChanged?.();
      setTimeout(() => { saveState = "idle"; }, 2000);
    } catch (error) {
      logger.error("Prop geometry save failed:", error);
      saveState = "idle";
    }
  }

  async function handlePropGeometryDelete() {
    const repo = getPropGeometryRepository();
    if (!repo || !propGeometryKey) return;
    try {
      repo.deleteAdjustmentLocal(propGeometryKey);
      await repo.deleteAdjustment(propGeometryKey);
      pictographPreparer.clearCache();
      globalAdjustmentVersion.increment();
      hasLocalChanges = false;
      getHapticFeedback()?.trigger("warning");
      onDiagnosticsChanged?.();
    } catch (error) {
      logger.error("Prop geometry delete failed:", error);
    }
  }
```

- [ ] **Step 8: Make the prop-geometry tier row selectable**

In the tier-row markup, the `isEditable` flag (line 482) currently is:

```svelte
      {@const isEditable = tier === "global" || tier === "special-json"}
```

Change to:

```svelte
      {@const isEditable = tier === "global" || tier === "special-json" || tier === "prop-geometry"}
```

And the `onclick` cast (lines 491-495) — widen the cast type:

```svelte
        onclick={() => {
          if (isEditing && isEditable) {
            selectEditTarget(tier as "global" | "special-json" | "prop-geometry");
          }
        }}
```

- [ ] **Step 9: Typecheck**

Run: `npm run check`
Expected: no errors in `PipelineTraceSection.svelte`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte
git commit -m "feat(inspect): prop-geometry as third WASD-editable tier"
```

---

### Task 7: Tier-picker UI + theme tokens + controlled edit mode

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte`

Restyle the tier rows into readable cards, replace hardcoded hex with theme tokens, and expose `enterEditMode()` so the parent (arrow click) can open editing on a specific tier.

- [ ] **Step 1: Default the edit target to the active tier; expose `enterEditMode`**

Update `toggleEditing` (lines 185-198) so opening edit mode selects the currently-active tier when it's editable (falls back to global). Replace it with:

```ts
  function defaultEditTargetForActiveTier(): "global" | "special-json" | "prop-geometry" {
    const active = diagnostics?.activeTier;
    if (active === "special-json") return "special-json";
    if (active === "prop-geometry") return "prop-geometry";
    return "global";
  }

  function toggleEditing() {
    if (!isEditing) {
      if (!orchestrator) {
        orchestrator = getArrowAdjustmentOrchestrator() as ArrowAdjustmentOrchestrator;
      }
      const defaultLayer = orchestrator.getDefaultSaveLayer(thisPropType, otherPropType);
      activeLayer = defaultLayer;
      editTarget = defaultEditTargetForActiveTier();
      syncNumericInputs();
    }
    isEditing = !isEditing;
    hasLocalChanges = false;
    saveState = "idle";
  }

  /** Parent entry point: open the editor (called when its arrow is clicked). */
  export function enterEditMode() {
    if (isEditing) return;
    if (!orchestrator) {
      orchestrator = getArrowAdjustmentOrchestrator() as ArrowAdjustmentOrchestrator;
    }
    activeLayer = orchestrator.getDefaultSaveLayer(thisPropType, otherPropType);
    editTarget = defaultEditTargetForActiveTier();
    syncNumericInputs();
    isEditing = true;
    hasLocalChanges = false;
    saveState = "idle";
  }
```

- [ ] **Step 2: Replace hardcoded tier colors with tokens**

Replace `tierColor` (lines 171-178) with:

```ts
  function tierColor(tier: PipelineTier): string {
    switch (tier) {
      case "global": return "var(--semantic-success, #22c55e)";
      case "special-json": return "var(--theme-accent, #a78bfa)";
      case "prop-geometry": return "var(--semantic-info, #22d3d8)";
      case "default": return "var(--theme-text-dim, #8b949e)";
    }
  }
```

- [ ] **Step 3: Restyle the component to theme tokens + AAA type**

Replace the entire `<style>` block (lines 619-946) with the following. This drops the monospace terminal look, raises type sizes to the readable tier, and routes every color through theme tokens.

```svelte
<style>
  .pipeline-trace {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .trace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .trace-header h4 {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .edit-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    min-height: 36px;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    color: var(--theme-text, #fff);
    cursor: pointer;
    font-size: var(--font-size-sm, 14px);
    font-family: inherit;
    transition: border-color var(--duration-fast, 0.15s) ease;
  }

  .edit-toggle:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .edit-toggle.active {
    background: color-mix(in srgb, var(--theme-accent, #58a6ff) 14%, transparent);
    border-color: var(--theme-accent, #58a6ff);
    color: var(--theme-accent, #58a6ff);
  }

  .tier-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    min-height: 44px;
    border-radius: 14px;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, #fff);
    width: 100%;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
    cursor: default;
    text-align: left;
    font-family: inherit;
    margin-bottom: 10px;
    transition: border-color var(--duration-fast, 0.15s) ease;
  }

  .tier-row.editable { cursor: pointer; }
  .tier-row.editable:hover { border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2)); }

  .tier-row.edit-target {
    border: 2px solid var(--theme-accent, #58a6ff);
    background: color-mix(in srgb, var(--theme-accent, #58a6ff) 12%, transparent);
  }

  .tier-row:disabled {
    border-style: dashed;
    opacity: 0.6;
    cursor: default;
  }

  .tier-icon {
    width: 14px;
    text-align: center;
    font-size: 11px;
    color: var(--tier-color);
    flex: none;
  }

  .tier-name {
    font-weight: 600;
    min-width: 110px;
    font-size: var(--font-size-min, 14px);
  }

  .tier-detail {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
  }

  .tier-value {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, #fff);
  }

  .tier-value.none {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-style: italic;
  }

  .tier-badge {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-accent, #a78bfa);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .original-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 16px 8px 30px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .original-value {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    text-decoration: line-through;
  }

  .summary-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px 0;
    margin-top: 4px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .summary-value {
    font-variant-numeric: tabular-nums;
    color: var(--theme-text, #fff);
    font-weight: 600;
  }

  .summary-arrow { color: var(--theme-text-dim, rgba(255, 255, 255, 0.4)); }

  .loading {
    padding: 12px;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
  }

  .editor-section {
    margin-top: 12px;
    padding: 18px;
    background: color-mix(in srgb, var(--theme-accent, #58a6ff) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #58a6ff) 35%, transparent);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .editor-target-label {
    text-align: center;
    font-size: var(--font-size-sm, 14px);
    font-weight: 700;
    color: var(--theme-accent, #a78bfa);
  }

  .editor-values {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 18px;
  }

  .editor-input-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
  }

  .editor-input {
    width: 96px;
    padding: 8px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.25);
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
    font-size: 22px;
    font-weight: 700;
    text-align: center;
  }

  .editor-input:focus {
    outline: none;
    border-color: var(--theme-accent, #58a6ff);
  }

  .editor-hint {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }

  .editor-hint kbd {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 6px;
    padding: 3px 9px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
  }

  .editor-unsaved {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-warning, #f59e0b);
  }

  .editor-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .btn {
    padding: 12px 24px;
    min-height: 44px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: inherit;
  }

  .btn-delete {
    background: transparent;
    color: var(--semantic-error, #f85149);
    border-color: color-mix(in srgb, var(--semantic-error, #f85149) 40%, transparent);
  }

  .btn-save {
    background: var(--semantic-success, #238636);
    color: #fff;
    border-color: var(--semantic-success, #238636);
  }

  .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

  @media (prefers-reduced-motion: reduce) {
    .tier-row, .edit-toggle, .btn { transition: none; }
  }
</style>
```

- [ ] **Step 4: Add the `prop-geometry` label to `tierLabel`**

Confirm `tierLabel` (lines 162-169) already handles `"prop-geometry"` → returns `"Prop Geometry"`. It does. No change needed.

- [ ] **Step 5: Update the editor target label to name the tier**

In the editor markup, the `editor-target-label` (lines 553-557) currently hardcodes "Special JSON Override". Replace the `{:else}` block (lines 553-557) with one that names the active edit target:

```svelte
      {:else}
        <div class="editor-target-label">
          Editing {tierLabel(editTarget)}
        </div>
      {/if}
```

- [ ] **Step 6: Restyle the WASD hint with a keycap**

Replace the `editor-hint` div (lines 580-582) with:

```svelte
      <div class="editor-hint">
        <kbd>W A S D</kbd>
        <span>to move · Shift ×4 · Ctrl+Shift ×40 · live preview in pictograph</span>
      </div>
```

- [ ] **Step 7: Make Revert/Delete appear for prop-geometry too**

In `editor-actions` (lines 590-599), the delete button only shows for special-json-with-override or global-with-value. Add a prop-geometry branch. Replace the `{#if}...{:else if}` chain (lines 591-599) with:

```svelte
        {#if editTarget === "special-json" && diagnostics?.specialJson?.firestoreOverride}
          <button class="btn btn-delete" onclick={handleDelete} title="Revert to original">
            <i class="fas fa-undo" aria-hidden="true"></i> Revert
          </button>
        {:else if editTarget === "prop-geometry" && propGeometryKey && getPropGeometryRepository()?.hasAdjustment(propGeometryKey)}
          <button class="btn btn-delete" onclick={handleDelete} title="Delete prop geometry adjustment">
            <i class="fas fa-trash-alt" aria-hidden="true"></i> Delete
          </button>
        {:else if editTarget === "global" && (currentLayerValue || layer1HasValue || layer2HasValue || layer3HasValue)}
          <button class="btn btn-delete" onclick={handleDelete} title="Delete at this layer">
            <i class="fas fa-trash-alt" aria-hidden="true"></i> Delete
          </button>
        {/if}
```

Also widen the Save button's `disabled` guard (line 603) to enable saving for prop-geometry edits:

```svelte
          disabled={!hasLocalChanges && !(editTarget === "global" && currentLayerValue)}
```

This already enables on `hasLocalChanges`, which prop-geometry edits set. No change required — leave as-is.

- [ ] **Step 8: Typecheck**

Run: `npm run check`
Expected: no errors in `PipelineTraceSection.svelte`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte
git commit -m "feat(inspect): readable themed tier picker + enterEditMode entry point"
```

---

## Phase D — Collapsible motion/basic sections + restyle

### Task 8: Wrap MotionColumn in a controlled collapsible + restyle

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/MotionColumn.svelte`

- [ ] **Step 1: Add controlled-open props and the collapsible import**

In the `<script>` of `MotionColumn.svelte`, add the import (after line 12):

```ts
  import CollapsibleSection from "$lib/features/admin/components/feature-flags/shared/CollapsibleSection.svelte";
```

Extend the `Props` interface (lines 16-25) with:

```ts
    open: boolean;
    onToggle: (next: boolean) => void;
```

Add them to the destructure (line 27):

```ts
  let { color, motion, rotationOverride, copiedSection, onCopy, diagnostics, stepData, onDiagnosticsChanged, open, onToggle }: Props =
    $props();
```

- [ ] **Step 2: Expose `enterEditMode` passthrough**

Replace the existing `handleWASDKeydown` export (lines 32-34) with both the WASD passthrough and an edit-mode entry point:

```ts
  export function handleWASDKeydown(event: KeyboardEvent): boolean {
    return pipelineTraceRef?.handleKeydown(event) ?? false;
  }

  export function enterEditMode(): void {
    pipelineTraceRef?.enterEditMode();
  }
```

- [ ] **Step 3: Wrap the body in CollapsibleSection**

Replace the entire `<section>...</section>` markup (lines 41-147) with a collapsible wrapper. The motion data rows, arrow placement subsection, and `PipelineTraceSection` move inside the snippet. Replace with:

```svelte
<CollapsibleSection
  title={label}
  {open}
  onToggle={onToggle}
  iconColor={color === "blue" ? "var(--prop-blue, #58a6ff)" : "var(--prop-red, #f85149)"}
  icon="fa-circle"
>
  <section class="column {colorClass}">
    <div class="column-header">
      <button
        class="copy-btn"
        onclick={async () =>
          onCopy(await formatMotionText(motion, color, rotationOverride), color)}
        title="Copy {label}"
      >
        <i class="fas fa-copy" aria-hidden="true"></i>
        {#if copiedSection === color}<span class="copied-label">Copied</span>{/if}
      </button>
    </div>

    {#if motion}
      <div class="data-block">
        <div class="data-row"><span class="key">type</span><span class="val type-val">{motion.motionType}</span></div>
        <div class="data-row"><span class="key">turns</span><span class="val">{motion.turns === "fl" ? "float" : motion.turns}</span></div>
        <div class="data-row"><span class="key">rotation</span><span class="val">{motion.rotationDirection}</span></div>
        <div class="data-row"><span class="key">startLoc</span><span class="val">{motion.startLocation}</span></div>
        <div class="data-row"><span class="key">endLoc</span><span class="val">{motion.endLocation}</span></div>
        <div class="data-row"><span class="key">arrowLoc</span><span class="val">{motion.arrowLocation}</span></div>
        <div class="data-row"><span class="key">startOri</span><span class="val">{motion.startOrientation}</span></div>
        <div class="data-row"><span class="key">endOri</span><span class="val">{motion.endOrientation}</span></div>
        {#if motion.prefloatMotionType}
          <div class="data-row warn-row"><span class="key">prefloat</span><span class="val warn-val">{motion.prefloatMotionType}</span></div>
        {/if}
      </div>

      <div class="subsection">
        <h4>Arrow placement</h4>
        <div class="data-block">
          <div class="data-row"><span class="key">posX</span><span class="val num">{motion.arrowPlacementData?.positionX?.toFixed(2) ?? "-"}</span></div>
          <div class="data-row"><span class="key">posY</span><span class="val num">{motion.arrowPlacementData?.positionY?.toFixed(2) ?? "-"}</span></div>
          <div class="data-row"><span class="key">angle</span><span class="val num">{motion.arrowPlacementData?.rotationAngle?.toFixed(1) ?? "-"}°</span></div>
          <div class="data-row"><span class="key">mirrored</span><span class="val bool">{motion.arrowPlacementData?.svgMirrored ? "true" : "false"}</span></div>
          {#if rotationOverride}
            <div class="data-row" class:override-active={rotationOverride.hasOverride}><span class="key">rotOverride</span><span class="val bool">{rotationOverride.hasOverride ? "true" : "false"}</span></div>
          {/if}
          {#if motion.arrowPlacementData?.manualAdjustmentX || motion.arrowPlacementData?.manualAdjustmentY}
            <div class="data-row warn-row"><span class="key">manual</span><span class="val num">({motion.arrowPlacementData?.manualAdjustmentX?.toFixed(2) ?? 0}, {motion.arrowPlacementData?.manualAdjustmentY?.toFixed(2) ?? 0})</span></div>
          {/if}
        </div>
      </div>

      <PipelineTraceSection
        {diagnostics}
        {color}
        {stepData}
        {onDiagnosticsChanged}
        bind:this={pipelineTraceRef}
      />
    {:else}
      <div class="empty-state">No {color} motion</div>
    {/if}
  </section>
</CollapsibleSection>
```

- [ ] **Step 4: Restyle to theme tokens + AAA type**

Replace the `<style>` block (lines 149-320) with:

```svelte
<style>
  .column {
    display: flex;
    flex-direction: column;
    gap: 0;
    font-family: inherit;
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-bottom: 8px;
    margin-bottom: 6px;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    min-height: 36px;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    color: var(--theme-text, #fff);
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
    font-family: inherit;
  }

  .copy-btn:hover { border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2)); }
  .copy-btn:focus-visible { outline: 2px solid var(--theme-accent, #58a6ff); outline-offset: 1px; }
  .copied-label { color: var(--semantic-success, #7ee787); font-weight: 600; }

  .data-block { display: flex; flex-direction: column; gap: 0; }

  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    gap: 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .data-row.warn-row { background: color-mix(in srgb, var(--semantic-warning, #d29922) 12%, transparent); }
  .data-row.override-active { background: color-mix(in srgb, var(--semantic-success, #3fb950) 12%, transparent); }
  .data-row.override-active .val { color: var(--semantic-success, #7ee787); font-weight: 600; }

  .key {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    white-space: nowrap;
  }

  .val {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, #fff);
    text-align: right;
    user-select: all;
    font-variant-numeric: tabular-nums;
  }

  .val.type-val { color: var(--semantic-warning, #ffa657); font-weight: 600; }
  .val.num { color: var(--semantic-info, #79c0ff); }
  .val.bool { color: var(--prop-red, #ff7b72); }
  .val.warn-val { color: var(--semantic-warning, #d29922); }

  .subsection {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .subsection h4 {
    margin: 0 0 6px 0;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  .empty-state {
    padding: 20px;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
  }
</style>
```

(The script's `dotClass`/`colorClass`/`label` deriveds at lines 36-38 remain; `colorClass` is still used on `.column`, `label` feeds the CollapsibleSection title. `dotClass` is now unused — remove its line if `npm run check` flags it.)

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: no errors in `MotionColumn.svelte`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/MotionColumn.svelte
git commit -m "feat(inspect): collapsible themed Motion sections"
```

---

### Task 9: Wrap BasicInfoColumn in a controlled collapsible + restyle

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/BasicInfoColumn.svelte`

- [ ] **Step 1: Read the current file**

Run: `Read src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/BasicInfoColumn.svelte` to see its exact props and markup before editing.

- [ ] **Step 2: Add the collapsible import + controlled props**

In the `<script>`, add:

```ts
  import CollapsibleSection from "$lib/features/admin/components/feature-flags/shared/CollapsibleSection.svelte";
```

Add to the `Props` interface and destructure:

```ts
    open: boolean;
    onToggle: (next: boolean) => void;
```

- [ ] **Step 3: Wrap the existing root markup**

Wrap the component's existing top-level content in:

```svelte
<CollapsibleSection title="Basic Info" {open} onToggle={onToggle} icon="fa-circle-info">
  <!-- existing BasicInfoColumn content unchanged -->
</CollapsibleSection>
```

- [ ] **Step 4: Replace hardcoded colors in its `<style>` with tokens**

For every hardcoded value in the BasicInfoColumn `<style>` block, substitute the token equivalent, matching the mapping used in Task 8:
- backgrounds `#0d1117` / `rgba(...)` → `var(--theme-card-bg, rgba(255,255,255,0.03))`
- borders `#21262d` / `#161b22` → `var(--theme-stroke, rgba(255,255,255,0.08))`
- primary text `#e6edf3` → `var(--theme-text, #fff)`
- dim/label text `#7d8590` / `#8b949e` / `#484f58` → `var(--theme-text-dim, rgba(255,255,255,0.6))`
- numeric/accent values `#79c0ff` → `var(--semantic-info, #79c0ff)`
- any monospace `font-family` declarations → remove (inherit sans-serif)
- raise any `font-size` below `0.875rem`/14px to `var(--font-size-sm, 14px)`; metadata/badges to `var(--font-size-compact, 12px)` (never below 12px)

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: no errors in `BasicInfoColumn.svelte`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/BasicInfoColumn.svelte
git commit -m "feat(inspect): collapsible themed Basic Info section"
```

---

## Phase E — Modal relayout + selection wiring

### Task 10: Two-region layout with live pictograph

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte`

- [ ] **Step 1: Add imports + section open state**

In the `<script>`, add the pictograph + selection imports (after line 25):

```ts
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { selectedArrowState } from "$lib/shared/create/state/selected-arrow-state.svelte";
```

Add open-state for the three sections (after the `lookupKeys` state at line 56):

```ts
  // Accordion open state — all collapsed on open (spec: AAA, no overload)
  let basicOpen = $state(false);
  let blueOpen = $state(false);
  let redOpen = $state(false);
```

Reset them when the modal closes. In the `$effect` that handles `!show` (lines 60-72), add inside the `else if (!show)` branch:

```ts
      basicOpen = false;
      blueOpen = false;
      redOpen = false;
      selectedArrowState.clearSelection();
```

- [ ] **Step 2: Replace the three-column body with two regions**

Replace the `.modal-body` block (lines 327-362) with:

```svelte
      <div class="modal-body">
        <div class="inspect-layout">
          <div class="pictograph-rail">
            {#if displayData}
              <div class="pictograph-frame">
                <PictographContainer
                  pictographData={displayData}
                  arrowsClickable={true}
                  disableTransitions={true}
                />
              </div>
            {/if}
          </div>

          <div class="detail-column themed-scrollbar">
            <BasicInfoColumn
              {displayData}
              {blueMotion}
              {redMotion}
              {lookupKeys}
              {copiedSection}
              onCopy={copyToClipboard}
              open={basicOpen}
              onToggle={(next) => (basicOpen = next)}
            />

            <MotionColumn
              color="blue"
              motion={blueMotion}
              rotationOverride={blueRotationOverride}
              diagnostics={blueDiagnostics}
              stepData={stepData}
              onDiagnosticsChanged={refreshDiagnostics}
              {copiedSection}
              onCopy={copyToClipboard}
              open={blueOpen}
              onToggle={(next) => (blueOpen = next)}
              bind:this={blueMotionColumnRef}
            />

            <MotionColumn
              color="red"
              motion={redMotion}
              rotationOverride={redRotationOverride}
              diagnostics={redDiagnostics}
              stepData={stepData}
              onDiagnosticsChanged={refreshDiagnostics}
              {copiedSection}
              onCopy={copyToClipboard}
              open={redOpen}
              onToggle={(next) => (redOpen = next)}
              bind:this={redMotionColumnRef}
            />
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Replace the modal layout styles**

In the `<style>` block, widen the modal and replace `.columns` with the two-region grid. Change `.modal-content` `max-width` (line 387) from `1200px` to `1320px`. Replace the `.columns` rule (lines 404-409) and its media queries (lines 431-446) with:

```css
  .inspect-layout {
    display: grid;
    grid-template-columns: minmax(320px, 40%) 1fr;
    gap: 20px;
    align-items: start;
  }

  .pictograph-rail {
    position: sticky;
    top: 0;
    align-self: start;
  }

  .pictograph-frame {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    padding: 16px;
    aspect-ratio: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .detail-column {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    max-height: calc(90vh - 120px);
    overflow-y: auto;
  }

  @media (max-width: 720px) {
    .inspect-layout {
      grid-template-columns: 1fr;
    }
    .pictograph-rail {
      position: static;
    }
    .detail-column {
      max-height: none;
    }
  }
```

Also set the modal surface to the theme token. Change `.modal-content` background (line 382) from `#0d1117` to:

```css
    background: var(--theme-panel-bg, rgba(13, 17, 23, 0.98));
```

And remove the `font-family` monospace declaration on `.modal-content` (lines 392-393) so the modal inherits the app sans-serif.

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: no errors in `PictographInspectModal.svelte`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte
git commit -m "feat(inspect): two-region layout with live pictograph"
```

---

### Task 11: Wire arrow selection → auto-expand + edit mode; scope WASD by color

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte`

`selectedArrowState.selectArrow` already fires when an arrow is clicked (`ArrowSvg:435`). React to it: expand that color's section and enter its edit mode. Route WASD to the selected color only.

- [ ] **Step 1: React to selection changes**

In the `<script>`, after the section open-state declarations, add an effect that opens + enters edit mode for the selected color. `selectedArrowState` exposes a `subscribe` callback (seen in `ArrowSvg:400`) and `selectedArrow`. Add:

```ts
  // When an arrow is clicked in the live pictograph, expand + edit that section.
  // selectedArrow.color is typed `string`; narrow against the two values we handle.
  let lastSelectedColor: string | null = $state(null);
  $effect(() => {
    const sel = selectedArrowState.selectedArrow;
    const color = sel?.color ?? null;
    if (color && color !== lastSelectedColor) {
      lastSelectedColor = color;
      if (color === "blue") {
        blueOpen = true;
        // wait for the section to mount its PipelineTraceSection, then enter edit mode
        queueMicrotask(() => blueMotionColumnRef?.enterEditMode());
      } else {
        redOpen = true;
        queueMicrotask(() => redMotionColumnRef?.enterEditMode());
      }
    } else if (!color) {
      lastSelectedColor = null;
    }
  });
```

Confirmed shape (`selected-arrow-state.svelte.ts:11-15`): `selectedArrow` is `{ motionData: MotionData; color: string; pictographData: PictographData } | null`. The getter is `$state`-backed, so the `$effect` re-runs on selection change. `sel.color` is the field (a `string`, values "blue"/"red").

- [ ] **Step 2: Scope WASD delegation to the selected color**

Replace `handleKeydown` (lines 289-302) with a version that routes WASD to the selected color's column first:

```ts
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (selectedArrowState.selectedArrow) {
        selectedArrowState.clearSelection();
      } else {
        onClose();
      }
      return;
    }

    if (["w", "a", "s", "d"].includes(e.key.toLowerCase())) {
      const color = selectedArrowState.selectedArrow?.color ?? null;
      if (color === "red") {
        if (redMotionColumnRef?.handleWASDKeydown(e)) return;
      } else if (color === "blue") {
        if (blueMotionColumnRef?.handleWASDKeydown(e)) return;
      } else {
        // No selection: fall back to whichever is in edit mode (blue first)
        if (blueMotionColumnRef?.handleWASDKeydown(e)) return;
        if (redMotionColumnRef?.handleWASDKeydown(e)) return;
      }
    }
  }
```

(Escape now clears arrow selection first, closing the modal only when nothing is selected — matches the `StepEditorPanel` clear-on-click pattern.)

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: no errors. If the selection field name differs, fix the `.color` references per Step 1's note.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte
git commit -m "feat(inspect): arrow click auto-expands + edits its tier; color-scoped WASD"
```

---

## Phase F — Full verification

### Task 12: Typecheck, build, and manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npm run check`
Expected: PASS with no errors introduced by this work. Fix any that trace to the changed files.

- [ ] **Step 2: Run the new unit tests**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/prop-geometry/`
Expected: all tests in both files PASS.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build completes without errors.

- [ ] **Step 4: Manual verification (admin, browser)**

The dev server runs on port 5173 (user's). Open the create module as admin, select a beat, open the inspect modal (magnifying glass).

Verify, and report findings with evidence (screenshot or described observation per the verification protocol):
1. Modal shows a live pictograph on the left and three **collapsed** sections (Basic Info / Blue Motion / Red Motion) on the right.
2. Clicking the blue arrow expands Blue Motion and shows the tier picker in edit mode; clicking red does the same for red.
3. Tier picker lists Global / Special JSON / Prop Geometry as selectable cards and Default as read-only; selecting each loads its X/Y.
4. Pressing W/A/S/D moves the selected arrow in the live pictograph on every keypress, for **each** of the three editable tiers.
5. Save persists (reopen modal → value retained); Revert/Delete clears it. Test specifically the **Prop Geometry** Save + Delete round-trip.
6. Switching the app theme restyles the modal chrome (surfaces/text/borders follow the theme; tier identity dots stay constant).
7. No text is rendered in monospace or below 12px.

- [ ] **Step 5: Report**

State the verification outcome with evidence. If any check fails, fix the responsible task's code and re-verify before declaring done.

---

## Self-Review

**Spec coverage:**
- Two-region layout + live pictograph → Task 10. ✓
- Collapsible sections, all collapsed on open → Tasks 8, 9, 10. ✓
- Click arrow → auto-expand + edit → Task 11. ✓
- Explicit tier picker (Global/Special/Prop-Geometry editable, Default read-only) → Tasks 6, 7. ✓
- Full prop-geometry edit parity (local/save/delete/key generator) → Tasks 1–4, 6, 7. ✓
- WASD live feedback (base-space) → reused; verified Task 12. ✓
- AAA readability + theme tokens, no hardcoded colors → Tasks 7, 8, 9, 10. ✓
- Color-scoped WASD delegation (spec edge case) → Task 11. ✓

**Type consistency:** `derivePropGeometryKey(pictographData, motionData, arrowColor)` is defined in Task 1 and consumed identically in Tasks 1 (calculator) and 6 (PipelineTraceSection). Repo methods `saveAdjustmentLocal`/`deleteAdjustmentLocal`/`deleteAdjustment`/`getAdjustment`/`hasAdjustment` are defined in Tasks 2–4 and consumed in Tasks 6–7. `enterEditMode()` is exported on PipelineTraceSection (Task 7) → MotionColumn (Task 8) → called in modal (Task 11). `open`/`onToggle` props defined on CollapsibleSection (Task 5) and used by MotionColumn/BasicInfoColumn (Tasks 8–9) and the modal (Task 10). Consistent.

**Placeholder scan:** Two intentional read-first steps (Task 9 Step 1, Task 11 Step 1 note) instruct confirming the exact existing markup / selection field name before editing — these are verification instructions with concrete fallbacks named, not unfinished work.
