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
  import type { TriGridMode, TriGridArcData, TriGridMotionType } from "../domain/trigrid-types";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { svgPreloader } from "$lib/shared/pictograph/shared/services/implementations/SvgPreloader";
  import TriGridArrow from "./TriGridArrow.svelte";
  import { container } from "$lib/shared/di";
  import { TRIGRID_SVG_SIZE } from "../domain/trigrid-constants";
  import { getTriGridLocations } from "../domain/trigrid-coordinates";
  import type { ITriGridCalculator } from "../services/contracts/ITriGridCalculator";

  interface Props {
    mode: TriGridMode;
    blueLocation: GridLocation;
    redLocation: GridLocation;
    blueOrientation: Orientation;
    redOrientation: Orientation;
    motionType: TriGridMotionType;
    showGrid: boolean;
    showArrows: boolean;
    showOrientations: boolean;
  }

  const {
    mode,
    blueLocation,
    redLocation,
    blueOrientation,
    redOrientation,
    motionType,
    showGrid,
    showArrows,
    showOrientations,
  }: Props = $props();

  const calculator: ITriGridCalculator = container.items.triGridCalculator;

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
        svgPreloader.getSvgContent("props/pictograph", "triad"),
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
   * Apply color to triad SVG content by replacing the fill color.
   * The triad.svg has fill:#2e3192 (default dark blue). We replace it with the hand color.
   */
  function colorizedTriad(color: string): string {
    if (!triadSvgContent) return "";
    return triadSvgContent.replace(/#2e3192/gi, color);
  }

  // Grid rotation: 0 for upright, 180 for inverted
  const gridRotation = $derived(mode === "inverted" ? 180 : 0);

  // Hand points for prop positioning
  const handPoints = $derived(calculator.getHandPoints(mode));

  // Prop transform chains (matching PropSvg.svelte pattern)
  const blueTransform = $derived.by(() => {
    const pt = handPoints.get(blueLocation);
    if (!pt) return "";
    const angle = calculator.computePropRotation(blueLocation, blueOrientation, mode);
    return `translate(${pt.x}, ${pt.y}) rotate(${angle}) translate(${-TRIAD_CENTER_X}, ${-TRIAD_CENTER_Y})`;
  });

  const redTransform = $derived.by(() => {
    const pt = handPoints.get(redLocation);
    if (!pt) return "";
    const angle = calculator.computePropRotation(redLocation, redOrientation, mode);
    // Red prop is mirrored (scaleX(-1)) like in the existing pipeline
    return `translate(${pt.x}, ${pt.y}) rotate(${angle}) scale(-1, 1) translate(${-TRIAD_CENTER_X}, ${-TRIAD_CENTER_Y})`;
  });

  // Arc data for shift arrows
  const blueArc = $derived.by((): TriGridArcData | null => {
    if (!showArrows || motionType === "static") return null;
    if (blueLocation === redLocation) return null;

    const adj = calculator.getAdjacentPoints(blueLocation, mode);
    const clockwise = motionType === "pro" || motionType === "float";
    const target = clockwise ? adj.cw : adj.ccw;

    if (target !== redLocation && target !== blueLocation) return null;
    return calculator.computeArcPath(blueLocation, target, clockwise, mode);
  });

  const redArc = $derived.by((): TriGridArcData | null => {
    if (!showArrows || motionType === "static") return null;
    if (blueLocation === redLocation) return null;

    const adj = calculator.getAdjacentPoints(redLocation, mode);
    const clockwise = motionType === "pro" || motionType === "float";
    const target = clockwise ? adj.cw : adj.ccw;

    if (target !== blueLocation && target !== redLocation) return null;
    return calculator.computeArcPath(redLocation, target, clockwise, mode);
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
    <g class="grid-container" transform="rotate({gridRotation}, 475, 475)">
      <g class="grid-layer">
        {@html gridSvgContent}
      </g>
    </g>
  {/if}

  <!-- Arc arrows -->
  {#if showArrows}
    {#if blueArc}
      <TriGridArrow arcData={blueArc} color={BLUE_COLOR} />
    {/if}
    {#if redArc}
      <TriGridArrow arcData={redArc} color={RED_COLOR} />
    {/if}
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
