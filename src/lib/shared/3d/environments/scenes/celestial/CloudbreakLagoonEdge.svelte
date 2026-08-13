<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    BufferGeometry,
    DoubleSide,
    Float32BufferAttribute,
    MeshStandardMaterial,
  } from "three";

  interface Props {
    outline: Array<[number, number]>;
    surfaceY: number;
  }

  let { outline, surfaceY }: Props = $props();

  const minX = Math.min(...outline.map(([x]) => x));
  const maxX = Math.max(...outline.map(([x]) => x));
  const minZ = Math.min(...outline.map(([, z]) => z));
  const maxZ = Math.max(...outline.map(([, z]) => z));
  const center: [number, number] = [(minX + maxX) / 2, (minZ + maxZ) / 2];
  const localOutline = outline.map(
    ([x, z]) => [x - center[0], z - center[1]] as [number, number]
  );

  function createRingGeometry(
    outerScale: number,
    innerScale: number
  ): BufferGeometry {
    const positions: number[] = [];
    const indices: number[] = [];

    for (const [x, z] of localOutline) {
      positions.push(x * outerScale, 0, z * outerScale);
    }
    for (const [x, z] of localOutline) {
      positions.push(x * innerScale, 0, z * innerScale);
    }

    for (let index = 0; index < localOutline.length; index += 1) {
      const next = (index + 1) % localOutline.length;
      const inner = index + localOutline.length;
      const innerNext = next + localOutline.length;
      indices.push(index, next, innerNext, index, innerNext, inner);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  const weatheredBankGeometry = createRingGeometry(1.16, 1.01);
  const wetBankGeometry = createRingGeometry(1.045, 0.978);
  const weatheredBank = new MeshStandardMaterial({
    color: "#8f7759",
    roughness: 0.88,
    metalness: 0,
    side: DoubleSide,
  });
  const wetBank = new MeshStandardMaterial({
    color: "#526d68",
    roughness: 0.46,
    metalness: 0,
    envMapIntensity: 0.32,
    side: DoubleSide,
  });

  onDestroy(() => {
    weatheredBankGeometry.dispose();
    wetBankGeometry.dispose();
    weatheredBank.dispose();
    wetBank.dispose();
  });
</script>

<!-- The continuous banks let the shoreline read as one eroded formation. -->
<T.Group position={[center[0], 0, center[1]]}>
  <T.Mesh
    position.y={surfaceY - 0.075}
    geometry={weatheredBankGeometry}
    material={weatheredBank}
    receiveShadow
  />
  <T.Mesh
    position.y={surfaceY - 0.028}
    geometry={wetBankGeometry}
    material={wetBank}
    receiveShadow
  />
</T.Group>
