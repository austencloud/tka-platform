<!--
RotationArcs - Renders rotation path arcs for prospin/antispin visualization
-->
<script lang="ts">
  import {
    GRID_POINTS,
    LEFT_STAFF_COLOR,
    RIGHT_STAFF_COLOR,
    type HandPosition,
    type RotationType,
  } from "../../../../domain/constants/staff-visualizer-data";

  let {
    leftPosition,
    rightPosition,
    rotationType,
  }: {
    leftPosition: HandPosition;
    rightPosition: HandPosition;
    rotationType: RotationType;
  } = $props();

  function getRotationArc(position: HandPosition): string {
    const point = GRID_POINTS[position];
    const center = { x: 50, y: 50 };
    const radius = 12;

    const baseAngle = Math.atan2(point.y - center.y, point.x - center.x);
    const arcExtent = Math.PI / 2;
    const clockwise = rotationType === "prospin";

    const startAngle = baseAngle - arcExtent / 2;
    const endAngle = baseAngle + arcExtent / 2;

    const startX =
      point.x + radius * Math.cos(clockwise ? startAngle : endAngle);
    const startY =
      point.y + radius * Math.sin(clockwise ? startAngle : endAngle);
    const endX = point.x + radius * Math.cos(clockwise ? endAngle : startAngle);
    const endY = point.y + radius * Math.sin(clockwise ? endAngle : startAngle);

    return `M ${startX} ${startY} A ${radius} ${radius} 0 0 ${clockwise ? 1 : 0} ${endX} ${endY}`;
  }
</script>

<g class="rotation-arcs">
  <path
    d={getRotationArc(leftPosition)}
    fill="none"
    stroke={LEFT_STAFF_COLOR}
    stroke-width="2"
    stroke-dasharray="3 2"
    class="rotation-arc"
    marker-end="url(#arrowBlue)"
  />
  <path
    d={getRotationArc(rightPosition)}
    fill="none"
    stroke={RIGHT_STAFF_COLOR}
    stroke-width="2"
    stroke-dasharray="3 2"
    class="rotation-arc"
    marker-end="url(#arrowRed)"
  />

  <!-- Arrow markers -->
  <defs>
    <marker
      id="arrowBlue"
      markerWidth="6"
      markerHeight="6"
      refX="5"
      refY="3"
      orient="auto"
    >
      <path d="M0,0 L6,3 L0,6 Z" fill={LEFT_STAFF_COLOR} />
    </marker>
    <marker
      id="arrowRed"
      markerWidth="6"
      markerHeight="6"
      refX="5"
      refY="3"
      orient="auto"
    >
      <path d="M0,0 L6,3 L0,6 Z" fill={RIGHT_STAFF_COLOR} />
    </marker>
  </defs>
</g>

<style>
  .rotation-arc {
    animation: dashMove 1s linear infinite;
  }

  @keyframes dashMove {
    from {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: 10;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rotation-arc {
      animation: none;
    }
  }
</style>
