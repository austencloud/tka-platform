<!--
  BeatStrip.svelte - Horizontal strip of mini pictographs

  Shows one pictograph per beat index. Blue beats fill in first,
  red beats overlay onto existing pictographs when the second hand
  is built. Always reserves vertical space to prevent grid resizing.

  New cells animate in with a scale transition.
-->
<script lang="ts">
  import { scale } from "svelte/transition";
  import { flip } from "svelte/animate";
  import {
    MotionColor,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { propSvgLoader } from "$lib/shared/pictograph/prop/services/implementations/PropSvgLoader";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { VisualBuilderState } from "../state/visual-builder-state.svelte";
  import StripBeatCell from "./StripBeatCell.svelte";

  let { builderState }: { builderState: VisualBuilderState } = $props();

  // Prop SVG data (loaded once, shared across all cells)
  let bluePropSvg = $state<{ svgContent: string; center: { x: number; y: number } } | null>(null);
  let redPropSvg = $state<{ svgContent: string; center: { x: number; y: number } } | null>(null);

  // Load prop SVGs reactively when prop type changes
  $effect(() => {
    const settings = getSettings();
    const bluePropType = settings.bluePropType ?? PropType.STAFF;
    const redPropType = settings.redPropType ?? PropType.STAFF;

    const blueMotion = createMotionData({ propType: bluePropType, color: MotionColor.BLUE });
    propSvgLoader.loadPropSvg(
      { positionX: 0, positionY: 0, rotationAngle: 0 },
      blueMotion, false,
    ).then(data => {
      if (data?.svgData) {
        bluePropSvg = { svgContent: data.svgData.svgContent, center: data.svgData.center };
      }
    });

    const redMotion = createMotionData({ propType: redPropType, color: MotionColor.RED });
    propSvgLoader.loadPropSvg(
      { positionX: 0, positionY: 0, rotationAngle: 0 },
      redMotion, false,
    ).then(data => {
      if (data?.svgData) {
        redPropSvg = { svgContent: data.svgData.svgContent, center: data.svgData.center };
      }
    });
  });

  // Total beat count = max of both hands
  const totalBeats = $derived(
    Math.max(builderState.blueBeats.length, builderState.redBeats.length)
  );

  // Generate beat index array for keyed iteration
  const beatIndices = $derived(
    Array.from({ length: totalBeats }, (_, i) => i)
  );

  const hasBeats = $derived(totalBeats > 0);
</script>

<div class="beat-strip-container" class:has-beats={hasBeats}>
  {#if hasBeats}
    <div class="beat-strip-scroll">
      <div class="beat-strip-row">
        {#each beatIndices as idx (idx)}
          <div
            class="beat-cell-wrapper"
            animate:flip={{ duration: 250 }}
            in:scale={{ duration: 250, start: 0.5, opacity: 0 }}
          >
            <StripBeatCell
              blueBeat={builderState.blueBeats[idx] ?? null}
              redBeat={builderState.redBeats[idx] ?? null}
              {bluePropSvg}
              {redPropSvg}
              gridMode={builderState.gridMode}
              beatIndex={idx}
            />
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .beat-strip-container {
    flex-shrink: 0;
    width: 100%;
    min-height: 50px; /* Reserve space even when empty to prevent grid resizing */
    display: flex;
    justify-content: center;
    transition: min-height 0.25s ease;
  }

  .beat-strip-container.has-beats {
    min-height: 100px;
  }

  .beat-strip-scroll {
    overflow-x: auto;
    max-width: 100%;
    padding: 4px 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .beat-strip-row {
    display: flex;
    gap: 8px;
    justify-content: center;
    --cell-size: 90px;
  }

  .beat-cell-wrapper {
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .beat-strip-container {
      transition: none;
    }
  }
</style>
