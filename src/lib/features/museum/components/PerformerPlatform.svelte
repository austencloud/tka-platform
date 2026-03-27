<script lang="ts">
  import { T } from "@threlte/core";
  import * as THREE from "three";
  import type { ExhibitSlot } from "../domain/museum-types";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import Avatar3D from "$lib/shared/3d/components/Avatar3D.svelte";
  import Staff3D from "$lib/shared/3d/components/Staff3D.svelte";
  import { createAvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import { container } from "$lib/shared/di";

  interface Props {
    slot: ExhibitSlot;
    isPopulated: boolean;
    playerPosition: { x: number; y: number; z: number };
    sequence?: SequenceData | null;
  }

  let { slot, isPopulated, playerPosition, sequence = null }: Props = $props();

  const ACTIVATION_DISTANCE = 15; // meters
  const platformColor = new THREE.Color(0x6b5b4f); // dark stone

  const isActive = $derived.by(() => {
    const dx = playerPosition.x - slot.position.x;
    const dz = playerPosition.z - slot.position.z;
    return Math.sqrt(dx * dx + dz * dz) < ACTIVATION_DISTANCE;
  });

  // Create performer animation state (slot identity is stable per instance)
  const performerState = $derived.by(() =>
    createAvatarInstanceState(
      {
        id: `museum-performer-${slot.id}`,
        positionX: slot.position.x,
        positionZ: slot.position.z,
      },
      {
        propInterpolator: container.items.propStateInterpolator,
        sequenceConverter: container.items.sequenceConverter,
      }
    )
  );

  // Load sequence when it becomes available
  $effect(() => {
    if (sequence) {
      performerState.loadSequence(sequence);
      performerState.loop = true;
      performerState.play();
    }
  });

  // Cleanup on destroy
  $effect(() => {
    return () => performerState.destroy();
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

  <!-- Avatar performer — renders when populated, nearby, and sequence loaded -->
  {#if isPopulated && isActive && sequence}
    <Avatar3D
      id={`museum-${slot.id}`}
      bluePropState={performerState.bluePropState}
      redPropState={performerState.redPropState}
      position={{ x: slot.position.x, y: slot.position.y + 0.3, z: slot.position.z }}
      facingAngle={slot.rotationY}
      isActive={false}
      isMoving={false}
    />

    {#if performerState.bluePropState}
      <Staff3D
        propState={performerState.bluePropState}
        color="blue"
        avatarPosition={{ x: slot.position.x, y: slot.position.y + 0.3, z: slot.position.z }}
        facingAngle={slot.rotationY}
        gridOffset={-0.5}
        isActivePlayer={false}
      />
    {/if}
    {#if performerState.redPropState}
      <Staff3D
        propState={performerState.redPropState}
        color="red"
        avatarPosition={{ x: slot.position.x, y: slot.position.y + 0.3, z: slot.position.z }}
        facingAngle={slot.rotationY}
        gridOffset={-0.5}
        isActivePlayer={false}
      />
    {/if}
  {:else if isPopulated && isActive}
    <!-- Capsule placeholder when sequence data not yet loaded -->
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
