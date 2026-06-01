# Animation Export Fix + Shared Takeover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make production animation export render props, advance progress 0→100% without hanging, keep the canvas alive during export, and present a gorgeous shared screen-takeover.

**Architecture:** Four independent fixes in the offscreen export path + one extracted shared overlay primitive. (A) Thread real prop types end-to-end into a one-time `loadPerColorPropTextures` in the offscreen renderer. (B) Yield to the event loop each capture-loop iteration. (C) Mirror the proven mandala worker's H.264 platform-aware codec + add an encoder-init timeout. (D) Extract `ExportTakeover.svelte`, mount it on the QR page + AnimationPanel, refactor MandalaExportTakeover to consume it.

**Tech Stack:** Svelte 5 (runes), TypeScript, WebCodecs + mediabunny, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-31-animation-export-fix-and-takeover-design.md`

---

## File structure

**New:**
- `src/lib/shared/video-export/components/ExportTakeover.svelte` — controller-agnostic export overlay (scrim + conic ring + copy + cancel/retry + beforeunload guard).
- `tests/unit/animation-engine/video-export-codec.test.ts` — worker codec selection unit tests.
- `tests/unit/animation-engine/background-encoder-timeout.test.ts` — encoder-init timeout unit test.

**Modify:**
- `src/lib/shared/animation-engine/workers/video-export.worker.ts` — platform-aware H.264 default; export `selectCodec` for testing.
- `src/lib/shared/animation-engine/services/background-video-encoder.ts` — timeout-wrap the `"ready"` handshake.
- `src/lib/shared/video-export/services/export-engine-props.ts` — already correct typing; no change needed beyond verifying threading (no edit if Task 3 covers source).
- `src/lib/shared/video-export/services/offscreen-export-renderer.ts` — `loadPerColorPropTextures` in `initialize`; accept + thread `previewDarkMode`/`showNonRadialPoints`.
- `src/lib/features/compose/services/video-export-orchestrator.ts` — forward real prop types + previewDarkMode + showNonRadialPoints; default codec h264; yield per loop iteration.
- `src/lib/shared/compose/domain/video-export-types.ts` — add `bluePropType?`/`redPropType?`/`previewDarkMode?`/`showNonRadialPoints?` to `VideoExportOrchestratorOptions`.
- `src/routes/q/[code]/+page.svelte` — pass prop types into export; mount `ExportTakeover`.
- `src/lib/shared/animation-panel/components/AnimationPanel.svelte` — mount `ExportTakeover` (replaces inline progress blocks).
- `src/lib/shared/sequence-viewer/components/MandalaExportTakeover.svelte` — refactor to consume `ExportTakeover` via snippets.

---

## Task 1: Platform-aware H.264 default in the export worker

**Files:**
- Modify: `src/lib/shared/animation-engine/workers/video-export.worker.ts:176-187` (selectCodec), `:314-411` (handleConfigWebCodecs)
- Test: `tests/unit/animation-engine/video-export-codec.test.ts`

The worker currently defaults to AV1 10-bit (the hang). Mirror the mandala worker: platform-aware H.264 by default, AV1 only when explicitly requested.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/animation-engine/video-export-codec.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { selectCodec } from "$lib/shared/animation-engine/workers/video-export.worker";

describe("video-export worker selectCodec", () => {
  it("uses Constrained Baseline (0x42e0) on mobile", () => {
    expect(selectCodec(1080, 1080, true)).toMatch(/^avc1\.42e0/);
  });
  it("uses High profile (0x6400) on desktop", () => {
    expect(selectCodec(1080, 1080, false)).toMatch(/^avc1\.6400/);
  });
  it("tracks resolution in the level byte", () => {
    expect(selectCodec(640, 480, false)).toBe("avc1.64001f");   // <=921600
    expect(selectCodec(1920, 1080, false)).toBe("avc1.640028"); // <=2073600
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animation-engine/video-export-codec.test.ts`
Expected: FAIL — `selectCodec` is not exported and current signature takes 2 args, no `isMobile`.

- [ ] **Step 3: Make `selectCodec` platform-aware + exported**

In `video-export.worker.ts`, add an `IS_MOBILE` detector near the top (after `hasWebCodecs`, ~line 27) — copy from the mandala worker (`mandala-export.worker.ts:116-133`):

```ts
const IS_MOBILE = (() => {
  try {
    const nav = (self as unknown as { navigator?: Navigator & { userAgentData?: { mobile?: boolean; platform?: string } } }).navigator;
    const ua = nav?.userAgent ?? "";
    const platform = nav?.userAgentData?.platform ?? "";
    const isAndroid = /Android/i.test(ua) || platform === "Android";
    const isApple = /iPhone|iPad|iPod/i.test(ua) || platform === "iOS";
    return isAndroid || isApple || nav?.userAgentData?.mobile === true;
  } catch {
    return false;
  }
})();
```

