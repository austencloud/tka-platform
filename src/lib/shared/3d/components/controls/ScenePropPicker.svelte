<!--
  ScenePropPicker — the one surface for choosing a 3D prop.

  Wherever the app asks "which prop?", it asks here: the performer inspector
  inside the full 3D environment, the Prop Studio, and anything added later.
  One component reading one catalog means a prop cannot exist in one picker and
  be missing from another, and a person who learned this surface once has
  learned every place it appears.

  Everything it offers comes from `scene-prop-catalog.ts`: which props exist,
  how they group into families, which builds each family has, and the rendered
  picture of every build. A host can provide a performer's resolved build and
  update seam; hosts that omit it edit the scene default instead.

  Hosts differ only in width. The tile grid recomposes from a three-column
  vertical layout in a narrow inspector panel to a seven-column row in a wide
  review deck; there is no per-host markup and no per-host layout rule.
-->
<script lang="ts">
  import {
    propFinishState,
    propHasFanAppearanceOptions,
    propHasFinishVariants,
    type FanBuild,
    type FanCover,
    type FanFrameColor,
    type PropFinish,
    type PropBuild,
  } from "@austencloud/scene-3d";
  import { tick } from "svelte";

  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { createLayoutMotion } from "$lib/shared/transitions/layout-flip";
  import { growFade, motionDuration } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import {
    fanBuildPreviewOptions,
    fanCoverPreviewOptions,
    fanFramePreviewOptions,
    finishPreviewOptions,
    findScenePropFamily,
    findScenePropFamilyByRepresentative,
    propBuildPreviewImage,
    SCENE_PROP_REPRESENTATIVES,
  } from "../../domain/scene-prop-catalog";
  import { toScenePropType } from "../../domain/scene-prop-type";
  import PropBuildPicker from "./PropBuildPicker.svelte";

  interface Props {
    /** The prop in the scene right now, or null when nothing is chosen yet. */
    currentProp: PropType | null;
    onSelect: (propType: PropType) => void;
    /** Overrides the picker's accent. Hosts pass a performer colour here. */
    accentColor?: string;
    /**
     * Offers "Bare hands" — no visible prop. Every host that drives a live
     * performer wants it; a studio whose whole subject is the prop does not.
     */
    showBareHands?: boolean;
    /** Resolved build for a performer-scoped host. Omit for the scene default. */
    build?: PropBuild;
    /** Writes a performer override. Omit to write the scene default. */
    onBuildChange?: (build: PropBuild) => void;
  }

  let {
    currentProp,
    onSelect,
    accentColor,
    showBareHands = true,
    build: buildOverride,
    onBuildChange,
  }: Props = $props();

  const build = $derived(buildOverride ?? propFinishState.build);

  const selectedFamily = $derived(
    currentProp === null ? undefined : findScenePropFamily(currentProp)
  );
  const scenePropType = $derived(
    currentProp === null ? null : toScenePropType(currentProp)
  );

  /**
   * Offering Fire/Day beside a staff is a switch wired to nothing, so the row
   * is only here when the selected prop actually owns both builds.
   */
  const showFinishes = $derived(
    scenePropType !== null && propHasFinishVariants(scenePropType)
  );
  const showFanAppearance = $derived(
    scenePropType !== null && propHasFanAppearanceOptions(scenePropType)
  );
  const showFanFrameColors = $derived(
    showFanAppearance && build.fanBuild === "day"
  );
  const showFanCover = $derived(
    showFanAppearance &&
      build.fanBuild !== "pictograph" &&
      build.fanBuild !== "lotus"
  );
  const showBuildControls = $derived(
    showFinishes || showFanAppearance || selectedFamily !== undefined
  );

  // The outer crossfade belongs to actual panel replacement: moving between
  // prop families. A subtype change keeps its family's primary picker alive so
  // LayoutMotion can carry it to its new width instead of ghosting a second copy
  // over the first one (Triad <-> Trigeng was the clearest offender).
  const buildPanelKey = $derived(
    selectedFamily?.representative ?? currentProp ?? PropType.STAFF
  );
  const buildLayoutSignature = $derived(
    [
      buildPanelKey,
      currentProp,
      build.fanBuild,
      showFinishes,
      showFanFrameColors,
      showFanCover,
    ].join(":")
  );

  const fanBuildContext = $derived(
    build.fanBuild === "day"
      ? "Day fan"
      : build.fanBuild === "lotus"
        ? "Lotus fan"
        : "Fire fan"
  );
  const finishOptions = $derived(
    finishPreviewOptions(currentProp ?? PropType.TRIAD)
  );
  const fanBuildOptions = $derived(
    fanBuildPreviewOptions(build.fanFrameColor, build.fanCover)
  );
  const fanFrameOptions = $derived(fanFramePreviewOptions(build.fanCover));
  const fanCoverOptions = $derived(
    fanCoverPreviewOptions(
      build.fanBuild === "day" ? "day" : "fire",
      build.fanFrameColor
    )
  );
  const familyOptions = $derived(
    selectedFamily?.variants.map((variant) => ({
      ...variant,
      image: propBuildPreviewImage(variant.id),
    })) ?? []
  );

  function chooseTile(prop: PropType): void {
    // Family tiles stay selected while their build pickers change the model.
    // Clicking one again should not throw the user back to its first variant.
    if (selectedFamily?.representative === prop) return;
    onSelect(prop);
  }

  function chooseFinish(finish: PropFinish): void {
    if (onBuildChange) return onBuildChange({ ...build, finish });
    propFinishState.set(finish);
  }

  function chooseFanBuild(fanBuild: FanBuild): void {
    if (onBuildChange) return onBuildChange({ ...build, fanBuild });
    propFinishState.setFanBuild(fanBuild);
  }

  function chooseFanFrameColor(color: FanFrameColor): void {
    if (onBuildChange) return onBuildChange({ ...build, fanFrameColor: color });
    propFinishState.setFanFrameColor(color);
  }

  function chooseFanCover(cover: FanCover): void {
    if (onBuildChange) return onBuildChange({ ...build, fanCover: cover });
    propFinishState.setFanCover(cover);
  }

  let buildStageElement: HTMLDivElement | null = $state(null);
  let previousBuildPanelKey: PropType | null = null;
  let previousBuildLayoutSignature: string | null = null;
  let buildLayoutTransitionToken = 0;

  const buildLayoutMotion = createLayoutMotion({
    getRoot: () => buildStageElement,
    groups: [
      { selector: "[data-build-layout-key]", datasetKey: "buildLayoutKey" },
    ],
    getDuration: () => motionDuration(DURATION.emphasis),
  });

  // Capture before Svelte recomposes a family's options, then animate the
  // surviving controls from their old geometry to the new one. New/removed
  // controls own their entrance/exit separately through the shared motion
  // primitives below.
  $effect.pre(() => {
    const panelKey = buildPanelKey;
    const signature = buildLayoutSignature;
    const samePanel = previousBuildPanelKey === panelKey;
    const changed =
      previousBuildLayoutSignature !== null &&
      previousBuildLayoutSignature !== signature;

    previousBuildPanelKey = panelKey;
    previousBuildLayoutSignature = signature;
    if (!samePanel || !changed || !buildStageElement) return;

    const captured = buildLayoutMotion.capture();
    const token = ++buildLayoutTransitionToken;
    void tick().then(() => {
      if (token !== buildLayoutTransitionToken) return;
      if (captured) buildLayoutMotion.play();
    });
  });
