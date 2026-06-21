# Performer Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-mode performer editing system — bottom-center horizontal chip strip for performer selection (WHO) + additive right rail for contextual actions (WHAT).

**Architecture:** The bottom-center `PerformerRail` replaces the retired `PerformerChipStrip` and `PerformerPopover`. The existing `RightRail` gains an additive performer section: global chips (Formation, Tempo, Camera, Planes, Scene, Export) always visible, with per-performer chips (Effects, Prop, Effort) appending below a separator when a performer is selected. Each performer chip opens a dedicated popover scoped to the selected performer's `AvatarInstanceState`.

**Tech Stack:** Svelte 5 runes (`$derived`, `$state`), Threlte v8, existing viewer-3d-state popover system, existing sub-components (`FormationSelector`, `BentoPropGrid`, `PropSizeControl`, `MobileEffectsPanel`, `EffortPalette`).

**Spec:** `docs/superpowers/specs/2026-05-21-performer-rail-design.md`

---

## File Map

| File | Role | Action |
|---|---|---|
| `src/lib/shared/3d/state/viewer-3d-state.svelte.ts` | PopoverId type + selection state | Modify: extend PopoverId |
| `src/lib/shared/3d/context/viewer-3d-context.ts` | Re-exports PopoverId | No change (re-export is automatic) |
| `src/lib/shared/sequence-viewer/components/RightRail.svelte` | Right rail chip rendering | Modify: additive performer chips + Formation popover |
| `src/lib/shared/3d/components/controls/PerformerRail.svelte` | Bottom-center performer selector | Create |
| `src/lib/shared/3d/components/controls/EffectsPopover.svelte` | Per-performer effects toggle grid | Create |
| `src/lib/shared/3d/components/controls/PropPopover.svelte` | Per-performer prop/size/plane surface | Create |
| `src/lib/shared/3d/components/controls/EffortPopover.svelte` | Per-performer effort palette | Create |
| `src/lib/shared/3d/components/controls/FormationPopover.svelte` | Formation selector (Bird's Eye) | Create |
| `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` | Viewer layout | Modify: mount PerformerRail |
| `src/lib/shared/sequence-viewer/components/PerformerPopover.svelte` | Old mega-popover | Retire |
| `src/lib/shared/3d/components/controls/PerformerChipStrip.svelte` | Old chip strip | Retire |

---

### Task 1: Extend PopoverId Type

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts:33`

- [ ] **Step 1: Update PopoverId union**

Change the `PopoverId` type at line 33 from:

```typescript
export type PopoverId = "performers" | "tempo" | "export" | "camera" | "planes" | "info" | "scene";
```

to:

```typescript
export type PopoverId = "formation" | "tempo" | "export" | "camera" | "planes" | "info" | "scene" | "effects" | "prop" | "effort";
```

`"performers"` is removed (replaced by `"formation"` for the formation popover). Three new IDs added for per-performer popovers.

- [ ] **Step 2: Typecheck**

Run: `npm run check`

Expected: May get errors in `RightRail.svelte` and `PerformerPopover.svelte` where `"performers"` is referenced — those files are modified in later tasks. Confirm the type itself compiles.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state.svelte.ts
git commit -m "feat(performer-rail): extend PopoverId with formation, effects, prop, effort"
```

---

### Task 2: Create FormationPopover

**Files:**
- Create: `src/lib/shared/3d/components/controls/FormationPopover.svelte`

This popover wraps the existing `FormationSelector` component. It was previously a tab inside `PerformerPopover` — now it gets its own chip in the global right rail.

- [ ] **Step 1: Create FormationPopover.svelte**

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import FormationSelector from "./FormationSelector.svelte";
  import { PRESET_VALID_COUNTS } from "@austencloud/scene-3d";
  import type { FormationPreset } from "@austencloud/scene-3d";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "formation");
  const performerCount = $derived(viewer.performerManager.performers.length);

  const disabledPresets = $derived.by(() => {
    const disabled = new Set<FormationPreset>();
    for (const [preset, validCounts] of Object.entries(PRESET_VALID_COUNTS)) {
      if (!validCounts.includes(performerCount)) {
        disabled.add(preset as FormationPreset);
      }
    }
    return disabled;
  });

  function handleFormationChange(preset: FormationPreset) {
    viewer.applyFormationFromUI(preset);
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="formation-popover"
    role="dialog"
    aria-label="Formation presets"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === 'Escape') viewer.closePopover(); }}
    in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
    out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">
      <span class="pop-title">Formation</span>
    </div>
    <div class="pop-body">
      <FormationSelector
        value={viewer.activeFormation === "manual" ? "grid-2x2" : viewer.activeFormation}
        {performerCount}
        {disabledPresets}
        onchange={handleFormationChange}
      />
    </div>
  </div>
{/if}

