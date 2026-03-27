<script lang="ts">
  /**
   * GalleryModule
   *
   * Main entry point for the 3D virtual gallery experience.
   * Walk through a museum displaying your sequences as art.
   * Uses a model-based approach - loads a GLB museum model.
   */

  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import { createGalleryState } from "./state/gallery-state.svelte";
  import { createGallerySettings } from "./state/gallery-settings.svelte";
  import { createMultiplayerState, type MultiplayerStateInstance } from "./multiplayer/state/multiplayer-state.svelte";
  import GalleryScene from "./components/GalleryScene.svelte";
  import GalleryHUD from "./components/GalleryHUD.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // Museum model path
  const MUSEUM_MODEL_PATH = "/models/art-gallery.glb";

  // Create gallery state and settings
  const galleryState = createGalleryState();
  const gallerySettings = createGallerySettings();

  // Multiplayer state
  let multiplayerState = $state<MultiplayerStateInstance | null>(null);

  // Current rotation and locomotion for position syncing
  let currentRotation = $state({ yaw: 0, pitch: 0 });
  let currentLocomotion = $state({ isMoving: false, moveDirection: 0, moveSpeed: 0 });

  // Track pointer lock for HUD
  let isNavigating = $state(false);

  // Initialize gallery on mount
  onMount(async () => {
    galleryState.setLoading(true);

    try {
      // Get gallery services from ITI container
      const exhibitLoader = container.items.exhibitLoader;

      // Get multiplayer services from ITI container
      const sessionManager = container.items.gallerySessionManager;
      const positionSyncer = container.items.galleryPositionSyncer;

      // Initialize multiplayer state
      multiplayerState = createMultiplayerState(sessionManager, positionSyncer);

      // Create a minimal layout for model-based galleries
      // The model itself provides the visual environment, we just need exhibit data
      galleryState.setLayout({
        id: "model-gallery",
        name: "Art Gallery",
        modelPath: MUSEUM_MODEL_PATH,
        exhibitSlots: [], // Will be populated by Museum3D via setModelSlots
        spawnPoint: { x: 0, y: 1.7, z: 5 },
        floorSize: { width: 20, depth: 20 }, // 20x20 meters
      });

      // Load exhibits from user's library
      // For model-based galleries, we load sequences and assign them to model slots
      const exhibits = await exhibitLoader.loadExhibitsForModel({
        source: "user_library",
        limit: 50,
      });
      galleryState.setExhibits(exhibits);

      galleryState.setLoading(false);
    } catch (error) {
      console.error("[GalleryModule] Failed to initialize:", error);
      galleryState.setError(
        error instanceof Error ? error.message : t("gallery_error_load_failed")
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
    // Toggle light/dark mode with 'T' key
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
        layoutId: 'model-gallery'
      });
    } catch (error) {
      console.error('[GalleryModule] Failed to create session:', error);
      galleryState.setError(t("gallery_error_create_session"));
    }
  }

  async function handleJoinSession(sessionId: string) {
    if (!multiplayerState) return;
    try {
      const success = await multiplayerState.joinSession(sessionId);
      if (!success) {
        galleryState.setError(t("gallery_error_join_session"));
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
    {multiplayerState}
    onRotationChange={handleRotationChange}
    onLocomotionChange={handleLocomotionChange}
    museumModelPath={MUSEUM_MODEL_PATH}
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
