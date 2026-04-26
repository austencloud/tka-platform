# Mobile Bento Export Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the mobile branches of `ExportVideoDrawer` and `ExportImagePanel` as bento grids using the existing `.rail-chip` visual language, keeping the canvas/card preview visible and organizing settings into primary tiles with focused sub-sheets.

**Architecture:** Extract shared CSS (`rail-tile.css`) and a reusable sub-sheet wrapper (`RailBentoSheet.svelte`) into a new `bento/` sub-directory. Rewrite only the `layout === "bottom"` branch of each panel. Desktop `sidebar` branch stays untouched. All state flows through existing managers — no state changes.

**Tech Stack:** Svelte 5 (runes), TypeScript, existing TempoControl / EffectsPanel / EffortCategory / PlaybackModeToggle components, `getAnimationVisibilityManager` / `getImageCompositionManager` / `getVisibilityStateManager` / `ExportOptionsStateManager`.

**Spec:** `docs/superpowers/specs/2026-04-19-mobile-bento-export-panels-design.md`

---

## Verification strategy

This feature is primarily visual/interactive Svelte. Pure-function unit tests don't cover the bulk of the work. Verification uses three gates at each task:

1. **Type check** — `npm run check` must pass with zero errors for files touched.
2. **Build** — `npm run build` must succeed.
3. **Visual inspection** — Chrome DevTools MCP at 393×709 (the reported broken viewport) and 360×640 at the end.

State logic that is non-trivial (count-dot derivation, columns stepper cycling) does get a unit test where feasible.

Dev server on port 5173 is the user's own — never start it. Use `curl localhost:5173/viewer/SOME_CODE` for HTML smoke checks if needed.

---

## File structure

**New files:**

- `src/lib/shared/sequence-viewer/components/bento/rail-tile.css` — shared primitive styles for bento tiles, counting dots, inline steppers, split-pills. Imported as a plain CSS file by both panels.
- `src/lib/shared/sequence-viewer/components/bento/RailBentoSheet.svelte` — slide-up sheet wrapper with backdrop, header bar (title + close button), body snippet, and close callback. ~120 lines.

**Modified files:**

- `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte` — rewrite the `{#if layout === "bottom"}` branch (approx. lines 138–399 in current file). Desktop `{:else}` branch unchanged.
- `src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte` — rewrite the `{#if layout === "bottom"}` branch (approx. lines 145–338 in current file). Desktop `{:else}` branch unchanged.

**Tests:**

- `tests/unit/bento/columns-stepper.test.ts` — tiny pure-function test for the `nextColumnValue()` / `prevColumnValue()` helpers.

---

## Task 1: Extract rail-tile shared CSS

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/bento/rail-tile.css`

- [ ] **Step 1: Create the directory and CSS file**

Write `src/lib/shared/sequence-viewer/components/bento/rail-tile.css`:

```css
/* ==========================================================================
   rail-tile.css — shared bento primitive
   Mirrors the .rail-chip visual language from RenderModeToggle / RightRail
   so mobile bento tiles and the canvas toggle chips belong to the same
   visual family.
   ========================================================================== */

.rt-zone {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px 10px;
}

.rt-grid-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.rt-row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.rt-tile {
  position: relative;
  min-height: 72px;
  background: rgba(20, 22, 32, 0.78);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 8px;
  font-family: inherit;
  transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  -webkit-tap-highlight-color: transparent;
}

.rt-tile:hover {
  border-color: rgba(255, 255, 255, 0.22);
  background: rgba(28, 32, 44, 0.85);
  color: rgba(255, 255, 255, 0.9);
}

.rt-tile:focus-visible {
  outline: 2px solid rgba(120, 160, 255, 0.6);
  outline-offset: 2px;
}

