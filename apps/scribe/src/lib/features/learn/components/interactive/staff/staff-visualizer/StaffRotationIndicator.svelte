<!--
StaffRotationIndicator - Shows prospin/antispin rotation type
-->
<script lang="ts">
  import {
    ROTATION_COLORS,
    type RotationType,
  } from "../../../../domain/constants/staff-visualizer-data";

  let { rotationType }: { rotationType: "prospin" | "antispin" } = $props();
</script>

<div
  class="rotation-indicator"
  style="--rotation-color: {ROTATION_COLORS[rotationType]}"
>
  <i
    class="fa-solid {rotationType === 'prospin' ? 'fa-sync-alt' : 'fa-retweet'}"
    aria-hidden="true"
  ></i>
  <span>{rotationType === "prospin" ? "Prospin" : "Antispin"}</span>
</div>

<style>
  .rotation-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: color-mix(in srgb, var(--rotation-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--rotation-color) 40%, transparent);
    border-radius: 8px;
    color: var(--rotation-color);
    font-size: 0.875rem;
    font-weight: 600;
  }
</style>
