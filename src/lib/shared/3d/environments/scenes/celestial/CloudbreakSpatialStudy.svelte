<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    DoubleSide,
    MeshBasicMaterial,
    MeshStandardMaterial,
    Shape,
    ShapeGeometry,
  } from "three";

  import { CLOUDBREAK_LAYOUT } from "./cloudbreak-layout";
  import { resolveCircularStageRadius } from "../../domain/performer-stage-bounds";

  interface Props {
    planMode?: boolean;
    stageRadius?: number;
  }

  let { planMode = false, stageRadius = 3 }: Props = $props();

  const threshold = CLOUDBREAK_LAYOUT.rearThreshold;
  const approach = CLOUDBREAK_LAYOUT.approach;
  const pillarWidth = (threshold.outerWidth - threshold.openingWidth) / 2;
  const innerPierWidth = pillarWidth * 0.48;
  const innerPierX = threshold.openingWidth / 2 + innerPierWidth / 2;
  const lintelHeight = threshold.outerHeight - threshold.openingHeight;
  const thresholdZ = threshold.centerXZ[1];
  const terraceCenter = CLOUDBREAK_LAYOUT.performanceTerrace.centerXZ;
  const terraceSurfaceRadius = $derived(
    resolveCircularStageRadius(stageRadius, 6.08, {
      x: terraceCenter[0],
      z: terraceCenter[1],
    })
  );

  const limestone = new MeshStandardMaterial({
    color: "#c9ad82",
    roughness: 0.92,
    metalness: 0,
  });
  const limestoneLight = new MeshStandardMaterial({
    color: "#ddc49a",
    roughness: 0.9,
    metalness: 0,
  });
  const pathWear = new MeshStandardMaterial({
    color: "#76583d",
    roughness: 0.98,
    metalness: 0,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: DoubleSide,
  });
  const pathCore = new MeshStandardMaterial({
    color: "#c59a5e",
    roughness: 0.96,
    metalness: 0,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    side: DoubleSide,
  });
  const passageShadow = new MeshStandardMaterial({
    color: "#40372f",
    roughness: 1,
    metalness: 0,
  });
  const scaleFigure = new MeshStandardMaterial({
    color: "#493d31",
    roughness: 0.88,
    metalness: 0,
  });
  const stageSurface = new MeshStandardMaterial({
    color: "#e0bf7d",
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.24,
  });
  const stageEdge = new MeshStandardMaterial({
    color: "#896347",
    roughness: 0.98,
    metalness: 0,
  });
  const stageWear = new MeshStandardMaterial({
    color: "#96704c",
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    side: DoubleSide,
  });
  const stageMarker = new MeshBasicMaterial({
    color: "#f1d59c",
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const lagoonMarker = new MeshBasicMaterial({
    color: "#73c9d4",
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  const thresholdMarker = new MeshBasicMaterial({
    color: "#b2bd8a",
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const pathMarker = new MeshBasicMaterial({
    color: "#d4b978",
    transparent: true,
    opacity: 0.52,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });

  function createPathGeometry(widthMultiplier = 1): ShapeGeometry {
    const left: Array<[number, number]> = [];
    const right: Array<[number, number]> = [];
    for (let index = 0; index <= 18; index += 1) {
      const progress = index / 18;
      const z = 2.1 + progress * 41.5;
      const centre = Math.sin(progress * Math.PI * 2.15) * 0.34;
      const halfWidth =
        (approach.wornBandWidth / 2) *
        widthMultiplier *
        (0.91 + Math.sin(index * 1.71) * 0.045);
      left.push([centre - halfWidth, -z]);
      right.push([centre + halfWidth, -z]);
    }

    const shape = new Shape();
    shape.moveTo(left[0]![0], left[0]![1]);
    for (const [x, z] of left.slice(1)) shape.lineTo(x, z);
    for (const [x, z] of right.reverse()) shape.lineTo(x, z);
    shape.closePath();
    const geometry = new ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }

  const pathGeometry = createPathGeometry();
  const pathCoreGeometry = createPathGeometry(0.48);
  const shoulderBlocks = [
    [-14.8, 5.8, 50.7, 8.7, 11.6, 15.5, -0.035],
    [15.2, 5.3, 51.1, 8.9, 10.6, 15.1, 0.04],
    [-25.5, 7.2, 49.5, 10.5, 14.4, 18.5, 0.08],
    [25.8, 6.6, 50.2, 11, 13.2, 17.2, -0.07],
    [-18.8, 15.5, 54.5, 9.2, 21.5, 9.5, -0.05],
    [19.3, 14.3, 55.1, 8.7, 19.4, 10.2, 0.06],
  ] as const;

  onDestroy(() => {
    limestone.dispose();
    limestoneLight.dispose();
    pathWear.dispose();
    pathCore.dispose();
    passageShadow.dispose();
    scaleFigure.dispose();
    stageSurface.dispose();
    stageEdge.dispose();
    stageWear.dispose();
    stageMarker.dispose();
    lagoonMarker.dispose();
    thresholdMarker.dispose();
    pathMarker.dispose();
    pathGeometry.dispose();
    pathCoreGeometry.dispose();
  });
</script>

<T.Mesh
  position={[0, -0.58, thresholdZ + 2]}
  material={limestone}
  receiveShadow
>
  <T.BoxGeometry args={[threshold.outerWidth + 17, 1.2, threshold.depth + 9]} />
</T.Mesh>

<!-- The visible rim sits below the performers' feet. Material, not elevation,
     separates the terrace so every roster stays grounded. -->
<T.Mesh
  position={[terraceCenter[0], 0.11, terraceCenter[1]]}
  material={stageEdge}
  castShadow
  receiveShadow
>
  <T.CylinderGeometry
    args={[terraceSurfaceRadius + 0.1, terraceSurfaceRadius + 0.4, 0.22, 64]}
  />
</T.Mesh>
<T.Mesh
  position={[terraceCenter[0], 0.225, terraceCenter[1]]}
  rotation.x={-Math.PI / 2}
  material={stageSurface}
  receiveShadow
>
  <T.CircleGeometry args={[terraceSurfaceRadius, 64]} />
</T.Mesh>
<T.Mesh
  position={[terraceCenter[0], 0.232, terraceCenter[1]]}
  rotation.x={-Math.PI / 2}
  material={stageWear}
  receiveShadow
>
  <T.RingGeometry
    args={[terraceSurfaceRadius - 0.63, terraceSurfaceRadius - 0.12, 64]}
  />
</T.Mesh>

<T.Mesh
  position.y={approach.surfaceY + 0.035}
  geometry={pathGeometry}
  material={pathWear}
  receiveShadow
/>
<T.Mesh
  position.y={approach.surfaceY + 0.043}
  geometry={pathCoreGeometry}
  material={pathCore}
  receiveShadow
/>

<T.Mesh
  position={[
    0,
    threshold.openingHeight / 2,
    thresholdZ + threshold.depth * 0.62,
  ]}
  material={passageShadow}
  receiveShadow
>
  <T.BoxGeometry
    args={[
      threshold.openingWidth * 1.025,
      threshold.openingHeight * 1.025,
      1.2,
    ]}
  />
</T.Mesh>
<T.Mesh
  position={[
    0,
    threshold.openingHeight + 0.12,
    thresholdZ + threshold.depth * 0.28,
  ]}
  material={passageShadow}
  receiveShadow
>
  <T.BoxGeometry args={[threshold.openingWidth, 0.6, threshold.depth * 0.72]} />
</T.Mesh>

{#each [-1, 1] as side (side)}
  <T.Mesh
    position={[side * innerPierX, threshold.openingHeight * 0.57, thresholdZ]}
    rotation.y={side * 0.025}
    rotation.z={side * -0.018}
    material={side < 0 ? limestone : limestoneLight}
    castShadow
    receiveShadow
  >
    <T.BoxGeometry
      args={[innerPierWidth, threshold.openingHeight * 1.14, threshold.depth]}
    />
  </T.Mesh>
{/each}

<T.Mesh
  position={[
    -threshold.openingWidth * 0.54,
    threshold.openingHeight + lintelHeight * 0.48,
    thresholdZ - 0.12,
  ]}
  rotation.z={0.028}
  rotation.y={-0.018}
  material={limestoneLight}
  castShadow
  receiveShadow
>
  <T.BoxGeometry
    args={[
      threshold.openingWidth * 1.12,
      lintelHeight * 0.72,
      threshold.depth * 1.03,
    ]}
  />
</T.Mesh>
<T.Mesh
  position={[
    threshold.openingWidth * 0.56,
    threshold.openingHeight + lintelHeight * 0.51,
    thresholdZ + 0.08,
  ]}
  rotation.z={-0.035}
  rotation.y={0.02}
  material={limestone}
  castShadow
  receiveShadow
>
  <T.BoxGeometry
    args={[threshold.openingWidth * 1.08, lintelHeight * 0.68, threshold.depth]}
  />
</T.Mesh>

{#each shoulderBlocks as block, index (index)}
  <T.Mesh
    position={[block[0], block[1], block[2]]}
    rotation.y={block[6]}
    material={limestone}
    castShadow
    receiveShadow
  >
    <T.BoxGeometry args={[block[3], block[4], block[5]]} />
  </T.Mesh>
{/each}

<T.Group position={[-3.1, 0.01, 38.5]}>
  <T.Mesh position.y={0.72} material={scaleFigure} castShadow>
    <T.CylinderGeometry args={[0.17, 0.23, 1.44, 12]} />
  </T.Mesh>
  <T.Mesh position.y={1.58} material={scaleFigure} castShadow>
    <T.SphereGeometry args={[0.17, 16, 12]} />
  </T.Mesh>
</T.Group>

{#if planMode}
  <T.Mesh
    position.y={approach.surfaceY + 0.065}
    geometry={pathGeometry}
    material={pathMarker}
    renderOrder={4}
  />
  <T.Mesh
    position={[0, 0.075, -1]}
    rotation.x={-Math.PI / 2}
    material={stageMarker}
    renderOrder={4}
  >
    <T.RingGeometry args={[5.5, 5.78, 64]} />
  </T.Mesh>
  <T.Mesh
    position={[12.5, 0.08, 0]}
    rotation.x={-Math.PI / 2}
    scale.x={3.5}
    scale.y={2.8}
    material={lagoonMarker}
    renderOrder={4}
  >
    <T.RingGeometry args={[0.86, 1, 48]} />
  </T.Mesh>
  <T.Mesh
    position={[0, 0.08, thresholdZ]}
    rotation.x={-Math.PI / 2}
    material={thresholdMarker}
    renderOrder={4}
  >
    <T.PlaneGeometry args={[threshold.outerWidth, threshold.depth]} />
  </T.Mesh>
{/if}
