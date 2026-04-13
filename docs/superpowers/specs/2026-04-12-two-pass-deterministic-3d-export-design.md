# Two-Pass Deterministic 3D Video Export

> **For agentic workers:** This is a design spec. Use `superpowers:writing-plans` to create the implementation plan.

**Goal:** Replace real-time RAF-based 3D video capture with a two-pass system: the user performs live camera work (pass 1), then the system renders every frame deterministically at full quality (pass 2). Output quality is independent of real-time scene performance.

**Why:** Real-time capture duplicates frames when the scene renders below the target FPS. The collision lab scene renders at ~8.5fps, producing 3-4 copies of each visual frame to fill a 30fps export. The animation looks stuttery and the camera movement is choppy. No amount of encoder optimization can fix this — the problem is at the capture level.

---

## Architecture Overview

```
Pass 1: Camera Performance Recording
  User watches animation play at real-time speed
  Camera transforms sampled at 60Hz (independent of render FPS)
  Output: CameraKeyframeBuffer (~100KB for 30s)

Pass 2: Deterministic Offline Render
  For each export frame:
    1. Set animation time deterministically (frameIndex / fps)
    2. Interpolate camera from recorded keyframes
    3. Tick effects with correct dt = 1/fps
    4. Force single render via Three.js renderer
    5. Capture frame, feed to encoder
  Output: MP4 via BackgroundVideoEncoder (existing)
```

---

## Pass 1: Camera Performance Recording

### CameraKeyframeBuffer

A lightweight in-memory buffer that stores camera state samples during the user's live "directing" session.

**Sample format:**

```typescript
interface CameraKeyframe {
  /** Seconds since recording started */
  timestamp: number;
  /** Camera world position */
  position: [number, number, number];
  /** Camera orientation as quaternion (avoids gimbal lock) */
  quaternion: [number, number, number, number];
  /** Field of view in degrees */
  fov: number;
}
```

13 numbers per sample. At 60Hz for 30 seconds = 1,800 samples = ~100KB.

**Sampling strategy:**

Sample at a fixed 60Hz via `setInterval`, not tied to RAF or render rate. Camera transforms update on pointer events (OrbitControls), not on render frames, so we capture smooth camera input even when the scene renders at 8.5fps. The recorded keyframes are denser than the render rate, producing smoother interpolated camera motion in pass 2 than the user actually saw live.

**Sampling source:**

Read the Three.js camera's `position`, `quaternion`, and `fov` directly. These are always current because OrbitControls updates them on every pointer event.

**Lifecycle:**

1. User hits "Record" — `CameraKeyframeBuffer.startRecording(camera)` begins sampling
2. Animation plays at normal speed, user orbits/zooms freely
3. Animation ends or user stops — `CameraKeyframeBuffer.stopRecording()` halts sampling
4. Buffer is passed to pass 2

Buffer lives in memory only. No persistence. Re-recording replaces the buffer. Future: save/load camera performances to enable re-export at different quality settings.

### CameraKeyframeInterpolator

Given a `CameraKeyframeBuffer` and a target timestamp, produces the interpolated camera state.

**Interpolation methods:**

- **Position:** Linear lerp between bracketing keyframes
- **Orientation:** Spherical lerp (slerp) for smooth rotation
- **FOV:** Linear lerp

Linear/slerp faithfully reproduces what the user did. Future upgrade: optional Catmull-Rom spline smoothing for cinematic camera paths.

**Edge cases:**

- `t < firstKeyframe.timestamp`: clamp to first keyframe
- `t > lastKeyframe.timestamp`: clamp to last keyframe
- Single keyframe: static camera (valid for "set angle then export" workflow)

---

## Pass 2: Deterministic Offline Render

### OfflineRenderLoop

The core export driver. Replaces `Realtime3DExporter` for 3D exports.

**Algorithm:**

