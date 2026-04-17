# Camera Choreography — Implementation Plan

**Date:** 2026-04-17
**Spec:** `docs/superpowers/specs/2026-04-17-camera-choreography-design.md`
**Execution model:** `superpowers:subagent-driven-development` — each task is self-contained for a fresh subagent.

---

## Reuse contract (do not reinvent)

Before touching anything, honor the existing infrastructure:

- **`camera-controls` library** — the only orbit library in this codebase (per `memory/project_camera_controls_library.md`). All camera motion MUST go through its imperative API (`setLookAt`, `setTarget`, `setPosition`, `rotateTo`, `dollyTo`, `fitToSphere`). Do not add a second orbit library. Do not hand-roll rAF interpolation when `camera-controls` already eases.
- **`src/lib/shared/3d/components/OrbitControls.svelte`** — shared wrapper around `camera-controls`. Used by the viewer, museum, realm, village, and lab. Do not fork it. Extend via props/callbacks only (it already exposes `bind:ref` to the live `CameraControls` instance, and `oncreate` / `oncontrolstart` / `oncontrolend`).
- **`src/lib/shared/3d/context/viewer-3d-context.ts`** + **`src/lib/shared/3d/state/viewer-3d-state.svelte.ts`** — the viewer-3d context is already the right home for "active choreography preset" state. Add a new sub-state module and splice it into the state factory; do not create a parallel context.
- **`src/lib/shared/sequence-viewer/components/record-scene/RecordSceneRecordButton.svelte`** — split-button target. Keep existing `onExport / isExporting / canvasReady` props; the split variant extends it.
- **`src/lib/shared/sequence-viewer/components/ViewerTransportBar.svelte`** — scrubber + loop. During preset recording, disable scrubber and ignore loop toggle. The preset drives loop count.
- **`src/lib/shared/3d/state/avatar-instance-state.svelte.ts`** + `performerManager.performers` — source of truth for per-performer framing. Use `performerManager.performers.length` for performer-count rule.
- **`camera-controls` smooth easing** — transitions use `controls.setLookAt(..., enableTransition=true)` with `smoothTime` temporarily bumped to ~0.8s. No custom tween library.
- **`Viewer3DCamera.svelte`** holds the `CameraControls` ref via `bind:ref` on `<OrbitControls>`. Expose that ref to choreography state via registration, rather than moving camera ownership around.

---

## Architecture recap (from spec §7)

Presets are **drivers** that own the `CameraControls` instance during recording:

```ts
export type PerformerCountRule =
  | { kind: "exactly"; count: number }
  | { kind: "atLeast"; count: number }
  | { kind: "any" };

export interface CameraPresetContext {
  performers: AvatarInstanceState[];
  sequenceDurationSec: number;
  loopIndex: number;
  totalLoops: number;
  onLoopComplete: (fn: () => void) => void;
}

export interface CameraPreset {
  id: string;
  label: string;
  icon: string;
  performerCountRule: PerformerCountRule;
  apply(controls: CameraControls, ctx: CameraPresetContext): () => void;
}
```

On record-start with a chosen preset: state calls `preset.apply(controls, ctx)` → preset captures controls, sets opening shot, subscribes to loop boundaries. On record-stop / Esc / disposer: controls released, free-cam resumes.

---

## Phase 1 — Auto-orbit + split-button (minimum shippable slice)

### Task 1.1 — Camera choreography types + state scaffold

**Files (create):** `src/lib/shared/sequence-viewer/camera-choreography/{types.ts,state.svelte.ts}`
**Files (modify):** `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`

**Steps:**
- [ ] `types.ts`: `CameraPreset`, `CameraPresetContext`, `PerformerCountRule`, `PresetEvaluation`.
- [ ] `state.svelte.ts`: `createCameraChoreographyState()` → reactive `activePreset`, `registeredControls`, derived `isDriving`, methods `registerControls/unregisterControls/selectPreset/clearPreset/evaluate`.
- [ ] Splice into `viewer-3d-state.svelte.ts`; expose as `cameraChoreography`.
- [ ] `pnpm check` clean.

**Commit:** `feat(camera-choreography): add preset types and active-preset state`

### Task 1.2 — Register CameraControls ref

**Files (modify):** `src/lib/shared/3d/components/Viewer3DCamera.svelte`

