<script lang="ts">
  import { buildMuseumGrid } from "./services/museum-grid-builder";
  import { MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG } from "./data/museum-room-graph";
  import { serializeGrid, deserializeGrid } from "./domain/museum-grid-types";
  import type { MuseumGrid } from "./domain/museum-grid-types";
  import { createEditorState } from "./state/editor-state.svelte";
  import { setEditorContext } from "./state/editor-context";
  import { createSoundscapePlayer } from "./audio/soundscape-player.svelte";
  import { setSoundscapeContext } from "./audio/soundscape-context";
  import { destroyMuseumVillage } from "./services/museum-village-manager";
  import RoomPicker from "./components/RoomPicker.svelte";
  import SoundscapeBubble from "./components/audio/SoundscapeBubble.svelte";

  import { onMount, untrack } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { setDesktopSidebarForcedHidden } from "$lib/shared/layout/desktop-sidebar-state.svelte";

  // ── Loading gate ──
  // A brief fade-from-black covers the scene until the lobby is ready
  // (~200ms via worker). No progress bar needed - the load is fast.
  let showOverlay = $state(true);
  let overlayFading = $state(false);

  function handleAllLoaded() {
    overlayFading = true;
    setTimeout(() => { showOverlay = false; }, 600);
  }

  // Defer heavy 3D component mount until AFTER the loading overlay has painted.
  // Two rAFs aren't enough - they can fire back-to-back before the browser paints
  // when the main thread is busy with module evaluation. setTimeout(0) properly
  // yields to the browser's task queue, ensuring the overlay is visible first.
  let deferredReady = $state(false);
  onMount(() => {
    // Museum is a full-screen immersive experience - suppress sidebar
    // even across viewport recalculations and HMR
    setDesktopSidebarForcedHidden(true);

    // rAF ensures we're past the first frame, setTimeout ensures the browser
    // has actually painted the overlay before we start the heavy 3D mount.
    requestAnimationFrame(() => {
      setTimeout(() => {
        deferredReady = true;
      }, 0);
    });
    return () => {
      // Restore sidebar when leaving museum
      setDesktopSidebarForcedHidden(false);
      // Tear down the village sim - a module-scope singleton that would
      // otherwise keep its Three.js meshes alive across navigations.
      destroyMuseumVillage();
    };
  });

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
  // Derived from SvelteKit's page store so it updates when goto() navigates.
  let selectedRoom = $derived(page.url.searchParams.get("room"));

  function handleRoomSelect(roomId: string | null) {
    const params = new URLSearchParams(window.location.search);
    if (roomId) {
      params.set("room", roomId);
    } else {
      params.delete("room");
    }
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : "");
    goto(newUrl, { invalidateAll: true });
  }

  // ── Grid caching ──
  // The grid build pipeline (layout engine, corridor routing, wall derivation,
  // exhibit/performer placement) runs every mount. Caching the result to
  // sessionStorage eliminates this on repeat visits within the same session.
  // A hash of the input config detects changes and invalidates the cache.
  const GRID_CACHE_KEY = "museum-grid-cache";
  const GRID_HASH_KEY = "museum-grid-hash";

  function computeConfigHash(rooms: typeof MUSEUM_ROOMS, edges: typeof MUSEUM_EDGES): string {
    // Include a version bump whenever layout logic changes (e.g. ROOM_SCALE)
    const input = JSON.stringify({ rooms, edges, config: GRID_CONFIG, layoutVersion: 4 });
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
    } catch { /* sessionStorage full - non-critical */ }
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
  // Runs inside $effect so generatedGrid is accessed reactively (avoids state_referenced_locally)
  if (import.meta.env.DEV) {
    $effect(() => {
      const grid = generatedGrid; // subscribe to derived grid
      import("./services/museum-design-validator").then(({ validateAll }) => {
        // Reconstruct PlacedRoom-like objects from grid wings + original room data
        const roomMap = new Map(MUSEUM_ROOMS.map(r => [r.id, r]));
        const placedRooms = grid.wings.map(wing => {
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

        const violations = validateAll(placedRooms as any, MUSEUM_EDGES, grid);
        if (violations.length > 0) {
          console.group("%c Museum Design Violations", "font-weight: bold; color: #d4b878");
          for (const v of violations) {
            const icon = v.severity === "error" ? "X" : v.severity === "warning" ? "!" : "i";
            console.warn(`${icon} [${v.roomId}] ${v.rule}: ${v.message}`);
          }
          console.groupEnd();
        }
      });
    });
  }

  // The 3D scene mounts eagerly on module load (behind the loading overlay)
  // and stays alive across mode switches. This ensures geometry, textures, and
  // shaders are warm before the user ever navigates to museum mode, eliminating
  // the multi-second freeze on 2D→3D transitions.
  // Previously this was gated on mode === "museum" which meant the first switch
  // to museum mode triggered the full geometry build + shader compilation.

  // The "live" grid - starts from generated, can be modified by editor.
  // Must use $state.raw: $state would deeply proxy 20k+ tiles, causing a
  // multi-second freeze on init. The grid is replaced wholesale (not mutated
  // in place), so shallow reactivity is correct.
  // Compute initial value eagerly to avoid capturing $derived in $state.raw initializer.
  const initialGrid = untrack(() => buildGridForRoom(selectedRoom).grid);
  let liveGrid = $state.raw<MuseumGrid>(initialGrid);

  // When the room selection changes, the derived generatedGrid updates.
  // Propagate that to liveGrid so the 3D scene rebuilds.
  $effect(() => {
    liveGrid = generatedGrid;
  });

  // Editor state - initialized from the initial grid (plain const, not reactive)
  const editorState = createEditorState(initialGrid.width, initialGrid.height);
  editorState.importGrid(serializeGrid(initialGrid));
  setEditorContext({ state: editorState });

  // Soundscape player - owns audio elements, crossfades on wing change.
  // Wing updates flow in via DimensionFlipProof's onWingChange callback.
  const soundscapePlayer = createSoundscapePlayer();
  setSoundscapeContext(soundscapePlayer);
  onMount(() => soundscapePlayer.initialize());

  // Module mode: museum | edit | showroom | 3p-test
  type ModuleMode = "museum" | "edit" | "showroom" | "3p-test";
  const LAST_MODE_KEY = "museum-last-mode";
  const VALID_MODES: Set<string> = new Set(["museum", "edit", "showroom", "3p-test"]);

  function getInitialMode(): ModuleMode {
    const urlMode = new URLSearchParams(window.location.search).get("mode");
    if (urlMode === "edit") return "edit";
    const saved = localStorage.getItem(LAST_MODE_KEY);
    if (saved && VALID_MODES.has(saved) && saved !== "edit") return saved as ModuleMode;
    return "museum";
  }
  let mode = $state(getInitialMode());
  $effect(() => {
    localStorage.setItem(LAST_MODE_KEY, mode);
  });

  // Sync sidebar tab clicks to internal mode
  $effect(() => {
    const tab = navigationState.activeTab;
    const mapped = TAB_TO_MODE[tab];
    if (mapped && mapped !== mode) {
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
</script>

<div class="museum-module">
  <!-- Loading gate - brief fade-from-black until lobby is ready -->
  {#if showOverlay}
    <div class="museum-loading-overlay" class:fading={overlayFading} role="status">
      <div class="overlay-icon">
        <i class="fas fa-landmark" aria-hidden="true"></i>
      </div>
    </div>
  {/if}

  <!-- Room picker - floating pill bar for room isolation -->
  {#if mode === "museum" && deferredReady}
    <RoomPicker {selectedRoom} onSelect={handleRoomSelect} />
  {/if}

  <!-- Content renders behind the opaque overlay; deferred to allow first paint -->
  {#if deferredReady}
    <!-- 3D scene mounts eagerly and stays alive across ALL mode switches.
         Hidden via CSS when inactive - geometry, textures, and shaders stay warm
         so switching to museum mode is instant (no rebuild). -->
    <div class="mode-content" class:hidden-mode={mode !== "museum" && mode !== "showroom" && mode !== "3p-test"}>
      {#key selectedRoom}
        {#await import("./components/game/DimensionFlipProof.svelte") then { default: DimensionFlipProof }}
          <DimensionFlipProof
            grid={liveGrid}
            onAllLoaded={handleAllLoaded}
            startInFps={selectedRoom !== null}
            onWingChange={(id) => soundscapePlayer.setCurrentWing(id)}
          />
        {/await}
      {/key}
    </div>

    <!-- Floating music-player bubble - audition ambient tracks per wing -->
    {#if mode === "museum"}
      <SoundscapeBubble />
    {/if}

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

  /* Unified loading overlay - covers full module, fades out when ready */
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

  @keyframes overlay-pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
  }

</style>
