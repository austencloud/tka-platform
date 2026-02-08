<script lang="ts">
  import type { PositionGroup } from "../domain/level5-lab-types";
  import {
    TAU_DIAMOND_POSITIONS,
    TAU_BOX_POSITIONS,
    TERRA_POSITIONS,
  } from "../domain/level5-position-data";

  let {
    selectedGroup,
    onSelect,
  } = $props<{
    selectedGroup: PositionGroup;
    onSelect: (group: PositionGroup) => void;
  }>();

  const totalCount =
    TAU_DIAMOND_POSITIONS.length +
    TAU_BOX_POSITIONS.length +
    TERRA_POSITIONS.length;
</script>

<nav class="filter-chips">
  <button
    class="chip"
    class:active={selectedGroup === "all"}
    onclick={() => onSelect("all")}
  >
    All
    <span class="count">{totalCount}</span>
  </button>
  <button
    class="chip tau"
    class:active={selectedGroup === "tau-diamond"}
    onclick={() => onSelect("tau-diamond")}
  >
    Tau Diamond
    <span class="count">{TAU_DIAMOND_POSITIONS.length}</span>
  </button>
  <button
    class="chip tau"
    class:active={selectedGroup === "tau-box"}
    onclick={() => onSelect("tau-box")}
  >
    Tau Box
    <span class="count">{TAU_BOX_POSITIONS.length}</span>
  </button>
  <button
    class="chip terra"
    class:active={selectedGroup === "terra"}
    onclick={() => onSelect("terra")}
  >
    Terra
    <span class="count">{TERRA_POSITIONS.length}</span>
  </button>
</nav>

<style>
  .filter-chips {
    display: flex;
    gap: 0.5rem;
    padding: 0 1.5rem 1rem;
    flex-shrink: 0;
  }

  .chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 9999px;
    background: transparent;
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .chip.active {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, #fff);
  }

  .chip.tau.active {
    border-color: #22d3ee;
  }

  .chip.terra.active {
    border-color: #fbbf24;
  }

  .chip .count {
    font-size: var(--font-size-compact, 12px);
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.1);
  }

  .chip.active .count {
    background: rgba(255, 255, 255, 0.15);
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .chip:active:not(:disabled) {
    transform: scale(0.97);
  }

  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition: none;
    }
    .chip:active:not(:disabled) {
      transform: none;
    }
  }
</style>
