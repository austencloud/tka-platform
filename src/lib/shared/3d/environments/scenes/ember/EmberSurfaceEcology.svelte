<script lang="ts">
  import { T } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy, untrack } from "svelte";
  import { Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
  import {
    createEmberSurfaceEcology,
    type EmberSurfacePlacement,
  } from "./ember-surface-ecology";
  import { createEmberSurfacePlateGeometry } from "./ember-surface-plate-geometry";

  interface Props {
    stageRadius?: number;
  }

  let { stageRadius = 3 }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);
  const ecology = $derived(createEmberSurfaceEcology(stageRadius));
  const families = ["cold", "iron", "glass"] as const;
  const colors = {
    cold: "#16191a",
    iron: "#3a1a12",
    glass: "#242b2e",
  } as const;
  const plateGeometry = untrack(() => createEmberSurfacePlateGeometry());

  onDestroy(() => plateGeometry.dispose());

  function placementsFor(
    placements: EmberSurfacePlacement[],
    family: (typeof families)[number]
  ): EmberSurfacePlacement[] {
    return placements.filter((placement) => placement.family === family);
  }

  function fill(
    mesh: InstancedMesh | null,
    placements: EmberSurfacePlacement[]
  ) {
    if (!mesh) return;
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const euler = new Euler();
    const scale = new Vector3();
    for (const [index, placement] of placements.entries()) {
      position.set(
        placement.position[0],
        groundY + placement.position[1],
        placement.position[2]
      );
      euler.set(...placement.rotation);
      rotation.setFromEuler(euler);
      scale.set(...placement.scale);
      matrix.compose(position, rotation, scale);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
</script>

{#key stageRadius}
  {#each families as family}
    {@const rubble = placementsFor(ecology.rubble, family)}
    {@const plates = placementsFor(ecology.plates, family)}
    {#if rubble.length > 0}
      <T.InstancedMesh
        args={[undefined, undefined, rubble.length]}
        receiveShadow
        oncreate={(mesh: InstancedMesh) => fill(mesh, rubble)}
      >
        <T.IcosahedronGeometry args={[1, 1]} />
        <T.MeshStandardMaterial
          color={colors[family]}
          roughness={family === "glass" ? 0.66 : 0.92}
          metalness={family === "glass" ? 0.14 : 0.02}
          flatShading
        />
      </T.InstancedMesh>
    {/if}
    {#if plates.length > 0}
      <T.InstancedMesh
        args={[undefined, undefined, plates.length]}
        geometry={plateGeometry}
        receiveShadow
        oncreate={(mesh: InstancedMesh) => fill(mesh, plates)}
      >
        <T.MeshStandardMaterial
          color={colors[family]}
          emissive={family === "iron" ? "#2a0904" : "#050708"}
          emissiveIntensity={family === "iron" ? 0.1 : 0.025}
          roughness={family === "glass" ? 0.62 : 0.9}
          metalness={family === "glass" ? 0.18 : 0.02}
          flatShading
        />
      </T.InstancedMesh>
    {/if}
  {/each}
{/key}
