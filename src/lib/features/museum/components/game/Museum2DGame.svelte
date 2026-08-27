<script lang="ts">
  import { onMount } from "svelte";
  import { getMuseumContext } from "../../state/museum-context";
  import { tileKey } from "../../domain/museum-grid-types";
  import type { Direction, MuseumTile } from "../../domain/museum-grid-types";
  import type { AvatarState } from "../../state/avatar-state.svelte";
  import MuseumTileRenderer from "./MuseumTileRenderer.svelte";
  import MuseumPlayerView from "./MuseumPlayerView.svelte";
  import MuseumCamera from "./MuseumCamera.svelte";
  import InteractionPrompt from "./InteractionPrompt.svelte";

  interface Props {
    avatar: AvatarState;
  }

  let { avatar }: Props = $props();

  const TILE_SIZE = 32;

  const { state } = getMuseumContext();

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

  // When the window loses focus or a context menu opens, keyup events
  // are swallowed. Clear all held directions to prevent ghost movement.
  function handleFocusLoss() {
    state.clearAllDirections();
  }

  function handleContextMenu(e: Event) {
    e.preventDefault();
    state.clearAllDirections();
  }

  onMount(() => {
    state.start();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleFocusLoss);
    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      state.stop();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleFocusLoss);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  });

  // Build tile array ONCE at mount (tiles are static, never change during gameplay).
  // Use viewport culling to only render tiles near the player.
  interface TileEntry {
    x: number;
    y: number;
    tile: MuseumTile;
  }

  // One-time: build full tile list from sparse map
  const allTiles: TileEntry[] = (() => {
    const result: TileEntry[] = [];
    for (const [key, tile] of state.grid.tiles) {
      const [xStr, yStr] = key.split(",");
      result.push({ x: Number(xStr), y: Number(yStr), tile });
    }
    return result;
  })();

  // Viewport culling: only render tiles within ~30 tiles of the camera.
  // This reduces DOM elements from ~5000 to ~400-600.
  const CULL_RADIUS = 30;

  let visibleTiles = $derived.by(() => {
    const cx = Math.round(state.cameraX);
    const cy = Math.round(state.cameraY);
    return allTiles.filter(
      (t) =>
        t.x >= cx - CULL_RADIUS &&
        t.x <= cx + CULL_RADIUS &&
        t.y >= cy - CULL_RADIUS &&
        t.y <= cy + CULL_RADIUS,
    );
  });

  const containerStyle =
    `width: ${state.grid.width * TILE_SIZE}px; height: ${state.grid.height * TILE_SIZE}px; position: relative;`;

  // Pre-compute torch positions for glow rendering (static, computed once)
  const torchPositions: { x: number; y: number }[] = (() => {
    const result: { x: number; y: number }[] = [];
    for (const [key, tile] of state.grid.tiles) {
      if (tile.type === "torch") {
        const [xStr, yStr] = key.split(",");
        result.push({ x: Number(xStr), y: Number(yStr) });
      }
    }
    return result;
  })();

  // Visible torches for glow layer
  let visibleTorches = $derived.by(() => {
    const cx = Math.round(state.cameraX);
    const cy = Math.round(state.cameraY);
    return torchPositions.filter(
      (t) =>
        t.x >= cx - CULL_RADIUS - 5 &&
        t.x <= cx + CULL_RADIUS + 5 &&
        t.y >= cy - CULL_RADIUS - 5 &&
        t.y <= cy + CULL_RADIUS + 5,
    );
  });

  // Wing theme lookup: given a tile coordinate, find its wing theme for color tinting
  function getWingTheme(x: number, y: number): string | null {
    for (const wing of state.grid.wings) {
      const b = wing.bounds;
      if (x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height) {
        return wing.theme ?? null;
      }
    }
    return null;
  }
</script>

