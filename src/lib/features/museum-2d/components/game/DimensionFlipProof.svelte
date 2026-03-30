<script lang="ts">
  import { Canvas } from "@threlte/core";
  import Museum3DScene from "./Museum3DScene.svelte";
  import { buildMuseumGrid } from "../../services/implementations/MuseumGridBuilder";
  import { MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG } from "../../data/museum-room-graph";

  import { onMount } from "svelte";

  // Build the actual museum grid from room graph data
  const { grid } = buildMuseumGrid(MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG);

  // State shared between the outer component (buttons) and inner scene
  let flipRequested = $state(0);

  function handleKey(e: KeyboardEvent) {
    if (e.key === "q" || e.key === "Q") {
      e.preventDefault();
      flipRequested++;
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });
</script>

<div class="proof-container">
  <div class="info-bar">
    <span class="info-label">3D Museum — {grid.tiles.size} tiles across {grid.wings.length} rooms</span>
    <button class="flip-btn" onclick={() => flipRequested++}>
      Q to flip dimension
    </button>
    <span class="controls-hint">WASD to move • Mouse to look • ESC to exit</span>
  </div>

  <div class="canvas-area">
    <Canvas>
      <Museum3DScene {grid} {flipRequested} />
    </Canvas>
  </div>
</div>

<style>
  .proof-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #0a0a0a;
  }

  .info-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 16px;
    background: rgba(18, 18, 28, 0.98);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .info-label {
    color: rgba(200, 180, 140, 0.8);
    font-family: Georgia, serif;
    font-size: 14px;
  }

  .flip-btn {
    padding: 6px 16px;
    background: rgba(200, 180, 140, 0.08);
    border: 1.5px solid rgba(200, 180, 140, 0.25);
    border-radius: 6px;
    color: rgba(200, 180, 140, 0.7);
    font-size: 13px;
    cursor: pointer;
  }

  .flip-btn:hover {
    background: rgba(200, 180, 140, 0.15);
  }

  .controls-hint {
    margin-left: auto;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
  }

  .canvas-area {
    flex: 1;
    overflow: hidden;
  }
</style>
