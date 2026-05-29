<!--
  TriGridPositionInfo.svelte - Displays current position classification.

  Shows the position group (beta/gamma), hand locations, and available letter types.
-->
<script lang="ts">
  import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { TriGridMode } from "../domain/trigrid-types";
  import { getTriGridPositionResolver } from "../get-tri-grid-position-resolver";
  import { TRIGRID_AVAILABLE_LETTER_TYPES } from "../domain/trigrid-constants";

  interface Props {
    blueLocation: GridLocation;
    redLocation: GridLocation;
    mode: TriGridMode;
  }

  const { blueLocation, redLocation, mode }: Props = $props();

  const resolver = getTriGridPositionResolver();

  const positionInfo = $derived(resolver.resolvePosition(blueLocation, redLocation, mode));

  const typeDescriptions: Record<number, string> = {
    1: "Dual-Shift (both shift)",
    2: "Shift (one shifts, one static)",
    6: "Static (both stationary)",
  };
</script>

<div class="position-info">
  <h3>Position</h3>

  {#if positionInfo}
    <div class="info-row">
      <span class="info-label">Group</span>
      <span class="info-value group-badge" class:beta={positionInfo.group === "beta"} class:gamma={positionInfo.group === "gamma"}>
        {positionInfo.group}
      </span>
    </div>
    <div class="info-row">
      <span class="info-label">Name</span>
      <span class="info-value">{positionInfo.label}</span>
    </div>
  {:else}
    <div class="info-row">
      <span class="info-label">Group</span>
      <span class="info-value dimmed">Unknown</span>
    </div>
  {/if}

  <div class="separator"></div>

  <h3>Available Types</h3>
  <div class="type-list">
    {#each TRIGRID_AVAILABLE_LETTER_TYPES as typeNum}
      <div class="type-item">
        <span class="type-num">Type {typeNum}</span>
        <span class="type-desc">{typeDescriptions[typeNum]}</span>
      </div>
    {/each}
  </div>

  <div class="note">
    No dash motions (no opposite points on 3-point grid).
    Types 3, 4, 5 are unavailable.
  </div>
</div>

<style>
  .position-info {
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  h3 {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0 0 8px 0;
  }

  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
  }

  .info-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .info-value {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #ffffff);
    font-weight: 500;
  }

  .info-value.dimmed {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  .group-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    text-transform: uppercase;
  }

  .group-badge.beta {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }

  .group-badge.gamma {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  .separator {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: 12px 0;
  }

  .type-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .type-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .type-num {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-accent, #10b981);
    white-space: nowrap;
  }

  .type-desc {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .note {
    margin-top: 12px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    line-height: 1.4;
  }
</style>
