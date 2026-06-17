# Background Suppression — pause the global animated background under fullscreen scenes

**Date:** 2026-06-16
**Status:** approved (conditional on root-cause confirmation — confirmed)

## Problem

The museum's 2D→3D flip freezes for ~350–600ms, every time, partway through.

A Chrome performance trace of the flip (captured in the user's real Chrome, museum
confirmed via `museum/workers/geometry-worker.ts` + museum profile markers) showed
the freeze is **not** the museum's own 3D work. It is the global animated background:

| Function | Self-time | Source |
|---|---|---|
| `updateTentaclePhysics` | 628 ms | `@austencloud/backgrounds` ocean `JellyfishAnimator` |
| `(program)` / native | 345 ms | driven by the above |
| `(garbage collector)` | 263 ms | per-frame jelly/trail/gradient allocations |
| `drawSpineScalePattern` + canvas gradient ops | ~140 ms | ocean `FishPatternRenderer` |

Per-50ms bucketing showed a ~350ms contiguous block of ~100% jellyfish physics at the
flip, then the background settling to ~5ms/frame. A user screenshot with the museum
un-mounted showed the ocean background (jellyfish, bubbles) rendering through — visually
confirming it runs behind the fullscreen museum.

Root cause: `BackgroundHost` mounts a persistent `BackgroundController` singleton
(`@austencloud/backgrounds`) at `position:fixed; z-index:-1`. Its rAF loop never pauses.
When the fullscreen museum draws an opaque WebGL canvas on top, the background keeps
animating fully occluded — invisible, but stealing the main thread. During the flip's
transient spike, the combined load blows the frame budget → the freeze.

`BackgroundHost.onDestroy` deliberately does NOT unmount the controller (it persists for
HMR), so toggling `settings.backgroundEnabled` does not stop the loop.

## Approach (chosen)

**Tiny generic suppressor.** A keyed shared store. Any fullscreen-opaque scene registers
a suppressor on mount and releases it on destroy. `BackgroundHost` watches the store and
pauses the controller whenever any suppressor is active.

Rejected: museum-only (next fullscreen scene re-hits the bug); auto-detect occlusion
(z-occlusion detection in the DOM is unreliable).

### Pause mechanism

Use the controller's **public** API — `unmount()` ("Stops animations, cleans up systems,
removes canvases") to pause, `mount()` (idempotent, recreates canvases) to resume. Avoids
the private `startAnimation`/`stopAnimation`, so it is version-safe across package updates.

## Components

1. **`src/lib/shared/background/shared/state/background-suppression.svelte.ts`** (new)
   - `$state` holding the active suppressor keys.
   - `suppressBackground(key)` / `releaseBackground(key)` — idempotent add/remove.
   - `isBackgroundSuppressed.current` — getter, true when any suppressor active.

2. **`src/lib/shared/background/shared/components/BackgroundHost.svelte`** (edit)
   - Single `$effect` owns mount/unmount/setBackground based on suppression + props:
     - suppressed → `controller.unmount()` if mounted.
     - not suppressed → `mount()` + re-patch resolution + `setBackground(...)`.
   - `onDestroy` unchanged (controller still persists for HMR).

3. **`src/lib/features/museum/MuseumModule.svelte`** (edit)
   - `onMount`: `suppressBackground("museum")`.
   - cleanup: `releaseBackground("museum")` (alongside existing sidebar restore + village teardown).

## Data flow

MuseumModule mount → `suppressBackground("museum")` → store active → BackgroundHost `$effect`
re-runs → `controller.unmount()` → rAF stops → main thread freed → flip is smooth.
MuseumModule destroy → `releaseBackground("museum")` → store empty → `$effect` re-runs →
`controller.mount()` + `setBackground` → ocean resumes on the rest of the app.

## Verification

- Capture a second flip trace with the fix: `updateTentaclePhysics` self-time should drop
  to ~0 while in the museum; the ~350ms ocean burst gone.
- Visually: leave museum → ocean background resumes elsewhere.
- A/B sanity already available: ocean vs autumn theme freeze contrast.

## Future opt-in (not built now)

3D sequence viewer fullscreen (`Viewer3DFullscreen.svelte`) and Retro module can each call
`suppressBackground(key)` on mount with one line when confirmed to occlude.
