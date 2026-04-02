<script lang="ts">
  import { buildMuseumGrid } from "./services/implementations/MuseumGridBuilder";
  import { MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG } from "./data/museum-room-graph";
  import { serializeGrid, deserializeGrid } from "./domain/museum-grid-types";
  import type { MuseumGrid } from "./domain/museum-grid-types";
  import { createEditorState } from "./state/editor-state.svelte";
  import { setEditorContext } from "./state/editor-context";

  import Museum2DEditor from "./components/editor/Museum2DEditor.svelte";

  import DimensionFlipProof from "./components/game/DimensionFlipProof.svelte";
  import PropsShowroom from "./components/showroom/PropsShowroom.svelte";
  import ThirdPersonTest from "./components/showroom/ThirdPersonTest.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";

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
    <div class="mode-content">
      {#if mode === "museum"}
        <DimensionFlipProof />
      {:else if mode === "showroom"}
        <PropsShowroom />
      {:else if mode === "3p-test"}
        <ThirdPersonTest />
      {:else}
        <Museum2DEditor />
      {/if}
    </div>
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
</style>
