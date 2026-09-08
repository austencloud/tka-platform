# Performer Direct Manipulation — Design Spec

**Date:** 2026-08-30
**Status:** Draft for review
**Scope:** The 3D sequence viewer (`/sequence/[id]?render=3d` and the in-app viewer drawer). Click-to-select discoverability, drag-to-reposition, touch, keyboard, and undo for performers.

---

## 1. The problem

A power user paused on this screen trying to remember how to select a performer. The two entry points (top-left chips, right-rail Performers panel) both live in chrome, while the user's attention is on the avatars. Austen: *"any user who's not intimately familiar with it will probably have an even longer moment."*

The audit finding that reframes the work: **click-to-select already ships.** `Viewer3DScene.svelte` raycasts on pointerdown, resolves the hit to a performer via `userData.performerIndex`, and calls `selectPerformerScope()` — empty space deselects to "All" (`src/lib/shared/3d/components/Viewer3DScene.svelte:356-457`). It went unnoticed by the app's own author because **nothing advertises it**: no cursor change, no hover response, no hint. Per NN/g's drag-and-drop guidance, the signifier must communicate both that a thing is grabbable and what grabbing does; today there is no signifier at all.

So the real work is:

1. **Discoverability** — hover affordance that teaches clickability (the missing signifier).
2. **Drag-to-move** — reposition a performer on the stage floor by grabbing it.
3. **Parity surfaces** — touch, keyboard, undo, and formation-model integration so drag is a first-class edit, not a demo.

## 2. What already exists (evidence)

| Piece | Where | State |
|---|---|---|
| Click-to-select raycast | `Viewer3DScene.svelte:356-457` (`hitTestPerformers`, `findPerformerIndexFromHit`) | **Shipped**, no hover, no drag |
| Selection state | `viewer-3d-state.svelte.ts:629,787-805` (`selectedPerformerIndex`, `selectPerformerScope`) | Shipped; single store feeding chips, panel, badges, spotlight ring |
| Position write for drags | `performer-manager.svelte.ts:503-510` `handleDrag(index, newPos)` — cancels formation transition, writes position | **Built, zero callers** |
| Coalescing drag undo | `viewer-3d-state.svelte.ts:1153-1175` `beginSpatialEdit()`/`endSpatialEdit()` (300ms coalesce, snapshot restore) | **Built, zero callers** |
| Ground-plane drag math | `ManualRaycaster.svelte` (`Plane(0,1,0)` + `ray.intersectPlane`) | Lab-only; no pointer capture, no threshold, no undo |
| Drag ring visual | `DraggablePerformer.svelte` (green dragging / blue active ground ring) | **Orphaned, zero consumers** |
| Camera-drag arbitration | `isCameraDragging` flag set by `camera-controls` events; `disableOrbitControls` pattern in `Scene3D.svelte` | Shipped |
| The 2D reference implementation | Stage drill chart `FormationOverlay.svelte:98-213`: pointer capture, clamp to stage, `presetId = "custom"` on drag, one undo push per drag, arrow-key nudge 0.25m | Shipped — the interaction contract to mirror in 3D |
| "custom" formation marker | `formation-presets.ts` — a marker meaning "user-dragged, no canonical footprint"; only the Stage module sets it today | Shipped |
| Position persistence | `StoredPerformerSnapshot` (localStorage) + `Scene3DSnapshot` (Firestore Scene collection) both already carry `position` | Shipped — drag needs no new persistence |

Ownership note (`never-hand-roll.md`): no `canonical-capabilities.md` row owns "select/drag an object in 3D." This spec establishes one (§9). The viewer must **not** grow a third raycast stack — it extends its own existing one. `ManualRaycaster`/`DraggablePerformer`/Threlte `interactivity()` are explicitly *not* adopted wholesale: `ManualRaycaster`'s own doc comment records that Threlte's `interactivity()` misbehaves with multiple canvas instances, and the viewer's manual raycaster is already the shipped, working owner. We extend it.

## 3. Research basis (2026 state of the art)

Converged parameters from dnd-kit, Android `ViewConfiguration`, three.js `DragControls`, Blender/Unity/Unreal editor conventions, NN/g, and Adobe React Aria (full digest with sources retained in the session; key sources: threlte.xyz interactivity + TransformControls reference, nngroup.com/articles/drag-drop, react-aria.adobe.com/blog/drag-and-drop, dndkit.com sensors):

