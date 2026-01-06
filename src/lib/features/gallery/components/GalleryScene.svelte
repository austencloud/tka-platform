<script lang="ts">
  /**
   * GalleryScene
   *
   * The 3D scene containing the gallery environment, exhibits, and navigation.
   * Wraps all 3D content in a Threlte Canvas.
   */

  import { Canvas } from "@threlte/core";
  import type { GalleryState } from "../state/gallery-state.svelte";
  import type { IPropStateInterpolator } from "$lib/shared/3d-animation/services/contracts/IPropStateInterpolator";
  import type { ISequenceConverter } from "$lib/shared/3d-animation/services/contracts/ISequenceConverter";

  // Environment components
  import GalleryFloor from "./environment/GalleryFloor.svelte";
  import GalleryWall from "./environment/GalleryWall.svelte";
  import GalleryCeiling from "./environment/GalleryCeiling.svelte";
  import GalleryLighting from "./environment/GalleryLighting.svelte";

  // Exhibit components
  import FramedSequence from "./exhibits/FramedSequence.svelte";
  import AvatarExhibit from "./exhibits/AvatarExhibit.svelte";
  import ExhibitLabel from "./exhibits/ExhibitLabel.svelte";
  import AnimationScreen from "./exhibits/AnimationScreen.svelte";

  // Navigation
  import FirstPersonController from "./navigation/FirstPersonController.svelte";

  /** Service dependencies for avatar creation */
  export type AvatarServiceDeps = {
    propInterpolator: IPropStateInterpolator;
    sequenceConverter: ISequenceConverter;
  };

  interface Props {
    /** Gallery state */
    state: GalleryState;
    /** Service dependencies for avatar exhibits */
    avatarServiceDeps: AvatarServiceDeps | null;
  }

  let { state, avatarServiceDeps }: Props = $props();

  // Get slot for an exhibit
  function getSlotForExhibit(exhibitId: string) {
    if (!state.layout) return null;

    for (const wall of state.layout.walls) {
      const slot = wall.exhibitSlots.find((s) =>
        state.exhibits.some((e) => e.slotId === s.id && e.id === exhibitId)
      );
      if (slot) return slot;
    }
    return null;
  }
</script>

<Canvas>
  {#if state.layout}
    <!-- Navigation -->
    <FirstPersonController
      layout={state.layout}
      position={state.playerPosition}
      onPositionChange={(pos) => state.setPlayerPosition(pos)}
      enabled={true}
    />

    <!-- Floor -->
    <GalleryFloor
      width={state.layout.floorSize.width + 100}
      depth={state.layout.floorSize.depth + 100}
    />

    <!-- Ceiling (optional - comment out for open-air feel) -->
    <GalleryCeiling
      width={state.layout.floorSize.width + 100}
      depth={state.layout.floorSize.depth + 100}
      visible={true}
    />

    <!-- Walls -->
    {#each state.layout.walls as wall (wall.id)}
      <GalleryWall {wall} />
    {/each}

    <!-- Lighting -->
    <GalleryLighting exhibits={state.exhibits} />

    <!-- Exhibits -->
    {#each state.exhibits as exhibit (exhibit.id)}
      {@const slot = getSlotForExhibit(exhibit.id)}
      {#if slot}
        <!-- Framed image on wall -->
        <FramedSequence {exhibit} {slot} />

        <!-- Label below frame -->
        <ExhibitLabel {exhibit} {slot} />

        <!-- 2D Animation screen beside frame -->
        <AnimationScreen {exhibit} {slot} active={true} />

        <!-- Animated avatar beside frame (disabled for MVP) -->
        {#if exhibit.showAvatar && avatarServiceDeps}
          <AvatarExhibit
            {exhibit}
            playerPosition={{ x: state.playerPosition.x, z: state.playerPosition.z }}
            serviceDeps={avatarServiceDeps}
          />
        {/if}
      {/if}
    {/each}
  {/if}
</Canvas>

<style>
  :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
