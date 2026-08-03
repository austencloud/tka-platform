---
status: active
value: 3
effort: M
remaining: "Body status: Active"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Multi-Select Turn Editing — Design

**Date:** 2026-07-14
**Status:** Active
**Module:** Create (sequence workspace + step editor)

## Problem

The Create workspace only supports single-beat selection. To set the same turn
value across many beats, the user edits each one individually. Wanted: shift /
ctrl-click to multi-select pictographs in the workspace, then a batch step
editor that shows all selected pictographs in a grid and edits their turns
together — with an elegant treatment for when the selected steps have
**different** turn values.

## Ground truth (turns)

Turns are **per-hand** (blue + red each carry their own value). A turn value is
`number | "fl"` (`TurnValue`, `turn-pattern-data.ts:14`). Range for shifts:
`fl (-0.5) → -0.25 → 0 → 0.25 → 0.5 → 0.75 → 1 → 1.5 → 2 → 2.5 → 3`. UI stepper
moves ±0.5. `"fl"` (float) is normalized to `-0.5` for numeric math. Per-step
min is `-0.5`→`"fl"` for pro/anti shifts, else `0`; max is `3`. (MCP
`get_term_definition("turns")`.)

## What already exists (reuse — do NOT rebuild)

| Piece | Path | State |
|---|---|---|
| Multi-select state (`Set<number>`, `mode`, `toggleStepInMultiSelect`, `selectAllBeats`, `enterMultiSelectMode`, `exitMultiSelectMode`, `clearMultiSelection`) | `create/shared/state/selection/sequence-selection-state.svelte.ts` | Defined, **unwired** |
| Start-pos-vs-beats mix guard | same, lines 164–184 | Present |
| Orchestrator re-export of multi-select surface | `create/shared/state/sequence-state-orchestrator.svelte.ts:714–727` | Present |
| Batch-panel open/close (sets `editPanelStepsData`, reuses `isEditPanelOpen`) | `shared/create/state/panel-coordination-state.svelte.ts:501` | Present, **no body renders it** |
| Auto-open batch panel when `size > 1` | `create/shared/state/managers/auto-edit-panel-manager.svelte.ts:75` | Present |
| Batch-edit apply model + undo snapshot | `create/shared/services/step-operations/batch-edit-handler.ts` | Present (blind-spreads; not turn-aware) |
| Orphaned selection toolbar ("{n} selected / Select All / Cancel") | `create/shared/workspace-panel/components/SelectionToolbar.svelte` | Built, **never rendered** |
| Dead grid props `selectedStepNumbers` / `isMultiSelectMode` | `StepGrid.svelte:53–54,80–81` | Accepted, **never passed** |
| Earmarked multi highlight `.step-cell.highlighted` (`--highlight-bg/border`) | `StepCell.svelte:591–608` | Present, **unfed** |
| Per-hand turn stepper | `create/shared/components/sequence-actions/PropTurnsControl.svelte` | Reuse |
| Blue/red card layout | `.../TurnsEditMode.svelte` | Reuse pattern |
| Segmented single-select primitive | `shared/3d/components/controls/SegmentedControl.svelte` | Reuse (per `chip-primitives.md`) |
| Responsive N-item grid | `shared/components/panel/PanelGrid.svelte` | Reuse |
| Per-step turns mutation (float/orientation/reversal/propagation) | `create/shared/services/step-operations/turns-handler.ts` | Reuse |

## What is net-new

1. `selectionAnchor` + `rangeSelectTo(target)` in the selection state (range
   logic doesn't exist).
2. Modifier threading `{ range, toggle }` up the click path (mechanical, 5 files).
3. `BatchStepEditor` panel body (grid of pictographs + per-hand Set/Adjust turns).
4. `applyBatchTurns(...)` write path (one undo snapshot, ascending iteration,
   single commit).
5. Aggregation helper (shared value vs "Mixed" + range, per hand).

## Design

### 1. Selection wiring

Add to `sequence-selection-state.svelte.ts`:
- `selectionAnchor: number | null` (transient, not persisted).
- `rangeSelectTo(target)`: enters multi mode, selects the inclusive integer
  range `[min(anchor,target) .. max(anchor,target)]` over **beats only**
  (excludes step 0). If `anchor` is null or either endpoint is 0, caller falls
  back to single-select.
- Plain `selectStep` and ctrl-toggle both set `selectionAnchor = stepNumber`.

Thread a `{ range: boolean, toggle: boolean }` object (NOT the DOM event) up:
`StepCell.handleClick(e)` reads `e.shiftKey` and `e.ctrlKey || e.metaKey` →
`WorkspaceGrid.onStepClick(n, mods)` → `StepGrid` → `SequenceDisplay` →
`WorkspacePanel.handleBeatSelected(n, mods)`. Routing in `handleBeatSelected`:

- no modifier → `selectStep(n)` (existing), exit multi, set anchor = n.
- `range` (shift) → `rangeSelectTo(n)`; if no valid anchor, `selectStep(n)`.
- `toggle` (ctrl/cmd) → `enterMultiSelectMode()` (idempotent) +
  `toggleStepInMultiSelect(n)`, anchor = n.

Modifier-click on the start position (step 0) always falls back to single.
`spell`'s existing `isShiftStartMode` branch takes priority over range (leave
that path untouched — shift means "move start" there, not "range select").

