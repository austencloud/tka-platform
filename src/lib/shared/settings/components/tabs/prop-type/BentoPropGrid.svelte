<!--
  BentoPropGrid.svelte - Family-first prop selection grid

  Base props render under the picker section headers. Families with several
  builds drill one level down: tapping Club replaces the grid with Club /
  Classic Club / Torch at full tile size behind a back bar, so those choices
  never scatter across sections and never shrink into a popover.

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
    hasBigVariant,
    isBigVariant,
    toggleBigVariant,
    getFamilyTileDisplayProp,
    getPropTypeDisplayInfo,
    isPropActive,
    isPremiumCosmeticProp,
  } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { tick } from "svelte";
  import { growFade } from "$lib/shared/transitions/motion";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import PropTypeButton from "./PropTypeButton.svelte";
  import PropChiralityRow from "./PropChiralityRow.svelte";
  import FanStyleOptions from "./FanStyleOptions.svelte";
  import {
    fanBuildPreviewOptions,
    isFanPropType,
    normalizeFanAppearance,
  } from "$lib/shared/pictograph/prop/domain/fan-appearance";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
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
     * auto-fill grid. For tight contexts (the viewer's props pill on any
     * screen, the mobile dock) where every prop on screen without a
     * scrollbar beats grouping.
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
    return getAllVariations(base).filter(
      (prop) => selectablePropSet.has(prop) && !isBigVariant(prop)
    );
  }

  function familyCount(base: PropType): number | undefined {
    const count = familyChoices(base).length;
    return count > 1 ? count : undefined;
  }

  function familyDisplayProp(base: PropType): PropType {
    if (selectedPropType === null) return base;
    return getFamilyTileDisplayProp(base, selectedPropType);
  }

  // One picker, one level down. A family tile or the fan look chip swaps the
  // grid for that choice's tiles at the grid's own tile size behind a back
  // bar. `null` is the all-props grid. Picking stays one level down so the
  // styles can be compared against the live preview; Back or Escape returns.
  type Drill = { kind: "family"; base: PropType } | { kind: "fan-look" };
  let drill = $state<Drill | null>(null);
  let rootEl = $state<HTMLDivElement | null>(null);

  const drillKey = $derived(
    drill === null
      ? "all"
      : drill.kind === "family"
        ? `family:${drill.base}`
        : "fan-look"
  );
  const drillTitle = $derived(
    drill === null
      ? ""
      : drill.kind === "family"
        ? `${getPropTypeDisplayInfo(drill.base).label} styles`
        : "Fan look"
  );

  async function openDrill(next: Drill): Promise<void> {
    drill = next;
    await tick();
    rootEl?.querySelector<HTMLElement>(".drill-back")?.focus();
  }

  async function closeDrill(): Promise<void> {
    const previous = drill;
    drill = null;
    await tick();
    const selector =
      previous?.kind === "family"
        ? `[data-family-tile="${previous.base}"]`
        : '[data-testid="fan-look-chip"]';
    rootEl?.querySelector<HTMLElement>(selector)?.focus();
  }

  function handleDrillKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    void closeDrill();
  }

  // A drilled view whose subject leaves (the host filters props, or the
  // current prop stops being a fan) returns to the grid on its own.
  $effect(() => {
    if (drill?.kind === "fan-look" && !showFanLook) drill = null;
    if (drill?.kind === "family" && !allBases.includes(drill.base)) {
      drill = null;
    }
  });

  // The fan look (build + cover) is a setting on top of the Fan / Big Fan
  // tile, not a family of tiles. It docks as one chip once a fan is current,
  // the same way Buugeng chirality docks, and drills into the full chooser.
  const showFanLook = $derived(
    selectedPropType !== null && isFanPropType(selectedPropType)
  );

  // Size is a property of the current prop, not a prop of its own. Every big
  // prop is reached from here, which is why the grid can fold them away.
  const showSize = $derived(
    selectedPropType !== null &&
      selectablePropSet.has(selectedPropType) &&
      hasBigVariant(selectedPropType)
  );
  const sizeIsBig = $derived(
    selectedPropType !== null && isBigVariant(selectedPropType)
  );
  function chooseSize(big: boolean) {
    if (selectedPropType === null || sizeIsBig === big) return;
    onSelect(toggleBigVariant(selectedPropType));
  }
  const fanAppearance = $derived(
    normalizeFanAppearance(getSettings().fanAppearance)
  );
  const fanLook = $derived(
    fanBuildPreviewOptions(fanAppearance).find(
      (option) => option.id === fanAppearance.build
    )
  );

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
  bind:this={rootEl}
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
    {:else}
      <PropTypeButton
        propType={familyDisplayProp(base)}
        selected={selectedBase === base}
        badge={familyCount(base)}
        actionLabel={`Choose ${getPropTypeDisplayInfo(base).label} style`}
        buttonProps={{
          "aria-expanded": drill?.kind === "family" && drill.base === base,
          "data-family-tile": base,
        }}
        onSelect={() => void openDrill({ kind: "family", base })}
        {color}
      />
    {/if}
  {/snippet}

  <div class="grid-scroll themed-scrollbar">
    <!-- The sequential decision-screen swap: the grid steps out, the drilled
         view steps in from the right, and back runs the other way. -->
    <Crossfade
      key={drillKey}
      mode="swap"
      motion="step"
      direction={drill === null ? -1 : 1}
      animateHeight
    >
      {#if drill !== null}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <section
          class="drill-view"
          aria-label={drillTitle}
          data-escape-shortcut-local
          onkeydown={handleDrillKeydown}
        >
          <div class="drill-bar">
            <button
              type="button"
              class="drill-back"
              aria-label="Back to all props"
              onclick={() => void closeDrill()}
            >
              <i class="fas fa-arrow-left" aria-hidden="true"></i>
            </button>
            <span class="drill-title">{drillTitle}</span>
          </div>
          {#if drill.kind === "fan-look"}
            <FanStyleOptions />
          {:else if flat}
            <div class="flat-grid">
              {#each familyChoices(drill.base) as prop (prop)}
                {@render tile(prop)}
              {/each}
            </div>
          {:else}
            <div class="section-buttons">
              {#each familyChoices(drill.base) as prop (prop)}
                {@render tile(prop)}
              {/each}
            </div>
          {/if}
        </section>
      {:else if flat}
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
    </Crossfade>
  </div>

  {#if showSize && drill === null}
    <div class="look-dock size-dock" transition:growFade={{ axis: "y" }}>
      <span class="look-label">Size</span>
      <div class="size-toggle" role="group" aria-label="Prop size">
        <button
          type="button"
          class="size-option"
          class:active={!sizeIsBig}
          aria-pressed={!sizeIsBig}
          onclick={() => chooseSize(false)}
        >
          Standard
        </button>
        <button
          type="button"
          class="size-option"
          class:active={sizeIsBig}
          aria-pressed={sizeIsBig}
          onclick={() => chooseSize(true)}
        >
          Big
        </button>
      </div>
    </div>
  {/if}

  {#if showFanLook && drill === null}
    <div class="look-dock" transition:growFade={{ axis: "y" }}>
      <span class="look-label">Fan look</span>
      <button
        type="button"
        class="look-chip"
        data-testid="fan-look-chip"
        aria-label={`Fan look: ${fanLook?.label ?? fanAppearance.build}. Change`}
        onclick={() => void openDrill({ kind: "fan-look" })}
      >
        {#if fanLook}
          <img class="look-thumb" src={fanLook.image} alt="" draggable="false" />
        {/if}
        <span class="look-name">{fanLook?.label ?? fanAppearance.build}</span>
        <i class="fas fa-chevron-right look-caret" aria-hidden="true"></i>
      </button>
    </div>
  {/if}

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

  /* The flat picker is a dense dock; it does not need the drawer's
     roomy bottom padding. */
  .prop-grid-root.flat .grid-scroll {
    padding-bottom: 10px;
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

  /* A desktop sidebar has room for readable tiles: five per row at ~85px
     keeps every prop in view in a 750px-tall panel with no scrollbar. */
  @container prop-grid (min-width: 440px) {
    .flat-grid {
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 8px;
    }
  }

  /* One level down there are only a handful of tiles, so even the phone
     dock can afford the readable size: three per row with whole names. */
  .drill-view .flat-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 8px;
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

  /* One level down: a family's styles or the fan look, at the same tile
     size as the grid they replace, behind a back bar. */
  .drill-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .drill-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .drill-back {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    padding: 0;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.16));
    border-radius: 999px;
    background: var(--theme-card-bg, rgba(0, 0, 0, 0.5));
    color: var(--theme-text);
    font-size: 14px;
    cursor: pointer;
    transition:
      border-color var(--transition-fast, 150ms ease),
      background-color var(--transition-fast, 150ms ease);
  }

  .drill-back .fas {
    width: auto;
  }

  .drill-back:hover {
    border-color: color-mix(in srgb, var(--theme-accent, #8b6cff) 70%, white);
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b6cff) 14%,
      var(--theme-card-bg, rgba(0, 0, 0, 0.5))
    );
  }

  .drill-back:focus-visible {
    outline: 2px solid var(--theme-accent, #8b6cff);
    outline-offset: 2px;
  }

  .drill-title {
    min-width: 0;
    overflow: hidden;
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* One chip for the selected fan's look. It sits where Buugeng chirality
     sits: below the grid in the drawer, above it in the flat mobile dock. */
  .look-dock {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
    margin: 0 12px 12px;
    padding: 8px 8px 8px 14px;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.14));
    border-radius: 16px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b6cff) 8%,
      var(--theme-card-bg, rgba(0, 0, 0, 0.75))
    );
  }

  .size-toggle {
    display: flex;
    flex: 0 0 auto;
    gap: 4px;
    padding: 3px;
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(0, 0, 0, 0.55));
  }

  .size-option {
    padding: 6px 14px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.65));
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
  }

  .size-option.active {
    background: var(--theme-accent, #8b6cff);
    color: #fff;
  }

  .look-label {
    flex: 0 0 auto;
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }

  .look-chip {
    display: inline-flex;
    flex: 0 1 auto;
    align-items: center;
    gap: 10px;
    min-width: 0;
    min-height: var(--min-touch-target, 44px);
    padding: 4px 12px 4px 4px;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.16));
    border-radius: 999px;
    background: var(--theme-card-bg, rgba(0, 0, 0, 0.5));
    color: var(--theme-text);
    font: inherit;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition:
      border-color var(--transition-fast, 150ms ease),
      background-color var(--transition-fast, 150ms ease);
  }

  .look-chip:hover {
    border-color: color-mix(in srgb, var(--theme-accent, #8b6cff) 70%, white);
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b6cff) 14%,
      var(--theme-card-bg, rgba(0, 0, 0, 0.5))
    );
  }

  .look-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #8b6cff);
    outline-offset: 2px;
  }

  .look-thumb {
    flex: 0 0 auto;
    width: 64px;
    height: 32px;
    border-radius: 999px;
    object-fit: cover;
    background: #070911;
  }

  .look-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .look-caret {
    flex: 0 0 auto;
    width: auto;
    color: var(--theme-text-dim);
    font-size: 11px;
  }

  @media (prefers-reduced-motion: reduce) {
    .look-chip,
    .drill-back {
      transition: none;
    }
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

  .prop-grid-root.flat .look-dock {
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
