# Multi-Performer Selection and Editing

**Status:** Implemented and verified
**Date:** 2026-09-04  
**Owners:** `viewer-3d-state.svelte.ts`, `shared/3d/components/performer-interaction/`, and the Stage selection bridge

## Outcome

The Stage and 3D viewer support an arbitrary performer selection with one primary performer. Every selected performer can be moved or edited as one formation while preserving the existing direct-manipulation, viewer-state, and edit-history owners.

This extends the current performer-selection capability. It does not create a second selection store, revive an earlier viewer shell, or route performer movement through the generic object-transform controls.

## Research Basis

- The WAI-ARIA listbox pattern recommends a no-modifier multi-select model and explicit Select All / Unselect All actions for discoverability and accessibility: <https://www.w3.org/WAI/ARIA/apg/patterns/listbox/>
- WAI-ARIA keyboard guidance distinguishes focus from selection. Performer controls therefore retain a visible focus ring that is not the selection treatment: <https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/>
- Pointer Events defines pointer capture and `touch-action` as the platform mechanisms for reliable direct manipulation. Existing pointer ownership and capture remain in place: <https://www.w3.org/TR/pointerevents/>
- Three.js raycasting returns closest-first intersections. The current visual-surface/proxy picking strategy remains canonical: <https://threejs.org/docs/pages/Raycaster.html>
- Threlte documents both its interactivity plugin and the raycast cost of complex geometry. This viewer intentionally keeps its existing centralized pointer owner because it coordinates multiple canvases, visual-surface anchors, proxy fallbacks, camera control, and spatial undo: <https://threlte.xyz/docs/learn/basics/handling-events> and <https://threlte.xyz/docs/reference/extras/interactivity>

## Canonical Ownership

Meaning-based discovery found these existing owners:

| Capability                                  | Existing owner                                                                               | Change                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Viewer performer selection and scoped edits | `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`                                          | Extend from All-or-one to All, None, or an ordered arbitrary set with a primary performer |
| Stage selection                             | `src/lib/features/stage/state/stage-edit-mode.svelte.ts`                                     | Add an atomic multi-performer setter and bridge it to viewer indices                      |
| Direct performer picking and dragging       | `src/lib/shared/3d/components/performer-interaction/performer-pointer-interaction.svelte.ts` | Extend the current visual-anchor/proxy architecture to selection and group transforms     |
| Performer controls                          | `PerformerSpine.svelte` and existing performer settings panels                               | Add selected-set, mixed-value, and bulk-edit behavior in place                            |
| Undo/redo                                   | `SceneUndoManager` and viewer spatial-edit snapshots                                         | Add selection-wide snapshot transactions; do not add another history stack                |
| Structural motion                           | shared motion helpers and `SelectionToolbar`                                                 | Reuse canonical entry/exit motion and reduced-motion behavior                             |

The performer strip remains a set of native action buttons, not a listbox or a FilterChip clone. Each item has identity color, selection state, direct edit behavior, and an adjacent create action, so it is intentionally separate from filtering primitives. It exposes `aria-pressed`, explicit All and None actions, and ordinary keyboard focus.

## Selection Model

The viewer exposes:

- `selectedPerformerIndices`: normalized, unique, in-range indices in stable selection order;
- `primaryPerformerIndex`: the most recently established primary member, or `null` for None;
- `isAllPerformersSelected`: All mode, including an explicit set that contains every current performer;
- `performerSelectionMode`: a touch-friendly persistent selection mode;
- `replacePerformerSelection`, `togglePerformerSelection`, `clearPerformerSelection`, and `selectAllPerformers`.

The local representation uses `null` for All and an array for explicit selection. An empty array means None. Selecting every current performer normalizes to All when serialized, so future spawns join that scope. The primary index must always be a member of a non-empty explicit selection. Controlled Stage selection supplies the same public contract through stable performer IDs.

The legacy `selectedPerformerIndex` API remains a compatibility view: it returns the primary performer for explicit non-empty selection and `null` for All or None. New code must use the full selection API whenever All and None differ.

Selection is persisted with viewer configuration and included in spatial snapshots. Undoing a selection-wide transform restores both formation state and the selection context associated with that transform.

## Input Contract

### Desktop

