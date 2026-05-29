# Inspect Modal — Docked Editor + Dense Read-Out Redesign

**Goal:** Replace the inline, per-column arrow-adjustment editor with a single reserved footer dock in the inspect modal, and collapse the labeled read-only data into dense label-less shorthand. Result: the modal never resizes or scrolls (on wide/4K) when you open the editor, and the read-out is scannable at a glance.

**Architecture:** A new `PipelineEditorDock` owns all editing state/logic and lives in a constant-height footer of `.modal-content`. `PipelineTraceSection` becomes a read-only tier display. `BasicInfoColumn` stops being a column and becomes a slim full-width info bar. Editing activates by clicking an arrow in the live pictograph (selection-driven); per-column Edit buttons are removed.

**Tech Stack:** Svelte 5 runes, theme/`--semantic`/`--prop` tokens, reused `SegmentedControl` + `LayerTabBar` + `CopyForAIButton`.

**Reference mockup:** `src/routes/test/inspect-dock-mockup/+page.svelte` (static, presentational — DELETED at end of execution).

---

## Constraints (hard requirements)

- **Zero resize:** modal height is constant whether the editor is idle or active. The footer dock is always present at a fixed min-height.
- **No scroll on wide/4K:** body + dock fit within the height cap when columns are expanded on a wide viewport. Narrow viewports may scroll the body; the dock stays pinned as a footer.
- **AAA touch targets:** every interactive control uses `min-height: var(--min-touch-target)` (44px). Icon-only buttons are 44×44.
- **AAA font floor:** essential text `var(--font-size-min, 14px)`; supplementary text `var(--font-size-compact, 12px)`; never below 12px.
- **Theme tokens only:** no hardcoded hex. `--theme-*` adaptive, `--semantic-*`/`--prop-*` constant.
- **No checkboxes:** tier picker is the reused `SegmentedControl` (button + indicator), not inputs.

---

## Current architecture (what exists today)

- `PictographInspectModal.svelte` — owns `show`, `stepData`, computes `blueDiagnostics`/`redDiagnostics` via `calculateDiagnostics`, renders header + body (pictograph rail + detail-column of `BasicInfoColumn` + 2× `MotionColumn`). Holds `blueMotionColumnRef`/`redMotionColumnRef`, relays WASD via `handleKeydown`, expands sections on wide viewport, owns `requestClose()` (clears selection imperatively).
- `MotionColumn.svelte` — `CollapsibleSection` wrapping read-only motion rows + `PipelineTraceSection`; exposes `enterEditMode()` / `handleWASDKeydown()` passthroughs to `pipelineTraceRef`.
- `PipelineTraceSection.svelte` — tier rows + base→rotated summary **and** the full inline editor: `isEditing`, `editTarget`, `editX/Y`, `activeLayer`, save/delete/WASD for all three editable tiers (global / special-json / prop-geometry), `enterEditMode()`, `handleKeydown()`.
- `BasicInfoColumn.svelte` — `CollapsibleSection` card with labeled rows + a Lookup Keys subsection.
- `selectedArrowState.svelte.ts` — global single selection (`selectArrow`/`clearSelection`/`subscribe`).
- Live-update pipeline: edits call `globalAdjustmentVersion.increment()` + `pictographPreparer.clearCache()` + `onDiagnosticsChanged()` → modal recomputes diagnostics → pictograph + tiers refresh.

---

## Target architecture

### 1. NEW — `PipelineEditorDock.svelte`

