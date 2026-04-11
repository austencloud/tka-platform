# Unified Fast Pixel Export Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the main-thread `getImageData()` readback on every exported frame so 4K/30 and 1080p/60 video exports stop stuttering on both the 2D and 3D pipelines.

**Architecture:** Introduce a single `CanvasFrameCapturer` service that wraps WebCodecs `VideoFrame` construction from a canvas (primary) with an `ImageData` fallback (legacy). The encoder worker gains a widened frame-message protocol that accepts either form and dispatches to the same `VideoEncoder.encode()` call, with strict `try/finally` lifecycle on every `VideoFrame`. Both `Realtime3DExporter` and `VideoExportOrchestrator` consume the capturer via DI; each migrates independently behind the widened protocol.

**Tech Stack:** TypeScript, Svelte 5, ITI DI, WebCodecs `VideoFrame` / `VideoEncoder`, `mp4-muxer`, Vite Web Workers, vitest.

**Spec:** `docs/superpowers/specs/2026-04-11-unified-fast-pixel-export-path-design.md`

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src/lib/shared/video-export/domain/CapturedFrame.ts` | NEW | Discriminated union type for captured frames |
| `src/lib/shared/video-export/services/contracts/ICanvasFrameCapturer.ts` | NEW | Capturer interface |
| `src/lib/shared/video-export/services/implementations/CanvasFrameCapturer.ts` | NEW | Capability-detected capturer impl |
| `tests/unit/video-export/CanvasFrameCapturer.test.ts` | NEW | Unit tests for capability detection + capture branches |
| `src/lib/features/compose/services/contracts/IBackgroundVideoEncoder.ts` | MOD | Widened `addFrame` signature |
| `src/lib/features/compose/services/implementations/BackgroundVideoEncoder.ts` | MOD | Branch by `CapturedFrame.kind` on postMessage |
| `src/lib/features/compose/workers/video-export.worker.ts` | MOD | New frame message variant, branch in handler, `hardwareAcceleration` config |
| `src/lib/shared/3d/services/implementations/Realtime3DExporter.ts` | MOD | Replace `getImageData` with `capturer.capture(offscreen)` |
| `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts` | MOD | Replace both `getImageData` call sites with capturer |
| `src/lib/shared/di/containers/animator-container.ts` | MOD | Register capturer, inject into 3D + 2D exporters |

## Architectural decisions locked in here

### Decision 1: Two-kind union, not three

The spec (section 6) lists three transport kinds: `video-frame`, `image-bitmap`, `image-data`. This plan implements only **two**: `video-frame` and `image-data`. The `image-bitmap` middle tier is dead code for our use case:

- Browsers that lack `VideoFrame` also use the **WASM** worker path (`h264-mp4-encoder`), which needs raw RGBA bytes via `addFrameRgba()`. An `ImageBitmap` would force a second readback inside the worker, making it slower than just doing `getImageData()` once on the main thread.
- As of April 2026, every mainstream browser that supports `createImageBitmap` also supports `VideoFrame` (Firefox 133+, Chrome 94+, Safari 16.4+, Edge 94+). The "ImageBitmap but not VideoFrame" window is empty.

The `CapturedFrame` type is a two-arm union: `video-frame | image-data`. If a future browser changes the matrix we can add the third arm, but shipping it now would be YAGNI.

### Decision 2: Capturer detection mirrors worker detection

The capturer picks `video-frame` if and only if `typeof globalThis.VideoFrame !== "undefined"` — the same check the worker uses to pick its WebCodecs path. This guarantees the main-thread capturer and the worker agree on which path to use, so the worker never receives a frame kind it can't consume.

### Decision 3: Scaling `drawImage` step stays

Both pipelines keep their existing GPU-accelerated `drawImage(source, 0, 0, width, height)` scale step onto an offscreen canvas. The encoder requires input frames at its configured width/height, and `drawImage` canvas→canvas is a fast GPU blit. Only the `getImageData` readback is replaced.

### Decision 4: Dual protocol during migration

The worker and encoder accept **both** the legacy `imageData` message and the new `frame` message simultaneously across Phase 2 and Phase 3. Each call site migrates in its own commit while the other keeps running on the legacy path. The legacy path is deleted as a final cleanup commit after both migrations ship.

---

## Phase 1: Infrastructure (new type, service, tests)

### Task 1: Add the `CapturedFrame` domain type

**Files:**
- Create: `src/lib/shared/video-export/domain/CapturedFrame.ts`

- [ ] **Step 1: Create the file with the discriminated union**

```ts
// src/lib/shared/video-export/domain/CapturedFrame.ts
/**
 * Captured Frame
 *
 * A frame that has been pulled from a canvas and is ready to hand to the
 * video encoder worker. Two transport forms are supported:
 *
 *   - "video-frame": a WebCodecs VideoFrame constructed directly from the
 *     canvas. Zero-copy, GPU-resident, preferred path. The receiver owns
 *     the VideoFrame and MUST call .close() exactly once.
 *   - "image-data": a legacy ImageData readback. Main-thread pixel copy,
 *     slow, only used on browsers that lack WebCodecs (Firefox <133).
 *
 * Timestamp and dimensions are carried alongside the handle so the worker
 * has everything it needs without peeking inside.
 */

