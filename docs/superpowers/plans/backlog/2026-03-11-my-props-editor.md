# My Props Editor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken "Pick your props" button with a dedicated two-phase drawer for multi-selecting prop families and choosing a favorite.

**Architecture:** A bottom `Drawer` hosts two phases that morph in place. Phase 1 is a curated grid of 16 prop families with multi-select. Phase 2 (shown when 2+ selected) lets the user crown one as favorite. State is owned by `AccountPopover` and passed as a prop to both `MyPropsCard` (display) and `MyPropsDrawer` (editing). Each toggle/favorite persists immediately via `PropPreferencePersister`.

**Tech Stack:** Svelte 5 runes, existing `Drawer.svelte` primitive, `PropTypeDisplayRegistry` for images/labels, `getBasePropType()` for variant normalization, `createPropPreferenceState()` for state, CSS custom properties for theming.

**Spec:** `docs/superpowers/specs/2026-03-11-my-props-editor-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/shared/navigation/components/account/PropFamilyCard.svelte` | Individual toggleable prop card (`<button>` with `aria-pressed`) |
| Create | `src/lib/shared/navigation/components/account/PropFamilyGrid.svelte` | Curated 16-family grid, multi-select, emits toggle events |
| Create | `src/lib/shared/navigation/components/account/SelectionFooterBar.svelte` | Sticky footer: selected prop chips, count, CTA button |
| Create | `src/lib/shared/navigation/components/account/FavoritePicker.svelte` | Phase 2: larger cards for crowning a favorite |
| Create | `src/lib/shared/navigation/components/account/MyPropsDrawer.svelte` | Drawer shell, phase state machine, morph transitions |
| Modify | `src/lib/shared/navigation/components/account/MyPropsCard.svelte` | Accept `propState` as prop instead of creating its own |
| Modify | `src/lib/shared/navigation/components/account/AccountPopover.svelte` | Own `PropPreferenceState`, remove `PropSelectionSheet`, wire `MyPropsDrawer` |

---

## Chunk 1: Foundation Components

### Task 1: PropFamilyCard Component

**Files:**
- Create: `src/lib/shared/navigation/components/account/PropFamilyCard.svelte`

This is a pure presentational component — a single toggleable prop card.

- [ ] **Step 1: Create PropFamilyCard.svelte**