Path: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte`

The single editing surface. Owns everything the old `PipelineTraceSection` editor owned.

**Props:**
```ts
interface Props {
  stepData: StepData;
  blueDiagnostics: PipelineDiagnostics | null;
  redDiagnostics: PipelineDiagnostics | null;
  onDiagnosticsChanged?: () => void;
}
```

**Selection binding (live re-bind):** reads `selectedArrowState.selectedArrow`. Derives `activeColor = selectedArrow?.color ?? null`. When `activeColor` changes (including switching blue→red mid-edit), the dock re-points: `diagnostics = activeColor === 'red' ? redDiagnostics : blueDiagnostics`, `editTarget = defaultEditTargetForActiveTier()`, then `syncNumericInputs()`. No selection → idle state.

**State (moved from PipelineTraceSection verbatim where possible):** `editTarget`, `editX`, `editY`, `activeLayer`, `saveState`, `hasLocalChanges`. All `handle*` functions (global / special-json / prop-geometry numeric-update, save, delete), `buildSpecialJsonInput`, `buildPropGeometryInput`, key derivations, `syncNumericInputs`, `defaultEditTargetForActiveTier`, `currentLayerValue`, `layer{1,2,3}HasValue`, `propGeometryHasValue` — relocated unchanged (parameterized by `activeColor` + the resolved `diagnostics`/`stepData` instead of the old `color` prop).

**WASD ownership:** `<svelte:window onkeydown={handleKeydown} />` inside the dock. `handleKeydown` no-ops unless an arrow is selected; consumes only w/a/s/d (Shift ×4 via increment 20, Ctrl+Shift ×40 via increment 200 — preserve existing increments: base 5, shift 20, ctrl+shift 200), calls `handleWASDMovement`. Escape is NOT handled here (modal owns it).

**Layout — two states, identical height:**
- **Idle (no selection):** centered hint, `var(--font-size-min)`, dim: `"Select an arrow to adjust its position →"`.
- **Active:** single horizontal control bar (wraps gracefully):
  1. Identity: color dot (`--prop-blue`/`--prop-red`) + `"{Blue|Red} · {tier label}"`.
  2. Tier picker — reused `SegmentedControl` with options `[{value:'global',label:'Global'},{value:'special-json',label:'Special JSON'},{value:'prop-geometry',label:'Prop Geometry'}]`, `value={editTarget}`, `onchange={selectEditTarget}`, `color={activeColor}`. When `editTarget === 'global'`, render `LayerTabBar` (existing) beneath for L1/L2/L3.
  3. X / Y `<input type="number">`, 44px min-height, `onchange={handleNumericChange}`.
  4. Supplementary WASD hint (`var(--font-size-compact)`) + inline `Unsaved` flag when `hasLocalChanges`.
  5. Actions (right): Delete/Revert (44×44 icon, conditional per tier — same conditions as today) + Save (44px). Save disabled per existing rule.

**Footer container:** `min-height` constant (≈ tallest active state, e.g. 72–88px), `flex: none`, top border, tinted `color-mix(in srgb, var(--prop-{color}) 8%, var(--theme-panel-bg))` when active / plain panel-bg when idle.

### 2. `PipelineTraceSection.svelte` — slim to read-only

Remove: `isEditing`, `editTarget`, `editX/Y`, `activeLayer`, `saveState`, `hasLocalChanges`, the entire `{#if isEditing} editor {/if}` block, `toggleEditing`, `enterEditMode`, `handleKeydown`, `handleWASDMovement`, all `handle*Save`/`handle*Delete`/`handle*NumericUpdate`, `syncNumericInputs`, `selectEditTarget`, `handleLayerChange`, `buildSpecialJsonInput`, `buildPropGeometryInput`, the `LayerTabBar` import, and the orchestrator/repo wiring used only by editing.

Keep: tier rows (`global`, `special-json`, `prop-geometry`, `default`) with active-tier star, value, detail, special-json `(override)` badge + original-row, and the base→rotated summary. Tier rows become non-interactive (no `disabled`/click/edit-target classes). Remove the `Pipeline / Edit` header button — header is just the `Pipeline` label.

### 3. `BasicInfoColumn.svelte` → info bar

Stops being a `CollapsibleSection` column. Rendered as a slim full-width bar between the modal header and body (the modal owns placement; this component renders the bar content). Two parts:
- **Shorthand line** (label-less, essential ≥14px): `letter · gridMode · propType · {startPosition} → {endPosition}`. Letter highlighted (`--semantic-info`), larger; dot separators in a dim stroke color.
- **Lookup chips** (supplementary ≥12px, cohesive neutral styling — `--theme-card-bg`/`--theme-stroke`/`--theme-text-dim`, value in `--theme-text`; NO purple): `ori_key {oriKey}`, `turns {turnsTuple}`, and `blue_rot {key}` / `red_rot {key}` **only when present**. Keep a Copy-for-AI affordance for the full basic block.

Loses its collapsible behavior. (If retaining the filename/component is awkward, the modal may inline the bar and delete `BasicInfoColumn`; implementer's choice during planning — either way the labeled-column form is gone.)

### 4. `MotionColumn.svelte` — compact shorthand + drop relays

- Remove `pipelineTraceRef`, `enterEditMode()`, `handleWASDKeydown()` exports (dock owns WASD now).
- Replace the labeled motion rows with two dense lines:
  - **Motion line** (essential ≥14, ~17px): `motionType · rotationDirection · {startLocation}→{endLocation} · {startOrientation}→{endOrientation} · {turns|float}t`. Color map: type=`--semantic-warning`, rotation=accent/purple glyph, path=`--theme-text`, ori=`--semantic-info`, turns dim.
  - **Placement line** (supplementary ≥12): `{posX}, {posY} · {angle}° · {mirrored?}`. Include `manual (x,y)` and `rotOverride` only when present (anomaly emphasis as today).
- Keep `CollapsibleSection` + per-card Copy-for-AI header action. Keep `open`/`onToggle` controlled props.
- Selected card gets a colored ring (`box-shadow`/`border-color` `--prop-{color}`) when its arrow is the active selection, tying it to the dock identity.

### 5. `PictographInspectModal.svelte`

- Render the info bar (BasicInfoColumn-as-bar or inline) between `<InspectModalHeader>` and `.modal-body`.
- `.detail-column` now holds Blue + Red only.
- Render `<PipelineEditorDock {stepData} {blueDiagnostics} {redDiagnostics} onDiagnosticsChanged={refreshDiagnostics} />` as a `flex: none` footer of `.modal-content`, after `.modal-body`.
- Remove `blueMotionColumnRef`/`redMotionColumnRef`, the WASD branch of `handleKeydown` (keep Escape: selected → clear, else `requestClose`). Modal no longer relays WASD.
- `requestClose()` keeps clearing selection imperatively (preserves the prior `effect_update_depth_exceeded` fix).
- Expand-on-wide (`min-width: 1600px`) now sets `blueOpen`/`redOpen` only (no `basicOpen` — basic is the always-visible bar).
- `.modal-body { flex: 0 1 auto }` retained (hug content). With the reserved dock as `flex: none`, modal height = header + bar + body + dock, all bounded by the cap.

### 6. Reuse (no new primitives)

- **Tier picker:** `src/lib/shared/3d/components/controls/SegmentedControl.svelte` (generic, AAA, themed).
- **Global sub-layers:** existing `LayerTabBar`.
- **Copy:** existing `CopyForAIButton` / current copy buttons.

---

## Data flow

1. Click arrow in live `PictographContainer` (`arrowsClickable`) → `selectedArrowState.selectArrow(motion, color, pictographData)` (already wired via `ArrowSvg`).
2. Dock's selection read updates → resolves `activeColor` → picks `diagnostics` → `editTarget = active tier` → `syncNumericInputs()` → active layout renders; the matching motion card rings.
3. Edit (WASD or numeric) → `handle{Global|SpecialJson|PropGeometry}NumericUpdate` → repo `saveAdjustmentLocal`/`saveOverrideLocal` + `clearCache()` + `globalAdjustmentVersion.increment()` → live pictograph re-renders. `hasLocalChanges = true`.
4. Save → repo persist → `saveState` cycles → `onDiagnosticsChanged()` (modal `refreshDiagnostics`) → tier rows + summary refresh.
5. Switch to other arrow → live re-bind (re-resolve color/diagnostics/tier/X/Y).
6. Escape / backdrop / header-✕ → `requestClose()` clears selection → dock returns to idle.

---

## Edge cases

- **No selection:** dock idle hint, constant height. Motion cards un-ringed.
- **Live re-bind mid-edit:** unsaved local changes on arrow A are already written to the in-memory repo (live preview); switching to B re-syncs inputs to B's tier. (Local edits persist in repo until saved/deleted — matches today's behavior.)
- **Tier availability:** all three editable tiers always selectable (matches current model); default tab follows `diagnostics.activeTier`.
- **Narrow (<720px):** layout stacks (pictograph static, columns single-column); dock remains a pinned footer; body may scroll. Acceptable — zero-resize guarantee is for wide/4K.
- **Rotation-override-only tiers (static/dash):** rot-override keys shown in info bar only when present; unchanged save logic.

---

## AAA checklist (verify at end)

| Element | Requirement |
|---|---|
| Tier segments, X/Y inputs, Save, Delete, header buttons, layer tabs | `min-height: var(--min-touch-target)` (44px); icon-only 44×44 |
| Motion/basic shorthand, tier rows, segment labels, input labels, dock title | `var(--font-size-min, 14px)` |
| Lookup chips, WASD hint, placement line, summary | `var(--font-size-compact, 12px)`, never < 12 |
| All colors | theme/`--semantic`/`--prop` tokens, no raw hex |
| Tier picker | `SegmentedControl` (no checkbox/input) |

---

## Cleanup & testing

- **Delete** `src/routes/test/inspect-dock-mockup/+page.svelte` after execution.
- **Verification:** `npm run check` EXIT 0; runtime check on `localhost:5173` (Step Editor → admin inspect) — open modal (no resize on wide), click blue arrow → dock binds + card rings + WASD moves arrow live, switch to red → re-binds, Save persists + tiers refresh, Escape → idle, no `effect_update_depth_exceeded`.
- **No new business logic** — save/WASD/key logic is relocated, behavior parity. Optional: extract `defaultEditTargetForActiveTier` + `syncNumericInputs` value-resolution as pure helpers if it eases reasoning; not required.

## Out of scope

- Firestore schema, key-generation algorithms, the positioning pipeline itself (untouched).
- Mobile-specific redesign beyond the stack-and-scroll fallback.
