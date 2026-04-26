# Unified Fast Pixel Export Path — Design

**Date:** 2026-04-11
**Status:** Draft for review
**Phase:** Video export refactor — Phase 1 of 4
**Depends on:** 3D Effect Parameter Parity (Phase A, shipped 2026-04-11)

---

## 1. Problem

Both the 2D and 3D video export pipelines currently route every frame through a
synchronous `getImageData()` call on the main thread. At high resolutions this
is catastrophic:

- One 4K frame = 3840 × 2160 × 4 = **33.2 MB** of raw RGBA.
- At 30 fps that's **996 MB/s** copied through main-thread memory.
- Over a 10-second export: **~10 GB** of transient allocations, with GC
  pauses, blocked compositing, and stalled encoder throughput.

**Observed symptoms (2026-04-11):**

- 3D exporter: 1080p at 60 fps stutters and produces duplicated frames. 4K at
  30 fps is slow and choppy. The bottleneck is `offCtx.drawImage(webglCanvas)`
  followed by `offCtx.getImageData()` in `Realtime3DExporter.ts:117-118`.
- 2D exporter: 4K at any frame rate is painfully slow. Same root cause in
  `VideoExportOrchestrator.ts:639` and `641-646`, even though the 2D pipeline
  is already deterministic/offline and doesn't have the real-time sampling
  problem the 3D side has.

Both exporters terminate at the same `BackgroundVideoEncoder` worker, which
currently accepts only `ImageData`. That worker is the seam where the fix can
be shared across both pipelines.

## 2. Goals

- **Eliminate the main-thread pixel copy.** Move to zero-copy transferable
  frame handles so the main thread never touches raw pixel bytes in the happy
  path.
- **Unify 2D and 3D on the same capture helper.** One `CanvasFrameCapturer`
  service, DI-registered, used by both exporters. Future pipelines (image
  export, reel generator, promo video) get the same fast path for free.
- **Use the 2026-current browser capabilities.** Prefer WebCodecs `VideoFrame`
  from canvas; fall back to `createImageBitmap` for non-WebCodecs platforms.
  Keep `getImageData` only as a deprecated safety net during the migration,
  then delete it in a follow-up commit.
- **Ship as a single focused phase.** One session, three callsites, one new
  service, one worker protocol change. Each existing exporter migrates
  independently and keeps the legacy path alive until its new path lands.

## 3. Non-goals

- **Not decoupling 3D export from real-time playback.** The 3D exporter still
  samples the canvas during real-time playback in this phase. Decoupling
  (deterministic manual-timestep export) is Phase 2.
- **Not introducing OffscreenCanvas in a worker.** Rendering the entire scene
  off the main thread is a separate architectural change and is potential
  Phase 4 work.
- **Not switching the default output codec.** H.264 remains the default for
  universal playback. The architecture must allow a future AV1 opt-in but we
  don't ship it in this phase.
- **Not changing the animation engine seek API.** The new capture path is
  orthogonal to how frames are *produced* — it only changes how they're
  transported from canvas to encoder.

## 4. Architecture overview

One new service, one shared type, one worker protocol update, and two call-site
migrations.

```
src/lib/shared/video-export/
├── domain/
│   └── CapturedFrame.ts              [NEW] discriminated union type
├── services/
│   ├── contracts/
│   │   └── ICanvasFrameCapturer.ts   [NEW] interface
│   └── implementations/
│       └── CanvasFrameCapturer.ts    [NEW] capability-detected capture
src/lib/features/compose/services/
├── contracts/
│   └── IBackgroundVideoEncoder.ts    [MOD] addFrame signature widened
└── implementations/
    ├── BackgroundVideoEncoder.ts     [MOD] worker message protocol
    └── workers/
        └── video-encoder-worker.ts   [MOD] worker message handler
src/lib/shared/3d/services/implementations/
└── Realtime3DExporter.ts             [MOD] route through capturer
src/lib/features/compose/services/implementations/
└── VideoExportOrchestrator.ts        [MOD] route through capturer
src/lib/shared/di/containers/
└── video-export-container.ts         [NEW or MOD] register capturer
```

## 5. The `CapturedFrame` type