```svelte
<!-- PropFamilyCard.svelte — Individual toggleable prop family card -->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

  interface Props {
    propType: PropType;
    label: string;
    selected: boolean;
    isFavorite: boolean;
    disabled?: boolean;
    ontoggle: (propType: PropType) => void;
  }

  let { propType, label, selected, isFavorite, disabled = false, ontoggle }: Props = $props();

  const displayInfo = $derived(getPropTypeDisplayInfo(propType));

  function handleClick() {
    if (!disabled) {
      ontoggle(propType);
    }
  }
</script>

<button
  class="prop-family-card"
  class:selected
  class:disabled
  aria-pressed={selected}
  aria-label="{label}{selected ? ' (selected)' : ''}{isFavorite ? ' (favorite)' : ''}"
  onclick={handleClick}
  {disabled}
>
  {#if isFavorite}
    <span class="favorite-badge" aria-label="Favorite">
      <i class="fas fa-star" aria-hidden="true"></i>
    </span>
  {/if}

  {#if selected}
    <span class="check-badge" aria-hidden="true">
      <i class="fas fa-check" aria-hidden="true"></i>
    </span>
  {/if}

  <img
    src={displayInfo.image}
    alt={label}
    class="prop-image"
    loading="lazy"
  />
  <span class="prop-label">{label}</span>
</button>

<style>
  .prop-family-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    position: relative;
    padding: 10px 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
    min-height: 44px;
    min-width: 44px;
    aspect-ratio: 1 / 1;
  }

  .prop-family-card:hover:not(.disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .prop-family-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  .prop-family-card.selected {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
    transform: scale(1.02);
  }

  .prop-family-card.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .check-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
  }

  .favorite-badge {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    color: var(--semantic-warning, #f59e0b);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
  }

  .prop-image {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }

  .prop-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-align: center;
    line-height: 1.2;
  }

  .selected .prop-label {
    color: var(--theme-text, white);
  }

  @media (prefers-reduced-motion: reduce) {
    .prop-family-card {
      transition: none;
      transform: none !important;
    }
  }
</style>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error 2>&1 | grep -i "PropFamilyCard" || echo "No errors found for PropFamilyCard"`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/navigation/components/account/PropFamilyCard.svelte
git commit -m "feat: add PropFamilyCard component for prop family selection"
```

---

### Task 2: PropFamilyGrid Component

**Files:**
- Create: `src/lib/shared/navigation/components/account/PropFamilyGrid.svelte`

The curated grid of 16 prop families. Contains the `PROP_FAMILIES` constant. Emits toggle events upward.

- [ ] **Step 1: Create PropFamilyGrid.svelte**

```svelte
<!-- PropFamilyGrid.svelte — Curated grid of base prop families with multi-select -->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import PropFamilyCard from "./PropFamilyCard.svelte";

  interface PropFamily {
    base: PropType;
    label: string;
  }

  /**
   * The 16 curated prop families users can select from.
   * Quiad excluded (internal test prop). Poi excluded (restricted subset, not static).
   */
  export const PROP_FAMILIES: PropFamily[] = [
    // Staves & Clubs
    { base: PropType.STAFF, label: "Staff" },
    { base: PropType.CLUB, label: "Club" },
    { base: PropType.FAN, label: "Fan" },
    // Curved Props
    { base: PropType.BUUGENG, label: "Buugeng" },
    { base: PropType.TRIGENG, label: "Trigeng" },
    { base: PropType.MINIHOOP, label: "Hoop" },
    { base: PropType.TRIAD, label: "Triad" },
    { base: PropType.TRIQUETRA, label: "Triquetra" },
    // Novelty
    { base: PropType.CHICKEN, label: "Chicken" },
    { base: PropType.GUITAR, label: "Guitar" },
    { base: PropType.DOUBLESTAR, label: "Double Star" },
    { base: PropType.EIGHTRINGS, label: "Eight Rings" },
    { base: PropType.CONTACTBALL, label: "Contact Ball" },
    { base: PropType.TORCH, label: "Torch" },
    // Other
    { base: PropType.HAND, label: "Hand" },
    { base: PropType.SWORD, label: "Sword" },
  ];

  interface Props {
    selectedProps: PropType[];
    favoriteProp: PropType | null;
    disabled?: boolean;
    ontoggle: (propType: PropType) => void;
  }

  let { selectedProps, favoriteProp, disabled = false, ontoggle }: Props = $props();

  const selectedSet = $derived(new Set(selectedProps));
</script>

