# Viewer-Scoped Motion Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift blue/red motion visibility out of the two singleton state managers, relocate it to a new ephemeral viewer-scoped state, add a top-right header toggle that drives ChoreoCard + AnimationPlayer + 3D viewer simultaneously, and surgically remove the old fields from both VMs plus every downstream reader and writer.

**Architecture:** A new `SequenceViewerVisibilityState` class (Svelte 5 `$state`) is constructed once by `SequenceViewerOrchestrator` and distributed via Svelte context under a dedicated symbol key. The orchestrator observes changes and pushes them into `AnimationEngine` (via a new method) and into the 3D avatar driver (by passing `null` for hidden-side props to `setPropsAndBlend`, which already zeroes the IK weight). Pictograph VM and Animation VM lose their `blueMotion`/`redMotion` fields and every reader in the app drops the visibility check (always renders).

**Tech Stack:** Svelte 5 runes ($state, $derived, $effect), SvelteKit context API, Vitest for unit tests, existing AvatarAnimator IK weight semantics.

---

## File Structure

**Create:**
- `src/lib/shared/sequence-viewer/state/viewer-visibility-state.svelte.ts` — the new state class
- `src/lib/shared/sequence-viewer/state/viewer-visibility-state.test.ts` — unit tests
- `src/lib/shared/sequence-viewer/context/viewer-visibility-context.ts` — context helpers
- `src/lib/shared/sequence-viewer/components/MotionVisibilityToggle.svelte` — header button + popover

**Modify (viewer wiring):**
- `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` — construct state, setContext, reset on sequence change, propagate to engine
- `src/lib/shared/sequence-viewer/components/RouteViewerHeader.svelte` — slot button in right region next to Copy-for-Claude
- `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte` — swap VM reads for context reads
- `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` — add `setMotionVisibility(blue, red)` method, remove VM reads
- `src/lib/shared/3d/components/Avatar3D.svelte` — zero out props for hidden sides when driving `setPropsAndBlend`

**Modify (writer removals — UI):**
- `src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte` — remove motion chips and surrounding plumbing
- `src/lib/shared/settings/components/tabs/VisibilityTab.svelte` — remove motion chips and plumbing
- `src/lib/features/create/shared/components/coordinators/SequenceDrawerHost.svelte` — remove motion toggle wiring
- `src/lib/shared/animation-engine/components/AnimationShareDrawer.svelte` — remove motion toggle wiring
- `src/lib/features/compose/components/controls/settings-panel/VisualPane.svelte` — remove motion toggle wiring
- `src/lib/shared/video-record/components/VideoRecordSettingsSheet.svelte` — remove motion visibility state
- `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuBuilder.ts` — remove Blue/Red motion menu items

**Modify (reader removals — render code):**
- `src/lib/shared/pictograph/shared/components/PictographContainer.svelte` — drop motion visibility in the options object
- `src/lib/shared/pictograph/option/OptionPictograph.svelte` — drop motion visibility state

**Modify (VM cleanup):**
- `src/lib/shared/pictograph/shared/state/visibility-state.svelte.ts` — delete `blueMotion`/`redMotion` fields and all motion-visibility methods
- `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts` — delete `blueMotion`/`redMotion` fields and `syncFromPictographVisibility`
- `src/lib/shared/animation-engine/services/implementations/AnimationVisibilitySynchronizer.ts` — drop motion keys from getState
- `src/lib/shared/animation-engine/services/contracts/IAnimationVisibilitySynchronizer.ts` — update type
- `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts` — render loop still accepts `blueMotionVisible`/`redMotionVisible` on params (now supplied by engine from the new state) — no structural change

**Out of scope:** `example-data.ts`, `PictographPanel.svelte` visibility preview demos — they're sample data, not runtime paths.

---

## Phase 1 — Foundation: State, Context, Tests

### Task 1: Create `SequenceViewerVisibilityState`

**Files:**
- Create: `src/lib/shared/sequence-viewer/state/viewer-visibility-state.svelte.ts`

- [ ] **Step 1: Write the state class**

```ts
/**
 * SequenceViewerVisibilityState
 *
 * Ephemeral per-viewer state for motion visibility. Not persisted to
 * localStorage. One instance per SequenceViewerOrchestrator mount,
 * provided to children via Svelte context.
 *
 * Reset semantics: caller invokes reset() when the sequence changes.
 * Constraint: at least one motion must remain visible — toggling off
 * the last visible motion automatically flips the other on.
 */
export class SequenceViewerVisibilityState {
  blueMotion = $state(true);
  redMotion = $state(true);

  setBlueMotion(visible: boolean): void {
    if (!visible && !this.redMotion) {
      this.blueMotion = false;
      this.redMotion = true;
      return;
    }
    this.blueMotion = visible;
  }

  setRedMotion(visible: boolean): void {
    if (!visible && !this.blueMotion) {
      this.redMotion = false;
      this.blueMotion = true;
      return;
    }
    this.redMotion = visible;
  }

  toggleBlue(): void {
    this.setBlueMotion(!this.blueMotion);
  }

  toggleRed(): void {
    this.setRedMotion(!this.redMotion);
  }

  reset(): void {
    this.blueMotion = true;
    this.redMotion = true;
  }

  /** True when exactly one motion is visible. */
  get isSolo(): boolean {
    return this.blueMotion !== this.redMotion;
  }

  /** The visible color when isSolo, otherwise undefined. */
  get soloColor(): "blue" | "red" | undefined {
    if (!this.isSolo) return undefined;
    return this.blueMotion ? "blue" : "red";
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/sequence-viewer/state/viewer-visibility-state.svelte.ts
git commit -m "feat(viewer): add SequenceViewerVisibilityState

Ephemeral per-viewer state for motion visibility. Enforces the
at-least-one-visible constraint. Provides isSolo/soloColor derived
accessors for downstream consumers."
```

