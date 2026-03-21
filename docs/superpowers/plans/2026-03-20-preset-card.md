# Preset Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Preset card to the generate panel that lets users browse and apply saved generation configurations via a drawer.

**Architecture:** Extends the existing card grid system with a new PresetCard (span 2) in Row 1, rebalancing Word from span 4 to span 2. Preset state (already in `preset.svelte.ts`) gains active-preset tracking. A drawer component allows browsing presets. Selecting a preset fills all cards; tapping any card deselects the preset.

**Tech Stack:** Svelte 5, TypeScript, existing BaseCard component, existing Drawer component, existing panel coordination system.

**Spec:** `docs/superpowers/specs/2026-03-20-preset-card-design.md`

---

### Task 1: Add preset color entry to card-colors.ts

**Files:**
- Modify: `src/lib/features/create/generate/shared/domain/card-colors.ts`

- [ ] **Step 1: Add `preset` to `CardColors` interface**

After line 26 (`customize: CardColorSet;`), add:

```typescript
  preset: CardColorSet;
```

- [ ] **Step 2: Add preset colors to `DEFAULT_COLORS`**

After the `customize` entry (line 73-76), add:

```typescript
  preset: {
    // Warm amber/gold — distinct from other cards, suggests "saved" / "favorite"
    color: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)",
    shadowColor: "38deg 75% 50%",
  },
```

- [ ] **Step 3: Add preset colors to `BRIGHT_BACKGROUND_COLORS`**

After the `customize` entry (line 134-138), add:

```typescript
  preset: {
    // Deep amber/gold — visible on bright backgrounds
    color: "linear-gradient(135deg, #d97706 0%, #b45309 50%, #92400e 100%)",
    shadowColor: "38deg 80% 35%",
  },
```

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/generate/shared/domain/card-colors.ts
git commit -m "feat(generate): add preset card color entry"
```

---

### Task 2: Extend preset state with active-preset tracking

**Files:**
- Modify: `src/lib/features/create/generate/state/preset.svelte.ts`

- [ ] **Step 1: Import StartEndOptions and start position helpers**

Add after the existing imports (line 15):

```typescript
import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
import { getBlockedPositionsForPreset, StartPositionPreset } from "../shared/domain/start-position-presets";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
```

- [ ] **Step 2: Extend GenerationPreset interface**

Add two new optional fields after `config` (line 24):

```typescript
  startEndOptions?: StartEndOptions | null;
  author?: string;