A tagged union that represents a captured frame in any of the three transport
forms. Each variant carries the timestamp and dimensions alongside the handle
so the encoder worker has everything it needs without peeking inside the
handle.

```ts
// src/lib/shared/video-export/domain/CapturedFrame.ts

export type CapturedFrame =
  | {
      readonly kind: "video-frame";
      readonly frame: VideoFrame;
      readonly timestampMicros: number;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly kind: "image-bitmap";
      readonly bitmap: ImageBitmap;
      readonly timestampMicros: number;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly kind: "image-data";
      readonly data: ImageData;
      readonly timestampMicros: number;
      readonly width: number;
      readonly height: number;
    };
```

Why a tagged union and not a single unified type: each underlying handle has
different ownership semantics (`VideoFrame` requires `.close()`,
`ImageBitmap` also requires `.close()`, `ImageData` is GC'd). The tag tells
the worker how to drive the lifecycle correctly.

## 6. The `CanvasFrameCapturer` service

Interface:

```ts
// src/lib/shared/video-export/services/contracts/ICanvasFrameCapturer.ts

export interface ICanvasFrameCapturer {
  /**
   * Capture a single frame from the given canvas as a zero-copy transferable
   * handle. Returns the best handle the browser supports, in this order of
   * preference: VideoFrame > ImageBitmap > ImageData.
   *
   * Implementations must ensure the canvas has flushed its current draw
   * before returning — for WebGL canvases this means preserveDrawingBuffer
   * must be true on the underlying context.
   */
  capture(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    timestampMicros: number
  ): Promise<CapturedFrame>;

  /**
   * Returns which capture backend this instance will use at runtime.
   * Exposed for diagnostics/telemetry and for the encoder to decide
   * whether it can skip the wrap-in-VideoFrame step.
   */
  readonly preferredKind: "video-frame" | "image-bitmap" | "image-data";
}
```

Implementation strategy:

```ts
// src/lib/shared/video-export/services/implementations/CanvasFrameCapturer.ts

export class CanvasFrameCapturer implements ICanvasFrameCapturer {
  readonly preferredKind: CapturedFrame["kind"];

  constructor() {
    // Capability detection once at construction. VideoFrame is the fastest
    // path; it's supported in all modern browsers as of 2023-2024 (Safari
    // 16.4+, Chrome 94+, Edge 94+, Firefox 133+). By April 2026 every
    // currently-supported user agent has it.
    if (typeof globalThis.VideoFrame !== "undefined") {
      this.preferredKind = "video-frame";
    } else if (typeof globalThis.createImageBitmap !== "undefined") {
      this.preferredKind = "image-bitmap";
    } else {
      // Shouldn't happen on any browser we support; kept as a safety net.
      this.preferredKind = "image-data";
    }
  }

  async capture(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    timestampMicros: number
  ): Promise<CapturedFrame> {
    const width = canvas.width;
    const height = canvas.height;

    if (this.preferredKind === "video-frame") {
      const frame = new VideoFrame(canvas, { timestamp: timestampMicros });
      return { kind: "video-frame", frame, timestampMicros, width, height };
    }

    if (this.preferredKind === "image-bitmap") {
      const bitmap = await createImageBitmap(canvas);
      return { kind: "image-bitmap", bitmap, timestampMicros, width, height };
    }

    // Legacy fallback — creates a throwaway 2D context to pull ImageData.
    // This path is only for environments without VideoFrame AND without
    // createImageBitmap, which shouldn't exist in 2026. Keeping it so the
    // migration is safe and can be removed in a follow-up.
    const ctx = (canvas as HTMLCanvasElement).getContext("2d");
    if (!ctx) {
      throw new Error(
        "CanvasFrameCapturer: no supported capture backend and canvas has no 2D context"
      );
    }
    const data = ctx.getImageData(0, 0, width, height);
    return { kind: "image-data", data, timestampMicros, width, height };
  }
}
```

## 7. Worker protocol changes

`BackgroundVideoEncoder.addFrame` changes signature from
`(imageData, frameIndex, timestampMicros, isKeyframe)` to
`(frame: CapturedFrame, frameIndex, isKeyframe)`. Timestamp moves into the
frame because every transport form already carries it.

On the main-thread side of the bridge, `postMessage` must include the right
transferable:

```ts
// BackgroundVideoEncoder.ts — addFrame()

switch (frame.kind) {
  case "video-frame":
    this.worker.postMessage(
      { type: "frame", frame, frameIndex, isKeyframe },
      [frame.frame]
    );
    break;
  case "image-bitmap":
    this.worker.postMessage(
      { type: "frame", frame, frameIndex, isKeyframe },
      [frame.bitmap]
    );
    break;
  case "image-data":
    this.worker.postMessage(
      { type: "frame", frame, frameIndex, isKeyframe },
      [frame.data.data.buffer]
    );
    break;
}
```

On the worker side, the message handler branches by `frame.kind` and funnels
everything into a single `VideoEncoder.encode()` call with strict lifecycle:

```ts
// video-encoder-worker.ts

async function handleFrame(msg: FrameMessage) {
  let videoFrame: VideoFrame;

  try {
    switch (msg.frame.kind) {
      case "video-frame":
        // Zero-wrap fast path — the frame is already a VideoFrame.
        videoFrame = msg.frame.frame;
        break;

      case "image-bitmap":
        videoFrame = new VideoFrame(msg.frame.bitmap, {
          timestamp: msg.frame.timestampMicros,
        });
        // The VideoFrame holds a ref to the bitmap until .close() is called.
        // We close the bitmap after encode() to release GPU memory early.
        break;

      case "image-data":
        videoFrame = new VideoFrame(msg.frame.data, {
          timestamp: msg.frame.timestampMicros,
          codedWidth: msg.frame.width,
          codedHeight: msg.frame.height,
          format: "RGBA",
        });
        break;
    }

    encoder.encode(videoFrame, { keyFrame: msg.isKeyframe });
  } finally {
    // Invariant: every VideoFrame we create or receive must be closed
    // exactly once. Encoder.encode() does NOT close the input frame —
    // ownership stays with the caller.
    videoFrame!.close();

    // Also close the source bitmap if we wrapped one — VideoFrame.close()
    // does not cascade to the wrapped ImageBitmap.
    if (msg.frame.kind === "image-bitmap") {
      msg.frame.bitmap.close();
    }
  }
}
```

The `try/finally` discipline is non-negotiable — leaking even one VideoFrame
per frame at 60 fps would exhaust GPU memory within minutes.

## 8. Encoder hardware acceleration

While we're touching the encoder config, explicitly opt into hardware
encoding:

```ts
encoder.configure({
  codec: "avc1.42E01F", // H.264 baseline, unchanged
  width,
  height,
  bitrate,
  framerate: fps,
  hardwareAcceleration: "prefer-hardware", // [NEW] verify this is set
});
```

If it's already set in the current code, this is a no-op; if it isn't, this
alone may materially improve encode speed on M1/M2/M3 Macs and modern Intel
rigs. Cheap to verify, free to keep.

## 9. Call site migrations

### 9.1. `Realtime3DExporter.ts`

Replace:

```ts
// BEFORE — two operations fused together
offCtx.drawImage(webglCanvas, 0, 0, width, height);        // scale (fast, GPU)
const imageData = offCtx.getImageData(0, 0, width, height);// readback (slow, CPU)
const timestampMicros = Math.round((frameIndex / fps) * 1_000_000);
this.backgroundEncoder.addFrame(imageData, frameIndex, timestampMicros, isKeyframe);
```

With:

```ts
// AFTER — keep the scale step, replace the readback.
// `offscreen` is the local HTMLCanvasElement created at export init and
// sized to the target width/height; `offCtx` is its 2D context.
offCtx.drawImage(webglCanvas, 0, 0, width, height);
const timestampMicros = Math.round((frameIndex / fps) * 1_000_000);
const frame = await this.capturer.capture(offscreen, timestampMicros);
this.backgroundEncoder.addFrame(frame, frameIndex, isKeyframe);
```

**Why we keep the `offCtx` scaling step:** WebCodecs `VideoEncoder` requires
every input `VideoFrame` to match its configured `width`/`height`. If the
user picks "4K export" but the live WebGL canvas is 1080p, the encoder will
reject native-sized frames. So we still need a scaling step between the
live canvas and the encoder.

The old pipeline did that scaling via `drawImage(webglCanvas → offCtx, …, w, h)`
— and that step was actually *fast*, because drawImage from one canvas to
another is a GPU-accelerated blit in modern browsers. The expensive step was
`getImageData`, which forces a full GPU→CPU pixel readback. By keeping
`drawImage` and swapping `getImageData` for `capturer.capture(offscreenCanvas)`,
we preserve the scaling behavior and eliminate only the actual bottleneck.
The offscreen canvas stays on the GPU until the encoder pulls from it via
`new VideoFrame(offscreenCanvas)` or `createImageBitmap(offscreenCanvas)`,
which are zero-copy handoffs.

Consequence: no change to the aspect-ratio/resolution logic established
earlier in Phase A. Export width/height still derive from the live canvas
aspect at start, still land in `getExportDimensions()`, still size the
`offscreenCanvas`. Only the final readback step changes.

### 9.2. `VideoExportOrchestrator.ts`

Replace both `getImageData` paths (lines 639 and 641-646) with:

```ts
// AFTER
const timestampMicros = i * frameDurationMicros;
const canvasForCapture = needsResize && resizeCanvas ? resizeCanvas : offscreenCanvas;
const frame = await this.capturer.capture(canvasForCapture, timestampMicros);
this.backgroundEncoder.addFrame(frame, i, isKeyframe);
```

The 2D pipeline's existing `resizeCanvas` path is preserved — if a resize is
needed, the pre-resize `drawImage` still happens, then we capture the resize
canvas. The only thing that changes is the final readback: `getImageData` ->
`capturer.capture()`.

### 9.3. DI container wiring

Register `CanvasFrameCapturer` in the appropriate DI container (likely the
`compose-container` or a new `video-export-container`) as a singleton. Both
`Realtime3DExporter` and `VideoExportOrchestrator` consume it via constructor
injection.

## 10. Numerical impact

At 4K (3840×2160), comparing main-thread bytes touched per frame:

| Path | Main-thread bytes per frame | At 30 fps | At 60 fps |
|------|-----------------------------|-----------|-----------|
| Current (ImageData) | 33,177,600 | 995 MB/s | 1,990 MB/s |
| New (VideoFrame) | ~40 (handle + metadata) | ~1.2 kB/s | ~2.4 kB/s |
| New (ImageBitmap) | ~40 (handle + metadata) | ~1.2 kB/s | ~2.4 kB/s |

Four orders of magnitude less main-thread memory traffic. At 1080p the
absolute savings are smaller (~250 MB/s → handles) but the qualitative win —
no main-thread stall on pixel copies — applies equally.

Expected real-world results:

- **4K at 30 fps** transitions from "painfully slow" to "usable" for both
  pipelines.
- **1080p at 60 fps** on the 3D exporter becomes meaningfully smoother — it
  was already close to the edge with the old path.
- **1080p at 30 fps** is already fine today; this change won't make it
  noticeably faster because it wasn't bottlenecked there.

This is **not** the fix for the 120 fps / above-monitor-refresh-rate cap —
that's a separate problem (real-time sampling is RAF-bound) and is what
Phase 2's deterministic timestep model solves.

## 11. State-of-the-art evaluation

Things considered and rejected for this phase, for the record:

- **`HTMLCanvasElement.captureStream()` + `MediaStreamTrackProcessor`.**
  State-of-the-art for *live* canvas streaming to an encoder. Ties frame
  capture to wall-clock time via the MediaStream frame cadence — exactly
  what Phase 2 is trying to escape. Wrong fit for an offline
  deterministic export pipeline.

- **OffscreenCanvas rendering in a Worker.** The ultimate state-of-the-art:
  move all rendering off the main thread entirely. Would require switching
  Threlte's Canvas to an OffscreenCanvas via `transferControlToOffscreen()`
  and running the Three.js scene in a worker. Massive architectural change,
  touches every 3D component. Potential Phase 4 if profiling shows main
  thread is still a bottleneck after Phase 2.

- **AV1 as the default codec.** Hardware AV1 encoding is widespread in 2026
  silicon and produces better quality at lower bitrate. The architecture
  here makes it a one-line encoder config change to opt in. Not made the
  default because MP4 playback compatibility with H.264 is still broader,
  and some social platforms don't yet accept AV1 uploads. Revisit in a
  follow-up once telemetry shows the target audience has AV1-capable
  playback clients.

- **WebGPU for image-side processing (colorspace conversion, downscale).**
  Overkill for this phase — the WebCodecs encoder already handles format
  conversion internally on GPU. Revisit if we add custom post-processing
  (e.g. color grading during export).

Things adopted and shipped in this phase:

- **WebCodecs `VideoFrame` from canvas** — the primary capture path, zero-
  copy, GPU-resident.
- **`createImageBitmap` with transferable handoff** — the secondary path,
  ensures Safari and any non-WebCodecs fallback users still get zero-copy.
- **Explicit `hardwareAcceleration: "prefer-hardware"`** on the
  `VideoEncoder` config.
- **Structured ownership discipline** in the worker — every VideoFrame has
  a clear create/encode/close lifecycle.

## 12. Risks and open questions

1. **`preserveDrawingBuffer: true` on WebGL canvas.** Both `new VideoFrame`
   and `createImageBitmap` read the current framebuffer. For WebGL contexts
   without `preserveDrawingBuffer`, the framebuffer is cleared after
   presentation and the capture returns black. Already set in
   `Viewer3DCanvas.svelte:61` — verify no other 3D canvas mount point turns
   it off.

2. **VideoFrame lifetime leaks.** If the worker's encode path throws and the
   `finally` block doesn't fire (it always should, but), a leaked VideoFrame
   holds GPU memory until GC runs. At 60 fps a leak compounds fast. Mitigation:
   the `try/finally` pattern is the contract, and we add a unit test that
   intentionally throws mid-encode and asserts `VideoFrame.close()` was called.

3. **Canvas flush timing.** `new VideoFrame(webglCanvas)` captures the current
   backbuffer. If we call it before Three.js has flushed its draw for the
   current frame, we capture the previous frame. In the current real-time
   sampling model the `requestAnimationFrame` ordering handles this — the
   RAF callback fires after the browser's compositing for the frame — but
   it's worth a smoke test that exported frames match visible frames.

4. **Safari parity.** Safari 16.4+ supports `VideoFrame` construction from
   canvas. iOS 16.4 shipped March 2023, so by April 2026 effectively all
   supported iOS devices have it. The `createImageBitmap` fallback is
   insurance, not a required path.

5. **Resize handling.** For the 3D path, we currently render the WebGL canvas
   at viewport size and scale during capture. Removing the scaling drawImage
   means the export resolution must come from somewhere — either we render
   the WebGL canvas at the target export resolution for the duration of
   export, or we let the encoder downscale via VideoFrame crop/scale. Latter
   is cleaner; verify WebCodecs encoders accept differently-sized frames
   (they do, but check the existing config).

6. **Frame backpressure.** Currently the 3D exporter posts frames as fast as
   RAF fires and the worker queues them. With the fast path, frames arrive
   even faster and the worker queue could balloon. Not a regression — the
   current code has the same issue — but worth monitoring. Phase 3 addresses
   this formally with explicit backpressure.

## 13. Testing strategy

**Unit tests:**

- `CanvasFrameCapturer` capability detection — mock `globalThis.VideoFrame`
  and `createImageBitmap` presence and verify `preferredKind` matches.
- `CanvasFrameCapturer.capture()` — verify each branch returns the correct
  discriminated variant with correct metadata.
- Worker frame handler — dispatch each `CapturedFrame` variant, verify the
  encoder receives exactly one `encode()` call and exactly one `close()`
  per frame.
- Worker lifecycle — intentionally throw inside `encode()` and verify
  `.close()` still ran (covers the finally-block contract).

**Integration tests:**

- End-to-end 2D export at 1080p and 4K with the new path. Assert output file
  is a valid MP4 and has the expected duration / frame count.
- End-to-end 3D export at 1080p and 4K with the new path. Same assertions.
- Feature-flag the new path behind an env var so we can A/B the legacy
  `ImageData` path against the new path during rollout if needed. (Optional;
  delete after both exporters migrate.)

**Manual verification:**

- Export a 10-second 3D sequence at 4K/30. Observe no stuttering, sensible
  memory profile, visually correct output.
- Export a 10-second 2D sequence at 4K/30. Same.
- Export a 10-second 3D sequence at 1080p/60. Should be meaningfully smoother
  than before this phase.
- DevTools memory profile: confirm main-thread allocations for pixel data
  have dropped to near-zero.

## 14. Rollout

Single phase, one session. Sequencing inside the session:

1. Add `CapturedFrame` type and `CanvasFrameCapturer` service + interface.
   Write unit tests for capability detection and capture branches. Commit.
2. Widen the worker frame-message protocol to accept `CapturedFrame`. Keep
   the old `ImageData` signature alive with an internal adapter so nothing
   breaks mid-migration. Commit.
3. Migrate `Realtime3DExporter` to the new path. Smoke-test 3D export at
   1080p/30, 1080p/60, and 4K/30. Commit.
4. Migrate `VideoExportOrchestrator` to the new path. Smoke-test 2D export
   at 1080p/30, 1080p/60, and 4K/30. Commit.
5. Delete the legacy `ImageData` adapter path from the worker. Commit.
6. Run the full test suite + svelte-check. Fix any fallout. Commit.

Each step is independently reverseable and each commit leaves the app in a
working state. If any step fails the preceding commits can remain shipped.

## 15. Future phases (out of scope, for context)

- **Phase 2 — Deterministic timestep (offline render mode).** Decouple 3D
  export from real-time playback by calling
  `AnimationPlaybackController.seekToStep` (and
  `SequenceAnimationOrchestrator.calculateStateDurationAware`) in a manual
  loop, combined with Threlte's `renderMode: 'manual'` + `advance()`.
  Unlocks arbitrary FPS (60, 120, 240) at any resolution. Medium risk — no
  existing use of Threlte manual mode in the codebase.

  **Important tradeoff:** Phase 2 is *mutually exclusive with live camera
  manipulation during recording*. Since the exporter drives sequence time
  in a tight loop decoupled from wall clock, there's no "real time" for
  the user to interact with — camera motion has to be baked in before the
  export starts. Phase 2 should therefore ship as an *opt-in mode*
  alongside Phase 1's live-sampling path, not as a replacement. The UI
  becomes two named modes:

  - **"Record Live"** — Phase 1 path. Sample-as-you-play. Interactive
    camera, effects triggered mid-take, improvised performance. Capped at
    monitor refresh rate (~60 fps max). Good enough for almost all use
    cases.
  - **"Render Offline"** — Phase 2 path. Deterministic timestep, no
    interaction, arbitrary frame rate (120/240 fps slow-mo), mathematically
    smooth, reproducible. Camera path must be baked before export via
    keyframes or a saved camera track.

  Both modes share Phase 1's fast pixel pipeline — so the infrastructure
  this spec delivers is load-bearing for both.
- **Phase 3 — Backpressure and progress accuracy.** Explicit producer/
  consumer flow control between capture and encoder worker. Honest ETAs.
  Instant cancellation.
- **Phase 4 — OffscreenCanvas in worker.** Move Three.js scene rendering
  entirely off the main thread. Speculative; only pursued if Phase 2
  profiling shows main thread is still the bottleneck.

## 16. Success criteria

The phase ships when:

- [ ] 4K/30 3D export runs without stuttering on a reference 2024 laptop.
- [ ] 4K/30 2D export runs without stuttering on a reference 2024 laptop.
- [ ] 1080p/60 3D export produces a smoother video than the pre-phase
      baseline (side-by-side visual comparison).
- [ ] Main-thread memory allocation for pixel data drops to near zero in a
      DevTools memory profile of a 10-second export.
- [ ] No VideoFrame leaks over a 60-second test export (measured via GPU
      memory monitor).
- [ ] All existing video export unit and integration tests still pass.
- [ ] New unit tests for `CanvasFrameCapturer` and worker frame handler
      pass.
