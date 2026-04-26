# Unified Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate 2D and 3D viewer timelines with a single `<UnifiedTimeline>` glass pill component backed by a `UnifiedPlaybackContext` adapter pattern, fixing the 3D per-beat progress bug in the process.

**Architecture:** An adapter pattern normalizes the different playback APIs (2D float-based `currentStep`, 3D `progress` + `currentStepIndex`) into a shared `UnifiedPlaybackContext` interface. A single `<UnifiedTimeline>` component reads from this interface to render a glass pill transport bar with play/pause, time display, segmented scrubber, and loop toggle. Each viewer creates its own adapter and passes it to the timeline.

**Tech Stack:** SvelteKit 5, Svelte 5 runes (`$state`, `$derived`, `$props`), TypeScript, Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/shared/timeline/unified-playback-context.ts` | Interface definition |
| Create | `src/lib/shared/timeline/adapters/animator-playback-adapter.svelte.ts` | 2D adapter |
| Create | `src/lib/shared/timeline/adapters/avatar-playback-adapter.svelte.ts` | 3D adapter |
| Create | `src/lib/shared/timeline/UnifiedTimeline.svelte` | Glass pill transport bar UI |
| Create | `tests/unit/timeline/animator-playback-adapter.test.ts` | 2D adapter tests |
| Create | `tests/unit/timeline/avatar-playback-adapter.test.ts` | 3D adapter tests |
| Modify | `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` | Replace TransportBar + remove play btn overlay |
| Modify | `src/lib/shared/3d/components/Viewer3DCanvas.svelte` | Replace ViewerTransportBar |
| Remove | `src/lib/shared/animation-engine/components/layers/TransportBar.svelte` | Dead after migration |
| Remove | `src/lib/shared/sequence-viewer/components/ViewerTransportBar.svelte` | Dead after migration |
| Keep | `src/lib/shared/animation-engine/components/layers/SegmentedSequenceProgressBar.svelte` | Still used by Disassemble views |

---

### Task 1: Create UnifiedPlaybackContext Interface

**Files:**
- Create: `src/lib/shared/timeline/unified-playback-context.ts`

- [ ] **Step 1: Create the interface file**

```typescript
// src/lib/shared/timeline/unified-playback-context.ts

export interface UnifiedPlaybackContext {
  /** 0–1 progress across entire sequence (not per-beat) */
  readonly overallProgress: number;
  /** 1-based current beat index */
  readonly currentBeat: number;
  /** Total number of beats in the sequence */
  readonly totalBeats: number;
  /** Whether playback is active */
  readonly isPlaying: boolean;
  /** Whether looping is enabled (undefined = not supported) */
  readonly isLooping: boolean | undefined;
  /** Total sequence duration in seconds */
  readonly duration: number;
  /** Elapsed time in seconds */
  readonly elapsed: number;

