<!--
  BentoPropGrid.svelte - Family-first prop selection grid

  Base props render under the picker section headers. Families with several
  builds open a style chooser, so Club owns Club / Classic Club / Torch rather
  than scattering those choices across unrelated sections.

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
    getAllVariations,
    getBasePropType,
    getFamilyTileDisplayProp,
    getPropTypeDisplayInfo,
    isPropActive,
    isPremiumCosmeticProp,
  } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { Popover } from "bits-ui";
  import { flyFade, growFade } from "$lib/shared/transitions/motion";
  import PropTypeButton from "./PropTypeButton.svelte";
  import PropChiralityRow from "./PropChiralityRow.svelte";
  import FanStyleOptions from "./FanStyleOptions.svelte";
  import { isFanPropType } from "$lib/shared/pictograph/prop/domain/fan-appearance";
  import type { PropChiralitySeam } from "./prop-chirality-seam";
  import { isBuugengFamilyProp } from "$lib/shared/pictograph/prop/domain/enums/prop-classification";
  import { isPropUnlocked } from "$lib/shared/gamification/state/prop-collection-state.svelte";
  import PremiumBadge from "$lib/shared/subscription/components/PremiumBadge.svelte";
  import PremiumNudge from "$lib/shared/subscription/components/PremiumNudge.svelte";
  import {
    checkPremiumCosmeticAccess,
    isPremiumCosmeticVisible,
    routePropTileClick,
    PREMIUM_COSMETIC_NUDGE,
  } from "$lib/shared/subscription/domain/premium-prop-access";

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
    scrollMode = "internal",
    includeBareHands = false,
    chirality,
    allowedProps,
    accessMode = "standard",
    fluidSections = false,
  } = $props<{
    selectedPropType: PropType | null;
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
    /**
     * Drawers own a bounded internal scroller. Embedded inspectors already
     * scroll the whole tab, so their picker contributes its natural height and
     * lets that host remain the only vertical scroll owner.
     */
    scrollMode?: "internal" | "host";
    /** Adds the scene-only no-prop choice using the same canonical card. */
    includeBareHands?: boolean;
    /**
     * Buugeng chirality seam. Absent means the picker renders no chirality
     * row, so hosts that should never expose it (the deck releaser renders
     * canonical print cards) are unaffected by omission rather than by an
     * opt-out. `hands` names the hands this picker governs: one for a
     * per-hand picker, both for a picker that sets the pair — chirality is
     * never shared between hands the way prop type is.
     */
    chirality?: PropChiralitySeam;
    /** Optional host-owned capability filter. The canonical registry still
     *  owns labels, ordering, active-state, and access rules. */
    allowedProps?: readonly PropType[];
    /** Educational instruments may select ordinary play-earned props directly
     *  and include Poi. Premium cosmetics retain their subscription gate. */
    accessMode?: "standard" | "educational";
    /** Let a roomy host use all available width for each family row. */
    fluidSections?: boolean;
  }>();

  const allowedPropSet = $derived(
    allowedProps ? new Set<PropType>(allowedProps) : null
  );

  const pickerSections = $derived([
    ...PROP_PICKER_SECTIONS,
    ...(includeBareHands ? [{ label: "Scene", props: [PropType.HAND] }] : []),
  ]);

  function canShowProp(prop: PropType): boolean {
    if (prop === PropType.HAND && includeBareHands) return true;
    if (allowedPropSet && !allowedPropSet.has(prop)) return false;
    if (isPremiumCosmeticProp(prop)) return premiumPickerEnabled;
    return isPropActive(prop);
  }

  const selectableProps = $derived(
    pickerSections
      .flatMap((section) => section.props)
      .filter((prop) => canShowProp(prop))
  );
  const selectablePropSet = $derived(new Set(selectableProps));

  // Preserve the curated base-prop ordering while letting each base own its
  // variants. A family stays in the section where its base was authored, so a
  // Big Chicken entry cannot move the Chicken family out of Novelty. The
  // chooser then gets only variants that the curated picker actually allows,
  // so internal-only Staff builds stay internal.
  const sections = $derived.by(() => {
    const seen = new Set<PropType>();
    return pickerSections
      .map((section) => {
        const bases: PropType[] = [];
        for (const prop of section.props) {
          if (!canShowProp(prop)) continue;
          const base = isPremiumCosmeticProp(prop)
            ? prop
            : getBasePropType(prop);
          if (prop !== base) continue;
          if (seen.has(base)) continue;
          seen.add(base);
          bases.push(base);
        }
        return { label: section.label, bases };
      })
      .filter((section) => section.bases.length > 0);
  });

  const allBases = $derived(sections.flatMap((section) => section.bases));
  const selectedBase = $derived(
    selectedPropType === null ? null : getBasePropType(selectedPropType)
  );

  function familyChoices(base: PropType): PropType[] {
    return getAllVariations(base).filter((prop) => selectablePropSet.has(prop));
  }

  function familyCount(base: PropType): number | undefined {
    const count = familyChoices(base).length;
    return count > 1 ? count : undefined;
  }

  function familyDisplayProp(base: PropType): PropType {
    if (selectedPropType === null) return base;
    return getFamilyTileDisplayProp(base, selectedPropType);
  }

  let openFamily = $state<PropType | null>(null);

  function toggleFamily(base: PropType): void {
    openFamily = openFamily === base ? null : base;
  }

  /**
   * Choosing a fan build inside the Fan chooser should show that build on the
   * canvas right away, so a non-fan selection becomes the family's current
   * size (Fan unless Big Fan was the last fan used). An existing fan keeps
   * its size and the chooser stays open for the build details.
   */
  function handleFanStylePick(base: PropType): void {
    if (selectedPropType !== null && isFanPropType(selectedPropType)) return;
    const target = familyChoices(base)[0] ?? base;
    onSelect(target);
  }

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
    if (prop === PropType.HAND && includeBareHands) {
      lockedTipFor = null;
      premiumNudgeFor = null;
      openFamily = null;
      onSelect(prop);
      return;
    }

    const premium = isPremiumCosmeticProp(prop);
    if (accessMode === "educational" && !premium) {
      lockedTipFor = null;
      premiumNudgeFor = null;
      onSelect(prop);
      return;
    }
    const route = routePropTileClick({
      isPremiumCosmetic: premium,
      premiumAllowed: premium && checkPremiumCosmeticAccess().allowed,
      isUnlocked: isPropUnlocked(prop),
    });

    if (route === "select") {
      lockedTipFor = null;
      premiumNudgeFor = null;
      openFamily = null;
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
  class:flat
  class:host-scroll={scrollMode === "host"}
  class:fluid-sections={fluidSections}
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
      class:locked={prop !== PropType.HAND && !premium && !isPropUnlocked(prop)}
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
      {:else if prop !== PropType.HAND && !isPropUnlocked(prop)}
        <i class="fas fa-lock lock-glyph" aria-hidden="true"></i>
        {#if lockedTipFor === prop}
          <span class="earn-tip">Earn by creating</span>
        {/if}
      {/if}
    </div>
  {/snippet}

  {#snippet familyTile(base: PropType)}
    {@const choices = familyChoices(base)}
    {#if choices.length <= 1}
      {@render tile(choices[0] ?? base)}
    {:else if flat}
      <PropTypeButton
        propType={familyDisplayProp(base)}
        selected={selectedBase === base}
        badge={familyCount(base)}
        actionLabel={`Choose ${getPropTypeDisplayInfo(base).label} style`}
        buttonProps={{ "aria-expanded": openFamily === base }}
        onSelect={() => toggleFamily(base)}
        {color}
      />
      {#if openFamily === base}
        <section
          class="variant-popover flat-variant-drawer"
          aria-label={`${getPropTypeDisplayInfo(base).label} styles`}
          transition:flyFade={{ y: 6 }}
        >
          <span class="variant-popover-label">
            {getPropTypeDisplayInfo(base).label} styles
          </span>
          <div class="variant-popover-buttons">
            {#each choices as prop (prop)}
              {@render tile(prop)}
            {/each}
          </div>
          {#if isFanPropType(base)}
            <FanStyleOptions
              compact
              onPick={() => handleFanStylePick(base)}
            />
          {/if}
        </section>
      {/if}
    {:else}
      <Popover.Root
        open={openFamily === base}
        onOpenChange={(open) => (openFamily = open ? base : null)}
      >
        <Popover.Trigger>
          {#snippet child({ props })}
            <PropTypeButton
              propType={familyDisplayProp(base)}
              selected={selectedBase === base}
              badge={familyCount(base)}
              actionLabel={`Choose ${getPropTypeDisplayInfo(base).label} style`}
              buttonProps={props}
              {color}
            />
          {/snippet}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Overlay
            class="variant-popover-overlay"
            data-testid="prop-style-overlay"
          />
          <Popover.Content
            side="bottom"
            sideOffset={8}
            avoidCollisions={true}
            collisionPadding={12}
            forceMount
          >
            {#snippet child({ open, wrapperProps, props })}
              <div
                {...wrapperProps}
                class="drawer-interactive-portal"
                style:z-index="var(--z-dropdown, 300)"
              >
                {#if open}
                  <section
                    {...props}
                    class="variant-popover"
                    aria-label={`${getPropTypeDisplayInfo(base).label} styles`}
                    data-escape-shortcut-local
                    transition:flyFade={{ y: 6 }}
                  >
                    <span class="variant-popover-label">
                      {getPropTypeDisplayInfo(base).label} styles
                    </span>
                    <div class="variant-popover-buttons">
                      {#each choices as prop (prop)}
                        {@render tile(prop)}
                      {/each}
                    </div>
                    {#if isFanPropType(base)}
                      <FanStyleOptions
                        compact
                        onPick={() => handleFanStylePick(base)}
                      />
                    {/if}
                  </section>
                {/if}
              </div>
            {/snippet}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    {/if}
  {/snippet}

  <div class="grid-scroll themed-scrollbar">
    {#if flat}
      <div class="flat-grid">
        {#each allBases as base (base)}
          {@render familyTile(base)}
        {/each}
      </div>
    {:else}
      <div class="grid-content">
        {#each sections as section, i}
          <div class="prop-section" class:primary={i === 0}>
            <div class="section-label" class:first={i === 0}>
              {section.label}
            </div>
            <div
              class="section-buttons"
              class:single={section.bases.length === 1}
            >
              {#each section.bases as base (base)}
                {@render familyTile(base)}
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if chirality && selectedPropType !== null && isBuugengFamilyProp(selectedPropType)}
    <div class="chirality-dock" transition:growFade={{ axis: "y" }}>
      <PropChiralityRow
        propType={selectedPropType}
        hands={chirality.hands}
        onChange={chirality.onChange}
      />
    </div>
  {/if}

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

  .prop-grid-root.host-scroll {
    height: auto;
    flex: none;
  }

  .prop-grid-root.host-scroll .grid-scroll {
    flex: none;
    overflow: visible;
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
    padding: 14px 18px 20px;
    scrollbar-width: thin;
  }

  .grid-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* The wrapper is inert for existing pickers. Roomy hosts opt into an
     authored section layout below without changing the registry or tiles. */
  .prop-section {
    display: contents;
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
    padding: 6px 3px 5px;
    gap: 3px;
    border-radius: 10px;
    aspect-ratio: 1 / 1.15;
  }
  .flat-grid :global(.prop-label) {
    font-size: var(--font-size-compact, 12px);
  }
  .flat-grid :global(.prop-image-container .prop-composition-preview) {
    width: 75%;
    max-height: 75%;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 16px 2px 8px;
    text-align: left;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .section-label.first {
    border-top: none;
    padding-top: 2px;
  }

  .section-buttons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 124px));
    gap: 10px;
    justify-content: center;
    padding: 0 2px;
  }
  .prop-grid-root.fluid-sections .section-buttons {
    grid-template-columns: repeat(auto-fit, minmax(8.75rem, 10.5rem));
    justify-content: center;
  }

  .prop-grid-root.fluid-sections .grid-content {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px 20px;
  }

  .prop-grid-root.fluid-sections .prop-section {
    display: block;
    min-width: 0;
  }

  .section-buttons.single {
    grid-template-columns: minmax(0, 124px);
  }

  .section-buttons :global(.prop-button) {
    width: 100%;
  }

  .variant-popover {
    z-index: var(--z-dropdown, 300);
    container-type: inline-size;
    display: flex;
    width: min(420px, calc(100vw - 24px));
    max-height: min(
      440px,
      calc(100vh - 24px),
      var(--bits-popover-content-available-height, calc(100vh - 24px))
    );
    box-sizing: border-box;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    overflow-y: auto;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.16));
    border-radius: 14px;
    /* Theme cards are translucent over the animated app background. This
       chooser needs an opaque floor so the prop grid beneath cannot compete
       with its five style choices; the theme card still supplies the tint. */
    background-color: #0c0e16;
    background-image: linear-gradient(
      var(--theme-card-bg, transparent),
      var(--theme-card-bg, transparent)
    );
    box-shadow: 0 16px 52px var(--theme-shadow, rgba(0, 0, 0, 0.62));
  }

  /* The chooser is visually small, but it temporarily owns the pointer. A
     transparent portaled shield keeps mobile hit-testing from handing the same
     tap to whichever prop card happens to sit behind the animated popover. */
  :global(.variant-popover-overlay) {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-dropdown, 300) - 1);
    background: transparent;
  }

  .variant-popover-label {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-align: center;
    text-transform: uppercase;
  }

  .variant-popover-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
    gap: 8px;
  }

  .variant-popover-buttons .tile-wrapper :global(.prop-button) {
    width: 100%;
  }

  @container (max-width: 359px) {
    .variant-popover-buttons {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
    }

    .variant-popover-buttons .tile-wrapper {
      flex: 0 1 calc((100% - 16px) / 3);
      min-width: 0;
    }
  }

  .flat-variant-drawer {
    z-index: auto;
    grid-column: 1 / -1;
    width: 100%;
    max-height: none;
    box-shadow: 0 8px 24px var(--theme-shadow, rgba(0, 0, 0, 0.42));
  }

  .chirality-dock {
    flex: 0 0 auto;
    min-width: 0;
  }

  /* The flat picker is the compact/mobile drawer. Chirality is part of
     choosing Buugeng, so surface it before the prop catalogue instead of
     making the user scroll through every prop to find the A/B controls. */
  .prop-grid-root.flat .chirality-dock {
    order: -1;
  }

  @container prop-grid (min-width: 360px) {
    .section-buttons:not(.single) {
      grid-template-columns: repeat(3, minmax(0, 124px));
    }
  }

  @container prop-grid (min-width: 550px) {
    .section-buttons:not(.single) {
      grid-template-columns: repeat(4, minmax(0, 118px));
    }
  }

  @container prop-grid (min-width: 700px) {
    .section-buttons:not(.single) {
      grid-template-columns: repeat(6, minmax(0, 112px));
    }

    .prop-grid-root.fluid-sections .grid-content {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .prop-grid-root.fluid-sections .prop-section.primary {
      grid-column: 1 / -1;
    }
  }

  @container prop-grid (min-width: 850px) {
    .section-buttons:not(.single) {
      grid-template-columns: repeat(8, minmax(0, 112px));
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
