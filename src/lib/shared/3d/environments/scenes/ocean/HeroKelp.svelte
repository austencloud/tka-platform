<script lang="ts">
  import { T } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
  import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
  import { Box3, Vector3 } from "three";
  import type { Object3D } from "three";

  interface Props {
    model: string;
    x?: number;
    y?: number;
    z?: number;
    targetHeight?: number;
    rotY?: number;
  }

  let {
    model,
    x = 0,
    y = 0,
    z = 0,
    targetHeight = 5,
    rotY = 0,
  }: Props = $props();

  const gltf = useGltf(model, { meshoptDecoder: MeshoptDecoder });

  const scene = $derived.by(() => {
    const data = $gltf;
    if (!data) return null;
    return cloneSkeleton(data.scene);
  });

  function measureExtent(root: Object3D): number {
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    const size = new Vector3();
    box.getSize(size);
    return Math.max(size.x, size.y, size.z);
  }

  const normalizedScale = $derived.by(() => {
    const s = scene;
    if (!s) return 0.001;
    const extent = measureExtent(s);
    if (extent < 0.001) return 0.001;
    return targetHeight / extent;
  });
</script>

{#if scene}
  <T is={scene} position.x={x} position.y={y} position.z={z} scale={normalizedScale} rotation.y={rotY} />
{/if}