- Click a performer to replace the selection and make it primary.
- Ctrl-click or Command-click toggles a performer without discarding the rest.
- Shift-click also toggles membership, matching the unordered spatial selection model rather than implying a timeline range.
- Drag any selected performer to move the whole selected formation.
- Drag an unselected performer without a modifier to select and move only that performer.
- Arrow keys nudge the full selection; Shift keeps the existing larger step.
- The existing Shift-drag eight-direction constraint applies to the group translation.
- Escape cancels an active drag. When idle it exits selection mode, then clears an explicit selection.

### Touch and pen

- Existing direct drag remains available.
- Holding an unselected performer enters selection mode and toggles it without moving the camera.
- Selection mode provides large All, None, Done, and Cancel actions through the shared selection toolbar.
- A visible move handle at the selection centroid provides an unambiguous 44-pixel-or-larger group movement target. It supplements direct character dragging; it does not replace it.
- The current 250 ms hold delay and 5 px tolerance remain. The preserved branch's later 500 ms / 10 px values are not imported because they make an already-working gesture slower and less precise without supporting evidence.

Pointer capture, multi-pointer cancellation, `touch-action`, visual-mesh picking, surface-anchor math, proxy fallback, and diagnostic error handling remain owned by the current interaction module.

## Formation Movement

At drag or nudge start, capture every selected performer's position and open one viewer spatial edit.

1. Resolve the primary/anchor performer target from the existing visual-surface or ground-plane drag path.
2. Apply the existing eight-direction constraint when Shift is held.
3. Convert the anchor target to one desired translation delta.
4. Clamp that delta against every selected performer and the stage bounds.
5. Apply the same clamped delta to every start position.

This preserves relative spacing and orientation. No member can cross a bound while another continues moving. Pointer-driven movement follows the pointer without easing. Undo and redo each treat the full group transform as one edit.

## Bulk Editing and Mixed Values

All performer setting surfaces derive their scope from `scopedPerformers()`:

- character;
- prop type and prop build;
- prop size / staff length;
- effect and hand effects;
- effort;
- hand plane;
- sequence assignment and clearing;
- performer removal and other existing scoped performer resets.

For a multi-performer scope, controls show a mixed state when values disagree. Choosing a value applies it to every selected performer. None is a safe no-op.

Selection-wide edits are wrapped in one `SceneUndoManager` entry. The entry captures complete performer editing snapshots before and after mutation, including character, sequence, prop settings, effects, effort, plane overrides, and beat-plane overrides. Continuous controls use a selection-specific coalescing key so a slider drag remains one undo step without merging edits from a different selection.

Single-performer edits retain the existing CharacterInstance undo behavior.

## Stage and 3D Synchronization

Stage performer IDs are canonical for controlled selection. The Stage bridge maps current cast order between stable IDs and viewer indices:

- a Stage selection change is visible immediately in 3D;
- a 3D selection change updates Stage selection and its anchor;
- All and None are explicit;
- cast reorder/removal normalizes the viewer projection without selecting a different performer accidentally;
- multi-performer removal delegates to the Stage state owner when controlled.

Timeline performer selection accepts Shift, Ctrl, and Command as additive/toggle modifiers.

## Responsive UI and Motion

- The performer spine shows every selected item, not only the primary item.
- All and None are explicit actions. Selection status is announced through the existing live region.
- The inspector uses the primary performer for identity while showing group count and mixed values.
- The primary performer receives the primary visual emphasis; other selected performers receive the group selection treatment.
- The move handle and selection toolbar use the shared motion primitives and collapse to their final states under reduced motion.
- Selection mode closes overlapping inspector surfaces through their existing request/motion paths rather than stacking controls.

## Preserved Branch Reconciliation

Source material: `E:/tka-platform-performer-workspace-fill`, branch `codex/performer-workspace-fill`. It remains read-only and must not be removed by this task.

