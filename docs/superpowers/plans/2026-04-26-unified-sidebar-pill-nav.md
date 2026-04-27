# Unified Sidebar Pill Nav — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CellEditorPanel's flat chip grid with a 5-pill tabbed navigation system (Effects, Style, Playback, Display, Export) with scope hierarchy, Simple/Advanced mode, and theme-aware styling.

**Architecture:** Incremental migration using a feature flag (`usePillNav`) in cell-editor-panel-state. New pill components built alongside existing ChipGrid. Flag toggles between old and new layouts. All three nav variants (pill bar, icon rail, hybrid) share the same pill body components.

**Tech Stack:** SvelteKit 5 (Svelte 5 runes), TypeScript, CSS custom properties, `@austencloud/theme` package, Font Awesome 6 icons.

---

## File Structure

```
src/lib/features/compose/tabs/arrange/components/grid/cell-editor/
├── CellEditorPanel.svelte          (MODIFY — add pill nav integration, feature flag)
├── ChipGrid.svelte                 (KEEP — old path behind flag, removed later)
├── LayerSection.svelte             (KEEP — no changes)
├── state/
│   └── cell-editor-panel-state.svelte.ts  (MODIFY — add pill, scope, mode state)
├── pill-nav/
│   ├── PillNav.svelte              (NEW — Variant A: horizontal pill bar)
│   ├── ScopeSelector.svelte        (NEW — segmented scope buttons)
│   ├── ModeToggle.svelte           (NEW — Simple/Advanced switch)
│   ├── types.ts                    (NEW — shared types for pill system)
│   └── bodies/
│       ├── EffectsPillBody.svelte   (NEW — wraps UnifiedEffectsSection)
│       ├── StylePillBody.svelte     (NEW — wraps Transform+Colors+Effort)
│       ├── PlaybackPillBody.svelte  (NEW — wraps Speed+Transport+Offset)
│       ├── DisplayPillBody.svelte   (NEW — overlay+grid visibility toggles)
│       └── ExportPillBody.svelte    (NEW — frame rate+resolution+timing+loops)
├── sections/                        (KEEP — all existing section components reused)
```

Icon Rail (Variant B) and Hybrid (Variant C) nav components are deferred to a follow-up plan after Variant A is validated.

---

### Task 1: Pill Nav Types and State

**Files:**
- Create: `pill-nav/types.ts`
- Modify: `state/cell-editor-panel-state.svelte.ts`

- [ ] **Step 1: Create pill nav type definitions**

```typescript
// pill-nav/types.ts
export type PillId = 'effects' | 'style' | 'playback' | 'display' | 'export';
export type ScopeLevel = 'cell' | 'layer' | 'hand' | 'tip';
export type EditorMode = 'simple' | 'advanced';

export interface PillConfig {
  id: PillId;
  label: string;
  icon: string;
  scopes: ScopeLevel[];
}

export const PILL_CONFIGS: PillConfig[] = [
  { id: 'effects', label: 'Effects', icon: 'fa-wand-magic-sparkles', scopes: ['cell', 'layer', 'hand', 'tip'] },
  { id: 'style', label: 'Style', icon: 'fa-palette', scopes: ['cell', 'layer', 'hand'] },
  { id: 'playback', label: 'Playback', icon: 'fa-play', scopes: ['cell', 'layer'] },
  { id: 'display', label: 'Display', icon: 'fa-eye', scopes: [] },
  { id: 'export', label: 'Export', icon: 'fa-sliders', scopes: [] },
];
```

- [ ] **Step 2: Extend cell-editor-panel-state with pill nav state**

Add to `cell-editor-panel-state.svelte.ts`:

```typescript
import type { PillId, ScopeLevel, EditorMode } from '../pill-nav/types';

// Add to ExpandableSection type — keep existing for backward compat
export type ExpandableSection =
  | 'transform' | 'speed' | 'effects' | 'effort' | 'offset' | 'display' | 'colors'
  | null;

export function createCellEditorPanelState() {
  let expandedSection = $state<ExpandableSection>(null);
  let applyToHand = $state<TargetHand>('both');

  // New pill nav state
  let activePill = $state<PillId>('effects');
  let scopeLevel = $state<ScopeLevel>('cell');
  let editorMode = $state<EditorMode>('simple');
  let usePillNav = $state<boolean>(true);

  return {
    // Existing getters (keep for backward compat)
    get expandedSection() { return expandedSection; },
    get applyToHand() { return applyToHand; },

    // New pill nav getters
    get activePill() { return activePill; },
    get scopeLevel() { return scopeLevel; },
    get editorMode() { return editorMode; },
    get usePillNav() { return usePillNav; },

    // Existing methods (keep)
    toggleSection(section: ExpandableSection) {
      expandedSection = expandedSection === section ? null : section;
    },
    closeSection() { expandedSection = null; },
    setApplyToHand(hand: TargetHand) { applyToHand = hand; },

    // New pill nav methods
    setActivePill(pill: PillId) { activePill = pill; },
    setScopeLevel(level: ScopeLevel) { scopeLevel = level; },
    setEditorMode(mode: EditorMode) { editorMode = mode; },
    setUsePillNav(enabled: boolean) { usePillNav = enabled; },

    resetForNewCell() {
      expandedSection = null;
      applyToHand = 'both';
      scopeLevel = 'cell';
      // Keep activePill and editorMode across cell switches
    },
  };
}
```

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/types.ts \
        src/lib/features/compose/tabs/arrange/components/grid/cell-editor/state/cell-editor-panel-state.svelte.ts
