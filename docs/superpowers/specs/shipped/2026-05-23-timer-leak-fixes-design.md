# Timer Leak Fixes

## Problem

Three categories of timer leak exist in the codebase. Each wastes CPU, risks stale state mutations, and in the rAF cases burns battery when the tab is backgrounded.

---

## 1. village-visual-state.svelte.ts — `triggerRelight` stacking

**File:** `src/lib/features/village/state/village-visual-state.svelte.ts`
**Lines:** 141-148

`triggerRelight()` fires a `setTimeout` to remove a sequenceId from `relightingMonuments` after 1300ms. The timer ID is never stored. If `triggerRelight` is called rapidly for the same sequenceId (e.g. multiple reincarnation events on one monument), each call adds its own 1300ms timer. The first one to fire removes the id, and the subsequent ones silently call `filter` on an already-removed id -- harmless but wasteful. Worse, if a different rapid-fire pattern causes the set to be rebuilt between firings, the late timers mutate stale state.

### Fix

Store a `Map<string, ReturnType<typeof setTimeout>>` keyed by sequenceId. On each call, clear any existing timer for that sequenceId before scheduling a new one.

```ts
// Add at module scope, inside createVillageVisualState():
const relightTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Replace triggerRelight:
triggerRelight(sequenceId: string) {
  // Cancel any pending relight for this monument
  const existing = relightTimers.get(sequenceId);
  if (existing !== undefined) clearTimeout(existing);

  relightingMonuments = new Set([...relightingMonuments, sequenceId]);

  const timerId = setTimeout(() => {
    relightTimers.delete(sequenceId);
    relightingMonuments = new Set(
      [...relightingMonuments].filter((id) => id !== sequenceId),
    );
  }, 1300);

  relightTimers.set(sequenceId, timerId);
},
```

No disposal cleanup is needed here because `createVillageVisualState()` returns a plain object with no lifecycle -- the timers self-clean after 1300ms and the Map is GC'd with the state object. If a disposal method is added later, iterate the map and clear all timers.

---

## 2. connect-state.svelte.ts — untracked `setTimeout` calls

**File:** `src/lib/features/connect/state/connect-state.svelte.ts`

### 2a. Line 167 — `onSessionClosed` error auto-clear

```ts
setTimeout(() => {
  this._connectionError = null;
}, 5000);
```

If `onSessionClosed` fires multiple times before the 5000ms expires (e.g. rapid reconnect attempts), multiple timers stack and the last one wins by coincidence. If `cleanup()` runs while a timer is pending, the callback mutates state on a destroyed instance.

### 2b. Line 369 — `refresh()` loading spinner

```ts
setTimeout(() => {
  this._isLoading = false;
}, 500);
```

Same class of bug: rapid `refresh()` calls stack timers, and `cleanup()` does not cancel the pending timeout.

### Fix

Add two private timer-ID fields and cancel-on-re-invocation + cancel-on-cleanup logic.

```ts
class ConnectState {
  // ... existing fields ...
  private _errorClearTimer: ReturnType<typeof setTimeout> | null = null;
  private _loadingTimer: ReturnType<typeof setTimeout> | null = null;

  // In the onSessionClosed callback (line ~166):
  if (this._errorClearTimer !== null) clearTimeout(this._errorClearTimer);
  this._errorClearTimer = setTimeout(() => {
    this._errorClearTimer = null;
    this._connectionError = null;
  }, 5000);

  // In refresh() (line ~368):
  if (this._loadingTimer !== null) clearTimeout(this._loadingTimer);
  this._loadingTimer = setTimeout(() => {
    this._loadingTimer = null;
    this._isLoading = false;
  }, 500);

  // In cleanup():
  if (this._errorClearTimer !== null) {
    clearTimeout(this._errorClearTimer);
    this._errorClearTimer = null;
  }
  if (this._loadingTimer !== null) {
    clearTimeout(this._loadingTimer);
    this._loadingTimer = null;
  }
}
```

---

## 3. rAF loops running unconditionally when tab is backgrounded

Three components run `requestAnimationFrame` loops that continue when the tab is hidden:

| Component | File | Loop location |
|---|---|---|
| PovSpinPreview | `src/lib/features/poi/components/PovSpinPreview.svelte` | `$effect` at line 118, rAF at line 360 |
| LedStaffPreview | `src/lib/features/poi/components/LedStaffPreview.svelte` | `$effect` at line 40, rAF at line 134 |
| PatternTimeline | `src/lib/features/poi/components/PatternTimeline.svelte` | `$effect` at line 63, rAF at line 74 |

Modern browsers already throttle rAF to ~1fps when a tab is backgrounded, but these loops still consume CPU, keep the event loop busy, and prevent the tab process from entering a low-power state. On mobile this is measurable battery drain.

All three follow the same structural pattern:
1. `$effect` creates a `draw`/`tick` closure
2. The closure calls `requestAnimationFrame(draw)` at the end
3. The `$effect` returns a cleanup that calls `cancelAnimationFrame`

