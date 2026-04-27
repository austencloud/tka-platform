# Arrange Sidebar Icon Rail + Pill Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken duplicate pill-nav implementation in the Arrange sidebar with a 44px icon rail + breadcrumb scope navigation, reusing shared pill types and wiring existing section components directly.

**Architecture:** New shared `IconRailNav.svelte` component (vertical icon rail consuming `PillSpec[]`), Arrange-specific `ScopeBreadcrumb.svelte`, and a rewritten `CellEditorPanel.svelte` that composes IconRailNav + ScopeBreadcrumb + LayerSection + existing section components. No new section components needed — all pill bodies wire directly to `UnifiedEffectsSection`, `TransformSection`, `ColorsSection`, etc.

**Tech Stack:** Svelte 5 (`$props`, `$derived`, `$state`, `$effect`), FontAwesome icons, CSS container queries, shared pill-types.ts (`PillId`, `PillSpec`, `buildPillSpecs`)

**Spec:** `docs/superpowers/specs/2026-04-27-arrange-sidebar-icon-rail-unification-design.md`
**v4 mockup:** `.superpowers/brainstorm/1550584-1777231051/content/unified-pill-nav-v4.html`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/shared/sequence-viewer/components/pill-nav/IconRailNav.svelte` | **CREATE** | Shared vertical icon rail, same `PillSpec[]` contract as DownloadPillNav |
| `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/ScopeBreadcrumb.svelte` | **CREATE** | Breadcrumb nav: Grid › Cell N › LN with clickable segments |
| `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/state/cell-editor-panel-state.svelte.ts` | **MODIFY** | Export `ScopeLevel` (5 levels), `PILL_SCOPE_CONFIG`; remove `usePillNav`, `editorMode` |
| `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/ScopeSelector.svelte` | **MODIFY** | Rewire imports from deleted `types.ts` to shared `pill-types.ts` + state file |
| `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte` | **REWRITE** | IconRailNav + ScopeBreadcrumb + LayerSection + section composition |
| `cell-editor/pill-nav/types.ts` | **DELETE** | Replaced by shared `pill-types.ts` + state file exports |
| `cell-editor/pill-nav/ModeToggle.svelte` | **DELETE** | Unwanted Simple/Advanced toggle |
| `cell-editor/pill-nav/PillNav.svelte` | **DELETE** | Replaced by shared `IconRailNav` |
| `cell-editor/pill-nav/bodies/EffectsPillBody.svelte` | **DELETE** | Replaced by direct `UnifiedEffectsSection` use |
| `cell-editor/pill-nav/bodies/StylePillBody.svelte` | **DELETE** | Replaced by direct section composition |
| `cell-editor/pill-nav/bodies/PlaybackPillBody.svelte` | **DELETE** | Replaced by direct section composition |
| `cell-editor/pill-nav/bodies/DisplayPillBody.svelte` | **DELETE** | Replaced by direct section composition |
| `cell-editor/pill-nav/bodies/ExportPillBody.svelte` | **DELETE** | Replaced by direct section composition |

---

### Task 1: Clean Up Duplicate Pill-Nav Files

**Files:**
- Delete: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/types.ts`
- Delete: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/ModeToggle.svelte`
- Delete: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/PillNav.svelte`
- Delete: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/bodies/EffectsPillBody.svelte`
- Delete: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/bodies/StylePillBody.svelte`
- Delete: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/bodies/PlaybackPillBody.svelte`
- Delete: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/bodies/DisplayPillBody.svelte`
- Delete: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/bodies/ExportPillBody.svelte`
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/state/cell-editor-panel-state.svelte.ts`
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/ScopeSelector.svelte`

This task deletes the 8 duplicate files and rewires the 2 files that imported from them. CellEditorPanel will have broken imports after this task — that's expected, it gets rewritten in Task 5.

- [ ] **Step 1: Delete the 8 duplicate files**

```bash
cd src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav
rm types.ts ModeToggle.svelte PillNav.svelte
rm bodies/EffectsPillBody.svelte bodies/StylePillBody.svelte bodies/PlaybackPillBody.svelte bodies/DisplayPillBody.svelte bodies/ExportPillBody.svelte
rmdir bodies
```

- [ ] **Step 2: Update cell-editor-panel-state.svelte.ts — export ScopeLevel, remove dead state**

Replace the entire file contents with:

```typescript
import type { TargetHand } from '$lib/features/compose/compose/domain/types';
import type { PillId } from '$lib/shared/sequence-viewer/components/pill-nav/pill-types';

