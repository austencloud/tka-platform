<script lang="ts">
  /**
   * Viewer3DModule
   *
   * Main 3D animation viewer module. Load sequences from the library
   * and explore them in 3D space with camera controls.
   *
   * Admin-only (Level 6 feature).
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
  import { WALL_OFFSET } from "./utils/performer-positions";
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

  // Locomotion system
  import LocomotionController from "./components/locomotion/LocomotionController.svelte";

  // Effects system
  import EffectsLayer from "./effects/EffectsLayer.svelte";
  import { getEffectsConfigState } from "./effects/state/effects-config-state.svelte";

  // Camera mode switching
  import { CameraMode } from "$lib/shared/3d-core/camera/types";
  import { cameraPreferences } from "$lib/shared/3d-core/camera/camera-preferences.svelte";

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
  let locomotionMode = $state(false); // WASD movement + third-person camera
  let isPointerLocked = $state(false); // Pointer lock state for locomotion hint
  let isDraggingPerformer = $state(false); // True when any performer is being dragged

  // Camera mode (orbit <-> 1st person with V key)
  let cameraMode = $state<CameraMode>(
    cameraPreferences.getModeForDestination("stage")
  );

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
  const avatarPositions = $derived.by(() => {
    return performerStates.map((p: { position: { x: number; y: number; z: number }; facingAngle: number }) => ({
      x: p.position.x,
      y: p.position.y,
      z: p.position.z,
      facingAngle: p.facingAngle,
    }));
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

    // Create performer manager with resolved dependencies
    performerManager = createPerformerManager({
      propInterpolator,
      sequenceConverter,
      initialAvatarId,
    });

    // Initialize with first performer
    const initialPerformer = performerManager.initialize();

    // Load persisted state
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

    // Auto-start playback if it was playing before
    performerStates[0]?.autoStartIfNeeded();

    servicesReady = true;
    setTimeout(() => (initialized = true), 50);
  });

  // Sync speed to all performer states
  $effect(() => {
    performerManager?.setSpeed(speed);
  });

  // Reset pointer lock state when exiting locomotion mode
  $effect(() => {
    if (!locomotionMode) {
      isPointerLocked = false;
    }
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

  onDestroy(() => {
    performerManager?.destroy();
  });
</script>

{#if !servicesReady}
  <div class="loading-container">
    <div class="loading-spinner"></div>
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
        showGrid={showGrid && !locomotionMode}
        showLabels={showLabels && !locomotionMode}
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
        disableCamera={locomotionMode}
        onMeshClick={handleMeshClick}
        onPointerUp={handlePointerUp}
        onDrag={handleDrag}
        isDragging={isDraggingPerformer}
      >
        <!-- Dynamic Performer Props & Figures (with drag positioning) -->
        {#each performerStates as performer, i (performer.id)}
          <DraggablePerformer
            position={performer.position}
            isActive={activePerformerIndex === i}
            isDragging={isDraggingPerformer && activePerformerIndex === i}
          >
            {#snippet children()}
              <!-- Props rotate with avatar (pivot at avatar position, offset forward to grid) -->
              {#if performer.showBlue && performer.bluePropState}
                <Staff3D
                  propState={performer.bluePropState}
                  color="blue"
                  avatarPosition={performer.position}
                  facingAngle={performer.facingAngle}
                  gridOffset={-WALL_OFFSET}
                />
              {/if}
              {#if performer.showRed && performer.redPropState}
                <Staff3D
                  propState={performer.redPropState}
                  color="red"
                  avatarPosition={performer.position}
                  facingAngle={performer.facingAngle}
                  gridOffset={-WALL_OFFSET}
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

        <!-- Locomotion Controller (WASD + camera control, V to toggle 1st/3rd person) -->
        {#if locomotionMode && activeState}
          <LocomotionController
            avatarState={activeState}
            enabled={locomotionMode}
            {cameraMode}
            onCameraModeChange={(mode) => cameraMode = mode}
            onPointerLockChange={(locked) => (isPointerLocked = locked)}
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
            class="locomotion-btn"
            class:active={locomotionMode}
            onclick={() => (locomotionMode = !locomotionMode)}
            aria-label={locomotionMode ? "Exit walk mode" : "Enter walk mode"}
            title={locomotionMode
              ? "Exit walk mode (WASD)"
              : "Enter walk mode (WASD)"}
          >
            <i class="fas fa-person-walking" aria-hidden="true"></i>
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

      <!-- Locomotion Status (shown when in locomotion mode) -->
      {#if locomotionMode}
        <div class="locomotion-status">
          <div class="mode-indicator">
            {#if cameraMode === CameraMode.FIRST_PERSON}
              <i class="fas fa-eye" aria-hidden="true"></i>
              <span>1st Person</span>
            {:else}
              <i class="fas fa-user" aria-hidden="true"></i>
              <span>3rd Person</span>
            {/if}
          </div>
          {#if !isPointerLocked}
            <div class="click-prompt">
              <i class="fas fa-mouse-pointer" aria-hidden="true"></i>
              <span>Click to control</span>
            </div>
          {/if}
          <div class="controls-hint">
            <kbd>WASD</kbd> Move
            <kbd>Mouse</kbd> Look
            <kbd>V</kbd> Toggle View
            <kbd>Esc</kbd> Exit
          </div>
        </div>
      {/if}
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
      cameraMode = cameraPreferences.toggleMode("stage");
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
    background: #0a0a12;
    color: var(--theme-text-dim);
    gap: 1rem;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--theme-stroke);
    border-top-color: #64b5f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .viewer-3d-module {
    display: flex;
    width: 100%;
    height: 100%;
    background: #0a0a12;
    color: white;
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
  .locomotion-btn {
    width: 48px;
    height: 48px;
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
  .locomotion-btn:hover {
    background: var(--theme-card-hover-bg);
    color: white;
  }

  .locomotion-btn.active {
    background: #3b82f6;
    color: white;
  }

  .locomotion-btn.active:hover {
    background: #2563eb;
  }

  .toggle-panel-btn:focus-visible,
  .locomotion-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* Locomotion Status Overlay */
  .locomotion-status {
    position: absolute;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: white;
    font-size: 14px;
    backdrop-filter: blur(8px);
    pointer-events: none;
    z-index: 50;
  }

  .mode-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 1rem;
  }

  .mode-indicator i {
    font-size: 1.25rem;
    color: #64b5f6;
  }

  .click-prompt {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    animation: locomotion-pulse 2s ease-in-out infinite;
  }

  .click-prompt i {
    font-size: 1rem;
    color: #fbbf24;
  }

  .controls-hint {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  .controls-hint kbd {
    padding: 0.2rem 0.5rem;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    font-family: inherit;
    font-size: 11px;
  }

  @keyframes locomotion-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .click-prompt {
      animation: none;
    }
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
