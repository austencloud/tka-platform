---
status: active
value: 3
effort: M
remaining: "Body status: Approved (brainstorming complete, ready for plan)"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Fix Arrows on Choreo Card — Design

**Date:** 2026-05-31
**Status:** Approved (brainstorming complete, ready for plan)

## Goal

Add a "Fix Arrows" affordance to the Choreo Card inspect modal: a 4th bottom-bar
button that swaps the front/back card preview for a live, clickable grid of the
sequence's pictographs. Clicking a pictograph opens the existing pictograph
inspect editor (the per-prop Special/Default arrow override editor). Saving
writes the **canonical** override; the live grid cell reflects it instantly; a
"Done" action re-bakes the card front so the printed image shows the fix.

## Why

Choreo card fronts are **baked PNG images** (`PrintCardRenderer.renderFront` →
canvas → dataURL/blob, two-tier cached). When an arrow lands wrong in a baked
card there is currently no in-place way to correct it — you must leave for the
create module, find the step, edit, and re-export. This feature brings the exact
arrow editor to the card and closes the loop in place.

## Decisions (locked during brainstorming)

1. **Edit scope: canonical.** Edits write the Special/Default override keyed by
   `letter + orientation + turns + propType` — not by card. Fixing letter L's
   arrow fixes L on every card, deck, and the create workspace that shows that
   exact pictograph. This is the inspect editor's existing model; no per-card
   override store is built.
2. **Surface: swap card → grid.** Inside the same `CardInspectModal`, "Fix
   Arrows" replaces `CardPreviewStack` with a live selectable step grid. The
   editor opens stacked on top. "Done" re-bakes and returns to preview.
3. **Re-bake scope: current card only.** Done re-bakes just the inspected card
   (instant feedback). Other cards re-bake lazily on their next render.

## Feasibility (verified in code, 2026-05-31)

- **Editor is portable.** `PictographInspectModal` props are only
  `{ show, stepData, onClose }` — no create-module context. It internally uses
  global `selectedArrowState`, `calculateAllArrowPoints`,
  `arrowAdjustmentCalculator`, `specialPlacer`, `PictographContainer`
  (`arrowsClickable`), and `PipelineEditorDock`.
- **Override repos are app-global singletons** (`getSpecialOverrideRepository`,
  `getDefaultOverrideRepository`), reachable from the choreo-card module.
- **The card-front bake reads the same override pipeline the editor writes.**
  `PrintCardRenderer` / `PrintPreviewPages` are main-thread today and route
  through the override-aware arrow positioning, so a re-bake reflects an edit.
  (The in-flight worker-front-render-parity plan seeds an `OverridePlacementBundle`
  into the worker, so overrides stay honored if/when that path lands —
  `docs/superpowers/plans/2026-05-31-worker-front-render-parity.md`.)
- **Re-bake callback already exists.** `CatalogBrowser` captures
  `inspectedRerender` per opened card (`onCardClick(seq, frontUrl, rerender)`)
  and threads it through `CardInspectModal`'s context-menu path. "Done" reuses it.
- **`StepCell` is the clean reusable cell** — prop-driven (`step: StepData`,
  `onClick`, `isSelected`, `bluePropTypeOverride`, `redPropTypeOverride`), wraps
  `PictographContainer`, no create-state coupling.

## Architecture

```
CardInspectModal  (add "Fix Arrows" button + mode state: "preview" | "fix")
 ├─ mode "preview" → CardPreviewStack            (existing, unchanged)
 └─ mode "fix"     → CardArrowFixGrid            (NEW thin container)
                       └─ StepCell × sequence.steps   (reused; prop-aware; clickable)
                          click → PictographInspectModal (reused EXACTLY)
                                    └─ PipelineEditorDock
```

### Components