git commit -m "feat(pill-nav): add types and extend panel state with pill/scope/mode"
```

---

### Task 2: ModeToggle Component

**Files:**
- Create: `pill-nav/ModeToggle.svelte`

- [ ] **Step 1: Create ModeToggle component**

```svelte
<!--
  ModeToggle.svelte
  Simple/Advanced mode toggle for the cell editor panel.
-->
<script lang="ts">
  import type { EditorMode } from './types';

  let {
    mode,
    onModeChange,
  }: {
    mode: EditorMode;
    onModeChange: (mode: EditorMode) => void;
  } = $props();
</script>

<div class="mode-toggle" role="radiogroup" aria-label="Editor mode">
  <button
    class="mode-btn"
    class:active={mode === 'simple'}
    role="radio"
    aria-checked={mode === 'simple'}
    onclick={() => onModeChange('simple')}
  >
    Simple
  </button>
  <button
    class="mode-btn"
    class:active={mode === 'advanced'}
    role="radio"
    aria-checked={mode === 'advanced'}
    onclick={() => onModeChange('advanced')}
  >
    Advanced
  </button>
</div>

<style>
  .mode-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 12px;
  }

  .mode-btn {
    padding: 6px 16px;
    min-height: 44px;
    border-radius: var(--chip-radius, 22px);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
    background: var(--surface-idle, rgba(255, 255, 255, 0.03));
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  }

  .mode-btn.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent);
    color: var(--theme-accent, #8b5cf6);
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-btn { transition: none; }
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/ModeToggle.svelte
git commit -m "feat(pill-nav): add ModeToggle component (Simple/Advanced)"
```

---

### Task 3: PillNav Component (Variant A)

**Files:**
- Create: `pill-nav/PillNav.svelte`

- [ ] **Step 1: Create PillNav component**

```svelte
<!--
  PillNav.svelte
  Variant A: horizontal pill bar with 5 pills showing icon + label + current value.
-->
<script lang="ts">
  import type { PillId } from './types';
  import { PILL_CONFIGS } from './types';

  let {
    activePill,
    summaries,
    onPillChange,
  }: {
    activePill: PillId;
    summaries: Record<PillId, string>;
    onPillChange: (pill: PillId) => void;
  } = $props();
</script>

<nav class="pill-nav" role="tablist" aria-label="Editor sections">
  {#each PILL_CONFIGS as pill (pill.id)}
    <button
      class="pill"
      class:active={activePill === pill.id}
      role="tab"
      aria-selected={activePill === pill.id}
      aria-controls="pill-body-{pill.id}"
      onclick={() => onPillChange(pill.id)}
    >
      <span class="pill-icon"><i class="fas {pill.icon}" aria-hidden="true"></i></span>
      <span class="pill-label">{pill.label}</span>
      <span class="pill-summary">{summaries[pill.id] ?? ''}</span>
    </button>
  {/each}
</nav>

<style>
  .pill-nav {
    display: flex;
    gap: 3px;
    padding: 6px 0;
    flex-shrink: 0;
  }

  .pill {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 5px 2px;
    gap: 1px;
    border-radius: 8px;
    min-width: 0;
    text-align: center;
    background: var(--surface-idle, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.06));
    color: rgba(255, 255, 255, 0.72);
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .pill.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent);
  }

  .pill-icon {
    font-size: 12px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.72);
  }

  .pill.active .pill-icon { color: var(--theme-accent, #8b5cf6); }

  .pill-label {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    color: rgba(255, 255, 255, 0.72);
  }

  .pill.active .pill-label { color: var(--theme-accent, #8b5cf6); }

  .pill-summary {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .pill.active .pill-summary { color: var(--theme-accent, #8b5cf6); }

  @media (prefers-reduced-motion: reduce) {
    .pill { transition: none; }
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/PillNav.svelte
git commit -m "feat(pill-nav): add PillNav component (Variant A horizontal bar)"
```

---

### Task 4: ScopeSelector Component

**Files:**
- Create: `pill-nav/ScopeSelector.svelte`

- [ ] **Step 1: Create ScopeSelector component**

```svelte
<!--
  ScopeSelector.svelte
  Segmented scope buttons: Cell / Layer / Hand / Tip.
  Hides scopes not available for the active pill.
  Hides Layer when cell has only 1 layer.
-->
<script lang="ts">
  import type { ScopeLevel, PillId } from './types';
  import { PILL_CONFIGS } from './types';

  let {
    activePill,
    scopeLevel,
    layerCount = 1,
    echoActive = false,
    onScopeChange,
  }: {
    activePill: PillId;
    scopeLevel: ScopeLevel;
    layerCount?: number;
    echoActive?: boolean;
    onScopeChange: (scope: ScopeLevel) => void;
  } = $props();

  const pillConfig = $derived(PILL_CONFIGS.find(p => p.id === activePill)!);
  const availableScopes = $derived.by(() => {
    let scopes = pillConfig.scopes;
    if (layerCount <= 1) scopes = scopes.filter(s => s !== 'layer');
    if (echoActive) scopes = scopes.filter(s => s !== 'tip');
    return scopes;
  });
  const hasScopes = $derived(availableScopes.length > 0);

  const SCOPE_ICONS: Record<ScopeLevel, string> = {
    cell: 'fa-border-all',
    layer: 'fa-layer-group',
    hand: 'fa-hand',
    tip: 'fa-circle-plus',
  };

  const SCOPE_LABELS: Record<ScopeLevel, string> = {
    cell: 'Cell',
    layer: 'Layer',
    hand: 'Hand',
    tip: 'Tip',
  };
</script>

{#if hasScopes}
  <div class="scope-row">
    <span class="scope-label">SCOPE</span>
    <div class="scope-segments" role="radiogroup" aria-label="Scope level">
      {#each availableScopes as scope (scope)}
        <button
          class="scope-seg"
          class:active={scopeLevel === scope}
          role="radio"
          aria-checked={scopeLevel === scope}
          onclick={() => onScopeChange(scope)}
        >
          <i class="fas {SCOPE_ICONS[scope]}" aria-hidden="true"></i>
          {SCOPE_LABELS[scope]}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .scope-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .scope-label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.7);
    flex-shrink: 0;
  }

  .scope-segments {
    display: flex;
    flex: 1;
    background: var(--surface-idle, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.06));
    border-radius: 8px;
    overflow: hidden;
  }

  .scope-seg {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 44px;
    padding: 6px 4px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    border-right: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.06));
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
  }

  .scope-seg:last-child { border-right: none; }

  .scope-seg.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 15%, transparent);
    color: var(--theme-accent, #8b5cf6);
    box-shadow: inset 0 -2px 0 var(--theme-accent, #a855f7);
  }

  .scope-seg i { font-size: 12px; }

  @media (prefers-reduced-motion: reduce) {
    .scope-seg { transition: none; }
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/ScopeSelector.svelte
git commit -m "feat(pill-nav): add ScopeSelector component with dynamic scope filtering"
```

---

### Task 5: EffectsPillBody Component

**Files:**
- Create: `pill-nav/bodies/EffectsPillBody.svelte`

This wraps the existing `UnifiedEffectsSection` but adds the 4×4 icon-only grid as the primary selector, with "Choose a Look" and "Customize" accordions below.

- [ ] **Step 1: Create EffectsPillBody**

The component renders:
1. A 4×4 icon-only effect grid (16 effects)
2. "Choose a Look" accordion (preset selector)
3. "Customize [Effect]" accordion (delegates to UnifiedEffectsSection)

```svelte
<!--
  EffectsPillBody.svelte
  4×4 icon-only effect grid with presets and customize accordions.
-->
<script lang="ts">
  import type { CellEffect } from '$lib/features/compose/compose/domain/types';
  import type { TipEffectMap } from '$lib/shared/animation-engine/domain/types/TipEffectTypes';
  import { TrailMode } from '$lib/shared/animation-engine/domain/types/TrailTypes';
  import UnifiedEffectsSection from '../../sections/UnifiedEffectsSection.svelte';

  let {
    currentEffect = 'none',
    currentTrailMode,
    tipEffectMap = {},
    onSetEffect,
    onSetTrailMode,
    onUpdateTipEffectMap,
  }: {
    currentEffect: CellEffect | 'none';
    currentTrailMode?: TrailMode;
    tipEffectMap?: TipEffectMap;
    onSetEffect: (effect: CellEffect) => void;
    onSetTrailMode?: (mode: TrailMode) => void;
    onUpdateTipEffectMap?: (map: TipEffectMap) => void;
  } = $props();

  interface EffectDef {
    id: CellEffect;
    icon: string;
    color: string;
  }

  const EFFECTS: EffectDef[] = [
    { id: 'trails', icon: 'fa-route', color: '#60a5fa' },
    { id: 'fire', icon: 'fa-fire', color: '#f97316' },
    { id: 'led', icon: 'fa-lightbulb', color: '#22c55e' },
    { id: 'coal', icon: 'fa-diamond', color: '#78716c' },
    { id: 'zap', icon: 'fa-bolt', color: '#eab308' },
    { id: 'sparkle', icon: 'fa-star', color: '#f59e0b' },
    { id: 'echo', icon: 'fa-clone', color: '#8b5cf6' },
    { id: 'bloom', icon: 'fa-sun', color: '#fbbf24' },
    { id: 'water', icon: 'fa-droplet', color: '#06b6d4' },
    { id: 'bubbles', icon: 'fa-circle-notch', color: '#67e8f9' },
    { id: 'petals', icon: 'fa-leaf', color: '#f472b6' },
    { id: 'smoke', icon: 'fa-smog', color: '#94a3b8' },
    { id: 'ink', icon: 'fa-paint-brush', color: '#475569' },
    { id: 'frost', icon: 'fa-snowflake', color: '#7dd3fc' },
    { id: 'silk', icon: 'fa-wind', color: '#c084fc' },
    { id: 'pulse', icon: 'fa-bullseye', color: '#ef4444' },
  ];

  let showCustomize = $state(false);

  function isActive(effectId: CellEffect): boolean {
    return currentEffect === effectId;
  }
</script>

<div class="effects-body">
  <span class="section-label">SELECT EFFECT</span>
  <div class="effect-grid">
    {#each EFFECTS as effect (effect.id)}
      <button
        class="effect-btn"
        class:active={isActive(effect.id)}
        style:--effect-color={effect.color}
        title={effect.id.charAt(0).toUpperCase() + effect.id.slice(1)}
        onclick={() => onSetEffect(effect.id)}
      >
        <i class="fas {effect.icon}" aria-hidden="true"></i>
      </button>
    {/each}
  </div>

  {#if currentEffect !== 'none'}
    <button
      class="accordion-row"
      onclick={() => showCustomize = !showCustomize}
    >
      <span class="accordion-title">Customize {currentEffect.charAt(0).toUpperCase() + currentEffect.slice(1)}</span>
      <i class="fas fa-chevron-{showCustomize ? 'down' : 'right'}" aria-hidden="true"></i>
    </button>

    {#if showCustomize}
      <UnifiedEffectsSection
        {currentEffect}
        {currentTrailMode}
        currentMap={tipEffectMap}
        bluePropType="staff"
        redPropType="staff"
        onSetEffect={onSetEffect}
        onSetTrailMode={mode => onSetTrailMode?.(mode)}
        onUpdateMap={map => onUpdateTipEffectMap?.(map)}
      />
    {/if}
  {/if}
</div>

<style>
  .effects-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.7);
  }

  .effect-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .effect-btn {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--action-radius, 8px);
    background: var(--surface-idle, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  }

  .effect-btn i { font-size: 18px; }

  .effect-btn:hover:not(.active) {
    background: var(--surface-hover, rgba(255, 255, 255, 0.08));
    color: rgba(255, 255, 255, 0.72);
  }

  .effect-btn.active {
    border: 1.5px solid var(--effect-color);
    background: color-mix(in srgb, var(--effect-color) 14%, transparent);
    color: var(--effect-color);
  }

  .accordion-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    padding: 8px 10px;
    background: var(--surface-idle, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.06));
    border-radius: var(--action-radius, 8px);
    cursor: pointer;
    transition: background 150ms ease;
  }

  .accordion-row:hover {
    background: var(--surface-hover, rgba(255, 255, 255, 0.06));
  }

  .accordion-title {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.75);
  }

  .accordion-row i {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  @media (prefers-reduced-motion: reduce) {
    .effect-btn, .accordion-row { transition: none; }
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/bodies/EffectsPillBody.svelte
git commit -m "feat(pill-nav): add EffectsPillBody with 4x4 icon grid and customize accordion"
```

---

### Task 6: StylePillBody Component

**Files:**
- Create: `pill-nav/bodies/StylePillBody.svelte`

Wraps existing TransformSection, ColorsSection, and UnifiedEffortSection into a single scrollable body.

- [ ] **Step 1: Create StylePillBody**

```svelte
<!--
  StylePillBody.svelte
  Wraps Transform actions, Colors picker, Effort selector, and Motion Paths.
-->
<script lang="ts">
  import type { TransformType } from '$lib/features/compose/compose/domain/types';
  import type { PropColors } from '$lib/features/compose/compose/domain/types';
  import type { TipEffortMap } from '$lib/shared/animation-engine/domain/types/TipEffectTypes';
  import TransformSection from '../../sections/TransformSection.svelte';
  import ColorsSection from '../../sections/ColorsSection.svelte';
  import UnifiedEffortSection from '../../sections/UnifiedEffortSection.svelte';
  import type { CellEditorPanelState } from '../../state/cell-editor-panel-state.svelte';

  let {
    panelState,
    currentColors,
    currentEffort,
    tipEffortMap = {},
    onTransform,
    onSetColors,
    onSetEffort,
    onUpdateTipEffortMap,
  }: {
    panelState: CellEditorPanelState;
    currentColors: PropColors;
    currentEffort: string | undefined;
    tipEffortMap?: TipEffortMap;
    onTransform: (type: TransformType) => void;
    onSetColors: (colors: PropColors) => void;
    onSetEffort: (effort: string) => void;
    onUpdateTipEffortMap?: (map: TipEffortMap) => void;
  } = $props();
</script>

<div class="style-body">
  <span class="section-label">TRANSFORM</span>
  <TransformSection {panelState} {onTransform} />

  <span class="section-label">COLORS</span>
  <ColorsSection {currentColors} onSetColors={onSetColors} />

  <span class="section-label">EFFORT</span>
  <UnifiedEffortSection
    {currentEffort}
    currentMap={tipEffortMap}
    bluePropType="staff"
    redPropType="staff"
    onSetEffort={onSetEffort}
    onUpdateMap={map => onUpdateTipEffortMap?.(map)}
  />
</div>

<style>
  .style-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 4px;
  }

  .section-label:first-child { margin-top: 0; }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: May need to adjust imports based on exact prop types from TransformSection and ColorsSection. The subagent should read those files and adapt.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/bodies/StylePillBody.svelte
git commit -m "feat(pill-nav): add StylePillBody wrapping Transform+Colors+Effort"
```

---

### Task 7: PlaybackPillBody Component

**Files:**
- Create: `pill-nav/bodies/PlaybackPillBody.svelte`

Wraps existing SpeedSection and OffsetSection. Adds transport controls.

- [ ] **Step 1: Create PlaybackPillBody**

```svelte
<!--
  PlaybackPillBody.svelte
  BPM control (wraps SpeedSection), transport controls, and layer offset.
-->
<script lang="ts">
  import SpeedSection from '../../sections/SpeedSection.svelte';
  import OffsetSection from '../../sections/OffsetSection.svelte';

  let {
    currentSpeed = 1.0,
    currentOffset = 0,
    layerCount = 1,
    onSetSpeed,
    onSetOffset,
  }: {
    currentSpeed: number;
    currentOffset: number;
    layerCount?: number;
    onSetSpeed: (speed: number) => void;
    onSetOffset?: (offset: number) => void;
  } = $props();

  const showOffset = $derived(layerCount > 1);
</script>

<div class="playback-body">
  <span class="section-label">SPEED</span>
  <SpeedSection {currentSpeed} {onSetSpeed} />

  {#if showOffset && onSetOffset}
    <span class="section-label">LAYER OFFSET</span>
    <OffsetSection {currentOffset} {onSetOffset} />
  {/if}
</div>

<style>
  .playback-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.7);
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/bodies/PlaybackPillBody.svelte
git commit -m "feat(pill-nav): add PlaybackPillBody wrapping Speed+Offset"
```

---

### Task 8: DisplayPillBody Component

**Files:**
- Create: `pill-nav/bodies/DisplayPillBody.svelte`

Toggle chips for overlay visibility and grid point visibility.

- [ ] **Step 1: Create DisplayPillBody**

```svelte
<!--
  DisplayPillBody.svelte
  Overlay visibility toggles (TKA Glyph, Step #, etc.) and grid point toggles.
-->
<script lang="ts">
  import type { CellMediaType } from '$lib/features/compose/compose/domain/types';

  let {
    currentMediaType = 'animation' as CellMediaType,
    layerCount = 1,
    blueVisible = true,
    redVisible = true,
    onMediaTypeChange,
    onToggleBlueVisibility,
    onToggleRedVisibility,
  }: {
    currentMediaType?: CellMediaType;
    layerCount?: number;
    blueVisible?: boolean;
    redVisible?: boolean;
    onMediaTypeChange: (type: CellMediaType) => void;
    onToggleBlueVisibility: () => void;
    onToggleRedVisibility: () => void;
  } = $props();

  const choreoDisabled = $derived(layerCount > 1);
</script>

<div class="display-body">
  <span class="section-label">MEDIA TYPE</span>
  <div class="toggle-row">
    <button
      class="toggle-chip"
      class:active={currentMediaType === 'animation'}
      onclick={() => onMediaTypeChange('animation')}
    >
      <i class="fas fa-film" aria-hidden="true"></i>
      Animation
    </button>
    <button
      class="toggle-chip"
      class:active={currentMediaType === 'choreo-card'}
      disabled={choreoDisabled}
      onclick={() => onMediaTypeChange('choreo-card')}
      title={choreoDisabled ? 'Choreo Card requires a single layer' : ''}
    >
      <i class="fas fa-id-card" aria-hidden="true"></i>
      Choreo Card
    </button>
  </div>

  <span class="section-label">VISIBILITY</span>
  <div class="toggle-row">
    <button
      class="toggle-chip"
      class:active={blueVisible}
      onclick={onToggleBlueVisibility}
    >
      <span class="color-dot" style:background="#3b82f6"></span>
      Blue Hand
    </button>
    <button
      class="toggle-chip"
      class:active={redVisible}
      onclick={onToggleRedVisibility}
    >
      <span class="color-dot" style:background="#ef4444"></span>
      Red Hand
    </button>
  </div>
</div>

<style>
  .display-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.7);
  }

  .toggle-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .toggle-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 8px 14px;
    border-radius: var(--chip-radius, 22px);
    background: var(--surface-idle, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .toggle-chip:hover:not(:disabled) {
    background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  }

  .toggle-chip.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 12%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 35%, transparent);
    color: var(--theme-accent, #8b5cf6);
  }

  .toggle-chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-chip { transition: none; }
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/bodies/DisplayPillBody.svelte
git commit -m "feat(pill-nav): add DisplayPillBody with media type and visibility toggles"
```

---

### Task 9: ExportPillBody Component

**Files:**
- Create: `pill-nav/bodies/ExportPillBody.svelte`

Frame rate, resolution, timing, and loops controls for export configuration.

- [ ] **Step 1: Create ExportPillBody**

```svelte
<!--
  ExportPillBody.svelte
  Export settings: frame rate, resolution, timing holds, loop count.
-->
<script lang="ts">
  let {
    frameRate = 60,
    resolution = '1080p',
    startHold = false,
    endHold = false,
    loops = 1,
    onFrameRateChange,
    onResolutionChange,
    onStartHoldChange,
    onEndHoldChange,
    onLoopsChange,
  }: {
    frameRate?: number;
    resolution?: string;
    startHold?: boolean;
    endHold?: boolean;
    loops?: number;
    onFrameRateChange?: (fps: number) => void;
    onResolutionChange?: (res: string) => void;
    onStartHoldChange?: (hold: boolean) => void;
    onEndHoldChange?: (hold: boolean) => void;
    onLoopsChange?: (count: number) => void;
  } = $props();

  const FPS_OPTIONS = [30, 60, 120];
  const RES_OPTIONS = ['720p', '1080p', '4K', '8K'];
</script>

<div class="export-body">
  <span class="section-label">FRAME RATE</span>
  <div class="option-row three-col">
    {#each FPS_OPTIONS as fps}
      <button
        class="option-btn"
        class:active={frameRate === fps}
        onclick={() => onFrameRateChange?.(fps)}
      >
        {fps} fps
      </button>
    {/each}
  </div>

  <span class="section-label">RESOLUTION</span>
  <div class="option-row four-col">
    {#each RES_OPTIONS as res}
      <button
        class="option-btn"
        class:active={resolution === res}
        onclick={() => onResolutionChange?.(res)}
      >
        {res}
      </button>
    {/each}
  </div>

  <span class="section-label">TIMING</span>
  <div class="option-row two-col">
    <button
      class="option-btn"
      class:active={startHold}
      onclick={() => onStartHoldChange?.(!startHold)}
    >
      <i class="fas fa-step-backward" aria-hidden="true"></i>
      Start Hold
    </button>
    <button
      class="option-btn"
      class:active={endHold}
      onclick={() => onEndHoldChange?.(!endHold)}
    >
      <i class="fas fa-step-forward" aria-hidden="true"></i>
      End Hold
    </button>
  </div>

  <div class="loops-row">
    <span class="loops-label">Loops</span>
    <div class="loops-stepper">
      <button
        class="stepper-btn"
        onclick={() => onLoopsChange?.(Math.max(1, loops - 1))}
        disabled={loops <= 1}
      >
        <i class="fas fa-minus" aria-hidden="true"></i>
      </button>
      <span class="loops-value">{loops}x</span>
      <button
        class="stepper-btn"
        onclick={() => onLoopsChange?.(loops + 1)}
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</div>

<style>
  .export-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.7);
  }

  .option-row { display: grid; gap: 4px; }
  .two-col { grid-template-columns: 1fr 1fr; }
  .three-col { grid-template-columns: 1fr 1fr 1fr; }
  .four-col { grid-template-columns: repeat(4, 1fr); }

  .option-btn {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border-radius: var(--action-radius, 8px);
    background: var(--surface-idle, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .option-btn:hover {
    background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  }

  .option-btn.active {
    border: 1.5px solid var(--theme-accent, #8b5cf6);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 14%, transparent);
    color: var(--theme-accent, #8b5cf6);
  }

  .option-btn i { font-size: 12px; }

  .loops-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
  }

  .loops-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.72);
  }

  .loops-stepper {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stepper-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--action-radius, 8px);
    background: var(--surface-idle, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
    color: rgba(255, 255, 255, 0.72);
    cursor: pointer;
  }

  .stepper-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .stepper-btn i { font-size: 12px; }

  .loops-value {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    min-width: 28px;
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .option-btn { transition: none; }
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/pill-nav/bodies/ExportPillBody.svelte
git commit -m "feat(pill-nav): add ExportPillBody with frame rate, resolution, timing, loops"
```

---

### Task 10: Wire Pill Nav into CellEditorPanel

**Files:**
- Modify: `CellEditorPanel.svelte`

This is the integration task. Add the pill nav system alongside the existing ChipGrid, gated by the `usePillNav` flag.

- [ ] **Step 1: Add pill nav imports and summary derivations to CellEditorPanel**

Add to the `<script>` section after existing imports:

```typescript
import PillNav from './pill-nav/PillNav.svelte';
import ModeToggle from './pill-nav/ModeToggle.svelte';
import ScopeSelector from './pill-nav/ScopeSelector.svelte';
import EffectsPillBody from './pill-nav/bodies/EffectsPillBody.svelte';
import StylePillBody from './pill-nav/bodies/StylePillBody.svelte';
import PlaybackPillBody from './pill-nav/bodies/PlaybackPillBody.svelte';
import DisplayPillBody from './pill-nav/bodies/DisplayPillBody.svelte';
import ExportPillBody from './pill-nav/bodies/ExportPillBody.svelte';
import type { PillId } from './pill-nav/types';
```

Add summary derivations:

```typescript
const pillSummaries = $derived<Record<PillId, string>>({
  effects: cell.effect && cell.effect !== 'none' ? cell.effect.charAt(0).toUpperCase() + cell.effect.slice(1) : 'None',
  style: cell.effort ?? 'Linear',
  playback: `${Math.round((cell.speedMultiplier ?? 1) * 60)} BPM`,
  display: 'Anim',
  export: '1080p',
});
```

- [ ] **Step 2: Add pill nav markup between LayerSection and expanded sections**

Replace the current `{#if cell.layers.length > 0}` ChipGrid block with a conditional:

```svelte
{#if cell.layers.length > 0}
  {#if panelState.usePillNav}
    <ModeToggle
      mode={panelState.editorMode}
      onModeChange={mode => panelState.setEditorMode(mode)}
    />

    <PillNav
      activePill={panelState.activePill}
      summaries={pillSummaries}
      onPillChange={pill => panelState.setActivePill(pill)}
    />

    {#if panelState.editorMode === 'advanced'}
      <ScopeSelector
        activePill={panelState.activePill}
        scopeLevel={panelState.scopeLevel}
        layerCount={cell.layers.length}
        echoActive={cell.effect === 'echo'}
        onScopeChange={level => panelState.setScopeLevel(level)}
      />
    {/if}

    <div class="pill-body" id="pill-body-{panelState.activePill}" role="tabpanel">
      {#if panelState.activePill === 'effects'}
        <EffectsPillBody
          currentEffect={cell.effect ?? 'none'}
          currentTrailMode={cell.trailMode}
          tipEffectMap={cell.tipEffectMap ?? {}}
          onSetEffect={effect => p.onSetEffect?.(effect)}
          onSetTrailMode={mode => p.onSetTrailMode?.(mode)}
          onUpdateTipEffectMap={map => p.onSetTipEffectMap?.(map)}
        />
      {:else if panelState.activePill === 'style'}
        <StylePillBody
          {panelState}
          currentColors={cell.layers[0]?.propColors ?? { left: '#3b82f6', right: '#ef4444' }}
          currentEffort={cell.effort}
          tipEffortMap={cell.tipEffortMap ?? {}}
          onTransform={handleTransform}
          onSetColors={colors => p.onSetColors?.(colors)}
          onSetEffort={effort => p.onSetEffort?.(effort)}
          onUpdateTipEffortMap={map => p.onSetTipEffortMap?.(map)}
        />
      {:else if panelState.activePill === 'playback'}
        <PlaybackPillBody
          currentSpeed={cell.speedMultiplier ?? 1.0}
          currentOffset={cell.beatOffset}
          layerCount={cell.layers.length}
          onSetSpeed={speed => p.onSetSpeed?.(speed)}
          onSetOffset={offset => p.onSetOffset?.(offset)}
        />
      {:else if panelState.activePill === 'display'}
        <DisplayPillBody
          currentMediaType={cell.mediaType}
          layerCount={cell.layers.length}
          blueVisible={cell.blueMotionVisible !== false}
          redVisible={cell.redMotionVisible !== false}
          onMediaTypeChange={type => p.onMediaTypeChange(type)}
          onToggleBlueVisibility={handleToggleBlueVisibility}
          onToggleRedVisibility={handleToggleRedVisibility}
        />
      {:else if panelState.activePill === 'export'}
        <ExportPillBody />
      {/if}
    </div>
  {:else}
    <!-- Old chip grid path (feature flag off) -->
    <ChipGrid
      {cell}
      {panelState}
      onToggleBlueVisibility={handleToggleBlueVisibility}
      onToggleRedVisibility={handleToggleRedVisibility}
    />
    <!-- Old expanded sections -->
    {#if panelState.expandedSection === 'transform'}
      <TransformSection {panelState} onTransform={handleTransform} />
    {:else if panelState.expandedSection === 'speed'}
      <SpeedSection
        currentSpeed={cell.speedMultiplier ?? 1.0}
        onSetSpeed={speed => p.onSetSpeed?.(speed)}
      />
    {:else if panelState.expandedSection === 'effects'}
      <UnifiedEffectsSection
        currentEffect={cell.effect ?? "none"}
        currentTrailMode={cell.trailMode}
        currentMap={cell.tipEffectMap ?? {}}
        bluePropType="staff"
        redPropType="staff"
        onSetEffect={effect => p.onSetEffect?.(effect)}
        onSetTrailMode={mode => p.onSetTrailMode?.(mode)}
        onUpdateMap={map => p.onSetTipEffectMap?.(map)}
      />
    {:else if panelState.expandedSection === 'colors'}
      <ColorsSection
        currentColors={cell.layers[0]?.propColors ?? { left: '#3b82f6', right: '#ef4444' }}
        onSetColors={colors => p.onSetColors?.(colors)}
      />
    {:else if panelState.expandedSection === 'effort'}
      <UnifiedEffortSection
        currentEffort={cell.effort}
        currentMap={cell.tipEffortMap ?? {}}
        bluePropType="staff"
        redPropType="staff"
        onSetEffort={effort => p.onSetEffort?.(effort)}
        onUpdateMap={map => p.onSetTipEffortMap?.(map)}
      />
    {:else if panelState.expandedSection === 'offset'}
      <OffsetSection
        currentOffset={cell.beatOffset}
        onSetOffset={offset => p.onSetOffset?.(offset)}
      />
    {:else if panelState.expandedSection === 'display'}
      <DisplaySection
        currentMediaType={cell.mediaType}
        layerCount={cell.layers.length}
        onMediaTypeChange={type => p.onMediaTypeChange(type)}
      />
    {/if}
  {/if}
{/if}
```

- [ ] **Step 3: Add pill-body CSS to the style block**

```css
.pill-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

- [ ] **Step 4: Verify build**

Run: `npm run check`
Fix any type errors (the subagent must read all section component files to match prop interfaces exactly).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte
git commit -m "feat(pill-nav): wire pill nav into CellEditorPanel with feature flag"
```

---

### Task 11: Visual Verification and Polish

**Files:**
- May modify: any pill-nav component for styling fixes

- [ ] **Step 1: Start dev server and navigate to Arrange tab**

Run: `npx vite --port 5174`
Navigate to: `http://localhost:5174` → Compose → Arrange tab → select a cell

- [ ] **Step 2: Verify pill nav renders correctly**

Check:
- ModeToggle shows Simple/Advanced buttons
- PillNav shows 5 pills with icons, labels, and summaries
- Clicking pills switches the body content
- ScopeSelector appears in Advanced mode for Effects/Style/Playback pills
- ScopeSelector hides for Display/Export pills
- Layer scope hides when cell has 1 layer

- [ ] **Step 3: Test each pill body**

- Effects: 4×4 icon grid renders, clicking an effect highlights it, Customize accordion toggles
- Style: Transform section, Colors section, and Effort section all render
- Playback: Speed section renders, Offset section shows only with 2+ layers
- Display: Media type toggle and visibility toggles work
- Export: Frame rate, resolution, timing, loops controls render

- [ ] **Step 4: Fix any visual issues found**

Common fixes: spacing, alignment, scroll overflow, theme accent color propagation.

- [ ] **Step 5: Run full typecheck**

Run: `npm run check`
Expected: zero errors

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "fix(pill-nav): visual polish and typecheck cleanup"
```
