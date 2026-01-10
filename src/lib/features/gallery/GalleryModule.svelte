<script lang="ts">
  /**
   * GalleryModule
   *
   * Main entry point for the 3D virtual gallery experience.
   * Walk through a museum displaying your sequences as art.
   * Supports multiplayer sessions where users can explore together.
   */

  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IPropStateInterpolator } from "$lib/shared/3d-animation/services/contracts/IPropStateInterpolator";
  import type { ISequenceConverter } from "$lib/shared/3d-animation/services/contracts/ISequenceConverter";
  import { createGalleryState } from "./state/gallery-state.svelte";
  import { createGallerySettings } from "./state/gallery-settings.svelte";
  import { createMultiplayerState, type MultiplayerStateInstance } from "./multiplayer/state/multiplayer-state.svelte";
  import GalleryScene from "./components/GalleryScene.svelte";
  import GalleryHUD from "./components/GalleryHUD.svelte";

  // Create gallery state and settings
  const galleryState = createGalleryState();
  const gallerySettings = createGallerySettings();

  // Multiplayer state (initialized after services are resolved)
  // The outer variable needs $state for reactivity when assigned; inner object has its own reactive getters
  let multiplayerState = $state<MultiplayerStateInstance | null>(null);

  // Current rotation and locomotion for position syncing
  let currentRotation = $state({ yaw: 0, pitch: 0 });
  let currentLocomotion = $state({ isMoving: false, moveDirection: 0, moveSpeed: 0 });

  // Track pointer lock for HUD
  let isNavigating = $state(false);

  // 3D avatar services (loaded async)
  let avatarServiceDeps = $state<{
    propInterpolator: IPropStateInterpolator;
    sequenceConverter: ISequenceConverter;
  } | null>(null);

  // Initialize gallery on mount
  onMount(async () => {
    galleryState.setLoading(true);

    try {
      // Get 3D animation services from ITI container
      const propInterpolator = container.items.propStateInterpolator;
      const sequenceConverter = container.items.sequenceConverter;
      avatarServiceDeps = { propInterpolator, sequenceConverter };

      // Get gallery services from ITI container
      const layoutGenerator = container.items.galleryLayoutGenerator;
      const exhibitLoader = container.items.exhibitLoader;

      // Get multiplayer services from ITI container
      const sessionManager = container.items.gallerySessionManager;
      const positionSyncer = container.items.galleryPositionSyncer;

      // Initialize multiplayer state
      multiplayerState = createMultiplayerState(sessionManager, positionSyncer);

      // Generate fixed grand museum layout
      const layout = layoutGenerator.generate({
        exhibitCount: 100, // Layout is fixed size, this is ignored
        layoutType: "mansion",
      });
      galleryState.setLayout(layout);

      // Load MANY exhibits to fill the grand gallery
      const exhibits = await exhibitLoader.loadExhibits(layout, {
        source: "user_library",
        limit: 100, // Load up to 100 sequences
      });
      galleryState.setExhibits(exhibits);

      galleryState.setLoading(false);
    } catch (error) {
      console.error("[GalleryModule] Failed to initialize:", error);
      galleryState.setError(
        error instanceof Error ? error.message : "Failed to load gallery"
      );
      galleryState.setLoading(false);
    }
  });

  // Track pointer lock state
  function handlePointerLockChange() {
    isNavigating = document.pointerLockElement !== null;
  }

  // Handle keyboard shortcuts
  function handleKeyDown(e: KeyboardEvent) {
    // Toggle light/dark mode with 'T' key (L is taken by global dark mode toggle)
    if (e.key.toLowerCase() === "t") {
      galleryState.toggleLights();
    }
    // Toggle chat with 'C' key
    if (e.key.toLowerCase() === "c" && multiplayerState?.isInSession) {
      multiplayerState.toggleChat();
    }
    // Toggle minimap with 'M' key
    if (e.key.toLowerCase() === "m" && multiplayerState?.isInSession) {
      multiplayerState.toggleMinimap();
    }
  }

  // ---------------------------------------------------------------------------
  // Multiplayer Callbacks
  // ---------------------------------------------------------------------------

  function handleRotationChange(rotation: { yaw: number; pitch: number }) {
    currentRotation = rotation;
    syncPositionToMultiplayer();
  }

  function handleLocomotionChange(locomotion: { isMoving: boolean; moveDirection: number; moveSpeed: number }) {
    currentLocomotion = locomotion;
    syncPositionToMultiplayer();
  }

  function syncPositionToMultiplayer() {
    if (!multiplayerState?.isInSession) return;

    multiplayerState.updateLocalPosition({
      position: {
        x: galleryState.playerPosition.x,
        y: galleryState.playerPosition.y,
        z: galleryState.playerPosition.z
      },
      rotation: currentRotation,
      locomotion: currentLocomotion,
      focusedExhibitId: galleryState.focusedExhibitId
    });
  }

  // Sync position whenever player moves
  $effect(() => {
    if (multiplayerState?.isInSession) {
      syncPositionToMultiplayer();
    }
  });

  // Session management callbacks for HUD
  async function handleCreateSession(name: string, visibility: 'public' | 'private' | 'friends') {
    if (!multiplayerState) return;
    try {
      await multiplayerState.createSession({
        name,
        visibility,
        layoutId: 'mansion'
      });
    } catch (error) {
      console.error('[GalleryModule] Failed to create session:', error);
      galleryState.setError('Failed to create multiplayer session');
    }
  }

  async function handleJoinSession(sessionId: string) {
    if (!multiplayerState) return;
    try {
      const success = await multiplayerState.joinSession(sessionId);
      if (!success) {
        galleryState.setError('Failed to join session - it may be full or no longer available');
      }
    } catch (error) {
      console.error('[GalleryModule] Failed to join session:', error);
      galleryState.setError('Failed to join multiplayer session');
    }
  }

  async function handleLeaveSession() {
    if (!multiplayerState) return;
    try {
      await multiplayerState.leaveSession();
    } catch (error) {
      console.error('[GalleryModule] Failed to leave session:', error);
    }
  }

  async function handleSendMessage(text: string) {
    if (!multiplayerState) return;
    try {
      await multiplayerState.sendMessage(text);
    } catch (error) {
      console.error('[GalleryModule] Failed to send message:', error);
    }
  }

  // Store original body overflow to restore on cleanup
  let originalBodyOverflow = "";

  onMount(() => {
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("keydown", handleKeyDown);

    // Lock body scroll while gallery is active
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  });

  onDestroy(() => {
    document.removeEventListener("pointerlockchange", handlePointerLockChange);
    document.removeEventListener("keydown", handleKeyDown);

    // Restore original body overflow
    document.body.style.overflow = originalBodyOverflow;

    // Cleanup multiplayer state
    if (multiplayerState) {
      multiplayerState.cleanup();
    }

    galleryState.reset();
  });
</script>

<div class="gallery-module">
  <GalleryScene
    {galleryState}
    {gallerySettings}
    {avatarServiceDeps}
    {multiplayerState}
    onRotationChange={handleRotationChange}
    onLocomotionChange={handleLocomotionChange}
    museumModelPath="/models/art-gallery.glb"
  />
  <GalleryHUD
    {galleryState}
    {gallerySettings}
    {isNavigating}
    {multiplayerState}
    onCreateSession={handleCreateSession}
    onJoinSession={handleJoinSession}
    onLeaveSession={handleLeaveSession}
    onSendMessage={handleSendMessage}
  />
</div>

<style>
  .gallery-module {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
  }
</style>