The fix for all three is identical: check `document.hidden` at the top of the rAF callback. If hidden, skip work and do not re-schedule -- instead, listen for `visibilitychange` to resume.

### Per-component inline fix pattern

```ts
$effect(() => {
  const canvas = canvasRef;
  if (!canvas) return;

  const ctx = canvas.getContext("2d")!;
  let rafId = 0;
  let paused = false;
  // ... existing state vars ...

  function draw() {
    if (document.hidden) {
      paused = true;
      return; // Don't re-schedule -- visibilitychange will restart
    }
    // ... existing draw body ...
    rafId = requestAnimationFrame(draw);
  }

  function onVisibilityChange() {
    if (!document.hidden && paused) {
      paused = false;
      prevTime = performance.now(); // Reset dt so we don't get a massive jump
      rafId = requestAnimationFrame(draw);
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  rafId = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(rafId);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
});
```

### Component-specific notes

**PovSpinPreview:** The `prevTime` and `staffAngle` variables are inside the `$effect` closure. Reset `prevTime = performance.now()` in the visibility resume path so the spin doesn't jump forward by however long the tab was hidden.

**LedStaffPreview:** Same `prevTime` / `cyclePos` pattern. Reset `prevTime` on resume. `cyclePos` should NOT be reset -- the pattern should continue from where it was, just without a large dt spike.

**PatternTimeline:** The rAF loop is conditionally active (only when `isPlaying`). The `$effect` already returns early when `!isPlaying`, so the visibility guard only needs to cover the playing case. The `prevTime` reset on resume prevents the playhead from jumping.

---

## 4. Reusable utility: `useAnimationLoop`

With 30+ components using `requestAnimationFrame` across the codebase, a shared utility prevents repeating the visibility-pause pattern everywhere.

**Target file:** `src/lib/shared/utils/use-animation-loop.ts`

### API

```ts
export interface AnimationLoopOptions {
  /** Called each visible frame with delta time in seconds */
  onTick: (dt: number) => void;
  /**
   * When true, the loop runs. When false, pauses.
   * Reactive -- pass a getter or a $derived.
   * Default: true.
   */
  active?: boolean;
}

/**
 * Svelte 5 rune-compatible animation loop with automatic
 * visibility-change pausing. Use inside a $effect or
 * component script block.
 *
 * Returns a cleanup function (also registers with onDestroy
 * if called during component init).
 */
export function useAnimationLoop(options: AnimationLoopOptions): () => void;
```

### Implementation sketch

```ts
export function useAnimationLoop(options: AnimationLoopOptions): () => void {
  let rafId = 0;
  let prevTime = 0;
  let running = false;

  function tick() {
    if (document.hidden) {
      running = false;
      return;
    }
    const now = performance.now();
    const dt = prevTime === 0 ? 0 : (now - prevTime) / 1000;
    prevTime = now;
    options.onTick(dt);
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    prevTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function onVisibility() {
    if (document.hidden) {
      stop();
    } else if (options.active !== false) {
      start();
    }
  }

  document.addEventListener("visibilitychange", onVisibility);

  if (options.active !== false) {
    start();
  }

  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
```

### Migration path

The three POI components are the immediate targets. Other components (AnimatorCanvas, WorldScene, InteractiveGrid, etc.) can migrate opportunistically -- no big-bang rewrite needed. The utility is purely additive.

---

## Verification plan

1. **triggerRelight:** Call `triggerRelight("test")` 5 times in rapid succession via console. Confirm `relightingMonuments` contains exactly one entry, not five stacked timers. After 1300ms the set should be empty.
2. **connect-state:** Call `refresh()` 10 times rapidly. Confirm `_isLoading` goes false exactly once after 500ms, not 10 separate toggles. Call `cleanup()` while a timer is pending -- confirm no console errors or state mutations after cleanup.
3. **rAF visibility:** Open PovSpinPreview, switch to another tab for 5 seconds, switch back. Confirm the spin resumes smoothly from where it was (no jump). Confirm via Performance tab that rAF callbacks are not firing while the tab is hidden.
4. **useAnimationLoop:** Unit test that `onTick` is not called when `document.hidden` is mocked as `true`. Integration test that `start`/`stop` lifecycle works with the cleanup function.

## Files to change

| File | Change |
|---|---|
| `src/lib/features/village/state/village-visual-state.svelte.ts` | Timer map for relight |
| `src/lib/features/connect/state/connect-state.svelte.ts` | Two timer-ID fields + cleanup |
| `src/lib/features/poi/components/PovSpinPreview.svelte` | Visibility guard in rAF loop |
| `src/lib/features/poi/components/LedStaffPreview.svelte` | Visibility guard in rAF loop |
| `src/lib/features/poi/components/PatternTimeline.svelte` | Visibility guard in rAF loop |
| `src/lib/shared/utils/use-animation-loop.ts` | New reusable utility |
