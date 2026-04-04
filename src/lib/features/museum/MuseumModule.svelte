<script lang="ts">
  import { buildMuseumGrid } from "./services/implementations/MuseumGridBuilder";
  import { MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG } from "./data/museum-room-graph";
  import { serializeGrid, deserializeGrid } from "./domain/museum-grid-types";
  import type { MuseumGrid } from "./domain/museum-grid-types";
  import { createEditorState } from "./state/editor-state.svelte";
  import { setEditorContext } from "./state/editor-context";
  import RoomPicker from "./components/RoomPicker.svelte";

  import { onMount } from "svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";

  // ── Loading gate ──
  // An opaque overlay covers the scene until ALL assets (textures, models)
  // are fully loaded. On repeat visits within the same session, browser HTTP
  // cache serves assets instantly — skip the overlay entirely.
  const LOADED_FLAG = "museum-assets-loaded";
  const wasLoadedBefore = sessionStorage.getItem(LOADED_FLAG) === "1";

  // Real progress target from useProgress (jumps in bursts)
  let targetProgress = $state(wasLoadedBefore ? 1 : 0);
  // Displayed progress — lerps smoothly toward target
  let displayProgress = $state(wasLoadedBefore ? 1 : 0);
  let allLoaded = $state(wasLoadedBefore);
  let showOverlay = $state(!wasLoadedBefore);
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

  // Defer heavy 3D component mount until AFTER the loading overlay has painted.
  // Two rAFs aren't enough — they can fire back-to-back before the browser paints
  // when the main thread is busy with module evaluation. setTimeout(0) properly
  // yields to the browser's task queue, ensuring the overlay is visible first.
  let deferredReady = $state(false);
  onMount(() => {
    // rAF ensures we're past the first frame, setTimeout ensures the browser
    // has actually painted the overlay before we start the heavy 3D mount.
    requestAnimationFrame(() => {
      setTimeout(() => {
        deferredReady = true;
      }, 0);
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
    // Mark for fast-start on next visit
    try { sessionStorage.setItem(LOADED_FLAG, "1"); } catch { /* non-critical */ }
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

  // ── Room isolation ──
  // URL query param `?room=vulcan-cave` filters the museum to a single room.
  // null = full museum (all rooms + corridors).
  function getInitialRoom(): string | null {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("room") ?? null;
    } catch { return null; }
  }

  let selectedRoom = $state<string | null>(getInitialRoom());

  function handleRoomSelect(roomId: string | null) {
    selectedRoom = roomId;
    // Sync to URL without a full page reload
    const url = new URL(window.location.href);
    if (roomId) {
      url.searchParams.set("room", roomId);
    } else {
      url.searchParams.delete("room");
    }
    window.history.replaceState({}, "", url.toString());
  }

  // ── Grid caching ──
  // The grid build pipeline (layout engine, corridor routing, wall derivation,
  // exhibit/performer placement) runs every mount. Caching the result to
  // sessionStorage eliminates this on repeat visits within the same session.
  // A hash of the input config detects changes and invalidates the cache.
  const GRID_CACHE_KEY = "museum-grid-cache";
  const GRID_HASH_KEY = "museum-grid-hash";

  function computeConfigHash(rooms: typeof MUSEUM_ROOMS, edges: typeof MUSEUM_EDGES): string {
    const input = JSON.stringify({ rooms, edges, config: GRID_CONFIG });
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
    }
    return String(hash);
  }

  function loadCachedGrid(rooms: typeof MUSEUM_ROOMS, edges: typeof MUSEUM_EDGES): MuseumGrid | null {
    try {
      const hash = sessionStorage.getItem(GRID_HASH_KEY);
      if (hash !== computeConfigHash(rooms, edges)) return null;
      const raw = sessionStorage.getItem(GRID_CACHE_KEY);
      if (!raw) return null;
      return deserializeGrid(JSON.parse(raw));
    } catch { return null; }
  }

  function cacheGrid(grid: MuseumGrid, rooms: typeof MUSEUM_ROOMS, edges: typeof MUSEUM_EDGES): void {
    try {
      sessionStorage.setItem(GRID_HASH_KEY, computeConfigHash(rooms, edges));
      sessionStorage.setItem(GRID_CACHE_KEY, JSON.stringify(serializeGrid(grid)));
    } catch { /* sessionStorage full — non-critical */ }
  }

  // Build grid for the given room filter. When a single room is selected,
  // we pass only that room and no edges (no corridors needed). When null,
  // the full museum is built.
  function buildGridForRoom(roomFilter: string | null): { grid: MuseumGrid; validation: { valid: boolean; errors: string[] } } {
    const rooms = roomFilter
      ? MUSEUM_ROOMS.filter(r => r.id === roomFilter)
      : MUSEUM_ROOMS;
    const edges = roomFilter ? [] : MUSEUM_EDGES;

    // Only use cache for the full museum (isolated rooms are cheap to build)
    if (!roomFilter) {
      const cached = loadCachedGrid(rooms, edges);
      if (cached) return { grid: cached, validation: { valid: true, errors: [] } };
    }

    const result = buildMuseumGrid(rooms, edges, GRID_CONFIG);

    if (!roomFilter) {
      cacheGrid(result.grid, rooms, edges);
    }

    return { grid: result.grid, validation: result.validation };
  }

  // Initial grid build
  let currentBuild = $derived.by(() => buildGridForRoom(selectedRoom));

  // Surface the grid from the reactive build
  let generatedGrid = $derived(currentBuild.grid);

  $effect(() => {
    if (!currentBuild.validation.valid) {
      console.error("Museum layout validation failed:", currentBuild.validation.errors);
    }
  });

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
          walls: src?.walls,
          performers: src?.performers,
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

  // Once the 3D scene has mounted, keep it alive (hidden) across mode switches.
  // This prevents the 5+ second WebGL reinit freeze on every mode toggle.
  let museumSceneMounted = $state(false);
  $effect(() => {
    if (mode === "museum") museumSceneMounted = true;
  });

  // The "live" grid — starts from generated, can be modified by editor.
  // Must use $state.raw: $state would deeply proxy 20k+ tiles, causing a
  // multi-second freeze on init. The grid is replaced wholesale (not mutated
  // in place), so shallow reactivity is correct.
  let liveGrid = $state.raw<MuseumGrid>(generatedGrid);

  // When the room selection changes, the derived generatedGrid updates.
  // Propagate that to liveGrid so the 3D scene rebuilds.
  $effect(() => {
    liveGrid = generatedGrid;
  });

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
        {#if displayProgress > 0.01}
          <!-- Real progress bar (JS-driven, active once Three.js reports progress) -->
          <div class="overlay-progress-fill" style:width="{Math.round(displayProgress * 100)}%"></div>
        {:else}
          <!-- CSS-only indeterminate shimmer (runs on compositor, won't freeze) -->
          <div class="overlay-progress-indeterminate"></div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Room picker — floating pill bar for room isolation -->
  {#if mode === "museum" && deferredReady}
    <RoomPicker {selectedRoom} onSelect={handleRoomSelect} />
  {/if}

  <!-- Content renders behind the opaque overlay; deferred to allow first paint -->
  {#if deferredReady}
    <!-- 3D scene stays alive across mode switches (hidden via CSS when inactive).
         Destroying and recreating it causes a 5+ second freeze every time because
         WebGL reinit + InstancedMesh rebuild + texture reload must happen from scratch. -->
    <div class="mode-content" class:hidden-mode={mode !== "museum" && mode !== "showroom" && mode !== "3p-test"}>
      {#if mode === "museum" || museumSceneMounted}
        {#await import("./components/game/DimensionFlipProof.svelte") then { default: DimensionFlipProof }}
          <DimensionFlipProof grid={liveGrid} onLoadProgress={handleLoadProgress} onAllLoaded={handleAllLoaded} />
        {/await}
      {/if}
    </div>

    <!-- Non-3D modes render separately and unmount normally (they're lightweight) -->
    {#if mode === "showroom"}
      <div class="mode-content">
        {#await import("./components/showroom/PropsShowroom.svelte") then { default: PropsShowroom }}
          <PropsShowroom />
        {/await}
      </div>
    {:else if mode === "3p-test"}
      <div class="mode-content">
        {#await import("./components/showroom/ThirdPersonTest.svelte") then { default: ThirdPersonTest }}
          <ThirdPersonTest />
        {/await}
      </div>
    {:else if mode === "edit"}
      <div class="mode-content">
        {#await import("./components/editor/Museum2DEditor.svelte") then { default: Museum2DEditor }}
          <Museum2DEditor />
        {/await}
      </div>
    {/if}
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

  .mode-content.hidden-mode {
    visibility: hidden;
    pointer-events: none;
    position: absolute;
    inset: 0;
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
    will-change: opacity;
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

  /* Indeterminate shimmer — runs on the compositor thread so it animates
     even while the main thread is blocked initializing the 3D scene. */
  .overlay-progress-indeterminate {
    height: 100%;
    width: 40%;
    border-radius: 1px;
    background: rgba(200, 180, 140, 0.6);
    animation: indeterminate-slide 1.4s ease-in-out infinite;
    will-change: transform;
  }

  @keyframes indeterminate-slide {
    0% { transform: translateX(-100%); }
    50% { transform: translateX(250%); }
    100% { transform: translateX(-100%); }
  }
</style>
