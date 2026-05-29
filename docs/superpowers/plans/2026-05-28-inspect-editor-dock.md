# Inspect Editor Dock + Dense Read-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all inspect-modal arrow-adjustment editing into a single constant-height footer dock, slim the tier display to read-only, and collapse labeled read-only data into dense label-less shorthand — so the modal never resizes/scrolls (wide/4K) when editing.

**Architecture:** New `PipelineEditorDock` (selection-driven, owns editing state/logic/WASD) renders in a `flex:none` footer of `.modal-content`. `PipelineTraceSection` becomes read-only tiers + summary. `BasicInfoColumn` becomes a slim full-width info bar. `MotionColumn` shows shorthand lines and drops its WASD/edit relays. Reuses `SegmentedControl` (tier picker) + `LayerTabBar` (global sub-layers).

**Tech Stack:** Svelte 5 runes, theme/`--semantic`/`--prop` tokens, FontAwesome icons.

**Spec:** `docs/superpowers/specs/2026-05-28-inspect-editor-dock-design.md`

**Testing note:** This is a UI refactor relocating existing logic — there are no unit tests for these Svelte components and the save/WASD/key logic moves with **behavior parity**. "Verify" in each task means: `npm run check` EXIT 0 (capture once to a log, grep it) + runtime check on the running dev server (`localhost:5173`, Step Editor → admin inspect modal). Do NOT run `npm run build` in the inner loop.

**Source-of-truth line references** (read these files; the bulk editor logic is *moved verbatim*, not retyped):
- `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte` — editor logic lives at lines ~8–568 (imports, state 53–61, deriveds 65–183, handlers 185–567).
- `src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte`
- `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/MotionColumn.svelte`
- `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/BasicInfoColumn.svelte`
- Reuse: `src/lib/shared/3d/components/controls/SegmentedControl.svelte`, `src/lib/features/create/shared/components/arrow-adjustment/LayerTabBar.svelte`.
- Visual target: `src/routes/test/inspect-dock-mockup/+page.svelte` (delete in Task 7).

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `pictograph-inspect/PipelineEditorDock.svelte` | Selection-driven editing surface (footer). Owns editTarget/X/Y/layer/save/delete/WASD. | **Create** |
| `pictograph-inspect/PipelineTraceSection.svelte` | Read-only tier rows + base→rotated summary. | **Gut** (remove all editing) |
| `pictograph-inspect/MotionColumn.svelte` | Collapsible motion card: shorthand lines + read-only PipelineTraceSection + Copy. | **Modify** (shorthand, drop relays, selected ring) |
| `pictograph-inspect/BasicInfoColumn.svelte` | Slim full-width info bar (shorthand + lookup chips). | **Modify** (de-column) |
| `sequence-actions/PictographInspectModal.svelte` | Layout owner: header / info bar / body (pictograph + Blue + Red) / dock footer. | **Modify** |
| `src/routes/test/inspect-dock-mockup/+page.svelte` | Disposable mockup. | **Delete** (Task 7) |

---

### Task 1: Create `PipelineEditorDock.svelte` (logic relocation + new layout)

Create the dock with ALL editor logic moved from `PipelineTraceSection`, rebound to the global selection, with the new compact layout. Not yet rendered anywhere — this task only creates a compiling component.