</script>

<div class="scene-prop-picker" style:--prop-picker-accent={accentColor || null}>
  <div
    bind:this={buildStageElement}
    class="build-stage"
    aria-hidden={!showBuildControls}
    inert={!showBuildControls}
  >
    <Crossfade key={buildPanelKey} duration={DURATION.normal} animateHeight>
      {#if showFanAppearance}
        <div
          class="fan-build-layout"
          class:has-customization={showFanFrameColors || showFanCover}
        >
          <div class="fan-build-primary" data-build-layout-key="fan-build">
            <PropBuildPicker
              label="Build"
              value={build.fanBuild}
              options={fanBuildOptions}
              onchange={chooseFanBuild}
            />
          </div>

          {#if showFanFrameColors || showFanCover}
            <section
              class="fan-customization"
              aria-label={`${fanBuildContext} options`}
              transition:growFade={{ duration: DURATION.normal, axis: "y" }}
            >
              <header class="customization-heading">
                <span>Optional add-ons</span>
                <Crossfade key={fanBuildContext} duration={DURATION.fast}>
                  <strong>{fanBuildContext}</strong>
                </Crossfade>
              </header>
              <div
                class="fan-modifier-grid"
                class:has-frame-color={showFanFrameColors}
              >
                {#if showFanFrameColors}
                  <div
                    class="fan-modifier frame-color-modifier"
                    transition:growFade={{
                      duration: DURATION.normal,
                      axis: "y",
                    }}
                  >
                    <PropBuildPicker
                      label="Frame color"
                      value={build.fanFrameColor}
                      options={fanFrameOptions}
                      onchange={chooseFanFrameColor}
                      density="secondary"
                    />
                  </div>
                {/if}
                {#if showFanCover}
                  <div
                    class="fan-modifier cover-modifier"
                    data-build-layout-key="fan-cover"
                  >
                    <PropBuildPicker
                      label="Wick cover"
                      value={build.fanCover}
                      options={fanCoverOptions}
                      onchange={chooseFanCover}
                      density="secondary"
                    />
                  </div>
                {/if}
              </div>
            </section>
          {/if}
        </div>
      {:else if showBuildControls}
        <div class="build-controls" class:has-finish={showFinishes}>
          {#if selectedFamily}
            <div
              class="build-picker primary family-picker"
              data-build-layout-key="family-picker"
            >
              <PropBuildPicker
                label={selectedFamily.controlLabel}
                value={currentProp ?? selectedFamily.representative}
                options={familyOptions}
                onchange={onSelect}
              />
            </div>
            {#if showFinishes}
              <div
                class="build-picker secondary finish-picker"
                transition:growFade={{ duration: DURATION.normal, axis: "y" }}
              >
                <PropBuildPicker
                  label="Finish"
                  value={build.finish}
                  options={finishOptions}
                  onchange={chooseFinish}
                  density="secondary"
                />
              </div>
            {/if}
          {:else if showFinishes}
            <div
              class="build-picker primary solo-finish-picker"
              data-build-layout-key="solo-finish"
            >
              <PropBuildPicker
                label="Finish"
                value={build.finish}
                options={finishOptions}
                onchange={chooseFinish}
              />
            </div>
          {/if}
        </div>
      {:else}
        <div class="build-controls-empty" aria-hidden="true"></div>
      {/if}
    </Crossfade>
  </div>

  <!--
    A grid, not a row. Fourteen prop families in one flex line collapsed every
    button to the 44px touch floor and clipped thirteen of the labels. Column
    counts are pinned per tier and never leave a row of one (14 % cols != 1).
    Bare hands stays outside the grid so it cannot break that arithmetic.
  -->
  <span class="section-label" id="scene-prop-grid-label">Prop</span>

  <div class="prop-grid" role="group" aria-labelledby="scene-prop-grid-label">
    {#each SCENE_PROP_REPRESENTATIVES as prop}
      {@const family = findScenePropFamilyByRepresentative(prop)}
      {@const active = family
        ? selectedFamily?.representative === prop
        : currentProp === prop}
      <button
        type="button"
        class="prop-tile"
        class:active
        aria-pressed={active}
        onclick={() => chooseTile(prop)}
      >
        <span class="tile-art">
          <PropCompositionPreview
            propType={prop}
            size={34}
            darkBackground
            useSavedOverrides={false}
          />
        </span>
        <span class="tile-label"
          >{family?.tileLabel ?? getPropTypeDisplayInfo(prop).label}</span
        >
      </button>
    {/each}
  </div>

  {#if showBareHands}
    <button
      class="bare-hands-choice"
      class:active={currentProp === PropType.HAND}
      type="button"
      aria-pressed={currentProp === PropType.HAND}
      onclick={() => onSelect(PropType.HAND)}
    >
      <span class="bare-hands-icon" aria-hidden="true">
        <i class="fas fa-hand"></i>
      </span>
      <span class="bare-hands-copy">
        <strong>Bare hands</strong>
        <small>No visible 3D prop</small>
      </span>
    </button>
  {/if}
</div>

<style>
  .scene-prop-picker {
    --prop-picker-accent: var(--theme-accent, #67a8ff);
    --prop-picker-stroke: var(--theme-stroke, rgba(255, 255, 255, 0.14));
    --prop-picker-card: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    container-type: inline-size;
    display: grid;
    gap: 12px;
    min-width: 0;
  }

  .build-stage {
    min-width: 0;
  }

  .build-stage :global(.crossfade) {
    min-width: 0;
  }

  .build-controls {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    align-items: end;
    gap: 12px;
    min-width: 0;
  }

  .build-controls-empty {
    height: 0;
  }

  .build-picker {
    min-width: 0;
  }

  .family-picker,
  .solo-finish-picker {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .finish-picker {
    grid-column: 1 / -1;
  }

  /*
    Side by side only where both pickers can still show their pictures. Below
    that the finish drops under the family list rather than shrinking two image
    rows into thumbnails.
  */
  @container (min-width: 620px) {
    .build-controls.has-finish .family-picker {
      grid-column: span 8;
    }

    .finish-picker {
      grid-column: 9 / -1;
      grid-row: 1;
    }
  }

  .fan-build-layout {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    align-items: stretch;
    gap: 12px;
    min-width: 0;
  }

  .fan-build-primary {
    --build-option-count: 4;
    grid-column: 1 / -1;
    grid-row: 1;
  }

  @container (max-width: 499px) {
    .fan-build-primary {
      --build-option-count: 2;
    }
  }

  @container (min-width: 620px) and (max-width: 759px) {
    .fan-build-layout.has-customization .fan-build-primary {
      --build-option-count: 2;
    }
  }

  .fan-customization {
    grid-column: 1 / -1;
  }

  @container (min-width: 620px) {
    .fan-build-layout.has-customization .fan-build-primary {
      grid-column: span 8;
    }

    .fan-customization {
      grid-column: 9 / -1;
      grid-row: 1;
    }
  }

  .fan-build-primary,
  .fan-modifier {
    min-width: 0;
  }

  .fan-customization {
    min-width: 0;
    padding: 10px 12px 12px;
    border: 1px solid
      color-mix(in srgb, var(--prop-picker-accent) 22%, transparent);
    border-radius: var(--settings-border-radius-lg, 16px);
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--prop-picker-accent) 8%, transparent),
        transparent 58%
      ),
      rgba(255, 255, 255, 0.025);
  }

  .customization-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
    color: color-mix(in srgb, var(--prop-picker-accent) 66%, white);
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .customization-heading strong {
    color: rgba(255, 255, 255, 0.52);
    font-size: 0.92em;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .fan-modifier-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    min-width: 0;
  }

  .cover-modifier {
    grid-column: 1 / -1;
  }

  .fan-modifier-grid.has-frame-color .frame-color-modifier {
    grid-column: 1;
  }

  .fan-modifier-grid.has-frame-color .cover-modifier {
    grid-column: 2;
  }

  .section-label {
    display: block;
    margin-bottom: -4px;
    color: rgba(255, 255, 255, 0.58);
    font-size: clamp(12px, 0.5cqi, 18px);
    font-weight: 750;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .prop-grid {
    display: grid;
    gap: 7px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @container (min-width: 700px) {
    .prop-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }

  /*
    Seven from 1200 up, not from 1680: on a 1440x900 laptop six columns cost a
    third row and pushed the deck to 42% of the viewport. Seven keeps it at two
    rows, and 14 % 7 = 0 so the last row is always full.
  */
  @container (min-width: 1200px) {
    .prop-grid {
      grid-template-columns: repeat(7, minmax(0, 1fr));
    }
  }

  button {
    min-height: clamp(44px, 1.9cqi, 68px);
    padding: clamp(9px, 0.4cqi, 15px) clamp(13px, 0.62cqi, 22px);
    border: 1px solid var(--prop-picker-stroke);
    border-radius: var(--settings-border-radius-md, 10px);
    background: var(--prop-picker-card);
    color: rgba(255, 255, 255, 0.78);
    font: inherit;
    font-size: clamp(14px, 0.62cqi, 24px);
    font-weight: 650;
    cursor: pointer;
    transition:
      transform var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-fast, 150ms) ease;
  }

  @media (hover: hover) and (pointer: fine) {
    button:hover {
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
      color: #fff;
      transform: translateY(-1px);
    }
  }

  button.active {
    border-color: var(--prop-picker-accent);
    background: color-mix(
      in srgb,
      var(--prop-picker-accent) 20%,
      var(--prop-picker-card)
    );
    color: #fff;
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--prop-picker-accent) 38%, transparent);
  }

  button:focus-visible {
    outline: 2px solid var(--prop-picker-accent);
    outline-offset: 2px;
  }

  /*
    Bare hands is a different KIND of answer to "which prop" — none of them — so
    it reads as its own wide row rather than a fifteenth tile competing with the
    props for a column.
  */
  .bare-hands-choice {
    display: grid;
    grid-template-columns: 2.75rem minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    width: min(100%, 18rem);
    min-height: 56px;
    padding: 7px 12px;
    text-align: left;
  }

  .bare-hands-icon {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 9px;
    background: color-mix(in srgb, currentColor 10%, transparent);
  }

  .bare-hands-copy {
    display: grid;
    gap: 2px;
  }

  .bare-hands-copy strong {
    font-size: clamp(14px, 0.62cqi, 24px);
  }

  .bare-hands-copy small {
    color: rgba(255, 255, 255, 0.55);
    font-size: var(--font-size-compact, 12px);
  }

  /*
    Narrow hosts stack the glyph over its name so a 300px inspector panel still
    shows what each prop looks like. Wide hosts put them side by side, which is
    what lets seven tiles share one row.
  */
  .prop-tile {
    display: grid;
    justify-items: center;
    gap: 6px;
    padding: 8px 6px;
    text-align: center;
  }

  .tile-art {
    display: block;
    flex: 0 0 auto;
    width: clamp(34px, 1.35cqi, 52px);
    height: clamp(34px, 1.35cqi, 52px);
  }

  /* The preview ships explicit width/height attributes; let the tier drive it. */
  .tile-art :global(svg) {
    width: 100%;
    height: 100%;
  }

  .tile-label {
    min-width: 0;
    white-space: normal;
    line-height: 1.15;
  }

  /*
    The glyph is a luxury, the name is the requirement. In the six-column band a
    tile is ~110px wide and a 34px glyph beside the label leaves less room than
    the word "Triquetra" needs, so the row spends it all on the name.
  */
  @container (min-width: 700px) {
    .prop-tile {
      display: flex;
      align-items: center;
      justify-items: stretch;
      gap: 9px;
      padding: 6px 10px;
      text-align: left;
    }

    .tile-art {
      display: none;
    }
  }

  @container (min-width: 1200px) {
    .tile-art {
      display: block;
    }
  }

  /*
    Past 1150px the picker stops being a stack and becomes two panels: builds
    on the left, the prop grid on the right. Stacked, the build row and the
    tile rows add up: at 1440 the deck took 55% of the viewport and buried the
    performer it exists to show. Side by side the two are the same height as
    the taller one. Three build cards need less room than fourteen tiles, so
    the split is uneven. The grid drops to five columns for the narrower
    track -- 14 % 5 = 4, so the last row is still not an orphan.
  */
  @container (min-width: 1150px) {
    .scene-prop-picker {
      grid-template-columns: minmax(0, 0.62fr) minmax(0, 1fr);
      align-items: start;
      column-gap: clamp(20px, 1.1cqi, 40px);
    }

    .build-stage {
      grid-column: 1;
      grid-row: 1 / span 3;
    }

    .section-label {
      grid-column: 2;
      grid-row: 1;
    }

    .prop-grid {
      grid-column: 2;
      grid-row: 2;
      align-content: start;
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .bare-hands-choice {
      grid-column: 2;
      grid-row: 3;
    }
  }

  /* The grid track of a 4K review deck is still 2300px; seven columns fit. */
  @container (min-width: 2400px) {
    .prop-grid {
      grid-template-columns: repeat(7, minmax(0, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
</style>
