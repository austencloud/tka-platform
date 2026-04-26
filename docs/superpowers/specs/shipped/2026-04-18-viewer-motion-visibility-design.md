# Viewer-Scoped Motion Visibility — Design

**Date:** 2026-04-18
**Status:** Design approved, plan pending

## Problem

Motion visibility (blue on/off, red on/off) is currently a global concern spread across two singleton state managers (`VisibilityStateManager` for pictographs, `AnimationVisibilityStateManager` for animation) with an explicit `syncFromPictographVisibility()` bridge between them. The toggle UI lives in two buried places — inside `ExportImagePanel` and inside the settings `VisibilityTab`. There is no top-level viewer control, and the 3D viewer has no motion visibility concept at all.

The user experience this creates is disjointed: toggling a motion off in the export panel changes the ChoreoCard preview but not the animation, and the 3D viewer is unaffected. The refactor lifts motion visibility out of app-global state and makes it a first-class viewer-scoped concern with a single visible control that drives all three surfaces (ChoreoCard, animation player, 3D viewer).

## Principles

1. **Motion visibility is a viewing concern, not a persistent preference.** It lives with the viewer, not the app.
2. **One control, one source of truth.** Whatever the user toggles applies to the ChoreoCard, the animation, the 3D viewer, and any image export — simultaneously.
3. **Ephemeral by design.** State resets when the viewer unmounts or the sequence changes. No localStorage persistence.
4. **Surgical cleanup.** Once the new system is in place, the dormant motion fields in both existing singletons are removed, along with their chip UIs and downstream readers.

## Architecture

### New state object: `SequenceViewerVisibilityState`

- Location: `src/lib/shared/sequence-viewer/state/viewer-visibility-state.svelte.ts`
- Svelte 5 class using `$state` runes for `blueMotion` and `redMotion` booleans.
- Default: `{ blueMotion: true, redMotion: true }`.
- Exposes `setBlueMotion(visible)`, `setRedMotion(visible)`, and `reset()` methods.
- Enforces the at-least-one-visible constraint directly in the setters — if the caller tries to turn off the last visible motion, the other flips on automatically. Same behavior as the existing pictograph VM rule.
- No singleton. Instances are created per SequenceViewer mount and disposed with it.

### Context provisioning

- `SequenceViewerOrchestrator.svelte` (or the root `SequenceViewer.svelte`, whichever is the single mount point) constructs a `SequenceViewerVisibilityState` and sets it in Svelte context under a known symbol.
- All descendants — ChoreoCard, AnimationPlayer, 3D viewer chrome, MotionVisibilityToggle — pull it from `getContext<SequenceViewerVisibilityState>(SEQUENCE_VIEWER_VISIBILITY_KEY)`.
- A thin helper `getSequenceViewerVisibility()` wraps the context call for ergonomics.

### Reset on sequence change

- The viewer root wires `$effect(() => sequence?.id && visibility.reset())`.
- This ensures navigating from one sequence to another inside the same viewer resets to both-visible, as does fullscreen transitions that remount the viewer.

## UI

### Header button

- New component: `src/lib/shared/sequence-viewer/components/MotionVisibilityToggle.svelte`
- Lives in the sequence viewer header, top right, next to the Copy-for-Chat button.
- Mirrored placement in the 3D fullscreen chrome — same component, same position, identical behavior.
- Icon: two prop silhouettes (left-blue, right-red). When `blueMotion === false`, the blue silhouette renders in a muted grey. When `redMotion === false`, the red silhouette renders grey. Both visible = full-color icon. One glance tells the user the current state without opening the popover.
- Icon asset: reuse the existing staff prop SVG at two reduced sizes, CSS tinted via `currentColor` or direct `fill`. Exact asset choice confirmed during implementation plan.

### Popover

- Click the button → opens a small popover anchored below the header button.
- Contents:
  - Two chips, styled consistently with the existing chips in `ExportImagePanel` (same visual language).
  - Blue chip: tap to toggle blue motion.
  - Red chip: tap to toggle red motion.
- The at-least-one-visible constraint is enforced in the state layer, so tapping the last visible chip flips the other on automatically — no UI feedback needed beyond the state update.

## Integration changes

### ChoreoCard

- Remove the current `vm.getMotionVisibility()` reads from `VisibilityStateManager`.
- Replace with context reads from `SequenceViewerVisibilityState`.
- `buildRenderOptions` continues to populate `showBlueMotion`/`showRedMotion` on `PreviewCellRenderOptions`, sourced from the new state.
- No changes to the cache-key pipeline — it already includes motion visibility in the hash.

### Animation player

- `AnimationPlayer.svelte` (and the render loop below it) reads motion visibility from context.
- The per-frame render loop skips drawing props, trails, and tip effects for a hidden motion's color.
- The existing `AnimationVisibilitySynchronizer` / `AnimationVisibilityStateManager` motion sync path is deleted (see Cleanup).

### 3D viewer

- `SequenceConverter.ts` reads motion visibility from context (or receives it as a parameter passed in from whichever component drives the 3D scene from the viewer).
- For a hidden-side motion, the 3D motion config for that color is omitted — the 3D scene receives no motion data for that hand.
- The avatar animator enters a new **rest-pose override** mode for the hidden side: the arm on that side holds a neutral resting pose (hand at hip, relaxed) for the entire sequence duration. No prop is spawned on that side. No trails, fire, LED, charcoal, or other tip effects render on that side — they have nothing to attach to.

