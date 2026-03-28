<script lang="ts">
  import type { Direction } from "../../domain/museum-grid-types";

  interface Props {
    x: number;
    y: number;
    facing: Direction;
    tileSize: number;
    isMoving: boolean;
  }

  let { x, y, facing, tileSize, isMoving }: Props = $props();

  // Rotation for the facing indicator triangle
  const FACING_ROTATION: Record<Direction, number> = {
    north: 0,
    east: 90,
    south: 180,
    west: 270,
  };

  let style = $derived(
    `transform: translate(${x * tileSize}px, ${y * tileSize}px); ` +
    `width: ${tileSize}px; height: ${tileSize}px;`
  );

  let facingDeg = $derived(FACING_ROTATION[facing]);
</script>

<div class="museum-player" class:moving={isMoving} {style}>
  <div class="player-body">
    <div class="facing-indicator" style="transform: rotate({facingDeg}deg)">
      <div class="facing-arrow"></div>
    </div>
  </div>
</div>

<style>
  .museum-player {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 20;
    transition: transform 0.15s cubic-bezier(0.34, 1.2, 0.64, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20%;
    box-sizing: border-box;
  }

  .museum-player.moving {
    transition-duration: 0.12s;
  }

  .player-body {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, #e8d8a0, #c8a840);
    border: 2px solid rgba(200, 180, 120, 0.6);
    box-shadow:
      0 0 12px rgba(200, 170, 80, 0.4),
      0 2px 6px rgba(0, 0, 0, 0.4),
      inset 0 -2px 4px rgba(0, 0, 0, 0.2),
      inset 0 2px 4px rgba(255, 255, 255, 0.2);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: player-pulse 2.5s ease-in-out infinite;
  }

  @keyframes player-pulse {
    0%, 100% { box-shadow: 0 0 10px rgba(200, 170, 80, 0.3), 0 2px 6px rgba(0, 0, 0, 0.4); }
    50% { box-shadow: 0 0 18px rgba(200, 170, 80, 0.5), 0 2px 6px rgba(0, 0, 0, 0.4); }
  }

  .facing-indicator {
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    transition: transform 0.1s ease;
  }

  .facing-arrow {
    position: absolute;
    top: -2px;
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-bottom: 6px solid rgba(255, 240, 180, 0.8);
    filter: drop-shadow(0 0 2px rgba(200, 180, 100, 0.5));
  }
</style>