<div class="museum-game" role="application" aria-label="The Archive game">
  <MuseumCamera
    playerX={state.cameraX}
    playerY={state.cameraY}
    tileSize={TILE_SIZE}
    gridWidth={state.grid.width}
    gridHeight={state.grid.height}
  >
    <div class="tile-container" style={containerStyle}>
      {#each visibleTiles as entry (entry.x + "," + entry.y)}
        {@const theme = getWingTheme(entry.x, entry.y)}
        <div
          class="tile-positioned"
          class:theme-cave={theme === "cave"}
          class:theme-classical={theme === "classical"}
          class:theme-renaissance={theme === "renaissance"}
          class:theme-industrial={theme === "industrial"}
          class:theme-digital={theme === "digital"}
          class:theme-institutional={theme === "institutional"}
          class:theme-gallery={theme === "gallery"}
          class:theme-outdoor={theme === "outdoor"}
          class:theme-construction={theme === "construction"}
          class:theme-retail={theme === "retail"}
          style="left: {entry.x * TILE_SIZE}px; top: {entry.y * TILE_SIZE}px; width: {TILE_SIZE}px; height: {TILE_SIZE}px;"
        >
          <MuseumTileRenderer tile={entry.tile} tileSize={TILE_SIZE} />
        </div>
      {/each}

      <!-- Torch glow layer - renders warm light pools around torch tiles -->
      {#each visibleTorches as torch (torch.x + "," + torch.y)}
        <div
          class="torch-glow"
          style="left: {(torch.x - 4) * TILE_SIZE}px; top: {(torch.y - 4) * TILE_SIZE}px; width: {9 * TILE_SIZE}px; height: {9 * TILE_SIZE}px;"
        ></div>
      {/each}
    </div>

    <MuseumPlayerView
      x={state.visualX}
      y={state.visualY}
      facing={state.visualFacing}
      tileSize={TILE_SIZE}
      isMoving={state.isMoving}
      {avatar}
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

  .tile-container {
    background: #050508;
  }

  .tile-positioned {
    position: absolute;
    contain: strict;
  }


  .torch-glow {
    position: absolute;
    pointer-events: none;
    z-index: 5;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(255, 160, 40, 0.12) 0%,
      rgba(255, 120, 20, 0.06) 35%,
      transparent 70%
    );
    mix-blend-mode: screen;
    animation: torch-breathe 3s ease-in-out infinite alternate;
  }

  @keyframes torch-breathe {
    0% { opacity: 0.7; transform: scale(0.95); }
    100% { opacity: 1; transform: scale(1.05); }
  }


  .theme-cave :global(.museum-tile.tile-floor),
  .theme-cave :global(.museum-tile.tile-corridor) {
    background-color: #1e1810;
  }
  .theme-cave :global(.museum-tile.tile-wall) {
    background-color: #14100a;
  }

  .theme-classical :global(.museum-tile.tile-floor),
  .theme-classical :global(.museum-tile.tile-corridor) {
    background-color: #221e14;
  }
  .theme-classical :global(.museum-tile.tile-wall) {
    background-color: #181408;
  }

  .theme-renaissance :global(.museum-tile.tile-floor),
  .theme-renaissance :global(.museum-tile.tile-corridor) {
    background-color: #1e1a10;
  }
  .theme-renaissance :global(.museum-tile.tile-wall) {
    background-color: #141008;
  }

  .theme-industrial :global(.museum-tile.tile-floor),
  .theme-industrial :global(.museum-tile.tile-corridor) {
    background-color: #181820;
  }
  .theme-industrial :global(.museum-tile.tile-wall) {
    background-color: #0e0e18;
  }

  .theme-digital :global(.museum-tile.tile-floor),
  .theme-digital :global(.museum-tile.tile-corridor) {
    background-color: #0c1420;
  }
  .theme-digital :global(.museum-tile.tile-wall) {
    background-color: #080e18;
  }

  .theme-institutional :global(.museum-tile.tile-floor),
  .theme-institutional :global(.museum-tile.tile-corridor) {
    background-color: #1a1a20;
  }
  .theme-institutional :global(.museum-tile.tile-wall) {
    background-color: #121218;
  }

  .theme-gallery :global(.museum-tile.tile-floor),
  .theme-gallery :global(.museum-tile.tile-corridor) {
    background-color: #201a10;
  }
  .theme-gallery :global(.museum-tile.tile-wall) {
    background-color: #181208;
  }

  .theme-outdoor :global(.museum-tile.tile-floor),
  .theme-outdoor :global(.museum-tile.tile-corridor) {
    background-color: #101a10;
  }
  .theme-outdoor :global(.museum-tile.tile-wall) {
    background-color: #0a140a;
  }

  .theme-construction :global(.museum-tile.tile-floor),
  .theme-construction :global(.museum-tile.tile-corridor) {
    background-color: #1a1410;
  }
  .theme-construction :global(.museum-tile.tile-wall) {
    background-color: #120e08;
  }

  .theme-retail :global(.museum-tile.tile-floor),
  .theme-retail :global(.museum-tile.tile-corridor) {
    background-color: #1e1e22;
  }
  .theme-retail :global(.museum-tile.tile-wall) {
    background-color: #141418;
  }
</style>
