<!--
MotionTypeBadge - Shows the motion type number and name
-->
<script lang="ts">
  import {
    MOTION_TYPE_INFO,
    type MotionTypeNumber,
  } from "../../../../domain/constants/motion-visualizer-data";

  let {
    motionType,
  }: {
    motionType: MotionTypeNumber;
  } = $props();

  const info = $derived(MOTION_TYPE_INFO[motionType]);
</script>

<div class="motion-badge" style="--badge-color: {info.color}">
  <span class="badge-number">Type {motionType}</span>
  <span class="badge-name">{info.name}</span>
</div>

<style>
  .motion-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: color-mix(in srgb, var(--badge-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--badge-color) 40%, transparent);
    border-radius: 20px;
  }

  .badge-number {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--badge-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--badge-color);
  }
</style>
