<script lang="ts">
  /**
   * One Level-2 "Turns" teaching frame: the source artboard's minimal grid
   * (four hand-point dots + center, sized 1:1 to the PDF) with the red
   * staff/arrow drawing lifted vector-exact from that frame — see
   * `_data/lifted-turn-arrows.ts` (extracted from
   * D:/_THE KINETIC ALPHABET/_GUIDE/exports/level-2.pdf, pages 2/22/23).
   *
   * The app pictograph grid is deliberately NOT used here. It renders big outer
   * points (radius 300) plus connecting lines that the artboard never had, which
   * dwarf the artboard's short center→hand staff and read nothing like the
   * source. This 5-dot grid reproduces the artboard exactly: hand-point dots at
   * the canonical diamond coordinates (grid-coordinates.ts) and a smaller center
   * dot, both at the artboard's own dot sizes carried into the 950 viewBox (6pt
   * hand / 2.9pt center at the lift's 3.975 viewBox-per-pt calibration). Dots
   * inherit the page ink via currentColor; the red is the artboard red.
   */
  import {
    LIFTED_TURN_FRAMES,
    LIFTED_ARROW_RED,
    type LiftedPath,
  } from "../_data/lifted-turn-arrows";

  let { frameKey }: { frameKey: string } = $props();

  const HAND_POINTS = [
    { cx: 475, cy: 331.9 },
    { cx: 618.1, cy: 475 },
    { cx: 475, cy: 618.1 },
    { cx: 331.9, cy: 475 },
  ];
  const paths = $derived<LiftedPath[]>(LIFTED_TURN_FRAMES[frameKey] ?? []);
</script>

<svg class="lifted-frame" viewBox="0 0 950 950" aria-hidden="true">
  <g class="grid-dots">
    {#each HAND_POINTS as p (p.cx + "-" + p.cy)}
      <circle cx={p.cx} cy={p.cy} r="12" />
    {/each}
    <circle cx="475" cy="475" r="5.8" />
  </g>
  {#each paths as p, i (i)}
    <path d={p.d} fill={LIFTED_ARROW_RED} fill-rule={p.eo ? "evenodd" : "nonzero"} />
  {/each}
</svg>

<style>
  .lifted-frame {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .grid-dots circle {
    fill: currentColor;
  }
</style>
