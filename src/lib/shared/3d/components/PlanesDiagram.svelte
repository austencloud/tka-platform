<script lang="ts">
  import { Plane, PLANE_COLORS } from "@austencloud/scene-3d";

  interface Props {
    bluePlane: Plane | null;
    redPlane: Plane | null;
    visiblePlanes: ReadonlySet<Plane>;
  }

  let { bluePlane, redPlane, visiblePlanes }: Props = $props();

  interface RingState {
    strokeWidth: number;
    dasharray: string | undefined;
    opacity: number;
  }

  // State is carried by width + dash + opacity together, never opacity alone -
  // PLANE_COLORS are WebGL scene colors and don't reliably clear contrast at
  // low opacity against either theme.
  function ringState(plane: Plane): RingState {
    if (bluePlane === plane || redPlane === plane) {
      return { strokeWidth: 4, dasharray: undefined, opacity: 1 };
    }
    if (visiblePlanes.has(plane)) {
      return { strokeWidth: 3, dasharray: undefined, opacity: 0.8 };
    }
    return { strokeWidth: 2, dasharray: "5 5", opacity: 0.55 };
  }

  const floorState = $derived(ringState(Plane.FLOOR));
  const wheelState = $derived(ringState(Plane.WHEEL));
  const wallState = $derived(ringState(Plane.WALL));
</script>

<!-- Isometric legend: wall faces the viewer, wheel is edge-on, floor lies flat.
     Decorative only - the plane matrix below already carries this information
     in accessible text, so this diagram is hidden from assistive tech. -->
<svg class="planes-diagram" viewBox="40 16 120 122" aria-hidden="true">
  <!-- Floor: flat ellipse at the feet -->
  <ellipse
    cx="100"
    cy="120"
    rx="58"
    ry="15"
    fill="none"
    class="plane-ring"
    style="--raw-color: {PLANE_COLORS[Plane.FLOOR]};"
    stroke-width={floorState.strokeWidth}
    stroke-dasharray={floorState.dasharray}
    opacity={floorState.opacity}
  />
  <!-- Wheel: edge-on vertical circle (narrow ellipse) -->
  <ellipse
    cx="100"
    cy="66"
    rx="12"
    ry="46"
    fill="none"
    class="plane-ring"
    style="--raw-color: {PLANE_COLORS[Plane.WHEEL]};"
    stroke-width={wheelState.strokeWidth}
    stroke-dasharray={wheelState.dasharray}
    opacity={wheelState.opacity}
  />
  <!-- Wall: circle facing the viewer -->
  <circle
    cx="100"
    cy="66"
    r="46"
    fill="none"
    class="plane-ring"
    style="--raw-color: {PLANE_COLORS[Plane.WALL]};"
    stroke-width={wallState.strokeWidth}
    stroke-dasharray={wallState.dasharray}
    opacity={wallState.opacity}
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
    height: auto;
  }

  .plane-ring {
    stroke: color-mix(in srgb, var(--raw-color) 70%, var(--theme-text));
    transition:
      stroke-width 180ms ease,
      opacity 180ms ease;
  }
</style>
