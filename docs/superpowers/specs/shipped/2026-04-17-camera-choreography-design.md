# Camera Choreography Design

**Date:** 2026-04-17
**Status:** Brainstorm → design (ready for implementation plan)
**Supersedes:** the "viewer camera choreography" line item in `memory/project_viewer_camera_choreography.md`

---

## 1. Summary

Add automatic camera presets to the 3D sequence viewer for **scene recording only**. During live watching, the camera is free (current behavior). When the user initiates a recording, they pick a preset that locks the camera for the duration of the recording. Sequences that loop back to their home position cut between loops (not mid-sequence) with a smooth camera transition to the next shot.

Four presets ship in v1. Custom user-defined choreography is explicitly Phase 3 scope and not designed here.

## 2. Scope

**In scope:**
- Four built-in presets (Auto-orbit, Plane-locked shots, Quad-plane tour, Ensemble-focus).
- Split-button UI on the Record Scene control: default click = "record with free camera"; long-press or split-caret = "pick a choreography preset first".
- Camera transitions between loops (smooth, not instant cut).
- All cameras are **world-locked** (not body-relative), even though performer heads can move and rotate planes. World-locked is clearer to watch and doesn't drift; body-relative gets confusing when planes re-orient per-performer.

**Out of scope:**
- Live-watch camera choreography (user always has free camera when not recording).
- Custom preset authoring (Phase 3).
- Mid-sequence camera moves (transitions only happen on loop boundary).
- Prop-follow / head-relative cameras (deferred).

## 3. Presets

### 3.1 Auto-orbit (single performer)
The camera orbits at fixed radius and vertical angle around the primary performer. Orbit rate ties to the sequence duration — one full revolution per recording. The performer ends up facing camera-forward every time.

- **Best for:** solo sequences, showcasing a performer.
- **Parameters:** radius (auto from performer bounding volume + 1.2m safety), height angle (25° above horizon), orbit direction (counter-clockwise from above).
- **Performer count rule:** 1. With 2+, falls back to Quad-plane tour.

### 3.2 Plane-locked shots
The camera sits dead-on to a single plane (Wall / Wheel / Floor). User picks which plane. Camera height/distance auto-fit the performers' bounding box plus padding.

- **Best for:** studying one plane of motion in isolation.
- **Parameters:** plane (Wall | Wheel | Floor); auto-recenter on performer midpoint each loop.
- **Performer count rule:** any.

### 3.3 Quad-plane tour
Four loops of the sequence, one per shot: Wall, Wheel, Floor, Auto-orbit. Smooth camera transition between loops (~0.8s ease). Recording is 4× sequence length. The final shot (Auto-orbit) is included because a pure plane sweep misses the gestalt; the orbit ties it together.

- **Best for:** exhaustive showcase of a sequence across all three planes plus context.
- **Parameters:** loop order (Wall → Wheel → Floor → Auto-orbit, fixed); transition duration (0.8s).
- **Performer count rule:** any.

### 3.4 Ensemble-focus
Quad-split screen (or sequential if split proves expensive): 4 camera shots running simultaneously, each framed on one specific performer. All performers share the same physical stage — the four cameras just isolate each one.

- **Performer count rule:** exactly 4 required. With < 4 performers, the preset is greyed out with a tooltip; with > 4, the first 4 are used and a warning appears.
- **Plane → performer assignment:** list-order. Performer 0 → Wall-facing camera, Performer 1 → Wheel-facing, Performer 2 → Floor-facing, Performer 3 → Auto-orbit. Deterministic, no UI needed. User can reorder performers in the Performers popover if they want a different mapping.
- **Parameters:** none (everything derived from the 4 performers).
- **v1 shipping note:** render sequentially (4 separate recordings concatenated) if GPU-split proves expensive. Upgrade to real quad-split in a follow-up.

## 4. UI

**Entry point: Record Scene button becomes a split button.**

- **Main click** (existing behavior): record with free camera.
- **Caret** (small chevron on the right edge of the button): opens a choreography picker popover.

