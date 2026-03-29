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

  let bodySize = $derived(Math.max(14, Math.round(tileSize * 0.55)));
  let beamLength = $derived(Math.max(40, Math.round(tileSize * 2.8)));
  let facingDeg = $derived(FACING_ROTATION[facing]);
</script>

<div class="museum-player" class:moving={isMoving} style={posStyle}>
  <!-- Lantern beam: conic gradient cone pointing in facing direction -->
  <div
    class="lantern-beam"
    style="
      width: {beamLength}px;
      height: {beamLength}px;
      transform: rotate({facingDeg}deg);
    "
  ></div>

  <!-- Lantern glow: warm pool of light around the figure -->
  <div class="lantern-glow" style="width: {bodySize + 18}px; height: {bodySize + 18}px;"></div>

  <!-- The figure: a dark silhouette, deliberately ambiguous -->
  <div class="figure" style="width: {bodySize}px; height: {bodySize}px;">
    <div class="figure-head"></div>
    <div class="figure-body"></div>
    <!-- Lantern spot: small warm dot near right shoulder -->
    <div class="lantern-spot"></div>
  </div>
</div>

<style>
  .museum-player {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 20;
    will-change: transform;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Lantern beam: conic gradient cone of warm light ── */
  .lantern-beam {
    position: absolute;
    border-radius: 50%;
    background: conic-gradient(
      from -35deg,
      transparent 0deg,
      rgba(255, 180, 60, 0.06) 10deg,
      rgba(255, 160, 40, 0.12) 25deg,
      rgba(255, 180, 60, 0.06) 40deg,
      transparent 55deg,
      transparent 360deg
    );
    transform-origin: center center;
    translate: 0 -35%;
    pointer-events: none;
    animation: beam-flicker 3.2s ease-in-out infinite;
  }

  @keyframes beam-flicker {
    0%, 100% { opacity: 0.8; }
    25%      { opacity: 1; }
    50%      { opacity: 0.7; }
    75%      { opacity: 0.95; }
  }

  /* ── Lantern glow: warm pool around the figure ── */
  .lantern-glow {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(255, 170, 50, 0.22) 0%,
      rgba(255, 140, 30, 0.1) 45%,
      transparent 70%
    );
    animation: glow-breathe 3.8s ease-in-out infinite;
  }

  @keyframes glow-breathe {
    0%, 100% { transform: scale(1); opacity: 0.75; }
    50%      { transform: scale(1.08); opacity: 1; }
  }

  /* ── Figure: dark silhouette ── */
  .figure {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.9));
  }

  .figure-head {
    width: 48%;
    height: 48%;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, #2a2218, #0e0b06);
    border: 1px solid rgba(180, 140, 80, 0.12);
    position: relative;
    z-index: 1;
    animation: idle-breathe 3.5s ease-in-out infinite;
  }

  .figure-body {
    width: 72%;
    height: 42%;
    border-radius: 35% 35% 25% 25%;
    background: radial-gradient(circle at 45% 30%, #221c12, #0a0804);
    border: 1px solid rgba(180, 140, 80, 0.08);
    margin-top: -12%;
  }

  .lantern-spot {
    position: absolute;
    right: 5%;
    top: 35%;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #c8a050;
    box-shadow: 0 0 6px rgba(200, 160, 80, 0.6);
    animation: lantern-flicker 2.2s ease-in-out infinite;
  }

  @keyframes lantern-flicker {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    30%      { opacity: 0.8; transform: scale(1.2); }
    70%      { opacity: 0.4; transform: scale(0.9); }
  }

  @keyframes idle-breathe {
    0%, 100% { transform: translateY(0) scale(1); }
    50%      { transform: translateY(-0.4px) scale(1.03); }
  }

  /* ── Walking animation ── */
  .moving .figure-head {
    animation: walk-bob 0.32s steps(2) infinite;
  }

  .moving .figure-body {
    animation: walk-sway 0.32s steps(2) infinite;
  }

  @keyframes walk-bob {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-1.5px); }
  }

  @keyframes walk-sway {
    0%, 100% { transform: translateX(0) rotate(0deg); }
    50%      { transform: translateX(0.5px) rotate(1.5deg); }
  }
</style>
