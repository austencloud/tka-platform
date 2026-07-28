<!--
  BentoPropGrid.svelte - Flat prop selection grid

  Every prop renders as its own button under a picker section header
  (Standard / Big / Novelty / Premium). No variant popover, no count badges —
  the sections come from PROP_PICKER_SECTIONS.

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
    isPremiumCosmeticProp,
  } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import PropTypeButton from "./PropTypeButton.svelte";
  import { isPropUnlocked } from "$lib/shared/gamification/state/prop-collection-state.svelte";
  import { isAdmin } from "$lib/shared/auth/state/auth-state.svelte";
  import PremiumBadge from "$lib/shared/subscription/components/PremiumBadge.svelte";
  import PremiumNudge from "$lib/shared/subscription/components/PremiumNudge.svelte";
  import {
    checkPremiumCosmeticAccess,
    isPremiumCosmeticVisible,
    routePropTileClick,
    PREMIUM_COSMETIC_NUDGE,
  } from "$lib/shared/subscription/domain/premium-prop-access";

  // Poi is deactivated for the public picker but re-enabled for dev/admin so the
  // poi-legal composer filter can be exercised — same gate as the filter itself
  // (isPoiComposerFilterEnabled in apply-poi-legal-filter.ts). Kept inline to
  // avoid a shared→feature import.
  const poiPickerEnabled = $derived(import.meta.env.DEV || isAdmin());

  // Paid cosmetics. While the Scribe tier is shelved these are a dev/admin
  // preview and everyone else never sees the tile — showing a "Go Premium"
  // button now would lead to a stubbed-out module.
  const premiumPickerEnabled = $derived(isPremiumCosmeticVisible());

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

  // Active props grouped into the flat picker sections. Each prop renders as
  // its own button — no variant drill-down.
  const sections = $derived(
    PROP_PICKER_SECTIONS.map((s) => ({
      label: s.label,
      props: s.props.filter((p) => {
        if (p === PropType.POI) return poiPickerEnabled;
        if (isPremiumCosmeticProp(p)) return premiumPickerEnabled;
        return isPropActive(p);
      }),
    })).filter((s) => s.props.length > 0)
  );

  const allProps = $derived(sections.flatMap((s) => s.props));

  // Track which locked prop (if any) is showing its inline earn tip.
  let lockedTipFor = $state<PropType | null>(null);
  // Track which paid prop (if any) is showing its upgrade nudge.
  let premiumNudgeFor = $state<PropType | null>(null);

  /**
   * Central click router for all tiles. The decision itself lives in
   * routePropTileClick so the ordering it encodes — premium before
   * play-earned — is pinned by a test rather than by this component.
   * - select: delegates to the parent onSelect callback.
   * - premium-nudge: toggles the upgrade callout; never calls onSelect.
   * - earn-tip: toggles the inline earn tip; never calls onSelect.
   */
  function handleTileClick(prop: PropType) {
    const premium = isPremiumCosmeticProp(prop);
    const route = routePropTileClick({
      isPremiumCosmetic: premium,
      premiumAllowed: premium && checkPremiumCosmeticAccess().allowed,
      isUnlocked: isPropUnlocked(prop),
    });

    if (route === "select") {
      lockedTipFor = null;
      premiumNudgeFor = null;
      onSelect(prop);
      return;
    }

    if (route === "premium-nudge") {
      lockedTipFor = null;
      premiumNudgeFor = premiumNudgeFor === prop ? null : prop;
      return;
    }

    premiumNudgeFor = null;
    lockedTipFor = lockedTipFor === prop ? null : prop;
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
      Each tile is wrapped in a relative-positioned container so the lock glyph,
      crown and earn-tip can be positioned over / below the button. The click
      is always routed through handleTileClick (via PropTypeButton's onSelect
      prop).

      A paid cosmetic wears a crown and never the play-earned lock or the
      "Earn by creating" tip — those two states mean different things and
      showing both would tell the user to spin their way to something that is
      only for sale.
    -->
    {@const premium = isPremiumCosmeticProp(prop)}
    <div
      class="tile-wrapper"
      class:premium
      class:locked={!premium && !isPropUnlocked(prop)}
    >
      <PropTypeButton
        propType={prop}
        selected={selectedPropType === prop}
        {color}
        onSelect={() => handleTileClick(prop)}
      />
      {#if premium}
        <span class="crown-glyph">
          <PremiumBadge tooltip="Premium prop" />
        </span>
      {:else if !isPropUnlocked(prop)}
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

  {#if premiumNudgeFor}
    <div class="premium-nudge-dock">
      <PremiumNudge
        nudge={PREMIUM_COSMETIC_NUDGE}
        onDismiss={() => (premiumNudgeFor = null)}
      />
    </div>
  {/if}
</div>

<style>
  .prop-grid-root {
    position: relative;
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

  /* Paid labels include the product family name. At the narrowest picker
     container, give those two tiles enough room to keep the full label. */
  @container prop-grid (max-width: 399px) {
    .section-buttons .tile-wrapper.premium :global(.prop-button) {
      width: 95px;
    }
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

  /* ─── Paid cosmetic: crown + upgrade nudge ─── */

  /* Top-left, not bottom-right where the play-earned lock sits: the crown is
     permanent rather than a transient state, and down there it lands on top of
     the prop name and eats the last letters of "Energy Saber". Top-right is the
     selection checkmark's corner; top-left is free in this grid. */
  .crown-glyph {
    position: absolute;
    top: 6px;
    left: 6px;
    line-height: 1;
    pointer-events: none;
    z-index: 10;
  }

  /* The nudge belongs to the picker, not one 79px tile. Docking it inside the
     picker shell keeps it clear of the scroll clip and avoids a layout shift. */
  .premium-nudge-dock {
    position: absolute;
    right: 12px;
    bottom: 12px;
    left: 12px;
    display: flex;
    justify-content: center;
    pointer-events: none;
    z-index: 30;
  }

  .premium-nudge-dock :global(.nudge-callout) {
    width: min(280px, 100%);
    box-sizing: border-box;
    pointer-events: auto;
  }
</style>
