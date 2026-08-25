<!--
  Direction A - Sheets.

  The guide's two printed codex pages, laid side by side on the dark desk. This
  renders CodexSheet itself: the box grouping, the flush shared walls, the
  transition glyphs pinned to outer corners, the OPEN/CLOSE tags, the Greek
  names, the coloured type headings and the dividers are all the primitive's,
  not this file's. The only thing decided here is how wide a page is and how
  many pages sit across.

  Cost, stated honestly: a sheet's widest row is six cells inside a two-column
  box grid, and a sheet is six such rows tall. Sizing cells to fill the column
  would make the spread taller than a 1080 screen, so the cell is capped and
  each page keeps a real paper margin instead. Pictographs here are the
  smallest of the three directions.
-->
<script lang="ts">
  import CodexSheet from "../../../guide/codex/_components/CodexSheet.svelte";
  import { SHEET1, SHEET2 } from "../../../guide/codex/_data/codex-groups";

  let { onSelect }: { onSelect: (id: string) => void } = $props();
</script>

<!-- The outer element is the query container; the grid is inside it. A
     container can never match a query against itself. -->
<div class="board-sheets">
  <div class="spread">
    <div class="page">
      <CodexSheet sheet={SHEET1} embed theme="dark" onCellSelect={onSelect} />
    </div>
    <div class="page">
      <CodexSheet sheet={SHEET2} embed theme="dark" onCellSelect={onSelect} />
    </div>
  </div>
</div>

<style>
  .board-sheets {
    container-type: inline-size;
  }

  .spread {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }

  /* Two pages across as soon as two pages can hold a legible cell. Below that,
     one page at a time - the only thing that works on a phone. */
  /* auto tracks + centred, not 1fr: a sheet's box grid is a fixed six cells
     across, so a 1fr page stretches the columns and parks each box in a lake of
     its own dead space. Sized to content, the margin lands OUTSIDE the pages,
     where it reads as the desk the paper is lying on. */
  @container (min-width: 56rem) {
    .spread {
      grid-template-columns: repeat(2, auto);
      justify-content: center;
      gap: 1.5rem;
    }
  }

  /* A page, not a floating grid: the panel makes the margin read as paper
     margin rather than as dead rail.

     No container-type here. Inline-size containment zeroes an element's
     max-content contribution, so a contained page in an auto track collapses to
     nothing. Sizing comes from --codex-picto-size instead, and the width is
     derived from it so the paper always ends where the sixth cell ends. */
  .page {
    min-width: 0;
    padding: 1rem 1.25rem 1.25rem;
    border: 1px solid var(--theme-stroke, oklch(0.42 0.04 270 / 0.22));
    border-radius: 0.9rem;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, oklch(0.16 0.02 270)) 65%,
      transparent
    );

    /* The sheet's own inner cap is 7.2in of letter paper. Here the page IS the
       cap, so release it and let the box grid use the column. */
    --codex-sheet-inner-max: none;
    /* Row gap clears the transition glyph, which the sheet pins to a box's
       outer top corner and lets overhang its header. At the print gap it
       collides with the row above once the page is this dense. */
    --codex-sheet-gap: 1.15rem 1.25rem;

    /* Half the board, less the spread gap, holds one page: six cells, the
       column gap between its two boxes, and the paper margin (3.75rem).

       Sized to WIDTH, not to the screen height. Fitting both sheets into 1080
       vertical pixels means 66px cells, which is unreadable; this direction's
       whole claim is that it is the guide's page, so it spends the width it has
       and costs a scroll instead. Measured: about a third of a screen at 1440p
       and 1080p, none at 4K. A page is a thing you scroll; that is the trade
       this direction makes for print fidelity and the largest cells at 4K. */
    --codex-picto-size: clamp(
      2.6rem,
      calc((50cqi - 0.75rem - 3.75rem) / 6),
      12rem
    );

    /* The paper ends where the sixth cell ends. */
    width: calc(6 * var(--codex-picto-size) + 3.75rem);
  }

  /* One page at a time: the two-column box grid becomes one column, so a row is
     at most four cells (the S-V box) instead of six, and the cells roughly
     double. A tall scroll is the right trade on a phone; 40px cells are not. */
  @container (max-width: 55.999rem) {
    .page {
      --codex-sheet-cols: minmax(0, 1fr);
      --codex-picto-size: clamp(3.4rem, calc((100cqi - 3.75rem) / 4), 7rem);
      width: auto;
    }
  }
</style>
