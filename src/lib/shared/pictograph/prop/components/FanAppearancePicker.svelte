<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import PropBuildPicker from "$lib/shared/3d/components/controls/PropBuildPicker.svelte";
  import {
    fanBuildPreviewOptions,
    fanCoverPreviewOptions,
    fanFramePreviewOptions,
    normalizeFanAppearance,
    type FanAppearance,
    type FanBuild,
    type FanCover,
    type FanFrameColor,
  } from "../domain/fan-appearance";
  import { growFade } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";

  let {
    value,
    onchange,
    compact = false,
  }: {
    value: FanAppearance;
    onchange: (value: FanAppearance) => void;
    compact?: boolean;
  } = $props();

  const appearance = $derived(normalizeFanAppearance(value));
  const buildOptions = $derived(fanBuildPreviewOptions(appearance));
  const frameOptions = $derived(fanFramePreviewOptions(appearance));
  const coverOptions = $derived(fanCoverPreviewOptions(appearance));
  const showFrameColor = $derived(appearance.build === "day");
  const showCover = $derived(
    appearance.build === "fire" || appearance.build === "day"
  );
  const modifierContext = $derived(
    appearance.build === "day" ? "DoodleGrip Day" : "DoodleGrip Fire"
  );

  function chooseBuild(build: FanBuild): void {
    onchange({ ...appearance, build });
  }

  function chooseFrameColor(frameColor: FanFrameColor): void {
    onchange({ ...appearance, frameColor });
  }

  function chooseCover(cover: FanCover): void {
    onchange({ ...appearance, cover });
  }
</script>

<div
  class="fan-appearance-picker"
  class:compact
  style:--prop-picker-accent="var(--theme-accent, #8b7cf6)"
  style:--prop-picker-stroke="var(--theme-stroke, rgba(255,255,255,0.12))"
>
  <div class="build-choice">
    <PropBuildPicker
      label="Fan build"
      value={appearance.build}
      options={buildOptions}
      onchange={chooseBuild}
    />
  </div>

  {#if showFrameColor || showCover}
    <section
      class="modifiers"
      aria-label={`${modifierContext} options`}
      transition:growFade={{ duration: DURATION.normal, axis: "y" }}
    >
      <header>
        <span>Build details</span>
        <Crossfade key={modifierContext} duration={DURATION.fast}>
          <strong>{modifierContext}</strong>
        </Crossfade>
      </header>

      <div class="modifier-grid" class:single={!(showFrameColor && showCover)}>
        {#if showFrameColor}
          <div transition:growFade={{ duration: DURATION.normal, axis: "y" }}>
            <PropBuildPicker
              label="Frame"
              value={appearance.frameColor}
              options={frameOptions}
              onchange={chooseFrameColor}
              density="secondary"
            />
          </div>
        {/if}
        {#if showCover}
          <div>
            <PropBuildPicker
              label="Wick cover"
              value={appearance.cover}
              options={coverOptions}
              onchange={chooseCover}
              density="secondary"
            />
          </div>
        {/if}
      </div>
    </section>
  {/if}
</div>

<style>
  .fan-appearance-picker {
    --build-option-count: 2;
    container-type: inline-size;
    display: grid;
    gap: 12px;
    min-width: 0;
  }

  .build-choice,
  .modifiers,
  .modifier-grid,
  .modifier-grid > div {
    min-width: 0;
  }

  .modifiers {
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
      color-mix(in srgb, var(--theme-card-bg, #11131d) 40%, transparent);
  }

  header {
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

  header strong {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.92em;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .modifier-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .modifier-grid.single {
    grid-template-columns: minmax(0, 1fr);
  }

  @container (min-width: 620px) {
    .fan-appearance-picker:not(.compact) {
      --build-option-count: 4;
    }
  }

  @media (max-height: 560px) {
    .fan-appearance-picker {
      gap: 8px;
    }

    .modifiers {
      padding-block: 8px;
    }
  }
</style>
