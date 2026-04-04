<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { useProgress } from "@threlte/extras";
  import Museum3DScene from "./Museum3DScene.svelte";
  import { MUSEUM_EXHIBIT_SEQUENCES } from "../../data/museum-exhibit-sequences";
  import { tileKey } from "../../domain/museum-grid-types";
  import type { MuseumGrid, ExhibitDefinition, PerformerDefinition, WingRegion } from "../../domain/museum-grid-types";
  import { SOLID_TYPES } from "../../services/implementations/MuseumPhysicsProvider";
  import { museum3dEditorState } from "../../state/museum-3d-editor-state.svelte";
  import PlaqueView from "../panel/PlaqueView.svelte";
  import SequenceView from "../panel/SequenceView.svelte";
  import SequenceBrowserOverlay from "$lib/features/realm/destinations/museum/overlay/SequenceBrowserOverlay.svelte";

  import { onMount } from "svelte";

  interface Props {
    grid: MuseumGrid;
    /** Called with 0-1 progress as assets load */
    onLoadProgress?: (progress: number) => void;
    /** Called when all assets are loaded and first frame has rendered */
    onAllLoaded?: () => void;
    /** Start directly in FPS/3rd-person mode (skip top-down flip) */
    startInFps?: boolean;
  }

  let { grid, onLoadProgress, onAllLoaded, startInFps = false }: Props = $props();

  // useProgress hooks into Three.js DefaultLoadingManager globally.
  // Every texture and GLTF model automatically reports here.
  const { active, progress, finishedOnce } = useProgress();

  // Pipe progress to parent
  $effect(() => {
    onLoadProgress?.($progress);
  });

  // Signal when all assets loaded + no longer actively loading.
  // useProgress can briefly show active=false between batches (textures finish,
  // then GLTF models start). Debounce 500ms to ensure loading is truly done.
  let sceneReady = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    if ($finishedOnce && !$active && !sceneReady) {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        if (!sceneReady) {
          sceneReady = true;
          requestAnimationFrame(() => {
            onAllLoaded?.();
          });
        }
      }, 500);
    } else if ($active && settleTimer) {
      // New batch started — cancel the settle timer
      clearTimeout(settleTimer);
      settleTimer = null;
    }
  });

  const TILE_SIZE = 0.5;
  const HMR_KEY = "museum-hmr-state";

  // ── HMR state restore ──
  // sessionStorage survives Vite HMR remounts but clears on tab close — perfect for this.
  interface HmrState {
    playerWorldX: number;
    playerWorldZ: number;
    isInFPS: boolean;
    topDownHeight: number;
    playerYaw: number;
    isEditorMode?: boolean;
  }

  let savedHmrState: HmrState | null = null;
  try {
    const raw = sessionStorage.getItem(HMR_KEY);
    if (raw) savedHmrState = JSON.parse(raw) as HmrState;
  } catch {
    // sessionStorage unavailable or corrupt — start fresh
  }

  // Validate saved position is on a walkable tile. After layout changes (rooms move),
  // the saved position may land in void or wall space, trapping the player outside.
  if (savedHmrState) {
    const tileX = Math.round(savedHmrState.playerWorldX / TILE_SIZE);
    const tileY = Math.round(savedHmrState.playerWorldZ / TILE_SIZE);
    const tile = grid.tiles.get(`${tileX},${tileY}`);
    if (!tile || SOLID_TYPES.has(tile.type)) {
      savedHmrState = null;
      try { sessionStorage.removeItem(HMR_KEY); } catch { /* non-critical */ }
    }
  }

  // ── Input state ──
  let flipRequested = $state(0);
  let resetRequested = $state(0);
  // Plain object (not $state) for key tracking — Museum3DScene reads this every frame
  // in its useTask loop, bypassing Svelte reactivity. A raw Set avoids proxy overhead.
  const heldKeys = new Set<string>();

  // ── Zoom state (top-down camera height) ──
  let topDownHeight = $state(savedHmrState?.topDownHeight ?? 12);

  // ── Player state (updated every frame by Museum3DScene callback) ──
  let playerWorldX = $state(savedHmrState?.playerWorldX ?? grid.spawn.x * TILE_SIZE);
  let playerWorldZ = $state(savedHmrState?.playerWorldZ ?? grid.spawn.y * TILE_SIZE);
  let playerTileX = $state(grid.spawn.x);
  let playerTileY = $state(grid.spawn.y);
  let playerFacing = $state("south");
  let isInFPS = $state(savedHmrState?.isInFPS ?? false);

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
          isInFPS,
          topDownHeight,
          playerYaw: lastKnownYaw,
          isEditorMode: museum3dEditorState.editorActive,
        };
        sessionStorage.setItem(HMR_KEY, JSON.stringify(state));
      } catch {
        // sessionStorage full or unavailable — non-critical
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
        isInFPS,
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
    for (const wing of grid.wings) {
      const b = wing.bounds;
      if (playerTileX >= b.x && playerTileX < b.x + b.width &&
          playerTileY >= b.y && playerTileY < b.y + b.height) {
        return wing;
      }
    }
    return null;
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
    const tile = grid.tiles.get(tileKey(tx, ty));
    if (!tile || tile.type !== "exhibit-panel") return null;
    return grid.exhibits.find((e) => e.tileX === tx && e.tileY === ty) ?? null;
  });

  let facingPerformer = $derived.by<PerformerDefinition | null>(() => {
    const offset = FACING_OFFSETS[playerFacing];
    if (!offset) return null;
    const tx = playerTileX + offset.dx;
    const ty = playerTileY + offset.dy;
    const tile = grid.tiles.get(tileKey(tx, ty));
    if (!tile || tile.type !== "performer-station") return null;
    return grid.performers.find((p) => p.tileX === tx && p.tileY === ty) ?? null;
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

    // Q: dimension flip
    if (e.key === "q" || e.key === "Q") {
      e.preventDefault();
      // When flipping INTO 3D, pre-request pointer lock during the keypress
      // (a valid user gesture). By the time UCC mounts after the animation,
      // pointer lock is already active so mouse-look works immediately.
      if (!isInFPS) {
        const canvas = document.querySelector<HTMLCanvasElement>("canvas");
        canvas?.requestPointerLock();
      }
      flipRequested++;
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

    // Movement keys — only track in top-down mode (UCC handles its own keys in FPS)
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

    // Detect mode change — flush immediately so HMR captures the transition
    const modeChanged = isInFPS !== inFPS;
    isInFPS = inFPS;

    if (modeChanged) {
      flushHmrSave();
    } else {
      scheduleHmrSave();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      // Clean up debounce timer
      if (hmrSaveTimer !== null) clearTimeout(hmrSaveTimer);
    };
  });

  // Derived: does the focused exhibit have a sequence?
  let exhibitSequenceId = $derived(focusedExhibit?.sequenceId ?? null);
</script>

<div class="museum-container">
  <!-- 3D Canvas -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="canvas-area" onwheel={handleWheel}>
    <Canvas>
      <Museum3DScene
        {grid}
        {flipRequested}
        {resetRequested}
        {heldKeys}
        {topDownHeight}
        onPlayerUpdate={handlePlayerUpdate}
        initialFpsActive={savedHmrState?.isInFPS ?? startInFps}
        initialPlayerPos={savedHmrState ? { x: savedHmrState.playerWorldX, z: savedHmrState.playerWorldZ } : undefined}
        initialPlayerYaw={savedHmrState?.playerYaw}
      />
    </Canvas>
  </div>

  <!-- Editor mode badge -->
  {#if museum3dEditorState.editorActive}
    <div class="editor-badge">
      EDITOR — Orbit: drag, Pan: right-drag/WASD, Zoom: scroll, Select: click, Focus: dbl-click, 1/2/3: modes, Ctrl+Z: undo, F2: exit
    </div>
  {/if}

  <!-- Wing label (top-left) -->
  {#if currentWing && !showPanel}
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
      <span class="hint-text">WASD move {isInFPS ? "• Mouse look" : "• Scroll zoom"} • Q flip • E examine</span>
    </div>
  {/if}

  <!-- Overlay panel (right side) -->
  {#if showPanel && focusedExhibit}
    <div class="overlay-panel">
      <button class="panel-close" onclick={() => { showPanel = false; focusedExhibit = null; }}>
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>

      {#if focusedExhibit.plaque}
        <PlaqueView
          title={focusedExhibit.plaque.title}
          subtitle={focusedExhibit.plaque.subtitle}
          body={focusedExhibit.plaque.body}
          footer={focusedExhibit.plaque.footer}
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
      <button class="panel-close" onclick={() => { showPanel = false; focusedPerformer = null; }}>
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
        grid.performers = grid.performers.map((p) =>
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

  /* Editor mode badge */
  .editor-badge {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 20px;
    background: rgba(255, 60, 60, 0.85);
    color: white;
    font-size: 13px;
    font-weight: 600;
    border-radius: 6px;
    letter-spacing: 0.5px;
    z-index: 100;
    pointer-events: none;
  }

  /* Wing label */
  .wing-label {
    position: absolute;
    top: 16px;
    left: 16px;
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