```
pause Threlte auto-render
disable PlaybackState RAF loop

for frameIndex in 0..totalFrames:
    animationTime = frameIndex / targetFps
    currentStep = animationTime * beatsPerSecond

    // 1. Set animation state
    for each performer:
        beatIndex = floor(currentStep)
        subBeatProgress = currentStep - beatIndex
        performer.goToStep(beatIndex)
        performer.setProgress(subBeatProgress)

    // 2. Set camera from keyframes
    camera.position = interpolatePosition(animationTime)
    camera.quaternion = interpolateQuaternion(animationTime)
    camera.fov = interpolateFov(animationTime)
    camera.updateProjectionMatrix()

    // 3. Tick effects with correct delta
    effectOrchestrator.update(dt = 1 / targetFps)

    // 4. Force render
    renderer.render(scene, camera)

    // 5. Capture and encode
    frame = capturer.capture(canvas, timestampMicros)
    encoder.addFrameCaptured(frame, frameIndex, isKeyframe)

    // 6. Yield to event loop (keeps UI responsive)
    await scheduler.yield()  // or setTimeout(0)

    // 7. Report progress
    onProgress(frameIndex / totalFrames)

re-enable PlaybackState RAF loop
re-enable Threlte auto-render
finalize encoder -> MP4 blob
```

### Main Thread Responsiveness

Rendering 300 frames at 117ms each = ~35 seconds. Without yielding, the UI would freeze. After each frame, we yield to the event loop via `scheduler.yield()` (or `setTimeout(resolve, 0)` as fallback). This lets the browser:

- Paint progress bar updates
- Handle cancel button clicks
- Process other events

Cost: ~4ms overhead per frame = ~1.2 seconds total for a 300-frame export. Acceptable.

### Pausing Threlte

During pass 2, Threlte's built-in render loop must not run — we're calling `renderer.render()` manually. Two mechanisms:

1. Set `autoRender = false` on the Threlte renderer context (if Threlte exposes this)
2. Alternatively, disable the `useTask` hooks that drive the puppet loop by setting a reactive `isExporting` flag that the scene checks

The scene components (`Viewer3DScene`, `Avatar3D`) check `isExporting` and skip their `useTask` bodies when true. The offline loop calls their update logic directly with deterministic parameters instead.

### Bypassing vs. Reusing Scene Components

The offline loop must produce the exact same visual output as live rendering. This means we must reuse the same code paths, not duplicate them:

- **PropStateInterpolator:** Same instance, same `calculatePropState(config, progress)` call
- **AvatarAnimator:** Same IK solver, same blend logic. Called with the deterministic `delta = 1/fps`
- **Effects:** Same renderers, same update logic. Called with `dt = 1/fps`
- **Formation transitions:** Same `performerManager.updateFormationTransition()` logic

The offline loop is an alternative *driver* of the existing render pipeline, not a parallel implementation.

---

## Prerequisite: Effects Delta-Time Fix

### Current Problem

`EffectOrchestrator3D.svelte` hardcodes `dt = 1/60` (line ~330) regardless of actual frame rate. This causes:

- At 8.5fps: effects receive 16.7ms delta when 117ms actually passed. Particles move 7x slower than they should. Fire barely responds to velocity.
- At 60fps: effects happen to be correct by coincidence.

This bug exists in live playback today, independent of export.

### Fix

Make `dt` a parameter that the caller provides:

- **Live playback:** Pass real delta from RAF timestamp differences
- **Offline render:** Pass deterministic `1/targetFps`

Specific per-effect fixes:

| Effect | Current Behavior | Fix |
|--------|-----------------|-----|
| **Trails** | Timestamps use `performance.now()` — frame-rate independent | For offline: use deterministic timestamp (`frameIndex / fps * 1000`) instead of wall clock |
| **LED ring buffer** | Capacity in frame-count (32 frames) — persists 3.7x longer at low FPS | Convert to time-based eviction: drop entries older than `maxTrailDuration` seconds |
| **Fire** | Velocity smoothing EMA uses fixed constant per frame — different response at different FPS | Receives real `dt`, EMA factor becomes `1 - Math.pow(1 - SMOOTHING, dt * 60)` to be frame-rate independent |
| **Charcoal** | Particle physics uses `safeDt` but receives hardcoded `1/60` | Receives real `dt`. Clamp to `1/15` as existing safeguard against spiral-of-death |

### Trail Point Density

Trails add one point per frame. At 8.5fps live, trails are sparse (8.5 points/sec). At 30fps in pass 2, trails are dense (30 points/sec). This is the correct behavior — the export produces higher-quality trails than live preview, which is the whole point.

---

## Integration Points

### Existing Infrastructure Reused

- **BackgroundVideoEncoder** — Pass 2 feeds frames through the existing encoder worker. No changes needed.
- **CanvasFrameCapturer** — Same VideoFrame/ImageData capture. No changes needed.
- **ExportDiagnostics** — Adapt to report offline render timing instead of RAF intervals.
- **Video export UI** — Same progress bar, cancel button. Different stages: "Recording camera..." then "Rendering frames...".

