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
  deepColor="#123044"
  shallowColor="#4f97a0"
  reflectionTint={0x9fb2c4}
  sunDirection={[-0.42, 0.58, -0.7]}
  rippleScale={2.4}
  rippleStrength={0.16}
  foamWidth={0.18}
  foamOpacity={0.3}
  flowSpeed={0.28}
/>
