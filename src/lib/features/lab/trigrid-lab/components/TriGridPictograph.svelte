<!--
  TriGridPictograph.svelte - Pictograph-style renderer for the 3-point trigrid.

  Matches the existing pictograph aesthetic:
  - Static SVG grid loaded via SvgPreloader, stripped and injected
  - Props loaded from static/images/props/pictograph/triad.svg
  - Transform chain: translate(x,y) rotate(angle) translate(-cx,-cy)
  - Dark background, currentColor grid elements
  - 950x950 viewBox, center at (475, 475)
-->
<script lang="ts">
  import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { TriGridMode } from "../domain/trigrid-types";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { svgPreloader } from "$lib/shared/pictograph/shared/services/svg-preloader";
  import { getTriGridCalculator } from "../get-tri-grid-calculator";
  import { TRIGRID_SVG_SIZE } from "../domain/trigrid-constants";
  import { applyColorToSvg } from "$lib/shared/utils/svg-color-utils";

  interface Props {
    mode: TriGridMode;
    blueLocation: GridLocation;
    redLocation: GridLocation;
    blueOrientation: Orientation;
    redOrientation: Orientation;
    showGrid: boolean;
  }

  const {
    mode,
    blueLocation,
    redLocation,
    blueOrientation,
    redOrientation,
    showGrid,
  }: Props = $props();

  const calculator = getTriGridCalculator();

  // Triad SVG center point (from viewBox 0 0 248.76 219.09)
  const TRIAD_CENTER_X = 124.38;
  const TRIAD_CENTER_Y = 109.545;

  // Prop colors matching existing pictograph convention
  const BLUE_COLOR = "#2563eb";
  const RED_COLOR = "#dc2626";

  // SVG content loaded from static files
  let gridSvgContent = $state("");
  let triadSvgContent = $state("");

  // Load grid and prop SVGs via SvgPreloader (same pattern as GridSvg.svelte)
  $effect(() => {
    loadAssets();
  });

  async function loadAssets(): Promise<void> {
    try {
      const [gridSvg, propSvg] = await Promise.all([
        svgPreloader.getSvgContent("grid", "trigrid_grid"),
        svgPreloader.getSvgContent("prop", "triad"),
      ]);
      gridSvgContent = stripSvgWrapper(gridSvg);
      triadSvgContent = stripSvgWrapper(propSvg);
    } catch (err) {
      console.error("Failed to load trigrid assets:", err);
    }
  }

  /** Strip outer <svg> wrapper so content respects parent coordinate system */
  function stripSvgWrapper(svgContent: string): string {
    let content = svgContent.replace(/<svg[^>]*>/i, "");
    content = content.replace(/<\/svg>/i, "");
    return content.trim();
  }

  /**
   * Apply color to triad SVG content using the shared svg-color-utils.
   * Same approach as PropSvgLoader: replaces all non-preserved fill colors.
   */
  function colorizedTriad(color: string): string {
    if (!triadSvgContent) return "";
    return applyColorToSvg(triadSvgContent, color);
  }

  // Grid rotation: rotate the base grid SVG to match the triangle orientation.
  // The grid SVG is drawn in upright position (apex north).
  const gridRotation = $derived(
    mode === "upright" ? 0 :
    mode === "right" ? 90 :
    mode === "inverted" ? 180 :
    270 // left
  );

  // Hand points for prop positioning
  const handPoints = $derived(calculator.getHandPoints(mode));

  // Beta detection: both props at the same vertex
  const isBeta = $derived(blueLocation === redLocation);

  // Prop transform chains (matching PropSvg.svelte pattern)
  const blueTransform = $derived.by(() => {
    let pt = handPoints.get(blueLocation);
    if (!pt) return "";
    if (isBeta) {
      const offset = calculator.computeBetaOffset(blueLocation, "blue", mode);
      pt = { x: pt.x + offset.x, y: pt.y + offset.y };
    }
    const angle = calculator.computePropRotation(blueLocation, blueOrientation, mode);
    return `translate(${pt.x}, ${pt.y}) rotate(${angle}) translate(${-TRIAD_CENTER_X}, ${-TRIAD_CENTER_Y})`;
  });

  const redTransform = $derived.by(() => {
    let pt = handPoints.get(redLocation);
    if (!pt) return "";
    if (isBeta) {
      const offset = calculator.computeBetaOffset(redLocation, "red", mode);
      pt = { x: pt.x + offset.x, y: pt.y + offset.y };
    }
    const angle = calculator.computePropRotation(redLocation, redOrientation, mode);
    // Red prop is mirrored (scaleX(-1)) like in the existing pipeline.
    // SVG transforms apply right-to-left: center → mirror → rotate → position.
    // The mirror flips the prop from pointing-right to pointing-left (adds 180°).
    // To compensate, subtract 180° from the rotation so the visual direction is correct.
    const mirrorCompensatedAngle = angle - 180;
    return `translate(${pt.x}, ${pt.y}) rotate(${mirrorCompensatedAngle}) scale(-1, 1) translate(${-TRIAD_CENTER_X}, ${-TRIAD_CENTER_Y})`;
  });

</script>

<svg
  viewBox="0 0 {TRIGRID_SVG_SIZE} {TRIGRID_SVG_SIZE}"
  class="trigrid-pictograph"
  role="img"
  aria-label="Trigrid pictograph with {mode} triangle"
>
  <!-- Dark background -->
  <rect width={TRIGRID_SVG_SIZE} height={TRIGRID_SVG_SIZE} class="pictograph-bg" />

  <!-- Grid layer: loaded via SvgPreloader, rotated for inverted mode -->
  {#if showGrid && gridSvgContent}
    <g class="grid-container" class:inverted-mode={mode === "inverted"} transform="rotate({gridRotation}, 475, 475)">
      <g class="grid-layer">
        {@html gridSvgContent}
      </g>
    </g>
  {/if}

  <!-- Blue prop -->
  {#if triadSvgContent && handPoints.get(blueLocation)}
    <g class="prop-svg blue-prop" transform={blueTransform}>
      {@html colorizedTriad(BLUE_COLOR)}
    </g>
  {/if}

  <!-- Red prop -->
  {#if triadSvgContent && handPoints.get(redLocation)}
    <g class="prop-svg red-prop" transform={redTransform}>
      {@html colorizedTriad(RED_COLOR)}
    </g>
  {/if}
</svg>

<style>
  .trigrid-pictograph {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
  }

  .pictograph-bg {
    fill: #000000;
  }

  /* Grid styling matching existing pictograph conventions */
  .grid-container {
    color: #d0d0d0;
  }

  :global(:root.dark) .grid-container {
    color: #d0d0d0;
  }

  :global(:root:not(.dark)) .grid-container {
    color: #333333;
  }

  /* Prop opacity */
  .prop-svg {
    opacity: 0.85;
  }
</style>
