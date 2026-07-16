<!--
  TurnPatternGlyph - Tiny bar chart showing per-step turn values.
  Period-compressed: shows only the minimum repeating unit.
  Float motions render as hatched bars at a fixed height.

  Long patterns scale horizontally to fit the glyph box (shared geometry
  in turn-glyph-layout.ts, mirrored by the print rasterizer). Heights
  never scale — bar height encodes the turn value.
-->
<script lang="ts">
  import { layoutTurnGlyph } from "./turn-glyph-layout";

  interface Props {
    entries: { blue: number; red: number; blueFloat?: boolean; redFloat?: boolean }[];
    /** Width of the containing glyph box, cqi. CardBack's box is 10cqi. */
    maxWidthCqi?: number;
  }

  const { entries, maxWidthCqi = 10 }: Props = $props();

  const HEIGHT_PER_TURN = 1.8;
  const MIN_HEIGHT = 0.5;
  const FLOAT_HEIGHT = 1.2;

  const layout = $derived(layoutTurnGlyph(entries.length, maxWidthCqi));

  function barHeight(value: number, isFloat: boolean): number {
    if (isFloat) return FLOAT_HEIGHT;
    return value === 0 ? MIN_HEIGHT : value * HEIGHT_PER_TURN;
  }
</script>

<div class="turn-glyph">
  <div
    class="bars-row"
    style="gap: {layout.groupGap}cqi; --bar-w: {layout.barW}cqi; --intra-gap: {layout.intraGap}cqi; --bar-radius: {layout.radius}cqi; --hatch-step: {0.4 * layout.scale}cqi;"
  >
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
    align-items: flex-end;
  }

  .bar-group {
    display: flex;
    gap: var(--intra-gap);
    align-items: flex-end;
  }

  .bar {
    width: var(--bar-w);
    border-radius: var(--bar-radius) var(--bar-radius) 0 0;
    min-height: 0.5cqi;
  }

  .bar.blue { background: var(--tka-blue-hand, #3498db); }
  .bar.red { background: var(--tka-red-hand, #e74c3c); }

  .bar.float {
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent var(--hatch-step),
      currentColor var(--hatch-step),
      currentColor calc(var(--hatch-step) * 2)
    );
    opacity: 0.7;
  }

  .bar.float.blue { color: var(--tka-blue-hand, #3498db); }
  .bar.float.red { color: var(--tka-red-hand, #e74c3c); }
</style>
