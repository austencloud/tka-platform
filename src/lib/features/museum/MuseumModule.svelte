<script lang="ts">
  import { buildMuseumGrid } from "./services/implementations/MuseumGridBuilder";
  import { MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG } from "./data/museum-room-graph";
  import { serializeGrid, deserializeGrid } from "./domain/museum-grid-types";
  import type { MuseumGrid } from "./domain/museum-grid-types";
  import { createEditorState } from "./state/editor-state.svelte";
  import { setEditorContext } from "./state/editor-context";

  import { onMount } from "svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";

  // ── Loading gate ──
  // An opaque overlay covers the scene until ALL assets (textures, models)
  // are fully loaded. useProgress() in DimensionFlipProof hooks into
  // Three.js DefaultLoadingManager and reports real 0-1 progress.
  // Nothing partial is ever visible — the scene appears complete.
  // Real progress target from useProgress (jumps in bursts)
  let targetProgress = $state(0);
  // Displayed progress — lerps smoothly toward target
  let displayProgress = $state(0);
  let allLoaded = $state(false);
  let showOverlay = $state(true);
  let overlayFading = $state(false);

  // Animate the progress bar smoothly via rAF.
  // Even if real progress jumps 0% → 100% in one frame (cached assets),
  // the bar fills over ~600ms so the user sees motion.
  let rafId: number | null = null;
  let lastTime = 0;
  const FILL_SPEED = 2.0; // units per second (0-1 scale, so 2.0 = full bar in 500ms)

  function tickProgress(now: number) {
    if (!lastTime) lastTime = now;
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    if (displayProgress < targetProgress) {
      displayProgress = Math.min(targetProgress, displayProgress + FILL_SPEED * dt);
      rafId = requestAnimationFrame(tickProgress);
    } else {
      rafId = null;
    }
  }

  function startProgressAnimation() {
    if (rafId === null) {
      lastTime = 0;
      rafId = requestAnimationFrame(tickProgress);
    }
  }

  // Defer heavy 3D component mount until after the first paint.
  let deferredReady = $state(false);
  onMount(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        deferredReady = true;
      });
    });
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  });

  function handleLoadProgress(progress: number) {
    // Never go backwards — useProgress resets between loading batches
    if (progress > targetProgress) {
      targetProgress = progress;
      startProgressAnimation();
    }
  }

  function handleAllLoaded() {
    allLoaded = true;
    targetProgress = 1;
    startProgressAnimation();
    // Wait for the bar to visually reach 100%, then hold briefly, then reveal
    const waitForBar = () => {
      if (displayProgress >= 0.99) {
        setTimeout(() => {
          overlayFading = true;
          setTimeout(() => { showOverlay = false; }, 800);
        }, 400);
      } else {
        requestAnimationFrame(waitForBar);
      }
    };
    requestAnimationFrame(waitForBar);
  }

  // Map sidebar tab IDs to internal modes
  const TAB_TO_MODE: Record<string, string> = {
    play: "museum",
    edit: "edit",
    showroom: "showroom",
    "3p-test": "3p-test",
  };

  // Build the grid from the room graph
  const { grid: generatedGrid, validation } = buildMuseumGrid(MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG);

  if (!validation.valid) {
    console.error("Museum layout validation failed:", validation.errors);
  }

  // Museum design validation (dev only)
  if (import.meta.env.DEV) {
    import("./services/implementations/MuseumDesignValidator").then(({ MuseumDesignValidator }) => {
      // Reconstruct PlacedRoom-like objects from grid wings + original room data
      const roomMap = new Map(MUSEUM_ROOMS.map(r => [r.id, r]));
      const placedRooms = generatedGrid.wings.map(wing => {
        const src = roomMap.get(wing.id);
        return {
          id: wing.id,
          name: wing.name,
          x: wing.bounds.x,
          y: wing.bounds.y,
          w: wing.bounds.width,
          h: wing.bounds.height,
          material: src?.material ?? "stone",
          theme: wing.theme,
          exhibits: src?.exhibits,
          performers: src?.performers,
          torches: src?.torches,
        };
      });

      const designValidator = new MuseumDesignValidator();
      const violations = designValidator.validateAll(placedRooms as any, MUSEUM_EDGES, generatedGrid);
      if (violations.length > 0) {
        console.group("%c🏛️ Museum Design Violations", "font-weight: bold; color: #d4b878");
        for (const v of violations) {
          const icon = v.severity === "error" ? "❌" : v.severity === "warning" ? "⚠️" : "ℹ️";
          console.log(`${icon} [${v.roomId}] ${v.rule}: ${v.message}`);
        }
        console.groupEnd();
      } else {
        console.log("%c🏛️ Museum Design: All rooms pass", "color: #4a8");
      }
    });
  }

  // The "live" grid — starts from generated, can be modified by editor
  let liveGrid = $state<MuseumGrid>(generatedGrid);

  // Editor state — initialized from the live grid
  const editorState = createEditorState(liveGrid.width, liveGrid.height);
  editorState.importGrid(serializeGrid(liveGrid));
  setEditorContext({ state: editorState });

  // Module mode: museum | edit | showroom | 3p-test
  type ModuleMode = "museum" | "edit" | "showroom" | "3p-test";
  const LAST_MODE_KEY = "museum-last-mode";
  const VALID_MODES: Set<string> = new Set(["museum", "edit", "showroom", "3p-test"]);

  function getInitialMode(): ModuleMode {
    const saved = localStorage.getItem(LAST_MODE_KEY);
    if (saved && VALID_MODES.has(saved)) return saved as ModuleMode;
    return "museum";
  }
  let mode = $state(getInitialMode());
  $effect(() => {
    if (mode !== "picker") localStorage.setItem(LAST_MODE_KEY, mode);
  });

  // Sync sidebar tab clicks to internal mode
  $effect(() => {
    const tab = navigationState.activeTab;
    const mapped = TAB_TO_MODE[tab];
    if (mapped && mapped !== mode && mode !== "picker") {
      if (mapped === "edit") {
        editorState.importGrid(serializeGrid(liveGrid));
      }
      mode = mapped as ModuleMode;
    }
  });

  function switchToEdit() {
    editorState.importGrid(serializeGrid(liveGrid));
    mode = "edit";
  }

  function switchToMuseum() {
    liveGrid = deserializeGrid(editorState.exportGrid());
    mode = "museum";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (mode === "museum") switchToEdit();
      else switchToMuseum();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="museum-module">
  <!-- Loading gate — opaque until all assets loaded -->
  {#if showOverlay}
    <div class="museum-loading-overlay" class:fading={overlayFading} role="status" aria-busy={!allLoaded}>
      <div class="overlay-icon">
        <i class="fas fa-landmark" aria-hidden="true"></i>
      </div>
      <p class="overlay-stage">
        {#if displayProgress >= 0.99 && allLoaded}
          Welcome to The Archive
        {:else if displayProgress > 0.01}
          Loading... {Math.round(displayProgress * 100)}%
        {:else}
          Entering The Archive...
        {/if}
      </p>
      <div class="overlay-progress-track">
        <div class="overlay-progress-fill" style:width="{Math.round(displayProgress * 100)}%"></div>
      </div>
    </div>
  {/if}

  <!-- Content renders behind the opaque overlay; deferred to allow first paint -->
  {#if deferredReady}
    <div class="mode-content">
      {#if mode === "museum"}
        {#await import("./components/game/DimensionFlipProof.svelte") then { default: DimensionFlipProof }}
          <DimensionFlipProof grid={liveGrid} onLoadProgress={handleLoadProgress} onAllLoaded={handleAllLoaded} />
        {/await}
      {:else if mode === "showroom"}
        {#await import("./components/showroom/PropsShowroom.svelte") then { default: PropsShowroom }}
          <PropsShowroom />
        {/await}
      {:else if mode === "3p-test"}
        {#await import("./components/showroom/ThirdPersonTest.svelte") then { default: ThirdPersonTest }}
          <ThirdPersonTest />
        {/await}
      {:else}
        {#await import("./components/editor/Museum2DEditor.svelte") then { default: Museum2DEditor }}
          <Museum2DEditor />
        {/await}
      {/if}
    </div>
  {/if}
</div>

<style>
  .museum-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #0a0a0a;
    position: relative;
  }

  .mode-content {
    flex: 1;
    overflow: hidden;
  }

  /* Unified loading overlay — covers full module, fades out when ready */
  .museum-loading-overlay {
    position: absolute;
    inset: 0;
    z-index: 50;
    background: #0a0a0a;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: rgba(200, 180, 140, 0.8);
    font-family: Georgia, "Times New Roman", serif;
    opacity: 1;
    transition: opacity 0.6s ease;
  }

  .museum-loading-overlay.fading {
    opacity: 0;
    pointer-events: none;
    transition-duration: 0.8s;
  }

  .overlay-icon {
    font-size: 36px;
    opacity: 0.5;
    animation: overlay-pulse 2s ease-in-out infinite;
  }

  .overlay-stage {
    margin: 0;
    font-size: 16px;
    letter-spacing: 0.04em;
    opacity: 0.6;
    min-height: 1.4em;
    text-align: center;
  }

  .overlay-progress-track {
    width: 160px;
    height: 2px;
    border-radius: 1px;
    background: rgba(200, 180, 140, 0.12);
    overflow: hidden;
  }

  .overlay-progress-fill {
    height: 100%;
    background: rgba(200, 180, 140, 0.6);
    border-radius: 1px;
  }

  @keyframes overlay-pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
  }
</style>