### New Components

| Component | Type | Location |
|-----------|------|----------|
| `CameraKeyframeBuffer` | Domain class | `src/lib/shared/video-export/domain/CameraKeyframeBuffer.ts` |
| `CameraKeyframeInterpolator` | Service | `src/lib/shared/video-export/services/implementations/CameraKeyframeInterpolator.ts` |
| `IOffline3DExporter` | Contract | `src/lib/shared/3d/services/contracts/IOffline3DExporter.ts` |
| `Offline3DExporter` | Service | `src/lib/shared/3d/services/implementations/Offline3DExporter.ts` |

### Modified Components

| Component | Change |
|-----------|--------|
| `EffectOrchestrator3D.svelte` | Accept `dt` parameter instead of hardcoding `1/60` |
| `TrailRenderer3D` | Accept deterministic timestamp parameter for offline mode |
| `LedRenderer3D` / `LedTrailRing` | Time-based eviction instead of frame-count capacity |
| `FireRenderer3D` | Frame-rate-independent EMA smoothing |
| `CharcoalRenderer3D` | Receive real `dt` (already mostly correct, just needs real input) |
| `Viewer3DScene.svelte` | `isExporting` flag to skip `useTask` body during offline render |
| `Avatar3D.svelte` | Same `isExporting` gate |
| `PlaybackState` | Expose `pause()`/`resume()` for export to stop RAF loop |
| Export UI components | Two-stage UX: "Recording..." then "Rendering..." |

### Removed Components (after migration)

| Component | Reason |
|-----------|--------|
| `Realtime3DExporter` | Replaced by `Offline3DExporter` |
| `IRealtime3DExporter` | Replaced by `IOffline3DExporter` |

---

## Export UX Flow

### User Journey

1. User is viewing a 3D sequence (compose tab, sequence viewer, collision lab, etc.)
2. User positions camera to their liking
3. User opens export modal, selects resolution/fps/loops
4. User clicks "Record Export"
5. **Pass 1 begins:** Animation plays at normal speed. Badge shows "Recording camera... (orbit freely)". User orbits/zooms as desired. Timer shows elapsed/total time.
6. Animation completes (or user clicks stop early)
7. **Pass 2 begins automatically:** Progress bar shows "Rendering frame 147/300". Cancel button available. Scene appears frozen (auto-render disabled).
8. Pass 2 completes — video download triggers. Scene resumes normal interaction.

### "Quick Export" Shortcut

If the user doesn't need custom camera work (they just want the current angle), skip pass 1 entirely:

- Record a single keyframe of the current camera state
- Jump straight to pass 2

This covers the common "export from this angle" use case without forcing a real-time wait. The export modal can offer both: "Export (current angle)" and "Record (with camera control)".

---

## Diagnostics

Adapt `ExportDiagnostics` for offline mode:

```
=== Export Diagnostics (Offline) ===
Config: 1920x1080 @ 30fps, 300 frames
Capture path: video-frame

Render: p50=112ms, p95=135ms, max=180ms per frame
Yield overhead: p50=4ms, p95=8ms
Capture: p50=0.3ms, p95=1.2ms
Encode post: p50=0.1ms, p95=0.2ms

Total wall time: 38.2s for 10.0s of video (3.82x real-time)
Camera keyframes: 1,800 samples over 30.0s (60Hz)
```

---

## Future Upgrades (Not In Scope)

These are enabled by this architecture but not built now:

- **OffscreenCanvas worker rendering:** Move the Three.js renderer to a worker for true UI-parallel export. Requires scene graph transfer — big project.
- **Camera path editing:** Load the keyframe buffer into a timeline editor. Add easing, insert keyframes, trim sections.
- **Camera path persistence:** Save/load camera performances. Re-export at different resolutions without re-recording.
- **Catmull-Rom interpolation:** Smoother camera paths than linear lerp. Optional upgrade to the interpolator.
- **Multi-angle export:** Record multiple camera performances, export each as a separate video from the same animation.
- **Live preview during pass 2:** Show the render in a small PIP window as frames complete. Nice-to-have, not essential.
- **Use case B (full interaction recording):** Record not just camera but also effect toggles, beat scrubbing, settings changes. Requires recording a broader input stream, but the playback architecture is the same.
