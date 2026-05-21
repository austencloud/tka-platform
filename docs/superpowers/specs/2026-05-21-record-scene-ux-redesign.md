# Record Scene UX Redesign

## Problem

Two issues with the current Record Scene flow:

1. **Bug**: Clicking Record Scene resets all performers to beat 0 via `pc.jumpToStep(0)` in `ExportCoordinator.svelte.ts:176`. Recording should capture the scene as-is.

2. **Concept conflation**: The ExportPopover mixes view-snapping (Wall/Wheel/Floor) with recording modes (Free/Orbit) in a single 7-tile camera grid. View-snapping is independent of recording and already has its own CameraPresetBar.

## Design

### Bug Fix

Remove `pc.jumpToStep(0)` from `ExportCoordinator.svelte.ts`. Recording starts from whatever state the scene is in — current beat, current camera position, current performer poses. No reset.

The line `if (!isPlayingLocal) pc.togglePlayback()` also needs reconsideration: if the user hasn't started playback, recording should still work (captures a static scene or lets the user start playback manually during recording).

### Concept Separation

Three independent concerns, each with its own control surface:

| Concern | Control | Location |
|---------|---------|----------|
| View snapping | CameraPresetBar (3D / Wall / Floor / Wheel) | Existing position in viewer chrome |
| Recording mode | New compact segmented toggle (Free / Orbit) | Inline, left of Record button |
| Export settings | ExportVideoDrawer pills (res / fps / quality / loops) | Right rail, unchanged |

### Recording Mode Toggle

A compact segmented control positioned inline to the left of the Record button.

**Modes:**

- **Free** — Records the user's manual camera movement (orbit, pan, zoom) as camera keyframes. Default mode.
- **Orbit** — Camera auto-orbits around performers during recording. Uses the existing `autoOrbitPreset` driver.

**Interaction:**

- Binary toggle: tapping either segment flips to the other mode, even if tapping the currently active segment.
- Active segment shows icon + label. Inactive segment shows icon only.
- Minimum touch target: `var(--min-touch-target)` (44px) per WCAG AAA.

**Visual pattern:**

Follows `CameraPresetBar.svelte` exactly:
- Container: `background: var(--theme-panel-bg)`, `border: 1px solid var(--theme-stroke)`, `border-radius: 12px`, `padding: 4px`, `backdrop-filter: blur(8px)`.
- Buttons: `border-radius: 8px`, `font-size: var(--font-size-sm)`, `font-weight: 500`.
- Active state: `background: var(--theme-accent)`, `color: white`.
- Hover: `background: var(--theme-card-hover-bg)`, `color: var(--theme-text)`.

**Icons:**

- Free: FontAwesome `fa-hand-paper`
- Orbit: FontAwesome `fa-sync-alt`

### ExportPopover Cleanup

Remove the "Camera" row (7-tile grid: Free, Auto-orbit, Wall, Wheel, Floor, Tour, Ensemble) from `ExportPopover.svelte`. Camera mode selection moves to the new toggle. Export popover retains Resolution, Quality, FPS, and Advanced (loop count).

### Camera Choreography State Changes

`PresetId` type simplifies from:

```typescript
// Before
type PresetId = "free" | "auto-orbit" | "plane-wall" | "plane-wheel"
  | "plane-floor" | "quad-plane-tour" | "ensemble-focus";

// After (for recording purposes)
type RecordingMode = "free" | "auto-orbit";
```

The preset registry (`presets/index.ts`) keeps all presets available for potential programmatic use, but the UI only exposes Free and Orbit for recording.

### ExportCoordinator Changes

In the 3D recording path (`handleExport`, ~line 129):

1. Remove `pc.jumpToStep(0)`.
2. Remove `if (!isPlayingLocal) pc.togglePlayback()` — don't force playback start.
3. The `usePreset` logic simplifies: only check if `activePresetId === "auto-orbit"`. If so, apply the orbit driver. If `"free"`, skip driver entirely and let the user control the camera manually.
4. Keep the existing Pass 1 (camera keyframe recording) / Pass 2 (deterministic offline render) pipeline. The two-pass architecture is correct — only the setup phase changes.

### RecordSceneChrome Changes

`RecordSceneChrome.svelte` currently wraps only the Record button. It gains the new segmented toggle:

```
<div class="bottom-right">
  <RecordingModeToggle mode={...} onToggle={...} />
  <RecordSceneRecordButton ... />
</div>
```

The toggle state lives on `cameraChoreography.activePresetId` (existing state), constrained to `"free" | "auto-orbit"` by the UI.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/shared/sequence-viewer/components/ExportCoordinator.svelte.ts` | Remove `jumpToStep(0)`, remove forced playback start, simplify preset logic |
| `src/lib/shared/sequence-viewer/components/record-scene/RecordSceneChrome.svelte` | Add RecordingModeToggle left of Record button |
| `src/lib/shared/sequence-viewer/components/record-scene/RecordingModeToggle.svelte` | New component — compact segmented control |
| `src/lib/shared/sequence-viewer/components/ExportPopover.svelte` | Remove Camera row (7-tile grid) |
| `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte` | No changes needed (export settings stay) |
| `src/lib/shared/3d/components/controls/CameraPresetBar.svelte` | No changes (view snapping is independent) |

## Out of Scope

- Changing CameraPresetBar behavior or location
- Adding new recording modes beyond Free/Orbit
- Changing the two-pass export pipeline architecture
- Export settings UI changes