---

### Task 2: Unit-test the state class

**Files:**
- Create: `src/lib/shared/sequence-viewer/state/viewer-visibility-state.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { SequenceViewerVisibilityState } from "./viewer-visibility-state.svelte";

describe("SequenceViewerVisibilityState", () => {
  it("starts with both motions visible", () => {
    const s = new SequenceViewerVisibilityState();
    expect(s.blueMotion).toBe(true);
    expect(s.redMotion).toBe(true);
  });

  it("setBlueMotion(false) hides blue when red is visible", () => {
    const s = new SequenceViewerVisibilityState();
    s.setBlueMotion(false);
    expect(s.blueMotion).toBe(false);
    expect(s.redMotion).toBe(true);
  });

  it("setRedMotion(false) hides red when blue is visible", () => {
    const s = new SequenceViewerVisibilityState();
    s.setRedMotion(false);
    expect(s.blueMotion).toBe(true);
    expect(s.redMotion).toBe(false);
  });

  it("hiding the last visible motion flips the other on", () => {
    const s = new SequenceViewerVisibilityState();
    s.setBlueMotion(false);
    // red is the only visible one — hiding it should flip blue back on
    s.setRedMotion(false);
    expect(s.blueMotion).toBe(true);
    expect(s.redMotion).toBe(false);
  });

  it("toggleBlue flips blue visibility", () => {
    const s = new SequenceViewerVisibilityState();
    s.toggleBlue();
    expect(s.blueMotion).toBe(false);
    s.toggleBlue();
    expect(s.blueMotion).toBe(true);
  });

  it("reset restores both motions to visible", () => {
    const s = new SequenceViewerVisibilityState();
    s.setBlueMotion(false);
    s.reset();
    expect(s.blueMotion).toBe(true);
    expect(s.redMotion).toBe(true);
  });

  it("isSolo is true when exactly one motion is visible", () => {
    const s = new SequenceViewerVisibilityState();
    expect(s.isSolo).toBe(false);
    s.setBlueMotion(false);
    expect(s.isSolo).toBe(true);
    s.setBlueMotion(true);
    expect(s.isSolo).toBe(false);
  });

  it("soloColor returns the visible color when solo", () => {
    const s = new SequenceViewerVisibilityState();
    expect(s.soloColor).toBeUndefined();
    s.setBlueMotion(false);
    expect(s.soloColor).toBe("red");
    s.setBlueMotion(true);
    s.setRedMotion(false);
    expect(s.soloColor).toBe("blue");
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- src/lib/shared/sequence-viewer/state/viewer-visibility-state.test.ts`
Expected: all 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/state/viewer-visibility-state.test.ts
git commit -m "test(viewer): cover motion visibility state constraints"
```

---

### Task 3: Create context helpers

**Files:**
- Create: `src/lib/shared/sequence-viewer/context/viewer-visibility-context.ts`

- [ ] **Step 1: Write the context module**

```ts
/**
 * Viewer Visibility Context
 *
 * Distributes SequenceViewerVisibilityState to descendant components
 * via Svelte context. Modeled after viewer-3d-context.ts.
 */

import { getContext, setContext } from "svelte";
import type { SequenceViewerVisibilityState } from "../state/viewer-visibility-state.svelte";

const KEY = Symbol("sequence-viewer-visibility");

export function setViewerVisibilityContext(state: SequenceViewerVisibilityState): void {
  setContext(KEY, state);
}

export function getViewerVisibilityContext(): SequenceViewerVisibilityState {
  const ctx = getContext<SequenceViewerVisibilityState | undefined>(KEY);
  if (!ctx) {
    throw new Error(
      "Viewer visibility context missing — component must be rendered inside SequenceViewerOrchestrator",
    );
  }
  return ctx;
}

/**
 * Attempt to get the context, returning null when absent.
 * Use in shared components that may render outside the viewer
 * (e.g., ChoreoCard also used in browse previews).
 */
