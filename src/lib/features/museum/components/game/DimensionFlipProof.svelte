<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { useProgress } from "@threlte/extras";
  import Museum3DScene from "./Museum3DScene.svelte";
  import { MUSEUM_EXHIBIT_SEQUENCES } from "../../data/museum-exhibit-sequences";
  import { tileKey } from "../../domain/museum-grid-types";
  import type { MuseumGrid, ExhibitDefinition, PerformerDefinition, WingRegion } from "../../domain/museum-grid-types";
  import { SOLID_TYPES } from "../../services/museum-physics-provider";
  import { museum3dEditorState } from "../../state/museum-3d-editor-state.svelte";
  import PlacementPickerPanel from "../editor/PlacementPickerPanel.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import type { ModuleId } from "$lib/shared/navigation/domain/types";
  import PlaqueView from "../panel/PlaqueView.svelte";
  import SequenceView from "../panel/SequenceView.svelte";
  import SequenceBrowserOverlay from "$lib/features/museum/scenes/procedural/overlay/SequenceBrowserOverlay.svelte";

  import { onMount } from "svelte";

  interface Props {
    grid: MuseumGrid;
    /** Called with 0-1 progress as assets load */
    onLoadProgress?: (progress: number) => void;
    /** Called when all assets AND geometry are ready - scene is fully interactive */
    onAllLoaded?: () => void;
    /** Called during async geometry build with the current phase name */
    onBuildStage?: (stage: string) => void;
    /** Start directly in FPS/3rd-person mode (skip top-down flip) */
    startInFps?: boolean;
    /** Fired when the player enters a new wing (or leaves all wings). */
    onWingChange?: (wingId: string | null) => void;
    /** False when the museum is mounted-but-hidden (keep-alive) - pause the scene */
    visible?: boolean;
  }

  const props: Props = $props();
  // Destructure non-reactive props; grid is accessed via props.grid in $derived/$effect for reactivity
  const startInFps = props.startInFps ?? false;

  // useProgress hooks into Three.js DefaultLoadingManager globally.
  // Every texture and GLTF model automatically reports here.
  const { active, progress, finishedOnce } = useProgress();

  // Pipe progress to parent
  $effect(() => {
    props.onLoadProgress?.($progress);
  });

  // The scene is truly ready when BOTH conditions are met:
  // 1. Geometry build completed (InstancedMeshes populated)
  // 2. Textures/models finished loading (Three.js DefaultLoadingManager)
  // Either can finish first depending on cache state.
  let sceneReady = false;
  let texturesReady = false;
  let meshesReady = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  function checkFullyReady(): void {
    if (sceneReady) return;
    if (!texturesReady || !meshesReady) return;
    sceneReady = true;
    requestAnimationFrame(() => {
      props.onAllLoaded?.();
    });
  }

  function handleGeometryReady(): void {
    meshesReady = true;
    checkFullyReady();
  }

  // ── WebGL context-loss resilience ──
  // Under memory pressure (especially mobile, where the WebGL context cap is as
  // low as 2-8 per principal) the browser can evict our context even while
  // mounted. preventDefault keeps it recoverable; on restore we force the ready
  // gate after a short grace so we never strand on a black canvas.
  let canvasAreaEl: HTMLDivElement | undefined;
  let canvasEl: HTMLCanvasElement | null = null;
  let contextRestoreTimer: ReturnType<typeof setTimeout> | null = null;

  function handleContextLost(e: Event): void {
    e.preventDefault();
    console.warn("[DimensionFlipProof] WebGL context lost");
  }
  function handleContextRestored(): void {
    console.warn("[DimensionFlipProof] WebGL context restored");
    if (contextRestoreTimer) clearTimeout(contextRestoreTimer);
    contextRestoreTimer = setTimeout(() => {
      texturesReady = true;
      meshesReady = true;
      checkFullyReady();
    }, 2000);
  }

  $effect(() => {
    if ($finishedOnce && !$active && !texturesReady) {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        if (!texturesReady) {
          texturesReady = true;
          checkFullyReady();
        }
      }, 500);
    } else if ($active && settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
  });

  const TILE_SIZE = 0.5;
  const HMR_KEY = "museum-hmr-state";

  // ── HMR state restore ──
  // sessionStorage survives Vite HMR remounts but clears on tab close - perfect for this.
  type ViewMode = "top-down" | "first-person" | "third-person";

  interface HmrState {
    playerWorldX: number;
    playerWorldZ: number;
    /** Legacy field - kept for backward compatibility with old sessionStorage */
    isInFPS?: boolean;
    /** New field - stores the exact view mode */
    viewMode?: ViewMode;
    topDownHeight: number;
    playerYaw: number;
    isEditorMode?: boolean;
  }

  // Compute saved HMR state once at init - plain const, no reactivity needed
  const savedHmrState: HmrState | null = (() => {
    let state: HmrState | null = null;
    try {
      const raw = sessionStorage.getItem(HMR_KEY);
      if (raw) state = JSON.parse(raw) as HmrState;
    } catch {
      // sessionStorage unavailable or corrupt - start fresh
    }

    // Validate saved position is on a walkable tile. After layout changes (rooms move),
    // the saved position may land in void or wall space, trapping the player outside.
    if (state) {
      const tileX = Math.round(state.playerWorldX / TILE_SIZE);
      const tileY = Math.round(state.playerWorldZ / TILE_SIZE);
      const tile = props.grid.tiles.get(`${tileX},${tileY}`);
      if (!tile || SOLID_TYPES.has(tile.type)) {
        try { sessionStorage.removeItem(HMR_KEY); } catch { /* non-critical */ }
        return null;
      }
    }
    return state;
  })();

  // ── Input state ──
  let flipRequested = $state(0);
  let resetRequested = $state(0);
  // Counter for instant mode switches (first-person → third-person)
  let modeChangeRequested = $state(0);
  // Plain object (not $state) for key tracking - Museum3DScene reads this every frame
  // in its useTask loop, bypassing Svelte reactivity. A raw Set avoids proxy overhead.
  const heldKeys = new Set<string>();

  // ── Zoom state (top-down camera height) ──
  let topDownHeight = $state(savedHmrState?.topDownHeight ?? 12);

  // ── View mode: unified Q-cycle state machine ──
  // Q cycles: top-down → first-person → third-person → top-down
  function restoreViewMode(): ViewMode {
    // When the parent forces 3D on mount (quick-travel into a single room),
    // honor that over stale sessionStorage. Prevents the 2D → 3D → 2D flash
    // that happens when HMR state lags behind the latest movement.
    if (startInFps) return "first-person";
    if (!savedHmrState) return "top-down";
    if (savedHmrState.viewMode) return savedHmrState.viewMode;
    return savedHmrState.isInFPS ? "first-person" : "top-down";
  }
  let viewMode = $state<ViewMode>(restoreViewMode());
  // Derived for backward compat - template uses isInFPS extensively
  let isInFPS = $derived(viewMode !== "top-down");

  // ── Player state (updated every frame by Museum3DScene callback) ──
  let playerWorldX = $state(savedHmrState?.playerWorldX ?? props.grid.spawn.x * TILE_SIZE);
  let playerWorldZ = $state(savedHmrState?.playerWorldZ ?? props.grid.spawn.y * TILE_SIZE);
  let playerTileX = $state(props.grid.spawn.x);
  let playerTileY = $state(props.grid.spawn.y);
  let playerFacing = $state("south");

  // Restore editor mode from HMR state
  if (savedHmrState?.isEditorMode) {
    museum3dEditorState.setActive(true);
  }

  // ── Debounced sessionStorage save ──
  // Writes at most every 500ms to avoid per-frame serialization overhead.
  let hmrSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let hmrDirty = false;

  function scheduleHmrSave(): void {
    hmrDirty = true;
    if (hmrSaveTimer !== null) return; // already scheduled
    hmrSaveTimer = setTimeout(() => {
      hmrSaveTimer = null;
      if (!hmrDirty) return;
      hmrDirty = false;
      try {
        const state: HmrState = {
          playerWorldX,
          playerWorldZ,
          viewMode,
          topDownHeight,
          playerYaw: lastKnownYaw,
          isEditorMode: museum3dEditorState.editorActive,
        };
        sessionStorage.setItem(HMR_KEY, JSON.stringify(state));
      } catch {
        // sessionStorage full or unavailable - non-critical
      }
    }, 500);
  }

  // Also flush immediately on mode change (FPS toggle) so the state is captured
  // before a potential HMR remount that could happen right after.
  function flushHmrSave(): void {
    if (hmrSaveTimer !== null) {
      clearTimeout(hmrSaveTimer);
      hmrSaveTimer = null;
    }
    hmrDirty = false;
    try {
      const state: HmrState = {
        playerWorldX,
        playerWorldZ,
        viewMode,
        topDownHeight,
        playerYaw: lastKnownYaw,
        isEditorMode: museum3dEditorState.editorActive,
      };
      sessionStorage.setItem(HMR_KEY, JSON.stringify(state));
    } catch {
      // non-critical
    }
  }

  // Track the latest yaw from Museum3DScene's player updates.
  // We can't read playerYaw from Museum3DScene directly, but we can infer it
  // from the facing direction or receive it via the callback. For now we store
  // the yaw from the saved state and update it when mode changes.
  let lastKnownYaw = savedHmrState?.playerYaw ?? 0;

  // ── Interaction state ──
  let focusedExhibit = $state<ExhibitDefinition | null>(null);
  let focusedPerformer = $state<PerformerDefinition | null>(null);
  let showPanel = $state(false);
  let showSequencePicker = $state(false);

  // ── Wing detection ──
  let currentWing = $derived.by<WingRegion | null>(() => {
    for (const wing of props.grid.wings) {
      const b = wing.bounds;
      if (playerTileX >= b.x && playerTileX < b.x + b.width &&
          playerTileY >= b.y && playerTileY < b.y + b.height) {
        return wing;
      }
    }
    return null;
  });

  // Notify parent when the player crosses a wing boundary so the soundscape
  // player can crossfade to the new room's ambient track.
  let lastNotifiedWingId: string | null = null;
  $effect(() => {
    const id = currentWing?.id ?? null;
    if (id !== lastNotifiedWingId) {
      lastNotifiedWingId = id;
      props.onWingChange?.(id);
    }
  });

  // ── Interaction detection: is the player facing an interactable tile? ──
  const FACING_OFFSETS: Record<string, { dx: number; dy: number }> = {
    north: { dx: 0, dy: -1 }, south: { dx: 0, dy: 1 },
    east: { dx: 1, dy: 0 }, west: { dx: -1, dy: 0 },
    northeast: { dx: 1, dy: -1 }, northwest: { dx: -1, dy: -1 },
    southeast: { dx: 1, dy: 1 }, southwest: { dx: -1, dy: 1 },
  };

  let facingExhibit = $derived.by<ExhibitDefinition | null>(() => {
    const offset = FACING_OFFSETS[playerFacing];
    if (!offset) return null;
    const tx = playerTileX + offset.dx;
    const ty = playerTileY + offset.dy;
    const tile = props.grid.tiles.get(tileKey(tx, ty));
    if (!tile || tile.type !== "exhibit-panel") return null;
    return props.grid.exhibits.find((e) => e.tileX === tx && e.tileY === ty) ?? null;
  });

  let facingPerformer = $derived.by<PerformerDefinition | null>(() => {
    const offset = FACING_OFFSETS[playerFacing];
    if (!offset) return null;
    const tx = playerTileX + offset.dx;
    const ty = playerTileY + offset.dy;
    const tile = props.grid.tiles.get(tileKey(tx, ty));
    if (!tile || tile.type !== "performer-station") return null;
    return props.grid.performers.find((p) => p.tileX === tx && p.tileY === ty) ?? null;
  });

  let hasInteractable = $derived(facingExhibit !== null || facingPerformer !== null);

  // ── Keyboard handling ──
  function handleKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    // F2: toggle editor mode
    if (e.key === "F2") {
      e.preventDefault();
      museum3dEditorState.toggle();
      if (museum3dEditorState.editorActive && document.pointerLockElement) {
        document.exitPointerLock();
      }
      flushHmrSave(); // Persist editor mode state immediately for HMR
      return;
    }

    // Skip normal controls when editor is active (editor handles its own keys)
    if (museum3dEditorState.editorActive) return;

    // Q: cycle view mode (top-down → first-person → third-person → top-down)
    if (e.key === "q" || e.key === "Q") {
      e.preventDefault();
      if (viewMode === "top-down") {
        // top-down → first-person: play flip animation into 3D
        // Pointer lock is handled by UCC when it attaches (deferred to avoid blocking)
        flipRequested++;
      } else if (viewMode === "first-person") {
        // first-person → third-person: instant switch, no animation
        modeChangeRequested++;
      } else {
        // third-person → top-down: play flip-back animation
        flipRequested++;
      }
      return;
    }

    // E: interact with exhibit or performer (not during flip animation)
    if (e.key === "e" || e.key === "E") {
      e.preventDefault();
      if (showPanel) {
        showPanel = false;
        focusedExhibit = null;
        focusedPerformer = null;
        // Re-acquire pointer lock if in FPS mode
        if (isInFPS) {
          const canvas = document.querySelector<HTMLCanvasElement>("canvas");
          canvas?.requestPointerLock();
        }
      } else if (facingExhibit) {
        focusedExhibit = facingExhibit;
        focusedPerformer = null;
        showPanel = true;
        // Release pointer lock so the user can interact with the panel
        if (document.pointerLockElement) document.exitPointerLock();
      } else if (facingPerformer) {
        focusedPerformer = facingPerformer;
        focusedExhibit = null;
        showPanel = true;
        if (document.pointerLockElement) document.exitPointerLock();
      }
      return;
    }

    // ESC: dismiss panel or picker
    if (e.key === "Escape") {
      if (showSequencePicker) {
        showSequencePicker = false;
        return;
      }
      if (showPanel) {
        showPanel = false;
        focusedExhibit = null;
        focusedPerformer = null;
        // Re-acquire pointer lock if in FPS mode
        if (isInFPS) {
          const canvas = document.querySelector<HTMLCanvasElement>("canvas");
          canvas?.requestPointerLock();
        }
        return;
      }
    }

    // Home or R: reset to spawn
    if (e.key === "Home" || e.key === "r" || e.key === "R") {
      e.preventDefault();
      resetRequested++;
      // Clear stale HMR state so the player doesn't respawn at the old position after HMR
      try { sessionStorage.removeItem(HMR_KEY); } catch { /* non-critical */ }
      return;
    }

    // Movement keys - only track in top-down mode (UCC handles its own keys in FPS)
    if (!isInFPS) {
      heldKeys.add(e.code);
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    heldKeys.delete(e.code);
  }

  function handleBlur() {
    heldKeys.clear();
  }

  function handleWheel(e: WheelEvent) {
    // Only zoom in top-down mode
    if (isInFPS) return;
    e.preventDefault();
    // Multiplicative zoom: scroll up (negative deltaY) = zoom in, scroll down = zoom out
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    topDownHeight = Math.max(4, Math.min(50, topDownHeight * factor));
  }

  function handlePlayerUpdate(
    worldX: number, worldZ: number,
    tileX: number, tileY: number,
    facing: string, inFPS: boolean,
    yaw: number
  ) {
    playerWorldX = worldX;
    playerWorldZ = worldZ;
    playerTileX = tileX;
    playerTileY = tileY;
    playerFacing = facing;
    lastKnownYaw = yaw;

    // Detect mode change - flush immediately so HMR captures the transition
    const wasInFPS = viewMode !== "top-down";
    if (inFPS && !wasInFPS) {
      // Entered 3D - default to first-person (the flip animation always enters FP)
      viewMode = "first-person";
      flushHmrSave();
    } else if (!inFPS && wasInFPS) {
      // Exited to top-down
      viewMode = "top-down";
      flushHmrSave();
    } else {
      scheduleHmrSave();
    }
  }

  // Called by Museum3DScene when UCC switches between first-person and third-person
  function handleViewModeChange(mode: "first-person" | "third-person") {
    if (viewMode !== mode) {
      viewMode = mode;
      flushHmrSave();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    // Watchdog: never strand the loading overlay on black. If neither the
    // texture nor the geometry track has reported ready within this window
    // (e.g. a worker crash that even the streamer's own guards missed), force
    // the reveal - a usable scene beats an indefinite black screen.
    const watchdog = setTimeout(() => {
      if (!sceneReady) {
        console.warn("[DimensionFlipProof] Ready watchdog fired - forcing scene reveal");
        texturesReady = true;
        meshesReady = true;
        checkFullyReady();
      }
    }, 15_000);

    // Attach context-loss listeners to this component's canvas (scoped to
    // canvasAreaEl, not a global querySelector, so keep-alive coexistence with
    // other modules' canvases can't grab the wrong one). Deferred so the Canvas
    // has rendered its <canvas> element.
    const canvasHookTimer = setTimeout(() => {
      canvasEl = canvasAreaEl?.querySelector<HTMLCanvasElement>("canvas") ?? null;
      canvasEl?.addEventListener("webglcontextlost", handleContextLost, false);
      canvasEl?.addEventListener("webglcontextrestored", handleContextRestored, false);
    }, 0);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      // Clean up debounce timer
      if (hmrSaveTimer !== null) clearTimeout(hmrSaveTimer);
      clearTimeout(watchdog);
      clearTimeout(canvasHookTimer);
      if (contextRestoreTimer) clearTimeout(contextRestoreTimer);
      canvasEl?.removeEventListener("webglcontextlost", handleContextLost);
      canvasEl?.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  });

  // Derived: does the focused exhibit have a sequence?
  let exhibitSequenceId = $derived(focusedExhibit?.sequenceId ?? null);
