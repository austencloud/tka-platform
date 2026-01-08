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

  // CameraState type (matches Scene3D.svelte's internal definition)
  interface CameraState {
    position: [number, number, number];
    target: [number, number, number];
  }
  import {
    loadFeatureModule,
    resolveAsync,
  } from "$lib/shared/inversify/container";
  import { ANIMATION_3D_TYPES } from "./inversify/animation-3d.types";
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
    // Load the realm feature module first (provides 3D animation services)
    await loadFeatureModule("realm");

    // Resolve services using resolveAsync for HMR resilience
    const propInterpolator = await resolveAsync<IPropStateInterpolator>(
      ANIMATION_3D_TYPES.IPropStateInterpolator
    );
    const sequenceConverter = await resolveAsync<ISequenceConverter>(
      ANIMATION_3D_TYPES.ISequenceConverter
    );
    persistenceService = await resolveAsync<IAnimation3DPersister>(
      ANIMATION_3D_TYPES.IAnimation3DPersister
    );

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
      if (saved.currentBeatIndex !== undefined) {
        performerStates[0].goToBeat(saved.currentBeatIndex);
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
      currentBeatIndex: firstPerformer.currentBeatIndex,
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
        {visiblePlanes}
        {showGrid}
        {showLabels}
        {gridMode}
        {cameraPreset}
        {customCameraPosition}
        {customCameraTarget}
        onCameraChange={handleCameraChange}
        bloomEnabled={effectsConfig.bloom.enabled}
        bloomIntensity={effectsConfig.bloom.intensity}
        bloomThreshold={effectsConfig.bloom.threshold}
        backgroundType={settingsService.settings.backgroundType}
        {avatarPositions}
        disableCamera={locomotionMode}
        disableOrbitControls={isDraggingPerformer}
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

        <!-- Locomotion Controller (WASD + third-person camera) -->
        {#if locomotionMode && activeState}
          <LocomotionController
            avatarState={activeState}
            enabled={locomotionMode}
            onPointerLockChange={(locked) => (isPointerLocked = locked)}
          />
        {/if}
      </Scene3D>

      <SceneOverlayControls
        {cameraPreset}
        isCustomCamera={!!customCameraPosition}
        onCameraChange={setCameraPreset}
        {speed}
        onSpeedChange={(s) => (speed = s)}
        {sequenceName}
        onClearSequence={() => activeState?.clearSequence()}
        isPlaying={activeState?.isPlaying ?? false}
        progress={activeState?.progress ?? 0}
        loop={activeState?.loop ?? false}
        hasSequence={activeState?.hasSequence ?? false}
        currentBeatIndex={activeState?.currentBeatIndex ?? 0}
        totalBeats={activeState?.totalBeats ?? 0}
        onPlay={() => activeState?.play()}
        onPause={() => activeState?.pause()}
        onTogglePlay={() => activeState?.togglePlay()}
        onReset={() => activeState?.reset()}
        onProgressChange={(v) => activeState?.setProgress(v)}
        onLoopChange={(v) => {
          if (activeState) activeState.loop = v;
        }}
        onPrevBeat={() => activeState?.prevBeat()}
        onNextBeat={() => activeState?.nextBeat()}
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

      <!-- Empty State Overlay (shown when no sequence loaded) -->
      {#if !activeState?.hasSequence}
        <div class="empty-state-overlay">
          <div class="empty-state-content">
            <i class="fas fa-film" aria-hidden="true"></i>
            <h3>No Sequence Loaded</h3>
            <p>Load a sequence to see it performed in 3D</p>
            <button class="load-sequence-btn" onclick={() => (browserOpen = true)}>
              <i class="fas fa-folder-open" aria-hidden="true"></i>
              Browse Sequences
            </button>
          </div>
        </div>
      {/if}

      <!-- Locomotion Hint (shown when in locomotion mode but pointer not locked) -->
      {#if locomotionMode && !isPointerLocked}
        <div class="locomotion-hint">
          <div class="hint-content">
            <i class="fas fa-mouse-pointer" aria-hidden="true"></i>
            <span>Click to enter game mode</span>
          </div>
          <div class="hint-controls">
            <kbd>WASD</kbd> Move
            <kbd>Mouse</kbd> Look
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
        currentBeatIndex={activeState?.currentBeatIndex ?? 0}
        totalBeats={activeState?.totalBeats ?? 0}
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
    currentBeatIndex={activeState?.currentBeatIndex ?? 0}
    totalBeats={activeState?.totalBeats ?? 0}
    prevBeat={() => activeState?.prevBeat()}
    nextBeat={() => activeState?.nextBeat()}
    goToBeat={(i) => activeState?.goToBeat(i)}
    {setCameraPreset}
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
    transition: all 0.15s;
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

  /* Locomotion Hint Overlay */
  .locomotion-hint {
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
    animation: locomotion-pulse 2s ease-in-out infinite;
  }

  .hint-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
  }

  .hint-content i {
    font-size: 1.25rem;
    color: #64b5f6;
  }

  .hint-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  .hint-controls kbd {
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
    .locomotion-hint {
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

  /* Empty State Overlay */
  .empty-state-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 10;
  }

  .empty-state-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem 3rem;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 16px;
    text-align: center;
    pointer-events: auto;
    backdrop-filter: blur(8px);
  }

  .empty-state-content i {
    font-size: 3rem;
    color: var(--theme-accent, #8b5cf6);
    opacity: 0.8;
  }

  .empty-state-content h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .empty-state-content p {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .load-sequence-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--theme-accent, #8b5cf6);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .load-sequence-btn:hover {
    background: var(--theme-accent-strong, #7c3aed);
    transform: translateY(-1px);
  }

  .load-sequence-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .load-sequence-btn:active {
    transform: translateY(0);
  }

</style>