export function tryGetViewerVisibilityContext(): SequenceViewerVisibilityState | null {
  try {
    return getContext<SequenceViewerVisibilityState | undefined>(KEY) ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/sequence-viewer/context/viewer-visibility-context.ts
git commit -m "feat(viewer): add context helpers for viewer visibility state"
```

---

## Phase 2 — UI: Motion Visibility Toggle Component

### Task 4: Create `MotionVisibilityToggle.svelte`

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/MotionVisibilityToggle.svelte`

- [ ] **Step 1: Write the component**

```svelte
<!--
  MotionVisibilityToggle.svelte

  Icon button in the sequence viewer header. Shows two prop silhouettes:
  the hidden side is rendered grey. Click opens a popover with two chips
  (Blue, Red) that toggle each color's visibility.

  Reads/writes SequenceViewerVisibilityState via context.
-->
<script lang="ts">
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";
  import { getViewerVisibilityContext } from "../context/viewer-visibility-context";

  const visibility = getViewerVisibilityContext();
  let open = $state(false);

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function close() {
    open = false;
  }

  function onDocumentClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as HTMLElement;
    if (!target.closest(".motion-vis-root")) close();
  }

  $effect(() => {
    if (!open) return;
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  });
</script>

<div class="motion-vis-root">
  <button
    type="button"
    class="motion-vis-btn"
    onclick={toggle}
    aria-label="Motion visibility"
    aria-expanded={open}
    aria-haspopup="dialog"
  >
    <span
      class="prop-silhouette blue"
      class:muted={!visibility.blueMotion}
      aria-hidden="true"
    ></span>
    <span
      class="prop-silhouette red"
      class:muted={!visibility.redMotion}
      aria-hidden="true"
    ></span>
  </button>

  {#if open}
    <div
      class="motion-vis-popover"
      role="dialog"
      aria-label="Motion visibility"
      in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
      out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
    >
      <button
        type="button"
        class="chip blue"
        class:active={visibility.blueMotion}
        onclick={() => visibility.toggleBlue()}
        aria-pressed={visibility.blueMotion}
      >
        Blue
      </button>
      <button
        type="button"
        class="chip red"
        class:active={visibility.redMotion}
        onclick={() => visibility.toggleRed()}
        aria-pressed={visibility.redMotion}
      >
        Red
      </button>
    </div>
  {/if}
</div>

<style>
  .motion-vis-root { position: relative; }

  .motion-vis-btn {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: transparent;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    gap: 3px;
    padding: 0 6px;
  }
  .motion-vis-btn:hover { background: rgba(255, 255, 255, 0.06); }

  .prop-silhouette {
    width: 4px;
    height: 18px;
    border-radius: 2px;
    transition: background 160ms ease, opacity 160ms ease;
  }
  .prop-silhouette.blue { background: var(--prop-blue, #2196f3); }
  .prop-silhouette.red  { background: var(--prop-red, #f44336); }
  .prop-silhouette.muted {
    background: rgba(255, 255, 255, 0.25);
    opacity: 0.55;
  }

  .motion-vis-popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 140px;
    padding: 8px;
    background: rgba(20, 22, 32, 0.95);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    display: flex;
    gap: 6px;
    z-index: 20;
  }

  .chip {
    flex: 1;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: transparent;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
  }
  .chip:hover { background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.95); }
  .chip.blue.active {
    background: color-mix(in srgb, var(--prop-blue, #2196f3) 22%, transparent);
    border-color: var(--prop-blue, #2196f3);
    color: #fff;
  }
  .chip.red.active {
    background: color-mix(in srgb, var(--prop-red, #f44336) 22%, transparent);
    border-color: var(--prop-red, #f44336);
    color: #fff;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/MotionVisibilityToggle.svelte
git commit -m "feat(viewer): add MotionVisibilityToggle header button + popover"
```

---

## Phase 3 — Viewer Wiring: Orchestrator, Header, Consumers

### Task 5: Orchestrator constructs + provides state + resets on sequence change

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`

- [ ] **Step 1: Add the import + state construction near the top of the `<script>` section (after existing imports)**

Locate the instance `<script lang="ts">` block (not the `module` one). Add near the other state declarations:

```ts
import { SequenceViewerVisibilityState } from "../state/viewer-visibility-state.svelte";
import { setViewerVisibilityContext } from "../context/viewer-visibility-context";

const viewerVisibility = new SequenceViewerVisibilityState();
setViewerVisibilityContext(viewerVisibility);
```

- [ ] **Step 2: Add a `$effect` that resets on sequence change**

After the state construction:

```ts
$effect(() => {
  // Reset motion visibility whenever the sequence identity changes
  void sequence?.id;
  viewerVisibility.reset();
});
```

Note: `sequence` is an existing prop on the orchestrator.

- [ ] **Step 3: Expose `viewerVisibility` on the orchestrator context so children that can't use Svelte context (e.g., downstream service integrations) can reach it**

In the `OrchestratorContext` interface (module `<script>` block), add:

```ts
/** Per-viewer motion visibility state (ephemeral, resets on sequence change) */
viewerVisibility: SequenceViewerVisibilityState;
```

And in the context object construction (search for where the snippet receives `ctx`), include:

```ts
viewerVisibility,
```

- [ ] **Step 4: Verify no other reset path exists that might fight the effect**

Run: `npm run check`
Expected: clean or pre-existing warnings only.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "feat(viewer): orchestrator constructs + provides motion visibility state"
```

---

### Task 6: Place MotionVisibilityToggle in RouteViewerHeader

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/RouteViewerHeader.svelte`

- [ ] **Step 1: Import the toggle at the top of `<script>`**

```ts
import MotionVisibilityToggle from "./MotionVisibilityToggle.svelte";
```

- [ ] **Step 2: Render the toggle to the left of the Copy-for-Claude button**

In the header template, find the right-side button cluster (the one containing `handleCopyForClaude`). Insert `<MotionVisibilityToggle />` immediately before that Copy button so the visual order in the top-right is: **[Motion] [Copy for Claude] [...]**.

If the existing markup looks like:
```svelte
<button class="route-copy-btn" onclick={handleCopyForClaude}>…</button>
```
change it to:
```svelte
<MotionVisibilityToggle />
<button class="route-copy-btn" onclick={handleCopyForClaude}>…</button>
```

- [ ] **Step 3: Manual verify**

Run dev server verification: `curl localhost:5173/sequence/any-existing-id` to ensure no 500 error, then ask user to eyeball the header.

Announce to user: **"I cannot verify the header visually. Please open a sequence viewer, look at the top-right header area, and confirm the two-prop silhouette button appears to the left of Copy-for-Claude."**

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/RouteViewerHeader.svelte
git commit -m "feat(viewer): place MotionVisibilityToggle in route header"
```

---

### Task 7: Wire ChoreoCard to read from context instead of pictograph VM

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`

ChoreoCard currently reads motion visibility via the pictograph VM observer pattern (registered at ~lines 282–292, derived at 297–304). Swap that for context.

- [ ] **Step 1: Import the context getter**

Near the other imports in the `<script>`:

```ts
import { tryGetViewerVisibilityContext } from "../context/viewer-visibility-context";
```

Use `tryGet…` rather than the strict getter because ChoreoCard is also consumed outside the viewer (browse previews).

- [ ] **Step 2: Replace the VM-based derivation with context-or-fallback**

Locate the block (around line 282):

```ts
  const vm = getVisibilityStateManager();
  let motionVisibilityVersion = $state(0);
  let glyphVisibilityVersion = $state(0);
  function onMotionVisibilityChanged(): void { motionVisibilityVersion++; }
  function onGlyphVisibilityChanged(): void { glyphVisibilityVersion++; }
  vm.registerObserver(onMotionVisibilityChanged, ["motion"]);
  vm.registerObserver(onGlyphVisibilityChanged, ["glyph"]);
  onDestroy(() => {
    vm.unregisterObserver(onMotionVisibilityChanged);
    vm.unregisterObserver(onGlyphVisibilityChanged);
  });
  const allMotionsVisible = $derived.by(() => {
    void motionVisibilityVersion;
    return vm.areAllMotionsVisible();
  });
  const showBlueMotion = $derived.by(() => {
    void motionVisibilityVersion;
    return vm.getMotionVisibility(MotionColor.BLUE);
  });
  const showRedMotion = $derived.by(() => {
    void motionVisibilityVersion;
    return vm.getMotionVisibility(MotionColor.RED);
  });
```

Replace with:

```ts
  const vm = getVisibilityStateManager();
  let glyphVisibilityVersion = $state(0);
  function onGlyphVisibilityChanged(): void { glyphVisibilityVersion++; }
  vm.registerObserver(onGlyphVisibilityChanged, ["glyph"]);
  onDestroy(() => {
    vm.unregisterObserver(onGlyphVisibilityChanged);
  });

  // Motion visibility: viewer-scoped. When rendered outside a viewer
  // (browse previews, export pipeline), fall back to always-visible.
  const viewerVisibility = tryGetViewerVisibilityContext();
  const showBlueMotion = $derived(viewerVisibility?.blueMotion ?? true);
  const showRedMotion = $derived(viewerVisibility?.redMotion ?? true);
  const allMotionsVisible = $derived(showBlueMotion && showRedMotion);
```

- [ ] **Step 3: Remove the now-unused `MotionColor` import if no other reference remains**

Search the file for `MotionColor`. If the only remaining references were the three deleted derivations, remove the import. Otherwise leave it.

- [ ] **Step 4: Type check**

Run: `npm run check`
Expected: 0 errors (existing warnings OK).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ChoreoCard.svelte
git commit -m "refactor(viewer): ChoreoCard reads motion visibility from context"
```

---

### Task 8: AnimationEngine accepts motion visibility as a direct method; orchestrator wires it

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`

The engine currently subscribes to the Animation VM and extracts `blueMotion`/`redMotion` from its state. Replace with an explicit `setMotionVisibility(blue, red)` method driven by the orchestrator.

- [ ] **Step 1: Add `setMotionVisibility` to AnimationEngine**

Search for a good spot near the other public setters (e.g., near line 554 where `blueMotion`/`redMotion` appear in state). Add:

```ts
/**
 * Update motion visibility from the viewer-scoped state.
 * Called by SequenceViewerOrchestrator whenever the user toggles
 * Blue/Red in the header popover. Mutates the engine's internal
 * visibilityState so the next render frame reflects it.
 */
setMotionVisibility(blue: boolean, red: boolean): void {
  if (
    this.state.visibilityState.blueMotion === blue &&
    this.state.visibilityState.redMotion === red
  ) {
    return;
  }
  this.state.visibilityState.blueMotion = blue;
  this.state.visibilityState.redMotion = red;
  // No observer notification needed — the render loop reads state directly.
}
```

- [ ] **Step 2: Remove the VM-sync path in AnimationEngine**

In AnimationEngine.svelte.ts around lines 504–505 and 634–645 there is code that reads `vm.getVisibility("blueMotion")` / `redMotion` and tracks `prevBlueMotionVisible`/`prevRedMotionVisible`.

Delete those lines. Specifically:
  - Remove `this.prevBlueMotionVisible = vm.getVisibility("blueMotion");` and the matching `red` line (~504–505)
  - Remove the observer reaction block that checks `state.blueMotion !== this.prevBlueMotionVisible` and the red analog (~634–645)
  - Remove the two `blueMotion:` / `redMotion:` entries from the state object being built around ~554
  - Remove the private field declarations for `prevBlueMotionVisible` / `prevRedMotionVisible` near the top of the class

Leave `tkaGlyph`, `reversalIndicators`, and other non-motion observers intact.

- [ ] **Step 3: Wire the orchestrator to push visibility into the engine**

In `SequenceViewerOrchestrator.svelte`, find where the animation engine is instantiated/accessed (search for `AnimationEngine` or `animationEngine`). After the engine is available and after the `viewerVisibility` state from Task 5 is constructed, add:

```ts
$effect(() => {
  // Push viewer-scoped motion visibility into the engine every time
  // the toggle changes. The engine mutates its internal visibilityState
  // which the render loop reads on the next frame.
  animationEngine?.setMotionVisibility(
    viewerVisibility.blueMotion,
    viewerVisibility.redMotion,
  );
});
```

Name the engine variable to match what the orchestrator actually has — it may be `engine`, `animationEngine`, or accessed via a service. Adjust accordingly.

- [ ] **Step 4: Type check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "refactor(animation): engine takes motion visibility via method, driven by viewer state

Removes the old VM observer path. The orchestrator now pushes the
viewer-scoped state into the engine via setMotionVisibility on every
change, and the render loop reads from engine.state as before."
```

---

### Task 9: Avatar3D zeros out props for hidden-side motions

**Files:**
- Modify: `src/lib/shared/3d/components/Avatar3D.svelte`

`setPropsAndBlend(blue, red)` already treats `null` as "no prop → IK weight goes to 0 → animation drives the arm." We just need to consult the viewer state at the call site.

- [ ] **Step 1: Import the context getter**

Near the other imports in Avatar3D.svelte's `<script>`:

```ts
import { tryGetViewerVisibilityContext } from "$lib/shared/sequence-viewer/context/viewer-visibility-context";
```

- [ ] **Step 2: Resolve the context at mount**

Near the other state initializations:

```ts
const viewerVisibility = tryGetViewerVisibilityContext();
```

- [ ] **Step 3: Mask props when hidden before calling `setPropsAndBlend`**

Locate line 918 where `setPropsAndBlend` is called:

```ts
animationService.setPropsAndBlend(blueWorldProp, redWorldProp);
```

Replace with:

```ts
const blueVisible = viewerVisibility?.blueMotion ?? true;
const redVisible = viewerVisibility?.redMotion ?? true;
animationService.setPropsAndBlend(
  blueVisible ? blueWorldProp : null,
  redVisible ? redWorldProp : null,
);
```

This reads the reactive state every frame (Avatar3D's update runs per-frame). When a motion is hidden, the arm's IK weight ramps to 0 and the underlying animation clip drives the hand to rest at the side.

- [ ] **Step 4: Hide the visible prop mesh for the hidden side**

Find where the blue/red props are rendered in the Avatar3D template (`<Staff3D>` / `<Prop3D>` / similar). Wrap each in a conditional:

```svelte
{#if viewerVisibility?.blueMotion ?? true}
  <!-- existing blue prop block -->
{/if}
{#if viewerVisibility?.redMotion ?? true}
  <!-- existing red prop block -->
{/if}
```

Use the same `tryGet` pattern so Avatar3D still works when rendered in the museum/realm without a viewer context.

- [ ] **Step 5: Type check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 6: Manual verify**

Announce to user: **"I cannot verify 3D avatar behavior. Please open a sequence in the 3D viewer, toggle off one motion in the new header popover, and confirm the corresponding arm drops to the avatar's side and the prop disappears. Confirm the other arm still performs normally."**

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/components/Avatar3D.svelte
git commit -m "feat(3d): avatar drops arm to side when a motion is hidden

When the viewer visibility state hides a motion, that side's prop
is masked to null in setPropsAndBlend(). The existing IK weight
path ramps the arm's IK to 0, and the animation clip drives the
arm to rest. The prop mesh is also hidden in the template so no
stale staff renders beside the resting arm."
```

---

## Phase 4 — Remove Viewer-Scope Writers (ExportImagePanel)

### Task 10: Remove motion chips from ExportImagePanel

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte`

The motion chips appear twice (around line 230 and line 416) — these are duplicate renderings for mobile/desktop layouts.

- [ ] **Step 1: Remove the chip markup at line ~230**

Find and delete the block:

```svelte
<button type="button" class="chip" class:active={blueMotion}
  onclick={() => vm.setMotionVisibility(MotionColor.BLUE, !blueMotion)}
  aria-pressed={blueMotion}
  …>Blue</button>
<button type="button" class="chip" class:active={redMotion}
  onclick={() => vm.setMotionVisibility(MotionColor.RED, !redMotion)}
  aria-pressed={redMotion}
  …>Red</button>
```

If these chips sit inside a container with a heading like "Motions" or similar, remove the container + heading too unless it contains other siblings.

- [ ] **Step 2: Remove the duplicate chip markup at line ~416**

Same pattern, same removal.

- [ ] **Step 3: Remove the now-dead derivations and helpers**

At the top of the script, delete:

```ts
const blueMotion = $derived.by(() => { void vmVersion; return vm.getMotionVisibility(MotionColor.BLUE); });
const redMotion = $derived.by(() => { void vmVersion; return vm.getMotionVisibility(MotionColor.RED); });
```

Find and delete the `vm.setMotionVisibility` calls around lines 98–100 (a bulk setter helper). Remove the surrounding helper function if the motion settings were its only job.

- [ ] **Step 4: Remove the now-dead line referencing `blueMotion || redMotion …`**

Around line 79 there is a composite condition:

```ts
blueMotion || redMotion || showGrid || tkaGlyph || vtgGlyph || positionsGlyph || nonRadial
```

Since motions are now always visible in the base pictograph render, drop the two motion terms:

```ts
showGrid || tkaGlyph || vtgGlyph || positionsGlyph || nonRadial
```

If this condition drove conditional rendering of a container, confirm the container still renders for the remaining items — if all remaining items default to true, the `if` may now be always-true; in that case replace with the literal `true` or remove the guard entirely.

- [ ] **Step 5: Clean up unused imports**

`MotionColor` import becomes unused if no other references remain. Remove it.

- [ ] **Step 6: Type check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte
git commit -m "refactor(viewer): remove motion chips from ExportImagePanel

The viewer-scoped header toggle is now the single entry point.
Exports automatically follow viewer visibility via the ChoreoCard
render path, so the panel no longer needs its own motion chips."
```

---

## Phase 5 — Remove Non-Viewer Writers

### Task 11: Remove motion chips from VisibilityTab

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/VisibilityTab.svelte`

- [ ] **Step 1: Delete the motion derivations**

Delete lines 67–68:

```ts
const blueMotion = $derived.by(() => { void version; return vm.getMotionVisibility(MotionColor.BLUE); });
const redMotion = $derived.by(() => { void version; return vm.getMotionVisibility(MotionColor.RED); });
```

And line 75:

```ts
const allMotionsVisible = $derived.by(() => { void version; return vm.areAllMotionsVisible(); });
```

- [ ] **Step 2: Delete the switch-case handlers at lines 110–111**

```ts
case "blue": tap(() => vm.setMotionVisibility(MotionColor.BLUE, !blueMotion)); break;
case "red": tap(() => vm.setMotionVisibility(MotionColor.RED, !redMotion)); break;
```

If the cases `"blue"` and `"red"` came from chip buttons in the template, also remove those chip buttons. Grep the file for the case strings to find their sources.

- [ ] **Step 3: Remove the `blueMotionVisible` / `redMotionVisible` / `allMotionsVisible` props passed to the child component at lines 186–194**

These feed a preview pictograph. Since motions are always on now, drop the props (the child will apply defaults).

- [ ] **Step 4: Remove the `MotionColor` import if unused**

- [ ] **Step 5: Type check**

Run: `npm run check`

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/settings/components/tabs/VisibilityTab.svelte
git commit -m "refactor(settings): remove motion chips from VisibilityTab

Motion visibility is now a viewer-scope concern. The settings tab
no longer exposes it."
```

---

### Task 12: Remove motion menu items from PictographContextMenuBuilder

**Files:**
- Modify: `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuBuilder.ts`

- [ ] **Step 1: Delete the Blue and Red motion menu items (lines ~30, ~32, ~39, ~41)**

Search for `MotionColor.BLUE` and `MotionColor.RED` in the file. Each appears inside a menu-item object that looks like:

```ts
{
  label: "Blue Motion",
  checked: vm.getMotionVisibility(MotionColor.BLUE),
  action: () => vm.setMotionVisibility(MotionColor.BLUE, !vm.getMotionVisibility(MotionColor.BLUE)),
},
```

Delete both items (blue and red) from the returned menu array.

- [ ] **Step 2: If this leaves a section like "Motion Visibility" empty, delete the section header too**

- [ ] **Step 3: Remove the `MotionColor` import if unused elsewhere in the file**

- [ ] **Step 4: Type check**

Run: `npm run check`

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuBuilder.ts
git commit -m "refactor(context-menu): remove motion visibility menu items

Motion visibility is no longer toggleable outside the sequence viewer."
```

---

### Task 13: Remove motion toggle wiring from SequenceDrawerHost

**Files:**
- Modify: `src/lib/features/create/shared/components/coordinators/SequenceDrawerHost.svelte`

- [ ] **Step 1: Delete the motion visibility state declarations at lines ~97 and ~100**

```ts
let blueMotionVisible = $state(visibilityManager.getMotionVisibility(MotionColor.BLUE));
// …
let redMotionVisible = $state(visibilityManager.getMotionVisibility(MotionColor.RED));
```

- [ ] **Step 2: Delete the observer sync at lines ~244–247**

```ts
blueMotionVisible = visibilityManager.getMotionVisibility(MotionColor.BLUE);
redMotionVisible = visibilityManager.getMotionVisibility(MotionColor.RED);
```

Find the surrounding observer registration/callback and remove the motion-related reads. Keep the observer itself if it syncs other fields.

- [ ] **Step 3: Delete the toggle handlers at lines ~619, ~623**

```ts
visibilityManager.setMotionVisibility(MotionColor.BLUE, !blueMotionVisible);
// …
visibilityManager.setMotionVisibility(MotionColor.RED, !redMotionVisible);
```

Find the handler functions (likely `toggleBlueMotion`/`toggleRedMotion` or similar) and delete them entirely. Then find and delete any buttons in the template that invoked those handlers.

- [ ] **Step 4: Remove `MotionColor` import if unused**

- [ ] **Step 5: Type check**

Run: `npm run check`

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/create/shared/components/coordinators/SequenceDrawerHost.svelte
git commit -m "refactor(create): remove motion visibility toggles from drawer host"
```

---

### Task 14: Remove motion toggle wiring from AnimationShareDrawer

**Files:**
- Modify: `src/lib/shared/animation-engine/components/AnimationShareDrawer.svelte`

- [ ] **Step 1: Delete the state reads at lines ~328, ~331, ~347, ~350**

- [ ] **Step 2: Delete the setter calls at lines ~378, ~382**

- [ ] **Step 3: Find and delete the toggle button markup in the template**

Grep the file for `blueMotionVisible` and `redMotionVisible` usages in the template. Remove the associated button/chip elements.

- [ ] **Step 4: Remove `MotionColor` import if unused**

- [ ] **Step 5: Type check**

Run: `npm run check`

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/components/AnimationShareDrawer.svelte
git commit -m "refactor(share): remove motion visibility toggle from share drawer"
```

---

### Task 15: Remove motion toggle wiring from compose VisualPane

**Files:**
- Modify: `src/lib/features/compose/components/controls/settings-panel/VisualPane.svelte`

- [ ] **Step 1: Delete the motion visibility reads at lines ~102, ~106, ~137–138, ~148–149**

These appear inside `$derived` blocks or handler functions. Remove each block entirely if motion visibility was its only concern; otherwise remove just the motion-related lines.

- [ ] **Step 2: Remove the toggle button markup in the template**

Grep the file for the variables that held the motion visibility reads. Remove the buttons that consumed them.

- [ ] **Step 3: Type check**

Run: `npm run check`

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/compose/components/controls/settings-panel/VisualPane.svelte
git commit -m "refactor(compose): remove motion visibility toggle from visual settings"
```

---

### Task 16: Remove motion visibility reads from VideoRecordSettingsSheet

**Files:**
- Modify: `src/lib/shared/video-record/components/VideoRecordSettingsSheet.svelte`

- [ ] **Step 1: Delete the state reads at lines ~45–46, ~51–52**

```ts
let blueMotionVisible = $state(visibilityManager.getVisibility("blueMotion"));
let redMotionVisible = $state(visibilityManager.getVisibility("redMotion"));
// …
blueMotionVisible = visibilityManager.getVisibility("blueMotion");
redMotionVisible = visibilityManager.getVisibility("redMotion");
```

- [ ] **Step 2: Find where `blueMotionVisible` / `redMotionVisible` are passed to child components or used in the template and remove those usages**

- [ ] **Step 3: Type check**

Run: `npm run check`

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/video-record/components/VideoRecordSettingsSheet.svelte
git commit -m "refactor(video-record): drop motion visibility reads from settings sheet"
```

---

## Phase 6 — Drop Motion-Visibility Checks in Renderers

### Task 17: PictographContainer assumes motions always visible

**Files:**
- Modify: `src/lib/shared/pictograph/shared/components/PictographContainer.svelte`

- [ ] **Step 1: Delete the motion visibility reads at lines ~159–160 and ~176–177**

```ts
blueMotion: visibilityManager.getMotionVisibility(MotionColor.BLUE),
redMotion: visibilityManager.getMotionVisibility(MotionColor.RED),
```

Replace each pair with literals:

```ts
blueMotion: true,
redMotion: true,
```

Keep the property name intact (downstream consumers still expect it); it will be removed in Task 19 when we scrub the types.

Actually — since the field is being removed entirely in Task 19, drop these lines altogether if the object is a structural literal. Verify by looking at the type of the object being built; if the type still requires `blueMotion`/`redMotion`, leave the literals in place until Task 19. If the type is loose, just delete.

**Recommended approach:** Leave the literals in place for now. They'll be removed with the type in Task 19.

- [ ] **Step 2: Type check**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/pictograph/shared/components/PictographContainer.svelte
git commit -m "refactor(pictograph): hard-code motion visibility to true in container

Precursor to removing the field from the VM entirely."
```

---

### Task 18: OptionPictograph drops motion visibility state

**Files:**
- Modify: `src/lib/shared/pictograph/option/OptionPictograph.svelte`

- [ ] **Step 1: Delete the state initializations at lines ~26–27**

```ts
let blueMotionVisible = $state(vm.getMotionVisibility(MotionColor.BLUE));
let redMotionVisible = $state(vm.getMotionVisibility(MotionColor.RED));
```

- [ ] **Step 2: Delete the observer sync at lines ~38–39**

```ts
blueMotionVisible = vm.getMotionVisibility(MotionColor.BLUE);
redMotionVisible = vm.getMotionVisibility(MotionColor.RED);
```

- [ ] **Step 3: Find the template references and replace with `true`**

Grep the file for `blueMotionVisible` / `redMotionVisible`. Each usage is a visibility condition. Replace with `true` or drop the gate entirely.

- [ ] **Step 4: Remove `MotionColor` import if unused**

- [ ] **Step 5: Type check**

Run: `npm run check`

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/pictograph/option/OptionPictograph.svelte
git commit -m "refactor(pictograph): OptionPictograph assumes motions always visible"
```

---

## Phase 7 — Remove Fields from the VMs

### Task 19: Remove motion fields from `VisibilityStateManager` (pictograph VM)

**Files:**
- Modify: `src/lib/shared/pictograph/shared/state/visibility-state.svelte.ts`

- [ ] **Step 1: Delete the `blueMotion` and `redMotion` fields from `VisibilitySettings` type**

Grep for the type definition (likely at the top of the file). Remove:

```ts
blueMotion: boolean;
redMotion: boolean;
```

- [ ] **Step 2: Delete the default values**

Grep for `blueMotion: true` / `redMotion: true` in defaults. Remove both lines.

- [ ] **Step 3: Delete the following methods entirely**

- `getMotionVisibility` (line 339)
- `setMotionVisibility` (line 348)
- `areAllMotionsVisible` (line 387)
- `isAnyMotionVisible` (line 394)
- Any save/restore helpers related to motion (search for `SavedMotionVisibility` or similar)

- [ ] **Step 4: Audit the `"motion"` observer scope**

Search the file for usages of `"motion"` as an observer scope string. If motion was the only thing triggering this scope, delete the scope from the allowed scopes type/enum and remove any `notifyObservers([…, "motion", …])` calls. If other fields still use it, leave it.

- [ ] **Step 5: Update migration code if any**

Grep for `blueMotion` in the file (including migration code). Delete any migration that copied this field from older storage. Storage with unknown keys is already tolerated by `{ ...defaults, ...parsed }`.

- [ ] **Step 6: Now clean up Task 17's literal**

Return to `PictographContainer.svelte` and delete the `blueMotion: true, redMotion: true` literals from the options object(s) entirely — the type no longer requires them.

- [ ] **Step 7: Type check**

Run: `npm run check`
Expected: 0 errors. If errors surface in files not listed above, they are genuine remaining readers — grep for `getMotionVisibility` / `setMotionVisibility` / `.blueMotion` / `.redMotion` in `src/` and fix each one.

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/pictograph/shared/state/visibility-state.svelte.ts src/lib/shared/pictograph/shared/components/PictographContainer.svelte
git commit -m "refactor(pictograph-vm): delete motion visibility fields and methods

Motion visibility is now viewer-scoped. The pictograph VM no longer
stores or exposes blueMotion/redMotion."
```

---

### Task 20: Remove motion fields from `AnimationVisibilityStateManager`

**Files:**
- Modify: `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts`

- [ ] **Step 1: Delete `blueMotion` and `redMotion` from the `AnimationVisibilitySettings` interface (line 74–75)**

- [ ] **Step 2: Delete them from `getDefaultSettings` (lines 177–178)**

- [ ] **Step 3: Delete `syncFromPictographVisibility` method entirely (lines 433–446)**

The method is now unreachable — no remaining code paths call it.

- [ ] **Step 4: Audit `getVisibility` type constraint**

The `getVisibility` method's `Exclude` type list doesn't exclude `blueMotion`/`redMotion` (they are boolean-returning fields). No changes needed here; the fields are just gone from the settings type, so the type parameter automatically narrows.

- [ ] **Step 5: Type check**

Run: `npm run check`

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts
git commit -m "refactor(animation-vm): delete motion visibility fields and sync method"
```

---

### Task 21: Update `AnimationVisibilitySynchronizer` + contract

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationVisibilitySynchronizer.ts`
- Modify: `src/lib/shared/animation-engine/services/contracts/IAnimationVisibilitySynchronizer.ts`

- [ ] **Step 1: Update the contract**

In `IAnimationVisibilitySynchronizer.ts`, find the `AnimationVisibilityState` type. Delete:

```ts
blueMotion: boolean;
redMotion: boolean;
```

- [ ] **Step 2: Update the implementation**

In `AnimationVisibilitySynchronizer.ts` line 33–34, delete:

```ts
blueMotion: this.manager.getVisibility("blueMotion"),
redMotion: this.manager.getVisibility("redMotion"),
```

- [ ] **Step 3: Find any consumers that destructured `blueMotion`/`redMotion` from the state and update them**

Grep for usages: `rg "state\.blueMotion|state\.redMotion" src/`.

For each hit, the caller was reading from the synchronizer state. Since motion visibility is now driven into the engine directly via `setMotionVisibility`, these consumers no longer need to observe it. Delete the references.

- [ ] **Step 4: Type check**

Run: `npm run check`

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/AnimationVisibilitySynchronizer.ts src/lib/shared/animation-engine/services/contracts/IAnimationVisibilitySynchronizer.ts
git commit -m "refactor(animation): drop motion keys from visibility synchronizer contract"
```

---

## Phase 8 — Final Verification

### Task 22: Full build + typecheck sweep

**Files:** None — verification only.

- [ ] **Step 1: Run the type checker**

Run: `npm run check`
Expected: 0 errors. Pre-existing warnings are acceptable. If new errors, re-grep for `blueMotion`/`redMotion` and fix missed readers.

- [ ] **Step 2: Run the full test suite**

Run: `npm test -- --run`
Expected: all tests pass, including the new `viewer-visibility-state.test.ts`.

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: clean build. Any type errors that slipped through `check` will appear here.

- [ ] **Step 4: Grep sweep for stragglers**

Run these searches and confirm each result is either (a) intentional documentation/spec file or (b) dead code you can now remove:

```bash
rg "getMotionVisibility|setMotionVisibility" src/
rg "\.blueMotion\b|\.redMotion\b" src/ --glob '!*.test.*'
rg "blueMotionVisible|redMotionVisible" src/
rg "syncFromPictographVisibility" src/
```

Expected residue:
- `viewer-visibility-state.svelte.ts` and its test (these use `blueMotion`/`redMotion` as fields on the NEW state class — keep)
- `AnimationRenderLoop.ts` still accepts `blueMotionVisible`/`redMotionVisible` on its params type (the engine now supplies these from its internal state, which was populated by `setMotionVisibility`) — keep
- `AnimationEngine.svelte.ts`'s internal `state.visibilityState.blueMotion`/`redMotion` fields — keep (engine owns its own render state)
- MCP-server renderers, `example-data.ts`, docs, specs — keep

Anything else is a bug — chase it down.

### Task 23: Manual browser verification

**Files:** None.

Announce to user: **"I cannot verify the integrated behavior. Please do the following and confirm each step:**

1. **Open a sequence in the viewer. Confirm the two-prop silhouette button appears in the top-right header.**
2. **Tap the button. Confirm a popover opens with Blue and Red chips.**
3. **Tap Blue. Confirm the Blue chip goes inactive, the silhouette button's blue half greys out, the ChoreoCard previews lose blue motion, and the animation stops rendering blue.**
4. **Switch to 3D mode. Confirm the avatar's left arm drops to its side and no blue prop is visible. The right arm performs normally.**
5. **Tap the Red chip. Confirm constraint enforcement: blue flips back on and red goes off (can't hide both).**
6. **Navigate to a different sequence. Confirm both chips reset to on.**
7. **Open the export panel. Confirm the old motion chips are gone.**
8. **Open settings → Visibility tab. Confirm no motion toggle is present.**
9. **Right-click a pictograph somewhere in the app (browse, option picker). Confirm the context menu no longer has Blue/Red motion toggle items.**
10. **Export an image with one motion hidden. Confirm the exported image matches the viewer preview."**

- [ ] **Step 1: Wait for user confirmation on each step.**

---

## Known unknowns — resolved during implementation

- **Avatar rest-pose mechanism.** Resolved in Task 9: `AvatarAnimator.setPropsAndBlend(null, redProp)` already zeros the left arm's IK weight, and the underlying animation clip (idle or locomotion) drives the arm to rest. No new avatar code needed beyond the null masking.
- **Icon asset.** Using simple `<span>` elements with colored backgrounds for the two silhouettes — no SVG needed. Resolved in Task 4.
- **Popover placement in 3D fullscreen chrome.** RouteViewerHeader is shared between 2D and 3D, so placing the button there also covers the 3D fullscreen case. Resolved in Task 6. If fullscreen hides the header (via FullscreenControls overlay), add a follow-up PR — not in scope here.
- **The `"motion"` observer scope.** Handled in Task 19 Step 4 with an explicit audit.

---

## Rollback plan

Every task commits separately. If any task breaks the build and the cause isn't immediately obvious, `git reset --hard HEAD~1` rolls back the last task. Ask the user before running destructive git commands.