- **Click vs drag threshold:** 8 px pointer travel (mouse). Below threshold on release = click/select.
- **Touch activation:** select-then-drag beats long-press for manipulation surfaces; where a hold is used, 250 ms + 5 px tolerance is the tuned web value (500 ms feels sluggish).
- **Drag mechanics:** raycast an invisible ground plane each move (never the moving object), preserve the initial grab offset so the avatar doesn't snap its origin under the cursor, `setPointerCapture` so fast drags can't escape, Escape cancels and restores, one undo entry per completed drag.
- **Hover ≠ selected:** hover gets `cursor: grab` + a weak cue; selection gets the strong cue (the existing spotlight + ring). Click empty space deselects (already true here).
- **Raycast cost:** per-pointermove raycasting against skinned humanoid meshes is the expensive case; the standard fix is an invisible pick proxy (capsule) per object and restricting the hover raycast to proxies only.
- **Two fingers always camera.** Never overload multi-touch with object manipulation.
- **Accessibility:** in-scene manipulation must never be the only path. The panel stays the accessible surface; arrow-key nudge for a selected object with `aria-live` position announcements is the accepted keyboard model.

## 4. Design

### 4.1 Hover affordance (the discoverability fix)

- Add one invisible **pick capsule** per performer (cylinder ~0.5 m radius × avatar height, parented inside the existing `T.Group userData={{performerIndex}}`). All pointer hit-testing — hover *and* the existing pointerdown select — retargets to these proxies instead of `scene.children` recursive. This makes per-move raycasting affordable, makes hit targets generous and stable (skinned-mesh raycast is both slow and unreliable mid-animation), and fixes the current behavior where clicking a prop tip selects a performer but clicking between the legs misses.
- On hover: canvas cursor becomes `grab`; a **ground ring** fades in at the performer's feet in `getPerformerColor(index)` at low opacity (rehabilitate the orphaned `DraggablePerformer.svelte` ring visual, moved into the viewer path). On leave, it fades out. Reduced motion: instant, no pulse.
- During camera drag (`isCameraDragging`), hover is suppressed — no raycasts, no cursor churn.
- **First-run hint:** a one-time ephemeral caption near the performer bar — "Click a performer to select · drag to move" — dismissed permanently on the first successful in-scene select or drag (localStorage flag). No modal, no tour.

### 4.2 Click-to-select (harden what exists)

- Keep current behavior: click performer → `selectPerformerScope(i)`; click empty space → `selectPerformerScope(null)` (All).
- Add the 8 px threshold: pointerdown records the start; only a release within 8 px counts as a click. This removes today's edge case where the tail end of an orbit gesture can flip selection (the `isCameraDragging` guard catches most but not all orderings).
- Selection syncs both ways with chips/panel already (single store) — no change needed, verified.

### 4.3 Drag-to-move

State machine per pointer: `idle → pressed (on performer) → dragging | clicked`.