### 2. Highlight

Pass `selectedStepNumbers` + `isMultiSelectMode` through the existing
`StepGrid → WorkspaceGrid → StepCell` props (currently dead). `StepCell`
applies `.highlighted` for multi-selected cells. Gold `.selected` stays reserved
for single-select. Timeline mode mirrors the highlight on `.timeline-cell` the
same way `.cell-selected` is applied today.

### 3. Batch panel body

When `panelState.editPanelStepsData.length > 1`, the step-editor coordinator
renders `BatchStepEditor` instead of the single-step body. It contains:

- **Header:** "Editing N steps" + Cancel → `exitMultiSelectMode()` + close panel.
- **Pictograph grid:** `PanelGrid` of `PictographContainer` for each selected
  step, each cell captioned with that step's own turns (`B {blue} · R {red}`,
  rendering `fl` where float). The spread is always visible — this is the core
  answer to "what to display when they differ."
- **Two hand cards** (blue, red), each: a `SegmentedControl` [Set all | Adjust]
  and a `PropTurnsControl`-style stepper.

### 4. Mixed-turns model (Set / Adjust)

Aggregate per hand across the selection (treat `"fl"` as `-0.5`):
- all equal → `shared = V`.
- differ → `shared = "Mixed"`, plus `range = [min..max]`.

**Set all mode** — writes an absolute value to every selected step.
- Display: shared `V` (render `fl` if `-0.5`), or `Mixed` when differing.
- Stepper target seeds at the selection's **max** for that hand when mixed
  (predictable "raise everyone to a common ceiling"); at `V` when uniform.
- Pressing ±0.5 moves the target and immediately writes it to **all** selected
  steps (absolute). Display then shows the concrete shared value.

**Adjust mode** — nudges each step, preserving offsets.
- Display: shared `V`, or the `min–max` range when differing.
- Pressing ±0.5 applies that delta to **each** selected step's own value,
  clamped per-step (`fl` floor for pro/anti shifts, `3` ceiling). Offsets are
  preserved (`0.5→1`, `2→2.5`, clamped stops stay).

Default mode: **Set all** (simplest mental model; the grid already shows the
spread so the user knows what they're flattening).

### 5. Batch write path

`applyBatchTurns(stepNumbers, hand, mode, valueOrDelta)`:
1. One `CreateModuleState.pushUndoSnapshot(MODIFY_BEAT_PROPERTIES)`.
2. Iterate `stepNumbers` **ascending**. Per step compute the new turn:
   - `set` → the absolute target (clamped per-step).
   - `adjust` → `clampPerStep(currentTurns + delta)`.
   Run each through the pure per-step turns handler logic
   (`turns-handler.ts` — float conversion, `endOrientation`, reversal,
   orientation propagation to subsequent steps).
3. One `sequenceState.setCurrentSequence(...)` commit + one
   `invalidateLoopDisplayCache()` at the end.

Ascending order ensures the final orientation propagation is correct (later
steps' propagation overwrites earlier). No per-step undo entries, no N re-renders.

### 6. Entry / exit

- Render `SelectionToolbar` (the orphaned component) when `mode === "multi"`:
  "{n} selected", Select All → `selectAllBeats()`, Cancel → `exitMultiSelectMode()`.
- Auto-open batch panel via existing `auto-edit-panel-manager` at `size > 1`.
- Dropping to 1 selected → revert to the single-step editor.
- Plain (no-modifier) click anywhere → back to single-select, clears multi.
- Closing the batch panel exits multi mode.

## Edge cases

- **Start position (step 0):** excluded from multi (existing guard). Modifier
  click on it → single select.
- **`"fl"` handling:** aggregated as `-0.5`; displayed as `fl` for a shared
  float; Set-all target and Adjust results respect the `fl` floor for pro/anti.
- **Selection of exactly 1** after toggling down → single-step editor path.
- **Non-shift step-0 special modes (`isShiftStartMode` in spell):** unchanged;
  shift keeps its existing "move start" meaning there.

## Files touched

**Edit:** `sequence-selection-state.svelte.ts`, `sequence-state-orchestrator.svelte.ts`,
`StepCell.svelte`, `WorkspaceGrid.svelte`, `StepGrid.svelte`, `SequenceDisplay.svelte`,
`WorkspacePanel.svelte`, `StepEditorCoordinator.svelte`, `StepEditorPanel.svelte`,
`panel-coordination-state.svelte.ts` (expose `editPanelStepsData` getter if absent),
`step-operator.ts` / new batch turns handler, `SelectionToolbar.svelte` (wire props),
`auto-edit-panel-manager.svelte.ts` (verify open/close symmetry).

**Create:** `BatchStepEditor.svelte`, `apply-batch-turns.ts` (write path),
`turns-aggregation.ts` (shared-vs-mixed helper).

## Non-goals

- Marquee / drag-select (out of scope; toggle + range cover the ask).
- Batch editing of anything other than turns (rotation, orientation, etc.) —
  the panel is structured to allow it later but this pass ships turns only.
- Multi-select on non-Create surfaces (guide strips, choreo sheet — separate
  single-select primitive, untouched).