export type CapturedFrame =
  | {
      readonly kind: "video-frame";
      readonly frame: VideoFrame;
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

- [ ] **Step 2: Verify the file compiles**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -i "CapturedFrame\|video-export" || echo "no errors"`
Expected: `no errors`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/video-export/domain/CapturedFrame.ts
git commit -m "feat(video-export): add CapturedFrame discriminated union"
```

---

### Task 2: Add the `ICanvasFrameCapturer` contract

**Files:**
- Create: `src/lib/shared/video-export/services/contracts/ICanvasFrameCapturer.ts`

- [ ] **Step 1: Create the interface file**

```ts
// src/lib/shared/video-export/services/contracts/ICanvasFrameCapturer.ts
import type { CapturedFrame } from "$lib/shared/video-export/domain/CapturedFrame";

/**
 * Canvas Frame Capturer
 *
 * Pulls a single frame from a canvas as the fastest transport form the
 * current browser supports. The returned CapturedFrame is the encoder's
 * input — the caller posts it through BackgroundVideoEncoder.addFrame()
 * which in turn transfers it to the encoding worker.
 *
 * Implementations must ensure the source canvas has flushed its current
 * draw before returning. For WebGL canvases the underlying context must
 * have preserveDrawingBuffer:true, otherwise the framebuffer is cleared
 * at presentation time and the capture returns black.
 */
export interface ICanvasFrameCapturer {
  /**
   * Which transport kind this capturer instance will produce at runtime,
   * chosen once at construction via capability detection.
   *
   * Exposed so callers and the encoder can telemeter or decide whether
   * to skip a wrap step. Callers that only consume the returned frame
   * do NOT need to branch on this value.
   */
  readonly preferredKind: "video-frame" | "image-data";

  /**
   * Capture a single frame from the given canvas.
   *
   * @param canvas  The source canvas. Its width/height determine the
   *                captured frame dimensions.
   * @param timestampMicros  Presentation timestamp in microseconds. The
   *                         encoder uses this to order frames in the muxer.
   */
  capture(
    canvas: HTMLCanvasElement,
    timestampMicros: number
  ): Promise<CapturedFrame>;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -i "ICanvasFrameCapturer" || echo "no errors"`
Expected: `no errors`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/video-export/services/contracts/ICanvasFrameCapturer.ts
git commit -m "feat(video-export): add ICanvasFrameCapturer contract"
```

---

### Task 3: Write failing unit tests for `CanvasFrameCapturer`

**Files:**
- Create: `tests/unit/video-export/CanvasFrameCapturer.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/video-export/CanvasFrameCapturer.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CanvasFrameCapturer } from "$lib/shared/video-export/services/implementations/CanvasFrameCapturer";

type Globals = {
  VideoFrame: unknown;
};