1. **pointerdown on a pick capsule** — record pointer, performer index, start position; `setPointerCapture` on the canvas. Do *not* disable the camera yet.
2. **Threshold crossed (8 px)** — commit to drag: disable `camera-controls` (`controls.enabled = false`), `beginSpatialEdit()` (existing coalescing undo seam), cursor `grabbing`, ring switches to its dragging treatment, badge/spotlight follow live.
3. **Each pointermove** — `raycaster.ray.intersectPlane(Plane(0,1,0) at stage ground Y)` → target = hit + grab offset (offset captured at drag start so the avatar doesn't jump). Guard the grazing-angle case (near-horizontal ray → bail/clamp). **Clamp** to the current stage deck: `|x| ≤ stageDimensions.width/2 − clearanceMargin`, same for z (margin ≈ 0.5 m so feet stay on the deck). Write via `performerManager.handleDrag(index, pos)` — position moves live (no ghost; live-follow reads better at this object count and the ring at the feet shows the XZ footprint).
4. **pointerup** — `endSpatialEdit()` (one undo entry: "Move performer"), release capture, re-enable camera, set `activeFormation = "custom"` (mirrors the Stage drill chart's contract; FormationSelector shows no preset active). If net travel < threshold, it was a click — select instead, no undo entry.
5. **Escape / pointercancel / lostpointercapture** — restore start position, discard the undo entry, re-enable camera.
6. **Drag works from "All" mode too:** grabbing any avatar selects it and moves it in one gesture — selection is not a prerequisite. (Pressing and releasing under threshold is exactly the existing click-select.)
7. Dragging cancels any in-flight formation transition (already handled inside `handleDrag`).
8. **No snapping in v1.** Free placement with deck clamping. Formation alignment guides (snap to other performers' X/Z lines, Figma-style) are a named v2 item — they need their own visual language and shouldn't gate shipping the core gesture.
9. **Y and rotation are out of scope.** Facing angle stays owned by `facingMode`/formation; a rotate affordance (drag the ring's edge) is a possible v2. No vertical movement, no gizmo — a full `TransformControls` gizmo is the scene-composer/museum-editor pattern for *arbitrary objects*; performers are floor-locked actors and a gizmo would be over-tooling (and clutter the stage).

### 4.4 Touch

- **Model: select-then-drag.** One finger orbits (unchanged) *until* the finger goes down on a performer's pick capsule: then the same threshold machine runs, with touch values — **250 ms hold OR 5 px-tolerance immediate drag on an already-selected performer**. Concretely: touching an *unselected* performer and releasing selects it (tap); touching the *selected* performer and moving immediately drags it; touching an unselected performer and holding 250 ms lifts it into drag directly (with a haptic via the existing `getHapticFeedback()` used by `CompositionGrid.svelte`). Two fingers always camera, mid-drag included (second finger cancels the drag cleanly).
- Pick capsules get a minimum *screen-space* footprint on coarse pointers: if the projected capsule subtends < 44 CSS px, the raycast threshold expands (screen-space distance test fallback) so distant performers stay tappable.
- `touch-action: none` on the canvas wrapper (verify — `camera-controls` may already set it; the drag path must not depend on that accident).

### 4.5 Keyboard + accessibility

- With a performer selected and the canvas focused: **Arrow keys nudge 0.25 m** (matches the Stage drill chart), Shift+Arrow = 1 m, Alt+Arrow = 0.05 m. Axes are camera-relative-snapped-to-stage-axes (left/right = stage X as seen by the camera, rounded to the nearest axis) so arrows do what they visually appear to do. Nudges route through the same `beginSpatialEdit`/`endSpatialEdit` coalescing (existing 300 ms window merges a key-repeat run into one undo entry).
- Escape with a selection = deselect to All (matches click-empty-space).
- The Performers panel remains the accessible surface of record: its per-performer controls are real buttons already. Add an `aria-live="polite"` region announcing selection changes and nudge positions ("Performer 2 selected", "Performer 2 moved to 1.5, −0.75"). Canvas keeps `role="img"` + label; no fake ARIA on the canvas.
- In-scene manipulation is never the only path: everything drag can do, panel + keyboard can do.

### 4.6 Badges

The floating numbered badges are part of the same story (they are the current in-scene selection UI, opacity-coded). Two changes:

1. They inherit clickability today only by raycast accident; with hit-testing retargeted to pick capsules, give the badge sprite its own deliberate membership in the pick target so clicking a badge still selects.
2. **Investigate anchoring:** in Austen's screenshot the badges render far from the avatars (upper-left of the scene, on the terrain). They are coded to sit at `performer.position` + small Y offset — if they can visually detach (stale position during transitions, sprite scale at distance, or a groundOffset mismatch on terrain scenes like ember), that's a real bug to fix in this work, because a floating "3" nowhere near performer 3 actively mis-teaches the mapping the chips rely on. Reproduce on ember before writing the fix.

## 5. Alternatives considered

- **Threlte `interactivity()` plugin** — the framework path, and normally `research-before-building.md` would mandate it. Rejected here on recorded evidence: the codebase already documents multi-canvas issues with it (`ManualRaycaster.svelte` header), the viewer already owns a working manual raycaster, and adopting the plugin would mean two hit-testing regimes in one scene. Revisit if the viewer ever becomes single-canvas-guaranteed and the plugin's multi-instance behavior is fixed upstream.
- **`<TransformControls>` gizmo** (museum/scene-composer pattern) — right for arbitrary object editing, wrong for floor-locked performers: adds axis handles nobody needs, obscures the avatar, and reads as "editor tool" rather than "grab the dancer." Keep-separate.
- **Long-press-only touch drag** — simpler to implement than select-then-drag but measurably worse (500 ms OS-style waits feel sluggish; 250 ms still adds latency to every move for selected performers). The hybrid in §4.4 gives already-selected performers zero-latency drag.
- **Ghost preview instead of live move** — ghosts earn their keep for *placement of new objects* against validity rules (ComposerGhost). For moving an existing performer with deck clamping and no validity states, live-follow is the direct-manipulation ideal (pointer-follows-hand is also the `no-layout-shift.md` rule for drags).
- **Marquee/multi-select** — deliberately out: the cast is ≤ ~8, chips give O(1) access, and multi-performer group-drag can ride on a later "select multiple chips" story if it's ever wanted.

## 6. Implementation plan

New module: `src/lib/shared/3d/components/performer-interaction/` — the extracted, extended owner of performer pointer behavior. `Viewer3DScene.svelte` (already 900+ lines) sheds its inline raycast block and consumes this module.

**Phase 1 — Extract + hover (the signifier).**
`performer-pointer-interaction.svelte.ts` (state machine + raycast, unit-testable: threshold, plane intersection with grab offset, clamping, grazing-angle guard — pure functions), `PerformerPickProxy.svelte` (invisible capsule), hover ring (rehabilitated `DraggablePerformer` visual, renamed into the module; delete the orphan), cursor management, `isCameraDragging` suppression, retarget existing click-select to proxies. First-run hint.
*Verify:* hover ring + cursor on all scenes; click still selects; empty space deselects; orbit unaffected.

**Phase 2 — Drag (mouse/pen).**
Threshold promotion, camera disable/re-enable, `beginSpatialEdit`/`endSpatialEdit` wiring, `handleDrag` writes, deck clamping from `stageDimensions`, Escape/pointercancel restore, `activeFormation = "custom"` on commit, FormationSelector shows no-preset state, undo/redo verified end-to-end, persistence confirmed (localStorage snapshot round-trip).
*Verify:* drag on ember + blossom (terrain vs deck), undo restores, camera never fights the drag, formation popover reflects custom.

**Phase 3 — Touch.**
Select-then-drag machine, 250 ms/5 px values, haptic on lift, two-finger cancel-to-camera, screen-space minimum pick size, `touch-action` audit.
*Verify:* on-device (or DevTools touch emulation) — tap select, drag selected, hold-lift unselected, two-finger orbit mid-drag.

**Phase 4 — Keyboard, a11y, badges.**
Arrow nudges + coalesced undo, aria-live announcements, Escape deselect, badge pick membership, badge anchoring investigation/fix on ember.

Each phase: unit tests for the pure logic in `tests/unit/3d/performer-pointer-interaction.test.ts` (test-on-fix discipline — the state machine and math are exactly the reactivity-prone logic worth locking), full `npm run check`, and the visual verification pass (`visual-verification-mandatory.md` viewports; interaction endpoints + one real transition per `no-layout-shift.md`). Worktree per phase group, scoped commits.

**Estimated shape:** Phase 1+2 are one worktree and the bulk of the value; 3 and 4 are each small follow-ons. No new dependencies.

## 7. Non-goals (v1)

Rotation/facing drag; vertical movement; snapping/alignment guides; multi-select; moving performers in the Stage module's 3D view (the drill chart owns that surface); gizmos; changing what the chips/panel do.

## 8. Risks

- **Raycast perf on pointermove** — mitigated by proxy-only raycasting; measure with the same GL/frame instrumentation used in the stage-churn fix if in doubt.
- **camera-controls gesture arbitration** — `controls.enabled = false` mid-gesture is the pattern `Scene3D.svelte` already uses; test the ordering where the camera lib claimed the pointer first.
- **Formation semantics** — setting `"custom"` must not break `PRESET_VALID_COUNTS` gating or canonical stage-bounds sizing (bounds are count-based, not position-based — verified; dragging cannot resize the deck).
- **Viewer drawer host** — the shell renders the same viewer; confirm pointer capture works inside the drawer's stacking context.

## 9. Capability registration

On landing Phase 2, add a `canonical-capabilities.md` row: *"3D object select/drag, pick proxy, ground-plane drag, spatial undo"* → owner `shared/3d/components/performer-interaction/` for performers; keep-separate: scene-composer/museum `TransformControls` editing (arbitrary objects, gizmo model), Stage drill chart (2D SVG projection), arrange grid (DOM grid cells). Retire `ManualRaycaster`'s drag role for future work by pointing at the new owner.