Replace `selectCodec` (`:176-187`) with a platform-aware, exported version (the third arg defaults to module `IS_MOBILE` so production callers stay unchanged, while tests pass it explicitly):

```ts
/**
 * H.264 codec string. Profile prefix tracks the platform's HW path:
 * mobile GPUs accelerate Constrained Baseline (0x42e0), desktop Media
 * Foundation accelerates High (0x6400). Level byte tracks resolution.
 */
export function selectCodec(width: number, height: number, isMobile: boolean = IS_MOBILE): string {
  const pixelArea = width * height;
  const level = pixelArea <= 921_600 ? "1f"
    : pixelArea <= 2_073_600 ? "28"
    : pixelArea <= 8_912_896 ? "33"
    : "3c";
  return isMobile ? `avc1.42e0${level}` : `avc1.6400${level}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animation-engine/video-export-codec.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Default the codec to H.264 (drop AV1 default)**

In `video-export-orchestrator.ts:211`, change the default from `"av1"` to `"h264"`:

```ts
        codec: options.codec ?? "h264",
```

Update the surrounding comment (`:207-210`) to reflect the new default:

```ts
        // Default to platform-aware H.264 (the codec hardware-encoders
        // accelerate on essentially every device of the last decade). AV1
        // remains available via an explicit codec:"av1" option but is no
        // longer the default — 10-bit AV1 encode is unsupported on most
        // mobile/Safari, where configure() could stall and hang the export.
        codec: options.codec ?? "h264",
```

- [ ] **Step 6: Commit**

```bash
git add tests/unit/animation-engine/video-export-codec.test.ts src/lib/shared/animation-engine/workers/video-export.worker.ts src/lib/features/compose/services/video-export-orchestrator.ts
git commit -m "fix(export): default to platform-aware H.264, drop AV1-10bit default (0%-hang)" -- tests/unit/animation-engine/video-export-codec.test.ts src/lib/shared/animation-engine/workers/video-export.worker.ts src/lib/features/compose/services/video-export-orchestrator.ts
```

---

## Task 2: Timeout-wrap the encoder-init handshake

**Files:**
- Modify: `src/lib/shared/animation-engine/services/background-video-encoder.ts:60-94`
- Test: `tests/unit/animation-engine/background-encoder-timeout.test.ts`

A stalled `configure()` posts no `"ready"` and no error, so `initialize()` hangs forever. Add a bounded timeout that rejects, letting the orchestrator's catch + finally run.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/animation-engine/background-encoder-timeout.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BackgroundVideoEncoder } from "$lib/shared/animation-engine/services/background-video-encoder";

// Stub Worker that never posts "ready" — simulates a stalled configure().
class SilentWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage() {} // swallow config; never reply
  terminate() {}
}

