<!--
  BentoPropGrid.svelte - Flat prop selection grid

  Every prop renders as its own button under one of three section headers
  (Standard / Big / Novelty). No variant popover, no count badges — the
  sections come from PROP_PICKER_SECTIONS.

  Variants:
  - "panel" (default): has border/background for standalone use (e.g. Settings tab)
  - "inline": no border/background, used inside drawers that already provide a container
  - flat: drop the section labels and pack every prop into one dense auto-fill
    grid. For tight contexts (the mobile dock) where maximizing visible count
    beats grouping.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    PROP_PICKER_SECTIONS,
    isPropActive,
  } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import PropTypeButton from "./PropTypeButton.svelte";
  import { isPropUnlocked } from "$lib/shared/gamification/state/prop-collection-state.svelte";
  import { isAdmin } from "$lib/shared/auth/state/auth-state.svelte";

  // Poi is deactivated for the public picker but re-enabled for dev/admin so the
  // poi-legal composer filter can be exercised — same gate as the filter itself
  // (isPoiComposerFilterEnabled in apply-poi-legal-filter.ts). Kept inline to
  // avoid a shared→feature import.
  const poiPickerEnabled = $derived(import.meta.env.DEV || isAdmin());

  let {
    selectedPropType,
    color = "blue",
    title = "Select Prop",
    onSelect,
    variant = "panel",
    flat = false,
  } = $props<{
    selectedPropType: PropType;
    color?: "blue" | "red" | (string & {});
    title?: string;
    onSelect: (propType: PropType) => void;
    variant?: "panel" | "inline";
    /**
     * Flat mode: drop the section labels and pack every prop into one dense
     * auto-fill grid. For tight contexts (the mobile dock) where maximizing
     * visible count beats grouping.
     */
    flat?: boolean;
  }>();

  // Active props grouped into the three flat picker sections. Each prop renders
  // as its own button — no variant drill-down.
  const sections = $derived(
    PROP_PICKER_SECTIONS.map((s) => ({
      label: s.label,
      props: s.props.filter((p) =>
        p === PropType.POI ? poiPickerEnabled : isPropActive(p),
      ),
    })).filter((s) => s.props.length > 0),
  );

  const allProps = $derived(sections.flatMap((s) => s.props));

  // Track which locked prop (if any) is showing its inline earn tip.
  let lockedTipFor = $state<PropType | null>(null);

  /**
   * Central click router for all tiles.
   * - Unlocked: delegates to the parent onSelect callback (existing behavior).
   * - Locked: toggles the inline earn tip; never calls onSelect.
   */
  function handleTileClick(prop: PropType) {
    if (isPropUnlocked(prop)) {
      lockedTipFor = null;
      onSelect(prop);
    } else {
      lockedTipFor = lockedTipFor === prop ? null : prop;
    }
  }
</script>

<div
  class="prop-grid-root"
  class:panel={variant === "panel"}
  class:inline={variant === "inline"}
>
  {#if variant === "panel"}
    <header class="grid-header">
      <h4 class="grid-title">{title}</h4>
    </header>
  {/if}

  {#snippet tile(prop: PropType)}
    <!--
      Each tile is wrapped in a relative-positioned container so the lock glyph
      and earn-tip can be absolutely positioned over / below the button.
      The click is always routed through handleTileClick (via PropTypeButton's
      onSelect prop), which gates on isPropUnlocked.
    -->
    <div class="tile-wrapper" class:locked={!isPropUnlocked(prop)}>
      <PropTypeButton
        propType={prop}
        selected={selectedPropType === prop}
        {color}
        onSelect={() => handleTileClick(prop)}
      />
      {#if !isPropUnlocked(prop)}
        <i class="fas fa-lock lock-glyph" aria-hidden="true"></i>
        {#if lockedTipFor === prop}
          <span class="earn-tip">Earn by creating</span>
        {/if}
      {/if}
    </div>
  {/snippet}

  <div class="grid-scroll themed-scrollbar">
    {#if flat}
      <div class="flat-grid">
        {#each allProps as prop (prop)}
          {@render tile(prop)}
        {/each}
      </div>
    {:else}
      <div class="grid-content">
        {#each sections as section, i}
          <div class="section-label" class:first={i === 0}>{section.label}</div>
          <div class="section-buttons">
            {#each section.props as prop (prop)}
              {@render tile(prop)}
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .prop-grid-root {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: 100%;
    height: 100%;
    min-height: 0;
    flex: 1;
    container-type: inline-size;
    container-name: prop-grid;
  }

  .prop-grid-root.panel {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }

  .prop-grid-root.inline {
    background: transparent;
    border: none;
    border-radius: 0;
  }

  .grid-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 0;
    flex-shrink: 0;
  }

  .grid-title {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .grid-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px;
    scrollbar-width: thin;
  }

  .grid-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* Flat mode: one dense grid, no sections — maximize visible prop count. */
  .flat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 6px;
    padding: 0 2px;
  }
  .flat-grid :global(.prop-button) {
    width: 100%;
  }

  .section-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    opacity: 0.5;
    padding: 8px 4px 2px;
    text-align: center;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .section-label.first {
    border-top: none;
    padding-top: 0;
  }

  .section-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    padding: 0 4px;
  }

  .section-buttons :global(.prop-button) {
    width: 79px;
    flex-shrink: 0;
  }

  /* Container queries for larger containers */
  @container prop-grid (min-width: 400px) {
    .section-buttons :global(.prop-button) {
      width: 90px;
    }
  }

  @container prop-grid (min-width: 550px) {
    .section-buttons :global(.prop-button) {
      width: 100px;
    }
  }

  @container prop-grid (min-width: 700px) {
    .section-buttons :global(.prop-button) {
      width: 95px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .grid-scroll {
      scroll-behavior: auto;
    }
  }

  /* ─── Tile wrapper: lock / earn-tip overlay system ─── */

  /*
    The wrapper is a transparent pass-through for unlocked tiles (width/height
    match the inner button). For locked tiles it becomes a positioned container
    that carries the lock glyph + earn-tip.
  */
  .tile-wrapper {
    position: relative;
    /* Match sizing of PropTypeButton in each grid context — the button already
       sizes itself; the wrapper just needs to be as wide/tall as its child. */
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .tile-wrapper.locked :global(.prop-button) {
    opacity: 0.4;
  }

  .tile-wrapper.locked:hover :global(.prop-button) {
    opacity: 0.55;
  }

  .lock-glyph {
    position: absolute;
    bottom: 4px;
    right: 4px;
    font-size: 0.7rem;
    opacity: 0.8;
    pointer-events: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .earn-tip {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%) translateY(calc(100% + 4px));
    font-size: 0.65rem;
    opacity: 0.85;
    white-space: nowrap;
    background: var(--theme-card-bg, rgba(18, 18, 28, 0.95));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    padding: 2px 6px;
    pointer-events: none;
    z-index: 20;
  }
</style>
