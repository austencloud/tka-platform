# 3D Viewer Load Gate — Design

**Date:** 2026-07-10
**Status:** Approved (brainstormed with Austen)
**Scope:** 2 files — `Viewer3DCanvas.svelte`, `ViewerSplitPane.svelte`

## Problem

Opening the 3D animation view shows the "Setting the stage… 0%" curtain over the
WebGL area, but the surrounding viewer chrome reads as already-loaded:

1. **Scrubber leaks through.** `SceneLoadingCurtain` is `z-index:20`, absolute
   `inset:0` inside `.viewer-3d-canvas`. The transport (`.timeline-anchor`,
   `UnifiedTimeline`) is a DOM sibling *after* the curtain, also `z-index:20`, so
   it paints on top. It also keeps **advancing** — switching into 3D mid-play
   leaves the shared playback clock running under the curtain.
2. **Right rail leaks.** `RightRail` (3D) + `PerformerHub` live in
   `ViewerSplitPane`'s `.persistent-rail` (`z-index:9`), a *sibling* of the
   canvas pane, so the canvas-scoped curtain can't cover them.

Net effect: chrome present + scrubber moving ⇒ "looks done, but the stage is
still black at 0%." Austen wants one deterministic reveal: *"here it comes → here's
everything,"* not chrome-first-then-stage.

## Decision: gate the 3D viewer surface, hold the clock

Gate the **3D viewer surface** — canvas + transport + beat strip + `RightRail`(3D)
+ `PerformerHub` — behind the curtain until every enabled async scene feature
reports ready. Keep the **shell frame** (top header, left mode-rail, close button)
visible: it's navigation, and covering it during a multi-second GLB fetch reads as
a hang and traps the user. Playback is **held in place** (paused + latched) while
the curtain is up, then resumed on reveal — not force-reset to 0, which would
discard a deliberate seek.

## Changes

### 1. Curtain covers the transport — `Viewer3DCanvas.svelte`

Raise the curtain above the transport + beat strip so nothing paints over it.
Render `SceneLoadingCurtain` last in the pane and/or give `.curtain` a z-index
above the `.timeline-anchor` (20) and `.beat-strip-container` (10). Kills tell #1's
visual regardless of the clock state.

### 2. Local playback hold — `Viewer3DCanvas.svelte`

Drive a hold off the local `sceneFeatureState`, reusing the curtain's first-load
latch (once ready, stays ready even if features toggle later):

- On first mount while the curtain is up: if `isPlaying`, call `onPlaybackToggle()`
  to pause and set `wasPlayingBeforeSceneLoad = true`.
- When `allEnabledReady` flips true (or the existing 15s force-ready timeout
  fires): if latched, call `onPlaybackToggle()` to resume; clear the latch.

This mirrors the existing scrub-pause pattern (`handleProgressBarScrubStart/End`
toggle the same controller). No orchestrator/shell plumbing — `onPlaybackToggle`
is already passed into `Viewer3DCanvas`. Guard for the prop being undefined.

Applies automatically to both the left-pane and right-pane (side-by-side) 3D
instances, since both mount `Viewer3DCanvas`.

### 3. Ready signal → gate the rail — `Viewer3DCanvas.svelte` + `ViewerSplitPane.svelte`

`Viewer3DCanvas` gains `onSceneReadyChange?(ready: boolean)`, fired from an
`$effect` on the latched ready state. `ViewerSplitPane` holds `scene3dReady` and
withholds the 3D `.persistent-rail` (`RightRail` + `PerformerHub`) until it's
true, fading them in as the curtain lifts. Wired on the left-pane instance (the
one that owns the rail); the right-pane instance has no rail and needs no wiring.

## Reveal sequence

Curtain up over the full surface (transport hidden, clock held, rail withheld) →
`Setting the stage… N%` → all enabled async features ready → curtain fades (400ms,
existing) → rail + transport fade in → playback resumes if it was running. One
continuous "here it comes → here's everything."

## Safety / edges

- **Never trapped:** the existing 15s force-ready timeout in `Viewer3DCanvas`
  unsticks stuck features → the hold always releases.
- **Reduced motion:** curtain already collapses its own animations; the fade lift
  respects the existing rules.
- **LAN sync:** the pause/resume toggles the shared controller (same as
  scrub-pause today), so a synced peer briefly follows the hold. Accepted — it
  matches existing scrub behavior.
- **First-load only:** toggling a scene feature on later (mid-session) does not
  re-raise the curtain or re-hold playback (latch).

## Out of scope

- Covering the shell frame (top header / mode rail). Revisit only if the frame
  itself reads as "done" during load.
- Prewarming/parallelizing GLB fetch to shrink the wait (the "iterative fast"
  option Austen did not pick).