  /** Seek to a position. progress ∈ [0, 1] across the full sequence. */
  seek(progress: number): void;
  /** Toggle play/pause */
  togglePlay(): void;
  /** Toggle loop on/off. No-op if looping not supported. */
  toggleLoop(): void;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/timeline/unified-playback-context.ts
git commit -m "feat(timeline): add UnifiedPlaybackContext interface"
```

---

### Task 2: Create and Test 2D Adapter

**Files:**
- Create: `tests/unit/timeline/animator-playback-adapter.test.ts`
- Create: `src/lib/shared/timeline/adapters/animator-playback-adapter.svelte.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/timeline/animator-playback-adapter.test.ts

import { describe, it, expect, vi } from "vitest";

// We'll test the pure computation functions exported for testing,
// since $derived runes require a Svelte component context.
import {
  computeOverallProgress,
  computeCurrentBeat,
  computeElapsed,
  computeSeekTarget,
} from "$lib/shared/timeline/adapters/animator-playback-adapter.svelte";

describe("animator-playback-adapter", () => {
  describe("computeOverallProgress", () => {
    it("returns 0 at step 1 (start of first beat)", () => {
      expect(computeOverallProgress(1, 4)).toBeCloseTo(0);
    });

    it("returns 0.5 at step 3 of 4 beats", () => {
      expect(computeOverallProgress(3, 4)).toBeCloseTo(0.5);
    });

    it("returns ~1 at the end of the last beat", () => {
      expect(computeOverallProgress(4.99, 4)).toBeCloseTo(0.9975);
    });

    it("returns 0 when currentStep < 1 (start position hold)", () => {
      expect(computeOverallProgress(0.5, 4)).toBe(0);
    });

    it("handles single-beat sequence", () => {
      expect(computeOverallProgress(1.5, 1)).toBeCloseTo(0.5);
    });

    it("clamps to 0 when totalSteps is 0", () => {
      expect(computeOverallProgress(1, 0)).toBe(0);
    });
  });

  describe("computeCurrentBeat", () => {
    it("returns 1 at step 1.0", () => {
      expect(computeCurrentBeat(1.0)).toBe(1);
    });

    it("returns 1 at step 1.5 (mid first beat)", () => {
      expect(computeCurrentBeat(1.5)).toBe(1);
    });

    it("returns 3 at step 3.2", () => {
      expect(computeCurrentBeat(3.2)).toBe(3);
    });

    it("returns 0 during start position hold", () => {
      expect(computeCurrentBeat(0.5)).toBe(0);
    });
  });

  describe("computeElapsed", () => {
    const durations = [1.0, 1.0, 1.0, 1.0]; // 4 beats, 1s each

    it("returns 0 at beat 1 start", () => {
      expect(computeElapsed(1.0, durations)).toBeCloseTo(0);
    });

    it("returns 0.5 at beat 1 midpoint", () => {
      expect(computeElapsed(1.5, durations)).toBeCloseTo(0.5);
    });

    it("returns 2.0 at beat 3 start", () => {
      expect(computeElapsed(3.0, durations)).toBeCloseTo(2.0);
    });

    it("handles variable durations", () => {
      const varDurations = [2.0, 1.0, 3.0]; // 6s total
      // Step 2.5 = start of beat 2 + 0.5 = 2.0s + 0.5 * 1.0s = 2.5s
      expect(computeElapsed(2.5, varDurations)).toBeCloseTo(2.5);
    });

    it("returns 0 during start position hold", () => {
      expect(computeElapsed(0.5, durations)).toBe(0);
    });
  });

  describe("computeSeekTarget", () => {
    it("maps 0 to step 1", () => {
      expect(computeSeekTarget(0, 4)).toBeCloseTo(1);
    });

    it("maps 0.5 to step 3", () => {
      expect(computeSeekTarget(0.5, 4)).toBeCloseTo(3);
    });

    it("maps 1 to the end", () => {
      expect(computeSeekTarget(1, 4)).toBeCloseTo(5);
    });

    it("clamps below 0", () => {
      expect(computeSeekTarget(-0.5, 4)).toBeCloseTo(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/timeline/animator-playback-adapter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the adapter**

```typescript
// src/lib/shared/timeline/adapters/animator-playback-adapter.svelte.ts

import type { UnifiedPlaybackContext } from "../unified-playback-context";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

// ── Pure computation functions (exported for testing) ──────────────────

export function computeOverallProgress(
  currentStep: number,
  totalSteps: number,
): number {
  if (totalSteps <= 0) return 0;
  if (currentStep < 1) return 0;
  return Math.min(1, (currentStep - 1) / totalSteps);
}

export function computeCurrentBeat(currentStep: number): number {
  if (currentStep < 1) return 0;
  return Math.floor(currentStep);
}

export function computeElapsed(
  currentStep: number,
  durations: number[],
): number {
  if (currentStep < 1 || durations.length === 0) return 0;
  const beatIndex = Math.floor(currentStep) - 1;
  const frac = currentStep - Math.floor(currentStep);
  let elapsed = 0;
  for (let i = 0; i < Math.min(beatIndex, durations.length); i++) {
    elapsed += durations[i];
  }
  if (beatIndex < durations.length) {
    elapsed += frac * durations[beatIndex];
  }
  return elapsed;
}

export function computeSeekTarget(progress: number, totalSteps: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return 1 + clamped * totalSteps;
}

// ── Adapter factory ────────────────────────────────────────────────────

export interface AnimatorPlaybackParams {
  getCurrentStep: () => number;
  getSteps: () => readonly StepData[];
  getIsPlaying: () => boolean;
  onSeek: (targetStep: number) => void;
  onTogglePlay: () => void;
}

export function createAnimatorPlaybackAdapter(
  params: AnimatorPlaybackParams,
): UnifiedPlaybackContext {
  return {
    get overallProgress() {
      return computeOverallProgress(
        params.getCurrentStep(),
        params.getSteps().length,
      );
    },
    get currentBeat() {
      return computeCurrentBeat(params.getCurrentStep());
    },
    get totalBeats() {
      return params.getSteps().length;
    },
    get isPlaying() {
      return params.getIsPlaying();
    },
    get isLooping() {
      return undefined;
    },
    get duration() {
      const steps = params.getSteps();
      return steps.reduce((sum, s) => sum + (s.duration ?? 1), 0);
    },
    get elapsed() {
      const steps = params.getSteps();
      const durations = steps.map((s) => s.duration ?? 1);
      return computeElapsed(params.getCurrentStep(), durations);
    },
    seek(progress: number) {
      const target = computeSeekTarget(progress, params.getSteps().length);
      params.onSeek(target);
    },
    togglePlay() {
      params.onTogglePlay();
    },
    toggleLoop() {
      // 2D engine doesn't expose loop toggle yet — no-op
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/timeline/animator-playback-adapter.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/timeline/adapters/animator-playback-adapter.svelte.ts tests/unit/timeline/animator-playback-adapter.test.ts
git commit -m "feat(timeline): add 2D animator playback adapter with tests"
```

---

### Task 3: Create and Test 3D Adapter

**Files:**
- Create: `tests/unit/timeline/avatar-playback-adapter.test.ts`
- Create: `src/lib/shared/timeline/adapters/avatar-playback-adapter.svelte.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/timeline/avatar-playback-adapter.test.ts

import { describe, it, expect, vi } from "vitest";

import {
  computeOverallProgress3D,
  computeSeek3D,
} from "$lib/shared/timeline/adapters/avatar-playback-adapter.svelte";

describe("avatar-playback-adapter", () => {
  describe("computeOverallProgress3D", () => {
    it("returns 0 at step 0, progress 0", () => {
      expect(computeOverallProgress3D(0, 0, 8)).toBeCloseTo(0);
    });

    it("returns correct progress mid-sequence", () => {
      // Step 3 of 8, 50% through the beat = (3 + 0.5) / 8 = 0.4375
      expect(computeOverallProgress3D(3, 0.5, 8)).toBeCloseTo(0.4375);
    });

    it("returns ~1 at last step, progress ~1", () => {
      expect(computeOverallProgress3D(7, 0.99, 8)).toBeCloseTo(0.99875);
    });

    it("returns 0 when totalSteps is 0", () => {
      expect(computeOverallProgress3D(0, 0, 0)).toBe(0);
    });

    it("handles single step", () => {
      expect(computeOverallProgress3D(0, 0.5, 1)).toBeCloseTo(0.5);
    });
  });

  describe("computeSeek3D", () => {
    it("maps 0 to step 0, progress 0", () => {
      const result = computeSeek3D(0, 8);
      expect(result.stepIndex).toBe(0);
      expect(result.stepProgress).toBeCloseTo(0);
    });

    it("maps 0.5 to step 4, progress 0", () => {
      const result = computeSeek3D(0.5, 8);
      expect(result.stepIndex).toBe(4);
      expect(result.stepProgress).toBeCloseTo(0);
    });

    it("maps 0.4375 to step 3, progress 0.5", () => {
      const result = computeSeek3D(0.4375, 8);
      expect(result.stepIndex).toBe(3);
      expect(result.stepProgress).toBeCloseTo(0.5);
    });

    it("clamps to last step at progress 1", () => {
      const result = computeSeek3D(1, 8);
      expect(result.stepIndex).toBe(7);
      expect(result.stepProgress).toBeCloseTo(1);
    });

    it("clamps negative to step 0", () => {
      const result = computeSeek3D(-0.5, 8);
      expect(result.stepIndex).toBe(0);
      expect(result.stepProgress).toBeCloseTo(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/timeline/avatar-playback-adapter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the adapter**

```typescript
// src/lib/shared/timeline/adapters/avatar-playback-adapter.svelte.ts

import type { UnifiedPlaybackContext } from "../unified-playback-context";

// ── Pure computation functions (exported for testing) ──────────────────

export function computeOverallProgress3D(
  currentStepIndex: number,
  beatProgress: number,
  totalSteps: number,
): number {
  if (totalSteps <= 0) return 0;
  return (currentStepIndex + beatProgress) / totalSteps;
}

export function computeSeek3D(
  progress: number,
  totalSteps: number,
): { stepIndex: number; stepProgress: number } {
  const clamped = Math.max(0, Math.min(1, progress));
  const raw = clamped * totalSteps;
  const stepIndex = Math.min(Math.floor(raw), totalSteps - 1);
  const stepProgress = raw - stepIndex;
  return { stepIndex, stepProgress };
}

// ── Avatar interface (subset of AvatarInstanceState we need) ──────────

export interface AvatarPlaybackHandle {
  readonly progress: number;
  readonly currentStepIndex: number;
  readonly totalSteps: number;
  readonly isPlaying: boolean;
  readonly speed: number;
  loop: boolean;
  togglePlay(): void;
  setProgress(value: number): void;
  goToStep(index: number): void;
}

// ── Adapter factory ────────────────────────────────────────────────────

export function createAvatarPlaybackAdapter(
  getAvatar: () => AvatarPlaybackHandle | null,
): UnifiedPlaybackContext {
  return {
    get overallProgress() {
      const av = getAvatar();
      if (!av) return 0;
      return computeOverallProgress3D(
        av.currentStepIndex,
        av.progress,
        av.totalSteps,
      );
    },
    get currentBeat() {
      const av = getAvatar();
      if (!av) return 0;
      return av.currentStepIndex + 1;
    },
    get totalBeats() {
      return getAvatar()?.totalSteps ?? 0;
    },
    get isPlaying() {
      return getAvatar()?.isPlaying ?? false;
    },
    get isLooping() {
      return getAvatar()?.loop ?? false;
    },
    get duration() {
      const av = getAvatar();
      if (!av || av.speed <= 0) return 0;
      return 1 / av.speed;
    },
    get elapsed() {
      const av = getAvatar();
      if (!av || av.speed <= 0) return 0;
      const totalSec = 1 / av.speed;
      return totalSec * this.overallProgress;
    },
    seek(progress: number) {
      const av = getAvatar();
      if (!av) return;
      const { stepIndex, stepProgress } = computeSeek3D(progress, av.totalSteps);
      av.goToStep(stepIndex);
      av.setProgress(stepProgress);
    },
    togglePlay() {
      getAvatar()?.togglePlay();
    },
    toggleLoop() {
      const av = getAvatar();
      if (av) av.loop = !av.loop;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/timeline/avatar-playback-adapter.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/timeline/adapters/avatar-playback-adapter.svelte.ts tests/unit/timeline/avatar-playback-adapter.test.ts
git commit -m "feat(timeline): add 3D avatar playback adapter with tests

Fixes per-beat progress bug: adapter computes overall progress as
(currentStepIndex + beatProgress) / totalSteps instead of using
raw per-beat progress."
```

---

### Task 4: Build UnifiedTimeline Component

**Files:**
- Create: `src/lib/shared/timeline/UnifiedTimeline.svelte`

- [ ] **Step 1: Create the glass pill component**

```svelte
<!-- src/lib/shared/timeline/UnifiedTimeline.svelte -->
<script lang="ts">
  import type { UnifiedPlaybackContext } from "./unified-playback-context";
  import { formatTime } from "$lib/shared/sequence-viewer/utils/format-time";

  let {
    playback,
    visible = true,
  }: {
    playback: UnifiedPlaybackContext;
    visible?: boolean;
  } = $props();

  const currentTimeLabel = $derived(formatTime(playback.elapsed));
  const totalTimeLabel = $derived(formatTime(playback.duration));

  const beatMarkers = $derived(
    playback.totalBeats > 1
      ? Array.from(
          { length: playback.totalBeats - 1 },
          (_, i) => (i + 1) / playback.totalBeats,
        )
      : ([] as number[]),
  );

  // ── Scrubber interaction ─────────────────────────────────────────────

  let scrubberEl: HTMLDivElement | undefined = $state();
  let isDragging = $state(false);

  function seekFromPointer(e: PointerEvent) {
    if (!scrubberEl) return;
    const rect = scrubberEl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    playback.seek(ratio);
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    isDragging = true;
    scrubberEl?.setPointerCapture(e.pointerId);
    seekFromPointer(e);
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    seekFromPointer(e);
  }

  function onPointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    scrubberEl?.releasePointerCapture(e.pointerId);
  }

  // ── Keyboard ─────────────────────────────────────────────────────────

  function onKeydown(e: KeyboardEvent) {
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      playback.togglePlay();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const step = 1 / Math.max(1, playback.totalBeats);
      playback.seek(Math.min(1, playback.overallProgress + step));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const step = 1 / Math.max(1, playback.totalBeats);
      playback.seek(Math.max(0, playback.overallProgress - step));
    }
  }
</script>

{#if visible && playback.totalBeats > 0}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="unified-timeline" role="group" aria-label="Playback transport" onkeydown={onKeydown}>
    <div class="transport-pill">
      <button
        class="pill-play"
        onclick={(e) => { e.stopPropagation(); playback.togglePlay(); }}
        aria-label={playback.isPlaying ? "Pause" : "Play"}
      >
        <i class="fas {playback.isPlaying ? 'fa-pause' : 'fa-play'}"></i>
      </button>

      <span class="pill-time">
        {currentTimeLabel} / {totalTimeLabel}
      </span>

      <div
        class="pill-track"
        bind:this={scrubberEl}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
        role="slider"
        tabindex="0"
        aria-label="Playback progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(playback.overallProgress * 100)}
      >
        <div class="pill-fill" style:width="{playback.overallProgress * 100}%"></div>
        {#each beatMarkers as pct (pct)}
          <div class="pill-beat-marker" style:left="{pct * 100}%"></div>
        {/each}
        <div class="pill-knob" style:left="{playback.overallProgress * 100}%"></div>
      </div>

      {#if playback.isLooping !== undefined}
        <button
          class="pill-loop"
          aria-pressed={playback.isLooping}
          aria-label="Loop {playback.isLooping ? 'on' : 'off'}"
          onclick={(e) => { e.stopPropagation(); playback.toggleLoop(); }}
        >
          <i class="fas fa-sync"></i>
        </button>
      {/if}
    </div>

    <div class="pill-context">
      beat {playback.currentBeat} of {playback.totalBeats}
    </div>
  </div>
{/if}

<style>
  .unified-timeline {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 12px 4px;
    box-sizing: border-box;
  }

  .transport-pill {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    width: 100%;
    max-width: 720px;
    box-sizing: border-box;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  /* ── Play button ─────────────────────────────────────────────── */

  .pill-play {
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    border-radius: 50%;
    background: #6366f1;
    border: 1px solid color-mix(in srgb, #6366f1 70%, white);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    flex-shrink: 0;
    padding: 0;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
    transition: transform 120ms ease, background 150ms ease;
  }

  .pill-play::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 48px;
    height: 48px;
    transform: translate(-50%, -50%);
  }

  .pill-play:hover {
    transform: scale(1.08);
    background: color-mix(in srgb, #6366f1 90%, white 10%);
  }

  .pill-play:active {
    transform: scale(0.94);
  }

  /* Optical centering for play triangle */
  .pill-play:has(> .fa-play) i {
    margin-left: 1.5px;
  }

  /* ── Time label ──────────────────────────────────────────────── */

  .pill-time {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.55);
    font-variant-numeric: tabular-nums;
    min-width: 80px;
    text-align: center;
    white-space: nowrap;
    user-select: none;
  }

  /* ── Track / scrubber ────────────────────────────────────────── */

  .pill-track {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    position: relative;
    cursor: pointer;
    min-width: 120px;
    touch-action: none;
  }

  .pill-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: #6366f1;
    border-radius: 999px;
    pointer-events: none;
  }

  .pill-knob {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    transform: translate(-50%, -50%);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }

  .pill-beat-marker {
    position: absolute;
    top: -2px;
    width: 1.5px;
    height: 10px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 1px;
    transform: translateX(-50%);
    pointer-events: none;
  }

  /* ── Loop toggle ─────────────────────────────────────────────── */

  .pill-loop {
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    border-radius: 50%;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.4);
    color: #818cf8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    flex-shrink: 0;
    padding: 0;
    transition: background 150ms ease;
  }

  .pill-loop[aria-pressed="false"] {
    background: transparent;
    color: rgba(255, 255, 255, 0.35);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .pill-loop:hover {
    background: rgba(99, 102, 241, 0.25);
  }

  /* ── Context label ───────────────────────────────────────────── */

  .pill-context {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.25);
    letter-spacing: 1px;
    text-transform: uppercase;
    text-align: center;
    margin-top: 6px;
    user-select: none;
  }

  /* ── Reduced motion ──────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .pill-play,
    .pill-loop {
      transition: none;
    }
    .pill-play:hover {
      transform: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "Error|error" | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/timeline/UnifiedTimeline.svelte
git commit -m "feat(timeline): add UnifiedTimeline glass pill component"
```

---

### Task 5: Integrate into AnimatorCanvas (2D Viewer)

**Files:**
- Modify: `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte`

- [ ] **Step 1: Add imports and create the adapter**

At the top of `<script>`, add the import:

```typescript
import UnifiedTimeline from "$lib/shared/timeline/UnifiedTimeline.svelte";
import { createAnimatorPlaybackAdapter } from "$lib/shared/timeline/adapters/animator-playback-adapter.svelte";
```

Remove the TransportBar import:

```typescript
// DELETE: import TransportBar from "./layers/TransportBar.svelte";
```

After the props destructuring block, create the adapter:

```typescript
const playbackAdapter = createAnimatorPlaybackAdapter({
  getCurrentStep: () => currentStep,
  getSteps: () => sequenceData?.steps ?? [],
  getIsPlaying: () => isPlaying,
  onSeek: (targetStep) => onProgressBarSeek?.(targetStep),
  onTogglePlay: () => onPlaybackToggle(),
});
```

- [ ] **Step 2: Replace TransportBar with UnifiedTimeline in the template**

Replace the `.progress-slot` block (lines ~660-674):

```svelte
<!-- BEFORE -->
<div class="progress-slot">
  <TransportBar
    steps={sequenceData?.steps ?? []}
    currentStep={currentStep}
    visible={progressBarVisible && !hideProgressBar}
    darkMode={darkModeEnabled}
    variant={progressBarVariant}
    showLabels={progressBarVariant === "labeled" || progressBarVariant === "gradient-labeled"}
    onSeek={onProgressBarSeek}
    onScrubStart={onProgressBarScrubStart}
    onScrubEnd={onProgressBarScrubEnd}
    {isPlaying}
    {onPlaybackToggle}
  />
</div>

<!-- AFTER -->
<div class="progress-slot">
  <UnifiedTimeline
    playback={playbackAdapter}
    visible={progressBarVisible && !hideProgressBar}
  />
</div>
```

- [ ] **Step 3: Remove the `.canvas-play-btn` overlay**

Delete the play button block (lines ~583-597):

```svelte
<!-- DELETE THIS ENTIRE BLOCK -->
{#if onPlaybackToggle && !hideProgressBar && sequenceData}
  <button
    type="button"
    class="canvas-play-btn"
    ...
  >
    ...
  </button>
{/if}
```

Delete all `.canvas-play-btn` CSS rules (lines ~764-852):

```css
/* DELETE: .canvas-play-btn { ... } through @media (prefers-reduced-motion) block */
```

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run check`
Expected: no errors related to UnifiedTimeline or TransportBar

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: clean build

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/components/AnimatorCanvas.svelte
git commit -m "feat(timeline): integrate UnifiedTimeline into 2D viewer

Replaces TransportBar + canvas play button overlay with the unified
glass pill transport bar. Play/pause is now inside the pill."
```

---

### Task 6: Integrate into Viewer3DCanvas (3D Viewer)

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DCanvas.svelte`

- [ ] **Step 1: Add imports and create the adapter**

Replace ViewerTransportBar import:

```typescript
// DELETE: import ViewerTransportBar from "$lib/shared/sequence-viewer/components/ViewerTransportBar.svelte";

// ADD:
import UnifiedTimeline from "$lib/shared/timeline/UnifiedTimeline.svelte";
import { createAvatarPlaybackAdapter } from "$lib/shared/timeline/adapters/avatar-playback-adapter.svelte";
```

After the existing derived state, create the adapter. The avatar is accessed via context in the current ViewerTransportBar, but since Viewer3DCanvas already has `avatarState` from context (`getViewer3DContext()`), create the adapter here:

```typescript
const viewer = getViewer3DContext();
const playbackAdapter = createAvatarPlaybackAdapter(
  () => viewer.performerManager.performers[0] ?? null,
);
```

Note: `viewer` is already declared in the existing code at line 23. Just add the adapter creation after it.

- [ ] **Step 2: Replace ViewerTransportBar in the template**

Change line 153:

```svelte
<!-- BEFORE -->
<ViewerTransportBar />

<!-- AFTER -->
<UnifiedTimeline playback={playbackAdapter} />
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run check`

The `AvatarPlaybackHandle` interface expects: `progress`, `currentStepIndex`, `totalSteps`, `isPlaying`, `speed`, `loop`, `togglePlay()`, `setProgress()`, `goToStep()`. Verify these are all exposed on the avatar instance state return object. If there's a type mismatch, the adapter's `getAvatar` param accepts `AvatarPlaybackHandle | null`, and the avatar's public API matches this shape.

Expected: no errors

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: clean build

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DCanvas.svelte
git commit -m "fix(timeline): integrate UnifiedTimeline into 3D viewer

Replaces ViewerTransportBar with the unified glass pill. Fixes the
per-beat progress bug: scrubber now shows overall sequence progress
instead of cycling 0-100% per beat."
```

---

### Task 7: Remove Dead Components

**Files:**
- Remove: `src/lib/shared/animation-engine/components/layers/TransportBar.svelte`
- Remove: `src/lib/shared/sequence-viewer/components/ViewerTransportBar.svelte`

- [ ] **Step 1: Verify no remaining imports of TransportBar**

Run: `grep -r "TransportBar" src/ --include="*.svelte" --include="*.ts" -l`

Expected: no results (AnimatorCanvas was updated in Task 5). If any file still imports TransportBar, update it before deleting.

- [ ] **Step 2: Verify no remaining imports of ViewerTransportBar**

Run: `grep -r "ViewerTransportBar" src/ --include="*.svelte" --include="*.ts" -l`

Expected: no results (Viewer3DCanvas was updated in Task 6).

- [ ] **Step 3: Verify SegmentedSequenceProgressBar is still imported elsewhere**

Run: `grep -r "SegmentedSequenceProgressBar" src/ --include="*.svelte" --include="*.ts" -l`

Expected: at least DisassembleCanvasView, DisassembleTransition, DisassembleLayout, and the test page still import it. Do NOT delete this file.

- [ ] **Step 4: Delete dead files**

```bash
rm src/lib/shared/animation-engine/components/layers/TransportBar.svelte
rm src/lib/shared/sequence-viewer/components/ViewerTransportBar.svelte
```

- [ ] **Step 5: Verify build still passes**

Run: `npm run build`
Expected: clean build

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: all tests pass (including the new adapter tests from Tasks 2-3)

- [ ] **Step 7: Commit**

```bash
git add -u
git commit -m "chore(timeline): remove TransportBar and ViewerTransportBar

Both replaced by UnifiedTimeline. SegmentedSequenceProgressBar kept
for DisassembleCanvasView/Transition/Layout consumers."
```

---

### Task 8: Final Verification

- [ ] **Step 1: Full typecheck**

Run: `npm run check`
Expected: clean

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: clean

- [ ] **Step 3: Full test suite**

Run: `npx vitest run`
Expected: all pass

- [ ] **Step 4: Manual verification note**

Cannot verify visually without browser. Tell the user:

> "I cannot verify the glass pill rendering visually. Please check:
> 1. Load a sequence in the 2D viewer — glass pill should appear at the bottom with play/pause, time label, scrubber with beat markers, and no loop button
> 2. Load a sequence in the 3D viewer — same glass pill should appear with loop button, and the scrubber should fill across the entire sequence (not per-beat)
> 3. Click the scrubber track to seek, drag the knob, press Space to play/pause
> 4. In the 3D viewer, toggle loop on/off"
