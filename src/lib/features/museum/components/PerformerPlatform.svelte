<script lang="ts">
  import { T } from "@threlte/core";
  import * as THREE from "three";
  import type { ExhibitSlot } from "../domain/museum-types";

  interface Props {
    slot: ExhibitSlot;
    isPopulated: boolean;
    playerPosition: { x: number; y: number; z: number };
  }

  let { slot, isPopulated, playerPosition }: Props = $props();

  const ACTIVATION_DISTANCE = 15; // meters
  const platformColor = new THREE.Color(0x6b5b4f); // dark stone

  const isActive = $derived.by(() => {
    const dx = playerPosition.x - slot.position.x;
    const dz = playerPosition.z - slot.position.z;
    return Math.sqrt(dx * dx + dz * dz) < ACTIVATION_DISTANCE;
  });
</script>

{#if slot.type === "performer"}
  <!-- Circular platform -->
  <T.Mesh
    position.x={slot.position.x}
    position.y={slot.position.y + 0.15}
    position.z={slot.position.z}
    receiveShadow
  >
    <T.CylinderGeometry args={[1.0, 1.1, 0.3, 32]} />
    <T.MeshStandardMaterial color={platformColor} roughness={0.85} />
  </T.Mesh>

  <!-- Avatar placeholder — replaced with Avatar3D in Task 14 -->
  {#if isPopulated && isActive}
    <T.Mesh
      position.x={slot.position.x}
      position.y={slot.position.y + 1.2}
      position.z={slot.position.z}
    >
      <T.CapsuleGeometry args={[0.25, 0.9, 8, 16]} />
      <T.MeshStandardMaterial color={0xa78bfa} opacity={0.6} transparent />
    </T.Mesh>
  {/if}
{/if}
