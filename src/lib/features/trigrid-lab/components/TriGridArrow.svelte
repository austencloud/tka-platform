<!--
  TriGridArrow.svelte - Dynamic 120-degree arc arrow for shift motions.

  Renders an SVG path arc between two adjacent trigrid vertices with an arrowhead.
  Pro motion follows the arc direction. Anti motion goes against it.
-->
<script lang="ts">
  import type { TriGridArcData } from "../domain/trigrid-types";
  import { TRIGRID_ARROW_STROKE_WIDTH } from "../domain/trigrid-constants";

  interface Props {
    /** Arc path data from TriGridCalculator */
    arcData: TriGridArcData;
    /** Color of the arrow */
    color: string;
    /** Optional opacity */
    opacity?: number;
  }

  const { arcData, color, opacity = 0.8 }: Props = $props();
</script>

<g aria-label="Shift motion arc">
  <!-- Arc path -->
  <path
    d={arcData.pathD}
    fill="none"
    stroke={color}
    stroke-width={TRIGRID_ARROW_STROKE_WIDTH}
    stroke-linecap="round"
    {opacity}
  />

  <!-- Arrowhead -->
  <polygon
    points={arcData.arrowheadPoints}
    fill={color}
    {opacity}
  />
</g>
