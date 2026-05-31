<!--
  PathShapeGlyph.svelte

  Accidental glyph for per-step path shape overrides.
  Renders above the grid, horizontally centered.
  Blue icon left of center, red icon right of center.
  Only shows when a motion has a per-step override set.
-->
<script lang="ts">
  import type { MotionData } from "../domain/models/motion-data";
  import { getMotionColor } from "$lib/shared/utils/svg-color-utils";
  import { MotionColor } from "../domain/enums/pictograph-enums";

  let {
    blueMotion = undefined,
    redMotion = undefined,
    darkMode = undefined,
  }: {
    blueMotion?: MotionData | null;
    redMotion?: MotionData | null;
    darkMode?: boolean;
  } = $props();

  const blueShape = $derived(blueMotion?.pathShape);
  const redShape = $derived(redMotion?.pathShape);
  const hasAny = $derived(blueShape !== undefined || redShape !== undefined);

  const blueColor = $derived(getMotionColor(MotionColor.BLUE, darkMode ? "dark" : "light"));
  const redColor = $derived(getMotionColor(MotionColor.RED, darkMode ? "dark" : "light"));

  const CX = 475;
  const CY = 58;
  const SPACING = 36;
  const R = 14;
</script>

{#if hasAny}
  <g class="path-shape-glyph" opacity="0.7">
    {#if blueShape}
      {@const x = redShape ? CX - SPACING : CX}
      <g transform="translate({x}, {CY})">
        {#if blueShape === "arc"}
          <circle r={R} fill="none" stroke={blueColor} stroke-width="2.5" />
        {:else if blueShape === "linear"}
          <rect
            x={-R * 0.7} y={-R * 0.7}
            width={R * 1.4} height={R * 1.4}
            fill="none" stroke={blueColor} stroke-width="2.5"
            transform="rotate(45)"
          />
        {:else if blueShape === "concave"}
          <path
            d="M 0 {-R} Q {R*0.2} {-R*0.2} {R} 0 Q {R*0.2} {R*0.2} 0 {R} Q {-R*0.2} {R*0.2} {-R} 0 Q {-R*0.2} {-R*0.2} 0 {-R} Z"
            fill="none" stroke={blueColor} stroke-width="2.5"
          />
        {/if}
      </g>
    {/if}

    {#if redShape}
      {@const x = blueShape ? CX + SPACING : CX}
      <g transform="translate({x}, {CY})">
        {#if redShape === "arc"}
          <circle r={R} fill="none" stroke={redColor} stroke-width="2.5" />
        {:else if redShape === "linear"}
          <rect
            x={-R * 0.7} y={-R * 0.7}
            width={R * 1.4} height={R * 1.4}
            fill="none" stroke={redColor} stroke-width="2.5"
            transform="rotate(45)"
          />
        {:else if redShape === "concave"}
          <path
            d="M 0 {-R} Q {R*0.2} {-R*0.2} {R} 0 Q {R*0.2} {R*0.2} 0 {R} Q {-R*0.2} {R*0.2} {-R} 0 Q {-R*0.2} {-R*0.2} 0 {-R} Z"
            fill="none" stroke={redColor} stroke-width="2.5"
          />
        {/if}
      </g>
    {/if}
  </g>
{/if}
