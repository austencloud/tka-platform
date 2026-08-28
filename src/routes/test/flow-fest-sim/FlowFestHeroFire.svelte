<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import type { PointLight } from "three";
  import VolumetricFireComponent from "$lib/shared/3d/effects/volumetric-fire/VolumetricFireComponent.svelte";
  import FallingParticles from "$lib/shared/3d/environments/primitives/FallingParticles.svelte";

  interface Props {
    position: { x: number; y: number; z: number };
    energy?: number;
  }

  const props: Props = $props();
  const logAngles = [0.08, Math.PI / 3 + 0.08, (Math.PI * 2) / 3 + 0.08];
  const coalOffsets = [
    [-0.48, -0.18, 0.82],
    [-0.18, 0.32, 0.66],
    [0.18, -0.34, 0.74],
    [0.46, 0.08, 0.9],
    [0.04, 0.04, 1.04],
    [-0.34, 0.16, 0.76],
    [0.34, 0.31, 0.68],
  ] as const;
  let elapsedSeconds = 0;
  let practical = $state<PointLight>();
  const fireHeight = $derived(2.72 + (props.energy ?? 0) * 1.08);

  useTask((delta) => {
    elapsedSeconds += Math.min(Math.max(delta, 0), 0.25);
    if (!practical) return;
    const energy = props.energy ?? 0;
    const flicker =
      Math.sin(elapsedSeconds * 7.1) * 1.1 +
      Math.sin(elapsedSeconds * 11.7 + 0.8) * 0.62 +
      Math.sin(elapsedSeconds * 19.3 + 2.2) * 0.28;
    practical.intensity = 16.5 + energy * 11 + flicker;
  });
</script>

<VolumetricFireComponent
  position={[
    props.position.x,
    props.position.y + fireHeight / 2 + 0.08,
    props.position.z,
  ]}
  width={1.82}
  height={fireHeight}
  depth={1.82}
  sliceSpacing={0.12}
/>

<T.Group position={[props.position.x, props.position.y, props.position.z]}>
  <T.Mesh
    position={[0, 0.055, 0]}
    rotation={[-Math.PI / 2, 0, 0]}
    receiveShadow
  >
    <T.CircleGeometry args={[1.28, 36]} />
    <T.MeshStandardMaterial
      color="#17120f"
      emissive="#421207"
      emissiveIntensity={0.42 + (props.energy ?? 0) * 0.34}
      roughness={1}
      metalness={0}
    />
  </T.Mesh>

  {#each logAngles as angle}
    <T.Group rotation={[0, angle, 0]}>
      <T.Mesh
        position={[0, 0.245, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
        receiveShadow
      >
        <T.CylinderGeometry args={[0.14, 0.18, 1.75, 10]} />
        <T.MeshStandardMaterial
          color="#25160f"
          roughness={0.98}
          metalness={0}
        />
      </T.Mesh>
      <T.Mesh position={[-0.878, 0.245, 0]} rotation={[0, 0, Math.PI / 2]}>
        <T.CircleGeometry args={[0.135, 10]} />
        <T.MeshStandardMaterial color="#5a3320" roughness={0.92} />
      </T.Mesh>
    </T.Group>
  {/each}

  {#each coalOffsets as [x, z, heat]}
    <T.Mesh position={[x, 0.15, z]} scale={[1, 0.58, 0.82]}>
      <T.DodecahedronGeometry args={[0.17, 0]} />
      <T.MeshStandardMaterial
        color="#2a1711"
        emissive="#ff3f12"
        emissiveIntensity={heat + (props.energy ?? 0) * 0.75}
        roughness={0.94}
      />
    </T.Mesh>
  {/each}

  <T.Group position={[0, 0.86, 0]}>
    <FallingParticles
      type="embers"
      count={34 + Math.round((props.energy ?? 0) * 18)}
      area={{ width: 1.7, height: 2.9, depth: 1.7 }}
      speed={0.46}
      colors={["#ffe08a", "#ff9738", "#ff5422"]}
      sizeRange={[0.03, 0.09]}
      spin={true}
    />
  </T.Group>
  <T.PointLight
    bind:ref={practical}
    position={[0, 1.65, 0]}
    color="#ff8b4c"
    intensity={16.5}
    distance={24 + (props.energy ?? 0) * 7}
    decay={2}
  />
</T.Group>