.rt-tile[aria-pressed="true"] {
  background: color-mix(in srgb, #4a9eff 18%, rgba(20, 22, 32, 0.78));
  border-color: color-mix(in srgb, #4a9eff 50%, transparent);
  color: #8fc3ff;
  box-shadow: 0 4px 20px color-mix(in srgb, #4a9eff 25%, transparent);
}

.rt-tile[aria-pressed="true"] .rt-icon,
.rt-tile[aria-pressed="true"] .rt-val {
  color: #c5ddff;
}

.rt-tile[aria-pressed="true"] .rt-lbl {
  color: #8fc3ff;
}

.rt-tile .rt-icon {
  font-size: 22px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.85);
}

.rt-tile .rt-val {
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 0.01em;
}

.rt-tile .rt-lbl {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

/* Count dot (top-right badge for category tiles) */
.rt-tile .rt-count {
  position: absolute;
  top: 6px;
  right: 6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #4a9eff;
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}

/* Effort tile — border/glow uses --effort-color */
.rt-tile.rt-effort {
  border-color: color-mix(in srgb, var(--effort-color, #94a3b8) 45%, rgba(255, 255, 255, 0.1));
  box-shadow: 0 4px 16px color-mix(in srgb, var(--effort-color, #94a3b8) 18%, rgba(0, 0, 0, 0.4));
}

.rt-tile.rt-effort .rt-val {
  color: var(--effort-color, #94a3b8);
}

/* Inline stepper (Columns, Loops) — lives inside a tile */
.rt-stepper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rt-step-btn {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

.rt-step-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.rt-step-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.rt-stepper .rt-val {
  min-width: 44px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* Split-pill (Theme: Light | Dark) — two halves inside a tile */
.rt-split {
  display: flex;
  padding: 3px;
  gap: 2px;
  width: 100%;
  height: 34px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
}

.rt-split-opt {
  flex: 1;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
  background: transparent;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.rt-split-opt[aria-pressed="true"] {
  background: color-mix(in srgb, #4a9eff 32%, rgba(20, 22, 32, 0.8));
  color: #c5ddff;
  font-weight: 700;
}

/* Full-width primary download button */
.rt-download {
  width: 100%;
  min-height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, #4a9eff, #2b6fd4);
  border: 1px solid rgba(122, 180, 255, 0.5);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 4px 20px rgba(74, 158, 255, 0.35);
  cursor: pointer;
  padding: 10px 16px;
  -webkit-tap-highlight-color: transparent;
  transition: all 150ms ease;
}

.rt-download:hover:not(:disabled) {
  filter: brightness(1.08);
}

.rt-download:active:not(:disabled) {
  transform: scale(0.98);
}

.rt-download:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .rt-tile,
  .rt-step-btn,
  .rt-download {
    transition: none;
  }
  .rt-download:active:not(:disabled) {
    transform: none;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/bento/rail-tile.css
git commit -m "feat(bento): add rail-tile shared CSS primitive"
```

---

## Task 2: Create RailBentoSheet component

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/bento/RailBentoSheet.svelte`

- [ ] **Step 1: Write the component**

Write `src/lib/shared/sequence-viewer/components/bento/RailBentoSheet.svelte`:

```svelte
<!--
  RailBentoSheet.svelte

  Slide-up sheet that opens from the bottom of the preview area when a
  primary bento tile is tapped. Shared chrome: backdrop, header with title
  + close, body slot.

  Caller is responsible for mounting this conditionally (so the transition
  fires on mount) and for providing the body content via the `children`
  snippet.
-->
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    onClose: () => void;
    children: Snippet;
  }

  let { title, onClose, children }: Props = $props();

  function onBackdropClick() {
    onClose();
  }

  function onSheetKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<button
  type="button"
  class="bento-backdrop"
  aria-label="Close {title}"
  tabindex="-1"
  onclick={onBackdropClick}
  transition:fade={{ duration: 180 }}
></button>

<div
  class="bento-sheet"
  role="dialog"
  aria-modal="true"
  aria-label={title}
  onkeydown={onSheetKeydown}
  transition:fly={{ y: 80, duration: 240, easing: cubicOut }}
>
  <div class="bento-sheet-head">
    <span class="bento-sheet-title">{title}</span>
    <button
      type="button"
      class="bento-sheet-close"
      onclick={onClose}
      aria-label="Close {title}"
    >
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </div>

  <div class="bento-sheet-body">
    {@render children()}
  </div>
</div>

<style>
  .bento-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 14;
    cursor: pointer;
    border: none;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .bento-sheet {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    max-height: 72%;
    z-index: 15;
    background: rgba(14, 16, 24, 0.95);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .bento-sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .bento-sheet-title {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .bento-sheet-close {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }

  .bento-sheet-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .bento-sheet-body {
    padding: 12px;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Common inner primitives used by sheet bodies */
  :global(.bento-sheet-body .rt-section) {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  :global(.bento-sheet-body .rt-section-label) {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.45);
  }

  :global(.bento-sheet-body .rt-chip-row) {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  :global(.bento-sheet-body .rt-chip) {
    flex: 1;
    min-height: 38px;
    min-width: 44px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }

  :global(.bento-sheet-body .rt-chip[aria-pressed="true"]) {
    background: color-mix(in srgb, #4a9eff 22%, rgba(20, 22, 32, 0.6));
    border-color: color-mix(in srgb, #4a9eff 55%, transparent);
    color: #c5ddff;
  }

  :global(.bento-sheet-body .rt-row) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 8px 12px;
    min-height: 48px;
  }

  :global(.bento-sheet-body .rt-row-label) {
    font-size: 10px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  @media (prefers-reduced-motion: reduce) {
    .bento-sheet-close,
    :global(.bento-sheet-body .rt-chip) {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify type check on new file**

Run:
```bash
npm run check 2>&1 | grep -E "RailBentoSheet|bento" | head
```
Expected: no errors mentioning `RailBentoSheet.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/bento/RailBentoSheet.svelte
git commit -m "feat(bento): add RailBentoSheet wrapper component"
```

---

## Task 3: Add columns-stepper helper + unit test

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/bento/columns-stepper.ts`
- Create: `tests/unit/bento/columns-stepper.test.ts`

This is the one piece of non-trivial pure logic (cycling `Auto → 2 → 3 → … → beatCount → Auto`). Extracting to a helper makes it testable.

- [ ] **Step 1: Write the failing test**

Write `tests/unit/bento/columns-stepper.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextColumnValue, prevColumnValue } from "../../../src/lib/shared/sequence-viewer/components/bento/columns-stepper";

describe("columns stepper", () => {
  it("nextColumnValue cycles Auto → 2 → 3 → beatCount → Auto", () => {
    expect(nextColumnValue(null, 4)).toBe(2);
    expect(nextColumnValue(2, 4)).toBe(3);
    expect(nextColumnValue(3, 4)).toBe(4);
    expect(nextColumnValue(4, 4)).toBe(null);
    expect(nextColumnValue(null, 4)).toBe(2);
  });

  it("prevColumnValue cycles Auto → beatCount → … → 2 → Auto", () => {
    expect(prevColumnValue(null, 4)).toBe(4);
    expect(prevColumnValue(4, 4)).toBe(3);
    expect(prevColumnValue(3, 4)).toBe(2);
    expect(prevColumnValue(2, 4)).toBe(null);
  });

  it("clamps when beatCount is 2", () => {
    expect(nextColumnValue(null, 2)).toBe(2);
    expect(nextColumnValue(2, 2)).toBe(null);
    expect(prevColumnValue(null, 2)).toBe(2);
  });

  it("returns null for beatCount < 2 (only Auto makes sense)", () => {
    expect(nextColumnValue(null, 1)).toBe(null);
    expect(prevColumnValue(null, 1)).toBe(null);
  });

  it("clamps out-of-range current to null on next", () => {
    // User had columns=5 then loaded a 3-beat sequence. Next should go Auto.
    expect(nextColumnValue(5, 3)).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/unit/bento/columns-stepper.test.ts
```
Expected: FAIL — "Cannot find module".

- [ ] **Step 3: Write the implementation**

Write `src/lib/shared/sequence-viewer/components/bento/columns-stepper.ts`:

```ts
/**
 * Cycle helpers for the inline Columns stepper on the mobile card export
 * bento tile. The value null represents "Auto". Valid numeric values are
 * 2..beatCount (inclusive).
 */

export function nextColumnValue(
  current: number | null,
  beatCount: number,
): number | null {
  if (beatCount < 2) return null;
  if (current === null) return 2;
  if (current >= beatCount) return null;
  if (current < 2) return 2;
  return current + 1;
}

export function prevColumnValue(
  current: number | null,
  beatCount: number,
): number | null {
  if (beatCount < 2) return null;
  if (current === null) return beatCount;
  if (current <= 2) return null;
  return current - 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run tests/unit/bento/columns-stepper.test.ts
```
Expected: PASS (all 5 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/bento/columns-stepper.ts tests/unit/bento/columns-stepper.test.ts
git commit -m "feat(bento): add columns-stepper cycle helpers + tests"
```

---

## Task 4: Rewrite ExportVideoDrawer mobile branch — scaffolding

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte`

Replace the `{#if layout === "bottom"}` branch with the new bento layout. Keep all desktop `{:else}` branch code untouched. Also keep existing props and state — only the mobile template + mobile CSS changes.

This is the largest single change. Do it in one scaffolding commit, then add sub-sheets in follow-up tasks.

- [ ] **Step 1: Add imports, state, and helpers at top of script block**

Near the top of the `<script lang="ts">` block in `ExportVideoDrawer.svelte`, immediately after the existing imports, add:

```ts
  import RailBentoSheet from "./bento/RailBentoSheet.svelte";
  import "./bento/rail-tile.css";
  import TempoControl from "./TempoControl.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { EFFORTS } from "$lib/features/effort-lab/domain/effort-types";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import EffortCategory from "$lib/shared/animation-engine/components/animation-settings-modal/categories/EffortCategory.svelte";
```

Remove the existing `EffectsPanel` import (it's already imported once in the current file at line 19 — replace it in-place if present, don't double-import).

Then, after the props destructuring, add:

```ts
  // Which sub-sheet is currently open. Null = none.
  type SheetId = "effects" | "effort" | "playback" | "export";
  let openSheet = $state<SheetId | null>(null);

  function toggleSheet(id: SheetId) {
    openSheet = openSheet === id ? null : id;
  }

  function closeSheet() {
    openSheet = null;
  }

  // Reactive state read from the animation visibility manager
  const vm = getAnimationVisibilityManager();
  let vmVersion = $state(0);
  function onVmChanged() { vmVersion++; }
  vm.registerObserver(onVmChanged);
  $effect(() => () => vm.unregisterObserver(onVmChanged));

  // Active effort descriptor (for tile label + color)
  const activeEffort = $derived.by(() => {
    void vmVersion;
    const id = vm.getEffortPreset();
    return EFFORTS.find(e => e.id === id) ?? EFFORTS[0];
  });

  // Count of non-none tip effects (shown as a badge on the Effects tile)
  const effectsCount = $derived.by(() => {
    void vmVersion;
    const map = vm.getTipEffectMap();
    const all = [
      ...(map.blue ? Object.values(map.blue) : []),
      ...(map.red ? Object.values(map.red) : []),
    ];
    return all.filter(effect => effect && effect !== "none").length;
  });
```

- [ ] **Step 2: Replace the mobile branch template**

Find the block starting with `{#if layout === "bottom"}` and ending at `{:else}`. Replace its contents (everything between those two markers) with:

```svelte
{#if layout === "bottom"}
  <!-- ============================================================
       MOBILE: Bento grid. Canvas stays visible. Sub-sheets open
       over the bottom of the canvas when a primary tile is tapped.
       ============================================================ -->
  <div
    class="mobile-export"
    transition:fade={{ duration: 200 }}
    role="region"
    aria-label="Animation export"
  >
    {#if isExporting}
      <!-- Progress replaces the bento during export -->
      <div class="mobile-progress" role="status" aria-live="polite">
        <div class="progress-info">
          <span class="progress-stage">
            {#if !exportProgress}Starting...{:else}Exporting{/if}
          </span>
          <span class="progress-pct">{exportProgress ? Math.round(exportProgress.progress * 100) : 0}%</span>
        </div>
        <div
          class="progress-bar"
          role="progressbar"
          aria-valuenow={exportProgress ? Math.round(exportProgress.progress * 100) : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Export progress"
        >
          <div class="progress-fill" style="width: {exportProgress ? exportProgress.progress * 100 : 0}%"></div>
        </div>
        {#if onCancel}
          <button
            type="button"
            class="cancel-btn"
            onclick={onCancel}
            aria-label="Cancel export"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
            Cancel
          </button>
        {/if}
      </div>
    {:else}
      <!-- Sub-sheets (mounted conditionally so transitions fire) -->
      {#if openSheet === "effects"}
        <RailBentoSheet title="Effects" onClose={closeSheet}>
          <EffectsPanel
            bpm={bpm}
            onBpmChange={onBpmChange ?? (() => {})}
            {isPlaying}
            onPlaybackToggle={onPlaybackToggle ?? (() => {})}
            showPlayback={false}
            showTransport={false}
          />
        </RailBentoSheet>
      {:else if openSheet === "effort"}
        <RailBentoSheet title="Effort" onClose={closeSheet}>
          <EffortCategory />
        </RailBentoSheet>
      {:else if openSheet === "playback"}
        <RailBentoSheet title="Playback" onClose={closeSheet}>
          <div class="rt-section">
            <span class="rt-section-label">Tempo</span>
            <TempoControl
              {bpm}
              onBpmChange={onBpmChange ?? (() => {})}
              showPresets={false}
              showPractice={false}
              presetsMode="popover"
            />
          </div>

          {#if onPlaybackModeChange}
            <div class="rt-section">
              <span class="rt-section-label">Mode</span>
              <div class="rt-chip-row">
                <button
                  type="button"
                  class="rt-chip"
                  aria-pressed={playbackMode === "continuous"}
                  onclick={() => onPlaybackModeChange("continuous")}
                >
                  <i class="fas fa-play" aria-hidden="true"></i> Continuous
                </button>
                <button
                  type="button"
                  class="rt-chip"
                  aria-pressed={playbackMode === "step"}
                  onclick={() => onPlaybackModeChange("step")}
                >
                  <i class="fas fa-step-forward" aria-hidden="true"></i> Step
                </button>
              </div>
            </div>
          {/if}

          <div class="rt-section">
            <span class="rt-section-label">Timing</span>
            <div class="rt-chip-row">
              <button
                type="button"
                class="rt-chip"
                aria-pressed={exportOptions.videoIncludeStartPosition}
                onclick={() => exportOptions.setVideoIncludeStartPosition(!exportOptions.videoIncludeStartPosition)}
              >
                <i class="fas fa-step-backward" aria-hidden="true"></i> Start Hold
              </button>
              <button
                type="button"
                class="rt-chip"
                aria-pressed={exportOptions.videoIncludeEndHold}
                onclick={() => exportOptions.setVideoIncludeEndHold(!exportOptions.videoIncludeEndHold)}
              >
                <i class="fas fa-step-forward" aria-hidden="true"></i> End Hold
              </button>
            </div>
          </div>
        </RailBentoSheet>
      {:else if openSheet === "export"}
        <RailBentoSheet title="Export" onClose={closeSheet}>
          <div class="rt-section">
            <span class="rt-section-label">Frame rate</span>
            <div class="rt-chip-row">
              <button
                type="button"
                class="rt-chip"
                aria-pressed={exportOptions.videoFps === 30}
                onclick={() => exportOptions.setVideoFps(30)}
              >30 fps</button>
              <button
                type="button"
                class="rt-chip"
                aria-pressed={exportOptions.videoFps === 60}
                onclick={() => exportOptions.setVideoFps(60)}
              >60 fps</button>
            </div>
          </div>

          <div class="rt-section">
            <span class="rt-section-label">Resolution</span>
            <div class="rt-chip-row">
              <button
                type="button"
                class="rt-chip"
                aria-pressed={exportOptions.videoResolution === 720}
                onclick={() => exportOptions.setVideoResolution(720)}
              >{renderMode === '3d' ? '720×720' : '720p'}</button>
              <button
                type="button"
                class="rt-chip"
                aria-pressed={exportOptions.videoResolution === 1080}
                onclick={() => exportOptions.setVideoResolution(1080)}
              >{renderMode === '3d' ? '1080×1080' : '1080p'}</button>
            </div>
          </div>

          {#if renderMode === '3d'}
            <div class="rt-section">
              <span class="rt-section-label">Quality</span>
              <div class="rt-chip-row">
                <button
                  type="button"
                  class="rt-chip"
                  aria-pressed={exportOptions.videoQuality === 'standard'}
                  onclick={() => exportOptions.setVideoQuality('standard')}
                >Standard</button>
                <button
                  type="button"
                  class="rt-chip"
                  aria-pressed={exportOptions.videoQuality === 'cinema'}
                  onclick={() => exportOptions.setVideoQuality('cinema')}
                >
                  <i class="fas fa-film" aria-hidden="true"></i> Cinema
                </button>
              </div>
            </div>
          {/if}

          <div class="rt-row">
            <span class="rt-row-label">Loops</span>
            <div class="rt-stepper">
              <button
                type="button"
                class="rt-step-btn"
                onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount - 1)}
                disabled={exportOptions.videoLoopCount <= 1}
                aria-label="Decrease loop count"
              >
                <i class="fas fa-minus" aria-hidden="true"></i>
              </button>
              <span class="rt-val">{exportOptions.videoLoopCount}×</span>
              <button
                type="button"
                class="rt-step-btn"
                onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount + 1)}
                disabled={exportOptions.videoLoopCount >= 10}
                aria-label="Increase loop count"
              >
                <i class="fas fa-plus" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          {#if timeEstimateLabel}
            <div class="video-duration-line">
              <i class="fas fa-clock" aria-hidden="true"></i>
              {timeEstimateLabel}
            </div>
          {/if}
          {#if totalVideoDuration}
            <div class="video-duration-line">
              <i class="fas fa-film" aria-hidden="true"></i>
              Video length: {totalVideoDuration}
            </div>
          {/if}
        </RailBentoSheet>
      {/if}

      <!-- Primary bento grid -->
      <div class="rt-zone" onkeydown={preventSpaceActivation} role="group" aria-label="Animation export settings">
        <div class="rt-grid-2x2">
          <button
            type="button"
            class="rt-tile"
            aria-pressed={openSheet === "effects"}
            onclick={() => toggleSheet("effects")}
          >
            <i class="fas fa-sparkles rt-icon" aria-hidden="true"></i>
            <span class="rt-lbl">Effects</span>
            {#if effectsCount > 0}
              <span class="rt-count">{effectsCount}</span>
            {/if}
          </button>

          <button
            type="button"
            class="rt-tile rt-effort"
            style:--effort-color={activeEffort.color}
            aria-pressed={openSheet === "effort"}
            onclick={() => toggleSheet("effort")}
          >
            <span class="rt-val">{activeEffort.label}</span>
            <span class="rt-lbl">Effort</span>
          </button>

          <button
            type="button"
            class="rt-tile"
            aria-pressed={openSheet === "playback"}
            onclick={() => toggleSheet("playback")}
          >
            <i class="fas fa-play rt-icon" aria-hidden="true"></i>
            <span class="rt-lbl">Playback</span>
          </button>

          <button
            type="button"
            class="rt-tile"
            aria-pressed={openSheet === "export"}
            onclick={() => toggleSheet("export")}
          >
            <i class="fas fa-sliders rt-icon" aria-hidden="true"></i>
            <span class="rt-lbl">Export</span>
          </button>
        </div>

        <button
          type="button"
          class="rt-download"
          onclick={onExport}
          disabled={exportDisabled}
          aria-label={exportButtonLabel}
        >
          {#if !canvasReady}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            Preparing export...
          {:else}
            <i class="fas {renderMode === '3d' ? 'fa-circle' : 'fa-download'}" aria-hidden="true"></i>
            {exportButtonLabel}
          {/if}
        </button>
      </div>
    {/if}
  </div>
```

- [ ] **Step 3: Clean up unused mobile CSS**

In the `<style>` block, delete the following selectors that were specific to the old mobile layout (they're no longer referenced):

- `.mobile-bar` (and `.bar-play-btn`, `.bar-export-btn`, `.bar-settings-btn`, `.settings-summary`)
- `.settings-backdrop`
- `.inline-settings`, `.sheet-handle`, `.inline-settings-header`, `.inline-settings-title`, `.inline-settings-close`, `.inline-settings-body`, `.inline-settings-footer`
- All the `.inline-settings .setting-row / .chip-group / .chip` overrides

Keep shared blocks (`.mobile-export`, `.mobile-progress`, `.progress-info`, `.progress-stage`, `.progress-pct`, `.progress-bar`, `.progress-fill`, `.cancel-btn`, `.video-duration-line`, and the entire desktop sidebar CSS cascade starting at `.export-panel`).

If you're unsure whether a class is still used, grep:
```bash
grep -c "className\|class=" src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte
```
then confirm by inspecting the file.

- [ ] **Step 4: Run type check**

Run:
```bash
npm run check 2>&1 | grep -A 2 "ExportVideoDrawer" | head -30
```
Expected: zero errors in `ExportVideoDrawer.svelte`. If there are errors, fix them before committing.

- [ ] **Step 5: Run build**

Run:
```bash
npm run build 2>&1 | tail -20
```
Expected: "built in" line with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte
git commit -m "refactor(export-video): rebuild mobile layout as bento grid

4 primary tiles (Effects / Effort / Playback / Export) open focused
sub-sheets. Canvas stays visible behind the sheet. Reuses existing
EffectsPanel / EffortCategory / TempoControl / PlaybackModeToggle state.
Drops 4K/8K/120fps from animation Resolution and FPS pickers.
Desktop sidebar branch unchanged."
```

---

## Task 5: Rewrite ExportImagePanel mobile branch

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte`

- [ ] **Step 1: Add imports and state**

At the top of the `<script lang="ts">` block, add:

```ts
  import RailBentoSheet from "./bento/RailBentoSheet.svelte";
  import "./bento/rail-tile.css";
  import { nextColumnValue, prevColumnValue } from "./bento/columns-stepper";
```

After the existing helper computations (right before `/** Summary of current settings for the bottom bar chip */`), add:

```ts
  // Sub-sheet state — only "content" opens one; Columns & Theme are inline.
  let openSheet = $state<"content" | null>(null);
  function toggleSheet() { openSheet = openSheet === "content" ? null : "content"; }
  function closeSheet() { openSheet = null; }

  // Count total visibility toggles ON across all groups for the Content tile badge
  const contentOnCount = $derived.by(() => {
    void compositionVersion;
    void vmVersion;
    let n = 0;
    if (showWord) n++;
    if (showDifficulty) n++;
    if (showLoopGlyph) n++;
    if (showCreatorName) n++;
    if (showNotes) n++;
    if (showBirthday) n++;
    if (showGrid) n++;
    if (tkaGlyph) n++;
    if (vtgGlyph) n++;
    if (positionsGlyph) n++;
    if (nonRadial) n++;
    if (showQRCode) n++;
    if (showMandala) n++;
    return n;
  });
  const contentTotal = 13;

  // Display value for the Columns tile
  const columnsLabel = $derived(
    exportOptions.imageColumnCount === null ? "Auto" : String(exportOptions.imageColumnCount)
  );
```

- [ ] **Step 2: Replace the mobile branch template**

Find the block starting with `{#if layout === "bottom"}` and ending at `{:else}`. Replace its contents with:

```svelte
{#if layout === "bottom"}
  <!-- ============================================================
       MOBILE: Bento grid. Card preview stays visible.
       Content tile opens a sub-sheet with visibility toggles.
       Columns + Theme use inline controls.
       ============================================================ -->
  <div
    class="mobile-export"
    role="region"
    aria-label="Card export"
  >
    {#if openSheet === "content"}
      <RailBentoSheet title="Content" onClose={closeSheet}>
        <div class="rt-section">
          <span class="rt-section-label">Header</span>
          <div class="rt-chip-row">
            <button type="button" class="rt-chip"
              aria-pressed={showWord}
              onclick={() => imageComposition.setAddWord(!showWord)}
            >Word</button>
            <button type="button" class="rt-chip"
              aria-pressed={showDifficulty}
              onclick={() => imageComposition.setAddDifficultyLevel(!showDifficulty)}
            >Level</button>
            <button type="button" class="rt-chip"
              aria-pressed={showLoopGlyph}
              onclick={() => imageComposition.setShowLoopGlyph(!showLoopGlyph)}
            >LOOP</button>
          </div>
        </div>

        <div class="rt-section">
          <span class="rt-section-label">Footer</span>
          <div class="rt-chip-row">
            <button type="button" class="rt-chip"
              aria-pressed={showCreatorName}
              onclick={() => imageComposition.setShowCreatorName(!showCreatorName)}
            >Name</button>
            <button type="button" class="rt-chip"
              aria-pressed={showNotes}
              onclick={() => imageComposition.setShowNotes(!showNotes)}
            >Notes</button>
            <button type="button" class="rt-chip"
              aria-pressed={showBirthday}
              onclick={() => imageComposition.setShowBirthday(!showBirthday)}
            >Date</button>
          </div>
        </div>

        <div class="rt-section">
          <span class="rt-section-label">Pictograph</span>
          <div class="rt-chip-row">
            <button type="button" class="rt-chip"
              aria-pressed={showGrid}
              onclick={() => vm.setGridVisibility(!showGrid)}
            >Grid</button>
            <button type="button" class="rt-chip"
              aria-pressed={tkaGlyph}
              onclick={() => vm.setGlyphVisibility('tkaGlyph', !tkaGlyph)}
            >TKA</button>
            <button type="button" class="rt-chip"
              aria-pressed={vtgGlyph}
              onclick={toggleVtg}
            >VTG</button>
            <button type="button" class="rt-chip"
              aria-pressed={positionsGlyph}
              onclick={() => vm.setGlyphVisibility('positionsGlyph', !positionsGlyph)}
            >Positions</button>
            <button type="button" class="rt-chip"
              aria-pressed={nonRadial}
              onclick={() => vm.setNonRadialVisibility(!nonRadial)}
            >Non-radial</button>
          </div>
        </div>

        <div class="rt-section">
          <span class="rt-section-label">Extras</span>
          <div class="rt-chip-row">
            <button type="button" class="rt-chip"
              aria-pressed={showQRCode}
              onclick={() => imageComposition.setShowQRCode(!showQRCode)}
            >
              <i class="fas fa-qrcode" aria-hidden="true"></i> QR
            </button>
            <button type="button" class="rt-chip"
              aria-pressed={showMandala}
              onclick={() => imageComposition.setShowMandala(!showMandala)}
            >
              <i class="fas fa-asterisk" aria-hidden="true"></i> Mandala
            </button>
          </div>
        </div>
      </RailBentoSheet>
    {/if}

    <div class="rt-zone" role="group" aria-label="Card export settings">
      <div class="rt-row-3">
        <!-- Content tile — opens sub-sheet -->
        <button
          type="button"
          class="rt-tile"
          aria-pressed={openSheet === "content"}
          onclick={toggleSheet}
        >
          <i class="fas fa-layer-group rt-icon" aria-hidden="true"></i>
          <span class="rt-lbl">Content</span>
          <span class="rt-count">{contentOnCount}/{contentTotal}</span>
        </button>

        <!-- Columns tile — inline stepper -->
        <div class="rt-tile" role="group" aria-label="Card columns">
          <div class="rt-stepper">
            <button type="button" class="rt-step-btn"
              onclick={() => exportOptions.setImageColumnCount(prevColumnValue(exportOptions.imageColumnCount, beatCount))}
              aria-label="Previous column value"
            ><i class="fas fa-minus" aria-hidden="true"></i></button>
            <span class="rt-val">{columnsLabel}</span>
            <button type="button" class="rt-step-btn"
              onclick={() => exportOptions.setImageColumnCount(nextColumnValue(exportOptions.imageColumnCount, beatCount))}
              aria-label="Next column value"
            ><i class="fas fa-plus" aria-hidden="true"></i></button>
          </div>
          <span class="rt-lbl">Columns</span>
        </div>

        <!-- Theme tile — inline split-pill -->
        <div class="rt-tile" role="group" aria-label="Card theme" style="padding: 8px;">
          <div class="rt-split">
            <button type="button" class="rt-split-opt"
              aria-pressed={!exportOptions.imageDarkMode}
              onclick={() => exportOptions.setImageDarkMode(false)}
              aria-label="Light theme"
            ><i class="fas fa-sun" aria-hidden="true"></i> Light</button>
            <button type="button" class="rt-split-opt"
              aria-pressed={exportOptions.imageDarkMode}
              onclick={() => exportOptions.setImageDarkMode(true)}
              aria-label="Dark theme"
            ><i class="fas fa-moon" aria-hidden="true"></i> Dark</button>
          </div>
          <span class="rt-lbl">Theme</span>
        </div>
      </div>

      <button
        type="button"
        class="rt-download"
        onclick={onExport}
        disabled={isExporting}
        aria-label="Download card"
      >
        {#if isExporting}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Exporting...
        {:else}
          <i class="fas fa-download" aria-hidden="true"></i>
          Download Card
        {/if}
      </button>
    </div>
  </div>
```

- [ ] **Step 3: Clean up unused mobile CSS in ExportImagePanel**

Remove these now-unused selectors from the `<style>` block:

- `.mobile-bar`, `.bar-export-btn`, `.bar-settings-btn`, `.settings-summary`
- `.inline-settings`, `.inline-settings-header`, `.inline-settings-title`, `.inline-settings-close`, `.inline-settings-body`

Keep `.mobile-export`, the desktop sidebar cascade, and any shared `.setting-row / .chip / .section-toggle / .chip-group` rules that are still used in the desktop `{:else}` branch.

- [ ] **Step 4: Run type check**

Run:
```bash
npm run check 2>&1 | grep -A 2 "ExportImagePanel" | head -30
```
Expected: no errors.

- [ ] **Step 5: Run build**

Run:
```bash
npm run build 2>&1 | tail -10
```
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte
git commit -m "refactor(export-image): rebuild mobile layout as bento grid

3 primary tiles (Content / Columns / Theme) with Download button.
Content opens a sub-sheet with Header/Footer/Pictograph/Extras chips.
Columns and Theme use inline controls (stepper and split-pill) so
users never leave the bento to tune them. Desktop sidebar unchanged."
```

---

## Task 6: Visual QA pass

**Files:** none (verification only)

- [ ] **Step 1: Start user's dev server is already running on 5173 — confirm it**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
```
Expected: `200`.

If it's not 200, the user's dev server isn't running. Ask the user to start it, don't spin up a competing one.

- [ ] **Step 2: Pull a real sequence URL for testing**

Run:
```bash
curl -s http://localhost:5173/ | grep -oE '/viewer/[a-zA-Z0-9]{6}' | head -1
```

If that's empty, ask the user for a known-good `/viewer/XXXXXX` URL from their recent work (the screenshot at the start of the session showed `9stG`, so try `http://localhost:5173/viewer/9stG`).

- [ ] **Step 3: Launch Chrome DevTools MCP and navigate**

Use the `mcp__chrome-devtools__new_page` tool to open the viewer URL, then `mcp__chrome-devtools__resize_page` to `{ width: 393, height: 709 }` (the phone from the reported screenshot).

Then `mcp__chrome-devtools__take_snapshot` and verify the viewer loaded.

- [ ] **Step 4: Trigger the Download Animation panel**

Use `mcp__chrome-devtools__take_screenshot` to capture the idle viewer, then click the Download / Export button on the viewer (whatever triggers the ExportVideoDrawer mobile layout — typically in the viewer header or footer).

Take a screenshot with the panel open. Confirm:
- 4 primary tiles visible in 2×2 grid (Effects, Effort, Playback, Export)
- Download Animation button full-width below
- Canvas still visible above the bento

- [ ] **Step 5: Open each sub-sheet in turn**

Click Effects. Screenshot. Expect: effect chips + per-effect customize rendered by EffectsPanel.
Close. Click Effort. Screenshot. Expect: 8 effort buttons in 4×2.
Close. Click Playback. Screenshot. Expect: TempoControl pill, Continuous/Step, Start/End Hold.
Close. Click Export. Screenshot. Expect: 30/60 fps, 720p/1080p, Loops stepper.

- [ ] **Step 6: Switch to image export panel**

Trigger the ExportImagePanel (Download Card flow). Screenshot. Confirm:
- 3 primary tiles (Content, Columns with stepper, Theme with Light/Dark split)
- Content badge shows `<n>/13`
- Download Card full-width below

Click Content. Screenshot. Expect: Header chips, Footer chips, Pictograph chips (5), Extras chips.

Tap `+` on Columns. Confirm value advances `Auto → 2 → 3 …`.

Tap `Dark` then `Light` on Theme. Confirm the card preview above actually re-renders.

- [ ] **Step 7: Verify desktop sidebar is untouched**

Resize the page to `{ width: 1400, height: 900 }`. Reopen the export flow. Screenshot. Confirm the desktop sidebar looks identical to before (no regressions — old chip grid, old layout).

- [ ] **Step 8: Fix anything broken before committing QA notes**

If any screenshot reveals a visual bug (wrong alignment, chip not responding, sheet clipping the canvas), fix it in the component file and re-verify. Record fixes as follow-up commits.

- [ ] **Step 9: Save screenshots into `.superpowers/brainstorm/<session>/content/` as `qa-*.png`** (for reference)

No commit needed for QA-only steps unless bugs were fixed.

---

## Task 7: Final cleanup

**Files:** any straggling orphaned CSS or imports

- [ ] **Step 1: Grep for orphaned class names**

Run:
```bash
grep -n "inline-settings\|bar-export-btn\|bar-settings-btn\|bar-play-btn" src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte
```
Expected: no matches. If matches appear, remove them.

- [ ] **Step 2: Grep for unused imports**

Run:
```bash
grep -n "^  import" src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte
```
Scan the list; any import not referenced in the new template should be removed.

- [ ] **Step 3: Run full type check**

Run:
```bash
npm run check 2>&1 | tail -20
```
Expected: `0 errors` total (project-wide). If other files have errors unrelated to this work, note them but don't fix in this plan.

- [ ] **Step 4: Run full build**

Run:
```bash
npm run build 2>&1 | tail -10
```
Expected: success.

- [ ] **Step 5: Final commit (if anything changed)**

```bash
git add -u
git diff --cached --stat
git commit -m "chore(export-panels): remove orphaned mobile CSS and imports"
```

If no changes staged, skip the commit.

---

## Success criteria

- `npm run check` passes with zero new errors.
- `npm run build` succeeds.
- At 393×709, the Download Animation panel shows a 2×2 grid of Effects / Effort / Playback / Export tiles + full-width download button, with canvas visible above.
- At 393×709, the Download Card panel shows a 1×3 row of Content / Columns / Theme tiles + full-width download button, with card preview visible above.
- Tapping any primary tile slides up a sub-sheet covering no more than ~72% of the canvas area.
- Only one sub-sheet is open at a time.
- All settings persist through their existing managers — a toggle in the sub-sheet updates the preview immediately.
- Desktop sidebar at 1400×900 is visually identical to before.

---

## Self-review checklist (run this after drafting)

- [x] **Spec coverage** — every section in the spec has a task:
  - Visual language → Task 1 (rail-tile.css)
  - Animation primary row + sub-sheets → Task 4
  - Card primary row + Content sub-sheet → Task 5
  - Columns inline stepper → Task 3 (helper) + Task 5 (usage)
  - Theme split-pill → Task 5
  - Interaction model (single open sheet, 72% cap) → Tasks 2, 4, 5
  - Testing → Task 6 (visual QA)
- [x] **No placeholders** — no TBDs, no "handle edge cases", all code blocks included.
- [x] **Type consistency** — `SheetId` defined in Task 4 is used only in Task 4. `nextColumnValue`/`prevColumnValue` defined in Task 3 are imported in Task 5. Manager method names match the grep outputs from pre-planning (`setVideoFps`, `setImageColumnCount`, `getEffortPreset`, `getTipEffectMap`).
- [x] All file paths absolute-from-repo-root.
- [x] Each step is atomic (1–5 minutes of work).