describe("BackgroundVideoEncoder.initialize timeout", () => {
  beforeEach(() => {
    vi.stubGlobal("Worker", SilentWorker as unknown as typeof Worker);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("rejects when the worker never reports ready", async () => {
    const enc = new BackgroundVideoEncoder();
    const p = enc.initialize({ width: 1080, height: 1080, fps: 60, bitrate: 1_000_000, totalFrames: 60 });
    const assertion = expect(p).rejects.toThrow(/timed out|ready/i);
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animation-engine/background-encoder-timeout.test.ts`
Expected: FAIL — the promise never rejects (test times out or hangs).

- [ ] **Step 3: Add the timeout to `initialize`**

In `background-video-encoder.ts`, add a constant near the top of the class (after `onProgress`, ~line 54):

```ts
  /** Max wait for the worker to report "ready". A stalled VideoEncoder.configure()
   *  posts neither "ready" nor an error, so without this the init promise hangs
   *  forever and the export UI freezes at 0%. */
  private static readonly READY_TIMEOUT_MS = 15_000;

  private initTimer: ReturnType<typeof setTimeout> | null = null;
```

Replace the `return new Promise<void>(...)` block in `initialize` (`:78-93`) with a timeout-guarded version:

```ts
    // Wait for the worker to finish configuring the encoder, with a timeout so a
    // stalled configure() can't hang the export at 0% forever.
    return new Promise<void>((resolve, reject) => {
      this.initResolve = resolve;
      this.initReject = reject;

      this.initTimer = setTimeout(() => {
        if (this.initReject) {
          const err = new Error(
            "Encoder initialization timed out — the codec configuration did not " +
            "complete (try a lower resolution/fps, or a different browser)."
          );
          this.initReject(err);
          this.initResolve = null;
          this.initReject = null;
        }
        this.terminateWorker();
      }, BackgroundVideoEncoder.READY_TIMEOUT_MS);

      this.postToWorker({
        type: "config",
        config: {
          width: config.width,
          height: config.height,
          fps: config.fps,
          bitrate: config.bitrate,
          totalFrames: config.totalFrames,
          codec: config.codec,
        },
      });
    });
```

In `handleMessage` `"ready"` case (`:217-221`) clear the timer before resolving:

```ts
      case "ready":
        if (this.initTimer) { clearTimeout(this.initTimer); this.initTimer = null; }
        this.initResolve?.();
        this.initResolve = null;
        this.initReject = null;
        break;
```

Also clear it in the `"error"` init-reject branch (`:253-256`) and in `rejectPending` (`:280-290`) so it never fires after settlement. In both places add, before rejecting: `if (this.initTimer) { clearTimeout(this.initTimer); this.initTimer = null; }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animation-engine/background-encoder-timeout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/animation-engine/background-encoder-timeout.test.ts src/lib/shared/animation-engine/services/background-video-encoder.ts
git commit -m "fix(export): timeout encoder-init handshake so a stalled configure can't hang at 0%" -- tests/unit/animation-engine/background-encoder-timeout.test.ts src/lib/shared/animation-engine/services/background-video-encoder.ts
```

---

## Task 3: Thread real prop types + dark mode + nonradial into the export

**Files:**
- Modify: `src/lib/shared/compose/domain/video-export-types.ts` (`VideoExportOrchestratorOptions`)
- Modify: `src/lib/features/compose/services/video-export-orchestrator.ts:399-411`
- Modify: `src/lib/shared/video-export/services/offscreen-export-renderer.ts:43-114`

The offscreen engine boots prop textures from global settings (default `"staff"`); on the QR page (no DI bootstrap) the user's prop never reaches it. Pass the real types in and load them once.

- [ ] **Step 1: Add option fields to the orchestrator options type**

In `video-export-types.ts`, in `VideoExportOrchestratorOptions`, add (with the other optional fields):

```ts
  /** Prop type strings (e.g. "staff"). Drive the prop BODY textures the offscreen
   *  export engine loads — without them the export falls back to global settings
   *  (default "staff") and on the QR landing page (no DI bootstrap) renders the
   *  wrong/blank prop. */
  bluePropType?: string | null;
  redPropType?: string | null;
  /** Preview dark-mode override matching the live view's prop colors. */
  previewDarkMode?: boolean | null;
  /** Whether non-radial grid points are shown (matches the live grid). */
  showNonRadialPoints?: boolean;
```

- [ ] **Step 2: Extend `OffscreenExportInit` + load prop textures in `initialize`**

In `offscreen-export-renderer.ts`, extend `OffscreenExportInit` (`:43-53`) with the dark-mode + nonradial inputs (it already has `bluePropType`/`redPropType`):

```ts
export interface OffscreenExportInit {
  outputCanvasSize: number;
  fps: number;
  needsFluidWarmup: boolean;
  bluePropType: string | null;
  redPropType: string | null;
  /** Dark-mode override for prop colors + grid tint. null → engine boot value. */
  previewDarkMode: boolean | null;
  /** Whether to draw non-radial grid points (matches the live grid). */
  showNonRadialPoints: boolean;
}
```

In `initialize()`, after the existing `loadGridTexture` call (`:112-114`), add a prop-texture load (the direct mirror of the grid fix). Resolve dark mode from the override or the shared VM:

```ts
    // Load the prop BODY textures for the resolved prop types. The renderer skips
    // drawing a prop whose image is null (canvas-2d-animation-renderer getBluePropImage),
    // so without this the offscreen engine — driven only through renderFrame, which
    // bypasses PlaybackSync's prop-texture path — renders no staves. Mirrors the
    // grid-texture load above. Resolve "staff" as the floor so a missing type still
    // draws something.
    const darkMode = init.previewDarkMode ?? vm.isDarkMode();
    const blue = init.bluePropType ?? "staff";
    const red = init.redPropType ?? "staff";
    await this.handle.context.renderer.loadPerColorPropTextures(blue, red, darkMode);
```

Update the `loadGridTexture` call to honor `showNonRadialPoints`:

```ts
    await this.handle.context.renderer.loadGridTexture(gridMode, init.showNonRadialPoints);
```

In `renderSubStep` (`:202-211`), thread the real values into the frame context instead of the hardcoded `null`/`true`:

```ts
    const frameCtx: ExportFrameContext = {
      virtualTime: clockMs,
      isSeamlesslyLoopable: this.playback.isSeamlesslyLoopable,
      backgroundAlpha: 1,
      showNonRadialPoints: this.init.showNonRadialPoints,
      trailSettings: animationSettings.trail,
      bluePropType: this.init.bluePropType,
      redPropType: this.init.redPropType,
      previewDarkMode: this.init.previewDarkMode,
    };
```

- [ ] **Step 3: Resolve + forward the values in the orchestrator**

In `video-export-orchestrator.ts`, replace the offscreen construction block (`:399-411`) so it forwards the resolved inputs. The orchestrator can read non-radial + dark mode from the visibility manager it already holds (`visibilityManager`, `isDarkMode`/`showNonRadialPoints` are checked at `:368-371`); prop types come from options with a settings fallback resolved by the caller:

```ts
      if (!isCompositeMode) {
        offscreen = new OffscreenExportRenderer(playbackController, panelState);
        await offscreen.initialize({
          outputCanvasSize,
          fps,
          needsFluidWarmup,
          // Resolved by the caller (QR page → selectedProp; app → settings).
          // Falls back to "staff" inside the renderer if null.
          bluePropType: options.bluePropType ?? null,
          redPropType: options.redPropType ?? null,
          // Match the live view's prop colors + grid points.
          previewDarkMode: options.previewDarkMode ?? isDarkMode,
          showNonRadialPoints: options.showNonRadialPoints ?? visibilityManager.getVisibility("nonRadialPoints"),
        });
      }
```

Note: `isDarkMode` is already a local at `:371`. Verify the visibility key for non-radial points — grep `getVisibility(` usages; if the key differs from `"nonRadialPoints"`, use the actual key (the renderer's grid load uses `showNonRadialPoints`). If no such visibility key exists, default to `options.showNonRadialPoints ?? true` (the prior hardcoded value) so behavior is unchanged when unspecified.

- [ ] **Step 4: Pass prop types from the QR page**

In `q/[code]/+page.svelte handleDownload` (`:241-256`), add prop types to the options object passed to `executeExport`:

```ts
        {
          compositeMode: "none",
          fps: opts.fps,
          loopCount: opts.loopCount,
          resolution: opts.resolution,
          includeAnimationStartPosition: opts.includeStartPosition,
          includeEndHold: opts.includeEndHold,
          bluePropType: selectedProp,
          redPropType: selectedProp,
          previewDarkMode: true, // QR player mounts with previewDarkMode={true}
        }
```

- [ ] **Step 5: Pass prop types from the app (AnimationPanel) path**

Grep for the app-side caller of `executeExport` (the sequence viewer's Download Animation handler — `SequenceViewerOrchestrator.svelte` or its export service). In that handler, resolve and pass:

```ts
          bluePropType: settingsService.settings.bluePropType ?? settingsService.settings.propType ?? "staff",
          redPropType: settingsService.settings.redPropType ?? settingsService.settings.propType ?? "staff",
```

Run: `grep -rn "executeExport(" src/lib --include=*.svelte --include=*.ts` to find every call site and add the two prop-type options to each (QR page already done in Step 4). For composite/split callers prop types are harmless (composite mode ignores the offscreen renderer).

- [ ] **Step 6: Typecheck**

Run: `npm run check:fast`
Expected: no new errors in the touched files. Fix any type mismatches (e.g. `OffscreenExportInit` now requires `previewDarkMode`/`showNonRadialPoints` — every construction site is in `video-export-orchestrator.ts`, updated in Step 3).

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/compose/domain/video-export-types.ts src/lib/shared/video-export/services/offscreen-export-renderer.ts src/lib/features/compose/services/video-export-orchestrator.ts "src/routes/q/[code]/+page.svelte"
git commit -m "fix(export): load real prop textures in offscreen export so staves render" -- src/lib/shared/compose/domain/video-export-types.ts src/lib/shared/video-export/services/offscreen-export-renderer.ts src/lib/features/compose/services/video-export-orchestrator.ts "src/routes/q/[code]/+page.svelte"
```
(Add the app-side caller file from Step 5 to this commit's pathspec.)

---

## Task 4: Yield to the event loop each capture iteration (fix freeze)

**Files:**
- Modify: `src/lib/features/compose/services/video-export-orchestrator.ts:529-543`

The non-composite branch never awaits, so the main thread can't repaint. Add a single rAF yield per iteration.

- [ ] **Step 1: Add the yield in the non-composite branch**

In the per-frame render block (`:535-543`), the composite branch already `await this.waitForAnimationFrame()`. Add the same yield for the non-composite branch AFTER the synchronous offscreen render so the browser paints the live canvas and the progress bar flushes:

```ts
        if (!isCompositeMode) {
          offscreen!.renderFrame(playbackPosition, virtualTimeMs);
          // Yield to the event loop so the browser repaints (the live canvas keeps
          // animating under the takeover) and the Svelte progress update flushes.
          // The offscreen engine is deterministic and unaffected by the yield.
          await this.waitForAnimationFrame();
        } else {
          playbackController.calculateStateForStep(playbackPosition);
          await this.waitForAnimationFrame();
        }
```

- [ ] **Step 2: Verify the loop still compiles + types**

Run: `npm run check:fast`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/services/video-export-orchestrator.ts
git commit -m "fix(export): yield per capture frame so the canvas keeps painting during export" -- src/lib/features/compose/services/video-export-orchestrator.ts
```

---

## Task 5: Build the shared `ExportTakeover` primitive

**Files:**
- Create: `src/lib/shared/video-export/components/ExportTakeover.svelte`

Controller-agnostic overlay: dim scrim, centered glass panel, conic-ring progress in brand prop colors, copy, cancel/retry, beforeunload guard.

- [ ] **Step 1: Write the component**

Create `src/lib/shared/video-export/components/ExportTakeover.svelte`:

```svelte
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Snippet } from "svelte";

  export type ExportPhase = "idle" | "capturing" | "encoding" | "complete" | "error";

  interface Props {
    phase: ExportPhase;
    /** 0..1 */
    progress: number;
    phaseLabel: string;
    error?: string | null;
    onCancel?: () => void;
    onRetry?: () => void;
    /** Opaque background (Mandala) vs dim scrim over the live canvas (animation). */
    opaque?: boolean;
    /** Optional hero behind the panel (Mandala passes its SequenceMandala). */
    centerpiece?: Snippet;
    /** Optional floating diagnostics card. */
    diag?: Snippet;
  }

  let {
    phase,
    progress,
    phaseLabel,
    error = null,
    onCancel,
    onRetry,
    opaque = false,
    centerpiece,
    diag,
  }: Props = $props();

  let reduceMotion = $state(false);
  $effect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const onChange = () => (reduceMotion = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
  const dur = (ms: number) => (reduceMotion ? 0 : ms);

  const pct = $derived(Math.round(Math.max(0, Math.min(1, progress)) * 100));

  // beforeunload guard — block accidental navigation while exporting.
  $effect(() => {
    if (phase === "idle" || phase === "complete") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  });

  // Brand prop-trail colors for the conic sweep (blue → red motion colors).
  const RING_FROM = "#3575E2";
  const RING_TO = "#ED1C24";
  const ringStyle = $derived(
    `background: conic-gradient(from -90deg, ${RING_FROM} 0%, ${RING_TO} ${pct}%, var(--theme-stroke, rgba(255,255,255,0.12)) ${pct}%);`,
  );
</script>

{#if phase !== "idle"}
  <div class="export-takeover" class:opaque transition:fade={{ duration: dur(280) }}>
    {#if centerpiece}
      <div class="takeover-stage">{@render centerpiece()}</div>
    {/if}

    <div class="takeover-panel" transition:fly={{ y: 28, duration: dur(340), easing: cubicOut }}>
      {#if phase === "error"}
        <p class="takeover-msg error"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> Export failed</p>
        <p class="takeover-sub">{error}</p>
        <div class="takeover-actions">
          {#if onCancel}<button class="takeover-btn ghost" onclick={onCancel}>Close</button>{/if}
          {#if onRetry}<button class="takeover-btn primary" onclick={onRetry}>Retry</button>{/if}
        </div>
      {:else}
        <div
          class="ring"
          style={ringStyle}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Export progress"
        >
          <div class="ring-hole">
            <span class="ring-pct">{pct}<small>%</small></span>
          </div>
        </div>
        <p class="takeover-phase">{phaseLabel}</p>
        <p class="takeover-msg">Please don't navigate away.</p>
        {#if phase !== "complete" && onCancel}
          <button class="takeover-btn ghost" onclick={onCancel}>Cancel</button>
        {/if}
      {/if}
    </div>

    {#if diag && phase !== "error"}
      <div class="diag-overlay">{@render diag()}</div>
    {/if}
  </div>
{/if}

<style>
  .export-takeover {
    position: absolute;
    inset: 0;
    z-index: var(--z-overlay, 500);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 24px;
    /* Dim scrim by default — the live canvas keeps playing underneath. */
    background: rgba(7, 7, 15, 0.78);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .export-takeover.opaque {
    background: #07070f;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .takeover-stage { display: flex; align-items: center; justify-content: center; }
  .takeover-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: 100%;
    max-width: 320px;
    text-align: center;
    padding: 24px;
    border-radius: var(--modal-border-radius, 20px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.14));
    box-shadow:
      0 25px 80px rgba(0, 0, 0, 0.5),
      0 10px 30px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 var(--theme-stroke-strong, rgba(255, 255, 255, 0.1)),
      0 0 48px var(--theme-accent-glow, color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent));
  }
  .ring {
    width: 104px;
    height: 104px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    transition: background 180ms ease;
  }
  .ring-hole {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    display: grid;
    place-items: center;
  }
  .ring-pct {
    font-size: 26px;
    font-weight: 800;
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .ring-pct small { font-size: 13px; font-weight: 600; opacity: 0.6; margin-left: 1px; }
  .takeover-phase {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
    /* Reserve width for the widest phase so the box never reflows neighbors. */
    min-width: 11ch;
  }
  .takeover-msg {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }
  .takeover-msg.error { color: #fca5a5; font-weight: 600; font-size: 15px; }
  .takeover-sub {
    margin: 0;
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    word-break: break-word;
  }
  .takeover-actions { display: flex; gap: 10px; }
  .takeover-btn {
    min-height: 44px;
    padding: 8px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1), background 200ms ease, border-color 200ms ease;
  }
  .takeover-btn:active { transform: scale(0.95); }
  .takeover-btn.ghost {
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.18));
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }
  .takeover-btn.primary {
    border: 1px solid color-mix(in srgb, var(--theme-accent, #6366f1) 70%, transparent);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    color: white;
  }
  .diag-overlay {
    position: absolute;
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 40;
    width: min(340px, calc(100% - 24px));
    max-height: min(70vh, calc(100% - 32px));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  @media (hover: hover) {
    .takeover-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 6px 18px color-mix(in srgb, var(--theme-accent, #6366f1) 35%, transparent); }
    .takeover-btn.ghost:hover { border-color: var(--theme-text-dim, rgba(255, 255, 255, 0.4)); color: var(--theme-text, #fff); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ring { transition: none; }
    .takeover-btn:active { transform: none; }
  }
</style>
```

- [ ] **Step 2: Typecheck the component**

Run: `npm run check:fast`
Expected: no errors in `ExportTakeover.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/video-export/components/ExportTakeover.svelte
git commit -m "feat(export): shared ExportTakeover primitive (scrim + conic prop-color ring)" -- src/lib/shared/video-export/components/ExportTakeover.svelte
```

---

## Task 6: Mount `ExportTakeover` on the QR page

**Files:**
- Modify: `src/routes/q/[code]/+page.svelte`

- [ ] **Step 1: Import + map state**

In the `<script>` (after the other imports, ~line 39), add:

```ts
  import ExportTakeover from "$lib/shared/video-export/components/ExportTakeover.svelte";
```

Add derived state mapping the existing `exportProgress`/`isExporting` to the takeover props (after `exportProgress` is declared, ~line 131):

```ts
  const takeoverPhase = $derived<import("$lib/shared/video-export/components/ExportTakeover.svelte").ExportPhase>(
    !isExporting ? "idle"
    : exportProgress?.stage === "error" ? "error"
    : exportProgress?.stage === "encoding" ? "encoding"
    : exportProgress?.stage === "complete" ? "complete"
    : "capturing",
  );
  const takeoverLabel = $derived(
    takeoverPhase === "encoding" ? "Encoding…"
    : takeoverPhase === "complete" ? "Done"
    : "Rendering",
  );
```

If the `ExportPhase` type import is awkward inline, add a top-level `import type { ExportPhase } from "$lib/shared/video-export/components/ExportTakeover.svelte";` and use `$derived<ExportPhase>(...)`.

- [ ] **Step 2: Render the overlay inside the canvas area**

Inside `.canvas-area` (after the `AnimationPlayerComponent`, before the closing `</div>` at `:454`), mount the takeover so its `inset:0` covers the live canvas:

```svelte
        <ExportTakeover
          phase={takeoverPhase}
          progress={exportProgress?.progress ?? 0}
          phaseLabel={takeoverLabel}
          error={exportProgress?.error ?? null}
          onCancel={() => { isExporting = false; }}
          onRetry={handleDownload}
        />
```

- [ ] **Step 3: Typecheck**

Run: `npm run check:fast`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/q/[code]/+page.svelte"
git commit -m "feat(export): mount ExportTakeover on the QR scan viewer" -- "src/routes/q/[code]/+page.svelte"
```

---

## Task 7: Mount `ExportTakeover` in the AnimationPanel host

**Files:**
- Modify: the sequence-viewer host that renders `AnimationPanel` for the app's Download Animation (grep below to confirm), e.g. `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`.

The panel itself shows inline progress; the takeover should cover the animation canvas in the viewer. Mount it where the live animation canvas lives, not inside the panel.

- [ ] **Step 1: Locate the host + canvas container**

Run: `grep -rn "AnimationPanel" src/lib --include=*.svelte` and `grep -rn "executeExport\|isExporting\|exportProgress" src/lib/shared/sequence-viewer --include=*.svelte`.
Identify the component that owns `isExporting` + `exportProgress` for the app path and the element wrapping the live `AnimationPlayer`/`AnimatorCanvas`.

- [ ] **Step 2: Import + map state + render over the canvas**

In that host, import `ExportTakeover`, add the same `takeoverPhase`/`takeoverLabel` derivations as Task 6 Step 1 (reuse the exact mapping), and render `<ExportTakeover .../>` as a sibling overlay inside the (position:relative) canvas container — wiring `onCancel` to the host's cancel handler (`orchestrator.cancelExport()` if present, else set `isExporting = false`) and `onRetry` to the host's export handler.

```svelte
        <ExportTakeover
          phase={takeoverPhase}
          progress={exportProgress?.progress ?? 0}
          phaseLabel={takeoverLabel}
          error={exportProgress?.error ?? null}
          onCancel={handleCancelExport}
          onRetry={handleDownloadAnimation}
        />
```

Use the host's actual handler names found in Step 1.

- [ ] **Step 3: Typecheck**

Run: `npm run check:fast`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add <host-file-from-step-1>
git commit -m "feat(export): mount ExportTakeover over the app animation canvas" -- <host-file-from-step-1>
```

---

## Task 8: Refactor MandalaExportTakeover to consume ExportTakeover

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/MandalaExportTakeover.svelte`

Eliminate the duplicate overlay: Mandala becomes a thin wrapper passing its mandala as `centerpiece`, its diag card as `diag`, and `opaque={true}`.

- [ ] **Step 1: Rewrite as a wrapper**

Replace the markup section of `MandalaExportTakeover.svelte` (the `{#if ctrl.exportPhase !== "idle"} ... {/if}` block, `:67-137`) with an `ExportTakeover` usage, keeping the controller-derived values (`pct`, `phaseLabel`, diag computations) in the script. Pass the existing `SequenceMandala` via the `centerpiece` snippet and the existing diagnostics markup via the `diag` snippet. Map `ctrl.exportPhase` → `phase`, `ctrl.exportProgress` → `progress`, `ctrl.exportError` → `error`, `() => ctrl.cancelExport()` → `onCancel`, `() => ctrl.startExport()` → `onRetry`, `opaque={true}`.

```svelte
<script lang="ts">
  import ExportTakeover from "$lib/shared/video-export/components/ExportTakeover.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import type { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";

  interface Props {
    ctrl: MandalaViewerController;
    sequence: any;
    bluePropType?: string;
    redPropType?: string;
    size: number;
  }
  let { ctrl, sequence, bluePropType, redPropType, size }: Props = $props();

  const phaseLabel = $derived(
    ctrl.exportPhase === "capturing" ? "Rendering"
    : ctrl.exportPhase === "encoding" ? "Encoding…"
    : ctrl.exportPhase === "complete" ? "Done"
    : "",
  );

  // Diagnostics (unchanged logic, kept here; rendered via the diag snippet).
  const d = $derived(ctrl.lastExportDiag);
  const mp = $derived(d ? +((d.resolution * d.resolution) / 1_000_000).toFixed(1) : 0);
  const hwLabel = $derived(
    !d ? "" : d.encoder === "wasm" ? "WASM (software)" : d.hwSupported ? "HW H.264" : "SW H.264",
  );
  const etaSec = $derived(
    d && d.encodeFps > 0 ? Math.ceil((d.totalFrames - d.encodedFrames) / d.encodeFps) : 0,
  );
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  function copyDiag() {
    if (!d) return;
    const lines = [
      `mandala export diag`,
      `res ${d.resolution}² (${mp}MP) · fps ${d.fps} · frames ${d.encodedFrames}/${d.totalFrames}`,
      `encoder ${hwLabel} · codec ${d.codec}`,
      `encode ${d.encodeFps}fps${etaSec ? ` · ~${etaSec}s left` : ""}`,
      `render ${d.renderMs}ms · wait ${d.encodeWaitMs}ms · vframe ${d.vfMs}ms · mux ${d.muxMs}ms`,
    ].join("\n");
    navigator.clipboard?.writeText(lines).then(() => {
      copied = true;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1600);
    });
  }
</script>

<ExportTakeover
  phase={ctrl.exportPhase}
  progress={ctrl.exportProgress}
  {phaseLabel}
  error={ctrl.exportError}
  onCancel={() => ctrl.cancelExport()}
  onRetry={() => ctrl.startExport()}
  opaque
>
  {#snippet centerpiece()}
    <SequenceMandala
      {sequence}
      animate={!ctrl.paused}
      animateMin={0}
      animateMax={ctrl.rangeMax}
      animatePeriod={ctrl.period}
      animateEasing="breathe"
      animateRotation={ctrl.rotation}
      pathShape={ctrl.pathShape}
      {size}
      {bluePropType}
      {redPropType}
      mode="card-back"
      style="stroke"
      show="both"
      palette={ctrl.palette}
      strokeWidth={ctrl.lineWeight}
      gradient={ctrl.gradientColors}
    />
  {/snippet}

  {#snippet diag()}
    {#if d}
      <div class="diag">
        <div class="diag-row big">
          <span class="diag-fps">{d.encodeFps}<small>fps</small></span>
          {#if etaSec}<span class="diag-eta">~{etaSec}s left</span>{/if}
        </div>
        <div class="diag-grid">
          <span class="k">res</span><span class="v">{d.resolution}² · {mp}MP</span>
          <span class="k">encoder</span><span class="v" class:warn={d.encoder === "wasm" || !d.hwSupported}>{hwLabel}</span>
          <span class="k">frames</span><span class="v">{d.encodedFrames}/{d.totalFrames}</span>
          <span class="k">render</span><span class="v">{d.renderMs}ms</span>
          <span class="k">enc&nbsp;wait</span><span class="v">{d.encodeWaitMs}ms</span>
          <span class="k">vframe</span><span class="v">{d.vfMs}ms</span>
          <span class="k">mux</span><span class="v">{d.muxMs}ms</span>
          <span class="k">codec</span><span class="v small">{d.codec}</span>
        </div>
        {#if d.encoder === "wasm" || !d.hwSupported}
          <p class="diag-note">No hardware H.264 — encoding in software. Lower the resolution for a big speedup.</p>
        {/if}
        <button class="takeover-btn ghost diag-copy" onclick={copyDiag}>
          {copied ? "Copied ✓" : "Copy diagnostics"}
        </button>
      </div>
    {/if}
  {/snippet}
</ExportTakeover>

<style>
  /* Diagnostics card styling moved verbatim from the old overlay. */
  .diag {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    font-variant-numeric: tabular-nums;
  }
  .diag-row.big { display: flex; align-items: baseline; justify-content: center; gap: 12px; }
  .diag-fps { font-size: 30px; font-weight: 800; color: var(--theme-text, #fff); line-height: 1; }
  .diag-fps small { font-size: 13px; font-weight: 600; opacity: 0.6; margin-left: 2px; }
  .diag-eta { font-size: 13px; color: var(--theme-text-dim, rgba(255, 255, 255, 0.6)); }
  .diag-grid { display: grid; grid-template-columns: auto 1fr; gap: 3px 14px; font-size: 12.5px; text-align: left; }
  .diag-grid .k { color: var(--theme-text-dim, rgba(255, 255, 255, 0.45)); white-space: nowrap; }
  .diag-grid .v { color: var(--theme-text, rgba(255, 255, 255, 0.92)); text-align: right; }
  .diag-grid .v.small { font-size: 10.5px; word-break: break-all; }
  .diag-grid .v.warn { color: #fbbf24; font-weight: 700; }
  .diag-note { margin: 0; font-size: 11.5px; line-height: 1.35; color: #fbbf24; text-align: left; }
  .diag-copy { width: 100%; min-height: 40px; padding: 6px 16px; font-size: 13px; border-radius: 12px; border: 1px solid var(--theme-stroke, rgba(255,255,255,0.18)); background: transparent; color: var(--theme-text-dim, rgba(255,255,255,0.7)); font-weight: 600; cursor: pointer; }
</style>
```

Note: the conic ring replaces Mandala's old linear `.takeover-bar`. The mandala's progress now reads as the same brand ring — a deliberate unification.

- [ ] **Step 2: Typecheck**

Run: `npm run check:fast`
Expected: no new errors. `MandalaPane.svelte` still passes the same props to `MandalaExportTakeover` (unchanged signature).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/MandalaExportTakeover.svelte
git commit -m "refactor(export): MandalaExportTakeover consumes shared ExportTakeover" -- src/lib/shared/sequence-viewer/components/MandalaExportTakeover.svelte
```

---

## Task 9: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the new unit tests**

Run: `npx vitest run tests/unit/animation-engine/video-export-codec.test.ts tests/unit/animation-engine/background-encoder-timeout.test.ts`
Expected: all PASS.

- [ ] **Step 2: Full typecheck (one cold run, capture to log)**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log | head -40`
Expected: no errors introduced by the touched files. Fix any and re-run once.

- [ ] **Step 3: Build gate**

Run: `npm run build:fast`
Expected: build succeeds.

- [ ] **Step 4: Hand off runtime verification (cannot self-screenshot)**

Report to Austen for in-browser check on `/q/[code]` (desktop + mobile):
1. Click Export → props/staves visible in the live canvas under the scrim AND in the downloaded MP4.
2. Conic ring advances 0 → 100% (no longer stuck at 0%).
3. The animation keeps moving during export (no freeze).
4. MP4 downloads and plays with props.
5. Repeat in the app's Download Animation; confirm the Mandala export still works (shared overlay, opaque, mandala centerpiece, diag card, conic ring).

---

## Self-review notes

- **Spec coverage:** A→Task 3+5-step prop threading; B→Task 4; C→Tasks 1+2; Takeover→Tasks 5-8. All spec sections covered.
- **Type consistency:** `OffscreenExportInit` gains `previewDarkMode`+`showNonRadialPoints` (Task 3 Step 2) and every construction site (orchestrator, Task 3 Step 3) is updated. `ExportPhase` defined in Task 5, consumed in Tasks 6-8. `selectCodec(w,h,isMobile?)` signature consistent across Task 1 + the worker's internal call (default arg keeps the existing 2-arg call at `:375` valid).
- **Non-radial visibility key:** Task 3 Step 3 flags the grep-to-confirm; falls back to `?? true` (prior behavior) if no key exists — no regression risk.
- **App-side caller (Task 3 Step 5, Task 7 Step 1):** exact host file resolved by grep at execution time; both QR and app paths covered.
