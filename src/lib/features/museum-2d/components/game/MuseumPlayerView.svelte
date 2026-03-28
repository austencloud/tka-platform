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

  const FACING_ROTATION: Record<Direction, number> = {
    north: 0,
    east: 90,
    south: 180,
    west: 270,
  };

  let posStyle = $derived(
    `transform: translate(${x * tileSize}px, ${y * tileSize}px); ` +
    `width: ${tileSize}px; height: ${tileSize}px;`
  );

  // Scale the body to ~75% of tile, minimum 16px
  let bodySize = $derived(Math.max(16, Math.round(tileSize * 0.75)));
  let iconSize = $derived(Math.max(10, Math.round(bodySize * 0.5)));
  let chevronSize = $derived(Math.max(6, Math.round(bodySize * 0.3)));

  let facingDeg = $derived(FACING_ROTATION[facing]);
</script>

<div class="museum-player" class:moving={isMoving} style={posStyle}>
  <!-- Ambient glow -->
  <div
    class="glow-ring"
    style="width: {bodySize + 12}px; height: {bodySize + 12}px;"
  ></div>

  <!-- Main body circle -->
  <div
    class="player-body"
    style="width: {bodySize}px; height: {bodySize}px;"
  >
    <!-- Person icon using Font Awesome -->
    <i
      class="fas fa-person player-icon"
      style="font-size: {iconSize}px;"
      aria-hidden="true"
    ></i>

    <!-- Directional chevron -->
    <div
      class="facing-ring"
      style="transform: rotate({facingDeg}deg);"
    >
      <div class="chevron" style="width: {chevronSize}px;">
        <svg viewBox="0 0 12 8" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M1 7 L6 1 L11 7" stroke="#1a1208" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </div>
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
    box-sizing: border-box;
  }

  .museum-player.moving {
    transition-duration: 0.12s;
  }

  .glow-ring {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, transparent 70%);
    animation: glow-pulse 2.5s ease-in-out infinite;
  }

  @keyframes glow-pulse {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50%      { transform: scale(1.2); opacity: 1; }
  }

  .player-body {
    border-radius: 50%;
    background: radial-gradient(circle at 38% 32%, #fde68a, #f59e0b 55%, #b45309);
    border: 2px solid rgba(253, 230, 138, 0.7);
    box-shadow:
      0 0 14px rgba(245, 158, 11, 0.5),
      0 3px 8px rgba(0, 0, 0, 0.55),
      inset 0 -3px 6px rgba(0, 0, 0, 0.25),
      inset 0 3px 6px rgba(255, 255, 255, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
  }

  .player-icon {
    color: #1a1208;
    line-height: 1;
    pointer-events: none;
  }

  .facing-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    transition: transform 0.1s ease;
    pointer-events: none;
  }

  .chevron {
    position: absolute;
    top: -2px;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 3px rgba(255, 240, 180, 0.9));
  }

  .chevron svg {
    width: 100%;
    height: auto;
    display: block;
  }
</style>