**Steps:**
- [ ] Hook `<OrbitControls oncreate>` to call `cameraChoreography.registerControls(controls)`; return cleanup that unregisters.
- [ ] Preserve any existing `oncreate` logic (compose, don't overwrite).

**Commit:** `feat(camera-choreography): register camera-controls ref with choreography state`

### Task 1.3 — Auto-orbit preset

**Files (create):** `src/lib/shared/sequence-viewer/camera-choreography/presets/{auto-orbit.ts,index.ts}`

**Steps:**
- [ ] `autoOrbitPreset` — `performerCountRule: { kind: "exactly", count: 1 }`.
- [ ] `apply`: target = performer 0 position; radius via `fitToSphere`; initial azimuth from current camera; rate = `2π / sequenceDurationSec` CCW; polar = 65°.
- [ ] Decide tick hook: `controls.addEventListener("update", ...)` OR expose `onTick` on state. Document choice in `types.ts` JSDoc.
- [ ] Disposer removes listener + restores smoothTime.
- [ ] Unit test: azimuth advances 2π over sequence duration.

**Commit:** `feat(camera-choreography): implement Auto-orbit preset`

### Task 1.4 — Split-button UI

**Files (create):** `src/lib/shared/sequence-viewer/camera-choreography/ChoreographyPicker.svelte`
**Files (modify):** `RecordSceneRecordButton.svelte`, `RecordSceneChrome.svelte`

**Steps:**
- [ ] Add `onOpenPicker` prop + caret chevron inside the pill (1px divider).
- [ ] Long-press detection (500ms pointerdown) → fires `onOpenPicker`; prevents subsequent click.
- [ ] `ChoreographyPicker.svelte`: positioned above record button, tile grid from `presets/index.ts`. Disabled tiles show eligibility reason via tooltip.
- [ ] Tile click: `selectPreset(p)` → close picker → apply opening shot → banner "Recording with [preset]" → trigger `onExport`.
- [ ] Esc while picker open = close; Esc during recording = cancel + clear preset.

**Commit:** `feat(camera-choreography): split-button + choreography picker popover`

### Task 1.5 — Driver lifecycle around recording

**Files (modify):** `viewer-3d-state.svelte.ts` (`handleExport`, ~line 1226)

**Steps:**
- [ ] Build `CameraPresetContext` from performers + `1 / speed`.
- [ ] If `activePreset && registeredControls`, call `apply` before `startRecording`; store disposer.
- [ ] Wrap try/catch/finally to ensure disposer + `clearPreset()` run on every exit path (success / error / Esc / unmount).

**Commit:** `feat(camera-choreography): wire preset driver lifecycle into export flow`

### Task 1.6 — Transport disabling

**Files (modify):** `ViewerTransportBar.svelte`

**Steps:**
- [ ] Derive `isDriving`; gate `onScrub` + `toggleLoop` with tooltips and dim opacity.
- [ ] Play/pause remains functional; preset update listener early-returns when `!avatar.isPlaying`.

**Commit:** `feat(camera-choreography): disable scrubber and loop toggle during preset recordings`

### Task 1.7 — Phase 1 validation

**Files (create):** `tests/unit/camera-choreography/{preset-lifecycle,auto-orbit}.test.ts`

**Steps:**
- [ ] Unit: `selectPreset` + simulated `handleExport` → disposer called on end.
- [ ] Unit: `evaluate(autoOrbit, 1)` eligible; `evaluate(autoOrbit, 2)` ineligible with reason.
- [ ] Manual smoke list documented in commit body.

**Commit:** `test(camera-choreography): phase 1 lifecycle and eligibility tests`

---

## Phase 2 — Plane-locked shots

### Task 2.1 — Plane-locked preset

**Files (create):** `presets/plane-locked.ts`
**Files (modify):** `presets/index.ts`, `ChoreographyPicker.svelte`

**Steps:**
- [ ] `createPlaneLockedPreset(plane: Plane): CameraPreset`.
- [ ] `performerCountRule: any`.
- [ ] `apply`: camera along plane normal; `fitToSphere` on performer-group bounding sphere + 10% padding; re-fit on each `onLoopComplete`.
- [ ] Picker: clicking tile opens a secondary strip (Wall / Wheel / Floor).

**Commit:** `feat(camera-choreography): implement Plane-locked preset (Wall/Wheel/Floor)`

### Task 2.2 — Phase 2 validation

**Steps:**
- [ ] Unit: synthetic performers → camera along expected normal, target at centroid.
- [ ] Manual smoke: each plane frames correctly with 1 + 4 performers.

**Commit:** `test(camera-choreography): plane-locked framing tests`

---

## Phase 3 — Quad-plane tour + transitions

### Task 3.1 — Loop-boundary hook

**Files (modify):** `avatar-instance-state.svelte.ts`, `state.svelte.ts` (choreography)

**Steps:**
- [ ] Search for existing loop-end detection (`progress`, `loop`, wraparound). If missing, add `onLoopBoundary(fn: () => void): () => void` via `$effect` diffing progress tick-over-tick.
- [ ] Thread through `CameraPresetContext.onLoopComplete`.
- [ ] Unit: simulate progress 0.99 → 0.01 → callback fires once.

**Commit:** `feat(camera-choreography): loop-boundary subscription for multi-loop presets`

### Task 3.2 — Quad-plane tour preset

**Files (create):** `presets/quad-plane-tour.ts`
**Files (modify):** `presets/index.ts`, export-duration calculator in recording pipeline

**Steps:**
- [ ] `totalLoops: 4`, `performerCountRule: any`.
- [ ] On each `onLoopComplete`, compute next shot (Wall → Wheel → Floor → Auto-orbit); use `controls.setLookAt(..., true)` with `smoothTime = 0.8`; restore smoothTime after transition settles.
- [ ] Loop 4 = Auto-orbit (delegate to orbit helper shared with Phase 1).
- [ ] Plumb `totalLoops` into export so recording captures all 4 loops.
- [ ] Unit test: setLookAt called at 3 boundaries with correct coords.

**Commit:** `feat(camera-choreography): implement Quad-plane tour preset with loop transitions`

### Task 3.3 — Phase 3 validation

**Steps:**
- [ ] Manual smoke: quad-plane records 4× duration with smooth transitions; final orbit ends with performer facing camera.
- [ ] Scrubber + loop toggle remain disabled throughout.

**Commit:** `test(camera-choreography): quad-plane tour integration smoke tests`

---

## Phase 4 — Ensemble-focus (quad-split)

### Task 4.1 — Sequential-render MVP

**Files (create):** `presets/ensemble-focus.ts`

**Steps:**
- [ ] `performerCountRule: { kind: "exactly", count: 4 }`.
- [ ] Mapping: performer 0 → Wall, 1 → Wheel, 2 → Floor, 3 → Auto-orbit (list-order, deterministic).
- [ ] Sequence of 4 mini-presets; on each `onLoopComplete` advance to next performer's shot. Recording = 4× sequence length.
- [ ] Document path to real quad-split in a file-level comment (render target per camera, composite each frame). Do not build v2 here.

**Commit:** `feat(camera-choreography): implement Ensemble-focus preset (sequential MVP)`

### Task 4.2 — Eligibility UX polish

**Files (modify):** `ChoreographyPicker.svelte`

**Steps:**
- [ ] <4 performers: greyed tile, tooltip "Needs exactly 4 performers (you have N)".
- [ ] >4 performers: allow selection with warning banner "Only the first 4 performers will be used."
- [ ] `evaluate` returns distinct reasons so tooltip can differentiate.

**Commit:** `feat(camera-choreography): ensemble-focus eligibility UX`

---

## Final validation — spec conformance

### Task F.1 — Spec §9 + §10 checklist

**Steps:**
- [ ] §9 Live-watch vs recording: grep `cameraChoreography.isDriving` uses; gated to recording only.
- [ ] §9 World-locked: verify all 4 presets compute in world coords, no parent-frame reads.
- [ ] §9 Transitions only at loop boundary: grep `setLookAt(..., true)` inside `onLoopComplete` only.
- [ ] §9 Default = free camera: fresh viewer → `activePreset === null`.
- [ ] §9 Split-button + long-press: manual check both gestures.
- [ ] §9 Ensemble-focus strict 4: disabled ≠4; warning >4.
- [ ] §9 Ensemble-focus mapping: reorder performers → mapping follows list.
- [ ] §10 Out-of-scope not shipped: no custom-preset UI, no prop-follow, no head-relative, no mid-sequence moves, no slow-motion, no multi-cam composition beyond Ensemble-focus. Grep `camera-choreography/` for hints.
- [ ] Any gap → follow-up task; do not expand Phase 4 scope.

**Commit:** `chore(camera-choreography): spec §9 + §10 conformance validation`

---

## Critical files

- `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`
- `src/lib/shared/3d/components/Viewer3DCamera.svelte`
- `src/lib/shared/3d/components/OrbitControls.svelte`
- `src/lib/shared/sequence-viewer/components/record-scene/RecordSceneRecordButton.svelte`
- `src/lib/shared/sequence-viewer/components/ViewerTransportBar.svelte`
- `src/lib/shared/3d/state/avatar-instance-state.svelte.ts`
