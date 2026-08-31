<!--
  ScenePropPicker composes the canonical prop gallery with controls that only
  exist in a spatial scene. BentoPropGrid owns prop cards, family popovers,
  access rules, and Buugeng chirality. This adapter owns only the supported 3D
  catalog plus fan and finish builds.
-->
<script lang="ts">
  import {
    propFinishState,
    propHasFanAppearanceOptions,
    propHasFinishVariants,
    type FanBuild,
    type FanCover,
    type FanFrameColor,
    type PropBuild,
    type PropFinish,
  } from "@austencloud/scene-3d";
  import { tick } from "svelte";

  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import { createGlobalChiralitySeam } from "$lib/shared/settings/components/tabs/prop-type/prop-chirality-seam";
  import { createLayoutMotion } from "$lib/shared/transitions/layout-flip";
  import { growFade, motionDuration } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import {
    fanBuildPreviewOptions,
    fanCoverPreviewOptions,
    fanFramePreviewOptions,
    finishPreviewOptions,
    SCENE_PROP_TYPES,
  } from "../../domain/scene-prop-catalog";
  import { toScenePropType } from "../../domain/scene-prop-type";
  import PropBuildPicker from "./PropBuildPicker.svelte";

  interface Props {
    /** Null means All Performers currently contains more than one prop type. */
    currentProp: PropType | null;
    onSelect: (propType: PropType) => void;
    /** The selected performer's colour becomes this picker's local accent. */
    accentColor?: string;
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
  const chirality = createGlobalChiralitySeam();
  const scenePropType = $derived(
    currentProp === null ? null : toScenePropType(currentProp)
  );

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
  const showBuildControls = $derived(showFinishes || showFanAppearance);

  const buildPanelKey = $derived(currentProp ?? "mixed");
  const buildLayoutSignature = $derived(
    [
      buildPanelKey,
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
  let previousBuildPanelKey: PropType | "mixed" | null = null;
  let previousBuildLayoutSignature: string | null = null;
  let buildLayoutTransitionToken = 0;

  const buildLayoutMotion = createLayoutMotion({
    getRoot: () => buildStageElement,
    groups: [
      { selector: "[data-build-layout-key]", datasetKey: "buildLayoutKey" },
    ],
    getDuration: () => motionDuration(DURATION.emphasis),
  });

  // Fan add-ons can change the surviving controls' geometry. Capture their old
  // boxes before Svelte recomposes the panel so the change remains legible.
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

<div
  class="scene-prop-picker"
  style:--prop-picker-accent={accentColor || null}
  style:--theme-accent={accentColor || null}
>
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
      {:else if showFinishes}
        <div class="finish-picker">
          <PropBuildPicker
            label="Finish"
            value={build.finish}
            options={finishOptions}
            onchange={chooseFinish}
          />
        </div>
      {:else}
        <div class="build-controls-empty" aria-hidden="true"></div>
      {/if}
    </Crossfade>
  </div>

  <div class="canonical-prop-gallery">
    <BentoPropGrid
      selectedPropType={currentProp}
      color={accentColor ?? "blue"}
      {onSelect}
      variant="inline"
      scrollMode="host"
      allowedProps={SCENE_PROP_TYPES}
      includeBareHands={showBareHands}
      {chirality}
    />
  </div>
</div>

<style>
  .scene-prop-picker {
    --prop-picker-accent: var(--theme-accent, #67a8ff);
    container-type: inline-size;
    display: grid;
    gap: 12px;
    min-width: 0;
  }

  .build-stage,
  .canonical-prop-gallery,
  .build-stage :global(.crossfade) {
    min-width: 0;
  }

  .canonical-prop-gallery :global(.grid-scroll) {
    padding: 0;
  }

  .build-controls-empty {
    height: 0;
  }

  .finish-picker {
    min-width: 0;
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
      color-mix(in srgb, var(--theme-card-bg) 40%, transparent);
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
    color: var(--theme-text-dim);
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
</style>
