<script lang="ts">
  /**
   * Viewer3DModule
   *
   * Main 3D animation viewer module. Load sequences from the library
   * and browse them in 3D space with camera controls.
   *
   * Admin-only (Level 8 feature).
   */

  import { onMount, onDestroy } from "svelte";
  import Scene3D from "./components/Scene3D.svelte";
  import Staff3D from "./components/Staff3D.svelte";
  import Avatar3D from "./components/Avatar3D.svelte";
  import AvatarLabel3D from "./components/AvatarLabel3D.svelte";
  import DraggablePerformer from "./components/DraggablePerformer.svelte";
  import SceneOverlayControls from "./components/panels/SceneOverlayControls.svelte";
  import Animation3DSidePanel from "./components/panels/Animation3DSidePanel.svelte";
  import Keyboard3DCoordinator from "./keyboard/Keyboard3DCoordinator.svelte";
  import type { CameraPreset } from "./components/controls/CameraPresetBar.svelte";
  import { Plane } from "./domain/enums/Plane";
  import type { GridMode } from "./domain/constants/grid-layout";
  import { WALL_OFFSET } from "./domain/constants/performer-positions";
  import PerformerManagerUI from "./components/panels/PerformerManager.svelte";
  import AvatarSyncControls from "./components/panels/AvatarSyncControls.svelte";
  import DuetOrchestrator from "./components/DuetOrchestrator.svelte";
  import {
    createPerformerManager,
    type PerformerManager,
  } from "./state/performer-manager.svelte";
  import ShortcutsHelp from "$lib/shared/keyboard/components/ShortcutsHelp.svelte";
  import { keyboardShortcutState } from "$lib/shared/keyboard/state/keyboard-shortcut-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  // Unified camera system (handles orbit, third-person, first-person)
  import UnifiedCameraController from "$lib/shared/3d/camera/UnifiedCameraController.svelte";
  import { CameraMode, isGameMode, type PhysicsProvider } from "$lib/shared/3d/camera/types";
  import { cameraPreferences } from "$lib/shared/3d/camera/camera-preferences.svelte";

  // Physics system (Stage now uses meters + Rapier for unified collision with Infinite Worlds)
  import type { PhysicsWorldState, PlayerControllerState } from "$lib/shared/3d/physics/types";
  import { SCALE } from "$lib/shared/3d/scale/scale-constants";

  // Effects system
  import EffectsLayer from "./effects/EffectsLayer.svelte";
  import { getEffectsConfigState } from "./effects/state/effects-config-state.svelte";

  // First-person viewmodel
  import ViewmodelStaffs from "./viewmodel/ViewmodelStaffs.svelte";

  // Camera choreography
  import { createCameraChoreographyState } from "./state/camera-choreography-state.svelte";
  import CameraChoreographyControls from "./components/controls/CameraChoreographyControls.svelte";

  // CameraState type (matches Scene3D.svelte's internal definition)
  interface CameraState {
    position: [number, number, number];
    target: [number, number, number];
  }
  import { container } from "$lib/shared/di";
  import type { IPropStateInterpolator } from "./services/contracts/IPropStateInterpolator";
  import type { ISequenceConverter } from "./services/contracts/ISequenceConverter";
  import type { IAnimation3DPersister } from "./services/contracts/IAnimation3DPersister";
  import { browser } from "$app/environment";
  import {
    DEFAULT_AVATAR_ID,
    type AvatarId,
  } from "./config/avatar-definitions";

  // Synchronously read avatar ID from localStorage to prevent flash
  function getInitialAvatarId(): AvatarId {
    if (!browser) return DEFAULT_AVATAR_ID;
    try {
      const stored = localStorage.getItem("tka-3d-animator-state");
      if (!stored) return DEFAULT_AVATAR_ID;
      const parsed = JSON.parse(stored);
      return parsed.avatarId ?? DEFAULT_AVATAR_ID;
    } catch {
      return DEFAULT_AVATAR_ID;
    }
  }

  const initialAvatarId = getInitialAvatarId();

  // Services - initialized asynchronously
  let persistenceService: IAnimation3DPersister | null = $state(null);
  let servicesReady = $state(false);

  // Timers for cleanup
  let initTimer: ReturnType<typeof setTimeout> | null = null;

  // Physics state (Rapier)
  let physicsState: PhysicsWorldState | null = $state(null);
  let playerController: PlayerControllerState | null = $state(null);
  let physicsProvider: PhysicsProvider | null = $state(null);

  // Camera rotation state (synced from UnifiedCameraController for MCP bridge)
  let cameraYaw = $state(0);
  let cameraPitch = $state(0.3);
  let externalYaw: number | null = $state(null);
  let externalPitch: number | null = $state(null);

  // Performer management (extracted to dedicated state factory)
  let performerManager = $state<PerformerManager | null>(null);

  // Derived: shorthand accessors from performer manager
  const performerStates = $derived.by(() => {
    return performerManager ? performerManager.performers : [];
  });
  const activePerformerIndex = $derived.by(() => {
    return performerManager ? performerManager.activeIndex : 0;
  });
  const activeState = $derived.by(() => {
    return performerManager ? performerManager.activeState : null;
  });
  const syncState = $derived.by(() => {
    return performerManager ? performerManager.syncState : null;
  });

  // Effects configuration state
  const effectsConfig = getEffectsConfigState();

  // UI state
  let visiblePlanes = $state(new Set([Plane.WALL, Plane.WHEEL, Plane.FLOOR]));
  let showGrid = $state(true);
  let showLabels = $state(true);
  let gridMode = $state<GridMode>("diamond");
  let cameraPreset = $state<CameraPreset>("perspective");
  let panelOpen = $state(true);
  let browserOpen = $state(false);
  let speed = $state(1);
  let showFigure = $state(true);
  let avatarId = $state<AvatarId>(initialAvatarId);

  // Terrain toggle - when enabled, shows procedural forest terrain around the stage
  // Default to true for the unified Stage+Forest experience
  let enableTerrain = $state(true);

  // Stage terrain height - must match StageTerrain.svelte and chunk-generator.worker.ts
  const STAGE_TERRAIN_HEIGHT = 5;

  // Terrain camera position derived from player controller (for chunk streaming)
  const terrainCameraPosition = $derived.by(() => {
    if (!playerController?.rigidBody) return { x: 0, y: 0, z: 0 };
    const translation = playerController.rigidBody.translation();
    return {
      x: translation.x,
      y: translation.y,
      z: translation.z,
    };
  });

  // Camera mode from preferences (orbit, third-person, first-person)
  let cameraMode = $state<CameraMode>(cameraPreferences.getModeForDestination("stage"));
  // Derived: whether we're in a "game" mode (WASD movement enabled)
  const inGameMode = $derived(isGameMode(cameraMode));
  let isDraggingPerformer = $state(false); // True when any performer is being dragged

  // Camera choreography state
  const cameraChoreography = createCameraChoreographyState();

  // Background type comes from settingsService (unified with 2D theme)

  // Avatar model is now determined by bodyType in Avatar3D component

  // Camera position from orbit controls
  let customCameraPosition = $state<[number, number, number] | null>(null);
  let customCameraTarget = $state<[number, number, number] | null>(null);

  // Hydration flag
  let initialized = $state(false);

  // Derived - use function to avoid TypeScript narrowing issues with $state(null)
  const sequenceName = $derived.by(() => {
    if (!activeState) return null;
    return (
      activeState.loadedSequence?.word ||
      activeState.loadedSequence?.name ||
      null
    );
  });

  // Avatar positions for per-avatar grid planes (full 3D position + facing angle)
  // Grid planes rotate with avatar's body orientation for body-relative coordinate system
  //
  // NOTE: Grid center is at Y=0 (shoulder/solar plexus level). The avatar model is positioned
  // so its shoulders are at world Y=0, and its feet are at groundY (negative value).
  // The performer.position.y represents the avatar's ground level in world coords, but
  // for grid purposes we use Y=0 since that's where the grid center should be.
  const avatarPositions = $derived.by(() => {
    return performerStates.map((p: { position: { x: number; y: number; z: number }; facingAngle: number }) => ({
      x: p.position.x,
      y: 0, // Grid center is at shoulder level (Y=0)
      z: p.position.z,
      facingAngle: p.facingAngle,
    }));
  });

  // Staff positions match grid center - staffs move ON the grid
  const getStaffAvatarPosition = (performer: { position: { x: number; y: number; z: number } }) => ({
    x: performer.position.x,
    y: 0, // Staffs are at grid center (shoulder level, Y=0)
    z: performer.position.z,
  });

  // Effective camera position (choreography overrides orbit controls when enabled)
  const effectiveCameraPosition = $derived.by((): [number, number, number] | null => {
    if (cameraChoreography.isEnabled && cameraChoreography.hasChoreography) {
      const pos = cameraChoreography.cameraState.position;
      return [pos.x, pos.y, pos.z];
    }
    return customCameraPosition;
  });

  const effectiveCameraTarget = $derived.by((): [number, number, number] | null => {
    if (cameraChoreography.isEnabled && cameraChoreography.hasChoreography) {
      const target = cameraChoreography.cameraState.target;
      return [target.x, target.y, target.z];
    }
    return customCameraTarget;
  });

  // Camera handlers
  function handleCameraChange(state: CameraState) {
    customCameraPosition = state.position;
    customCameraTarget = state.target;
  }

  function setCameraPreset(preset: CameraPreset) {
    cameraPreset = preset;
    customCameraPosition = null;
    customCameraTarget = null;
  }

  // Plane toggle
  function togglePlane(plane: Plane) {
    const newSet = new Set(visiblePlanes);
    if (newSet.has(plane)) {
      newSet.delete(plane);
    } else {
      newSet.add(plane);
    }
    visiblePlanes = newSet;
  }

  // Handle mesh clicks from raycaster (for performer selection)
  function handleMeshClick(
    meshName: string,
    point: { x: number; y: number; z: number }
  ) {
    // Check if this is a performer (either avatar body or hitbox)
    // Avatar3D names its group: PERFORMER_performer-0, PERFORMER_performer-1, etc.
    const performerMatch = meshName.match(/^PERFORMER_performer-(\d+)$/);
    if (performerMatch && performerMatch[1]) {
      const performerIndex = parseInt(performerMatch[1], 10);
      performerManager?.selectPerformer(performerIndex);
      isDraggingPerformer = true;
    }
  }

  // Handle pointer up (reset drag state)
  function handlePointerUp() {
    if (isDraggingPerformer) {
      isDraggingPerformer = false;
    }
  }

  // Handle drag movement (update active performer position)
  function handleDrag(position: { x: number; z: number }) {
    if (isDraggingPerformer && performerManager) {
      performerManager.handleDrag(activePerformerIndex, position);
    }
  }

  // Initialize services asynchronously
  onMount(async () => {
    // Get services from ITI container
    const propInterpolator = container.items.propStateInterpolator;
    const sequenceConverter = container.items.sequenceConverter;
    persistenceService = container.items.animation3DPersister;

    // Initialize Rapier physics (Stage uses meters, unified with Infinite Worlds)
    const { createPhysicsWorldState, initPhysicsWorld, createStageGround } = await import(
      "$lib/shared/3d/physics/rapier-world"
    );
    const { createPlayerController } = await import(
      "$lib/shared/3d/physics/player-controller"
    );
    const { createRapierPhysicsProvider } = await import(
      "$lib/shared/3d/physics/RapierPhysicsProvider"
    );

    physicsState = createPhysicsWorldState();
    await initPhysicsWorld(physicsState, { x: 0, y: SCALE.GRAVITY, z: 0 });

    // Create Stage ground plane (100m x 100m flat surface)
    createStageGround(physicsState);

    // Player controller starting just above ground
    // When terrain is enabled, spawn at terrain height; otherwise spawn at Y=1
    const spawnY = enableTerrain ? STAGE_TERRAIN_HEIGHT + 1 : 1;
    playerController = createPlayerController(physicsState, {
      position: { x: 0, y: spawnY, z: 0 },
    });

    // Create physics provider for UnifiedCameraController
    physicsProvider = createRapierPhysicsProvider(physicsState, playerController);

    // Create performer manager with resolved dependencies
    performerManager = createPerformerManager({
      propInterpolator,
      sequenceConverter,
      initialAvatarId,
    });

    // Initialize with first performer
    const initialPerformer = performerManager.initialize();

    // Load persisted state
    if (persistenceService) {
      const saved = persistenceService.loadState();

      if (saved.visiblePlanes)
        visiblePlanes = persistenceService.parsePlanes(saved.visiblePlanes);
      if (saved.showGrid !== undefined) showGrid = saved.showGrid;
      if (saved.showLabels !== undefined) showLabels = saved.showLabels;
      if (saved.gridMode) gridMode = saved.gridMode;
      if (saved.cameraPreset) cameraPreset = saved.cameraPreset;
      if (saved.panelOpen !== undefined) panelOpen = saved.panelOpen;
      if (saved.speed !== undefined) speed = saved.speed;
      if (saved.cameraPosition) customCameraPosition = saved.cameraPosition;
      if (saved.cameraTarget) customCameraTarget = saved.cameraTarget;
      if (saved.loop !== undefined && performerStates[0])
        performerStates[0].loop = saved.loop;
      if (saved.avatarId) avatarId = saved.avatarId;
      // Note: environmentType removed - now uses settingsService.settings.backgroundType

      // Load sequence into first performer if persisted
      if (saved.loadedSequence && performerStates[0]) {
        performerStates[0].loadSequence(saved.loadedSequence);
        if (saved.currentStepIndex !== undefined) {
          performerStates[0].goToStep(saved.currentStepIndex);
        }
      }
    }

    // Auto-start playback if it was playing before
    performerStates[0]?.autoStartIfNeeded();

    servicesReady = true;
    initTimer = setTimeout(() => (initialized = true), 50);

    // Initialize MCP Game Bridge in dev mode
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      import("$lib/shared/3d/debug/game-bridge").then(async ({ initGameBridge }) => {
        import("$lib/shared/3d/debug/game-bridge-types").then(async ({ DEFAULT_BRIDGE_CONFIG }) => {
          const bridge = initGameBridge({
            physics: {
              getPlayerPosition: () => physicsProvider?.getPlayerPosition() ?? null,
              getPlayerVelocity: () => physicsProvider?.getVelocity() ?? { x: 0, y: 0, z: 0 },
              isGrounded: () => physicsProvider?.isGrounded() ?? false,
              movePlayer: (movement, deltaTime) => physicsProvider?.movePlayer(movement, deltaTime),
              teleportPlayer: (position) => physicsProvider?.teleport?.(position),
              raycast: (origin, direction, maxDistance) => {
                // TODO: Implement via Rapier castRay
                return { hit: false };
              },
            },
            camera: {
              getMode: () => cameraMode,
              setMode: (mode: string) => {
                if (mode === 'orbit' || mode === 'third_person' || mode === 'first_person') {
                  cameraMode = mode as typeof cameraMode;
                }
              },
              getYaw: () => cameraYaw,
              getPitch: () => cameraPitch,
              setYaw: (yaw: number) => { externalYaw = yaw; },
              setPitch: (pitch: number) => { externalPitch = pitch; },
            },
            playback: {
              getPerformerManager: () => performerManager,
              getSpeed: () => speed,
              setSpeed: (s: number) => { speed = s; },
            },
          }, {
            debug: true,
          });

          // Auto-connect to MCP server
          try {
            await bridge.connect();
            console.log("[Viewer3D] MCP Game Bridge connected");
          } catch {
            console.log("[Viewer3D] MCP Game Bridge not available (run the MCP server to enable)");
          }
        });
      });
    }
  });

  // Sync speed to all performer states
  $effect(() => {
    performerManager?.setSpeed(speed);
  });

  // Note: Pointer lock is now managed by UnifiedCameraController

  // Physics simulation step loop
  $effect(() => {
    if (!physicsState?.world || !playerController) return;

    let animationId: number;
    let lastTime = performance.now();

    function step() {
      const now = performance.now();
      const deltaTime = Math.min((now - lastTime) / 1000, 0.05); // Cap at 50ms
      lastTime = now;

      if (physicsState?.world) {
        physicsState.world.timestep = deltaTime;
        physicsState.world.step();
      }
      animationId = requestAnimationFrame(step);
    }
    step();

    return () => cancelAnimationFrame(animationId);
  });

  // Update formation transitions (runs every frame during transitions)
  $effect(() => {
    if (!performerManager?.isFormationTransitioning) return;

    let frameId: number;
    function animate() {
      performerManager?.updateFormationTransition();
      if (performerManager?.isFormationTransitioning) {
        frameId = requestAnimationFrame(animate);
      }
    }
    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  });

  // Update camera choreography during playback
  $effect(() => {
    if (!cameraChoreography.isEnabled || !activeState?.isPlaying) return;

    let frameId: number;
    function updateCamera() {
      // Create performer position provider for follow mode
      const performerProvider = {
        getPosition: (index: number) => {
          const performer = performerStates[index];
          if (!performer) return null;
          return {
            x: performer.position.x,
            y: performer.position.y,
            z: performer.position.z,
          };
        },
      };

      cameraChoreography.updateForStep(
        activeState?.currentStepIndex ?? 0,
        activeState?.progress ?? 0,
        performerProvider
      );

      if (cameraChoreography.isEnabled && activeState?.isPlaying) {
        frameId = requestAnimationFrame(updateCamera);
      }
    }
    frameId = requestAnimationFrame(updateCamera);

    return () => cancelAnimationFrame(frameId);
  });

  // Persist state changes (using first performer for backwards compat)
  $effect(() => {
    const firstPerformer = performerStates[0];
    if (!initialized || !persistenceService || !firstPerformer) return;
    persistenceService.saveState({
      visiblePlanes: Array.from(visiblePlanes),
      showGrid,
      showLabels,
      gridMode,
      cameraPreset,
      panelOpen,
      speed,
      cameraPosition: customCameraPosition,
      cameraTarget: customCameraTarget,
      loop: firstPerformer.loop,
      loadedSequence: firstPerformer.loadedSequence ?? null,
      currentStepIndex: firstPerformer.currentStepIndex,
      avatarId,
      // Note: environmentType removed - now uses settingsService for background
    });
  });

  onDestroy(async () => {
    if (initTimer !== null) {
      clearTimeout(initTimer);
      initTimer = null;
    }
    performerManager?.destroy();
    // Clean up Rapier physics
    if (physicsState?.world) {
      physicsState.world.free();
    }
    // Clean up MCP game bridge
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const { destroyGameBridge } = await import("$lib/shared/3d/debug/game-bridge");
      destroyGameBridge();
    }
  });
