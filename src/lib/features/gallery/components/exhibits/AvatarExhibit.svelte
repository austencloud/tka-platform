<script lang="ts">
  /**
   * AvatarExhibit
   *
   * An animated 3D avatar performing a sequence next to a framed exhibit.
   * Uses the existing Avatar3D and AvatarInstanceState from the 3d-animation module.
   */

  import { onDestroy } from "svelte";
  import Avatar3D from "$lib/shared/3d-animation/components/Avatar3D.svelte";
  import {
    createAvatarInstanceState,
    type AvatarInstanceDeps,
  } from "$lib/shared/3d-animation/state/avatar-instance-state.svelte";
  import type { Exhibit } from "../../domain/models/Exhibit";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import {
    AVATAR_ACTIVATION_DISTANCE,
  } from "../../domain/constants/gallery-dimensions";

  interface Props {
    /** The exhibit containing the sequence to perform */
    exhibit: Exhibit;
    /** Player position for LOD calculations */
    playerPosition: { x: number; z: number };
    /** Service dependencies for avatar state creation */
    serviceDeps: AvatarInstanceDeps;
    /** Whether this avatar should be active regardless of distance */
    forceActive?: boolean;
  }

  let { exhibit, playerPosition, serviceDeps, forceActive = false }: Props =
    $props();

  // Create dedicated state for this avatar with proper config and deps
  const avatarState = createAvatarInstanceState(
    {
      id: `gallery-exhibit-${exhibit.id}`,
      positionX: exhibit.avatarPosition.x,
      positionZ: exhibit.avatarPosition.z,
    },
    serviceDeps
  );

  // Calculate distance from player for LOD
  const distanceToPlayer = $derived.by(() => {
    const dx = exhibit.avatarPosition.x - playerPosition.x;
    const dz = exhibit.avatarPosition.z - playerPosition.z;
    return Math.sqrt(dx * dx + dz * dz);
  });

  // LOD: Only active when player is close enough
  const shouldBeActive = $derived(
    forceActive || distanceToPlayer < AVATAR_ACTIVATION_DISTANCE
  );

  // Track if we've loaded the sequence
  let sequenceLoaded = $state(false);

  // Load sequence into avatar state when becoming active
  $effect(() => {
    if (shouldBeActive && !sequenceLoaded) {
      const sequence = exhibit.sequence as SequenceData;
      if (sequence?.beats?.length > 0) {
        avatarState.loadSequence(sequence);
        avatarState.loop = true;
        avatarState.play();
        sequenceLoaded = true;
      }
    } else if (!shouldBeActive && sequenceLoaded) {
      // Deactivate when player moves away
      avatarState.pause();
      sequenceLoaded = false;
    }
  });

  // Cleanup on unmount
  onDestroy(() => {
    avatarState.destroy();
  });
</script>

{#if shouldBeActive}
  <Avatar3D
    bluePropState={avatarState.bluePropState}
    redPropState={avatarState.redPropState}
    position={{
      x: exhibit.avatarPosition.x,
      y: exhibit.avatarPosition.y,
      z: exhibit.avatarPosition.z,
    }}
    facingAngle={exhibit.avatarFacing}
    isMoving={false}
  />
{/if}
