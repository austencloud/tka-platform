<!--
  AsciiOverridePanel.svelte — Manual controls for tweaking hand parameters.
  Domain: Retro DOS Terminal Lab
-->
<script lang="ts">
  import type { RetroHandData } from "$lib/features/retro/shared/domain/pictograph-types";
  import {
    GridLocation,
    MotionType,
    Orientation,
  } from "$lib/features/retro/shared/domain/pictograph-types";

  let {
    blueHand,
    redHand,
    onUpdateBlue,
    onUpdateRed,
    onReset,
    hasLoadedData,
  }: {
    blueHand: RetroHandData;
    redHand: RetroHandData;
    onUpdateBlue: (updates: Partial<RetroHandData>) => void;
    onUpdateRed: (updates: Partial<RetroHandData>) => void;
    onReset: () => void;
    hasLoadedData: boolean;
  } = $props();

  const LOCATIONS = Object.values(GridLocation);
  const MOTION_TYPES = Object.values(MotionType);
  const ORIENTATIONS = Object.values(Orientation);

  function formatLabel(val: string): string {
    return val.replace(/_/g, " ").toLowerCase();
  }
</script>

<div class="override-panel">
  <div class="hand-row">
    <span class="hand-label blue-label">Blue</span>
    <select
      value={blueHand.location}
      onchange={(e) => onUpdateBlue({ location: (e.target as HTMLSelectElement).value as GridLocation })}
    >
      {#each LOCATIONS as loc}
        <option value={loc}>{formatLabel(loc)}</option>
      {/each}
    </select>
    <select
      value={blueHand.endLocation}
      onchange={(e) => onUpdateBlue({ endLocation: (e.target as HTMLSelectElement).value as GridLocation })}
    >
      {#each LOCATIONS as loc}
        <option value={loc}>{formatLabel(loc)}</option>
      {/each}
    </select>
    <select
      value={blueHand.motionType}
      onchange={(e) => onUpdateBlue({ motionType: (e.target as HTMLSelectElement).value as MotionType })}
    >
      {#each MOTION_TYPES as mt}
        <option value={mt}>{formatLabel(mt)}</option>
      {/each}
    </select>
    <select
      value={blueHand.orientation}
      onchange={(e) => onUpdateBlue({ orientation: (e.target as HTMLSelectElement).value as Orientation })}
    >
      {#each ORIENTATIONS as ori}
        <option value={ori}>{formatLabel(ori)}</option>
      {/each}
    </select>
  </div>

  <div class="hand-row">
    <span class="hand-label red-label">Red</span>
    <select
      value={redHand.location}
      onchange={(e) => onUpdateRed({ location: (e.target as HTMLSelectElement).value as GridLocation })}
    >
      {#each LOCATIONS as loc}
        <option value={loc}>{formatLabel(loc)}</option>
      {/each}
    </select>
    <select
      value={redHand.endLocation}
      onchange={(e) => onUpdateRed({ endLocation: (e.target as HTMLSelectElement).value as GridLocation })}
    >
      {#each LOCATIONS as loc}
        <option value={loc}>{formatLabel(loc)}</option>
      {/each}
    </select>
    <select
      value={redHand.motionType}
      onchange={(e) => onUpdateRed({ motionType: (e.target as HTMLSelectElement).value as MotionType })}
    >
      {#each MOTION_TYPES as mt}
        <option value={mt}>{formatLabel(mt)}</option>
      {/each}
    </select>
    <select
      value={redHand.orientation}
      onchange={(e) => onUpdateRed({ orientation: (e.target as HTMLSelectElement).value as Orientation })}
    >
      {#each ORIENTATIONS as ori}
        <option value={ori}>{formatLabel(ori)}</option>
      {/each}
    </select>
  </div>

  {#if hasLoadedData}
    <button class="reset-btn" onclick={onReset}>Reset to loaded</button>
  {/if}
</div>

<style>
  .override-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .hand-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .hand-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    min-width: 40px;
    font-family: "Courier New", monospace;
  }

  .blue-label { color: #3333ff; }
  .red-label { color: #ff3333; }

  select {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    padding: 4px 6px;
    cursor: pointer;
  }

  select:focus {
    outline: 2px solid #33ff33;
    outline-offset: 1px;
  }

  .reset-btn {
    align-self: flex-start;
    padding: 4px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .reset-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
    color: var(--theme-text, #fff);
  }
</style>
