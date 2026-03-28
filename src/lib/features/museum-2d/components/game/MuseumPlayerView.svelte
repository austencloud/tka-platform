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

  let style = $derived(
    `transform: translate(${x * tileSize}px, ${y * tileSize}px); ` +
    `width: ${tileSize}px; height: ${tileSize}px;`
  );

  let facingDeg = $derived(FACING_ROTATION[facing]);
</script>

<div class="museum-player" class:moving={isMoving} {style}>
  <!-- Ambient glow ring behind the body -->
  <div class="glow-ring"></div>

  <!-- Main body: large gold circle -->
  <div class="player-body">
    <!-- Person silhouette: head + torso using stacked shapes -->
    <div class="person-icon">
      <div class="person-head"></div>
      <div class="person-torso"></div>
    </div>

    <!-- Directional chevron rotated to face current direction -->
    <div class="facing-indicator" style="transform: rotate({facingDeg}deg)">
      <div class="facing-chevron">
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
    /* Minimal padding so the body fills ~75% of the tile */
    padding: 12%;
    box-sizing: border-box;
  }

  .museum-player.moving {
    transition-duration: 0.12s;
  }

  /* Soft ambient glow behind the player — slightly larger than the body */
  .glow-ring {
    position: absolute;
    width: 90%;
    height: 90%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 70%);
    animation: glow-pulse 2.5s ease-in-out infinite;
  }

  @keyframes glow-pulse {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50%       { transform: scale(1.15); opacity: 1; }
  }

  /* Gold circle that fills the padded area */
  .player-body {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: radial-gradient(circle at 38% 32%, #fde68a, #f59e0b 55%, #b45309);
    border: 2px solid rgba(253, 230, 138, 0.7);
    box-shadow:
      0 0 14px rgba(245, 158, 11, 0.5),
      0 3px 8px rgba(0, 0, 0, 0.55),
      inset 0 -3px 6px rgba(0, 0, 0, 0.25),
      inset 0 3px 6px rgba(255, 255, 255, 0.25);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  /* Simple CSS person silhouette — head (circle) + torso (rounded rect) */
  .person-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6%;
    /* Nudge slightly upward so the chevron has room at the bottom */
    margin-top: -6%;
    pointer-events: none;
  }

  .person-head {
    width: 28%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: #1a1208;
    flex-shrink: 0;
  }

  .person-torso {
    width: 44%;
    height: 30%;
    border-radius: 40% 40% 20% 20% / 50% 50% 20% 20%;
    background: #1a1208;
    flex-shrink: 0;
  }

  /* Rotates to match facing direction; sits inside the gold circle */
  .facing-indicator {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    transition: transform 0.1s ease;
    /* Don't let this block the person icon underneath */
    pointer-events: none;
  }

  /* Chevron arrow positioned at the top edge of the circle */
  .facing-chevron {
    position: absolute;
    top: 6%;
    width: 36%;
    height: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 3px rgba(255, 240, 180, 0.9));
  }

  .facing-chevron svg {
    width: 100%;
    height: auto;
    display: block;
  }
</style>
