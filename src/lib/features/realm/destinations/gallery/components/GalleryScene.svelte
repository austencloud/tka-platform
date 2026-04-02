<script lang="ts">
  /**
   * GalleryScene
   *
   * The 3D scene containing the gallery environment and exhibits.
   * Uses model-based rendering - loads a GLB model and extracts exhibit slots.
   */

  import { T } from "@threlte/core";
  import GalleryCanvas from "./GalleryCanvas.svelte";
  import type { GalleryState } from "../state/gallery-state.svelte";
  import type { GallerySettingsInstance } from "../state/gallery-settings.svelte";
  import type { MultiplayerStateInstance } from "../multiplayer/state/multiplayer-state.svelte";

  // Environment components
  import Museum3D from "./environment/Museum3D.svelte";

  // Exhibit components
  import FramedSequence from "./exhibits/FramedSequence.svelte";
  import ExhibitLabel from "./exhibits/ExhibitLabel.svelte";

  // Unified camera system (replaces ModelFirstPerson)
  import UnifiedCameraController from "$lib/shared/3d/camera/UnifiedCameraController.svelte";
  import { CameraMode } from "$lib/shared/3d/camera/types";
  import { createGalleryAvatarState } from "../state/gallery-avatar-state.svelte";

  // Avatar for visual representation
  import Avatar3D from "$lib/shared/3d/components/Avatar3D.svelte";
  import Grid3D from "$lib/shared/3d/components/Grid3D.svelte";
  import { Plane } from "$lib/shared/3d/domain/enums/Plane";

  // Multiplayer
  import RemotePlayerManager from "../multiplayer/components/RemotePlayerManager.svelte";

  interface Props {
    /** Gallery state */
    galleryState: GalleryState;
    /** Gallery settings for rendering options */
    gallerySettings: GallerySettingsInstance;
    /** Multiplayer state (optional - when in a session) */
    multiplayerState?: MultiplayerStateInstance | null;
    /** Callback when player rotation changes */
    onRotationChange?: (rotation: { yaw: number; pitch: number }) => void;
    /** Callback when player locomotion changes */
    onLocomotionChange?: (locomotion: { isMoving: boolean; moveDirection: number; moveSpeed: number }) => void;
    /** Path to museum 3D model */
    museumModelPath: string;
  }

  let {
    galleryState,
    gallerySettings,
    multiplayerState = null,
    onRotationChange,
    onLocomotionChange,
    museumModelPath,
  }: Props = $props();

  // Access multiplayer properties
  function getRemotePlayers() { return multiplayerState?.remotePlayers ?? []; }
  function getIsInSession() { return multiplayerState?.isInSession ?? false; }

  // Create avatar state adapter for unified camera (reactive to galleryState identity)
  const avatarState = $derived(createGalleryAvatarState(galleryState));

  // Track camera mode for avatar visibility (hide in first person)
  let cameraMode = $state<CameraMode>(CameraMode.FIRST_PERSON);
  const showAvatar = $derived(cameraMode !== CameraMode.FIRST_PERSON);

  // Grid plane set - show floor plane for reference in gallery
  const floorPlaneSet = new Set([Plane.FLOOR]);
</script>

<div class="scene-container">
  <GalleryCanvas
    renderingBackend={gallerySettings.renderingBackend}
    autoRender={true}
    toneMapping={undefined}
  >
    <!-- Unified camera controller (orbit, third-person, first-person) -->
    <UnifiedCameraController
      destinationId="gallery"
      {avatarState}
      enabled={true}
      onModeChange={(mode) => (cameraMode = mode)}
    />

    <!-- Player avatar (hidden in first-person mode) -->
    {#if showAvatar}
      <Avatar3D
        id="gallery-player"
        bluePropState={null}
        redPropState={null}
        visible={true}
        position={{
          x: galleryState.playerPosition.x,
          y: 0,
          z: galleryState.playerPosition.z
        }}
        facingAngle={avatarState.facingAngle}
        isMoving={avatarState.isMoving}
        moveDirection={avatarState.moveDirection ?? { x: 0, z: 1 }}
      />

      <!-- Grid plane for reference -->
      <Grid3D
        centerPosition={{
          x: galleryState.playerPosition.x,
          y: 0,
          z: galleryState.playerPosition.z
        }}
        facingAngle={avatarState.facingAngle}
        visiblePlanes={floorPlaneSet}
      />
    {/if}

    <!-- Lighting -->
    <T.AmbientLight intensity={0.6} />
    <T.DirectionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
    <T.DirectionalLight position={[-5, 10, -5]} intensity={0.3} />

    <!-- Load the museum model -->
    <Museum3D
      modelPath={museumModelPath}
      onSlotsLoaded={(slots) => galleryState.setModelSlots(slots)}
    />

    <!-- Exhibits in extracted slots -->
    {#each galleryState.exhibits as exhibit (exhibit.id)}
      {@const slot = galleryState.layout?.exhibitSlots.find(s => s.id === exhibit.slotId)}
      {#if slot}
        <FramedSequence {exhibit} {slot} lightsOn={galleryState.lightsOn} />
        <ExhibitLabel {exhibit} {slot} />
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
  </GalleryCanvas>
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
