<script lang="ts">
  import { onMount } from "svelte";
  import { getMuseum2DContext } from "../../state/museum-2d-context";
  import { tileKey } from "../../domain/museum-grid-types";
  import type { Direction, MuseumTile } from "../../domain/museum-grid-types";
  import MuseumTileRenderer from "./MuseumTileRenderer.svelte";
  import MuseumPlayerView from "./MuseumPlayerView.svelte";
  import MuseumCamera from "./MuseumCamera.svelte";
  import InteractionPrompt from "./InteractionPrompt.svelte";

  const TILE_SIZE = 32;

  const { state } = getMuseum2DContext();

  // Key → Direction mapping
  const KEY_TO_DIRECTION: Record<string, Direction> = {
    ArrowUp: "north", w: "north", W: "north",
    ArrowDown: "south", s: "south", S: "south",
    ArrowLeft: "west", a: "west", A: "west",
    ArrowRight: "east", d: "east", D: "east",
  };

  function handleKeyDown(e: KeyboardEvent) {
    // Interact
    if (e.key === "e" || e.key === "E") {
      e.preventDefault();
      state.interact();
      return;
    }

    const direction = KEY_TO_DIRECTION[e.key];
    if (!direction) return;
    e.preventDefault();
    if (e.repeat) return;

    state.onDirectionDown(direction);
  }

  function handleKeyUp(e: KeyboardEvent) {
    const direction = KEY_TO_DIRECTION[e.key];
    if (!direction) return;
    state.onDirectionUp(direction);
  }

  onMount(() => {
    state.start();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      state.stop();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  });

  // Build flat tile array for rendering the CSS grid
  interface TileEntry {
    x: number;
    y: number;
    tile: MuseumTile | null;
  }

  let tiles = $derived.by(() => {
    const result: TileEntry[] = [];
    for (let y = 0; y < state.grid.height; y++) {
      for (let x = 0; x < state.grid.width; x++) {
        const tile = state.grid.tiles.get(tileKey(x, y)) ?? null;
        result.push({ x, y, tile });
      }
    }
    return result;
  });

  let gridStyle = $derived(
    `grid-template-columns: repeat(${state.grid.width}, ${TILE_SIZE}px); ` +
    `grid-template-rows: repeat(${state.grid.height}, ${TILE_SIZE}px);`
  );
</script>

<div class="museum-game" role="application" aria-label="Museum 2D game">
  <MuseumCamera
    playerX={state.cameraX}
    playerY={state.cameraY}
    tileSize={TILE_SIZE}
    gridWidth={state.grid.width}
    gridHeight={state.grid.height}
  >
    <div class="tile-grid" style={gridStyle}>
      {#each tiles as entry (entry.x + "," + entry.y)}
        {#if entry.tile}
          <MuseumTileRenderer tile={entry.tile} tileSize={TILE_SIZE} />
        {:else}
          <div class="void-tile" style="width: {TILE_SIZE}px; height: {TILE_SIZE}px;"></div>
        {/if}
      {/each}
    </div>

    <MuseumPlayerView
      x={state.visualX}
      y={state.visualY}
      facing={state.playerFacing}
      tileSize={TILE_SIZE}
      isMoving={state.isMoving}
    />
  </MuseumCamera>

  <InteractionPrompt />
</div>

<style>
  .museum-game {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    border-radius: 4px;
  }

  .tile-grid {
    display: grid;
    gap: 0;
  }

  .void-tile {
    background: #0a0a0a;
  }
</style>