</script>

<div class="museum-container">
  <!-- 3D Canvas -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="canvas-area" onwheel={handleWheel} bind:this={canvasAreaEl}>
    <Canvas>
      <Museum3DScene
        grid={props.grid}
        visible={props.visible}
        {flipRequested}
        {resetRequested}
        {modeChangeRequested}
        {heldKeys}
        {topDownHeight}
        onPlayerUpdate={handlePlayerUpdate}
        onViewModeChange={handleViewModeChange}
        onBuildStage={props.onBuildStage}
        onGeometryReady={handleGeometryReady}
        initialFpsActive={viewMode !== "top-down"}
        initialPlayerPos={savedHmrState ? { x: savedHmrState.playerWorldX, z: savedHmrState.playerWorldZ } : undefined}
        initialPlayerYaw={savedHmrState?.playerYaw}
      />
    </Canvas>
  </div>

  <!-- Placement picker panel (HTML overlay, outside Canvas) -->
  {#if museum3dEditorState.editorActive}
    <PlacementPickerPanel currentRoomName={currentWing?.name} />
  {/if}

  <!-- Back button (top-left, non-editor mode) -->
  {#if !museum3dEditorState.editorActive && !showPanel}
    <button class="museum-back-btn" onclick={() => handleModuleChange('create' as ModuleId)} aria-label="Back to app">
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
    </button>
  {/if}

  <!-- Wing label (top-left, offset when back button visible) - hidden in editor mode -->
  {#if currentWing && !showPanel && !museum3dEditorState.editorActive}
    <div class="wing-label" class:fps={isInFPS}>
      <i class="fas fa-location-dot" aria-hidden="true"></i>
      <span>{currentWing.name}</span>
    </div>
  {/if}

  <!-- Interaction prompt (bottom-center) -->
  {#if hasInteractable && !showPanel}
    <div class="interaction-prompt" role="status" aria-live="polite">
      <kbd>E</kbd>
      <span>Examine</span>
    </div>
  {/if}

  <!-- Controls hint (bottom-right) -->
  {#if !showPanel}
    <div class="controls-hint">
      <span class="hint-text">WASD move {isInFPS ? "• Mouse look" : "• Scroll zoom"} • Q cycle view • E examine</span>
    </div>
  {/if}

  <!-- Overlay panel (right side) -->
  {#if showPanel && focusedExhibit}
    <div class="overlay-panel">
      <button class="panel-close" aria-label="Close exhibit panel" onclick={() => { showPanel = false; focusedExhibit = null; }}>
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>

      {#if focusedExhibit.plaque}
        <PlaqueView
          title={focusedExhibit.plaque.title}
          subtitle={focusedExhibit.plaque.subtitle}
          body={focusedExhibit.plaque.body}
        />
      {/if}

      {#if exhibitSequenceId}
        <div class="panel-section">
          <SequenceView sequenceId={exhibitSequenceId} />
        </div>
      {/if}
    </div>
  {/if}

  <!-- Performer panel (right side) -->
  {#if showPanel && focusedPerformer}
    <div class="overlay-panel">
      <button class="panel-close" aria-label="Close performer panel" onclick={() => { showPanel = false; focusedPerformer = null; }}>
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>

      <div class="performer-info">
        <div class="performer-header">
          <i class="fas fa-person" aria-hidden="true"></i>
          <h3>Performer Station</h3>
        </div>
      </div>

      {#if focusedPerformer.sequenceId}
        <div class="panel-section">
          <SequenceView sequenceId={focusedPerformer.sequenceId} />
        </div>
      {/if}

      <button class="change-sequence-btn" onclick={() => (showSequencePicker = true)}>
        <i class="fas fa-exchange-alt" aria-hidden="true"></i>
        Change Sequence
      </button>
    </div>
  {/if}

  <SequenceBrowserOverlay
    visible={showSequencePicker}
    onSelect={(seqId) => {
      if (focusedPerformer) {
        focusedPerformer.sequenceId = seqId;
        // Trigger Svelte reactivity by replacing the performer in the array
        props.grid.performers = props.grid.performers.map((p) =>
          p.id === focusedPerformer?.id ? { ...p, sequenceId: seqId } : p
        );
      }
      showSequencePicker = false;
    }}
    onClose={() => (showSequencePicker = false)}
  />
</div>

<style>
  .museum-container {
    width: 100%;
    height: 100%;
    position: relative;
    background: #0a0a0a;
  }

  .canvas-area {
    width: 100%;
    height: 100%;
  }

  /* Back button - top-left circle, takes you out of the museum */
  .museum-back-btn {
    position: absolute;
    top: 16px;
    left: 16px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(6px);
    color: rgba(255, 255, 255, 0.7);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 90;
    transition: background 0.15s, color 0.15s;
  }

  .museum-back-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  /* Wing label */
  .wing-label {
    position: absolute;
    top: 16px;
    left: 66px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: rgba(18, 18, 28, 0.85);
    border: 1px solid rgba(200, 180, 140, 0.15);
    border-radius: 8px;
    color: rgba(200, 180, 140, 0.8);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 14px;
    pointer-events: none;
    z-index: 10;
    animation: fade-in 0.3s ease;
  }

  .wing-label i {
    font-size: 12px;
    opacity: 0.6;
  }

  /* Interaction prompt */
  .interaction-prompt {
    position: absolute;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(18, 18, 28, 0.9);
    border: 1.5px solid rgba(200, 180, 140, 0.25);
    border-radius: 8px;
    color: rgba(200, 180, 140, 0.8);
    font-size: 14px;
    pointer-events: none;
    z-index: 10;
    animation: fade-in 0.2s ease;
  }

  .interaction-prompt kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    background: rgba(200, 180, 140, 0.15);
    border: 1px solid rgba(200, 180, 140, 0.3);
    border-radius: 4px;
    font-family: monospace;
    font-size: 13px;
    font-weight: 600;
    color: rgba(200, 180, 140, 0.9);
  }

  /* Controls hint */
  .controls-hint {
    position: absolute;
    bottom: 16px;
    right: 16px;
    z-index: 10;
    pointer-events: none;
  }

  .hint-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.2);
  }

  /* Overlay panel */
  .overlay-panel {
    position: absolute;
    top: 16px;
    right: 16px;
    bottom: 16px;
    width: min(360px, 40%);
    background: rgba(18, 18, 28, 0.95);
    border: 1px solid rgba(200, 180, 140, 0.12);
    border-radius: 12px;
    padding: 24px;
    overflow-y: auto;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: panel-slide-in 0.25s ease;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(200, 180, 140, 0.2)) transparent;
  }

  .panel-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(200, 180, 140, 0.08);
    border: 1px solid rgba(200, 180, 140, 0.15);
    border-radius: 6px;
    color: rgba(200, 180, 140, 0.5);
    cursor: pointer;
    font-size: 12px;
  }

  .panel-close:hover {
    background: rgba(200, 180, 140, 0.15);
    color: rgba(200, 180, 140, 0.8);
  }

  .panel-section {
    border-top: 1px solid rgba(200, 180, 140, 0.1);
    padding-top: 16px;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes panel-slide-in {
    from { opacity: 0; transform: translateX(16px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .performer-info {
    padding: 16px;
    background: rgba(140, 200, 140, 0.04);
    border: 1px solid rgba(140, 200, 140, 0.12);
    border-radius: 8px;
  }

  .performer-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .performer-header i {
    color: #8cc88c;
    font-size: 1.1rem;
  }

  .performer-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #8cc88c;
    font-weight: 500;
  }

  .change-sequence-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px 16px;
    background: rgba(140, 200, 140, 0.08);
    border: 1px solid rgba(140, 200, 140, 0.2);
    border-radius: 6px;
    color: rgba(140, 200, 140, 0.7);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .change-sequence-btn:hover {
    background: rgba(140, 200, 140, 0.14);
    border-color: rgba(140, 200, 140, 0.35);
    color: rgba(140, 200, 140, 0.9);
  }
</style>