<div class="prop-family-grid" role="group" aria-label="Prop families">
  {#each PROP_FAMILIES as family (family.base)}
    <PropFamilyCard
      propType={family.base}
      label={family.label}
      selected={selectedSet.has(family.base)}
      isFavorite={favoriteProp === family.base}
      {disabled}
      {ontoggle}
    />
  {/each}
</div>

<style>
  .prop-family-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 0 16px;
  }

  @media (max-width: 360px) {
    .prop-family-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error 2>&1 | grep -i "PropFamilyGrid\|PropFamilyCard" || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/navigation/components/account/PropFamilyGrid.svelte
git commit -m "feat: add PropFamilyGrid with curated 16-family grid"
```

---

### Task 3: SelectionFooterBar Component

**Files:**
- Create: `src/lib/shared/navigation/components/account/SelectionFooterBar.svelte`

Sticky footer showing selected prop chips, count, and CTA button.

- [ ] **Step 1: Create SelectionFooterBar.svelte**

```svelte
<!--
  SelectionFooterBar.svelte — Sticky footer in My Props drawer.
  Shows miniature prop chips for each selection, count label, and CTA button.
  Hidden when 0 props selected.
-->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

  interface Props {
    selectedProps: PropType[];
    saving: boolean;
    onadvance: () => void;
    ondone: () => void;
  }

  let { selectedProps, saving, onadvance, ondone }: Props = $props();

  const count = $derived(selectedProps.length);
  const showSetFavorite = $derived(count >= 2);
  const ctaLabel = $derived(showSetFavorite ? "Set favorite" : "Done");
  const ctaAriaLabel = $derived(
    showSetFavorite
      ? `Set favorite from ${count} selected props`
      : "Save and close"
  );

  function handleCta() {
    if (showSetFavorite) {
      onadvance();
    } else {
      ondone();
    }
  }
</script>

{#if count > 0}
  <div class="selection-footer">
    <div class="selected-chips">
      {#each selectedProps as prop (prop)}
        <img
          src={getPropTypeDisplayInfo(prop).image}
          alt={getPropTypeDisplayInfo(prop).label}
          class="chip-image"
        />
      {/each}
      <span class="chip-count">{count} {count === 1 ? "prop" : "props"}</span>
    </div>

    <button
      class="cta-button"
      onclick={handleCta}
      disabled={saving}
      aria-label={ctaAriaLabel}
    >
      {#if saving}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      {:else}
        {ctaLabel}
        {#if showSetFavorite}
          <i class="fas fa-arrow-right cta-arrow" aria-hidden="true"></i>
        {/if}
      {/if}
    </button>
  </div>
{/if}

<style>
  .selection-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .selected-chips {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow-x: auto;
    flex: 1;
    min-width: 0;
    scrollbar-width: none;
  }

  .selected-chips::-webkit-scrollbar {
    display: none;
  }

  .chip-image {
    width: 24px;
    height: 24px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .chip-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
    flex-shrink: 0;
    margin-left: 4px;
  }

  .cta-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--theme-accent, #6366f1);
    color: white;
    border: none;
    border-radius: 999px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity var(--duration-fast, 150ms) ease;
    min-height: 36px;
    min-width: 44px;
  }

  .cta-button:hover:not(:disabled) {
    opacity: 0.9;
  }

  .cta-button:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .cta-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .cta-arrow {
    font-size: 10px;
  }

  @media (prefers-reduced-motion: reduce) {
    .cta-button {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error 2>&1 | grep -i "SelectionFooterBar" || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/navigation/components/account/SelectionFooterBar.svelte
git commit -m "feat: add SelectionFooterBar with prop chips and CTA"
```

---

### Task 4: FavoritePicker Component

**Files:**
- Create: `src/lib/shared/navigation/components/account/FavoritePicker.svelte`

Phase 2 UI: larger cards for crowning a favorite prop.

- [ ] **Step 1: Create FavoritePicker.svelte**

```svelte
<!--
  FavoritePicker.svelte — Phase 2 of My Props editor.
  Shows selected props as larger cards. Tap one to crown it as favorite.
-->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  interface Props {
    selectedProps: PropType[];
    onfavorite: (propType: PropType) => void;
  }

  let { selectedProps, onfavorite }: Props = $props();

  let chosenProp = $state<PropType | null>(null);

  const useWideLayout = $derived(selectedProps.length > 4);

  function handlePick(prop: PropType) {
    chosenProp = prop;

    // Haptic feedback
    try {
      const haptic = container.items.hapticFeedback as IHapticFeedback;
      haptic?.trigger("success");
    } catch {
      // Not available
    }

    // Brief pause so user sees the selection, then fire callback
    setTimeout(() => {
      onfavorite(prop);
    }, 400);
  }
</script>

<div
  class="favorite-picker"
  class:wide-layout={useWideLayout}
  role="group"
  aria-label="Choose your favorite prop"
>
  {#each selectedProps as prop (prop)}
    {@const info = getPropTypeDisplayInfo(prop)}
    <button
      class="favorite-card"
      class:chosen={chosenProp === prop}
      onclick={() => handlePick(prop)}
      disabled={chosenProp !== null}
      aria-label="Set {info.label} as favorite"
    >
      {#if chosenProp === prop}
        <span class="crown-badge" aria-hidden="true">
          <i class="fas fa-star" aria-hidden="true"></i>
        </span>
      {/if}

      <img
        src={info.image}
        alt={info.label}
        class="favorite-image"
      />
      <span class="favorite-label">{info.label}</span>
    </button>
  {/each}
</div>

<style>
  .favorite-picker {
    display: flex;
    justify-content: center;
    gap: 12px;
    padding: 24px 16px;
    flex-wrap: wrap;
  }

  .favorite-picker.wide-layout {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    justify-items: center;
  }

  .favorite-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    position: relative;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
    min-width: 90px;
    min-height: 44px;
  }

  .favorite-card:hover:not(:disabled) {
    border-color: var(--theme-accent, #6366f1);
    transform: scale(1.03);
  }

  .favorite-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  .favorite-card.chosen {
    border-color: var(--semantic-warning, #f59e0b);
    background: color-mix(in srgb, var(--semantic-warning) 10%, transparent);
  }

  .favorite-card:disabled:not(.chosen) {
    opacity: 0.5;
    cursor: default;
  }

  .crown-badge {
    position: absolute;
    top: -6px;
    left: -6px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: white;
    color: var(--semantic-warning, #f59e0b);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    animation: crown-pop var(--duration-normal, 200ms) ease-out;
  }

  @keyframes crown-pop {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .favorite-image {
    width: 80px;
    height: 80px;
    object-fit: contain;
  }

  .favorite-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    color: var(--theme-text, white);
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .favorite-card {
      transition: none;
      transform: none !important;
    }

    .crown-badge {
      animation: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error 2>&1 | grep -i "FavoritePicker" || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/navigation/components/account/FavoritePicker.svelte
git commit -m "feat: add FavoritePicker for Phase 2 favorite selection"
```

---

## Chunk 2: Drawer Shell & Wiring

### Task 5: MyPropsDrawer Component

**Files:**
- Create: `src/lib/shared/navigation/components/account/MyPropsDrawer.svelte`

The drawer shell that hosts Phase 1 (grid + footer) and Phase 2 (favorite picker). Manages the phase state machine and morph transitions.

- [ ] **Step 1: Create MyPropsDrawer.svelte**

```svelte
<!--
  MyPropsDrawer.svelte — Two-phase drawer for selecting props and picking a favorite.

  Phase 1: "What do you spin?" — curated prop family grid with multi-select
  Phase 2: "Your go-to?" — pick one favorite from selections (shown when 2+ selected)

  Content morphs in place. No navigation, no step indicators.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import PropFamilyGrid from "./PropFamilyGrid.svelte";
  import SelectionFooterBar from "./SelectionFooterBar.svelte";
  import FavoritePicker from "./FavoritePicker.svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { PropPreferenceState } from "$lib/shared/community/state/prop-preference-state.svelte";
  import { getBasePropType } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import { PROP_FAMILIES } from "./PropFamilyGrid.svelte";

  interface Props {
    isOpen: boolean;
    propState: PropPreferenceState;
    onclose: () => void;
  }

  let { isOpen = $bindable(), propState, onclose }: Props = $props();

  type Phase = "select" | "favorite";
  let phase = $state<Phase>("select");

  // Normalize stored propsISpinWith to base types for grid comparison
  const normalizedSelections = $derived(
    propState.propsISpinWith.map(getBasePropType)
  );

  // Filter to only props that exist in PROP_FAMILIES
  const familyBases = new Set(PROP_FAMILIES.map((f) => f.base));
  const gridSelections = $derived(
    normalizedSelections.filter((p) => familyBases.has(p))
  );

  const headerText = $derived(
    phase === "select" ? "What do you spin?" : "Your go-to?"
  );

  function triggerHaptic(type: "selection" | "success" = "selection") {
    try {
      const haptic = container.items.hapticFeedback as IHapticFeedback;
      haptic?.trigger(type);
    } catch {
      // Not available
    }
  }

  function handleToggle(propType: PropType) {
    triggerHaptic("selection");
    propState.toggleProp(propType);
  }

  function handleAdvanceToFavorite() {
    triggerHaptic("selection");
    phase = "favorite";
  }

  function handleDone() {
    // 1 prop selected — auto-favorite it
    if (gridSelections.length === 1) {
      propState.setFavorite(gridSelections[0]);
    }
    closeDrawer();
  }

  function handleFavoriteSelected(propType: PropType) {
    propState.setFavorite(propType);
    // FavoritePicker has a 400ms delay built in, then calls this
    closeDrawer();
  }

  function handleBack() {
    phase = "select";
  }

  function closeDrawer() {
    phase = "select";
    onclose();
  }

  // Reset phase when drawer opens
  $effect(() => {
    if (isOpen) {
      phase = "select";
    }
  });
</script>

<Drawer
  bind:isOpen
  placement="bottom"
  ariaLabel="My props editor"
  class="my-props-drawer"
  onclose={closeDrawer}
>
  <div class="drawer-content">
    <!-- Header -->
    <div class="drawer-header">
      {#if phase === "favorite"}
        <button
          class="back-button"
          onclick={handleBack}
          aria-label="Back to prop selection"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          Back
        </button>
      {/if}
      <h2 class="drawer-title" aria-live="polite">{headerText}</h2>
    </div>

    <!-- Phase content -->
    <div class="phase-container">
      {#if phase === "select"}
        <PropFamilyGrid
          selectedProps={gridSelections}
          favoriteProp={propState.favoriteProp ? getBasePropType(propState.favoriteProp) : null}
          disabled={propState.loading}
          ontoggle={handleToggle}
        />
      {:else}
        <FavoritePicker
          selectedProps={gridSelections}
          onfavorite={handleFavoriteSelected}
        />
      {/if}
    </div>

    <!-- Footer (Phase 1 only) -->
    {#if phase === "select"}
      <SelectionFooterBar
        selectedProps={gridSelections}
        saving={propState.saving}
        onadvance={handleAdvanceToFavorite}
        ondone={handleDone}
      />
    {/if}
  </div>
</Drawer>

<style>
  :global(.my-props-drawer) {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    --sheet-filter: none;
  }

  .drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 85vh;
    overflow: hidden;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 16px 12px;
    flex-shrink: 0;
  }

  .drawer-title {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
    margin: 0;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: none;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    border-radius: 6px;
    transition: color var(--duration-fast, 150ms) ease;
    min-height: 32px;
  }

  .back-button:hover {
    color: var(--theme-text, white);
  }

  .back-button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  .back-button i {
    font-size: 10px;
  }

  .phase-container {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
    min-height: 0;
    padding-bottom: 8px;
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error 2>&1 | grep -i "MyPropsDrawer\|PropFamilyGrid\|SelectionFooterBar\|FavoritePicker" || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/navigation/components/account/MyPropsDrawer.svelte
git commit -m "feat: add MyPropsDrawer with two-phase selection and morph"
```

---

### Task 6: Update MyPropsCard to Accept propState

**Files:**
- Modify: `src/lib/shared/navigation/components/account/MyPropsCard.svelte`

Change from creating its own `PropPreferenceState` to accepting it as a prop. This avoids duplicate state instances and concurrent Firestore writes.

- [ ] **Step 1: Update MyPropsCard**

Replace the entire `<script>` block. The component should:
1. Accept `propState` as a prop (type `PropPreferenceState | null`)
2. Remove all DI/state creation code
3. Derive display values from the prop

New script block:

```svelte
<script lang="ts">
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import type { PropPreferenceState } from "$lib/shared/community/state/prop-preference-state.svelte";

  interface Props {
    propState: PropPreferenceState | null;
    onOpenPropEditor: () => void;
  }

  let { propState, onOpenPropEditor }: Props = $props();

  const favoriteProp = $derived(propState?.favoriteProp ?? null);
  const propsCount = $derived(propState?.propsISpinWith.length ?? 0);
  const loading = $derived(propState?.loading ?? true);
</script>
```

Remove these imports that are no longer needed:
- `container` from `$lib/shared/di`
- `authState` from `$lib/shared/auth/state/authState.svelte`
- `createPropPreferenceState` from the state factory
- `IPropPreferencePersister` type

The template and styles remain unchanged.

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error 2>&1 | grep -i "MyPropsCard" || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/navigation/components/account/MyPropsCard.svelte
git commit -m "refactor: MyPropsCard accepts propState as prop instead of creating own"
```

---

### Task 7: Wire AccountPopover to MyPropsDrawer

**Files:**
- Modify: `src/lib/shared/navigation/components/account/AccountPopover.svelte`

Changes:
1. Remove `PropSelectionSheet` import and usage
2. Add `MyPropsDrawer` import and render it
3. Keep `propState` ownership (already present from interim fix)
4. Pass `propState` to both `MyPropsCard` and `MyPropsDrawer`
5. `handleOpenPropEditor` opens drawer instead of sheet
6. Remove `handlePropSelect` (no longer needed)

- [ ] **Step 1: Update imports**

Replace the `PropSelectionSheet` import with `MyPropsDrawer`:

```typescript
// REMOVE:
import PropSelectionSheet from "../../../settings/components/tabs/prop-type/PropSelectionSheet.svelte";
// ADD:
import MyPropsDrawer from "./MyPropsDrawer.svelte";
```

Also remove unused `PropType` import (was only needed for PropSelectionSheet's selectedPropType).

- [ ] **Step 2: Simplify handler**

Remove `handlePropSelect` function entirely (lines 145-147 in current file). The `handleOpenPropEditor` function remains as-is — it closes the popover and sets `showPropSheet = true`.

Rename `showPropSheet` to `showPropsDrawer` for clarity:

```typescript
let showPropsDrawer = $state(false);

function handleOpenPropEditor() {
  triggerHaptic();
  onClose();
  requestAnimationFrame(() => {
    showPropsDrawer = true;
  });
}
```

- [ ] **Step 3: Update MyPropsCard usage**

Pass `propState` to `MyPropsCard`:

```svelte
<MyPropsCard {propState} onOpenPropEditor={handleOpenPropEditor} />
```

Note: `propState` is a `$derived` that may be `null` (when not authenticated), and `MyPropsCard` accepts `PropPreferenceState | null`.

- [ ] **Step 4: Replace PropSelectionSheet with MyPropsDrawer**

Replace the bottom `PropSelectionSheet` block with:

```svelte
{#if propState}
  <MyPropsDrawer
    bind:isOpen={showPropsDrawer}
    {propState}
    onclose={() => { showPropsDrawer = false; }}
  />
{/if}
```

- [ ] **Step 5: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error 2>&1 | grep -i "AccountPopover\|MyPropsCard\|MyPropsDrawer" || echo "No errors"`

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/navigation/components/account/AccountPopover.svelte
git commit -m "feat: wire AccountPopover to MyPropsDrawer, remove PropSelectionSheet"
```

---

## Chunk 3: Verification & Polish

### Task 8: Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

Run: `npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run TypeScript check**

Run: `npm run check`

Expected: No new errors introduced by these changes.

- [ ] **Step 3: Run existing tests**

Run: `npm test`

Expected: All existing tests pass (including the prop-system tests from earlier).

---

### Task 9: Manual Testing Guidance

No automated tests needed for these UI components (per earned-tests philosophy — you'll see if they're broken). The implementer should verify via the running app:

- [ ] **Step 1: Verify drawer opens**

Click the "Pick your props" card in AccountPopover. The My Props drawer should open from the bottom.

- [ ] **Step 2: Verify Phase 1**

- Grid shows 16 prop families in 4 columns
- Tapping a card toggles selection (checkmark badge, accent border)
- Footer bar appears when 1+ props selected
- Footer shows miniature prop images and count
- CTA says "Done" for 1 selection, "Set favorite" for 2+

- [ ] **Step 3: Verify Phase 2**

- Tap "Set favorite" with 2+ selections
- Header morphs to "Your go-to?"
- Selected props shown as larger cards
- Tapping one shows gold star badge
- Drawer auto-closes after 400ms

- [ ] **Step 4: Verify persistence**

- Reopen drawer — previously selected props are pre-checked
- Favorite has gold star badge in grid
- Changes persist across page refreshes

- [ ] **Step 5: Verify edge cases**

- Zero selections: footer hidden, drawer dismissible
- Deselect current favorite: star badge disappears
- "Back" button in Phase 2 returns to Phase 1
