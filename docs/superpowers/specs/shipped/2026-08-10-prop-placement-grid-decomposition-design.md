# Prop Placement Grid Decomposition

**Date:** 2026-08-10
**Status:** Approved and shipped

## Problem

`PropPlacementGrid.svelte` is shared by Construct, Learn, Step Editor, and Fan
Relations. Before this change it was 1,782 scanner lines with 18 derived values
and 70 functions. One component owned placement history, orientation previews,
beta-prop hit testing, DOM coordinate conversion, touch gesture arbitration,
pictograph construction, guide geometry, accessibility announcements, SVG
presentation, and responsive styling.

That coupling makes a state-transition fix load more than 800 lines of markup
and CSS. A presentation change also exposes the placement and gesture state
machines to accidental edits.

## Four-perspective decision

- **Architect:** Placement state, pure view calculations, and the SVG
  interaction surface have distinct inputs and lifecycles.
- **Change safety:** History and reset behavior can be tested without DOM
  geometry. Beta hit testing can change without touching the tray or prompt.
- **Agent context:** State, gesture, and styling tasks gain named owners with a
  much smaller required context.
- **Skeptic:** The split preserves meaningful behavior boundaries. It does not
  extract the prompt or tray into thin wrappers just to reduce line count.

All four perspectives support decomposition.

## Capability ownership

Searches used `prop placement`, `placement grid`, `orientationFromDrag`,
`undoPlacement`, `HitTargetOverlay`, and `onOrientationChange`.

- `orientation-from-drag.ts` remains the canonical owner of drag-to-orientation
  math and aim directions.
- `placement-grid-points.ts` remains the canonical owner of interactive grid
  coordinates.
- `PictographContainer.svelte` remains the prop and grid renderer.
- `HitTargetOverlay.svelte` keeps its generic single-point interaction. Prop
  placement intentionally remains separate because a beta point can contain
  two overlapping rendered props and must select by live artwork geometry.

This change composes those owners. It does not add another orientation or grid
calculation.

## New boundaries

- `state/prop-placement-state.svelte.ts` owns locations, active color, history,
  reset synchronization, announcements, and outward change publication.
- `services/prop-placement-view-model.ts` owns pure beta offsets, prompt data,
  pictograph construction, and guide geometry.
- `state/prop-placement-aim-state.svelte.ts` owns DOM-aware prop selection,
  hover feedback, the single-pointer gesture lifecycle, and pending orientation
  previews.
- `components/PropPlacementInteractionOverlay.svelte` presents hit targets,
  aim feedback, and guide graphics. It delegates every state transition.

`PropPlacementGrid.svelte` remains the public component and composition root.
Its exported `moveProp`, `undoPlacement`, and `resetPlacement` methods remain
unchanged.

## Verification

- The composition root fell from 1,782 scanner lines to 635 scanner lines, a
  64.4% reduction. The physical file is 634 lines after formatting.
- Twenty-four focused unit and contract tests pass. They cover placement
  history, reset behavior, beta offsets, prompt selection, pictograph
  construction, guide geometry, and ownership boundaries.
- Nine browser component tests pass. They cover real touch cancellation, beta
  overlap, keyboard placement, undo, re-aiming, and the Construct consumer
  contract.
- Focused ESLint passes, the production Cloudflare build completes, and a
  declaration-level CSS comparison confirms all 76 selector contexts remain
  behavior-equivalent.
- The repository checker still reports its pre-existing baseline of 236 errors
  and 13 warnings. None of its production diagnostics reference this change.
- Responsive screenshots cover the required phone, Fold, tablet, laptop, and
  three 4K viewport tiers. No visual change is intended.
