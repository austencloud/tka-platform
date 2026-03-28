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

  // Movement key tracking for diagonal support
  const MOVE_KEYS = new Set(["w", "W", "ArrowUp", "s", "S", "ArrowDown", "a", "A", "ArrowLeft", "d", "D", "ArrowRight"]);

  const KEY_AXIS: Record<string, { dx: number; dy: number; facing: Direction }> = {
    ArrowUp:    { dx: 0,  dy: -1, facing: "north" },
    ArrowDown:  { dx: 0,  dy:  1, facing: "south" },
    ArrowLeft:  { dx: -1, dy:  0, facing: "west"  },
    ArrowRight: { dx: 1,  dy:  0, facing: "east"  },
    w:          { dx: 0,  dy: -1, facing: "north" },
    W:          { dx: 0,  dy: -1, facing: "north" },
    s:          { dx: 0,  dy:  1, facing: "south" },
    S:          { dx: 0,  dy:  1, facing: "south" },
    a:          { dx: -1, dy:  0, facing: "west"  },
    A:          { dx: -1, dy:  0, facing: "west"  },
    d:          { dx: 1,  dy:  0, facing: "east"  },
    D:          { dx: 1,  dy:  0, facing: "east"  },
  };

  // Track which movement keys are currently held
  let heldKeys = new Set<string>();

  // Timing constants
  const REPEAT_DELAY_MS = 150;   // Delay before auto-repeat starts
  const REPEAT_INTERVAL_MS = 100; // Interval between repeated moves

  let repeatTimer: ReturnType<typeof setTimeout> | null = null;
  let repeatInterval: ReturnType<typeof setInterval> | null = null;

  function clearRepeat() {
    if (repeatTimer) { clearTimeout(repeatTimer); repeatTimer = null; }
    if (repeatInterval) { clearInterval(repeatInterval); repeatInterval = null; }
  }

  /**
   * Resolve the current combined dx/dy from all held movement keys and
   * dispatch either a diagonal or cardinal move. Returns true if a move
   * was dispatched (even if blocked by collision).
   */
  function dispatchMovement(): boolean {
    let dx = 0;
    let dy = 0;
    let lastVerticalFacing: Direction | null = null;
    let lastHorizontalFacing: Direction | null = null;

    for (const key of heldKeys) {
      const axis = KEY_AXIS[key];
      if (!axis) continue;
      if (axis.dy !== 0) { dy += axis.dy; lastVerticalFacing = axis.facing; }
      if (axis.dx !== 0) { dx += axis.dx; lastHorizontalFacing = axis.facing; }
    }

    // Clamp to ±1 in each axis (handles conflicting directions — they cancel)
    dx = Math.sign(dx);
    dy = Math.sign(dy);

    if (dx === 0 && dy === 0) return false;

    if (dx !== 0 && dy !== 0) {
      // Diagonal: prefer vertical facing for consistency
      const facing = lastVerticalFacing ?? lastHorizontalFacing ?? "north";
      state.moveDiagonal(dx, dy, facing);
    } else if (dy !== 0) {
      const facing = lastVerticalFacing!;
      state.movePlayer(facing);
    } else {
      const facing = lastHorizontalFacing!;
      state.movePlayer(facing);
    }

    return true;
  }

  /**
   * Start the repeat loop after the initial immediate move.
   * On each tick, checks all held keys so diagonal emerges naturally
   * when both axes are held simultaneously.
   */
  function startRepeatLoop() {
    clearRepeat();
    if (heldKeys.size === 0) return;

    repeatTimer = setTimeout(() => {
      repeatInterval = setInterval(() => {
        dispatchMovement();
      }, REPEAT_INTERVAL_MS);
    }, REPEAT_DELAY_MS);
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Interact
    if (e.key === "e" || e.key === "E") {
      e.preventDefault();
      state.interact();
      return;
    }

    if (!MOVE_KEYS.has(e.key)) return;
    e.preventDefault();
    if (e.repeat) return;

    heldKeys.add(e.key);

    // First press is always immediate and cardinal (this key's direction only).
    // Diagonal movement emerges from held keys on repeat ticks — matching how
    // tile-based games (Pokemon, Zelda) handle it. Sequential presses stay
    // independent; holding both keys produces diagonals on the repeat cycle.
    dispatchMovement();
    startRepeatLoop();
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (!MOVE_KEYS.has(e.key)) return;
    heldKeys.delete(e.key);

    // If keys remain held, restart the repeat so the remaining direction
    // continues smoothly without an extra delay gap.
    if (heldKeys.size > 0) {
      startRepeatLoop();
    } else {
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
