<script lang="ts">
  import { buildMuseumGrid } from "./services/implementations/MuseumGridBuilder";
  import { MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG } from "./data/museum-room-graph";
  import { serializeGrid, deserializeGrid } from "./domain/museum-grid-types";
  import type { MuseumGrid } from "./domain/museum-grid-types";
  import { createEditorState } from "./state/editor-state.svelte";
  import { setEditorContext } from "./state/editor-context";
  import Museum2DPlayMode from "./components/game/Museum2DPlayMode.svelte";
  import Museum2DEditor from "./components/editor/Museum2DEditor.svelte";

  // Build the grid from the room graph
  const { grid: generatedGrid, validation } = buildMuseumGrid(MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG);

  if (!validation.valid) {
    console.error("Museum layout validation failed:", validation.errors);
  }

  // The "live" grid — starts from generated, can be modified by editor
  let liveGrid = $state<MuseumGrid>(generatedGrid);

  // Editor state — initialized from the live grid
  const editorState = createEditorState(liveGrid.width, liveGrid.height);
  editorState.importGrid(serializeGrid(liveGrid));
  setEditorContext({ state: editorState });

  // Play/Edit mode
  let mode = $state<"play" | "edit">("play");

  // Key to force remount of PlayMode when grid changes
  let playKey = $state(0);

  function switchToEdit() {
    editorState.importGrid(serializeGrid(liveGrid));
    mode = "edit";
  }

  function switchToPlay() {
    liveGrid = deserializeGrid(editorState.exportGrid());
    playKey++;
    mode = "play";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (mode === "play") switchToEdit();
      else switchToPlay();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="museum-2d-module">
  <div class="mode-bar">
    <button
      type="button"
      class="mode-btn"
      class:active={mode === "play"}
      onclick={() => { if (mode !== "play") switchToPlay(); }}
    >
      <i class="fas fa-gamepad" aria-hidden="true"></i>
      Play
    </button>
    <button
      type="button"
      class="mode-btn"
      class:active={mode === "edit"}
      onclick={() => { if (mode !== "edit") switchToEdit(); }}
    >
      <i class="fas fa-pen" aria-hidden="true"></i>
      Edit
    </button>
    <span class="mode-hint">Tab to toggle</span>
  </div>

  <div class="mode-content">
    {#if mode === "play"}
      {#key playKey}
        <Museum2DPlayMode grid={liveGrid} />
      {/key}
    {:else}
      <Museum2DEditor />
    {/if}
  </div>
</div>

<style>
  .museum-2d-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #0a0a0a;
  }

  .mode-bar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    background: rgba(18, 18, 28, 0.98);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .mode-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 12px;
    background: transparent;
    border: 1.5px solid transparent;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.15s;
  }

  .mode-btn:hover {
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.04);
  }

  .mode-btn.active {
    color: rgba(200, 180, 140, 0.9);
    border-color: rgba(200, 180, 140, 0.3);
    background: rgba(200, 180, 140, 0.06);
  }

  .mode-hint {
    margin-left: auto;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.15);
  }

  .mode-content {
    flex: 1;
    overflow: hidden;
  }
</style>
