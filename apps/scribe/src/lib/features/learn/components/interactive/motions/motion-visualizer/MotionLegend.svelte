<!--
MotionLegend - Shows left and right hand motion types
-->
<script lang="ts">
  import {
    MOTION_COLORS,
    LEFT_HAND_COLOR,
    RIGHT_HAND_COLOR,
    type MotionType,
  } from "../../../../domain/constants/motion-visualizer-data";

  let {
    leftMotion,
    rightMotion,
  }: {
    leftMotion: MotionType;
    rightMotion: MotionType;
  } = $props();
</script>

<div class="motion-legend">
  <div class="legend-item" style="--motion-color: {MOTION_COLORS[leftMotion]}">
    <div class="legend-dot" style="background: {LEFT_HAND_COLOR}"></div>
    <span class="legend-label">Left:</span>
    <span class="legend-motion">{leftMotion}</span>
  </div>
  <div class="legend-item" style="--motion-color: {MOTION_COLORS[rightMotion]}">
    <div class="legend-dot" style="background: {RIGHT_HAND_COLOR}"></div>
    <span class="legend-label">Right:</span>
    <span class="legend-motion">{rightMotion}</span>
  </div>
</div>

<style>
  .motion-legend {
    display: flex;
    gap: 1.25rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--theme-text-dim);
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .legend-label {
    color: var(--theme-text-dim);
  }

  .legend-motion {
    font-weight: 600;
    color: var(--motion-color);
    text-transform: capitalize;
  }

  @media (max-width: 400px) {
    .motion-legend {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>
