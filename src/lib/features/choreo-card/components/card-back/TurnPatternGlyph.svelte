<!--
  TurnPatternGlyph — Tiny bar chart showing per-step turn values.
  Period-compressed: shows only the minimum repeating unit.
  Used on card backs to identify which turn pattern deck a card belongs to.
-->
<script lang="ts">
  interface Props {
    entries: { blue: number; red: number }[];
  }

  const { entries }: Props = $props();

  // Height per turn unit in cqi
  const HEIGHT_PER_TURN = 1.8;
  const MIN_HEIGHT = 0.5;

  function barHeight(value: number): number {
    return value === 0 ? MIN_HEIGHT : value * HEIGHT_PER_TURN;
  }
</script>

<div class="turn-glyph">
  {#each entries as entry}
    <div class="bar-group">
      <div class="bar blue" style="height: {barHeight(entry.blue)}cqi;"></div>
      <div class="bar red" style="height: {barHeight(entry.red)}cqi;"></div>
    </div>
  {/each}
</div>

<style>
  .turn-glyph {
    display: flex;
    gap: 0.6cqi;
    align-items: flex-end;
    height: 6cqi;
  }

  .bar-group {
    display: flex;
    gap: 0.25cqi;
    align-items: flex-end;
  }

  .bar {
    width: 1.1cqi;
    border-radius: 0.2cqi 0.2cqi 0 0;
    min-height: 0.5cqi;
  }

  .bar.blue { background: var(--tka-blue-hand, #3498db); }
  .bar.red { background: var(--tka-red-hand, #e74c3c); }
</style>