> **Implementation unknown (flag for planning):** The avatar animator may or may not already support a per-side rest-pose override. If it doesn't, building that mode is additional scope for the implementation plan. Investigate before finalizing the plan.

### Export bake parity

- Image exports go through the ChoreoCard render pipeline. Since ChoreoCard now reads from viewer state, exports automatically match whatever the user has toggled — no separate export-side motion filter needed.

## Cleanup (P2 — full surgical removal)

Once the new system is wired and consumers updated, remove motion visibility from the app-global singletons entirely. This is the same PR, not a follow-up.

### Pictograph VM (`VisibilityStateManager`)

- Delete `blueMotion` and `redMotion` from `VisibilitySettings` type, defaults, and any migration paths.
- Delete `getMotionVisibility`, `setMotionVisibility`, `areAllMotionsVisible`, `isAnyMotionVisible`, and the motion-specific save/restore helpers.
- The `"motion"` observer scope remains a concept only if still used by other fields — audit during implementation; delete if orphaned.

### Animation VM (`AnimationVisibilityStateManager`)

- Delete `blueMotion` and `redMotion` from `AnimationVisibilitySettings`, defaults, and `loadFromStorage` migration.
- Delete `syncFromPictographVisibility()` entirely.
- Its two non-motion fields (`tkaGlyph`, `reversalIndicators`) are not affected.

### UI removals

- **`ExportImagePanel.svelte`**: remove the motion chips around line 230 and line 416–422 (and any surrounding labels/containers they exclusively occupy). The export panel reads the new viewer state for anything it still needs to know about motion visibility.
- **`VisibilityTab.svelte`**: remove the motion chips (`blueMotion`/`redMotion` `$derived` values around line 67–68, the `tap` handlers around line 110–111, the `blueMotionVisible`/`redMotionVisible`/`allMotionsVisible` props passed to the child around line 186–194, and the chip markup itself). The tab loses its motion section entirely.
- **`MotionColor` import in VisibilityTab**: remove if no other code in the file uses it.

### Downstream readers

Update every pictograph VM motion-visibility reader. In each, drop the conditional and treat the motion as always visible:

- `src/lib/shared/pictograph/shared/components/PictographContainer.svelte`
- `src/lib/shared/pictograph/option/OptionPictograph.svelte`
- `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuBuilder.ts`
- `src/lib/features/create/shared/components/coordinators/SequenceDrawerHost.svelte`
- `src/lib/shared/animation-engine/components/AnimationShareDrawer.svelte`
- `src/lib/shared/animation-engine/services/implementations/AnimationVisibilitySynchronizer.ts` — remove the `blueMotion`/`redMotion` keys from its `getState()` return type and callers that destructure them.
- `src/lib/shared/animation-engine/services/contracts/IAnimationVisibilitySynchronizer.ts` — update the `AnimationVisibilityState` type to drop the motion keys.

The mechanical effect everywhere: wherever code checked `vm.getMotionVisibility(MotionColor.BLUE)` and gated rendering on the result, the check is deleted and the code unconditionally renders. Motions are always visible outside the viewer.

### Storage migration

Old localStorage entries will still contain `blueMotion`/`redMotion` keys for both managers. The existing migration/load paths in both VMs already tolerate unknown keys (they spread over defaults). No active migration code needs writing — the obsolete keys simply get dropped on next save. This is acceptable; no user data is lost, no code path breaks.

## Out of scope

- Video export bake. The pipeline either already follows the animation player output (in which case it's automatically correct) or is a known gap. Either way, not part of this design.
- Sharing/embedding — shared URLs don't encode viewer-ephemeral state, consistent with this being a viewing concern.
- A future "motion visibility per beat" feature. This spec is binary per-color for the whole sequence.
- Any changes to the `isVisible` field on individual `MotionData` entries in the sequence JSON — that's a separate, beat-local concept unrelated to this viewer toggle.

## Known unknowns to resolve during implementation planning

1. **Avatar rest-pose override mechanism.** Does the current 3D avatar animator expose a "lock this arm to rest pose" mode, or does that need to be built? Investigate before finalizing the plan. If building, it's probably a small state machine on the avatar animator that overrides the motion-driven IK target for the affected side.
2. **Icon asset finalization.** Two staff silhouettes with CSS tinting is the default plan — confirm in implementation that this renders cleanly at the header button size (likely 20–24px).
3. **Popover positioning in the 3D fullscreen chrome.** Header layout in fullscreen may differ from the windowed viewer. Verify the top-right slot has enough room and adjust if needed.
4. **The `"motion"` observer scope in the pictograph VM.** May or may not be used by other fields. Audit during cleanup; if it's only used by the deleted motion fields, remove the scope concept entirely.

## Success criteria

- The MotionVisibilityToggle button is visible in the viewer header and 3D fullscreen chrome, top right, next to Copy-for-Chat.
- Toggling blue (or red) off updates ChoreoCard preview, animation, and 3D viewer simultaneously within one frame.
- The 3D avatar holds the hidden-side arm in a neutral rest pose for the whole sequence while the visible side performs normally.
- Image export respects the toggle state.
- Switching to a different sequence resets both toggles to visible.
- VisibilityTab and ExportImagePanel no longer contain motion chips.
- Pictograph VM and Animation VM no longer have `blueMotion`/`redMotion` fields or related methods.
- `npm run check` passes with no type errors.