```

- [ ] **Step 3: Replace createDefaultPreset with createAustensFavorite**

Replace the `createDefaultPreset()` function (lines 77-105) with:

```typescript
function createDefaultPreset(): GenerationPreset {
  const now = Date.now();

  const defaultConfig: UIGenerationConfig = {
    mode: GenerationMode.FREEFORM,
    loopEnabled: true,
    length: 16,
    level: 2,
    turnIntensity: 1,
    gridMode: GridMode.DIAMOND,
    propContinuity: PropContinuity.CONTINUOUS,
    sliceSize: SliceSize.QUARTERED,
    loopType: LOOPType.STRICT_ROTATED,
    constraintPreset: "smooth",
    handPathMode: "mixed",
    motionTypeFilter: null,
    durationTemplateId: null,
    spellTargetLength: null,
  };

  return {
    id: "austens-favorite",
    name: "Austen's Fav",
    icon: "⭐",
    author: "austen",
    config: defaultConfig,
    startEndOptions: {
      blockedStartPositions: getBlockedPositionsForPreset(
        StartPositionPreset.CLASSIC,
        GridMode.DIAMOND
      ),
      startPosition: null,
      endPosition: null,
      mustContainLetters: [],
      mustNotContainLetters: [],
    },
    createdAt: now,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Update DEFAULT_PRESET_ID constant**

Change line 30 from:

```typescript
const DEFAULT_PRESET_ID = "default-diamond-16";
```

To:

```typescript
const DEFAULT_PRESET_ID = "austens-favorite";
```

- [ ] **Step 5: Add activePresetId state and methods to createPresetState**

Inside `createPresetState()`, after the `hasPresets` derived (line 148), add:

```typescript
  // Active preset tracking
  let activePresetId = $state<string | null>(null);
  const activePreset = $derived(
    activePresetId ? presets.find((p) => p.id === activePresetId) ?? null : null
  );

  function activatePreset(id: string): void {
    const preset = presets.find((p) => p.id === id);
    if (preset) {
      activePresetId = id;
    }
  }

  function deactivatePreset(): void {
    activePresetId = null;
  }
```

- [ ] **Step 6: Expose new state in the return object**

Add to the return object (around line 244), in the State section:

```typescript
    get activePresetId() {
      return activePresetId;
    },
    get activePreset() {
      return activePreset;
    },
```

And in the Actions section:

```typescript
    activatePreset,
    deactivatePreset,
```

- [ ] **Step 7: Verify build**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/create/generate/state/preset.svelte.ts
git commit -m "feat(generate): add active preset tracking and Austen's Favorite seed"
```

---

### Task 3: Add preset handler fields to CardHandlers interface

**Files:**
- Modify: `src/lib/features/create/generate/shared/services/contracts/ICardConfigurator.ts`

- [ ] **Step 1: Import GenerationPreset type**

Add after line 12:

```typescript
import type { GenerationPreset } from "../../../state/preset.svelte";
```

- [ ] **Step 2: Add preset fields to CardHandlers**

After line 76 (`handleCompleteCycle?: () => void;`), add:

```typescript
  // Preset card
  activePreset?: GenerationPreset | null;
  handleOpenPresetDrawer?: () => void;
```

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No type errors (new optional fields don't break existing callers).

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/create/generate/shared/services/contracts/ICardConfigurator.ts
git commit -m "feat(generate): add preset fields to CardHandlers interface"
```

---

### Task 4: Update CardConfigurator to include preset card in Row 1

**Files:**
- Modify: `src/lib/features/create/generate/shared/services/implementations/CardConfigurator.ts`

- [ ] **Step 1: Update Row 1 comment and Word span**

Change the Row 1 comment (line 40) from:

```typescript
    // ─── Row 1: Word(4) + Length(2) = 6 ───
```

To:

```typescript
    // ─── Row 1: Word(2) + Preset(2) + Length(2) = 6 ───
```

Change the word-input `gridColumnSpan` (line 51) from `4` to `2`.

- [ ] **Step 2: Add preset card descriptor after word-input**

After the word-input push (line 52), before the length card logic (line 54), add:

```typescript
    // Preset card
    if (handlers.handleOpenPresetDrawer) {
      cardList.push({
        id: "preset",
        props: {
          activePreset: handlers.activePreset ?? null,
          onOpenDrawer: handlers.handleOpenPresetDrawer,
          cardIndex: cardIndex++,
        },
        gridColumnSpan: 2,
      });
    }
```

- [ ] **Step 3: Update the class comment**

Update the grid layout comment at the top of the class (lines 14-22) to reflect:

```
 *   Row 1: Word(2) + Preset(2) + Length(2) = 6
```

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/generate/shared/services/implementations/CardConfigurator.ts
git commit -m "feat(generate): rebalance Row 1 to Word(2)+Preset(2)+Length(2)"
```

---

### Task 5: Add preset drawer state to panel coordination

**Files:**
- Modify: `src/lib/features/create/shared/state/panel-coordination-state.svelte.ts`

- [ ] **Step 1: Add state variables**

Find where other panel state variables are declared (near line 409-415, alongside `isCustomizeOverlayOpen`). Add:

```typescript
  let isPresetDrawerOpen = $state(false);
```

- [ ] **Step 2: Add to closeAllPanels()**

Find `closeAllPanels()` (around line 435-476). Add inside the function body:

```typescript
    isPresetDrawerOpen = false;
```

- [ ] **Step 3: Add getter and open/close methods**

Find where the customize overlay getters are returned (around line 801-818). Add nearby:

```typescript
    get isPresetDrawerOpen() {
      return isPresetDrawerOpen;
    },
    openPresetDrawer() {
      closeAllPanels();
      isPresetDrawerOpen = true;
    },
    closePresetDrawer() {
      isPresetDrawerOpen = false;
    },
```

- [ ] **Step 4: Add to isAnyPanelOpen derived**

Find the `isAnyPanelOpen` derived getter (around line 934-948). Add `isPresetDrawerOpen ||` to the OR chain.

- [ ] **Step 5: Verify build**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/create/shared/state/panel-coordination-state.svelte.ts
git commit -m "feat(generate): add preset drawer state to panel coordination"
```

---

### Task 6: Create PresetCard component

**Files:**
- Create: `src/lib/features/create/generate/components/cards/PresetCard.svelte`

- [ ] **Step 1: Create PresetCard.svelte**

Model after existing cards (e.g., `LevelCard.svelte`). The card shows the active preset name or a "Presets" placeholder.

```svelte
<!--
PresetCard - Shows active preset name or opens drawer to browse presets
-->
<script lang="ts">
  import BaseCard from "./BaseCard.svelte";
  import type { GenerationPreset } from "../../state/preset.svelte";

  let {
    activePreset = null,
    onOpenDrawer,
    color = "",
    shadowColor = "",
    cardIndex = 0,
  } = $props<{
    activePreset?: GenerationPreset | null;
    onOpenDrawer?: () => void;
    color?: string;
    shadowColor?: string;
    cardIndex?: number;
  }>();

  const title = $derived(activePreset ? "Preset" : "Preset");
  const displayValue = $derived(
    activePreset ? `${activePreset.icon ?? ""} ${activePreset.name}`.trim() : "Browse"
  );
</script>

<BaseCard
  {title}
  currentValue={displayValue}
  {color}
  {shadowColor}
  {cardIndex}
  clickable
  onClick={onOpenDrawer}
/>
```

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/generate/components/cards/PresetCard.svelte
git commit -m "feat(generate): create PresetCard component"
```

---

### Task 7: Create PresetDrawer component

**Files:**
- Create: `src/lib/features/create/generate/components/presets/PresetDrawer.svelte`

- [ ] **Step 1: Create PresetDrawer.svelte**

A bottom drawer listing available presets. Uses the existing `Drawer.svelte` component.

```svelte
<!--
PresetDrawer - Bottom drawer for browsing and selecting generation presets
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import type { GenerationPreset } from "../../state/preset.svelte";

  let {
    isOpen = $bindable(false),
    presets = [],
    activePresetId = null,
    onPresetSelect,
    onClose,
  } = $props<{
    isOpen: boolean;
    presets: GenerationPreset[];
    activePresetId?: string | null;
    onPresetSelect?: (preset: GenerationPreset) => void;
    onClose?: () => void;
  }>();

  function handlePresetTap(preset: GenerationPreset) {
    if (preset.id === activePresetId) {
      // Tapping active preset deselects it
      onPresetSelect?.(preset);
    } else {
      onPresetSelect?.(preset);
    }
  }

  // Build a brief summary string for a preset config
  function summarize(preset: GenerationPreset): string {
    const c = preset.config;
    const parts: string[] = [];
    parts.push(`L${c.level}`);
    parts.push(c.gridMode === "diamond" ? "Diamond" : "Box");
    parts.push(`${c.length}ct`);
    if (c.loopEnabled) parts.push("LOOP");
    return parts.join(" · ");
  }
</script>

<Drawer
  bind:isOpen
  placement="bottom"
  respectLayoutMode={true}
  closeOnBackdrop={true}
  onClose={onClose}
>
  <div class="preset-drawer">
    <h3 class="drawer-title">Presets</h3>

    <div class="preset-list">
      {#each presets as preset (preset.id)}
        <button
          class="preset-item"
          class:active={preset.id === activePresetId}
          onclick={() => handlePresetTap(preset)}
        >
          <span class="preset-icon">{preset.icon ?? "🎯"}</span>
          <div class="preset-info">
            <span class="preset-name">{preset.name}</span>
            <span class="preset-summary">{summarize(preset)}</span>
          </div>
          {#if preset.id === activePresetId}
            <span class="active-badge">Active</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</Drawer>

<style>
  .preset-drawer {
    padding: 1rem;
  }

  .drawer-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    margin: 0 0 0.75rem;
    text-align: center;
  }

  .preset-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .preset-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 8px);
    color: var(--theme-text, #fff);
    cursor: pointer;
    transition: border-color 150ms ease;
    min-height: var(--min-touch-target, 44px);
    text-align: left;
    width: 100%;
    font: inherit;
  }

  .preset-item:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .preset-item.active {
    border-color: var(--theme-accent, #3b82f6);
    background: rgba(59, 130, 246, 0.1);
  }

  .preset-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .preset-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
  }

  .preset-name {
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
  }

  .preset-summary {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.7;
  }

  .active-badge {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-accent, #3b82f6);
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/generate/components/presets/PresetDrawer.svelte
git commit -m "feat(generate): create PresetDrawer component"
```

---

### Task 8: Wire everything together in CardBasedSettingsContainer

**Files:**
- Modify: `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte`

This is the main integration task. It connects the PresetCard, PresetDrawer, preset state, and deselection wrapping.

- [ ] **Step 1: Add imports**

After line 42 (`import WordInputCard from "./cards/WordInputCard.svelte";`), add:

```typescript
  import PresetCard from "./cards/PresetCard.svelte";
  import PresetDrawer from "./presets/PresetDrawer.svelte";
  import { createPresetState } from "../state/preset.svelte";
  import type { GenerationPreset } from "../state/preset.svelte";
```

- [ ] **Step 2: Add presetState prop or create it internally**

After the `onMount` block (line 237), add preset state initialization:

```typescript
  // Preset state
  const presetState = createPresetState();
```

- [ ] **Step 3: Add preset activation handler**

After `handleStartEndChange` (line 328-329), add:

```typescript
  // Preset handlers
  function handlePresetSelected(preset: GenerationPreset) {
    if (preset.id === presetState.activePresetId) {
      // Deselect if tapping the already-active preset
      presetState.deactivatePreset();
      return;
    }

    // Activate preset
    presetState.activatePreset(preset.id);

    // Apply preset config to all cards
    updateConfig(preset.config);

    // Apply start/end options if present
    if (preset.startEndOptions && startEndState) {
      startEndState.setOptions(preset.startEndOptions);
    }

    // Clear word input (preset is freeform, word would override length)
    if (wordInputValue && onWordInput) {
      onWordInput("");
    }

    // Close drawer
    panelState.closePresetDrawer();
  }

  function handleOpenPresetDrawer() {
    panelState.openPresetDrawer();
  }
```

- [ ] **Step 4: Add preset deselect wrapper**

Before the `cards` derived (line 332), add:

```typescript
  // When a preset is active, interacting with any card deselects it first
  function withPresetDeselect<T extends (...args: any[]) => any>(handler: T): T {
    return ((...args: any[]) => {
      if (presetState.activePreset) {
        presetState.deactivatePreset();
      }
      return handler(...args);
    }) as T;
  }
```

- [ ] **Step 5: Wire preset handlers into buildCardDescriptors**

In the handlers object inside the `cards` derived (line 339-374), add the two new fields and wrap existing handlers:

Add after `handleCompleteCycle: onCompleteCycle,` (line 373):

```typescript
        // Preset card
        activePreset: presetState.activePreset,
        handleOpenPresetDrawer,
```

And wrap the card interaction handlers with `withPresetDeselect`. The handlers that should be wrapped:
- `handleLevelChange`
- `handleLengthChange`
- `handleTurnIntensityChange`
- `handlePropContinuityChange`
- `handleGridModeChange`
- `handleLOOPTypeChange`
- `handleSliceSizeChange`
- `handleConstraintPresetChange`
- `handleHandPathModeChange`
- `handleMotionTypeFilterChange`
- `handleDurationTemplateSelect`
- `handleLoopToggle`
- `handleWordInput` / `handleWordSubmit`
- `handleStartEndChange`
- `handleSpellLengthChange`

NOT wrapped: `handleGenerateClick`, `handleOpenPresetDrawer`.

Replace each handler reference with its wrapped version. For example:

```typescript
        handleLevelChange: withPresetDeselect(handleLevelChange),
        handleLengthChange: withPresetDeselect(handleLengthChange),
        // ... etc for all handlers listed above
```

- [ ] **Step 6: Add PresetCard to template**

In the `{#each cards as card}` block (line 386-417), after the word-input conditional (line 403), add:

```svelte
      {:else if card.id === "preset"}
        <PresetCard
          {...card.props as any}
          color={cardColors.preset.color}
          shadowColor={cardColors.preset.shadowColor}
        />
```

- [ ] **Step 7: Add PresetDrawer rendering**

After the closing `</div>` of card-settings-container (line 419), add:

```svelte
<PresetDrawer
  bind:isOpen={panelState.isPresetDrawerOpen}
  presets={presetState.presets}
  activePresetId={presetState.activePresetId}
  onPresetSelect={handlePresetSelected}
  onClose={() => panelState.closePresetDrawer()}
/>
```

- [ ] **Step 8: Verify build**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 9: Visual verification**

Open the app at localhost:5173. Navigate to the generate panel. Verify:
1. Row 1 shows three equal-width cards: Word, Preset, Length
2. Preset card shows "Browse" when no preset active
3. Tapping Preset card opens the drawer
4. Drawer shows "Austen's Fav" preset with summary "L2 · Diamond · 16ct · LOOP"
5. Tapping the preset activates it: all cards update, word clears if present, preset card shows the name
6. Tapping any other card deselects the preset
7. Generate button works with preset active

- [ ] **Step 10: Commit**

```bash
git add src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte
git commit -m "feat(generate): wire PresetCard and PresetDrawer into card grid"
```

---

### Task Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Card colors | `card-colors.ts` |
| 2 | Preset state extension | `preset.svelte.ts` |
| 3 | CardHandlers interface | `ICardConfigurator.ts` |
| 4 | CardConfigurator Row 1 rebalance | `CardConfigurator.ts` |
| 5 | Panel coordination for drawer | `panel-coordination-state.svelte.ts` |
| 6 | PresetCard component | New: `PresetCard.svelte` |
| 7 | PresetDrawer component | New: `PresetDrawer.svelte` |
| 8 | Wire everything in container | `CardBasedSettingsContainer.svelte` |
