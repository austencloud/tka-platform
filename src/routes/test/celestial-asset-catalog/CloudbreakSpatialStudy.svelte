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

  import cloudbreakLayout from "../../../../scripts/seraphic-vault-cloudbreak-layout.json";

  interface Props {
    planMode?: boolean;
  }

  let { planMode = false }: Props = $props();

  const threshold = cloudbreakLayout.rearThreshold;
  const approach = cloudbreakLayout.approach;
  const pillarWidth = (threshold.outerWidth - threshold.openingWidth) / 2;
  const innerPierWidth = pillarWidth * 0.48;
  const innerPierX = threshold.openingWidth / 2 + innerPierWidth / 2;
  const lintelHeight = threshold.outerHeight - threshold.openingHeight;
  const thresholdZ = threshold.centerXZ[1];

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
  const pathWear = new MeshBasicMaterial({
    color: "#846544",
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: DoubleSide,
  });
  const pathCore = new MeshBasicMaterial({
    color: "#dfc28c",
    transparent: true,
    opacity: 0.24,
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
  const stageSurface = new MeshStandardMaterial({
    color: "#d8c098",
    roughness: 0.94,
    metalness: 0,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const stageEdge = new MeshStandardMaterial({
    color: "#a68a63",
    roughness: 0.98,
    metalness: 0,
  });

  function createPathGeometry(widthMultiplier = 1): ShapeGeometry {
    const sectionCount = 18;
    const left: Array<[number, number]> = [];
    const right: Array<[number, number]> = [];
    for (let index = 0; index <= sectionCount; index += 1) {
      const progress = index / sectionCount;
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

  const shoulderBlocks: Array<{
    id: string;
    x: number;
    y: number;
    z: number;
    size: [number, number, number];
    ry: number;
  }> = [
    {
      id: "left-mid-bridge",
      x: -14.8,
      y: 5.8,
      z: 50.7,
      size: [8.7, 11.6, 15.5],
      ry: -0.035,
    },
    {
      id: "right-mid-bridge",
      x: 15.2,
      y: 5.3,
      z: 51.1,
      size: [8.9, 10.6, 15.1],
      ry: 0.04,
    },
    {
      id: "left-outer-wing",
      x: -25.5,
      y: 7.2,
      z: 49.5,
      size: [10.5, 14.4, 18.5],
      ry: 0.08,
    },
    {
      id: "right-outer-wing",
      x: 25.8,
      y: 6.6,
      z: 50.2,
      size: [11, 13.2, 17.2],
      ry: -0.07,
    },
    {
      id: "left-high-shoulder",
      x: -18.8,
      y: 15.5,
      z: 54.5,
      size: [9.2, 21.5, 9.5],
      ry: -0.05,
    },
    {
      id: "right-high-shoulder",
      x: 19.3,
      y: 14.3,
      z: 55.1,
      size: [8.7, 19.4, 10.2],
      ry: 0.06,
    },
  ];

  onDestroy(() => {
    limestone.dispose();
    limestoneLight.dispose();
    pathWear.dispose();
    pathCore.dispose();
    passageShadow.dispose();
    scaleFigure.dispose();
    stageMarker.dispose();
    lagoonMarker.dispose();
    thresholdMarker.dispose();
    pathMarker.dispose();
    stageSurface.dispose();
    stageEdge.dispose();
    pathGeometry.dispose();
    pathCoreGeometry.dispose();
  });
</script>

<!-- The approved production shelf does not yet include the enlarged rear
     footprint, so this foundation keeps the sanctuary physically connected
     while the Gate 1 revision is under review. -->
<T.Mesh
  position={[0, -0.58, thresholdZ + 2]}
  material={limestone}
  receiveShadow
>
  <T.BoxGeometry args={[threshold.outerWidth + 17, 1.2, threshold.depth + 9]} />
</T.Mesh>

<!-- A shallow raised disc makes the dry performer zone readable as a stage
     without turning the landscape into a constructed theatre. -->
<T.Mesh position={[0, 0.11, -1]} material={stageEdge} castShadow receiveShadow>
  <T.CylinderGeometry args={[6.18, 6.48, 0.22, 64]} />
</T.Mesh>
<T.Mesh
  position={[0, 0.225, -1]}
  rotation.x={-Math.PI / 2}
  material={stageSurface}
  receiveShadow
>
  <T.CircleGeometry args={[6.08, 64]} />
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

<!-- The deep passage is large enough to feel like the front of an inhabited
     sanctuary, while remaining a spatial mass rather than a designed interior. -->
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

<!-- A dark stone ceiling turns the opening into a real passage instead of a
     facade cutout with sky leaking through its upper edge. -->
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

<!-- The fractured lintel and uneven shoulders keep the huge silhouette
     geological rather than reading as a palace, temple, or castle gate. -->
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

{#each shoulderBlocks as block (block.id)}
  <T.Mesh
    position={[block.x, block.y, block.z]}
    rotation.y={block.ry}
    material={limestone}
    castShadow
    receiveShadow
  >
    <T.BoxGeometry args={block.size} />
  </T.Mesh>
{/each}

<!-- Human scale reference: 1.75 metres from sole to crown. -->
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
