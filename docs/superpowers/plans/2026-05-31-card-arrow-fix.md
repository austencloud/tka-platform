# Fix Arrows on Choreo Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Fix Arrows" button to the Choreo Card inspect modal that swaps the front/back preview for a live, clickable grid of the sequence's pictographs; clicking one opens the existing pictograph inspect editor; saving writes the canonical arrow override; "Done" re-bakes the card so the fix shows.

**Architecture:** Pure reuse plus one thin container. `CardInspectModal` gains a `mode` state (`"preview" | "fix"`) and a 4th button. In `"fix"` mode it renders a new `CardArrowFixGrid` (a grid of the existing prop-aware `StepCell`) instead of `CardPreviewStack`. Clicking a cell opens the existing `PictographInspectModal` (props `{ show, stepData, onClose }`) stacked on top — the exact per-prop Special/Default arrow editor. Edits persist to the app-global override repos and re-render the live cell instantly; "Done" calls the already-existing per-card re-bake callback (`inspectedRerender`) so the baked front PNG reflects the canonical fix.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/active/2026-05-31-card-arrow-fix-design.md`

**Commit discipline:** The shared git index may hold other agents' work. Every commit uses an explicit pathspec: `git commit -m "..." -- <exact files>`. Never bare `git commit`, never `git add -A`/`.`.

**Iteration loop:** Run `npm run check:watch` in the background during work. One full `npm run check` before each commit (capture to a log once, grep it — don't re-run to re-filter). Unit tests via `npx vitest run <path>`.

---

## File Structure

**New files:**
- `src/lib/features/choreo-card/services/with-effective-prop-types.ts` — pure helper `withEffectivePropTypes(step, bluePropType, redPropType): StepData` that returns a clone of the step with `motions.blue.propType` / `motions.red.propType` set to the card's effective prop types. This is the correctness pin: it guarantees the override key the editor writes (keyed by `motionData.propType`) equals the key the bake reads. One responsibility: prop-type injection.
- `src/lib/features/choreo-card/services/__tests__/with-effective-prop-types.test.ts` — unit test for the helper.
- `src/lib/features/choreo-card/components/CardArrowFixGrid.svelte` — thin grid of `StepCell` over `sequence.steps` (plus start position), threading effective prop types; emits `onSelect(stepData)` with the prop-injected step. No new interaction logic.

**Modified files:**
- `src/lib/features/choreo-card/components/CardInspectModal.svelte` — add `mode` state, the "Fix Arrows" button, the grid/editor mounts, the dirty flag, the Done→re-bake call, and two new props (`onRerender`, prop types).
- `src/lib/features/choreo-card/components/CatalogBrowser.svelte` — pass an `onRerender` callback (wrapping the existing `inspectedRerender`) and the effective prop types into `CardInspectModal`.

---

## Task 1: Effective prop-type injection helper (the correctness pin)

The override key includes `propType`. The card bakes with the card's effective prop types (`bluePropType ?? settings.bluePropType`). Sequence `StepData` motions are prop-agnostic, so the editor would default to `"staff"` and mis-key a fan/club card. This helper injects the effective prop types into the step handed to the editor.

**Files:**
- Create: `src/lib/features/choreo-card/services/with-effective-prop-types.ts`
- Test: `src/lib/features/choreo-card/services/__tests__/with-effective-prop-types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { withEffectivePropTypes } from "../with-effective-prop-types";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";

function makeStep(): StepData {
  return {
    id: "s1",
    letter: "A",
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions: {
      [MotionColor.BLUE]: { motionType: "pro", rotationDirection: "cw", propType: "staff" } as never,
      [MotionColor.RED]: { motionType: "anti", rotationDirection: "ccw", propType: "staff" } as never,
    },
  } as unknown as StepData;
}

