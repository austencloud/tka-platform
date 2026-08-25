<script lang="ts">
  /** Runtime reflection laid over the authored river bed on the high tier. */
  import ReflectivePool from "../../primitives/ReflectivePool.svelte";
  import {
    getBlossomRiverBounds,
    getBlossomRiverOutline,
    getBlossomRiverShoreFade,
    getBlossomRiverShoreline,
    getBlossomRiverSurfaceElevation,
  } from "./blossom-water";

  interface Props {
    groundY: number;
    stageZOffset: number;
  }

  let { groundY, stageZOffset }: Props = $props();

  const outline = getBlossomRiverOutline();
  const shoreline = getBlossomRiverShoreline();
  const { width, depth, centerX, centerZ } = getBlossomRiverBounds();
  const surfaceElevation = getBlossomRiverSurfaceElevation();
  const shoreFade = getBlossomRiverShoreFade();

  /**
   * Reflections carry the whole surface at eye level, so this tint is what sets
   * the water's brightness.
   *
   * Fresnel reaches nearly 1 at a grazing angle, which means the shader stops
   * showing its deep and shallow colours and shows the reflected bank instead,
   * at whatever brightness the planar reflector rendered it. A near-white tint
   * hands that lit grass slope back at full strength and the river reads as a
   * daylit swimming pool. Water under a moon returns a fraction of what falls
   * on it, so the tint is dark and slightly cold.
   */
  const REFLECTION_TINT = 0x5b7086;
</script>

<ReflectivePool
  {width}
  {depth}
  position={[centerX, groundY + surfaceElevation + 0.012, stageZOffset + centerZ]}
  {outline}
  {shoreline}
  {shoreFade}
  textureWidth={1024}
  textureHeight={512}
  deepColor="#06121c"
  shallowColor="#15343c"
  reflectionTint={REFLECTION_TINT}
  sunDirection={[-0.42, 0.58, -0.7]}
  sunColor="#5d738f"
  rippleScale={2.4}
  rippleStrength={0.32}
  foamWidth={0.1}
  foamOpacity={0.08}
  flowSpeed={0.28}
/>
