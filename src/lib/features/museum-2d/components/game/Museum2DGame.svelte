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

  // Key-to-direction mapping (WASD + arrows)
  const KEY_MAP: Record<string, Direction> = {
    ArrowUp: "north",
    ArrowDown: "south",
    ArrowLeft: "west",
    ArrowRight: "east",
    w: "north",
    W: "north",
    s: "south",
    S: "south",
    a: "west",
    A: "west",
    d: "east",
    D: "east",
  };

  // Auto-repeat: 200ms initial delay, then 100ms interval
  let activeKey: string | null = null;
  let repeatTimer: ReturnType<typeof setTimeout> | null = null;
  let repeatInterval: ReturnType<typeof setInterval> | null = null;

  function clearRepeat() {
    if (repeatTimer) { clearTimeout(repeatTimer); repeatTimer = null; }
    if (repeatInterval) { clearInterval(repeatInterval); repeatInterval = null; }
    activeKey = null;
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Interact
    if (e.key === "e" || e.key === "E") {
      e.preventDefault();
      state.interact();
      return;
    }

    const direction = KEY_MAP[e.key];
    if (!direction) return;

    e.preventDefault();

    // If this key is already held, browser repeat will re-fire keydown.
    // We handle our own repeat, so ignore browser repeats.
    if (e.repeat) return;

    // If a different key was being held, cancel its repeat
    if (activeKey && activeKey !== e.key) {
      clearRepeat();
    }

    if (activeKey === e.key) return;

    activeKey = e.key;

    // Immediate first move
    state.movePlayer(direction);

    // After 200ms delay, start repeating at 100ms
    repeatTimer = setTimeout(() => {
      repeatInterval = setInterval(() => {
        const dir = KEY_MAP[activeKey ?? ""];
        if (dir) state.movePlayer(dir);
      }, 100);
    }, 200);
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.key === activeKey) {
      clearRepeat();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      clearRepeat();
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
    playerX={state.playerX}
    playerY={state.playerY}
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
      x={state.playerX}
      y={state.playerY}
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