</script>

{#if !servicesReady}
  <div class="loading-container">
    <ProgressRing percent={-1} size={32} strokeWidth={3} />
    <p>Loading 3D Viewer...</p>
  </div>
{:else if performerStates.length > 0}
  <div class="viewer-3d-module">
    <!-- Scene Area -->
    <main class="scene-area">
      <Scene3D
        {cameraMode}
        primaryAvatar={performerStates[0]}
        {visiblePlanes}
        showGrid={showGrid && !inGameMode}
        showLabels={showLabels && !inGameMode}
        {gridMode}
        {cameraPreset}
        customCameraPosition={effectiveCameraPosition}
        customCameraTarget={effectiveCameraTarget}
        onCameraChange={handleCameraChange}
        disableOrbitControls={cameraChoreography.isEnabled || isDraggingPerformer}
        bloomEnabled={effectsConfig.bloom.enabled}
        bloomIntensity={effectsConfig.bloom.intensity}
        bloomThreshold={effectsConfig.bloom.threshold}
        backgroundType={settingsService.settings.backgroundType}
        {avatarPositions}
        disableCamera={inGameMode}
        onMeshClick={handleMeshClick}
        onPointerUp={handlePointerUp}
        onDrag={handleDrag}
        isDragging={isDraggingPerformer}
        {enableTerrain}
        {physicsState}
        {terrainCameraPosition}
      >
        <!-- Dynamic Performer Props & Figures (with drag positioning) -->
        {#each performerStates as performer, i (performer.id)}
          <DraggablePerformer
            position={performer.position}
            isActive={activePerformerIndex === i}
            isDragging={isDraggingPerformer && activePerformerIndex === i}
          >
            {#snippet children()}
              <!-- Props rotate with avatar (pivot at grid center, offset forward from avatar) -->
              <!-- Uses getStaffAvatarPosition to ensure staffs align with grid planes -->
              {#if performer.showBlue && performer.bluePropState}
                <Staff3D
                  propState={performer.bluePropState}
                  color="blue"
                  avatarPosition={getStaffAvatarPosition(performer)}
                  facingAngle={performer.facingAngle}
                  gridOffset={-WALL_OFFSET}
                  isActivePlayer={activePerformerIndex === i}
                />
              {/if}
              {#if performer.showRed && performer.redPropState}
                <Staff3D
                  propState={performer.redPropState}
                  color="red"
                  avatarPosition={getStaffAvatarPosition(performer)}
                  facingAngle={performer.facingAngle}
                  gridOffset={-WALL_OFFSET}
                  isActivePlayer={activePerformerIndex === i}
                />
              {/if}

              <!-- Figure + Label -->
              {#if showFigure}
                <Avatar3D
                  id={performer.id}
                  bluePropState={performer.bluePropState}
                  redPropState={performer.redPropState}
                  position={performer.position}
                  facingAngle={performer.facingAngle}
                  isActive={activePerformerIndex === i}
                  avatarId={performer.avatarModelId}
                  isMoving={performer.isMoving}
                  moveDirection={performer.moveDirection}
                />
                <AvatarLabel3D
                  label={`Performer ${i + 1}`}
                  x={performer.position.x}
                  z={performer.position.z}
                  isActive={activePerformerIndex === i}
                />
              {/if}
            {/snippet}
          </DraggablePerformer>
        {/each}

        <!-- Visual Effects Layer (uses active avatar for now) -->
        <EffectsLayer
          bluePropState={activeState?.bluePropState ?? null}
          redPropState={activeState?.redPropState ?? null}
          isPlaying={activeState?.isPlaying ?? false}
        />

        <!-- First-person viewmodel staffs (visible only in first-person mode) -->
        <ViewmodelStaffs
          bluePropState={activeState?.bluePropState ?? null}
          redPropState={activeState?.redPropState ?? null}
          {cameraMode}
          showBlue={activeState?.showBlue ?? true}
          showRed={activeState?.showRed ?? true}
        />

        <!-- Unified Camera Controller (orbit, third-person, first-person) -->
        {#if activeState}
          <UnifiedCameraController
            destinationId="stage"
            avatarState={activeState}
            {physicsProvider}
            enabled={true}
            onModeChange={(mode) => (cameraMode = mode)}
            onRotationChange={(yaw, pitch) => { cameraYaw = yaw; cameraPitch = pitch; }}
            {externalYaw}
            {externalPitch}
          />
        {/if}
      </Scene3D>

      <SceneOverlayControls
        {cameraPreset}
        isCustomCamera={!!customCameraPosition}
        onCameraChange={setCameraPreset}
        formationPreset={performerManager?.currentFormationPreset}
        isFormationTransitioning={performerManager?.isFormationTransitioning ?? false}
        performerCount={performerStates.length}
        onFormationChange={(preset) => performerManager?.transitionToFormation(preset, 500)}
        {speed}
        onSpeedChange={(s) => (speed = s)}
        {cameraChoreography}
        currentStep={activeState?.currentStepIndex ?? 0}
        currentCameraPosition={customCameraPosition ? { x: customCameraPosition[0], y: customCameraPosition[1], z: customCameraPosition[2] } : undefined}
        currentCameraTarget={customCameraTarget ? { x: customCameraTarget[0], y: customCameraTarget[1], z: customCameraTarget[2] } : undefined}
        {sequenceName}
        onClearSequence={() => activeState?.clearSequence()}
        isPlaying={activeState?.isPlaying ?? false}
        progress={activeState?.progress ?? 0}
        loop={activeState?.loop ?? false}
        hasSequence={activeState?.hasSequence ?? false}
        currentStepIndex={activeState?.currentStepIndex ?? 0}
        totalSteps={activeState?.totalSteps ?? 0}
        onPlay={() => activeState?.play()}
        onPause={() => activeState?.pause()}
        onTogglePlay={() => activeState?.togglePlay()}
        onReset={() => activeState?.reset()}
        onProgressChange={(v) => activeState?.setProgress(v)}
        onLoopChange={(v) => {
          if (activeState) activeState.loop = v;
        }}
        onPrevStep={() => activeState?.prevStep()}
        onNextStep={() => activeState?.nextStep()}
        onShowHelp={() => keyboardShortcutState.openHelp()}
      >
        {#snippet trailing()}
          <button
            class="mode-toggle-btn"
            class:active={enableTerrain}
            onclick={() => (enableTerrain = !enableTerrain)}
            aria-label={enableTerrain ? "Hide terrain" : "Show terrain"}
            title={enableTerrain ? "Hide forest terrain" : "Show forest terrain"}
          >
            <i class="fas fa-tree" aria-hidden="true"></i>
          </button>
          <button
            class="mode-toggle-btn"
            class:game-mode={inGameMode}
            onclick={() => (cameraMode = cameraPreferences.cycleMode("stage"))}
            aria-label={`Camera: ${cameraMode === CameraMode.ORBIT ? "Orbit" : cameraMode === CameraMode.THIRD_PERSON ? "3rd Person" : "1st Person"}`}
            title={`${cameraMode === CameraMode.ORBIT ? "Orbit" : cameraMode === CameraMode.THIRD_PERSON ? "3rd Person" : "1st Person"} (V to cycle)`}
          >
            {#if cameraMode === CameraMode.ORBIT}
              <i class="fas fa-arrows-rotate" aria-hidden="true"></i>
            {:else if cameraMode === CameraMode.THIRD_PERSON}
              <i class="fas fa-user" aria-hidden="true"></i>
            {:else}
              <i class="fas fa-eye" aria-hidden="true"></i>
            {/if}
          </button>
          <button
            class="toggle-panel-btn"
            onclick={() => (panelOpen = !panelOpen)}
            aria-label={panelOpen ? "Hide panel" : "Show panel"}
          >
            <i
              class="fas"
              class:fa-chevron-right={panelOpen}
              class:fa-chevron-left={!panelOpen}
              aria-hidden="true"
            ></i>
          </button>
        {/snippet}
      </SceneOverlayControls>

      <!-- Note: Locomotion hint is now in the LocomotionController component -->
    </main>

    <!-- Side Panel -->
    <aside class="side-panel-wrapper" class:collapsed={!panelOpen}>
      <!-- Performer Manager -->
      <div class="mode-switcher-container">
        <PerformerManagerUI
          {performerStates}
          {activePerformerIndex}
          maxPerformers={performerManager?.maxPerformers ?? 4}
          onSelect={(i) => performerManager?.selectPerformer(i)}
          onAdd={() => performerManager?.addPerformer()}
          onRemove={() => performerManager?.removePerformer()}
        />
      </div>

      <!-- Avatar Sync Controls (only shown with 2+ performers) -->
      {#if syncState && performerStates.length >= 2 && performerStates[0]?.hasSequence && performerStates[1]?.hasSequence}
        <div class="sync-controls-container">
          <AvatarSyncControls {syncState} />
        </div>
      {/if}

      <Animation3DSidePanel
        collapsed={!panelOpen}
        hasSequence={activeState?.hasSequence ?? false}
        currentStepIndex={activeState?.currentStepIndex ?? 0}
        totalSteps={activeState?.totalSteps ?? 0}
        {gridMode}
        {visiblePlanes}
        {showFigure}
        avatarId={activeState?.avatarModelId ?? avatarId}
        onLoadSequence={() => (browserOpen = true)}
        onGridModeChange={(m) => (gridMode = m)}
        onPlaneToggle={togglePlane}
        onToggleFigure={() => (showFigure = !showFigure)}
        onAvatarChange={(id) => activeState?.setAvatarModel(id)}
      />
    </aside>
  </div>

  <!-- Sequence/Duet Browser (extracted to DuetOrchestrator) -->
  {#if performerManager}
    <DuetOrchestrator
      open={browserOpen}
      {performerManager}
      onClose={() => (browserOpen = false)}
    />
  {/if}

  <!-- Keyboard Shortcuts -->
  <Keyboard3DCoordinator
    isPlaying={activeState?.isPlaying ?? false}
    togglePlay={() => activeState?.togglePlay()}
    reset={() => activeState?.reset()}
    loop={activeState?.loop ?? false}
    setLoop={(v) => {
      if (activeState) activeState.loop = v;
    }}
    {speed}
    setSpeed={(s) => (speed = s)}
    hasSequence={activeState?.hasSequence ?? false}
    currentStepIndex={activeState?.currentStepIndex ?? 0}
    totalSteps={activeState?.totalSteps ?? 0}
    prevStep={() => activeState?.prevStep()}
    nextStep={() => activeState?.nextStep()}
    goToStep={(i) => activeState?.goToStep(i)}
    {setCameraPreset}
    toggleCameraMode={() => {
      cameraMode = cameraPreferences.cycleMode("stage");
    }}
    {showGrid}
    setShowGrid={(v) => (showGrid = v)}
    {panelOpen}
    setPanelOpen={(v) => (panelOpen = v)}
    setBrowserOpen={(v) => (browserOpen = v)}
  />

  <!-- Shortcuts Help Modal -->
  <ShortcutsHelp />
{/if}

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 400px;
    background: var(--theme-panel-bg, rgba(10, 10, 18, 1));
    color: var(--theme-text-dim);
    gap: 1rem;
  }

  .viewer-3d-module {
    display: flex;
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg, rgba(10, 10, 18, 1));
    color: var(--theme-text, white);
    overflow: hidden;
  }

  .scene-area {
    flex: 1;
    position: relative;
    min-width: 300px;
  }

  .side-panel-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow-y: auto;
    transition:
      width 0.2s ease,
      padding 0.2s ease;
  }

  .side-panel-wrapper.collapsed {
    width: 0;
    padding: 0;
    overflow: hidden;
  }

  .mode-switcher-container,
  .sync-controls-container {
    flex-shrink: 0;
  }

  .toggle-panel-btn,
  .mode-toggle-btn {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: none;
    border-radius: 12px;
    color: var(--theme-text);
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .toggle-panel-btn {
    display: none;
  }

  .toggle-panel-btn:hover,
  .mode-toggle-btn:hover {
    background: var(--theme-card-hover-bg);
    color: white;
  }

  .mode-toggle-btn.game-mode {
    background: var(--prop-blue, #3b82f6);
    color: white;
  }

  .mode-toggle-btn.game-mode:hover {
    background: var(--prop-blue-dark, color-mix(in srgb, var(--prop-blue, #3b82f6) 80%, black));
  }

  .mode-toggle-btn.active {
    background: var(--semantic-success, #22c55e);
    color: white;
  }

  .mode-toggle-btn.active:hover {
    background: var(--semantic-success-dark, color-mix(in srgb, var(--semantic-success, #22c55e) 80%, black));
  }

  .toggle-panel-btn:focus-visible,
  .mode-toggle-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  @media (max-width: 1024px) {
    .toggle-panel-btn {
      display: flex;
    }
  }

  @media (max-width: 600px) {
    .viewer-3d-module {
      flex-direction: column;
    }

    .scene-area {
      flex: 1;
      min-height: 50vh;
    }

    .toggle-panel-btn i {
      transform: rotate(90deg);
    }
  }

</style>