| Source behavior                                                                                                 | Decision                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordered selected-index set, primary member, All/None, persistence, scoped performers                            | Port and adapt to current viewer state                                                                                                                                                                        |
| Stage ID/index selection controller                                                                             | Port narrowly; preserve current film handoff, left/right prop terminology, and current Stage state                                                                                                            |
| Modifier selection, long-press selection mode, group drag/nudge, one group clamp                                | Port into the current pointer module                                                                                                                                                                          |
| Dirty `PerformerMoveHandle.svelte` centroid affordance                                                          | Port as an additional input path                                                                                                                                                                              |
| Dirty change that removes character direct-drag and relies only on the handle                                   | Reject; current direct manipulation remains available                                                                                                                                                         |
| Dirty pointer simplification that drops visual-surface anchors, current proxy diagnostics, or Shift constraints | Reject; these are newer canonical behavior on main                                                                                                                                                            |
| Dirty 500 ms hold / 10 px tolerance                                                                             | Reject; retain current 250 ms / 5 px values                                                                                                                                                                   |
| Mixed controls and bulk editing                                                                                 | Port behavior, but route all mutations through atomic current-state transactions                                                                                                                              |
| Source multi-remove behavior                                                                                    | Port through current viewer/Stage removal owners with one undo entry                                                                                                                                          |
| Source workspace-fill/restyle changes from `5c1ea69be5`                                                         | Do not transplant. Current main has newer host-tool/panel composition and responsive workspace ownership. Only selection-dependent labels, toolbar integration, and mixed-state behavior are reconciled here. |
| Source blue/red hand terminology and export-panel deletion                                                      | Reject as stale unrelated changes                                                                                                                                                                             |
| Source tests                                                                                                    | Re-express behavioral coverage against current APIs and architecture                                                                                                                                          |

## Verification Contract

Implementation is complete only with evidence for:

1. focused state tests for All, None, arbitrary selection, primary normalization, persistence, spawn/remove, and controlled Stage mapping;
2. pointer tests for modifier selection, touch hold, direct group drag, handle drag, keyboard nudge, Shift constraint, multi-pointer cancellation, and whole-group bounds clamping;
3. focused undo tests proving one entry for group movement and each class of bulk setting edit, including redo;
4. Stage-to-3D and 3D-to-Stage selection synchronization tests;
5. Svelte and TypeScript checks using the repository's resource-budget workflow;
6. runtime browser verification of desktop and touch paths, mixed controls, undo/redo, and Stage/3D synchronization;
7. viewport evidence at 1920, 2560, 3840, 1440-height, tablet, 960x412, and 375 widths with reduced-motion and visible focus checks;
8. a final reconciliation note confirming that every useful selection behavior from the preserved source branch is represented, adapted, or explicitly rejected above.

## Verification Record

Verified on 2026-09-04 after bringing the task branch current with local `main`:

- Nine focused and adjacent Vitest files passed, covering 91 tests across viewer scope, performer count, viewer integration, pointer interaction, Stage selection and timeline projection, saved-scene state, and Film Director editing/adaptation.
- `npm run check` completed with 0 errors and 0 warnings.
- The full production build completed successfully, including package compilation, SSR/client feature gating, Cloudflare adapter output, critical CSS generation, and deploy-asset trimming. PostHog source-map upload was skipped as expected because production credentials were not present.
- Desktop runtime verification selected performers 1 and 3, kept performer 3 primary, rendered both selection treatments, exposed the group movement affordance, showed the `2 performers` inspector state, and scoped removal and mixed-value edits to the pair.
- Touch runtime verification entered persistent selection mode, kept Cancel enabled with zero selected performers, exposed one exit action instead of duplicate close controls, selected all three performers, and enabled Done after selection.
- Exact WebP viewport evidence was inspected at 375×667, 960×412, 820×1180, 1440×900, 1920×1080, 2560×1440, and 3840×2160. Each viewport retained a 16px root font and no horizontal document overflow. Selection actions measured 44px on compact layouts and performer controls measured 48px at desktop and native 4K.
- The 1440×900 physical equivalent at 200% zoom was exercised as 720×450 CSS pixels at DPR 2. The toolbar reflowed without horizontal overflow, all four actions remained reachable, and keyboard traversal produced the canonical visible 2px focus outline.
- Reduced-motion fallbacks remain explicit at the shared selection toolbar, move handle, Stage host, and scene-control host boundaries; the new structural entry/exit paths use the shared motion primitives.
- The browser console produced no runtime errors. The only warning was the expected development message that PostHog analytics were disabled without an API key.
- The preserved source worktree and branch were left intact with the same five pre-existing dirty paths. No source-branch commit or uncommitted file was modified, staged, or removed.
