# Download Animation — Unified 5-Pill Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-tile mobile bento + flat desktop sidebar in `ExportVideoDrawer` with a unified 5-pill nav (Effects / Effort / Playback / Display / Export) that works identically on both viewports. Restore visibility of the Display toggles and Path Shape (orphaned when AnimationSettingsModal was nuked earlier in this branch).

**Spec:** `docs/superpowers/specs/2026-04-21-download-animation-unified-nav-design.md`

**Architecture:** Two new components (`DownloadPillNav` + `PillBody`) + one pure helper (`computeDisplaySummary`) + one CSS file. ExportVideoDrawer's mobile and desktop branches collapse to a single shared template with one variant prop. Reuses 9 existing components (EffectsPanel, MobileEffectsPanel, EffortPanel, DisplayPanel, PathShapePanel, PlaybackModeToggle, TempoControl, RailBentoSheet, rail-tile.css).

**Tech Stack:** Svelte 5 (runes), TypeScript, vitest for the one pure helper test, Chrome DevTools MCP for visual QA.

---

## Verification strategy

1. **Type check** — `npm run check 2>&1 | grep -E "ExportVideoDrawer|pill-nav"` must show zero errors for the touched files at every checkpoint.
2. **Build** — `npm run build` must succeed at the final task.
3. **Unit test** — `npx vitest run tests/unit/pill-nav/` for the one pure helper.
4. **Visual** — Chrome DevTools MCP at 393×709 (mobile) and 1400×900 (desktop) at the end. Ask the user before any interactive browser commands per project rules.

The user's dev server runs on port 5173. Never start it; use `curl localhost:5173/...` or `npm run build` for verification. If a dev server is needed, use `vite --port 5174`.

---

## Pre-flight verification

- [ ] **Step 0a: Confirm settings-panels exist with Panel suffix**

```bash
ls src/lib/shared/animation-engine/components/settings-panels/
```

Expected output (8 files):
```
CharcoalPanel.svelte
DisplayPanel.svelte
EffortPanel.svelte
FirePanel.svelte
LedPanel.svelte
PathShapePanel.svelte
PlaybackPanel.svelte
TrailsPanel.svelte
```

If any are missing, abort the plan — the cleanup commit that produced them must have been reverted.

- [ ] **Step 0b: Confirm AnimationSettingsModal is gone**

```bash
ls src/lib/shared/animation-engine/components/animation-settings-modal/ 2>&1
```

Expected: `No such file or directory`. If the directory exists, abort the plan.

- [ ] **Step 0c: Confirm Bento primitives exist**

```bash
ls src/lib/shared/sequence-viewer/components/bento/
```

Expected output (at least):
```
RailBentoSheet.svelte
rail-tile.css
```

- [ ] **Step 0d: Confirm ExportVideoDrawer's current shape**

```bash
grep -nE "type SheetId|EffortPanel|MobileEffectsPanel|RailBentoSheet" \
  src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte | head
```

Expected: imports for `EffortPanel`, `MobileEffectsPanel`, `RailBentoSheet`; the line `type SheetId = "effects" | "effort" | "playback" | "export"` (this is what we're replacing).

If any line is missing, the file was edited since the spec was written — re-read it before continuing.

---

## Task 1: Create pill-nav directory + pill-types.ts

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/pill-nav/pill-types.ts`

- [ ] **Step 1: Write the type module**

Write `src/lib/shared/sequence-viewer/components/pill-nav/pill-types.ts`:

```ts
/**
 * Pill-nav contract for ExportVideoDrawer.
 *
 * One PillId per primary section of the Download Animation surface.
 * PillSpec is the per-pill descriptor consumed by DownloadPillNav.
 */

export type PillId = "effects" | "effort" | "playback" | "display" | "export";

export interface PillSpec {
  id: PillId;
  /** Uppercase short label (≤8 chars), e.g. "EFFECTS". */
  label: string;
  /** FontAwesome class, e.g. "fa-sparkles". Optional — Effort uses a color dot instead. */
  icon?: string;
  /** Live one-line summary of the section's current state, ≤24 chars (truncated with ellipsis if longer). */
  summary: string;
  /** Optional accent color override. Effort sets this to its color so the active glow matches. */
  accentColor?: string;
}

export const PILL_ORDER: readonly PillId[] = [
  "effects",
  "effort",
  "playback",
  "display",
  "export",
] as const;
```

- [ ] **Step 2: Type check**

```bash
npm run check 2>&1 | grep -E "pill-types|pill-nav" | head
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/pill-nav/pill-types.ts
git commit -m "$(cat <<'EOF'
feat(pill-nav): add PillId / PillSpec types for download nav

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add the pure summary helper + unit test

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/pill-nav/pill-summaries.ts`
- Create: `tests/unit/pill-nav/pill-summaries.test.ts`

The Display summary is the only non-trivial computation (counting toggles + path-shape state). Extracting and testing it keeps the parent simple and prevents off-by-one bugs.

- [ ] **Step 1: Write the failing test**

Write `tests/unit/pill-nav/pill-summaries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeDisplaySummary } from "../../../src/lib/shared/sequence-viewer/components/pill-nav/pill-summaries";

const allOff = {
  tkaGlyph: false,
  stepNumbers: false,
  beatPosition: false,
  props: false,
  wordHeader: false,
  progressBar: false,
};