describe("withEffectivePropTypes", () => {
  it("sets blue and red motion propType to the effective prop types", () => {
    const out = withEffectivePropTypes(makeStep(), PropType.FAN, PropType.CLUB);
    expect(out.motions?.[MotionColor.BLUE]?.propType).toBe(PropType.FAN);
    expect(out.motions?.[MotionColor.RED]?.propType).toBe(PropType.CLUB);
  });

  it("does not mutate the input step", () => {
    const input = makeStep();
    withEffectivePropTypes(input, PropType.FAN, PropType.FAN);
    expect(input.motions?.[MotionColor.BLUE]?.propType).toBe("staff");
  });

  it("returns the step unchanged when a motion is missing", () => {
    const step = { ...makeStep(), motions: {} as never } as StepData;
    const out = withEffectivePropTypes(step, PropType.FAN, PropType.FAN);
    expect(out.motions).toEqual({});
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/with-effective-prop-types.test.ts`
Expected: FAIL — cannot find module `../with-effective-prop-types`.

- [ ] **Step 3: Implement the helper**

```ts
// Injects the card's effective prop types into a step's motions so the arrow
// override key the inspect editor writes (keyed by motionData.propType) equals
// the key the card-front bake reads. Sequence StepData is prop-agnostic; the
// bake applies prop types from render options (bluePropType ?? settings), so
// the editor must edit against those same prop types or a fan/club card would
// edit the "staff" key and show no change on re-bake. Pure; never mutates input.
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export function withEffectivePropTypes(
  step: StepData,
  bluePropType: PropType,
  redPropType: PropType,
): StepData {
  const motions = step.motions;
  if (!motions) return step;
  const blue = motions[MotionColor.BLUE];
  const red = motions[MotionColor.RED];
  return {
    ...step,
    motions: {
      ...motions,
      ...(blue && { [MotionColor.BLUE]: { ...blue, propType: bluePropType } }),
      ...(red && { [MotionColor.RED]: { ...red, propType: redPropType } }),
    },
  } as StepData;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/with-effective-prop-types.test.ts`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(choreo-card): prop-type injection helper for arrow-fix key parity" -- \
  src/lib/features/choreo-card/services/with-effective-prop-types.ts \
  src/lib/features/choreo-card/services/__tests__/with-effective-prop-types.test.ts
```

---

## Task 2: `CardArrowFixGrid` — live selectable pictograph grid

A thin grid of the existing `StepCell` over the sequence's steps. Renders each step live (prop-aware) and emits the prop-injected step on click. No selection/animation state — `StepCell` handles its own rendering; this only lays out cells and forwards clicks.

`StepCell` props used (from `StepCell.svelte`): `step: StepData`, `index?: number`, `onClick?: () => void`, `bluePropTypeOverride?: PropType`, `redPropTypeOverride?: PropType`.

**Files:**
- Create: `src/lib/features/choreo-card/components/CardArrowFixGrid.svelte`

- [ ] **Step 1: Build the grid component**

```svelte
<!--
  CardArrowFixGrid.svelte

  Live, clickable grid of a sequence's pictographs for in-card arrow fixing.
  Wraps the prop-aware StepCell (the create workspace's cell primitive); clicking
  a cell emits the step with the card's effective prop types injected, so the
  arrow editor keys its override the same way the card-front bake does.

  StepGrid.svelte is intentionally not reused here: it is coupled to create-module
  selection state. StepCell is the prop-driven primitive underneath it.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import StepCell from "$lib/features/create/shared/workspace-panel/sequence-display/components/StepCell.svelte";
  import { withEffectivePropTypes } from "../services/with-effective-prop-types";

  interface Props {
    sequence: SequenceData;
    bluePropType: PropType;
    redPropType: PropType;
    includeStartPosition?: boolean;
    onSelect: (step: StepData) => void;
  }

  let {
    sequence,
    bluePropType,
    redPropType,
    includeStartPosition = true,
    onSelect,
  }: Props = $props();

  // Start position (step 0) first when present, then non-blank steps.
  const cells = $derived.by<StepData[]>(() => {
    const out: StepData[] = [];
    const start = sequence.startPosition;
    if (includeStartPosition && start) {
      out.push({ ...start, stepNumber: 0, duration: 1, blueReversal: false, redReversal: false, isBlank: false } as unknown as StepData);
    }
    for (const s of sequence.steps ?? []) {
      if (s && !s.isBlank) out.push(s);
    }
    return out;
  });

  function handleSelect(step: StepData): void {
    onSelect(withEffectivePropTypes(step, bluePropType, redPropType));
  }
</script>

<div class="fix-grid" role="group" aria-label="Pictographs — click one to fix its arrows">
  {#each cells as step, i (step.id ?? i)}
    <div class="fix-cell">
      <StepCell
        {step}
        index={i}
        bluePropTypeOverride={bluePropType}
        redPropTypeOverride={redPropType}
        onClick={() => handleSelect(step)}
      />
    </div>
  {/each}
</div>

<style>
  .fix-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
    width: 100%;
    max-height: 100%;
    overflow-y: auto;
    padding: 8px;
    align-content: start;
  }
  .fix-cell {
    aspect-ratio: 1 / 1;
    min-width: 0;
    cursor: pointer;
  }
</style>
```

- [ ] **Step 2: Typecheck the new component**

Run: `npm run check > .claude-tmp/check-fixgrid.log 2>&1; grep -niE "CardArrowFixGrid" .claude-tmp/check-fixgrid.log`
Expected: no errors referencing `CardArrowFixGrid.svelte`. (Pre-existing errors in unrelated files are fine; confirm none name this file.)

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(choreo-card): CardArrowFixGrid live selectable pictograph grid" -- \
  src/lib/features/choreo-card/components/CardArrowFixGrid.svelte
```

---

## Task 3: Integrate Fix-Arrows mode into `CardInspectModal`

Add the 4th button, the `mode` swap, the editor mount, the dirty flag, and the Done→re-bake call. Two new props: `onRerender` (async re-bake, wired from the parent's existing `inspectedRerender`) and the effective prop types (resolved from settings, mirroring `PrintPreviewPages`).

**Files:**
- Modify: `src/lib/features/choreo-card/components/CardInspectModal.svelte`

- [ ] **Step 1: Add imports, props, and state**

In the `<script>` block, add imports:
```ts
  import CardArrowFixGrid from "./CardArrowFixGrid.svelte";
  import PictographInspectModal from "$lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
```

Extend the `Props` interface (add to the existing interface):
```ts
    /** Async re-bake of THIS card's front; returns the new image URL or null. */
    onRerender?: () => Promise<void>;
    /** Card's effective prop types (default: global settings, matching the bake). */
    bluePropType?: PropType;
    redPropType?: PropType;
```

Add to the destructured props (with defaults):
```ts
    onRerender,
    bluePropType,
    redPropType,
```

Add state + derived (after the existing `const word = ...` line):
```ts
  let mode = $state<"preview" | "fix">("preview");
  let selectedStep = $state<StepData | null>(null);
  let dirty = $state(false);
  let rebaking = $state(false);

  // Mirror PrintPreviewPages: explicit prop types win, else global settings,
  // else staff. Keeps the edited override key identical to the baked key.
  const settings = $derived(getSettings());
  const effBlueProp = $derived(bluePropType ?? settings.bluePropType ?? PropType.STAFF);
  const effRedProp = $derived(redPropType ?? settings.redPropType ?? PropType.STAFF);

  function enterFixMode(): void { mode = "fix"; dirty = false; }

  function onCellSelected(step: StepData): void { selectedStep = step; }

  function closeEditor(): void {
    // A save in the editor persisted the override globally; mark dirty so Done
    // (or close) re-bakes. We can't distinguish "saved" from "looked only", so
    // any editor visit marks dirty — a redundant re-bake is cheap and correct.
    dirty = true;
    selectedStep = null;
  }

  async function exitFixMode(): Promise<void> {
    if (dirty && onRerender) {
      rebaking = true;
      try { await onRerender(); } finally { rebaking = false; }
    }
    dirty = false;
    mode = "preview";
  }
```

> **Dirty semantics note:** the editor (`PictographInspectModal`) does not report whether a save occurred, so opening it marks the card dirty. This errs toward a correct (if occasionally redundant) re-bake. A future refinement could thread a `didSave` flag out of the editor; out of scope here.

- [ ] **Step 2: Swap the body by mode and add the Done bar**

Replace the `stack-wrapper` block (currently the `<div class="stack-wrapper" ...>` containing `<CardPreviewStack .../>`) with a mode switch. Keep the existing `CardPreviewStack` invocation verbatim inside the `"preview"` arm.

```svelte
    <div class="stack-wrapper" bind:this={stackEl} role="group" aria-label="Card preview">
      {#if mode === "preview"}
        <CardPreviewStack
          {sequence}
          {showWord}
          {includeStartPosition}
          startPositionLayout={getCatalogLayoutPolicy(sequence.steps?.length ?? 0)}
          showBirthday={true}
          {showQRCode}
          showInfoCard={false}
          printMode={true}
          {frontImageUrl}
          onCardContextMenu={onContextMenu}
        />
      {:else}
        <CardArrowFixGrid
          {sequence}
          bluePropType={effBlueProp}
          redPropType={effRedProp}
          {includeStartPosition}
          onSelect={onCellSelected}
        />
      {/if}
    </div>
```

- [ ] **Step 3: Add the "Fix Arrows" button (preview) and "Done" button (fix) to the actions row**

In the `.actions` div, after the existing `copy-image-btn` button and before the `{#if extraActions}` block, add the mode buttons:

```svelte
        {#if mode === "preview"}
          <button class="action-btn fix-arrows-btn" onclick={enterFixMode} aria-label="Fix arrow positions on this card's pictographs">
            <i class="fas fa-arrows-up-down-left-right"></i> Fix Arrows
          </button>
        {:else}
          <button class="action-btn done-btn" onclick={exitFixMode} disabled={rebaking} aria-label="Finish fixing arrows and re-render the card">
            {#if rebaking}
              <i class="fas fa-spinner fa-spin"></i> Re-rendering...
            {:else}
              <i class="fas fa-check"></i> Done
            {/if}
          </button>
        {/if}
```

- [ ] **Step 4: Mount the editor stacked on top, and update the hint**

After the closing `</div>` of `.modal-container` (just before the `close-btn`), add the editor mount:

```svelte
  {#if selectedStep}
    <PictographInspectModal show stepData={selectedStep} onClose={closeEditor} />
  {/if}
```

Update the `.modal-hint` text to reflect mode (replace the existing `<p class="modal-hint">Front and back side by side</p>`):
```svelte
      <p class="modal-hint">{mode === "fix" ? "Click a pictograph to fix its arrows" : "Front and back side by side"}</p>
```

- [ ] **Step 5: Add button styles**

In the `<style>` block, add:
```css
  .fix-arrows-btn:hover {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.35);
    color: #fff;
  }
  .done-btn {
    background: var(--semantic-success, #238636);
    border-color: var(--semantic-success, #238636);
    color: #fff;
  }
  .done-btn:disabled { opacity: 0.6; cursor: not-allowed; }
```

- [ ] **Step 6: Guard Esc so it closes the editor first, not the whole modal**

The modal's `handleKeydown` closes on Esc. The editor (`PictographInspectModal`) has its own Esc handling on `window`, so when it's open it will handle Esc (clearing arrow selection, then closing itself via `onClose` → `closeEditor`). To avoid the card modal ALSO closing on the same Esc, gate the card modal's Esc while the editor or fix-grid is active:

Replace the existing `handleKeydown`:
```ts
  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (selectedStep) return;        // editor handles its own Esc
    if (mode === "fix") { void exitFixMode(); return; }
    onClose();
  }
```

- [ ] **Step 7: Typecheck**

Run: `npm run check > .claude-tmp/check-cardinspect.log 2>&1; grep -niE "CardInspectModal" .claude-tmp/check-cardinspect.log`
Expected: no errors referencing `CardInspectModal.svelte`.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(choreo-card): Fix Arrows mode in CardInspectModal" -- \
  src/lib/features/choreo-card/components/CardInspectModal.svelte
```

---

## Task 4: Wire `onRerender` + prop types from `CatalogBrowser`

The parent owns `inspectedRerender` (async, returns the new front URL) and updates `inspectedFrontImageUrl`. Pass a wrapper into `CardInspectModal` so Done can trigger the re-bake and refresh the preview image.

**Files:**
- Modify: `src/lib/features/choreo-card/components/CatalogBrowser.svelte:803-819`

- [ ] **Step 1: Add the `onRerender` prop to the `CardInspectModal` invocation**

In the `<CardInspectModal ... />` block (currently lines ~804-818), add an `onRerender` prop that awaits the existing `inspectedRerender` and updates the displayed front image:

```svelte
  <CardInspectModal
    sequence={inspectedSequence}
    {includeStartPosition}
    onContextMenu={onContextMenu ? (x, y, _rerender) => {
      onContextMenu(x, y, () => {
        if (inspectedRerender) {
          inspectedRerender().then(newUrl => {
            if (newUrl) inspectedFrontImageUrl = newUrl;
          });
        }
      });
    } : undefined}
    onRerender={async () => {
      if (!inspectedRerender) return;
      const newUrl = await inspectedRerender();
      if (newUrl) inspectedFrontImageUrl = newUrl;
    }}
    frontImageUrl={inspectedFrontImageUrl}
    onClose={() => { inspectedSequence = null; inspectedFrontImageUrl = null; inspectedRerender = null; }}
  />
```

> Prop types are intentionally NOT passed here: `CatalogBrowser` does not pass explicit prop types to `PrintPreviewPages` either, so both the bake and the editor fall back to the global settings prop types via `CardInspectModal`'s `effBlueProp`/`effRedProp` derivation. This keeps edit-key == bake-key with no extra wiring. If a future caller passes explicit prop types to `PrintPreviewPages`, pass the same values here as `bluePropType`/`redPropType`.

- [ ] **Step 2: Typecheck**

Run: `npm run check > .claude-tmp/check-catalog.log 2>&1; grep -niE "CatalogBrowser" .claude-tmp/check-catalog.log`
Expected: no errors referencing `CatalogBrowser.svelte`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(choreo-card): wire card re-bake into Fix Arrows Done" -- \
  src/lib/features/choreo-card/components/CatalogBrowser.svelte
```

---

## Task 5: Full check + manual verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck (commit gate)**

Run: `npm run check > .claude-tmp/check-final.log 2>&1; grep -niE "choreo-card|CardArrowFixGrid|CardInspectModal|with-effective-prop-types" .claude-tmp/check-final.log`
Expected: no errors in any of the feature's files. (Other pre-existing errors in unrelated files may remain; confirm none are ours.)

- [ ] **Step 2: Run the feature's unit tests**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/with-effective-prop-types.test.ts`
Expected: PASS.

- [ ] **Step 3: Manual gate (user-driven, in browser)**

The controller hands these steps to Austen (Claude does not drive the browser):

1. Open the Choreo Card module → open a catalog → click a card to open the inspect modal.
2. Click **Fix Arrows** → the front/back preview is replaced by a grid of the sequence's pictographs.
3. Click a pictograph whose arrow looks off → the inspect editor opens with that step.
4. Nudge the arrow (WASD) and save → the grid cell updates live to the new position.
5. Click **Done** → button shows "Re-rendering...", then returns to the front/back preview with the baked front PNG reflecting the fix.
6. Open a *different* card containing the same letter at the same orientation/turns/prop → confirm it also shows the corrected arrow (proves the canonical scope).

**Pass criteria:** grid renders all pictographs; editor opens on the correct step; live cell moves on save; baked front updates after Done; the fix appears on other cards with the same pictograph; no console errors.

> If the baked front does NOT reflect the fix but the live cell did, the suspect is prop-type key mismatch (Task 1): verify `effBlueProp`/`effRedProp` equal the prop types `renderFront` baked with (`bluePropType ?? settings.bluePropType`).

---

## Out of scope (do not touch)

- Per-card (non-canonical) arrow overrides.
- Right-click selection on the baked image.
- Whole-deck re-bake on Done.
- `PrintCardRenderer` / worker-front-render-parity changes.
- Threading a `didSave` flag out of `PictographInspectModal` (the dirty flag conservatively re-bakes on any editor visit).

## Self-review notes

- **Spec coverage:** "Fix Arrows" button + mode swap → Task 3; `CardArrowFixGrid` over `StepCell` → Task 2; reuse `PictographInspectModal` exactly → Task 3 Step 4; canonical override persistence → inherited (editor unchanged); prop-type consistency pin → Task 1 + Task 3 derivation; re-bake on Done via existing callback → Task 3 + Task 4; dirty-flag gate → Task 3; start-position cell / skip blanks → Task 2; manual canonical-scope proof → Task 5. Covered.
- **Type consistency:** `withEffectivePropTypes(step, bluePropType, redPropType): StepData` defined in Task 1, consumed in Task 2. `CardArrowFixGrid` props (`sequence`, `bluePropType`, `redPropType`, `includeStartPosition`, `onSelect`) defined in Task 2, consumed in Task 3. `CardInspectModal` new props (`onRerender: () => Promise<void>`, `bluePropType`, `redPropType`) defined in Task 3, consumed in Task 4. `StepCell` prop names (`step`, `index`, `onClick`, `bluePropTypeOverride`, `redPropTypeOverride`) match `StepCell.svelte`. `PictographInspectModal` props (`show`, `stepData`, `onClose`) match its definition.
- **Placeholder scan:** none — every code step shows full code; prop-type source resolved to `settings.bluePropType`.