describe("CanvasFrameCapturer", () => {
  const originalVideoFrame = (globalThis as unknown as Globals).VideoFrame;

  afterEach(() => {
    (globalThis as unknown as Globals).VideoFrame = originalVideoFrame;
    vi.restoreAllMocks();
  });

  describe("capability detection", () => {
    it("picks video-frame when globalThis.VideoFrame exists", () => {
      (globalThis as unknown as Globals).VideoFrame = class FakeVideoFrame {};
      const capturer = new CanvasFrameCapturer();
      expect(capturer.preferredKind).toBe("video-frame");
    });

    it("picks image-data when globalThis.VideoFrame is undefined", () => {
      (globalThis as unknown as Globals).VideoFrame = undefined;
      const capturer = new CanvasFrameCapturer();
      expect(capturer.preferredKind).toBe("image-data");
    });
  });

  describe("capture()", () => {
    it("returns a video-frame CapturedFrame when VideoFrame is supported", async () => {
      const frameInstances: unknown[] = [];
      class FakeVideoFrame {
        readonly source: unknown;
        readonly timestamp: number;
        constructor(source: unknown, init: { timestamp: number }) {
          this.source = source;
          this.timestamp = init.timestamp;
          frameInstances.push(this);
        }
        close() {}
      }
      (globalThis as unknown as Globals).VideoFrame = FakeVideoFrame;

      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;

      const capturer = new CanvasFrameCapturer();
      const captured = await capturer.capture(canvas, 123456);

      expect(captured.kind).toBe("video-frame");
      expect(captured.width).toBe(640);
      expect(captured.height).toBe(480);
      expect(captured.timestampMicros).toBe(123456);
      if (captured.kind === "video-frame") {
        expect(captured.frame).toBeInstanceOf(FakeVideoFrame);
        expect(frameInstances).toHaveLength(1);
      }
    });

    it("returns an image-data CapturedFrame when VideoFrame is unavailable", async () => {
      (globalThis as unknown as Globals).VideoFrame = undefined;

      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 8;
      // Prime the 2D context so getImageData returns real data.
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, 16, 8);

      const capturer = new CanvasFrameCapturer();
      const captured = await capturer.capture(canvas, 999);

      expect(captured.kind).toBe("image-data");
      expect(captured.width).toBe(16);
      expect(captured.height).toBe(8);
      expect(captured.timestampMicros).toBe(999);
      if (captured.kind === "image-data") {
        expect(captured.data.width).toBe(16);
        expect(captured.data.height).toBe(8);
        expect(captured.data.data.length).toBe(16 * 8 * 4);
      }
    });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail with "Cannot find module"**

Run: `npx vitest run tests/unit/video-export/CanvasFrameCapturer.test.ts`
Expected: FAIL with `Cannot find module '.../CanvasFrameCapturer'` or `Failed to resolve import`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/unit/video-export/CanvasFrameCapturer.test.ts
git commit -m "test(video-export): add failing CanvasFrameCapturer tests"
```

---

### Task 4: Implement `CanvasFrameCapturer`

**Files:**
- Create: `src/lib/shared/video-export/services/implementations/CanvasFrameCapturer.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/shared/video-export/services/implementations/CanvasFrameCapturer.ts
import type { CapturedFrame } from "$lib/shared/video-export/domain/CapturedFrame";
import type { ICanvasFrameCapturer } from "../contracts/ICanvasFrameCapturer";

/**
 * Canvas Frame Capturer
 *
 * Picks the fastest transport path the browser supports and produces a
 * CapturedFrame ready to hand to the video encoder worker.
 *
 * Preference order (2026):
 *   1. WebCodecs VideoFrame from canvas — zero-copy GPU handoff. Used on
 *      Chrome 94+, Edge 94+, Safari 16.4+, Firefox 133+.
 *   2. ImageData readback — legacy main-thread copy. Only reached on
 *      Firefox <133 and ancient browsers, which also use the worker's
 *      WASM encode path.
 *
 * ImageBitmap is intentionally NOT an intermediate tier: no browser we
 * support has createImageBitmap without VideoFrame, and the worker's
 * WASM encoder can't consume an ImageBitmap without another readback.
 */
export class CanvasFrameCapturer implements ICanvasFrameCapturer {
  readonly preferredKind: "video-frame" | "image-data";

  constructor() {
    if (typeof (globalThis as { VideoFrame?: unknown }).VideoFrame !== "undefined") {
      this.preferredKind = "video-frame";
    } else {
      this.preferredKind = "image-data";
    }
  }

  async capture(
    canvas: HTMLCanvasElement,
    timestampMicros: number
  ): Promise<CapturedFrame> {
    const width = canvas.width;
    const height = canvas.height;

    if (this.preferredKind === "video-frame") {
      // Construct a VideoFrame directly from the canvas. The browser
      // keeps the pixel data GPU-resident and hands us a transferable
      // handle. VideoFrame requires .close() exactly once by the final
      // consumer — in this pipeline that's the worker after encode().
      const frame = new VideoFrame(canvas, { timestamp: timestampMicros });
      return { kind: "video-frame", frame, timestampMicros, width, height };
    }

    // Legacy path — forces a full GPU→CPU pixel readback. Only reached
    // on browsers without WebCodecs, which also use the WASM encoder in
    // the worker and therefore need raw RGBA bytes anyway.
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error(
        "CanvasFrameCapturer: cannot capture ImageData from a canvas without a 2D context"
      );
    }
    const data = ctx.getImageData(0, 0, width, height);
    return { kind: "image-data", data, timestampMicros, width, height };
  }
}
```

- [ ] **Step 2: Run the tests and verify they pass**

Run: `npx vitest run tests/unit/video-export/CanvasFrameCapturer.test.ts`
Expected: PASS, 4 tests passing.

- [ ] **Step 3: Run svelte-check for the new files**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "video-export|CapturedFrame|CanvasFrameCapturer" | head -20 || echo "no errors"`
Expected: `no errors` (or no lines matching).

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/video-export/services/implementations/CanvasFrameCapturer.ts
git commit -m "feat(video-export): implement CanvasFrameCapturer with VideoFrame/ImageData branches"
```

---

## Phase 2: Widen the encoder worker protocol

### Task 5: Widen the worker frame-message type (dual protocol)

**Files:**
- Modify: `src/lib/features/compose/workers/video-export.worker.ts` (FrameMessage type + switch statement)

- [ ] **Step 1: Add the import for `CapturedFrame`**

Open `src/lib/features/compose/workers/video-export.worker.ts`. After the existing `import { Muxer, ArrayBufferTarget } from "mp4-muxer";` line, add:

```ts
import type { CapturedFrame } from "$lib/shared/video-export/domain/CapturedFrame";
```

- [ ] **Step 2: Widen the `FrameMessage` interface**

Find the existing `FrameMessage` interface (around line 56) and replace it with a discriminated union. The old `imageData`-based variant stays so the 2D pipeline keeps working until its migration lands:

```ts
interface FrameMessageLegacy {
  type: "frame";
  imageData: ImageData;
  frameIndex: number;
  timestampMicros: number;
  isKeyframe: boolean;
}

interface FrameMessageCaptured {
  type: "frame-captured";
  frame: CapturedFrame;
  frameIndex: number;
  isKeyframe: boolean;
}

type FrameMessage = FrameMessageLegacy | FrameMessageCaptured;
```

- [ ] **Step 3: Narrow the existing legacy handlers to `FrameMessageLegacy`**

Find `function handleFrameWebCodecs(msg: FrameMessage): void` (around line 305) and change its signature to:

```ts
function handleFrameWebCodecs(msg: FrameMessageLegacy): void {
```

Find `function handleFrameWasm(msg: FrameMessage): void` (around line 400) and change its signature to:

```ts
function handleFrameWasm(msg: FrameMessageLegacy): void {
```

Rationale: both handlers access `msg.imageData`, which only exists on `FrameMessageLegacy`. Without narrowing the parameter types, TypeScript fails to compile because `msg.imageData` doesn't exist on `FrameMessageCaptured`.

- [ ] **Step 4: Verify build still compiles**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep "video-export.worker" || echo "no errors"`
Expected: `no errors`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/compose/workers/video-export.worker.ts
git commit -m "refactor(video-export): widen worker FrameMessage into discriminated union"
```

---

### Task 6: Add worker handler for the new `frame-captured` message

**Files:**
- Modify: `src/lib/features/compose/workers/video-export.worker.ts` (new handler + dispatcher branch)

- [ ] **Step 1: Add the captured-frame handler function**

After the existing `handleFrameWebCodecs(msg: FrameMessage)` function, add a new handler. Note: because we now have a union, rename existing uses to narrow explicitly. But to keep this task self-contained, add the new handler alongside and dispatch in `handleFrame()`:

```ts
function handleFrameCapturedWebCodecs(msg: FrameMessageCaptured): void {
  if (!encoder) return;

  let videoFrame: VideoFrame | null = null;
  try {
    if (msg.frame.kind === "video-frame") {
      // Fast path — the main thread handed us a ready-to-encode VideoFrame
      // constructed from the source canvas.
      videoFrame = msg.frame.frame;
    } else {
      // Fallback path — wrap the ImageData in a VideoFrame. This is only
      // reached when the main thread has no VideoFrame constructor at all,
      // which also means this worker should have taken the WASM branch;
      // we handle it here for safety but it should never fire in practice.
      videoFrame = new VideoFrame(msg.frame.data.data.buffer, {
        format: "RGBA",
        codedWidth: msg.frame.width,
        codedHeight: msg.frame.height,
        timestamp: msg.frame.timestampMicros,
        duration: frameDurationMicros,
      });
    }

    encoder.encode(videoFrame, { keyFrame: msg.isKeyframe });
  } finally {
    // Invariant: every VideoFrame the worker owns must be closed exactly
    // once. encoder.encode() does NOT take ownership — the caller closes.
    videoFrame?.close();
  }
}

function handleFrameCapturedWasm(msg: FrameMessageCaptured): void {
  if (!wasmEncoder) return;

  // WASM path needs raw RGBA bytes. A video-frame kind here means the
  // main thread incorrectly sent a GPU handle to a worker that can't
  // consume one — treat it as an error so the mismatch surfaces in tests.
  if (msg.frame.kind !== "image-data") {
    post({
      type: "error",
      error: "WASM encoder requires image-data frames; got video-frame",
    });
    return;
  }

  const paddedData = padRgbaData(
    msg.frame.data.data,
    msg.frame.width,
    msg.frame.height,
    encoderWidth,
    encoderHeight
  );

  wasmEncoder.addFrameRgba(paddedData);
}
```

- [ ] **Step 2: Branch the existing `handleFrame()` dispatcher on message type**

Find `function handleFrame(msg: FrameMessage)` (around line 463) and replace its body with:

```ts
function handleFrame(msg: FrameMessage): void {
  if (cancelled) return;

  if (msg.type === "frame-captured") {
    if (hasWebCodecs) {
      handleFrameCapturedWebCodecs(msg);
    } else {
      handleFrameCapturedWasm(msg);
    }
    post({ type: "progress", frameIndex: msg.frameIndex });
    return;
  }

  // Legacy imageData path — kept alive until both pipelines migrate.
  if (hasWebCodecs) {
    handleFrameWebCodecs(msg);
  } else {
    handleFrameWasm(msg);
  }

  post({ type: "progress", frameIndex: msg.frameIndex });
}
```

- [ ] **Step 3: Update the main message listener switch**

Find the `self.onmessage` switch (around line 503). The existing case `"frame"` should match both `"frame"` and `"frame-captured"` by routing both to `handleFrame`. Replace the `case "frame"` branch with:

```ts
      case "frame":
      case "frame-captured":
        handleFrame(msg);
        break;
```

Also update `ExportWorkerMessage` union (around line 72) so the listener accepts the new message. Find:

```ts
export type ExportWorkerMessage =
  | ConfigMessage
  | FrameMessage
  | FinishMessage
  | CancelMessage;
```

This already resolves to include both `FrameMessageLegacy` and `FrameMessageCaptured` because `FrameMessage` is now a union. No change needed here, but verify by reading the file.

- [ ] **Step 4: Verify build**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep "video-export.worker" || echo "no errors"`
Expected: `no errors`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/compose/workers/video-export.worker.ts
git commit -m "feat(video-export): worker handles CapturedFrame messages via VideoFrame path"
```

---

### Task 7: Opt into hardware-accelerated VideoEncoder

**Files:**
- Modify: `src/lib/features/compose/workers/video-export.worker.ts` (encoder.configure call)

- [ ] **Step 1: Add `hardwareAcceleration` to the configure call**

Find `handleConfigWebCodecs` (around line 267). Locate the `await encoder.configure({...})` block (around line 296) and add `hardwareAcceleration: "prefer-hardware"`:

```ts
  await encoder.configure({
    codec,
    width: encoderWidth,
    height: encoderHeight,
    bitrate: config.bitrate,
    framerate: config.fps,
    hardwareAcceleration: "prefer-hardware",
  });
```

- [ ] **Step 2: Verify build**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep "video-export.worker" || echo "no errors"`
Expected: `no errors`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/workers/video-export.worker.ts
git commit -m "perf(video-export): prefer hardware H.264 acceleration in encoder config"
```

---

### Task 8: Add `addFrameCaptured` to `IBackgroundVideoEncoder`

**Files:**
- Modify: `src/lib/features/compose/services/contracts/IBackgroundVideoEncoder.ts`

- [ ] **Step 1: Add the new method alongside the legacy one**

Open `src/lib/features/compose/services/contracts/IBackgroundVideoEncoder.ts`. Add the import and the new method. The legacy `addFrame(imageData, ...)` stays alive until Phase 6 cleanup.

Replace file contents with:

```ts
/**
 * Background Video Encoder Contract
 *
 * Coordinates with a Web Worker to perform WebCodecs encoding off the main
 * thread. The main thread captures frames and posts them to the worker,
 * which handles encoding and MP4 muxing without blocking the UI.
 */

import type { CapturedFrame } from "$lib/shared/video-export/domain/CapturedFrame";

export interface BackgroundExportConfig {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  totalFrames: number;
}

export interface IBackgroundVideoEncoder {
  /**
   * Spin up the worker and configure the encoder/muxer.
   * Resolves once the worker reports "ready".
   */
  initialize(config: BackgroundExportConfig): Promise<void>;

  /**
   * Post a pre-captured frame (VideoFrame or ImageData) to the worker
   * for encoding. The underlying transferable handle is transferred
   * zero-copy; the caller must not touch the frame after this call.
   *
   * This is the preferred path. `addFrame` (legacy) will be removed
   * after both export pipelines migrate.
   */
  addFrameCaptured(
    frame: CapturedFrame,
    frameIndex: number,
    isKeyframe: boolean
  ): void;

  /**
   * Legacy: post a single ImageData frame to the worker. The underlying
   * buffer is transferred zero-copy. Preserved during migration — new
   * call sites MUST use `addFrameCaptured`.
   *
   * @deprecated Use addFrameCaptured. Will be removed after the 2D and
   *             3D exporters migrate.
   */
  addFrame(
    imageData: ImageData,
    frameIndex: number,
    timestampMicros: number,
    isKeyframe: boolean
  ): void;

  /**
   * Signal that all frames have been sent. Resolves with the finished
   * MP4 blob once the worker flushes the encoder and finalizes the muxer.
   */
  finish(): Promise<Blob>;

  /**
   * Cancel the in-progress export and terminate the worker immediately.
   */
  cancel(): void;

  /**
   * Optional progress callback invoked each time the worker finishes
   * encoding a frame.
   */
  onProgress: ((frameIndex: number, totalFrames: number) => void) | null;
}
```

- [ ] **Step 2: Verify build (expect one error: BackgroundVideoEncoder missing addFrameCaptured)**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep "BackgroundVideoEncoder\|addFrameCaptured" | head -10`
Expected: One or more errors pointing at `BackgroundVideoEncoder.ts` not implementing `addFrameCaptured`. This is expected and fixed in the next task.

- [ ] **Step 3: Do NOT commit yet — build is red.** Proceed to Task 9.

---

### Task 9: Implement `addFrameCaptured` on `BackgroundVideoEncoder`

**Files:**
- Modify: `src/lib/features/compose/services/implementations/BackgroundVideoEncoder.ts`

- [ ] **Step 1: Add the import for `CapturedFrame`**

Open `src/lib/features/compose/services/implementations/BackgroundVideoEncoder.ts`. After the `import type { ExportWorkerMessage, ExportWorkerResponse } ...` line, add:

```ts
import type { CapturedFrame } from "$lib/shared/video-export/domain/CapturedFrame";
```

- [ ] **Step 2: Implement `addFrameCaptured` next to the legacy `addFrame`**

Find the existing `addFrame()` method (around line 77). Immediately after it, add:

```ts
  addFrameCaptured(
    frame: CapturedFrame,
    frameIndex: number,
    isKeyframe: boolean
  ): void {
    if (!this.worker) {
      // Worker was disposed (e.g., viewer closed during export). The export
      // loop will check shouldCancel on the next iteration and abort cleanly.
      // Release the frame handle ourselves so it doesn't leak.
      if (frame.kind === "video-frame") {
        frame.frame.close();
      }
      return;
    }

    // Branch by kind so postMessage transferables are correct. The worker
    // closes every VideoFrame after encode(); we close here only when the
    // worker is unreachable (see early-return above).
    if (frame.kind === "video-frame") {
      this.worker.postMessage(
        {
          type: "frame-captured",
          frame,
          frameIndex,
          isKeyframe,
        },
        [frame.frame]
      );
    } else {
      // image-data: transfer the underlying ArrayBuffer.
      this.worker.postMessage(
        {
          type: "frame-captured",
          frame,
          frameIndex,
          isKeyframe,
        },
        [frame.data.data.buffer]
      );
    }
  }
```

- [ ] **Step 3: Verify svelte-check is clean**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "BackgroundVideoEncoder|addFrameCaptured|video-export" | head -20 || echo "no errors"`
Expected: `no errors`

- [ ] **Step 4: Commit Tasks 8 + 9 together**

```bash
git add src/lib/features/compose/services/contracts/IBackgroundVideoEncoder.ts src/lib/features/compose/services/implementations/BackgroundVideoEncoder.ts
git commit -m "feat(video-export): add addFrameCaptured(CapturedFrame) alongside legacy addFrame"
```

---

## Phase 3: DI wiring

### Task 10: Register `CanvasFrameCapturer` in the animator container

**Files:**
- Modify: `src/lib/shared/di/containers/animator-container.ts`

- [ ] **Step 1: Add the import**

Near the top of `animator-container.ts`, alongside the `VideoExportOrchestrator` and `Realtime3DExporter` imports (around lines 47-62), add:

```ts
import { CanvasFrameCapturer } from "$lib/shared/video-export/services/implementations/CanvasFrameCapturer";
```

- [ ] **Step 2: Register the capturer in the container**

Find the `.add(() => ({ exportGlyphPrerenderer: ... }))` block (around line 152). Before it (so `canvasFrameCapturer` is available to the orchestrator/exporter `.add` blocks that consume it via `ctx.`), insert a new `.add`:

```ts
    .add(() => ({
      canvasFrameCapturer: () => new CanvasFrameCapturer(),
    }))
```

Important ordering: this new `.add` must appear **before** the `.add((ctx) => ({ videoExportOrchestrator: ... }))` and `.add((ctx) => ({ realtime3DExporter: ... }))` blocks, because ITI only surfaces earlier items to later `ctx` parameters.

- [ ] **Step 3: Verify build still compiles**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "animator-container|canvasFrameCapturer" | head -10 || echo "no errors"`
Expected: `no errors`

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/di/containers/animator-container.ts
git commit -m "feat(video-export): register CanvasFrameCapturer in animator container"
```

---

## Phase 4: Migrate `Realtime3DExporter`

### Task 11: Inject capturer into `Realtime3DExporter` constructor

**Files:**
- Modify: `src/lib/shared/3d/services/implementations/Realtime3DExporter.ts`
- Modify: `src/lib/shared/di/containers/animator-container.ts`

- [ ] **Step 1: Add the import and update the constructor**

Open `src/lib/shared/3d/services/implementations/Realtime3DExporter.ts`. After the existing import block (after `calculateBitrate`), add:

```ts
import type { ICanvasFrameCapturer } from "$lib/shared/video-export/services/contracts/ICanvasFrameCapturer";
```

Find the constructor (around line 32):

```ts
  constructor(private readonly backgroundEncoder: IBackgroundVideoEncoder) {}
```

Replace with:

```ts
  constructor(
    private readonly backgroundEncoder: IBackgroundVideoEncoder,
    private readonly capturer: ICanvasFrameCapturer
  ) {}
```

- [ ] **Step 2: Pass capturer in the DI registration**

Open `src/lib/shared/di/containers/animator-container.ts`. Find the `realtime3DExporter` registration (around line 167):

```ts
    .add((ctx) => ({
      realtime3DExporter: () =>
        new Realtime3DExporter(ctx.backgroundVideoEncoder),
    }))
```

Replace with:

```ts
    .add((ctx) => ({
      realtime3DExporter: () =>
        new Realtime3DExporter(
          ctx.backgroundVideoEncoder,
          ctx.canvasFrameCapturer
        ),
    }))
```

- [ ] **Step 3: Verify build**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "Realtime3DExporter|animator-container" | head -10 || echo "no errors"`
Expected: `no errors`

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/services/implementations/Realtime3DExporter.ts src/lib/shared/di/containers/animator-container.ts
git commit -m "refactor(video-export): inject CanvasFrameCapturer into Realtime3DExporter"
```

---

### Task 12: Switch `Realtime3DExporter` capture loop to `addFrameCaptured`

**Files:**
- Modify: `src/lib/shared/3d/services/implementations/Realtime3DExporter.ts`

- [ ] **Step 1: Replace the `getImageData` + `addFrame` block**

Find the inner `captureFrame` function, specifically the `while (frameIndex <= expectedFrame && frameIndex < totalFrames)` loop (around line 125). The current loop body reads:

```ts
          offCtx.drawImage(webglCanvas, 0, 0, width, height);
          const imageData = offCtx.getImageData(0, 0, width, height);

          const timestampMicros = Math.round((frameIndex / fps) * 1_000_000);
          const isKeyframe = frameIndex % KEYFRAME_INTERVAL === 0;

          this.backgroundEncoder.addFrame(imageData, frameIndex, timestampMicros, isKeyframe);
```

Replace with:

```ts
          // Scale the live WebGL canvas onto the offscreen canvas at the
          // export resolution. This is a GPU-accelerated canvas→canvas
          // blit; the expensive step was the following pixel readback,
          // which we now skip entirely by handing the offscreen canvas to
          // the capturer as a zero-copy handle.
          offCtx.drawImage(webglCanvas, 0, 0, width, height);

          const timestampMicros = Math.round((frameIndex / fps) * 1_000_000);
          const isKeyframe = frameIndex % KEYFRAME_INTERVAL === 0;

          // Freeze the current frameIndex into a local so the capture
          // promise resolves against the correct index even after the
          // RAF loop has incremented frameIndex below.
          const capturedIndex = frameIndex;

          // Fire-and-forget capture. On the VideoFrame path the promise
          // is effectively already-resolved — `new VideoFrame(canvas)` is
          // a synchronous constructor and the async wrapper in the
          // ICanvasFrameCapturer interface exists only for symmetry with
          // the ImageData fallback (whose `getImageData` is also synchronous
          // in practice). Frame ordering is preserved because postMessage
          // is synchronous and the worker processes messages in arrival
          // order, so fire-and-forget is safe here.
          //
          // We deliberately do NOT await inside the RAF tick. Awaiting
          // would push the next RAF callback past the next vsync and
          // drift the capture out of lockstep with live playback.
          void this.capturer
            .capture(offscreen, timestampMicros)
            .then((frame) => {
              this.backgroundEncoder.addFrameCaptured(
                frame,
                capturedIndex,
                isKeyframe
              );
            });
```

- [ ] **Step 2: Verify build**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep "Realtime3DExporter" | head -10 || echo "no errors"`
Expected: `no errors`

- [ ] **Step 3: Manual smoke test — 1080p/30**

Tell Austen: "Task 12 manual smoke test. Please open the 3D viewer, export a 10-second sequence at **1080p / 30 fps**. Confirm the exported MP4 plays cleanly, runs roughly the expected duration, and looks visually correct. Report any stutter, black frames, or aspect-ratio issues."

Wait for confirmation before proceeding.

- [ ] **Step 4: Manual smoke test — 1080p/60**

Tell Austen: "Next smoke test: export the same sequence at **1080p / 60 fps**. Confirm it's meaningfully smoother than the pre-phase baseline (roughly twice the frame density, no stutter)."

Wait for confirmation.

- [ ] **Step 5: Manual smoke test — 4K/30**

Tell Austen: "Final smoke test: export the sequence at **4K / 30 fps**. Confirm the export runs without stuttering, completes in a reasonable time, and the output video isn't choppy."

Wait for confirmation.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/services/implementations/Realtime3DExporter.ts
git commit -m "perf(video-export): 3D exporter uses CanvasFrameCapturer (zero-copy VideoFrame path)"
```

---

## Phase 5: Migrate `VideoExportOrchestrator`

### Task 13: Inject capturer into `VideoExportOrchestrator` constructor

**Files:**
- Modify: `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts`
- Modify: `src/lib/shared/di/containers/animator-container.ts`

- [ ] **Step 1: Add the import and update the constructor**

Open `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts`. After the existing `import type { IBackgroundVideoEncoder } from "../contracts/IBackgroundVideoEncoder";` line, add:

```ts
import type { ICanvasFrameCapturer } from "$lib/shared/video-export/services/contracts/ICanvasFrameCapturer";
```

Find the constructor (around line 46):

```ts
  constructor(
    private readonly VideoExporter: IVideoExporter,
    private readonly canvasRenderer: ICanvasRenderer,
    private readonly fileDownloadService: IFileDownloader,
    private readonly compositeRenderer: ICompositeVideoRenderer,
    private readonly glyphPrerenderer: IExportGlyphPrerenderer,
    private readonly backgroundEncoder: IBackgroundVideoEncoder
  ) {}
```

Replace with:

```ts
  constructor(
    private readonly VideoExporter: IVideoExporter,
    private readonly canvasRenderer: ICanvasRenderer,
    private readonly fileDownloadService: IFileDownloader,
    private readonly compositeRenderer: ICompositeVideoRenderer,
    private readonly glyphPrerenderer: IExportGlyphPrerenderer,
    private readonly backgroundEncoder: IBackgroundVideoEncoder,
    private readonly capturer: ICanvasFrameCapturer
  ) {}
```

- [ ] **Step 2: Pass capturer in the DI registration**

Open `src/lib/shared/di/containers/animator-container.ts`. Find the `videoExportOrchestrator` registration (around line 156):

```ts
    .add((ctx) => ({
      videoExportOrchestrator: () =>
        new VideoExportOrchestrator(
          ctx.videoExporter,
          ctx.canvasRenderer,
          externalDeps.fileDownloader,
          ctx.compositeVideoRenderer,
          ctx.exportGlyphPrerenderer,
          ctx.backgroundVideoEncoder
        ),
    }))
```

Replace with:

```ts
    .add((ctx) => ({
      videoExportOrchestrator: () =>
        new VideoExportOrchestrator(
          ctx.videoExporter,
          ctx.canvasRenderer,
          externalDeps.fileDownloader,
          ctx.compositeVideoRenderer,
          ctx.exportGlyphPrerenderer,
          ctx.backgroundVideoEncoder,
          ctx.canvasFrameCapturer
        ),
    }))
```

- [ ] **Step 3: Verify build**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "VideoExportOrchestrator|animator-container" | head -10 || echo "no errors"`
Expected: `no errors`

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts src/lib/shared/di/containers/animator-container.ts
git commit -m "refactor(video-export): inject CanvasFrameCapturer into VideoExportOrchestrator"
```

---

### Task 14: Switch 2D export loop to `addFrameCaptured`

**Files:**
- Modify: `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts` (lines 626-658)

- [ ] **Step 1: Replace the `getImageData`-based capture block**

Find the `if (useBackgroundEncoder) {` block inside the render loop (around line 626). The current body reads:

```ts
        if (useBackgroundEncoder) {
          // Extract ImageData, optionally resizing to export resolution first
          let frameData: ImageData;

          if (needsResize && resizeCtx && resizeCanvas) {
            resizeCtx.clearRect(0, 0, outputWidth, outputHeight);
            resizeCtx.drawImage(
              offscreenCanvas,
              0,
              0,
              outputWidth,
              outputHeight
            );
            frameData = resizeCtx.getImageData(0, 0, outputWidth, outputHeight);
          } else {
            frameData = offscreenCtx.getImageData(
              0,
              0,
              offscreenCanvas.width,
              offscreenCanvas.height
            );
          }

          const timestampMicros = i * frameDurationMicros;
          const isKeyframe = i % keyframeInterval === 0;

          // Transfer the buffer zero-copy to the worker
          this.backgroundEncoder.addFrame(
            frameData,
            i,
            timestampMicros,
            isKeyframe
          );
        } else if (inlineExporter) {
```

Replace with:

```ts
        if (useBackgroundEncoder) {
          // Pick the canvas to capture from. If a resize step is needed
          // (export resolution differs from render resolution) we first
          // blit onto the resize canvas — a fast GPU canvas→canvas draw —
          // and capture from there. Otherwise capture directly from the
          // render canvas.
          let canvasForCapture: HTMLCanvasElement;
          if (needsResize && resizeCtx && resizeCanvas) {
            resizeCtx.clearRect(0, 0, outputWidth, outputHeight);
            resizeCtx.drawImage(
              offscreenCanvas,
              0,
              0,
              outputWidth,
              outputHeight
            );
            canvasForCapture = resizeCanvas;
          } else {
            canvasForCapture = offscreenCanvas;
          }

          const timestampMicros = i * frameDurationMicros;
          const isKeyframe = i % keyframeInterval === 0;

          // Capture the frame via the unified capturer (VideoFrame on
          // modern browsers, ImageData fallback on Firefox <133). The
          // returned frame is transferred zero-copy to the encoder
          // worker by addFrameCaptured.
          const frame = await this.capturer.capture(
            canvasForCapture,
            timestampMicros
          );
          this.backgroundEncoder.addFrameCaptured(frame, i, isKeyframe);
        } else if (inlineExporter) {
```

Note: Unlike the 3D path, the 2D render loop is already `async` and sequential (not RAF-driven), so we can `await` the capture directly without interleaving worries.

- [ ] **Step 2: Verify build**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep "VideoExportOrchestrator" | head -10 || echo "no errors"`
Expected: `no errors`

- [ ] **Step 3: Manual smoke test — 2D export at 1080p/30**

Tell Austen: "Task 14 manual smoke test. Please export a 2D sequence (composer view, MP4 output) at **1080p / 30 fps**. Confirm the MP4 plays cleanly and matches what used to ship before this phase."

Wait for confirmation.

- [ ] **Step 4: Manual smoke test — 2D export at 4K/30**

Tell Austen: "Next: 2D export at **4K / 30 fps**. This is the big win — the old path took 'painfully slow' time at 4K. Confirm it now runs at roughly the expected rate without stuttering."

Wait for confirmation.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts
git commit -m "perf(video-export): 2D orchestrator uses CanvasFrameCapturer (zero-copy VideoFrame path)"
```

---

## Phase 6: Remove the legacy `addFrame(ImageData)` path

### Task 15: Delete legacy `addFrame` from interface and implementation

**Files:**
- Modify: `src/lib/features/compose/services/contracts/IBackgroundVideoEncoder.ts`
- Modify: `src/lib/features/compose/services/implementations/BackgroundVideoEncoder.ts`

- [ ] **Step 1: Remove `addFrame` from the interface**

Open `src/lib/features/compose/services/contracts/IBackgroundVideoEncoder.ts`. Delete the entire `@deprecated addFrame(...)` method declaration added in Task 8, leaving only `addFrameCaptured`, `initialize`, `finish`, `cancel`, and `onProgress`.

- [ ] **Step 2: Remove `addFrame` from the implementation**

Open `src/lib/features/compose/services/implementations/BackgroundVideoEncoder.ts`. Delete the entire `addFrame(imageData, frameIndex, timestampMicros, isKeyframe)` method (the legacy one that posts a `"frame"` message). Keep `addFrameCaptured` untouched.

- [ ] **Step 3: Verify svelte-check**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "addFrame|video-export" | head -20 || echo "no errors"`
Expected: `no errors`. Any remaining usage of `addFrame` (without `Captured`) is a bug — both call sites migrated in Phase 4 and Phase 5.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/compose/services/contracts/IBackgroundVideoEncoder.ts src/lib/features/compose/services/implementations/BackgroundVideoEncoder.ts
git commit -m "refactor(video-export): drop legacy addFrame(ImageData) from encoder interface"
```

---

### Task 16: Delete legacy `"frame"` message path from worker

**Files:**
- Modify: `src/lib/features/compose/workers/video-export.worker.ts`

- [ ] **Step 1: Remove the legacy frame message type**

Open `src/lib/features/compose/workers/video-export.worker.ts`. Delete the `FrameMessageLegacy` interface and collapse `FrameMessage` to:

```ts
interface FrameMessage {
  type: "frame-captured";
  frame: CapturedFrame;
  frameIndex: number;
  isKeyframe: boolean;
}
```

- [ ] **Step 2: Remove the legacy handler functions**

Delete `handleFrameWebCodecs(msg: FrameMessage)` and `handleFrameWasm(msg: FrameMessage)` — these were the legacy `ImageData`-path handlers. Keep `handleFrameCapturedWebCodecs` and `handleFrameCapturedWasm`.

- [ ] **Step 3: Simplify the `handleFrame` dispatcher**

Find `handleFrame()` and replace its body with the single remaining branch:

```ts
function handleFrame(msg: FrameMessage): void {
  if (cancelled) return;

  if (hasWebCodecs) {
    handleFrameCapturedWebCodecs(msg);
  } else {
    handleFrameCapturedWasm(msg);
  }

  post({ type: "progress", frameIndex: msg.frameIndex });
}
```

- [ ] **Step 4: Simplify the main switch**

Find the `self.onmessage` switch (around line 503). The `case "frame":` fallthrough we added in Task 6 is now dead — replace:

```ts
      case "frame":
      case "frame-captured":
        handleFrame(msg);
        break;
```

with:

```ts
      case "frame-captured":
        handleFrame(msg);
        break;
```

- [ ] **Step 5: Verify build**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep "video-export.worker" || echo "no errors"`
Expected: `no errors`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/compose/workers/video-export.worker.ts
git commit -m "refactor(video-export): drop legacy ImageData frame path from worker"
```

---

## Phase 7: Final verification

### Task 17: Full regression run

**Files:**
- No code changes.

- [ ] **Step 1: Run the full unit test suite**

Run: `npx vitest run`
Expected: All tests pass. Key tests to watch: `CanvasFrameCapturer.test.ts`, any existing video-export tests under `tests/unit/`.

- [ ] **Step 2: Run svelte-check in full**

Run: `npx svelte-check --tsconfig tsconfig.json`
Expected: Zero errors, zero warnings from the files touched in this plan. (Pre-existing unrelated warnings are fine.)

- [ ] **Step 3: Manual regression — 3D export at 4K/30**

Tell Austen: "Final 3D regression: export a 10-second 3D sequence at **4K / 30 fps**. Confirm it ships a valid MP4, runs without stuttering, and shows no visual regression vs the Phase 4 smoke test."

- [ ] **Step 4: Manual regression — 2D export at 4K/30**

Tell Austen: "Final 2D regression: export a 10-second 2D sequence at **4K / 30 fps**. Same checks."

- [ ] **Step 5: Manual regression — 3D export at 1080p/60**

Tell Austen: "Final smoothness check: export a 10-second 3D sequence at **1080p / 60 fps**. Confirm it's smoother than the pre-phase baseline (Austen's eye is the ground truth)."

- [ ] **Step 6: DevTools memory spot check**

Tell Austen: "Optional but recommended: open DevTools → Performance monitor, record a 10-second export, and confirm JS heap size doesn't balloon the way it used to when each frame allocated ~33 MB of ImageData. Screenshot and paste if possible."

- [ ] **Step 7: Commit the final green state (if any housekeeping was needed)**

```bash
git status
# If nothing needs committing, skip. Otherwise:
git add <files>
git commit -m "chore(video-export): final regression cleanup after fast pixel path rollout"
```

---

## Spec ↔ Plan coverage map

| Spec section | Covered by |
|--------------|------------|
| §4 Architecture overview | Tasks 1–4 (new files), 5–9 (protocol widening), 10–14 (migrations), 15–16 (cleanup) |
| §5 CapturedFrame type | Task 1 |
| §6 CanvasFrameCapturer service | Tasks 2–4 |
| §7 Worker protocol changes | Tasks 5, 6, 16 |
| §8 Hardware acceleration | Task 7 |
| §9.1 Realtime3DExporter migration | Tasks 11, 12 |
| §9.2 VideoExportOrchestrator migration | Tasks 13, 14 |
| §9.3 DI wiring | Tasks 10, 11 (step 2), 13 (step 2) |
| §11 SOTA evaluation (ImageBitmap skipped) | Architectural decision 1 at top of plan |
| §12 Risks (preserveDrawingBuffer, leaks, flush timing) | Mitigated in Task 12 notes + Task 6 try/finally |
| §13 Testing strategy | Tasks 3–4 unit tests, Tasks 12/14/17 manual smoke tests |
| §14 Rollout sequencing | Phase ordering 1→7 |
| §16 Success criteria | Task 17 regression checks |

## Architectural notes for the executing engineer

**Why no ImageBitmap tier.** The spec lists three transport kinds. The plan ships two. Rationale is in "Decision 1" at the top. If a reviewer asks "where's ImageBitmap," the answer is: the browser matrix makes it dead code, and the worker WASM path can't consume it without another readback. Add it back only if telemetry later shows a browser that supports `createImageBitmap` but not `VideoFrame`.

**Why fire-and-forget capture in the 3D path.** The 3D render loop is driven by `requestAnimationFrame` and must not block between frames, or it falls out of lockstep with the live animation. `capture()` is declared `async` for interface symmetry with the ImageData fallback, but on the VideoFrame path it's effectively synchronous (the `new VideoFrame(canvas)` constructor returns immediately). Fire-and-forget with a frozen `capturedIndex` preserves frame ordering because `postMessage` ordering is preserved and the encoder queues sequentially.

**Why the 2D path awaits the capture.** The 2D render loop is already `async` and walks the sequence one frame at a time, so awaiting the capture is natural and doesn't risk RAF drift.

**VideoFrame ownership contract.** Every VideoFrame is closed exactly once, by the worker, inside a `try/finally` after `encoder.encode()`. The main thread never owns a VideoFrame longer than the `postMessage` call that transfers it. The only exception: if the worker has already been terminated, `addFrameCaptured` closes the frame itself before early-returning (Task 9, step 2).

**preserveDrawingBuffer requirement.** `new VideoFrame(canvas)` reads the current WebGL framebuffer. Without `preserveDrawingBuffer: true` the framebuffer is cleared after presentation and the capture returns black. This is already set in `Viewer3DCanvas.svelte:61` — verified by the pre-Phase-A work. The 2D canvas path is a 2D context so `preserveDrawingBuffer` doesn't apply.