Choreography picker popover contains the 4 preset tiles with thumbnails (similar to the Scene tab tile grid from Task 19). Clicking a tile:
1. Applies the preset to the camera immediately (so the user can preview the starting shot).
2. Shows a "Recording with [preset]" banner.
3. Triggers the record.

Long-press on the main button is equivalent to clicking the caret — gives users a single-gesture path.

**Default preset:** Free camera. Every recording starts from free-camera unless the user explicitly picks a preset. No memory of last-used preset in v1.

## 5. Transport interaction during preset recording

- **Play/pause:** works as normal, pauses the camera animation too.
- **Scrubber:** disabled during preset recordings (scrubbing would break the camera choreography timing). Shows a tooltip: "Camera preset locks the scrubber during recording."
- **Loop toggle:** ignored during preset recordings (the preset defines loop count — Auto-orbit = 1 loop, Plane-locked = 1, Quad-plane = 4, Ensemble-focus = 1).
- **Esc:** cancels the recording and returns to free camera.

## 6. Camera transition (between loops)

When a preset records multiple loops (currently only Quad-plane tour), transitions happen **at the loop boundary only** (sequence returns to home position → transition → next loop begins). Transition uses the existing `camera-controls` library's built-in smooth easing (the only orbit library per `memory/project_camera_controls_library.md`). Duration 0.8s with ease-in-out.

No mid-sequence camera moves. This keeps choreography code simple and readable.

## 7. Architecture

**New files:**
- `src/lib/shared/sequence-viewer/camera-choreography/presets/` — one file per preset (`auto-orbit.ts`, `plane-locked.ts`, `quad-plane-tour.ts`, `ensemble-focus.ts`)
- `src/lib/shared/sequence-viewer/camera-choreography/types.ts` — `CameraPreset` interface: `id`, `label`, `icon`, `performerCountRule`, `apply(controls, ctx) → disposer`
- `src/lib/shared/sequence-viewer/camera-choreography/ChoreographyPicker.svelte` — tile grid popover
- `src/lib/shared/sequence-viewer/camera-choreography/state.svelte.ts` — active preset state (null during free-cam)

**Modified files:**
- `src/lib/shared/sequence-viewer/components/record-scene/RecordSceneRecordButton.svelte` — split-button + caret handler
- `src/lib/shared/sequence-viewer/components/ViewerTransportBar.svelte` — disable scrubber + loop during preset recordings
- `src/lib/shared/3d/components/OrbitControls.svelte` (or equivalent) — accept a choreography driver that owns the camera for the recording duration

**Key design call:** the preset is a **driver** that owns the camera controls during recording. On entry, it captures the camera, applies its motion each tick, and releases on exit (via the disposer). This isolates each preset's logic and keeps the free-cam code untouched.

## 8. Shipping order

1. **Phase 1:** Auto-orbit + split-button UI. Simplest preset, proves the architecture.
2. **Phase 2:** Plane-locked shots (3 planes, one preset with a parameter).
3. **Phase 3:** Quad-plane tour (introduces transitions).
4. **Phase 4:** Ensemble-focus (most complex; quad-split rendering).

Each phase ships independently; users get value from Phase 1 alone.

## 9. Open questions resolved

- **Live-watch vs recording:** recording-only.
- **Camera reference frame:** world-locked (decided 2026-04-16 — head-relative gets confusing when planes rotate per-performer).
- **Transition timing:** loop boundary only, never mid-sequence.
- **Default preset:** none (free camera).
- **Preset UI gesture:** split-button + long-press.
- **Ensemble-focus count rule:** strict 4; fall back to greyed tile otherwise.
- **Ensemble-focus plane→performer:** list-order (performer 0 = Wall, 1 = Wheel, 2 = Floor, 3 = Auto-orbit).

## 10. Out of design

- Custom choreography authoring (Phase 3+ project).
- Prop-follow cam, head-relative cam (deferred — see memory).
- Slow-motion / speed ramps inside a preset (could be a parameter later).
- Multi-camera composition beyond Ensemble-focus's quad-split.

---

**Next step:** writing-plans skill to produce the implementation plan. Recommended entry point: Phase 1 (Auto-orbit + split-button) as the first implementable task group.