export type ScopeLevel = 'grid' | 'cell' | 'layer' | 'hand' | 'tip';

export type ExpandableSection =
  | 'transform' | 'speed' | 'effects' | 'effort' | 'offset' | 'display' | 'colors'
  | null;

export interface PillScopeConfig {
  id: PillId;
  scopes: ScopeLevel[];
}

export const PILL_SCOPE_CONFIG: PillScopeConfig[] = [
  { id: 'effects', scopes: ['cell', 'layer', 'hand', 'tip'] },
  { id: 'effort', scopes: ['cell', 'layer'] },
  { id: 'playback', scopes: ['cell', 'layer'] },
  { id: 'display', scopes: ['cell'] },
  { id: 'export', scopes: [] },
];

export function createCellEditorPanelState() {
  let expandedSection = $state<ExpandableSection>(null);
  let applyToHand = $state<TargetHand>('both');
  let activePill = $state<PillId>('effects');
  let scopeLevel = $state<ScopeLevel>('cell');

  return {
    get expandedSection() { return expandedSection; },
    get applyToHand() { return applyToHand; },
    get activePill() { return activePill; },
    get scopeLevel() { return scopeLevel; },

    toggleSection(section: ExpandableSection) {
      expandedSection = expandedSection === section ? null : section;
    },

    closeSection() {
      expandedSection = null;
    },

    setApplyToHand(hand: TargetHand) {
      applyToHand = hand;
    },

    setActivePill(pill: PillId) { activePill = pill; },
    setScopeLevel(level: ScopeLevel) { scopeLevel = level; },

    resetForNewCell() {
      expandedSection = null;
      applyToHand = 'both';
      scopeLevel = 'cell';
    },
  };
}

export type CellEditorPanelState = ReturnType<typeof createCellEditorPanelState>;
```

- [ ] **Step 3: Update ScopeSelector.svelte — rewire imports**

In `cell-editor/pill-nav/ScopeSelector.svelte`, replace line 2:

```diff
- import type { ScopeLevel, PillId } from './types';
- import { PILL_CONFIGS } from './types';
+ import type { PillId } from '$lib/shared/sequence-viewer/components/pill-nav/pill-types';
+ import { type ScopeLevel, PILL_SCOPE_CONFIG } from '../state/cell-editor-panel-state.svelte';
```

And replace line 19:

```diff
- const pillConfig = $derived(PILL_CONFIGS.find(p => p.id === activePill)!);
+ const pillConfig = $derived(PILL_SCOPE_CONFIG.find(p => p.id === activePill)!);
```

- [ ] **Step 4: Commit cleanup**

```bash
git add -u src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/state/cell-editor-panel-state.svelte.ts
git commit -m "refactor: delete 8 duplicate pill-nav files, rewire state + ScopeSelector imports"
```

Note: Build will fail at this point because CellEditorPanel still imports deleted files. That's expected — Task 5 rewrites it.

---

### Task 2: Create IconRailNav.svelte (Shared Component)

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/pill-nav/IconRailNav.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/shared/sequence-viewer/components/pill-nav/IconRailNav.svelte`:

