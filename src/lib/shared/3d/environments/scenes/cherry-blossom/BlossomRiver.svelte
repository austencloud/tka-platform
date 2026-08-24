<script lang="ts">
  /** Runtime reflection laid over the authored river bed on the high tier. */
  import ReflectivePool from "../../primitives/ReflectivePool.svelte";
  import {
    getBlossomRiverBounds,
    getBlossomRiverOutline,
    getBlossomRiverSurfaceElevation,
  } from "./blossom-water";

  interface Props {
    groundY: number;
    stageZOffset: number;
  }

  let { groundY, stageZOffset }: Props = $props();

  const outline = getBlossomRiverOutline();
  const { width, depth } = getBlossomRiverBounds();
  const surfaceElevation = getBlossomRiverSurfaceElevation();
</script>

<ReflectivePool
  {width}
  {depth}
  position={[0, groundY + surfaceElevation + 0.012, stageZOffset]}
  {outline}
  textureWidth={512}
  textureHeight={512}
  deepColor="#071b2c"
  shallowColor="#397f89"
  reflectionTint={0x6d8397}
  sunDirection={[-0.42, 0.58, -0.7]}
  rippleScale={3.6}
  rippleStrength={0.12}
  foamWidth={0.055}
  foamOpacity={0.12}
  shoreFade={1.45}
  flowSpeed={0.28}
/>
