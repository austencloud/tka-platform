<!--
  TurnPatternGlyph - Tiny bar chart showing per-step turn values.
  Period-compressed: shows only the minimum repeating unit.
  Float motions render as hatched bars at a fixed height.
-->
<script lang="ts">
  interface Props {
    entries: { blue: number; red: number; blueFloat?: boolean; redFloat?: boolean }[];
  }

  const { entries }: Props = $props();

  const HEIGHT_PER_TURN = 1.8;
  const MIN_HEIGHT = 0.5;
  const FLOAT_HEIGHT = 1.2;

  function barHeight(value: number, isFloat: boolean): number {
    if (isFloat) return FLOAT_HEIGHT;
    return value === 0 ? MIN_HEIGHT : value * HEIGHT_PER_TURN;
  }
</script>

<div class="turn-glyph">
  <div class="bars-row">
    {#each entries as entry}
      <div class="bar-group">
        <div
          class="bar blue"
          class:float={entry.blueFloat}
          style="height: {barHeight(entry.blue, !!entry.blueFloat)}cqi;"
        ></div>
        <div
          class="bar red"
          class:float={entry.redFloat}
          style="height: {barHeight(entry.red, !!entry.redFloat)}cqi;"
        ></div>
      </div>
    {/each}
  </div>
</div>

<style>
  .turn-glyph {
    display: flex;
    align-items: flex-end;
  }

  .bars-row {
    display: flex;
    gap: 0.6cqi;
    align-items: flex-end;
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

  .bar.float {
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 0.4cqi,
      currentColor 0.4cqi,
      currentColor 0.8cqi
    );
    opacity: 0.7;
  }

  .bar.float.blue { color: var(--tka-blue-hand, #3498db); }
  .bar.float.red { color: var(--tka-red-hand, #e74c3c); }
</style>