```svelte
<!--
  IconRailNav.svelte
  Vertical 44px icon rail — shared nav consuming the same PillSpec[] as DownloadPillNav.
  Used by Arrange sidebar (icon rail layout) vs Viewer sidebar (3/2 grid layout).
-->
<script lang="ts">
  import type { PillId, PillSpec } from "./pill-types";

  let {
    pills,
    activeId,
    onSelect,
    onNavMount,
  }: {
    pills: PillSpec[];
    activeId: PillId | null;
    onSelect: (id: PillId) => void;
    onNavMount?: (el: HTMLElement | null) => void;
  } = $props();

  let navEl: HTMLElement | undefined = $state();

  $effect(() => {
    onNavMount?.(navEl ?? null);
    return () => onNavMount?.(null);
  });

  function focusPillAt(index: number) {
    const wrapped = ((index % pills.length) + pills.length) % pills.length;
    const target = navEl?.querySelector<HTMLButtonElement>(
      `[data-pill-id="${pills[wrapped].id}"]`
    );
    target?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    const target = e.currentTarget as HTMLButtonElement;
    const currentIndex = pills.findIndex((p) => p.id === target.dataset.pillId);
    if (currentIndex === -1) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusPillAt(currentIndex + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusPillAt(currentIndex - 1);
        break;
      case "Home":
        e.preventDefault();
        focusPillAt(0);
        break;
      case "End":
        e.preventDefault();
        focusPillAt(pills.length - 1);
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        onSelect(pills[currentIndex].id);
        break;
    }
  }
</script>

<nav
  class="icon-rail"
  role="group"
  aria-label="Editor sections"
  bind:this={navEl}
>
  {#each pills as pill (pill.id)}
    <button
      type="button"
      class="rail-btn"
      data-pill-id={pill.id}
      aria-pressed={activeId === pill.id}
      aria-label={pill.label}
      title="{pill.label}{pill.summary ? ` — ${pill.summary}` : ''}"
      style:--pill-accent={pill.accentColor ?? null}
      onclick={() => onSelect(pill.id)}
      onkeydown={handleKeydown}
    >
      {#if pill.icon}
        <i class="fas {pill.icon}" aria-hidden="true"></i>
      {:else}
        <span
          class="effort-dot"
          style:background={pill.accentColor ?? "#94a3b8"}
        ></span>
      {/if}
    </button>
  {/each}
</nav>

<style>
  .icon-rail {
    width: 44px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.02);
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0;
    gap: 2px;
  }

  .rail-btn {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    background: none;
    border: none;
    border-left: 2px solid transparent;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .rail-btn:hover:not([aria-pressed="true"]) {
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.8);
  }

  .rail-btn:focus-visible {
    outline: 2px solid var(--pill-focus, #4a9eff);
    outline-offset: -2px;
  }

  .rail-btn[aria-pressed="true"] {
    background: color-mix(in srgb, var(--pill-accent, #8b5cf6) 15%, transparent);
    border-left-color: color-mix(in srgb, var(--pill-accent, #a855f7) 100%, transparent);
    color: color-mix(in srgb, var(--pill-accent, #d4b4ff) 100%, white);
  }

  .effort-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  @media (prefers-reduced-motion: reduce) {
    .rail-btn {
      transition: none;
    }
  }

  @media (prefers-contrast: more) {
    .rail-btn {
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .rail-btn[aria-pressed="true"] {
      background: #1a1a2e;
      border-color: white;
      color: white;
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/pill-nav/IconRailNav.svelte
git commit -m "feat: add IconRailNav shared component (44px vertical icon rail)"
```

---

### Task 3: Create ScopeBreadcrumb.svelte

**Files:**
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/ScopeBreadcrumb.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/ScopeBreadcrumb.svelte`:

```svelte
<script lang="ts">
  import type { ScopeLevel } from "./state/cell-editor-panel-state.svelte";

  export interface BreadcrumbSegment {
    level: ScopeLevel;
    label: string;
    dotColor?: string;
  }

  let {
    segments,
    onNavigate,
  }: {
    segments: BreadcrumbSegment[];
    onNavigate: (level: ScopeLevel) => void;
  } = $props();
</script>

