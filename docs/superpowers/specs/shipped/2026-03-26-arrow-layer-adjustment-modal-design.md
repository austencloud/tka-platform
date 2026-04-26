# Arrow Layer Adjustment Modal

## Problem

Global arrow adjustments are only accessible through the WASD panel in the StepEditor header, which requires: open step editor → click arrow → use WASD keys. Layer selection is implicit based on current prop settings. There's no way to explicitly choose which layer to edit or see all layers at once.

## Solution

Add "Adjust Blue Arrow" / "Adjust Red Arrow" items to the existing pictograph context menu in StepCell. Selecting one opens a modal with explicit layer tabs and WASD controls. Save is deliberate (button), not auto-debounced.

## Design

### Context Menu Integration

Extend `PictographContextMenuBuilder` to add arrow adjustment items. These items appear only for admin users and only on beats (not start position). The existing `handleContextMenu` in StepCell already opens the context menu — we just add items.

Items:
- "Adjust Blue Arrow" (blue icon)
- "Adjust Red Arrow" (red icon)

### Modal

Uses `BaseModal` (size `md`). Contains:

**Header:** "Adjust {Blue|Red} Arrow — Letter {X}" with close button.

**Layer Tabs:** Three buttons in a row — "Base", "Prop ({propType})", "Combo ({blue}+{red})". Each shows a dot indicator if a value exists at that layer. Active layer is highlighted. Clicking a tab switches which layer you're editing.

**Adjustment Display:** Shows current (x, y) for the selected layer. If no value at this layer, shows "No adjustment (inheriting from {fallback layer})".

**WASD Controls:** Same keyboard handling as existing panel. W/A/S/D moves 5px, Shift+WASD moves 20px. Movement applies to the selected layer only. Preview is immediate via `saveAdjustmentLocal`.

**Footer buttons:**
- "Save" — commits current layer to Firestore, closes modal
- "Delete" — removes adjustment at current layer, closes modal
- "Cancel" — reverts any local changes, closes modal

### Data Flow

1. Context menu item clicked → opens modal with color + stepData + pictographData
2. Modal creates a `SelectedArrowContext` from the step's motion data
3. Uses `ArrowAdjustmentOrchestrator` for movement math (same as existing)
4. Uses `GlobalArrowAdjustmentRepository` for read/write (same as existing)
5. On Save: `repo.saveAdjustment(input)` then `pictographPreparer.clearCache()` + version increment
6. On Delete: `repo.deleteAdjustment(key)` then clear cache + version increment
7. On Cancel: `repo.deleteAdjustmentLocal(key)` to revert preview, then close

### Layer Determination

- Layer 1 (Base): `{ gridMode, oriKey, letter, turnsTuple, arrowKey }` — no prop types
- Layer 2 (Prop): Base + `{ propType: thisPropType }` — single prop
- Layer 3 (Combo): Base + `{ propType: thisPropType, otherPropType }` — both props

The modal derives these keys from the pictograph data using `GlobalAdjustmentKeyGenerator`.

### Existing Code Reuse

| Need | Existing Component |
|------|--------------------|
| Context menu | `ContextMenu.svelte` + `PictographContextMenuBuilder.ts` |
| Modal | `BaseModal.svelte` |
| Movement math | `ArrowAdjustmentOrchestrator.applyWASDMovement()` |
| Layer lookup | `GlobalArrowAdjustmentRepository.getAdjustmentCascading()` |
| Persistence | `GlobalArrowAdjustmentRepository.saveAdjustment()` / `deleteAdjustment()` |
| Cache invalidation | `pictographPreparer.clearCache()` + `globalAdjustmentVersion.increment()` |
| Key generation | `GlobalAdjustmentKeyGenerator` |

### New Files

1. `src/lib/features/create/shared/components/arrow-adjustment/ArrowLayerModal.svelte` — the modal component
2. `src/lib/features/create/shared/components/arrow-adjustment/LayerTabBar.svelte` — layer selector tabs

### Modified Files

1. `PictographContextMenuBuilder.ts` — add arrow adjustment items
2. `PictographContextMenuHost.svelte` — pass callback for opening modal
3. `StepCell.svelte` — mount ArrowLayerModal, wire context menu callback