| Component | Status | Responsibility |
|---|---|---|
| `CardInspectModal.svelte` | **Modify** | Add "Fix Arrows" button; hold `mode` state; swap `CardPreviewStack` ↔ `CardArrowFixGrid`; own the dirty flag; call `inspectedRerender` on Done. |
| `CardArrowFixGrid.svelte` | **Create** | Render `sequence.steps` (incl. start position) as a grid of `StepCell`, threading the card's effective prop types; emit `onSelect(stepData)`. Skip blank steps. ~40 lines, no new interaction logic. |
| `StepCell.svelte` | **Reuse** | Live, clickable, prop-aware pictograph cell. |
| `PictographInspectModal.svelte` | **Reuse (unchanged)** | The arrow editor, mounted stacked on top with the selected `StepData`. |
| `PipelineEditorDock.svelte` | **Reuse (unchanged)** | Special/Default per-prop editing, WASD, Z. |

`CardArrowFixGrid` wraps `StepCell` directly. `StepGrid.svelte` is not reused:
it is create-state-coupled (reads selection/sequence from create module state);
`StepCell` is the prop-driven primitive underneath it.

### Data flow

1. **Enter fix mode.** "Fix Arrows" → `mode = "fix"`, `dirty = false`. Preview
   stack unmounts; `CardArrowFixGrid` mounts and renders the steps live.
2. **Select.** Click a cell → `selectedStep = step` → open
   `PictographInspectModal show stepData={selectedStep}`.
3. **Edit + save.** Editing writes the override; save persists to Firestore,
   bumps `globalAdjustmentVersion`, clears the pictograph-prep cache. The grid
   cell (a real pictograph) re-renders live. Set `dirty = true`.
4. **Close editor.** Back to the grid; fix another or hit Done.
5. **Done.** If `dirty`, call `inspectedRerender()` → `renderFront` re-bakes the
   card (override-aware) → baked card + catalog thumbnail update → `mode =
   "preview"`. If not `dirty`, return to preview with no re-bake.

### Prop-type consistency (correctness pin)

The override key includes `propType`. The card bakes with the card's effective
prop types. The grid cells **and** the `StepData` passed to the editor must carry
those same prop types so the key you *edit* equals the key the re-bake *reads*.
The card's effective prop types are threaded into `CardArrowFixGrid` (→ `StepCell`
`bluePropTypeOverride`/`redPropTypeOverride`) and reflected in the `StepData`'s
motion `propType` handed to `PictographInspectModal`. Without this pin, an edit to
`staff` against a `fan`-baked card would not show on re-bake.

> Source of the card's effective prop types is resolved during planning: either
> the global settings prop types (`getSettings().bluePropType/redPropType`) used
> by the export path, or a per-deck/per-card prop config if one applies to the
> inspected card. The plan's first task pins this to whatever `renderFront` reads,
> so edit-key == bake-key by construction.

## Error handling / edge cases

- **Start position (step 0):** included as a selectable cell.
- **Blank/empty steps:** skipped (no cell).
- **Close modal mid-fix:** safe — overrides are already persisted globally; there
  is no per-card state to lose. If `dirty`, the card re-bakes on close the same
  as Done (so a closed-without-Done card is not left stale).
- **Done with no edits:** no re-bake (dirty flag gate) — avoids a wasteful canvas
  composite.
- **Re-bake failure:** surface a toast; leave the prior baked image in place
  (do not blank the card).

## Testing

**Unit:**
- `CardArrowFixGrid` maps `sequence.steps` → `StepCell`s (including start
  position, excluding blanks) and emits `onSelect(stepData)` on cell click.
- Dirty-flag gate: Done with `dirty = false` does not call the re-bake callback;
  Done with `dirty = true` calls it exactly once.

**Manual gate (user, in browser):**
1. Open a card with a visibly-off arrow → Fix Arrows → grid appears.
2. Click that pictograph → inspect editor opens with the correct step.
3. Nudge the arrow → grid cell moves live on save.
4. Done → baked card front reflects the fix.
5. Open a *different* card containing the same letter/orientation/turns/prop →
   it also shows the fix (proves canonical scope).

## Out of scope

- Per-card (non-canonical) arrow overrides.
- Right-click-on-baked-image selection (the baked front is not per-pictograph
  addressable; the live grid is the selection surface instead).
- Whole-deck re-bake on Done (lazy per-card re-render covers it).
- Changes to `PrintCardRenderer` / the worker-parity effort.