<nav class="scope-breadcrumb" aria-label="Scope navigation">
  {#each segments as seg, i (seg.level)}
    {#if i > 0}
      <i class="fas fa-chevron-right bc-sep" aria-hidden="true"></i>
    {/if}
    {#if i === segments.length - 1}
      <span class="bc-segment bc-current" aria-current="location">
        {#if seg.dotColor}
          <span class="bc-dot" style:background={seg.dotColor}></span>
        {/if}
        {seg.label}
      </span>
    {:else}
      <button
        type="button"
        class="bc-segment bc-link"
        onclick={() => onNavigate(seg.level)}
      >
        {#if seg.dotColor}
          <span class="bc-dot" style:background={seg.dotColor}></span>
        {/if}
        {seg.label}
      </button>
    {/if}
  {/each}
</nav>

<style>
  .scope-breadcrumb {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    flex-shrink: 0;
  }

  .bc-segment {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .bc-link {
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    background: none;
    border: none;
    font: inherit;
    font-size: 12px;
    padding: 2px 4px;
    border-radius: 4px;
    transition: color 120ms ease, background 120ms ease;
  }

  .bc-link:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.04);
  }

  .bc-link:focus-visible {
    outline: 2px solid var(--pill-focus, #4a9eff);
    outline-offset: 2px;
  }

  .bc-current {
    color: #d4b4ff;
    font-weight: 600;
    padding: 2px 4px;
  }

  .bc-sep {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
  }

  .bc-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
  }

  @media (prefers-reduced-motion: reduce) {
    .bc-link {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/ScopeBreadcrumb.svelte
git commit -m "feat: add ScopeBreadcrumb component for Grid > Cell > Layer scope navigation"
```

---

### Task 4: Rewrite CellEditorPanel.svelte

**Files:**
- Rewrite: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte`

This is the core task. The component keeps the exact same props interface (CellEditorProps) so ArrangeSidebar needs zero changes. Internally, it switches from ChipGrid + duplicate pill-nav to IconRailNav + ScopeBreadcrumb + direct section composition.

- [ ] **Step 1: Rewrite the full component**

Replace the entire contents of `CellEditorPanel.svelte` with:

```svelte
<!--
  CellEditorPanel.svelte
  Icon rail + breadcrumb layout for the Arrange tab cell editor.
  Reuses shared PillSpec/PillId types; wires section components directly.
-->
<script lang="ts">
  import type { GridCell } from "../../../state/arrange-grid-state.svelte";
  import type {
    TransformType,
    CellMediaType,
    CellEffect,
    PropColors,
  } from "../../../../../compose/domain/types";
  import type { TipEffectMap, TipEffortMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import { TrailMode } from "$lib/shared/animation-engine/domain/types/TrailTypes";
  import type { PillId } from "$lib/shared/sequence-viewer/components/pill-nav/pill-types";
  import { buildPillSpecs } from "$lib/shared/sequence-viewer/components/pill-nav/pill-types";
  import IconRailNav from "$lib/shared/sequence-viewer/components/pill-nav/IconRailNav.svelte";
  import ScopeBreadcrumb, { type BreadcrumbSegment } from "./ScopeBreadcrumb.svelte";
  import { createCellEditorPanelState, type ScopeLevel } from "./state/cell-editor-panel-state.svelte";
  import ScopeSelector from "./pill-nav/ScopeSelector.svelte";
  import LayerSection from "./LayerSection.svelte";
  import TransformSection from "./sections/TransformSection.svelte";
  import SpeedSection from "./sections/SpeedSection.svelte";
  import ColorsSection from "./sections/ColorsSection.svelte";
  import UnifiedEffectsSection from "./sections/UnifiedEffectsSection.svelte";
  import UnifiedEffortSection from "./sections/UnifiedEffortSection.svelte";
  import OffsetSection from "./sections/OffsetSection.svelte";
  import DisplaySection from "./sections/DisplaySection.svelte";

  interface CellEditorProps {
    cell: GridCell;
    cellIndex: number;
    clipboardHasData?: boolean;
    transformingLayer?: { cellId: string; layerIndex: number } | null;
    onAddSequence: () => void;
    onRemoveLayer: (layerIndex: number) => void;
    onEditLayerOffset: (layerIndex: number) => void;
    onClearCell: () => void;
    onRemoveCell?: () => void;
    onMediaTypeChange: (mediaType: CellMediaType) => void;
    onCopyLayer?: (layerIndex: number) => void;
    onCopyCell?: () => void;
    onPasteLayer?: () => void;
    onTransformLayer?: (layerIndex: number, transformType: TransformType) => void;
    onSetSpeed?: (speed: number) => void;
    onSetEffect?: (effect: CellEffect) => void;
    onSetTrailMode?: (mode: TrailMode) => void;
    onSetEffort?: (effort: string) => void;
    onSetColors?: (colors: PropColors) => void;
    onSetBlueVisible?: (visible: boolean) => void;
    onSetRedVisible?: (visible: boolean) => void;
    onSetOffset?: (offset: number) => void;
    onSetTipEffectMap?: (map: TipEffectMap) => void;
    onSetTipEffortMap?: (map: TipEffortMap) => void;
  }

  const p: CellEditorProps = $props();
  const cell = $derived(p.cell);
  const cellIndex = $derived(p.cellIndex);
  const clipboardHasData = $derived(p.clipboardHasData ?? false);
  const transformingLayer = $derived(p.transformingLayer ?? null);

  const panelState = createCellEditorPanelState();

  // Reset state when selected cell changes
  const currentCellId = $derived(cell.id);
  let previousCellId: string | null = null;
  $effect(() => {
    if (previousCellId !== null && currentCellId !== previousCellId) {
      panelState.resetForNewCell();
    }
    previousCellId = currentCellId;
  });

  // ── Pill specs with derived summaries ──

  const effectsSummary = $derived(
    cell.effect && cell.effect !== "none"
      ? cell.effect.charAt(0).toUpperCase() + cell.effect.slice(1)
      : "None"
  );

  const effortLabel = $derived(cell.effort ?? "Linear");
  const colorLabel = $derived.by(() => {
    const colors = cell.layers[0]?.propColors;
    if (!colors) return "Blue/Red";
    const labels: Record<string, string> = {
      "#3b82f6": "Blue/Red", "#a855f7": "Purple/Orange",
      "#10b981": "Emerald/Pink", "#06b6d4": "Cyan/Yellow",
    };
    return labels[colors.left] ?? "Custom";
  });
  const styleSummary = $derived(`${effortLabel} · ${colorLabel}`);

  const playbackSummary = $derived(
    `${(cell.speedMultiplier ?? 1).toFixed(1)}x · +${cell.beatOffset}`
  );

  const displaySummary = $derived(cell.mediaType === "choreo-card" ? "Card" : "Anim");

  const exportSummary = $derived("1080p · 30fps");

  const effortAccent = $derived.by(() => {
    if (!cell.effort || cell.effort === "none") return "#94a3b8";
    const colors: Record<string, string> = {
      linear: "#94a3b8", smooth: "#60a5fa", sharp: "#f97316",
      bounce: "#a855f7", elastic: "#34d399",
    };
    return colors[cell.effort] ?? "#94a3b8";
  });

  const pillSpecs = $derived(
    buildPillSpecs({
      effects: { icon: "fa-wand-magic-sparkles", label: "EFFECTS", summary: effectsSummary },
      effort: { label: "STYLE", summary: styleSummary, accentColor: effortAccent },
      playback: { icon: "fa-play", label: "PLAYBACK", summary: playbackSummary },
      display: { icon: "fa-eye", label: "DISPLAY", summary: displaySummary },
      export: { icon: "fa-download", label: "EXPORT", summary: exportSummary },
    })
  );

  // ── Breadcrumb segments ──

  const breadcrumbSegments = $derived.by<BreadcrumbSegment[]>(() => {
    const segs: BreadcrumbSegment[] = [{ level: "grid", label: "Grid" }];
    segs.push({ level: "cell", label: `Cell ${cellIndex + 1}` });
    if (
      panelState.scopeLevel === "layer" ||
      panelState.scopeLevel === "hand" ||
      panelState.scopeLevel === "tip"
    ) {
      segs.push({ level: "layer", label: "L1" });
    }
    return segs;
  });

  function handleBreadcrumbNav(level: ScopeLevel) {
    panelState.setScopeLevel(level);
  }

  // ── Handlers ──

  function handleTransform(type: TransformType) {
    p.onTransformLayer?.(0, type);
  }

  function handleToggleBlueVisibility() {
    p.onSetBlueVisible?.(cell.blueMotionVisible === false);
  }

  function handleToggleRedVisibility() {
    p.onSetRedVisible?.(cell.redMotionVisible === false);
  }

  const blueVisible = $derived(cell.blueMotionVisible !== false);
  const redVisible = $derived(cell.redMotionVisible !== false);

  function handleKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const key = e.key.toLowerCase();
    const shift = e.shiftKey;
    const map: Record<string, TransformType> = {
      m: "mirror", v: "flip", s: "swapColors", i: "invert", f: "shiftStart",
    };
    if (shift && key === "r") {
      handleTransform("rewind");
      e.preventDefault();
    } else if (map[key]) {
      handleTransform(map[key]);
      e.preventDefault();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="cell-editor-rail-layout">
  <!-- Icon Rail (left) -->
  <IconRailNav
    pills={pillSpecs}
    activeId={panelState.activePill}
    onSelect={(id) => panelState.setActivePill(id)}
  />

  <!-- Main Panel (right) -->
  <div class="cell-editor-main">
    <!-- Breadcrumb -->
    <ScopeBreadcrumb
      segments={breadcrumbSegments}
      onNavigate={handleBreadcrumbNav}
    />

    <!-- Layers section (visible at cell/grid scope) -->
    {#if cell.layers.length > 0 && (panelState.scopeLevel === "cell" || panelState.scopeLevel === "grid")}
      <div class="layers-zone">
        <LayerSection
          {cell}
          {clipboardHasData}
          {transformingLayer}
          onAddSequence={p.onAddSequence}
          onRemoveLayer={p.onRemoveLayer}
          onCopyLayer={p.onCopyLayer}
          onPasteLayer={p.onPasteLayer}
        />
      </div>
    {/if}

    <!-- Pill Body (scrollable) -->
    {#if cell.layers.length > 0}
      <div class="pill-body-scroll" role="region" aria-label="{panelState.activePill} settings">
        {#if panelState.activePill === "effects"}
          <UnifiedEffectsSection
            currentEffect={cell.effect ?? "none"}
            currentTrailMode={cell.trailMode}
            currentMap={cell.tipEffectMap ?? {}}
            bluePropType="staff"
            redPropType="staff"
            onSetEffect={(effect) => p.onSetEffect?.(effect)}
            onSetTrailMode={(mode) => p.onSetTrailMode?.(mode)}
            onUpdateMap={(map) => p.onSetTipEffectMap?.(map)}
          />

        {:else if panelState.activePill === "effort"}
          <div class="style-sections">
            <TransformSection {panelState} onTransform={handleTransform} />
            <ColorsSection
              currentColors={cell.layers[0]?.propColors ?? { left: "#3b82f6", right: "#ef4444" }}
              onSetColors={(colors) => p.onSetColors?.(colors)}
            />
            <UnifiedEffortSection
              currentEffort={cell.effort}
              currentMap={cell.tipEffortMap ?? {}}
              bluePropType="staff"
              redPropType="staff"
              onSetEffort={(effort) => p.onSetEffort?.(effort)}
              onUpdateMap={(map) => p.onSetTipEffortMap?.(map)}
            />
            <div class="visibility-section">
              <span class="section-label">VISIBILITY</span>
              <div class="visibility-row">
                <button
                  type="button"
                  class="vis-btn"
                  class:active={blueVisible}
                  style:--vis-color="#60a5fa"
                  aria-pressed={blueVisible}
                  onclick={handleToggleBlueVisibility}
                >
                  <i class="fas fa-eye" aria-hidden="true"></i> Blue
                </button>
                <button
                  type="button"
                  class="vis-btn"
                  class:active={redVisible}
                  style:--vis-color="#dc2626"
                  aria-pressed={redVisible}
                  onclick={handleToggleRedVisibility}
                >
                  <i class="fas fa-eye" aria-hidden="true"></i> Red
                </button>
              </div>
            </div>
          </div>

        {:else if panelState.activePill === "playback"}
          <SpeedSection
            currentSpeed={cell.speedMultiplier ?? 1.0}
            onSetSpeed={(speed) => p.onSetSpeed?.(speed)}
          />
          <OffsetSection
            currentOffset={cell.beatOffset}
            onSetOffset={(offset) => p.onSetOffset?.(offset)}
          />

        {:else if panelState.activePill === "display"}
          <DisplaySection
            currentMediaType={cell.mediaType}
            layerCount={cell.layers.length}
            onMediaTypeChange={(type) => p.onMediaTypeChange(type)}
          />

        {:else if panelState.activePill === "export"}
          <div class="export-section">
            <button class="download-btn" type="button">
              <i class="fas fa-download" aria-hidden="true"></i>
              Download Arrangement
            </button>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="panel-footer">
        {#if p.onCopyCell}
          <button class="footer-btn copy-all-btn" type="button" onclick={p.onCopyCell}>
            <i class="fas fa-copy" aria-hidden="true"></i>
            Copy All
          </button>
        {/if}
        <button class="footer-btn clear-all-btn" type="button" onclick={p.onClearCell}>
          <i class="fas fa-trash-alt" aria-hidden="true"></i>
          Clear All
        </button>
      </div>
    {:else}
      <div class="empty-state">
        <LayerSection
          {cell}
          {clipboardHasData}
          {transformingLayer}
          onAddSequence={p.onAddSequence}
          onRemoveLayer={p.onRemoveLayer}
          onCopyLayer={p.onCopyLayer}
          onPasteLayer={p.onPasteLayer}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  /* ── Rail Layout ── */
  .cell-editor-rail-layout {
    display: flex;
    min-height: 0;
    flex: 1;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: var(--surface-panel, #0f1119);
    container-type: inline-size;
    container-name: celleditorpanel;

    /* Design tokens (inherited by children) */
    --chip-radius: 22px;
    --action-radius: 10px;
    --badge-radius: 4px;
    --surface-idle: rgba(255, 255, 255, 0.05);
    --surface-hover: rgba(255, 255, 255, 0.08);
    --surface-active-pct: 12%;
    --stroke-idle: rgba(255, 255, 255, 0.08);
    --stroke-hover: rgba(255, 255, 255, 0.15);
    --stroke-active-pct: 35%;
    --chip-gap: clamp(6px, 1.5cqi, 8px);
    --group-gap: clamp(10px, 2.5cqi, 14px);
    --section-gap: clamp(12px, 3cqi, 20px);
  }

  .cell-editor-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  /* ── Layers zone ── */
  .layers-zone {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    flex-shrink: 0;
  }

  /* ── Pill body (scrollable) ── */
  .pill-body-scroll {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .style-sections {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* ── Visibility toggles (inside Style pill) ── */
  .visibility-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-label {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.7);
  }

  .visibility-row {
    display: flex;
    gap: 6px;
  }

  .vis-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 44px;
    padding: 8px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.55);
    font-size: 12px;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  }

  .vis-btn.active {
    background: color-mix(in srgb, var(--vis-color) 12%, transparent);
    border-color: color-mix(in srgb, var(--vis-color) 30%, transparent);
    color: color-mix(in srgb, var(--vis-color) 100%, white 30%);
  }

  .vis-btn i {
    font-size: 11px;
  }

  /* ── Export section ── */
  .export-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .download-btn {
    width: 100%;
    padding: 11px;
    border-radius: 10px;
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    color: white;
    font-size: 13px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: opacity 150ms ease;
  }

  .download-btn:hover {
    opacity: 0.9;
  }

  /* ── Empty state ── */
  .empty-state {
    flex: 1;
    padding: 10px;
  }

  /* ── Footer ── */
  .panel-footer {
    flex-shrink: 0;
    display: flex;
    gap: var(--chip-gap, 6px);
    padding: 8px 10px;
    border-top: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
  }

  .footer-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 10px 14px;
    border-radius: var(--action-radius, 10px);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .copy-all-btn {
    background: var(--surface-idle);
    border: 1px solid var(--stroke-idle);
    color: rgba(255, 255, 255, 0.6);
  }

  .copy-all-btn:hover {
    background: var(--surface-hover);
    border-color: var(--stroke-hover);
  }

  .clear-all-btn {
    background: color-mix(in srgb, #ef4444 6%, transparent);
    border: 1px solid color-mix(in srgb, #ef4444 10%, transparent);
    color: rgba(239, 68, 68, 0.6);
  }

  .clear-all-btn:hover {
    background: color-mix(in srgb, #ef4444 var(--surface-active-pct) , transparent);
    border-color: color-mix(in srgb, #ef4444 20%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .vis-btn,
    .footer-btn,
    .download-btn {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

```bash
npm run check
```

Expected: clean pass (0 errors). If there are type errors, fix them before proceeding.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: successful build.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte
git commit -m "feat: rewrite CellEditorPanel with icon rail + breadcrumb layout

Replaces broken 5-in-a-row pill nav and 9 duplicate components with
shared IconRailNav, ScopeBreadcrumb, and direct section composition.
Same CellEditorProps interface — ArrangeSidebar needs no changes."
```

---

### Task 5: Typecheck, Build, and Visual Verification

**Files:** None — verification only

- [ ] **Step 1: Full typecheck**

```bash
npm run check
```

Expected: 0 errors.

- [ ] **Step 2: Full build**

```bash
npm run build
```

Expected: successful build with no warnings related to cell-editor or pill-nav.

- [ ] **Step 3: Start dev server and verify visually**

```bash
npx vite --port 5174
```

Navigate to the Arrange tab. Verify:
1. Icon rail appears on left (44px, 5 icons stacked vertically)
2. Breadcrumb shows "Grid › Cell N" when cell is selected
3. Clicking rail icons switches pill body content
4. Effects pill shows effect grid (UnifiedEffectsSection)
5. Style pill shows Transform + Colors + Effort + Visibility toggles
6. Playback pill shows Speed slider + Offset stepper
7. Display pill shows Animation/Choreo Card toggle
8. Export pill shows Download button
9. LayerSection appears between breadcrumb and pill body
10. Footer shows Copy All / Clear All buttons
11. Transport controls (play/pause, BPM) are below the grid, NOT in sidebar

If visual verification requires browser: use Chrome DevTools MCP `take_screenshot` after navigating, or say explicitly what the user should check.

- [ ] **Step 4: Commit verification pass**

If any fixes were needed, commit them:

```bash
git add -u
git commit -m "fix: post-verification adjustments for icon rail layout"
```

---

### Task 6: Remove ChipGrid (Dead Code)

**Files:**
- Delete: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/ChipGrid.svelte`

After the CellEditorPanel rewrite, ChipGrid is no longer imported anywhere.

- [ ] **Step 1: Verify ChipGrid has no remaining imports**

```bash
grep -r "ChipGrid" src/ --include="*.svelte" --include="*.ts"
```

Expected: no results (CellEditorPanel no longer imports it).

- [ ] **Step 2: Delete ChipGrid**

```bash
rm src/lib/features/compose/tabs/arrange/components/grid/cell-editor/ChipGrid.svelte
```

- [ ] **Step 3: Typecheck and build**

```bash
npm run check && npm run build
```

Expected: clean pass.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor: remove unused ChipGrid after icon rail migration"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| Option B: Icon Rail + Breadcrumb layout | Task 2 (IconRailNav), Task 3 (ScopeBreadcrumb), Task 4 (rewrite) |
| Delete 8 duplicate pill-nav files | Task 1 |
| Keep ScopeSelector, rewire imports | Task 1 Step 3 |
| Shared `PillId`/`PillSpec`/`buildPillSpecs` reuse | Task 4 (CellEditorPanel imports from shared) |
| Effects pill → UnifiedEffectsSection | Task 4 pill body |
| Style pill → Transform + Colors + Effort + Visibility | Task 4 pill body |
| Playback pill → SpeedSection + OffsetSection | Task 4 pill body |
| Display pill → DisplaySection | Task 4 pill body |
| Export pill → Download button | Task 4 pill body |
| Layers section between breadcrumb and body | Task 4 layers-zone |
| Deep breadcrumb (5 scope levels) | Task 3 + state (Task 1 Step 2) |
| Transport stays below grid | Task 4 (not touched) |
| Looping already works via modulo | No changes needed |
| Remove ModeToggle | Task 1 (deleted) |
| Remove ChipGrid | Task 6 |
| WCAG AAA keyboard nav on rail | Task 2 (Arrow keys, Home/End, aria-pressed) |
| prefers-reduced-motion | Task 2 + Task 3 + Task 4 |