const allOn = {
  tkaGlyph: true,
  stepNumbers: true,
  beatPosition: true,
  props: true,
  wordHeader: true,
  progressBar: true,
};

describe("computeDisplaySummary", () => {
  it("reports 0 / 8 on when everything is off and grid is none and path is linear", () => {
    expect(computeDisplaySummary(allOff, false, "linear")).toBe("0 / 8 on");
  });

  it("reports 8 / 8 on when every toggle is on, grid visible, path is arc", () => {
    expect(computeDisplaySummary(allOn, true, "arc")).toBe("8 / 8 on");
  });

  it("counts grid as +1 when visible", () => {
    expect(computeDisplaySummary(allOff, true, "linear")).toBe("1 / 8 on");
  });

  it("counts arc path as +1 (linear does not count)", () => {
    expect(computeDisplaySummary(allOff, false, "arc")).toBe("1 / 8 on");
    expect(computeDisplaySummary(allOff, false, "linear")).toBe("0 / 8 on");
  });

  it("counts each visibility flag independently", () => {
    expect(
      computeDisplaySummary({ ...allOff, tkaGlyph: true, props: true }, false, "linear")
    ).toBe("2 / 8 on");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run tests/unit/pill-nav/pill-summaries.test.ts 2>&1 | tail -15
```

Expected: FAIL — "Cannot find module './pill-summaries'".

- [ ] **Step 3: Write the implementation**

Write `src/lib/shared/sequence-viewer/components/pill-nav/pill-summaries.ts`:

```ts
/**
 * Pure helpers that turn AnimationVisibilityStateManager state into the
 * one-line summaries shown beneath each pill label.
 *
 * Only the Display summary has real logic worth testing — the other
 * summaries (Effects count, Playback BPM/mode, Export FPS/res) are
 * trivial template strings derived inline in ExportVideoDrawer.
 */

export interface DisplayToggles {
  tkaGlyph: boolean;
  stepNumbers: boolean;
  beatPosition: boolean;
  props: boolean;
  wordHeader: boolean;
  progressBar: boolean;
}

export type PathShape = "arc" | "linear";

/**
 * Returns "<n> / 8 on" — counts visibility flags (6) + grid (1) + path-shape-arc (1).
 * Arc counts as "on" because it's the visible/curved default; linear is the alternate.
 */
export function computeDisplaySummary(
  toggles: DisplayToggles,
  gridVisible: boolean,
  pathShape: PathShape,
): string {
  let on = 0;
  if (toggles.tkaGlyph) on++;
  if (toggles.stepNumbers) on++;
  if (toggles.beatPosition) on++;
  if (toggles.props) on++;
  if (toggles.wordHeader) on++;
  if (toggles.progressBar) on++;
  if (gridVisible) on++;
  if (pathShape === "arc") on++;
  return `${on} / 8 on`;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run tests/unit/pill-nav/pill-summaries.test.ts 2>&1 | tail -15
```

Expected: 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/pill-nav/pill-summaries.ts \
        tests/unit/pill-nav/pill-summaries.test.ts
git commit -m "$(cat <<'EOF'
feat(pill-nav): add Display summary helper + unit tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add pill-nav.css

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/pill-nav/pill-nav.css`

The pill-specific styles extend `rail-tile.css`. Pills inherit hover, active, focus, and `prefers-reduced-motion` from the rail-tile cascade — `pill-nav.css` only adds layout (flex row, sizing) and the label/summary typography.

- [ ] **Step 1: Write the CSS file**

Write `src/lib/shared/sequence-viewer/components/pill-nav/pill-nav.css`:

```css
/* ==========================================================================
   pill-nav.css — extends rail-tile.css with the pill row layout
   Used by DownloadPillNav.svelte for both mobile and desktop variants.
   ========================================================================== */

.pill-nav {
  display: flex;
  gap: 6px;
  padding: 6px;
  background: rgba(20, 22, 32, 0.6);
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.pill-nav.variant-mobile {
  padding: 4px;
  gap: 4px;
}

.pill {
  /* Inherits .rt-tile background/border/shadow/transition from rail-tile.css */
  flex: 1;
  min-width: 0;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(20, 22, 32, 0.78);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-family: inherit;
  transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  -webkit-tap-highlight-color: transparent;
}

.pill-nav.variant-mobile .pill {
  min-height: 56px;
  padding: 8px 4px;
}

.pill:hover:not([aria-pressed="true"]) {
  border-color: rgba(255, 255, 255, 0.22);
  background: rgba(28, 32, 44, 0.85);
  color: rgba(255, 255, 255, 0.9);
}

.pill:focus-visible {
  outline: 2px solid var(--pill-accent, rgba(120, 160, 255, 0.6));
  outline-offset: 2px;
}

.pill[aria-pressed="true"] {
  background: color-mix(in srgb, var(--pill-accent, #4a9eff) 18%, rgba(20, 22, 32, 0.78));
  border-color: color-mix(in srgb, var(--pill-accent, #4a9eff) 50%, transparent);
  color: color-mix(in srgb, var(--pill-accent, #4a9eff) 70%, white);
  box-shadow: 0 4px 20px color-mix(in srgb, var(--pill-accent, #4a9eff) 25%, transparent);
}

.pill-icon-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.pill-icon-row .effort-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--pill-accent, currentColor);
  box-shadow: 0 0 4px var(--pill-accent, currentColor);
  flex-shrink: 0;
}

.pill-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1;
}

.pill[aria-pressed="true"] .pill-label {
  color: color-mix(in srgb, var(--pill-accent, #4a9eff) 60%, white);
}

.pill-summary {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1.2;
}

.pill[aria-pressed="true"] .pill-summary {
  color: color-mix(in srgb, var(--pill-accent, #4a9eff) 50%, white);
}

.pill-summary.empty {
  opacity: 0.45;
}

@media (prefers-reduced-motion: reduce) {
  .pill {
    transition: none;
  }
}
```

- [ ] **Step 2: Sanity check the file is valid CSS**

```bash
node -e "
const css = require('fs').readFileSync('src/lib/shared/sequence-viewer/components/pill-nav/pill-nav.css', 'utf8');
const balance = (s, a, b) => [...s].reduce((n, c) => n + (c === a) - (c === b), 0);
console.log('braces balanced:', balance(css, '{', '}') === 0);
console.log('parens balanced:', balance(css, '(', ')') === 0);
"
```

Expected: both `true`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/pill-nav/pill-nav.css
git commit -m "$(cat <<'EOF'
feat(pill-nav): add pill-nav.css extending rail-tile primitive

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: DownloadPillNav.svelte

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/pill-nav/DownloadPillNav.svelte`

- [ ] **Step 1: Write the component**

Write `src/lib/shared/sequence-viewer/components/pill-nav/DownloadPillNav.svelte`:

```svelte
<!--
  DownloadPillNav.svelte

  Horizontal row of 5 pills (Effects / Effort / Playback / Display / Export)
  shown above the download button on mobile and at the top of the sidebar
  on desktop. Pure presentational — all state is owned by the parent.
-->
<script lang="ts">
  import type { PillId, PillSpec } from "./pill-types";

  interface Props {
    pills: PillSpec[];
    activeId: PillId | null;
    onSelect: (id: PillId) => void;
    variant: "mobile" | "desktop";
  }

  const { pills, activeId, onSelect, variant }: Props = $props();

  function handleKeydown(e: KeyboardEvent, id: PillId) {
    // Enter / Space activate (default button behavior already does this,
    // but Space scrolls the page in some contexts — preventDefault to be safe).
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      onSelect(id);
      return;
    }
    if (e.key === "Enter") {
      onSelect(id);
      return;
    }
    // Arrow keys move focus along the row, do NOT activate.
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const currentIdx = pills.findIndex((p) => p.id === id);
      if (currentIdx < 0) return;
      const nextIdx = (currentIdx + dir + pills.length) % pills.length;
      const nextId = pills[nextIdx].id;
      const nextEl = document.querySelector<HTMLButtonElement>(
        `.pill-nav [data-pill-id="${nextId}"]`
      );
      nextEl?.focus();
    }
  }
</script>

<div
  class="pill-nav variant-{variant}"
  role="tablist"
  aria-label="Download settings"
>
  {#each pills as pill (pill.id)}
    <button
      type="button"
      class="pill"
      role="tab"
      data-pill-id={pill.id}
      aria-pressed={activeId === pill.id}
      aria-selected={activeId === pill.id}
      style:--pill-accent={pill.accentColor ?? null}
      onclick={() => onSelect(pill.id)}
      onkeydown={(e) => handleKeydown(e, pill.id)}
    >
      <span class="pill-icon-row">
        {#if pill.icon}
          <i class="fas {pill.icon}" aria-hidden="true"></i>
        {:else if pill.accentColor}
          <span class="effort-dot" aria-hidden="true"></span>
        {/if}
        <span class="pill-label">{pill.label}</span>
      </span>
      <span class="pill-summary" class:empty={!pill.summary || pill.summary === "—"}>
        {pill.summary || "—"}
      </span>
    </button>
  {/each}
</div>
```

- [ ] **Step 2: Type check**

```bash
npm run check 2>&1 | grep -E "DownloadPillNav|pill-nav" | head
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/pill-nav/DownloadPillNav.svelte
git commit -m "$(cat <<'EOF'
feat(pill-nav): DownloadPillNav with keyboard nav and aria semantics

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: PillBody.svelte

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/pill-nav/PillBody.svelte`

- [ ] **Step 1: Write the component**

Write `src/lib/shared/sequence-viewer/components/pill-nav/PillBody.svelte`:

```svelte
<!--
  PillBody.svelte

  Layout wrapper for the active pill's body. The only thing that differs
  between mobile and desktop is *where* the body is mounted:

  - mobile: rendered inside a RailBentoSheet that slides up from the
    bottom of the canvas. Closes via the sheet's ✕ / backdrop / Escape.
  - desktop: rendered inline in a flex-grow scrollable region between
    the pill row and the download footer. Always visible — never closes.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import RailBentoSheet from "../bento/RailBentoSheet.svelte";

  interface Props {
    title: string;
    variant: "mobile" | "desktop";
    onClose?: () => void;
    children: Snippet;
  }

  const { title, variant, onClose, children }: Props = $props();
</script>

{#if variant === "mobile"}
  <RailBentoSheet {title} onClose={onClose ?? (() => {})}>
    {@render children()}
  </RailBentoSheet>
{:else}
  <div class="pill-body-inline" role="tabpanel" aria-label={title}>
    {@render children()}
  </div>
{/if}

<style>
  .pill-body-inline {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 12px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
</style>
```

- [ ] **Step 2: Type check**

```bash
npm run check 2>&1 | grep -E "PillBody|pill-nav" | head
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/pill-nav/PillBody.svelte
git commit -m "$(cat <<'EOF'
feat(pill-nav): PillBody wrapper (mobile sheet vs desktop inline)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Rewrite ExportVideoDrawer — script block

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte`

This task only changes the `<script>` block. Template + style come in Task 7 and 8.

- [ ] **Step 1: Replace the import block**

Open `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte`. Find the imports (lines ~10–28) and replace them with:

```ts
  import { fade } from "svelte/transition";
  import type {
    ExportOptionsStateManager,
    VideoFps,
    VideoResolution,
  } from "../state/export-options-state.svelte";
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
  import { estimateExportTime, hasDeviceMetrics } from "../state/export-timing-tracker";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import MobileEffectsPanel from "$lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte";
  import PlaybackModeToggle from "$lib/features/compose/components/controls/PlaybackModeToggle.svelte";
  import type { PlaybackMode } from "$lib/features/compose/state/animation-panel-state.svelte";
  import RailBentoSheet from "./bento/RailBentoSheet.svelte";
  import "./bento/rail-tile.css";
  import "./pill-nav/pill-nav.css";
  import TempoControl from "./TempoControl.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { EFFORTS } from "$lib/features/effort-lab/domain/effort-types";
  import EffortPanel from "$lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte";
  import DisplayPanel from "$lib/shared/animation-engine/components/settings-panels/DisplayPanel.svelte";
  import PathShapePanel from "$lib/shared/animation-engine/components/settings-panels/PathShapePanel.svelte";
  import DownloadPillNav from "./pill-nav/DownloadPillNav.svelte";
  import PillBody from "./pill-nav/PillBody.svelte";
  import { type PillId, type PillSpec, PILL_ORDER } from "./pill-nav/pill-types";
  import { computeDisplaySummary } from "./pill-nav/pill-summaries";
  import { onDestroy } from "svelte";
```

`RailBentoSheet` is no longer imported directly — `PillBody` consumes it. Remove the line `import RailBentoSheet from "./bento/RailBentoSheet.svelte";` if it's still present.

- [ ] **Step 2: Replace the SheetId state with PillId state**

Find the block (currently lines ~70–78):

```ts
  type SheetId = "effects" | "effort" | "playback" | "export";
  let openSheet = $state<SheetId | null>(null);
  function toggleSheet(id: SheetId) {
    openSheet = openSheet === id ? null : id;
  }
  function closeSheet() {
    openSheet = null;
  }
```

Replace with:

```ts
  // Mobile: null = no sheet open. Desktop: defaults to "effects" and never goes null.
  let activePillId = $state<PillId | null>(layout === "sidebar" ? "effects" : null);

  function selectPill(id: PillId): void {
    if (layout === "bottom") {
      // Mobile toggles the sheet; tapping the active pill closes it.
      activePillId = activePillId === id ? null : id;
    } else {
      // Desktop is always-on; tapping the active pill is a no-op.
      activePillId = id;
    }
  }

  function closePill(): void {
    if (layout === "bottom") {
      activePillId = null;
    }
  }
```

- [ ] **Step 3: Add the pill summary derivations**

Right after the existing `effectsCount` derivation (current line ~96–100), append:

```ts
  // ── Pill summaries — recomputed when vmVersion ticks or props change ──

  const effectsSummary = $derived(
    effectsCount > 0 ? `${effectsCount} active` : "—"
  );

  const effortSummary = $derived(activeEffort.label);
  const effortAccent = $derived(activeEffort.color);

  const playbackSummary = $derived.by(() => {
    void vmVersion;
    const mode = vm.getPlaybackMode() === "step" ? "Step" : "Cont.";
    return `${bpm} BPM • ${mode}`;
  });

  const displaySummary = $derived.by(() => {
    void vmVersion;
    const s = vm.getSettings();
    return computeDisplaySummary(
      {
        tkaGlyph: s.tkaGlyph,
        stepNumbers: s.stepNumbers,
        beatPosition: s.beatPosition,
        props: s.props,
        wordHeader: s.wordHeader,
        progressBar: s.progressBar,
      },
      vm.isGridVisible(),
      vm.getPathShape(),
    );
  });

  const exportSummary = $derived.by(() => {
    const r = exportOptions.videoResolution;
    const resLabel = renderMode === "3d"
      ? `${r}×${r}`
      : (r >= 4320 ? "8K" : r >= 2160 ? "4K" : `${r}p`);
    return `${resLabel} • ${exportOptions.videoFps} fps`;
  });

  // Final pill array consumed by DownloadPillNav. Order is fixed by PILL_ORDER.
  const pills = $derived<PillSpec[]>([
    { id: "effects",  label: "EFFECTS",  icon: "fa-sparkles",        summary: effectsSummary },
    { id: "effort",   label: "EFFORT",   icon: undefined,            summary: effortSummary, accentColor: effortAccent },
    { id: "playback", label: "PLAYBACK", icon: "fa-play",            summary: playbackSummary },
    { id: "display",  label: "DISPLAY",  icon: "fa-eye",             summary: displaySummary },
    { id: "export",   label: "EXPORT",   icon: "fa-sliders",         summary: exportSummary },
  ]);

  // PILL_ORDER is the source of truth for ordering. Sanity check at dev time
  // — array literal above must match. (Cheap runtime guard, falls out at build.)
  if (import.meta.env.DEV) {
    const ids = pills.map((p) => p.id).join(",");
    const expected = PILL_ORDER.join(",");
    if (ids !== expected) {
      console.error("[ExportVideoDrawer] pill order drift:", ids, "expected", expected);
    }
  }
```

- [ ] **Step 4: Delete obsolete derivations**

Find and delete the `settingsSummary` derivation (currently around line ~169–171):

```ts
  /** Summary of current settings for the bottom bar chip */
  const settingsSummary = $derived(
    `${exportOptions.videoResolution >= 2160 ? (exportOptions.videoResolution >= 4320 ? "8K" : "4K") : exportOptions.videoResolution + "p"} · ${exportOptions.videoFps}fps`
  );
```

Delete it — `exportSummary` replaces it. If TypeScript complains about `settingsSummary` being unused, that's fine because we just removed it; the next type check should pass.

- [ ] **Step 5: Type check**

```bash
npm run check 2>&1 | grep -A 2 "ExportVideoDrawer" | head -40
```

Expected: zero errors. There may be unused-template-binding warnings about `toggleSheet`/`closeSheet`/`openSheet` that are still referenced in the existing template — those go away in Task 7 when the template is rewritten. If that's the only error class, proceed; otherwise fix before continuing.

If you need to satisfy the type check between this task and Task 7, temporarily comment out the template references to `openSheet`. Don't commit a half-done state — Tasks 6 + 7 are intended to land as a single commit at the end of Task 7.

- [ ] **Step 6: Do NOT commit yet**

Combine with Task 7 into one commit.

---

## Task 7: Rewrite ExportVideoDrawer — template

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte`

Build a single shared template that both mobile and desktop branches dispatch to. After this task, the file no longer has two parallel template branches — instead, it has variant-aware chrome that wraps a shared core.

- [ ] **Step 1: Replace the entire template (everything between `</script>` and `<style>`)**

Find the line `</script>` (around line 172). Find the matching `<style>` opener (around line 656). Replace everything between them (inclusive of the surrounding markers' adjacent newlines but not the markers themselves) with:

```svelte
{#snippet pillBody()}
  {#if activePillId === "effects"}
    {#if layout === "bottom"}
      <MobileEffectsPanel />
    {:else}
      <EffectsPanel
        bpm={bpm}
        onBpmChange={onBpmChange ?? (() => {})}
        {isPlaying}
        onPlaybackToggle={onPlaybackToggle ?? (() => {})}
        showPlayback={false}
      />
    {/if}
  {:else if activePillId === "effort"}
    <EffortPanel />
  {:else if activePillId === "playback"}
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
        <PlaybackModeToggle
          {playbackMode}
          {isPlaying}
          {onPlaybackModeChange}
          onPlaybackToggle={onPlaybackToggle ?? (() => {})}
        />
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

    <div class="rt-row">
      <span class="rt-row-label">Loops</span>
      <div class="rt-stepper">
        <button
          type="button"
          class="rt-step-btn"
          onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount - 1)}
          disabled={exportOptions.videoLoopCount <= 1}
          aria-label="Decrease loop count"
        ><i class="fas fa-minus" aria-hidden="true"></i></button>
        <span class="rt-val">{exportOptions.videoLoopCount}×</span>
        <button
          type="button"
          class="rt-step-btn"
          onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount + 1)}
          disabled={exportOptions.videoLoopCount >= 10}
          aria-label="Increase loop count"
        ><i class="fas fa-plus" aria-hidden="true"></i></button>
      </div>
    </div>
  {:else if activePillId === "display"}
    <DisplayPanel />
    <div class="rt-section">
      <span class="rt-section-label">Motion paths</span>
      <PathShapePanel />
    </div>
  {:else if activePillId === "export"}
    <div class="rt-section">
      <span class="rt-section-label">Frame rate</span>
      <div class="rt-chip-row">
        <button type="button" class="rt-chip"
          aria-pressed={exportOptions.videoFps === 30}
          onclick={() => exportOptions.setVideoFps(30)}
        >30 fps</button>
        <button type="button" class="rt-chip"
          aria-pressed={exportOptions.videoFps === 60}
          onclick={() => exportOptions.setVideoFps(60)}
        >60 fps</button>
      </div>
    </div>

    <div class="rt-section">
      <span class="rt-section-label">Resolution</span>
      <div class="rt-chip-row">
        <button type="button" class="rt-chip"
          aria-pressed={exportOptions.videoResolution === 720}
          onclick={() => exportOptions.setVideoResolution(720)}
        >{renderMode === '3d' ? '720×720' : '720p'}</button>
        <button type="button" class="rt-chip"
          aria-pressed={exportOptions.videoResolution === 1080}
          onclick={() => exportOptions.setVideoResolution(1080)}
        >{renderMode === '3d' ? '1080×1080' : '1080p'}</button>
      </div>
    </div>

    {#if renderMode === '3d'}
      <div class="rt-section">
        <span class="rt-section-label">Quality</span>
        <div class="rt-chip-row">
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoQuality === 'standard'}
            onclick={() => exportOptions.setVideoQuality('standard')}
          >Standard</button>
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoQuality === 'cinema'}
            onclick={() => exportOptions.setVideoQuality('cinema')}
          ><i class="fas fa-film" aria-hidden="true"></i> Cinema</button>
        </div>
      </div>
    {/if}

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
  {/if}
{/snippet}

{#if layout === "bottom"}
  <!-- ============================================================
       MOBILE: pill row + download button at bottom; sheet pops up
       over the canvas when a pill is active.
       ============================================================ -->
  <div
    class="mobile-export"
    transition:fade={{ duration: 200 }}
    role="region"
    aria-label="Animation export"
  >
    {#if isExporting}
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
      {#if activePillId !== null}
        <PillBody
          title={pills.find((p) => p.id === activePillId)?.label ?? ""}
          variant="mobile"
          onClose={closePill}
        >
          {@render pillBody()}
        </PillBody>
      {/if}

      <div class="rt-zone" onkeydown={preventSpaceActivation} role="group" aria-label="Animation export">
        <DownloadPillNav
          {pills}
          {activePillId}
          onSelect={selectPill}
          variant="mobile"
        />

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
{:else}
  <!-- ============================================================
       DESKTOP SIDEBAR: pill row at top, body inline, download in footer.
       ============================================================ -->
  <div
    class="export-panel sidebar"
    transition:fade={{ duration: 200 }}
    role="region"
    aria-label="Animation export settings"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="panel-body" onkeydown={preventSpaceActivation}>
      <DownloadPillNav
        {pills}
        {activePillId}
        onSelect={selectPill}
        variant="desktop"
      />

      <PillBody
        title={pills.find((p) => p.id === activePillId)?.label ?? ""}
        variant="desktop"
      >
        {@render pillBody()}
      </PillBody>
    </div>

    <div class="panel-footer">
      {#if isExporting}
        <div class="export-progress-row" role="status" aria-live="polite">
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
        <div class="export-row">
          <button
            type="button"
            class="export-btn"
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
          {#if timeEstimateLabel && !exportDisabled}
            <span class="time-estimate">{timeEstimateLabel}</span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
```

This single template uses one `{#snippet pillBody}` with the pill body content shared between mobile and desktop. The mobile branch wraps `pillBody` in a sheet; the desktop branch renders it inline.

- [ ] **Step 2: Type check**

```bash
npm run check 2>&1 | grep -A 2 "ExportVideoDrawer" | head -40
```

Expected: zero errors. If there are errors, fix them before proceeding. Common ones:
- "openSheet is not defined" — leftover reference from Task 6 step 4 cleanup. Search the file for `openSheet`, `toggleSheet`, `closeSheet`, `SheetId` and replace any survivors.
- "settingsSummary is not defined" — leftover template binding. Same fix.

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -15
```

Expected: build succeeds. Look for "built in Xs" line.

- [ ] **Step 4: Commit Tasks 6 + 7 together**

```bash
git add src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte
git commit -m "$(cat <<'EOF'
refactor(export-video): unify mobile + desktop on 5-pill nav

Replaces the 4-tile mobile bento and the flat desktop sidebar with one
shared 5-pill nav (Effects / Effort / Playback / Display / Export).
Display + Path Shape come back into the UI (orphaned when the modal was
nuked). Loops moves from Export to Playback (semantically belongs with
playback duration).

Mobile keeps the slide-up sheet pattern via PillBody(variant=mobile).
Desktop renders the active body inline in the sidebar via
PillBody(variant=desktop). Single download button, always visible on
both viewports.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Strip dead CSS from ExportVideoDrawer

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte` (style block only)

The Tasks 6+7 rewrite leaves several CSS selectors orphaned. Remove them.

- [ ] **Step 1: Identify orphaned classes**

Run:

```bash
node -e "
const fs = require('fs');
const file = 'src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte';
const src = fs.readFileSync(file, 'utf8');
const styleStart = src.indexOf('<style>');
const styleEnd = src.indexOf('</style>');
const style = src.slice(styleStart, styleEnd);
const tmpl = src.slice(0, styleStart);

// Find all class selectors in the style block (rough — strips pseudo / state).
const classes = [...style.matchAll(/\.([a-z][a-z0-9_-]+)/gi)].map((m) => m[1]);
const unique = [...new Set(classes)];
const orphans = unique.filter((c) => !tmpl.includes(\`\"\${c}\"\`) && !tmpl.includes(\`'\${c}'\`) && !tmpl.includes(\`class=\"\${c}\"\`) && !tmpl.includes(\`class:\${c}=\`));
console.log('orphans (review manually):');
orphans.forEach((c) => console.log('  .' + c));
"
```

This is heuristic — review the list manually. Expected orphans (delete these blocks from `<style>`):

- `.rt-grid-2x2` (the 2×2 mobile bento grid is gone)
- `.rt-tile` overrides (if any beyond what's in `rail-tile.css`)
- `.rt-effort` (Effort tile override — moves into Effort pill via `--pill-accent`)
- `.rt-count` (effects-count badge on tile — pills carry their own summary text now)
- Any `.bar-*`, `.settings-*`, `.inline-settings-*` classes from the original mobile bottom bar (long since dead but might still be in the file)
- `.setting-row`, `.setting-label`, `.chip-group`, `.chip` (these were the desktop sidebar's flat rows — now the panels render their own internal layout)
- `.loop-count-row`, `.loop-count-value`, `.loop-btn` (Loops moved into pill body using `.rt-stepper` from `rail-tile.css`)

Keep:

- `.mobile-export`
- `.mobile-progress` and its children (`.progress-info`, `.progress-stage`, `.progress-pct`, `.progress-bar`, `.progress-fill`, `.cancel-btn`)
- `.export-panel.sidebar`, `.panel-body`, `.panel-footer`, `.export-row`, `.export-btn`, `.export-progress-row`, `.time-estimate`
- `.video-duration-line`
- `.rt-zone` (the mobile bottom-anchored container)
- `.rt-download` (download button — still styled inline by class)
- Any `@media (prefers-reduced-motion: reduce)` blocks for the survivors

- [ ] **Step 2: Delete the orphaned blocks**

Open the file in your editor and delete each orphaned class block from the `<style>` cascade. Be careful with adjacent rules — only delete the blocks for the orphans, not the surrounding kept rules.

- [ ] **Step 3: Type check + build**

```bash
npm run check 2>&1 | grep -A 2 "ExportVideoDrawer" | head -10
npm run build 2>&1 | tail -5
```

Expected: zero errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte
git diff --cached --stat
git commit -m "$(cat <<'EOF'
chore(export-video): strip dead CSS after pill-nav rewrite

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If `git diff --cached --stat` shows zero changes (no orphans found), skip the commit.

---

## Task 9: Visual QA via Chrome DevTools MCP

**Files:** none (verification only)

**Permission gate:** per project rules, ask the user before any interactive Chrome DevTools commands. Read-only commands (`take_snapshot`, `take_screenshot`, `list_console_messages`) are fine without asking. Interactive commands (`navigate_page`, `click`, `fill`, `type_text`) require explicit verbal permission in the conversation.

If the user has not granted browser permission yet, post a single message:

> "Visual QA needs to drive Chrome DevTools — navigate to a viewer URL, click pills, and screenshot at two viewports. May I proceed?"

Wait for an affirmative response before continuing. If the user declines, mark this task complete with a note and proceed to Task 10 with a self-check via `curl localhost:5173/...` for HTTP-200 and `npm run build` only.

- [ ] **Step 1: Verify dev server is running**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```

Expected: `200`. If not, ask the user to start their dev server (don't start a competing one on 5173).

- [ ] **Step 2: Pick a viewer URL**

Find a recent viewer shortcode by checking git log + recent files:

```bash
grep -roE '/viewer/[A-Za-z0-9]{6}' src/ docs/ 2>/dev/null | head -3
```

If nothing meaningful comes up, try `http://localhost:5173/viewer/9stG` (used in prior session screenshots) or ask the user for a URL.

- [ ] **Step 3: Mobile viewport (393×709)**

Use `mcp__chrome-devtools__new_page` to open the viewer URL.
Use `mcp__chrome-devtools__resize_page` with `{ width: 393, height: 709 }`.
Use `mcp__chrome-devtools__take_snapshot` to confirm the viewer loaded.
Use `mcp__chrome-devtools__take_screenshot` for the resting state.

Trigger the Download Animation flow (the user knows how — typically a button labeled "Download" or similar in the viewer's UI). If unsure, take a snapshot, identify the trigger from the DOM, ask the user to confirm.

Once the panel is open, screenshot. Confirm:
- 5 pills visible in a row (Effects / Effort / Playback / Display / Export)
- Each pill shows label + summary
- Download Animation button below the pill row
- Canvas still visible above

Tap each pill in turn (`mcp__chrome-devtools__click` requires permission per the gate above):
- Effects → sheet opens with `MobileEffectsPanel` content
- Effort → sheet shows 8 effort buttons
- Playback → sheet shows Tempo + Mode + Timing + Loops
- Display → sheet shows visibility toggles + Motion paths section
- Export → sheet shows FPS + Resolution + (Quality if 3D)

Tap the active pill again — sheet closes.

Save mobile screenshots to `.claude-tmp/qa-mobile-*.png`.

- [ ] **Step 4: Desktop viewport (1400×900)**

`mcp__chrome-devtools__resize_page` to `{ width: 1400, height: 900 }`.

Trigger the Download Animation panel. Screenshot. Confirm:
- 5 pills at the top of the sidebar
- "Effects" is active by default (rail-chip blue tint)
- Pill body renders inline below the pill row
- Download button + time estimate at the footer

Click each pill in turn — body swaps inline without layout shift. Confirm the active pill border and the body content match.

Save desktop screenshots to `.claude-tmp/qa-desktop-*.png`.

- [ ] **Step 5: Right-click on canvas — confirm Animation Settings is gone**

`mcp__chrome-devtools__evaluate_script` to dispatch a contextmenu event on the canvas, then snapshot. Confirm the menu does NOT contain "Animation Settings". (The cleanup task earlier in this branch already removed it — this is verification.)

- [ ] **Step 6: Behavioral checks**

For each:
1. Toggle a Display visibility flag in the Display pill body. Confirm the Display pill summary updates from `5 / 8 on` to `4 / 8 on` (or whatever the delta is).
2. Change Effort to Heavy. Confirm the Effort pill border + dot recolor to the Heavy color.
3. Change FPS or resolution in the Export pill. Confirm the Export pill summary updates.
4. Move Loops in the Playback pill body up/down. Confirm value changes and disabled state on min/max.
5. Switch between viewports (resize). Confirm the active pill state persists where appropriate (mobile resets to null after sheet close; desktop keeps "effects" if no other pill was selected).

- [ ] **Step 7: Console clean check**

```bash
mcp__chrome-devtools__list_console_messages
```

Expected: no errors related to pill-nav. Warnings are acceptable but log them.

- [ ] **Step 8: Take notes**

If any step revealed a visual or behavioral bug, note it. Fix in a follow-up commit before Task 10.

No commit needed for QA — screenshots are temp artifacts.

---

## Task 10: Final cleanup + verification

**Files:** any straggling orphaned imports

- [ ] **Step 1: Grep for orphaned references**

```bash
grep -nE "SheetId|openSheet|toggleSheet|closeSheet|settingsSummary" \
  src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte
```

Expected: no matches.

```bash
grep -nE "animation-settings-modal|AnimationSettingsModal" src/ 2>/dev/null
```

Expected: no matches (cleanup from earlier in branch should be complete).

- [ ] **Step 2: Full type check**

```bash
npm run check 2>&1 | tail -25
```

Note: there are 8 pre-existing project-wide errors documented in the prior cleanup commit (ArrowSvg, ThreeDControlsLab, vm-shim, EffectsSettingsPanel) — those are NOT introduced by this work. Confirm:

- Errors in `ExportVideoDrawer.svelte`: zero
- Errors in `pill-nav/`: zero
- Errors in `settings-panels/`: zero
- Total errors: ≤ 8 (matching the pre-existing baseline)

If new errors appeared in any of the four scopes above, fix before final commit.

- [ ] **Step 3: Full build**

```bash
npm run build 2>&1 | tail -10
```

Expected: success.

- [ ] **Step 4: Run all tests**

```bash
npx vitest run tests/unit/pill-nav/ 2>&1 | tail -10
```

Expected: 5 tests passed (from Task 2).

- [ ] **Step 5: Final commit if anything changed**

```bash
git add -u
git diff --cached --stat
```

If anything is staged:

```bash
git commit -m "$(cat <<'EOF'
chore(pill-nav): tidy up after QA pass

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Otherwise skip.

---

## Success criteria

- `npm run check` passes with no NEW errors (matches the 8-error pre-existing baseline noted in Task 10).
- `npm run build` succeeds.
- `npx vitest run tests/unit/pill-nav/` passes with 5 tests.
- At 393×709, the Download Animation panel shows a 5-pill row + download button. Tapping a pill opens a sheet over the canvas.
- At 1400×900, the sidebar shows a 5-pill row at the top, active body inline, download in the footer. Switching pills swaps the body without layout shift.
- Display pill exposes the 7 visibility toggles + Path Shape (Arc/Linear) under "Motion paths".
- Effort pill border and dot are tinted with the active effort's color.
- Right-click on the canvas does NOT show "Animation Settings…" anymore.
- All settings persist through their existing managers — a toggle in the pill body updates the canvas immediately.

---

## Self-review checklist (run this after drafting)

- [x] **Spec coverage:** every section of the spec has at least one task.
  - DownloadPillNav → Task 4
  - PillBody → Task 5
  - pill-types → Task 1
  - pill-summaries (with Display computation) → Task 2
  - pill-nav.css → Task 3
  - ExportVideoDrawer rewrite (script + template) → Tasks 6, 7
  - Loops migration to Playback pill → embedded in Task 7
  - Display section (DisplayPanel + PathShapePanel under Motion paths label) → embedded in Task 7
  - Dead CSS removal → Task 8
  - Visual QA → Task 9
  - Final verification → Task 10
- [x] **No placeholders:** every code block is complete, no `...`, no `TBD`.
- [x] **Type consistency:** `PillId` + `PillSpec` + `PILL_ORDER` defined in Task 1, imported in Tasks 4, 6. `computeDisplaySummary` defined in Task 2, imported in Task 6. Method names against managers (`vm.getSettings`, `vm.isGridVisible`, `vm.getPathShape`, `vm.getPlaybackMode`, `vm.getEffortPreset`, `vm.getTipEffectMap`, `exportOptions.setVideoFps`, etc.) all verified against current source.
- [x] **All file paths absolute-from-repo-root.**
- [x] **Each step is atomic** (1–10 minutes of work).
- [x] **Pre-flight verification (Step 0)** confirms the assumed file structure (settings-panels exist, modal is gone, bento primitives present) before any modifications.
- [x] **Permission gates** for browser commands (Task 9) per project rules — never assume browser-control consent.
- [x] **No fabricated UI references** — every method, file, and line range was grepped or read in the conversation that produced this plan.
- [x] **Combined commit for Tasks 6+7** noted explicitly so the type check between them isn't a separate failure point.
