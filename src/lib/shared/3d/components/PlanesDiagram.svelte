<script lang="ts">
  import { Plane, PLANE_COLORS } from "@austencloud/scene-3d";

  interface Props {
    bluePlane: Plane | null;
    redPlane: Plane | null;
    visiblePlanes: ReadonlySet<Plane>;
  }

  let { bluePlane, redPlane, visiblePlanes }: Props = $props();

  function planeOpacity(plane: Plane): number {
    if (bluePlane === plane || redPlane === plane) return 1;
    return visiblePlanes.has(plane) ? 0.7 : 0.28;
  }
</script>

<!-- Isometric legend: wall faces the viewer, wheel is edge-on, floor lies flat. -->
<svg
  class="planes-diagram"
  viewBox="0 0 200 148"
  role="img"
  aria-label="Diagram of the wall, wheel, and floor planes around the performer"
>
  <!-- Floor: flat ellipse at the feet -->
  <ellipse
    cx="100"
    cy="120"
    rx="58"
    ry="15"
    fill="none"
    stroke={PLANE_COLORS[Plane.FLOOR]}
    stroke-width="3"
    opacity={planeOpacity(Plane.FLOOR)}
  />
  <!-- Wheel: edge-on vertical circle (narrow ellipse) -->
  <ellipse
    cx="100"
    cy="66"
    rx="12"
    ry="46"
    fill="none"
    stroke={PLANE_COLORS[Plane.WHEEL]}
    stroke-width="3"
    opacity={planeOpacity(Plane.WHEEL)}
  />
  <!-- Wall: circle facing the viewer -->
  <circle
    cx="100"
    cy="66"
    r="46"
    fill="none"
    stroke={PLANE_COLORS[Plane.WALL]}
    stroke-width="3"
    opacity={planeOpacity(Plane.WALL)}
  />
  <!-- Performer: head + torso + legs, neutral color -->
  <g
    stroke="var(--theme-text-dim)"
    stroke-width="3"
    stroke-linecap="round"
    fill="none"
  >
    <circle cx="100" cy="42" r="7" fill="var(--theme-text-dim)" stroke="none" />
    <line x1="100" y1="50" x2="100" y2="92" />
    <line x1="100" y1="92" x2="90" y2="116" />
    <line x1="100" y1="92" x2="110" y2="116" />
    <line x1="100" y1="60" x2="86" y2="78" />
    <line x1="100" y1="60" x2="114" y2="78" />
  </g>
</svg>

<style>
  .planes-diagram {
    display: block;
    width: 100%;
    max-width: 13.75rem;
    height: auto;
  }
</style>
