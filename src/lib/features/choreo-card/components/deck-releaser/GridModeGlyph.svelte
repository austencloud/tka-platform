<script lang="ts">
  /**
   * GridModeGlyph — a tiny inline grid-mode mark for the Grid axis chips. Draws
   * the real geometry the mode names: DIAMOND points sit at the cardinals
   * (N/E/S/W) so connecting them reads as a rhombus; BOX points sit at the
   * intercardinals (NE/SE/SW/NW) so connecting them reads as an axis-aligned
   * square. Both carry the four vertex dots + a center dot, mirroring the
   * canonical grid art (gridCoordinates.ts) at glyph scale.
   *
   * currentColor throughout, so it inherits the chip's active/idle text color and
   * follows the theme on any background — unlike an <img> of the static SVG, which
   * bakes black strokes and can't recolor.
   */
  interface Props {
    mode: "diamond" | "box";
    /** Edge of the square viewport, px. */
    size?: number;
  }
  const { mode, size = 16 }: Props = $props();

  // 24-unit space, center 12. Diamond vertices on the axes; box vertices on the
  // corners. Vertex dots + center dot for the grid-point read.
  const diamond = "12,2.5 21.5,12 12,21.5 2.5,12";
  const box = "5,5 19,5 19,19 5,19";
  const verts =
    mode === "diamond"
      ? [
          [12, 2.5],
          [21.5, 12],
          [12, 21.5],
          [2.5, 12],
        ]
      : [
          [5, 5],
          [19, 5],
          [19, 19],
          [5, 19],
        ];
</script>

<svg
  class="grid-mode-glyph"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  aria-hidden="true"
  focusable="false"
>
  <polygon
    points={mode === "diamond" ? diamond : box}
    fill="none"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linejoin="round"
    opacity="0.55"
  />
  {#each verts as [cx, cy] (`${cx}-${cy}`)}
    <circle {cx} {cy} r="2.1" fill="currentColor" />
  {/each}
  <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.85" />
</svg>

<style>
  .grid-mode-glyph {
    display: block;
    flex: 0 0 auto;
  }
</style>
