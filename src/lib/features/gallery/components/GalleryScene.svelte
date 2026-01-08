<script lang="ts">
  /**
   * GalleryScene
   *
   * The 3D scene containing the gallery environment, exhibits, and navigation.
   * Wraps all 3D content in a Threlte Canvas.
   * Includes multiplayer support for rendering remote players.
   */

  import { Canvas } from "@threlte/core";
  import type { GalleryState } from "../state/gallery-state.svelte";
  import type { MultiplayerStateInstance } from "../multiplayer/state/multiplayer-state.svelte";
  import type { IPropStateInterpolator } from "$lib/shared/3d-animation/services/contracts/IPropStateInterpolator";
  import type { ISequenceConverter } from "$lib/shared/3d-animation/services/contracts/ISequenceConverter";

  // Environment components
  import GalleryWall from "./environment/GalleryWall.svelte";
  import GalleryLighting from "./environment/GalleryLighting.svelte";
  import GalleryTorches from "./environment/GalleryTorches.svelte";
  import Museum3D from "./environment/Museum3D.svelte";

  // Room-based floor and ceiling rendering (procedural - used when no model loaded)
  import RoomFloorRenderer from "./environment/floors/RoomFloorRenderer.svelte";
  import RoomCeilingRenderer from "./environment/ceilings/RoomCeilingRenderer.svelte";

  // Exhibit components
  import FramedSequence from "./exhibits/FramedSequence.svelte";
  import AvatarExhibit from "./exhibits/AvatarExhibit.svelte";
  import ExhibitLabel from "./exhibits/ExhibitLabel.svelte";
  import AnimationScreen from "./exhibits/AnimationScreen.svelte";

  // Navigation
  import FirstPersonController from "./navigation/FirstPersonController.svelte";

  // Multiplayer
  import RemotePlayerManager from "../multiplayer/components/RemotePlayerManager.svelte";

  /** Service dependencies for avatar creation */
  export type AvatarServiceDeps = {
    propInterpolator: IPropStateInterpolator;
    sequenceConverter: ISequenceConverter;
  };

  interface Props {
    /** Gallery state - named galleryState to avoid Svelte compiler treating 'state' as a store */
    galleryState: GalleryState;
    /** Service dependencies for avatar exhibits */
    avatarServiceDeps: AvatarServiceDeps | null;
    /** Multiplayer state (optional - when in a session) */
    multiplayerState?: MultiplayerStateInstance | null;
    /** Callback when player rotation changes */
    onRotationChange?: (rotation: { yaw: number; pitch: number }) => void;
    /** Callback when player locomotion changes */
    onLocomotionChange?: (locomotion: { isMoving: boolean; moveDirection: number; moveSpeed: number }) => void;
    /** Path to museum 3D model (optional - enables model-based rendering) */
    museumModelPath?: string;
  }

  let {
    galleryState,
    avatarServiceDeps,
    multiplayerState = null,
    onRotationChange,
    onLocomotionChange,
    museumModelPath,
  }: Props = $props();

  // Access multiplayer properties directly (they're already reactive getters)
  // Using functions to avoid Svelte 5 $derived issues with nullable props
  function getRemotePlayers() { return multiplayerState?.remotePlayers ?? []; }
  function getIsInSession() { return multiplayerState?.isInSession ?? false; }

  // Get slot for an exhibit
  function getSlotForExhibit(exhibitId: string) {
    if (!galleryState.layout) return null;

    for (const wall of galleryState.layout.walls) {
      const slot = wall.exhibitSlots.find((s) =>
        galleryState.exhibits.some((e) => e.slotId === s.id && e.id === exhibitId)
      );
      if (slot) return slot;
    }
    return null;
  }

  // Check if exhibit is nearby (for proximity-based activation)
  function isExhibitNearby(exhibitId: string): boolean {
    return galleryState.nearbyExhibits.some((e) => e.id === exhibitId);
  }
</script>

<div class="scene-container">
  <Canvas>
    {#if galleryState.layout && galleryState.currentRoomId}
    <!-- Navigation with wall collision -->
    <FirstPersonController
      layout={galleryState.layout}
      position={galleryState.playerPosition}
      currentRoomId={galleryState.currentRoomId}
      onPositionChange={(pos) => galleryState.setPlayerPosition(pos)}
      onRoomChange={(roomId) => galleryState.setCurrentRoomId(roomId)}
      {onRotationChange}
      {onLocomotionChange}
      enabled={true}
    />

    <!-- Environment: Either model-based (Blender) or procedural -->
    {#if museumModelPath}
      <!-- Model-based rendering: Load hand-crafted museum from glTF -->
      <Museum3D
        modelPath={museumModelPath}
        onSlotsLoaded={(slots) => galleryState.setModelSlots(slots)}
      />
    {:else}
      <!-- Procedural rendering: Generated walls, floors, ceilings -->
      <!-- Room-based floors (marble for rotunda, wood for wings) + corridor floors -->
      <RoomFloorRenderer
        rooms={galleryState.layout.rooms}
        corridors={galleryState.layout.corridors}
      />

      <!-- Room-based ceilings (dome for rotunda, coffered for wings) -->
      <RoomCeilingRenderer rooms={galleryState.layout.rooms} />

      <!-- Walls -->
      {#each galleryState.layout.walls as wall (wall.id)}
        <GalleryWall {wall} />
      {/each}
    {/if}

    <!-- Lighting (ambient + spotlights) -->
    <GalleryLighting exhibits={galleryState.exhibits} lightsOn={galleryState.lightsOn} />

    <!-- Torches (wall-mounted with fire effects) - always visible -->
    <GalleryTorches layout={galleryState.layout} enabled={true} intensity={galleryState.lightsOn ? 0.8 : 0.6} />

    <!-- Exhibits -->
    {#each galleryState.exhibits as exhibit (exhibit.id)}
      {@const slot = getSlotForExhibit(exhibit.id)}
      {#if slot}
        <!-- Framed image on wall -->
        <FramedSequence {exhibit} {slot} lightsOn={galleryState.lightsOn} />

        <!-- Label below frame -->
        <ExhibitLabel {exhibit} {slot} />

        <!-- 2D Animation screen beside frame (proximity activated) -->
        <AnimationScreen {exhibit} {slot} active={isExhibitNearby(exhibit.id)} />

        <!-- Animated avatar beside frame (disabled for MVP) -->
        {#if exhibit.showAvatar && avatarServiceDeps}
          <AvatarExhibit
            {exhibit}
            playerPosition={{ x: galleryState.playerPosition.x, z: galleryState.playerPosition.z }}
            serviceDeps={avatarServiceDeps}
          />
        {/if}
      {/if}
    {/each}

    <!-- Remote players (multiplayer mode) -->
    {#if multiplayerState && getIsInSession() && getRemotePlayers().length > 0}
      <RemotePlayerManager
        remotePlayers={getRemotePlayers()}
        localPosition={{
          x: galleryState.playerPosition.x,
          y: galleryState.playerPosition.y,
          z: galleryState.playerPosition.z
        }}
      />
    {/if}
  {/if}
  </Canvas>
</div>

<style>
  .scene-container {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .scene-container :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