<style>
  .formation-popover {
    position: absolute;
    right: calc(100% + 10px);
    top: 0;
    z-index: 100;
    width: 420px;
    border-radius: 18px;
    transform-origin: top right;
    background: rgba(20, 22, 32, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(24px) saturate(150%);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  .pop-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .pop-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
  }
  .pop-body {
    padding: 12px 14px 14px;
    --theme-panel-bg: rgba(0, 0, 0, 0.3);
    --theme-stroke: rgba(255, 255, 255, 0.08);
    --theme-text-dim: rgba(255, 255, 255, 0.5);
    --theme-text: rgba(255, 255, 255, 0.9);
    --theme-card-hover-bg: rgba(255, 255, 255, 0.08);
    --theme-accent: color-mix(in srgb, #60a5fa 30%, transparent);
  }
  .pop-body :global(.formation-btn.active) {
    background: color-mix(in srgb, #60a5fa 25%, transparent);
    border: 1px solid color-mix(in srgb, #60a5fa 45%, transparent);
    box-shadow: 0 2px 8px color-mix(in srgb, #60a5fa 18%, transparent);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/components/controls/FormationPopover.svelte
git commit -m "feat(performer-rail): create FormationPopover for Bird's Eye mode"
```

---

### Task 3: Create EffectsPopover

**Files:**
- Create: `src/lib/shared/3d/components/controls/EffectsPopover.svelte`

Wraps the existing `MobileEffectsPanel` component, scoped to the selected performer. The header shows "Performer N" with their color badge.

- [ ] **Step 1: Create EffectsPopover.svelte**

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import MobileEffectsPanel from "$lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte";
  import { getPerformerColor } from "../../constants/performer-colors";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "effects");
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const performerColor = $derived(getPerformerColor(selectedIndex ?? 0));
  const performerLabel = $derived(selectedIndex !== null ? `Performer ${selectedIndex + 1}` : "");
</script>

{#if open && selectedIndex !== null}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="effects-popover"
    role="dialog"
    aria-label="Effects for performer {(selectedIndex ?? 0) + 1}"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === 'Escape') viewer.closePopover(); }}
    in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
    out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">
      <span class="pop-title">{performerLabel}</span>
      <span class="pop-badge" style:background={performerColor}></span>
    </div>
    <div class="pop-body">
      <MobileEffectsPanel layout="grid" />
    </div>
  </div>
{/if}

<style>
  .effects-popover {
    position: absolute;
    right: calc(100% + 10px);
    top: 0;
    z-index: 100;
    width: 420px;
    border-radius: 18px;
    transform-origin: top right;
    background: rgba(20, 22, 32, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(24px) saturate(150%);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  .pop-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pop-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
  }
  .pop-badge {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .pop-body {
    padding: 12px 14px 14px;
    max-height: 70vh;
    overflow-y: auto;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/components/controls/EffectsPopover.svelte
git commit -m "feat(performer-rail): create EffectsPopover for per-performer effects"
```

---

### Task 4: Create PropPopover

**Files:**
- Create: `src/lib/shared/3d/components/controls/PropPopover.svelte`

Wraps existing `BentoPropGrid` and `PropSizeControl`. Scoped to selected performer's `AvatarInstanceState`.

- [ ] **Step 1: Create PropPopover.svelte**

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import PropSizeControl from "$lib/shared/sequence-viewer/components/PropSizeControl.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getPerformerColor } from "../../constants/performer-colors";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "prop");
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const performerColor = $derived(getPerformerColor(selectedIndex ?? 0));
  const performerLabel = $derived(selectedIndex !== null ? `Performer ${selectedIndex + 1}` : "");

  const selected = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });
</script>

{#if open && selected}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="prop-popover"
    role="dialog"
    aria-label="Prop for performer {(selectedIndex ?? 0) + 1}"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === 'Escape') viewer.closePopover(); }}
    in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
    out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">
      <span class="pop-title">{performerLabel}</span>
      <span class="pop-badge" style:background={performerColor}></span>
    </div>
    <div class="pop-body">
      <BentoPropGrid
        selectedPropType={selected.settings.prop ?? PropType.STAFF}
        color={performerColor}
        variant="inline"
        onSelect={(p) => selected.setProp(p)}
      />
      <div class="size-section">
        <PropSizeControl performer={selected} />
      </div>
    </div>
  </div>
{/if}

<style>
  .prop-popover {
    position: absolute;
    right: calc(100% + 10px);
    top: 0;
    z-index: 100;
    width: 420px;
    border-radius: 18px;
    transform-origin: top right;
    background: rgba(20, 22, 32, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(24px) saturate(150%);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  .pop-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pop-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
  }
  .pop-badge {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .pop-body {
    padding: 12px 14px 14px;
    max-height: 70vh;
    overflow-y: auto;
  }
  .size-section {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/components/controls/PropPopover.svelte
git commit -m "feat(performer-rail): create PropPopover for per-performer prop/size"
```

---

### Task 5: Create EffortPopover

**Files:**
- Create: `src/lib/shared/3d/components/controls/EffortPopover.svelte`

Wraps existing `EffortPalette`. Scoped to selected performer.

- [ ] **Step 1: Create EffortPopover.svelte**

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import EffortPalette from "$lib/shared/phrase-effort-lab/components/EffortPalette.svelte";
  import { getPerformerColor } from "../../constants/performer-colors";
  import type { EffortId } from "$lib/shared/effort/domain/effort-types";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "effort");
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const performerColor = $derived(getPerformerColor(selectedIndex ?? 0));
  const performerLabel = $derived(selectedIndex !== null ? `Performer ${selectedIndex + 1}` : "");

  const selected = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });
</script>

{#if open && selected}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="effort-popover"
    role="dialog"
    aria-label="Effort for performer {(selectedIndex ?? 0) + 1}"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === 'Escape') viewer.closePopover(); }}
    in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
    out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">
      <span class="pop-title">{performerLabel}</span>
      <span class="pop-badge" style:background={performerColor}></span>
    </div>
    <div class="pop-body">
      <EffortPalette
        selectedEffort={selected.settings.effortId ?? "linear"}
        onSelect={(e) => selected.setEffort(e)}
      />
    </div>
  </div>
{/if}

<style>
  .effort-popover {
    position: absolute;
    right: calc(100% + 10px);
    top: 0;
    z-index: 100;
    width: 420px;
    border-radius: 18px;
    transform-origin: top right;
    background: rgba(20, 22, 32, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(24px) saturate(150%);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  .pop-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pop-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
  }
  .pop-badge {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .pop-body {
    padding: 12px 14px 14px;
    --theme-stroke: rgba(255, 255, 255, 0.1);
    --theme-card-bg: rgba(255, 255, 255, 0.04);
    --theme-text-dim: rgba(255, 255, 255, 0.5);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/components/controls/EffortPopover.svelte
git commit -m "feat(performer-rail): create EffortPopover for per-performer effort"
```

---

### Task 6: Update RightRail — Additive Performer Chips

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/RightRail.svelte`

This is the core task. Replace the `"performers"` chip with `"formation"`. Add the additive performer chip section (separator + Effects/Prop/Effort) that appears when a performer is selected. Wire all new popovers.

- [ ] **Step 1: Replace the full RightRail.svelte**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { getViewer3DContext, type PopoverId } from "$lib/shared/3d/context/viewer-3d-context";
  import { getPerformerColor } from "$lib/shared/3d/constants/performer-colors";
  import TempoPopover from "./TempoPopover.svelte";
  import ExportPopover from "./ExportPopover.svelte";
  import CameraPopover from "$lib/shared/3d/components/CameraPopover.svelte";
  import PlanesPopover from "$lib/shared/3d/components/PlanesPopover.svelte";
  import SceneSelectorPopover from "$lib/shared/3d/components/SceneSelectorPopover.svelte";
  import FormationPopover from "$lib/shared/3d/components/controls/FormationPopover.svelte";
  import EffectsPopover from "$lib/shared/3d/components/controls/EffectsPopover.svelte";
  import PropPopover from "$lib/shared/3d/components/controls/PropPopover.svelte";
  import EffortPopover from "$lib/shared/3d/components/controls/EffortPopover.svelte";
  import { createViewer3DKeyboardHandler } from "$lib/shared/3d/keyboard/Viewer3DKeyboardHandler";

  const viewer = getViewer3DContext();

  interface Props {
    renderMode: "2d" | "3d";
    bpm?: number;
    onBpmChange?: (bpm: number) => void;
  }
  let { renderMode, bpm = 60, onBpmChange = () => {} }: Props = $props();

  let rootEl = $state<HTMLDivElement | null>(null);

  interface Chip { id: PopoverId; icon: string; tooltip: string; }

  const CHIPS_3D_GLOBAL: Chip[] = [
    { id: "formation", icon: "fa-users",                 tooltip: "Formation" },
    { id: "tempo",     icon: "fa-gauge",                 tooltip: "Speed" },
    { id: "camera",    icon: "fa-video",                 tooltip: "Camera" },
    { id: "planes",    icon: "fa-layer-group",           tooltip: "Planes" },
    { id: "export",    icon: "fa-arrow-up-from-bracket", tooltip: "Export" },
    { id: "scene",     icon: "fa-mountain-sun",          tooltip: "Scene" },
  ];

  const CHIPS_PERFORMER: Chip[] = [
    { id: "effects", icon: "fa-wand-magic-sparkles", tooltip: "Effects" },
    { id: "prop",    icon: "fa-staff-snake",         tooltip: "Prop" },
    { id: "effort",  icon: "fa-wave-square",         tooltip: "Effort" },
  ];

  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const hasPerformerSelected = $derived(renderMode === "3d" && selectedIndex !== null);
  const performerColor = $derived(getPerformerColor(selectedIndex ?? 0));

  function onChipClick(e: MouseEvent, id: PopoverId) {
    e.stopPropagation();
    viewer.openPopover(viewer.activePopover === id ? null : id);
  }

  onMount(() => {
    const cleanupKeyboard = createViewer3DKeyboardHandler({
      undo: () => viewer.undo(),
      redo: () => viewer.redo(),
    });

    function onDocClick(e: MouseEvent) {
      if (!viewer.activePopover) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (rootEl && rootEl.contains(target)) return;
      const popovers = document.querySelectorAll('[role="dialog"]');
      for (const p of popovers) if (p.contains(target)) return;
      viewer.closePopover();
    }
    document.addEventListener("click", onDocClick);
    return () => {
      document.removeEventListener("click", onDocClick);
      cleanupKeyboard();
    };
  });
</script>

<div
  class="right-rail"
  class:mode-2d={renderMode === "2d"}
  class:mode-3d={renderMode === "3d"}
  bind:this={rootEl}
  role="toolbar"
  aria-label="Viewer controls"
>
  {#if renderMode === "3d"}
    {#each CHIPS_3D_GLOBAL as chip (chip.id)}
      <div class="chip-wrap">
        <button
          class="rail-chip"
          aria-pressed={viewer.activePopover === chip.id}
          aria-label={chip.tooltip}
          data-tooltip={chip.tooltip}
          onclick={(e) => onChipClick(e, chip.id)}
        >
          <i class="fas {chip.icon}"></i>
        </button>
        {#if chip.id === "formation"}
          <FormationPopover />
        {:else if chip.id === "tempo"}
          <TempoPopover {bpm} {onBpmChange} />
        {:else if chip.id === "export"}
          <ExportPopover />
        {:else if chip.id === "camera"}
          <CameraPopover />
        {:else if chip.id === "planes"}
          <PlanesPopover />
        {:else if chip.id === "scene"}
          <SceneSelectorPopover />
        {/if}
      </div>
    {/each}

    {#if hasPerformerSelected}
      <div
        class="performer-separator"
        transition:slide|local={{ duration: 220, axis: "y" }}
        aria-hidden="true"
      >
        <div class="separator-line"></div>
      </div>

      {#each CHIPS_PERFORMER as chip (chip.id)}
        <div class="chip-wrap" transition:slide|local={{ duration: 220, axis: "y" }}>
          <button
            class="rail-chip performer-scoped"
            aria-pressed={viewer.activePopover === chip.id}
            aria-label={chip.tooltip}
            data-tooltip={chip.tooltip}
            style:--chip-tint={performerColor}
            onclick={(e) => onChipClick(e, chip.id)}
          >
            <i class="fas {chip.icon}"></i>
          </button>
          {#if chip.id === "effects"}
            <EffectsPopover />
          {:else if chip.id === "prop"}
            <PropPopover />
          {:else if chip.id === "effort"}
            <EffortPopover />
          {/if}
        </div>
      {/each}
    {/if}
  {/if}
</div>

<style>
  .right-rail {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 9;
  }
  .chip-wrap {
    position: relative;
  }
  .rail-chip {
    width: 56px;
    height: 56px;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    color: rgba(255, 255, 255, 0.62);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }
  .rail-chip:hover::after {
    content: attr(data-tooltip);
    position: absolute;
    right: calc(100% + 10px);
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    white-space: nowrap;
    pointer-events: none;
  }
  .rail-chip[aria-pressed="true"] {
    background: color-mix(in srgb, #4a9eff 18%, transparent);
    border-color: color-mix(in srgb, #4a9eff 50%, transparent);
    color: #8fc3ff;
    box-shadow: 0 4px 20px color-mix(in srgb, #4a9eff 25%, transparent);
  }
  .rail-chip.performer-scoped i {
    color: var(--chip-tint, rgba(255, 255, 255, 0.62));
  }
  .rail-chip.performer-scoped[aria-pressed="true"] {
    background: color-mix(in srgb, var(--chip-tint) 18%, transparent);
    border-color: color-mix(in srgb, var(--chip-tint) 50%, transparent);
    box-shadow: 0 4px 20px color-mix(in srgb, var(--chip-tint) 25%, transparent);
  }
  .rail-chip i {
    font-size: 22px;
  }
  .performer-separator {
    display: flex;
    justify-content: center;
    padding: 0;
  }
  .separator-line {
    width: 32px;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
  }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`

Expected: Pass (no more references to `"performers"` PopoverId in this file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/RightRail.svelte
git commit -m "feat(performer-rail): additive right rail with global + performer chip sections"
```

---

### Task 7: Create PerformerRail (Bottom Center)

**Files:**
- Create: `src/lib/shared/3d/components/controls/PerformerRail.svelte`

Horizontal chip strip at bottom center. Replaces the retired `PerformerChipStrip`. Uses the same glassmorphic 56x56 chip spec as the right rail.

- [ ] **Step 1: Create PerformerRail.svelte**

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { STAGE } from "@austencloud/scene-3d";
  import { getPerformerColor } from "../../constants/performer-colors";

  const viewer = getViewer3DContext();
  const performers = $derived(viewer.performerManager.performers);
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const canAdd = $derived(performers.length < STAGE.MAX_VIEWER_PERFORMERS);

  function selectAll(): void {
    viewer.selectPerformerScope(null);
    viewer.closePopover();
  }

  function selectPerformer(i: number): void {
    const newIndex = selectedIndex === i ? null : i;
    viewer.selectPerformerScope(newIndex);
    if (newIndex === null) viewer.closePopover();
  }

  function addPerformer(): void {
    viewer.spawnPerformerFromUI();
  }
</script>

{#if performers.length >= 1}
  <div class="performer-rail" role="toolbar" aria-label="Performer selection">
    <button
      class="rail-chip all-chip"
      aria-pressed={selectedIndex === null}
      aria-label="All performers (Bird's Eye)"
      data-tooltip="All"
      onclick={selectAll}
    >
      <i class="fas fa-users"></i>
    </button>

    <div class="separator" aria-hidden="true"></div>

    {#each performers as _, i (i)}
      {@const color = getPerformerColor(i)}
      <button
        class="rail-chip performer-chip"
        aria-pressed={selectedIndex === i}
        aria-label="Performer {i + 1}"
        data-tooltip="Performer {i + 1}"
        style:--performer-color={color}
        onclick={() => selectPerformer(i)}
      >
        <span class="performer-number">{i + 1}</span>
        <span class="performer-dot"></span>
      </button>
    {/each}

    <div class="separator" aria-hidden="true"></div>

    <button
      class="rail-chip add-chip"
      aria-label="Add performer"
      data-tooltip="Add"
      disabled={!canAdd}
      onclick={addPerformer}
    >
      <i class="fas fa-plus"></i>
    </button>
  </div>
{/if}

<style>
  .performer-rail {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    z-index: 20;
  }
  .rail-chip {
    width: 56px;
    height: 56px;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    color: rgba(255, 255, 255, 0.62);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }
  .rail-chip:hover:not(:disabled)::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    white-space: nowrap;
    pointer-events: none;
  }
  .rail-chip[aria-pressed="true"]::after {
    display: none;
  }
  .rail-chip i {
    font-size: 22px;
  }
  .rail-chip:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* All chip */
  .all-chip[aria-pressed="true"] {
    background: color-mix(in srgb, #4a9eff 18%, transparent);
    border-color: color-mix(in srgb, #4a9eff 50%, transparent);
    color: #8fc3ff;
    box-shadow: 0 4px 20px color-mix(in srgb, #4a9eff 25%, transparent);
  }

  /* Performer chip */
  .performer-chip {
    position: relative;
  }
  .performer-number {
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
  }
  .performer-dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--performer-color);
  }
  .performer-chip[aria-pressed="true"] {
    border-color: var(--performer-color);
    box-shadow: 0 4px 20px color-mix(in srgb, var(--performer-color) 30%, transparent);
  }
  .performer-chip[aria-pressed="true"] .performer-number {
    color: var(--performer-color);
  }
  .performer-chip[aria-pressed="true"] .performer-dot {
    box-shadow: 0 0 8px var(--performer-color);
  }

  /* Add chip */
  .add-chip {
    border-style: dashed;
  }

  /* Separator */
  .separator {
    width: 1px;
    height: 32px;
    background: rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/components/controls/PerformerRail.svelte
git commit -m "feat(performer-rail): create bottom-center PerformerRail component"
```

---

### Task 8: Mount PerformerRail in ViewerSplitPane

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte`

Mount `PerformerRail` alongside `RightRail` inside the 3D animation pane section.

- [ ] **Step 1: Add import**

At the top of the `<script>` block, after the existing `RightRail` import (line 21), add:

```typescript
import PerformerRail from "$lib/shared/3d/components/controls/PerformerRail.svelte";
```

- [ ] **Step 2: Mount PerformerRail next to the 3D RightRail**

Find the line (currently ~363):
```svelte
      <RightRail renderMode="3d" {bpm} {onBpmChange} />
```

Add `<PerformerRail />` immediately after it:

```svelte
      <RightRail renderMode="3d" {bpm} {onBpmChange} />
      <PerformerRail />
```

Both `RightRail` and `PerformerRail` use absolute positioning within the same `position: relative` parent (the `.media-pane`), so they won't interfere.

- [ ] **Step 3: Typecheck**

Run: `npm run check`

Expected: Pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
git commit -m "feat(performer-rail): mount PerformerRail in 3D viewer pane"
```

---

### Task 9: Retire PerformerPopover and PerformerChipStrip

**Files:**
- Delete: `src/lib/shared/sequence-viewer/components/PerformerPopover.svelte`
- Delete: `src/lib/shared/3d/components/controls/PerformerChipStrip.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/RightRail.svelte` (remove old import if still present)

The old `PerformerPopover` (mega-popover with tabs) and `PerformerChipStrip` (inline chip selector inside popover header) are fully replaced by the new PerformerRail + additive right rail + dedicated popovers.

- [ ] **Step 1: Verify no remaining imports of PerformerPopover**

Run: `grep -r "PerformerPopover" src/` — should only appear in the file itself (which we're deleting). The new `RightRail.svelte` from Task 6 already removed its import.

- [ ] **Step 2: Verify no remaining imports of PerformerChipStrip**

Run: `grep -r "PerformerChipStrip" src/` — should only appear in `PerformerPopover.svelte` (being deleted) and the file itself.

- [ ] **Step 3: Delete both files**

```bash
git rm src/lib/shared/sequence-viewer/components/PerformerPopover.svelte
git rm src/lib/shared/3d/components/controls/PerformerChipStrip.svelte
```

- [ ] **Step 4: Typecheck**

Run: `npm run check`

Expected: Pass — all references removed in prior tasks.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(performer-rail): retire PerformerPopover and PerformerChipStrip"
```

---

### Task 10: Close Performer Popovers on Deselect

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`

When the user deselects a performer (clicks "All" or toggles off), any open performer-scoped popover should close. Without this, the Effects/Prop/Effort popover would stay open with no performer to target.

- [ ] **Step 1: Add auto-close logic to selectPerformerScope**

Find the `selectPerformerScope` function (currently ~line 326):

```typescript
function selectPerformerScope(index: number | null): void {
  selectedPerformerIndex = index;
}
```

Replace with:

```typescript
const PERFORMER_POPOVERS: Set<PopoverId> = new Set(["effects", "prop", "effort"]);

function selectPerformerScope(index: number | null): void {
  selectedPerformerIndex = index;
  if (index === null && _activePopover && PERFORMER_POPOVERS.has(_activePopover)) {
    _activePopover = null;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`

Expected: Pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state.svelte.ts
git commit -m "fix(performer-rail): close performer popovers on deselect"
```

---

### Task 11: Build and Final Typecheck

**Files:** None (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npm run check`

Expected: 0 errors.

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit any fixups**

If typecheck/build surfaced errors, fix them and commit:

```bash
git add -u
git commit -m "fix(performer-rail): resolve typecheck/build errors"
```

---

### Task 12: Browser Verification

**Files:** None (manual verification)

- [ ] **Step 1: Open 3D viewer in browser**

Navigate to a sequence in the 3D viewer. Verify:

1. **Bottom center rail** visible with [All] | [1] | [+] chips
2. **Right rail** shows 6 global chips (Formation, Tempo, Camera, Planes, Export, Scene)
3. Click **performer chip** → right rail gains separator + 3 colored performer chips (Effects, Prop, Effort)
4. Click **"All"** → performer chips slide out, global chips stay
5. Click **Formation chip** → formation selector popover opens
6. Click **Effects chip** (while performer selected) → effects popover with "Performer N" header
7. Click **Prop chip** → prop grid + size slider popover
8. Click **Effort chip** → effort palette popover
9. Click **"+"** → adds performer, new chip appears in bottom rail
10. **Add performer** again → verify chip strip grows, colors cycle correctly
11. **Toggle same performer chip** → deselects (returns to Bird's Eye), performer popovers close

- [ ] **Step 2: Record verification result**

Either take a screenshot or state: "I cannot verify this visually. Please check [specific items above] and tell me what you see."