**Files:**
- Create: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte`

- [ ] **Step 1: Scaffold script — props + selection binding**

```svelte
<script lang="ts">
  import { getArrowAdjustmentOrchestrator } from "$lib/features/create/shared/getArrowAdjustmentOrchestrator";
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import type { PipelineDiagnostics } from "$lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { ArrowAdjustmentOrchestrator, SelectedArrowContext } from "../../../services/implementations/ArrowAdjustmentOrchestrator";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import LayerTabBar from "../../arrow-adjustment/LayerTabBar.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import { getGlobalAdjustmentRepository } from "$lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton";
  import { globalAdjustmentVersion } from "$lib/shared/pictograph/arrow/positioning/global/state/global-adjustment-version.svelte";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";
  import { getSpecialOverrideRepository } from "$lib/shared/pictograph/arrow/positioning/special-override/services/special-override-singleton";
  import { generateSpecialOverrideKey, extractOriFolderFromPath, type SpecialArrowPlacementInput } from "$lib/shared/pictograph/arrow/positioning/special-override/domain/SpecialArrowPlacement";
  import { generateOrientationKey, resolveEffectiveOriKey } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/special-placement-ori-key-generator";
  import { generateTurnsTuple } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/turns-tuple-key-generator";
  import { deriveGridMode as _deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
  import { getPropGeometryRepository } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/services/prop-geometry-singleton";
  import { derivePropGeometryKey } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/domain/prop-geometry-key-deriver";
  import type { PropGeometryKey } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/domain/PropGeometryAdjustment";
  import { selectedArrowState } from "$lib/shared/create/state/selected-arrow-state.svelte";

  const logger = createComponentLogger("PipelineEditorDock");

  interface Props {
    stepData: StepData;
    blueDiagnostics: PipelineDiagnostics | null;
    redDiagnostics: PipelineDiagnostics | null;
    onDiagnosticsChanged?: () => void;
  }
  let { stepData, blueDiagnostics, redDiagnostics, onDiagnosticsChanged }: Props = $props();

  // Selection-driven binding (live re-bind on color switch)
  const activeColor = $derived<"blue" | "red" | null>(
    (selectedArrowState.selectedArrow?.color as "blue" | "red" | undefined) ?? null
  );
  const diagnostics = $derived(activeColor === "red" ? redDiagnostics : blueDiagnostics);

  let editTarget = $state<"global" | "special-json" | "prop-geometry">("global");
  let editX = $state(0);
  let editY = $state(0);
  let activeLayer = $state<1 | 2 | 3>(2);
  let hasLocalChanges = $state(false);
  let saveState = $state<"idle" | "saving" | "saved">("idle");
  let orchestrator: ArrowAdjustmentOrchestrator | null = null;
</script>
```

- [ ] **Step 2: Move the derived context + key/value logic from `PipelineTraceSection`**

Copy **verbatim** from `PipelineTraceSection.svelte` into the dock script, with one change: every reference to the old `color` prop becomes `activeColor`, and guard for `activeColor === null`. Move these members (current line refs in PipelineTraceSection):
- `selectedArrowContext` (65–76) — change `stepData.motions?.[color]` → `stepData.motions?.[activeColor ?? "blue"]`; return `null` when `activeColor` is null.
- `thisPropType` (78–83), `otherPropType` (85–91) — replace `color` with `activeColor ?? "blue"`.
- `specialOverrideKey` (93–129), `propGeometryKey` (131–142), `propGeometryHasValue` (144–149) — replace `color` with `activeColor ?? "blue"`; `specialOverrideKey`/`propGeometryKey` already early-return on missing motion.
- `layer1HasValue`/`layer2HasValue`/`layer3HasValue` (152–174), `currentLayerValue` (177–183) — unchanged (they use `orchestrator`/`selectedArrowContext`).
- `tierLabel` (185–192) — keep.
- `defaultEditTargetForActiveTier` (208–213) — keep (reads `diagnostics?.activeTier`).
- `syncNumericInputs` (244–281), `selectEditTarget` (283–288), `handleLayerChange` (290–292) — keep.
- `handleKeydown` (294–309), `handleWASDMovement` (311–332) — keep (export `handleKeydown` is NOT needed; dock listens via `<svelte:window>`, see Step 4).
- `handleSave` (334–366), `handleDelete` (368–393), `handleNumericChange` (395–403), `handleGlobalNumericUpdate` (405–421), `handleSpecialJsonNumericUpdate` (423–434), `buildSpecialJsonInput` (436–478), `handleSpecialJsonSave` (480–501), `handleSpecialJsonDelete` (503–518), `buildPropGeometryInput` (520–523), `handlePropGeometryNumericUpdate` (525–533), `handlePropGeometrySave` (535–551), `handlePropGeometryDelete` (553–567) — keep verbatim.

Add a small identity derived for the head:
```ts
  const colorName = $derived(activeColor === "red" ? "Red" : "Blue");
  const colorToken = $derived(activeColor === "red" ? "var(--prop-red, #f85149)" : "var(--prop-blue, #58a6ff)");
  const segColor = $derived<"blue" | "red">(activeColor === "red" ? "red" : "blue");
  const tierOptions = [
    { value: "global" as const, label: "Global" },
    { value: "special-json" as const, label: "Special JSON" },
    { value: "prop-geometry" as const, label: "Prop Geometry" },
  ];
```

- [ ] **Step 3: Add the bind effect (replaces old `enterEditMode`/`toggleEditing`)**

When the selected color changes, ensure the orchestrator exists, default the layer + tier, and sync inputs. Use a guarded effect that only runs work on an actual color change:

```ts
  let lastBoundColor: "blue" | "red" | null = null;
  $effect(() => {
    const c = activeColor;
    if (c === lastBoundColor) return;
    lastBoundColor = c;
    if (!c) { saveState = "idle"; hasLocalChanges = false; return; }
    if (!orchestrator) orchestrator = getArrowAdjustmentOrchestrator() as ArrowAdjustmentOrchestrator;
    activeLayer = orchestrator.getDefaultSaveLayer(thisPropType, otherPropType);
    editTarget = defaultEditTargetForActiveTier();
    hasLocalChanges = false;
    saveState = "idle";
    syncNumericInputs();
  });
```

> Note: this writes `editTarget`/`editX`/`editY` (not effect deps) keyed on `activeColor` only — no re-entrant loop (mirrors the modal's open-side effect pattern).

- [ ] **Step 4: Window WASD listener (only when selected)**

```svelte
<svelte:window onkeydown={(e) => { if (activeColor) handleKeydown(e); }} />
```
`handleKeydown` already returns early for non-WASD keys; it must NOT handle Escape (modal owns Escape).

- [ ] **Step 5: Markup — idle + active, constant height**

```svelte
<footer class="editor-dock" class:idle={!activeColor} style="--c: {colorToken}">
  {#if !activeColor}
    <span class="dock-idle"><i class="fas fa-hand-pointer" aria-hidden="true"></i> Select an arrow to adjust its position →</span>
  {:else}
    <div class="dock-head">
      <span class="dock-dot" style="background: {colorToken}"></span>
      <span class="dock-title">{colorName} · {tierLabel(editTarget)}</span>
    </div>

    <div class="dock-tier">
      <SegmentedControl options={tierOptions} value={editTarget} onchange={selectEditTarget} color={segColor} size="sm" />
    </div>

    {#if editTarget === "global"}
      <LayerTabBar {activeLayer} onLayerChange={handleLayerChange} {layer1HasValue} {layer2HasValue} {layer3HasValue} {thisPropType} {otherPropType} />
    {/if}

    <div class="dock-vals">
      <label class="dock-input-label">X<input type="number" class="dock-input" bind:value={editX} onchange={handleNumericChange} /></label>
      <label class="dock-input-label">Y<input type="number" class="dock-input" bind:value={editY} onchange={handleNumericChange} /></label>
    </div>

    <span class="dock-hint"><kbd>W A S D</kbd> move · Shift ×4 · Ctrl+Shift ×40 · live preview
      {#if hasLocalChanges}<span class="dock-unsaved"><i class="fas fa-circle" aria-hidden="true"></i> Unsaved</span>{/if}
    </span>

    <div class="dock-actions">
      {#if editTarget === "special-json" && diagnostics?.specialJson?.firestoreOverride}
        <button class="btn btn-delete" onclick={handleDelete} title="Revert to original"><i class="fas fa-undo" aria-hidden="true"></i> Revert</button>
      {:else if editTarget === "prop-geometry" && propGeometryHasValue}
        <button class="btn btn-delete icon-only" onclick={handleDelete} aria-label="Delete prop geometry adjustment" title="Delete prop geometry adjustment"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
      {:else if editTarget === "global" && (currentLayerValue || layer1HasValue || layer2HasValue || layer3HasValue)}
        <button class="btn btn-delete icon-only" onclick={handleDelete} aria-label="Delete at this layer" title="Delete at this layer"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
      {/if}
      <button class="btn btn-save" onclick={handleSave} disabled={!hasLocalChanges && !(editTarget === "global" && currentLayerValue)}>
        {#if saveState === "saving"}<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>{:else if saveState === "saved"}<i class="fas fa-check" aria-hidden="true"></i>{:else}<i class="fas fa-save" aria-hidden="true"></i>{/if}
        Save
      </button>
    </div>
  {/if}
</footer>
```

- [ ] **Step 6: Styles (AAA: 44px targets, 14/12 font floor, tokens only)**

```svelte
<style>
  .editor-dock {
    flex: none;
    min-height: 76px;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    padding: 12px 18px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(in srgb, var(--c, #58a6ff) 8%, var(--theme-panel-bg, rgba(13, 17, 23, 0.98)));
  }
  .editor-dock.idle { background: var(--theme-panel-bg, rgba(13, 17, 23, 0.98)); }
  .dock-idle { display: flex; align-items: center; gap: 8px; color: var(--theme-text-dim, rgba(255,255,255,0.5)); font-size: var(--font-size-min, 14px); }
  .dock-head { display: flex; align-items: center; gap: 8px; }
  .dock-dot { width: 12px; height: 12px; border-radius: 50%; flex: none; }
  .dock-title { font-size: var(--font-size-min, 14px); font-weight: 700; white-space: nowrap; color: var(--theme-text, #fff); }
  .dock-tier { min-width: 280px; }
  .dock-vals { display: flex; gap: 12px; }
  .dock-input-label { display: flex; align-items: center; gap: 6px; color: var(--theme-text-dim, rgba(255,255,255,0.6)); font-size: var(--font-size-min, 14px); font-weight: 600; }
  .dock-input {
    width: 76px; min-height: var(--min-touch-target, 44px); padding: 8px 12px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.15)); border-radius: 10px;
    background: rgba(0,0,0,0.25); color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 700; text-align: center;
  }
  .dock-input:focus { outline: none; border-color: var(--theme-accent, #58a6ff); }
  .dock-hint { display: flex; align-items: center; gap: 8px; font-size: var(--font-size-compact, 12px); color: var(--theme-text-dim, rgba(255,255,255,0.55)); }
  .dock-hint kbd { background: var(--theme-card-bg, rgba(255,255,255,0.1)); border: 1px solid var(--theme-stroke, rgba(255,255,255,0.15)); border-radius: 6px; padding: 3px 9px; font-size: var(--font-size-compact, 12px); font-weight: 700; }
  .dock-unsaved { display: flex; align-items: center; gap: 6px; color: var(--semantic-warning, #f59e0b); }
  .dock-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .btn {
    min-height: var(--min-touch-target, 44px); padding: 0 20px; border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.15)); font-size: var(--font-size-min, 14px);
    font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: inherit;
  }
  .btn.icon-only { width: var(--min-touch-target, 44px); padding: 0; }
  .btn-delete { background: transparent; color: var(--semantic-error, #f85149); border-color: color-mix(in srgb, var(--semantic-error, #f85149) 40%, transparent); }
  .btn-save { background: var(--semantic-success, #238636); color: #fff; border-color: var(--semantic-success, #238636); }
  .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
  @media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
</style>
```

- [ ] **Step 7: Verify + commit**

Run: `npm run check > /tmp/check.log 2>&1; echo "EXIT $?"; grep -i "PipelineEditorDock" /tmp/check.log`
Expected: `EXIT 0`, no dock errors.

```bash
git add src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte
git commit -m "feat(inspect): add PipelineEditorDock — selection-driven footer editor"
```

---

### Task 2: Wire dock into the modal; drop WASD relay + motion-column refs

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte`

- [ ] **Step 1: Import the dock**

Add to the import block (after the `PictographContainer` import, ~line 26):
```ts
  import PipelineEditorDock from "./pictograph-inspect/PipelineEditorDock.svelte";
```

- [ ] **Step 2: Remove the motion-column refs**

Delete these two lines (~48–49):
```ts
  let blueMotionColumnRef: MotionColumn | undefined = $state();
  let redMotionColumnRef: MotionColumn | undefined = $state();
```

- [ ] **Step 3: Strip WASD from `handleKeydown` (keep Escape)**

Replace the whole `handleKeydown` function (~321–342) with:
```ts
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (selectedArrowState.selectedArrow) {
        selectedArrowState.clearSelection();
      } else {
        requestClose();
      }
    }
  }
```

- [ ] **Step 4: Remove `bind:this` from both MotionColumn usages**

In the two `<MotionColumn ... />` blocks (~393–419) delete the `bind:this={blueMotionColumnRef}` and `bind:this={redMotionColumnRef}` lines.

- [ ] **Step 5: Render the dock as a footer of `.modal-content`**

Immediately AFTER the `</div>` that closes `.modal-body` (~line 422) and BEFORE the `</div>` that closes `.modal-content` (~423), insert:
```svelte
      <PipelineEditorDock
        {stepData}
        {blueDiagnostics}
        {redDiagnostics}
        onDiagnosticsChanged={refreshDiagnostics}
      />
```
(`stepData` here is the modal prop; it is non-null inside `{#if show && stepData}`.)

- [ ] **Step 6: Verify + commit**

Run: `npm run check > /tmp/check.log 2>&1; echo "EXIT $?"; grep -iE "PictographInspectModal" /tmp/check.log`
Expected: `EXIT 0`. Runtime: open modal, click an arrow → dock binds, WASD moves arrow live (modal no longer relays — dock's window listener handles it). NOTE: the OLD inline editor in PipelineTraceSection still renders too (removed next task) — expect two editors transiently.

```bash
git add src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte
git commit -m "feat(inspect): render editor dock in modal footer, drop WASD relay + refs"
```

---

### Task 3: Slim `PipelineTraceSection` to read-only

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte`

- [ ] **Step 1: Delete all editing logic from the script**

Remove: the `colorName`/`colorToken` deriveds added earlier; `isEditing`, `activeLayer`, `hasLocalChanges`, `saveState`, `editTarget`, `editX`, `editY` (53–61); `orchestrator` (63); `thisPropType`/`otherPropType` (78–91); `specialOverrideKey` (93–129); `propGeometryKey` (131–142); `propGeometryHasValue` (144–149); `layer{1,2,3}HasValue` (152–174); `currentLayerValue` (177–183); `defaultEditTargetForActiveTier` (208–213); `toggleEditing` (215–228); `enterEditMode` (231–242); `syncNumericInputs` (244–281); `selectEditTarget` (283–288); `handleLayerChange` (290–292); `handleKeydown` (294–309); `handleWASDMovement` (311–332); `handleSave` (334–366); `handleDelete` (368–393); `handleNumericChange` (395–403); `handleGlobalNumericUpdate` (405–421); `handleSpecialJsonNumericUpdate` (423–434); `buildSpecialJsonInput` (436–478); `handleSpecialJsonSave` (480–501); `handleSpecialJsonDelete` (503–518); `buildPropGeometryInput` (520–523); `handlePropGeometryNumericUpdate` (525–533); `handlePropGeometrySave` (535–551); `handlePropGeometryDelete` (553–567).

Remove now-unused imports: `getArrowAdjustmentOrchestrator`, `getHapticFeedback`, `ArrowAdjustmentOrchestrator`/`SelectedArrowContext` types, `LayerTabBar`, `getGlobalAdjustmentRepository`, `pictographPreparer`, `getSettings`, `createComponentLogger`, `getSpecialOverrideRepository`, `generateSpecialOverrideKey`/`extractOriFolderFromPath`/`SpecialArrowPlacementInput`, `generateOrientationKey`/`resolveEffectiveOriKey`, `generateTurnsTuple`, `_deriveGridMode`, `getPropGeometryRepository`, `derivePropGeometryKey`, `PropGeometryKey`. Keep `globalAdjustmentVersion` ONLY if a read-only derived still uses it — after gutting, it is unused, so remove it too. Keep `PipelineDiagnostics`/`PipelineTier`, `StepData`.

Keep `tierLabel` (185–192), `tierColor` (194–201), `formatValue` (203–206). The `Props` stay (`diagnostics`, `color`, `stepData`, `onDiagnosticsChanged`) — `onDiagnosticsChanged` becomes unused; remove it from `Props` and the destructure.

- [ ] **Step 2: Make tier rows non-interactive + remove the Edit button**

In the markup: change the `trace-header` (570–585) to drop the `<button class="edit-toggle">` entirely, leaving only the `<h4>Pipeline</h4>`.

Replace each `<button class="tier-row" ...>` with a `<div class="tier-row" ...>`: remove `class:edit-target`, `class:editable`, the `onclick`, and `disabled` attributes. Keep `class:active`, `class:has-value`, `style="--tier-color: ..."`. Keep all inner spans (icon/name/badge/detail/value) and the special-json original-row + summary-row unchanged.

Delete the entire `{#if isEditing} ... {/if}` editor block (656–737).

- [ ] **Step 3: Remove now-dead CSS**

Delete style rules referencing removed markup: `.edit-toggle` (+ `.active`), `.tier-row.editable`, `.tier-row.edit-target`, `.tier-row:disabled`, and every `.editor-*` / `.btn*` / `.dock-*` rule, `.editor-head/-dot/-title/-x/-row/-values/-input-label/-input/-foot/-hint/-unsaved/-actions`. Keep `.pipeline-trace`, `.trace-header`, `.tier-row` (base), `.tier-icon/-name/-detail/-value/-badge`, `.original-*`, `.summary-*`, `.loading`.

- [ ] **Step 4: Verify + commit**

Run: `npm run check > /tmp/check.log 2>&1; echo "EXIT $?"; grep -iE "PipelineTraceSection|unused" /tmp/check.log`
Expected: `EXIT 0`. No unused-selector warnings for PipelineTraceSection. Runtime: only the dock editor remains (no inline editor); tier rows display read-only.

```bash
git add src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte
git commit -m "refactor(inspect): PipelineTraceSection becomes read-only tier display"
```

---

### Task 4: `MotionColumn` — shorthand lines + drop relays + selected ring

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/MotionColumn.svelte`

- [ ] **Step 1: Drop the relay exports + ref**

Remove `pipelineTraceRef` (33), `handleWASDKeydown` (35–37), `enterEditMode` (39–41), and the `bind:this={pipelineTraceRef}` on `<PipelineTraceSection>` (103). Remove the `PipelineTraceSection` type import if it was only for the ref type (keep the component import).

- [ ] **Step 2: Add selection ring binding**

Add to script:
```ts
  import { selectedArrowState } from "$lib/shared/create/state/selected-arrow-state.svelte";
  const isSelected = $derived(selectedArrowState.selectedArrow?.color === color);
```

- [ ] **Step 3: Replace labeled rows with shorthand lines**

Replace the data-block + arrow-placement subsection (lines ~67–96, the `{#if motion} ... </div>` for `.data-block` and the `.subsection` "Arrow placement") with:
```svelte
    {#if motion}
      <div class="motion-line">
        <span class="mt">{motion.motionType}</span>
        <span class="rot">{motion.rotationDirection}</span>
        <span class="path">{motion.startLocation}→{motion.endLocation}</span>
        <span class="ori">{motion.startOrientation}→{motion.endOrientation}</span>
        <span class="turns">{motion.turns === "fl" ? "float" : `${motion.turns}t`}</span>
        {#if motion.prefloatMotionType}<span class="warn-val">pf:{motion.prefloatMotionType}</span>{/if}
      </div>
      <div class="placement-line">
        <span class="pl">{motion.arrowPlacementData?.positionX?.toFixed(0) ?? "-"}, {motion.arrowPlacementData?.positionY?.toFixed(0) ?? "-"}</span>
        <span class="pl">{motion.arrowPlacementData?.rotationAngle?.toFixed(0) ?? "-"}°</span>
        {#if motion.arrowPlacementData?.svgMirrored}<span class="pl mir">mirrored</span>{/if}
        {#if rotationOverride?.hasOverride}<span class="pl ov">rotOverride</span>{/if}
        {#if motion.arrowPlacementData?.manualAdjustmentX || motion.arrowPlacementData?.manualAdjustmentY}
          <span class="pl warn-val">manual ({motion.arrowPlacementData?.manualAdjustmentX?.toFixed(0) ?? 0}, {motion.arrowPlacementData?.manualAdjustmentY?.toFixed(0) ?? 0})</span>
        {/if}
      </div>

      <PipelineTraceSection {diagnostics} {color} {stepData} />
    {:else}
      <div class="empty-state">No {color} motion</div>
    {/if}
```
(Note: `PipelineTraceSection` no longer takes `onDiagnosticsChanged` — removed in Task 3.)

- [ ] **Step 4: Wire the selected ring on the CollapsibleSection wrapper**

The `CollapsibleSection` renders its own card; add the ring via a wrapper class on the `<section class="column {colorClass}">` — add `class:selected={isSelected}`.

- [ ] **Step 5: Replace data-block CSS with shorthand styles**

Remove `.data-block`, `.data-row`, `.warn-row`, `.override-active`, `.key`, `.val`, `.val.*`, `.subsection`, `.subsection h4` rules. Add:
```svelte
  .motion-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; padding: 2px; }
  .motion-line .mt { color: var(--semantic-warning, #ffa657); }
  .motion-line .rot { color: var(--theme-accent, #d2a8ff); }
  .motion-line .path { color: var(--theme-text, #fff); }
  .motion-line .ori { color: var(--semantic-info, #79c0ff); }
  .motion-line .turns { color: var(--theme-text-dim, #8b949e); }
  .motion-line .warn-val { color: var(--semantic-warning, #d29922); font-size: var(--font-size-compact, 12px); }
  .placement-line { display: flex; flex-wrap: wrap; gap: 10px; font-size: var(--font-size-compact, 12px); color: var(--theme-text-dim, #8b949e); font-variant-numeric: tabular-nums; padding: 0 2px 4px; }
  .placement-line .pl { color: var(--theme-text-muted, #c9d1d9); }
  .placement-line .mir { font-style: italic; color: var(--theme-text-dim, #6b7480); }
  .placement-line .ov { color: var(--semantic-success, #3fb950); }
  .placement-line .warn-val { color: var(--semantic-warning, #d29922); }
  .column.selected { box-shadow: 0 0 0 1px var(--prop-blue, #58a6ff); }
```
Then refine the ring per color — append:
```svelte
  .red-column.selected { box-shadow: 0 0 0 1px var(--prop-red, #f85149); }
  .blue-column.selected { box-shadow: 0 0 0 1px var(--prop-blue, #58a6ff); }
```

- [ ] **Step 6: Verify + commit**

Run: `npm run check > /tmp/check.log 2>&1; echo "EXIT $?"; grep -iE "MotionColumn|unused" /tmp/check.log`
Expected: `EXIT 0`. Runtime: motion cards show `anti cw s→e in→out 0t` + placement line; selected card rings in its color; WASD still edits via dock.

```bash
git add src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/MotionColumn.svelte
git commit -m "feat(inspect): MotionColumn dense shorthand + selected ring, drop WASD relay"
```

---

### Task 5: `BasicInfoColumn` → slim info bar; modal places it

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/BasicInfoColumn.svelte`
- Modify: `src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte`

- [ ] **Step 1: Rewrite `BasicInfoColumn` as a bar (no CollapsibleSection)**

Replace the component body. Keep `Props` (`displayData`, `blueMotion`, `redMotion`, `lookupKeys`, `copiedSection`, `onCopy`) but DROP `open`/`onToggle` (no longer collapsible). Remove the `CollapsibleSection` import; keep `formatBasicInfo`/`formatLookupKeysText`.

```svelte
<div class="info-bar">
  <div class="basic-line">
    {#if displayData?.letter}<span class="bl letter">{displayData.letter}</span><span class="sep">·</span>{/if}
    <span class="bl">{blueMotion?.gridMode ?? redMotion?.gridMode ?? "—"}</span>
    <span class="sep">·</span>
    <span class="bl">{blueMotion?.propType ?? redMotion?.propType ?? "staff"}</span>
    <span class="sep">·</span>
    <span class="bl path">{displayData?.startPosition ?? "—"} → {displayData?.endPosition ?? "—"}</span>
  </div>
  <div class="lookup">
    {#if lookupKeys}
      <span class="lk">ori_key <b>{lookupKeys.oriKey}</b></span>
      <span class="lk">turns <b>{lookupKeys.turnsTuple}</b></span>
      {#if lookupKeys.blueRotationOverrideKey}<span class="lk">blue_rot <b>{lookupKeys.blueRotationOverrideKey}</b></span>{/if}
      {#if lookupKeys.redRotationOverrideKey}<span class="lk">red_rot <b>{lookupKeys.redRotationOverrideKey}</b></span>{/if}
    {/if}
    <button class="copy-btn" onclick={() => onCopy(formatBasicInfo(displayData, blueMotion, redMotion), "basic")} title="Copy Basic Info" aria-label="Copy Basic Info">
      <i class="fas fa-copy" aria-hidden="true"></i>{#if copiedSection === "basic"}<span class="copied">Copied!</span>{/if}
    </button>
  </div>
</div>

<style>
  .info-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 10px 18px; border-bottom: 1px solid var(--theme-stroke, rgba(255,255,255,0.1)); background: rgba(255,255,255,0.015); }
  .basic-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; font-size: var(--font-size-min, 16px); font-weight: 600; color: var(--theme-text-muted, #c9d1d9); font-variant-numeric: tabular-nums; }
  .basic-line .letter { color: var(--semantic-info, #79c0ff); font-weight: 800; font-size: 19px; }
  .basic-line .path { color: var(--theme-text, #fff); }
  .basic-line .sep { color: var(--theme-stroke-strong, #3a4250); }
  .lookup { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .lk { font-size: var(--font-size-compact, 12px); color: var(--theme-text-dim, #6b7480); background: var(--theme-card-bg, rgba(255,255,255,0.04)); border: 1px solid var(--theme-stroke, rgba(255,255,255,0.1)); border-radius: 6px; padding: 3px 8px; font-variant-numeric: tabular-nums; }
  .lk b { color: var(--theme-text, #c9d1d9); font-weight: 700; }
  .copy-btn { min-height: var(--min-touch-target, 44px); display: flex; align-items: center; gap: 4px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--theme-stroke, rgba(255,255,255,0.1)); background: transparent; color: var(--theme-text-dim, rgba(255,255,255,0.6)); cursor: pointer; font-size: var(--font-size-compact, 12px); font-family: inherit; }
  .copied { color: var(--semantic-success, #7ee787); font-weight: 600; }
</style>
```

- [ ] **Step 2: Move `<BasicInfoColumn>` out of the detail column in the modal**

In `PictographInspectModal.svelte`, cut the `<BasicInfoColumn ... />` block out of `.detail-column` (it was the first child, ~382–391). Place it between `<InspectModalHeader/>` and `<div class="modal-body">` (~365–367):
```svelte
      <BasicInfoColumn {displayData} {blueMotion} {redMotion} {lookupKeys} {copiedSection} onCopy={copyToClipboard} />
```
Remove the `open={basicOpen}` / `onToggle` props (gone from the component).

- [ ] **Step 3: Drop `basicOpen` state + expand-on-wide for basic**

Remove `let basicOpen = $state(false);` (~61). In the open-side effect, remove the `basicOpen = wide;` line (keep `blueOpen`/`redOpen`). In `requestClose()`, remove `basicOpen = false;`.

- [ ] **Step 4: Verify + commit**

Run: `npm run check > /tmp/check.log 2>&1; echo "EXIT $?"; grep -iE "BasicInfoColumn|PictographInspectModal|unused" /tmp/check.log`
Expected: `EXIT 0`, no unused warnings. Runtime: info bar between header and body; detail-column holds only Blue + Red.

```bash
git add src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/BasicInfoColumn.svelte src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte
git commit -m "feat(inspect): BasicInfoColumn becomes slim info bar above the body"
```

---

### Task 6: Modal layout polish — ensure no scroll/resize on wide

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte`

- [ ] **Step 1: Confirm body hugs + dock pins**

Verify `.modal-body { flex: 0 1 auto; min-height: 0; overflow-y: auto; }` is present (it is). The dock is `flex: none` (its own style). With `.modal-content` flex column + `max-height: min(90vh, 1040px)`, the order is header / info bar / body / dock. No change needed unless runtime shows the dock pushed below the cap — if so, the body scrolls and the dock stays pinned (correct).

- [ ] **Step 2: Runtime verification (wide/4K)**

On `localhost:5173`, Step Editor → admin inspect, wide window:
- Open modal: no scrollbar, modal centered, dock idle hint visible.
- Click blue arrow: modal height UNCHANGED, dock fills, blue card rings, WASD moves arrow live in pictograph.
- Switch to red arrow: dock re-binds to red (tier resets to active, X/Y resync), red card rings.
- Edit + Save: tiers + summary refresh, no `effect_update_depth_exceeded` in console.
- Escape once: selection clears, dock idle. Escape again: modal closes.

Capture a console check: `list_console_messages` (read-only) shows no depth-exceeded errors. If you cannot drive the browser, state: "I cannot verify visually — please confirm: no resize on edit, dock binds on arrow click, WASD live, no console loop."

- [ ] **Step 3: Commit any fixes**

```bash
git add src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte
git commit -m "fix(inspect): footer dock layout — constant height, no scroll on wide"
```
(If no changes were needed, skip the commit.)

---

### Task 7: AAA audit + delete mockup

**Files:**
- Delete: `src/routes/test/inspect-dock-mockup/+page.svelte`
- Possibly modify: any component failing the audit

- [ ] **Step 1: Grep the touched components for AAA violations**

Run (read-only checks):
```bash
grep -rnE "type=\"checkbox\"" src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/ ; echo "checkbox count above (want 0)"
```
Manually confirm every interactive control in `PipelineEditorDock` + `BasicInfoColumn` copy button uses `min-height: var(--min-touch-target)` (SegmentedControl + LayerTabBar already comply — SegmentedControl uses `var(--min-touch-target)`; LayerTabBar's tabs are 12px font / ~34px — **bump LayerTabBar `.layer-tab` to `min-height: var(--min-touch-target)` and `font-size: var(--font-size-compact)` is acceptable as supplementary** but height must hit 44). Confirm no essential text < 14px and no text < 12px.

- [ ] **Step 2: If LayerTabBar fails touch target, fix it**

In `src/lib/features/create/shared/components/arrow-adjustment/LayerTabBar.svelte`, `.layer-tab`: add `min-height: var(--min-touch-target, 44px); display: flex; align-items: center; justify-content: center;`. (Font 12px stays — these are dense sub-tabs, supplementary.)

- [ ] **Step 3: Delete the mockup route**

```bash
git rm src/routes/test/inspect-dock-mockup/+page.svelte
```

- [ ] **Step 4: Final full check + commit**

Run: `npm run check > /tmp/check.log 2>&1; echo "EXIT $?"; grep -iE "error|unused" /tmp/check.log | head`
Expected: `EXIT 0`.

```bash
git add -- src/lib/features/create/shared/components/arrow-adjustment/LayerTabBar.svelte
git commit -m "chore(inspect): AAA touch-target audit + remove mockup route"
```

---

## Self-Review

**Spec coverage:**
- Reserved footer dock, constant height → Task 1 (`.editor-dock min-height`, idle/active same height) + Task 2 (footer render) + Task 6 (verify). ✓
- PipelineTraceSection read-only → Task 3. ✓
- BasicInfoColumn → info bar → Task 5. ✓
- MotionColumn shorthand + drop relays + ring → Task 4. ✓
- Modal wires dock, drops WASD relay/refs, Escape kept, expand-on-wide blue/red only → Task 2 + Task 5 Step 3. ✓
- Click-arrow activation, live re-bind → Task 1 Steps 3 (bind effect keyed on activeColor). ✓
- Reuse SegmentedControl + LayerTabBar → Task 1 Step 5. ✓
- AAA touch/font → Task 1 styles + Task 7 audit. ✓
- Live-update pipeline unchanged → logic moved verbatim (Task 1 Step 2). ✓
- Delete mockup → Task 7. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Relocation steps cite exact source line ranges + the changed identifier (`color`→`activeColor`). New code shown in full.

**Type consistency:** `editTarget` union `"global"|"special-json"|"prop-geometry"` matches PipelineTraceSection + `selectEditTarget` signature. `SegmentedControl` is generic `<T extends string>`; `tierOptions` values are that exact union → `value={editTarget}` + `onchange={selectEditTarget}` type-check. `activeColor` is `"blue"|"red"|null`; `segColor`/`colorName` collapse null→blue for display only; key/repo logic guards via `selectedArrowContext` returning null. `LayerTabBar` props match. `diagnostics` derived is `PipelineDiagnostics | null` — same type the handlers already expect.
