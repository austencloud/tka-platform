<!--
  Direction B - Atlas.

  One continuous run of the codex's boxes, wrapped to the band. The sheet's
  two-column page geometry is what forces six tall rows; drop it and the same 47
  pictographs land in four rows, which is what buys the largest cells of the
  three directions.

  Type identity, which the page geometry used to carry, is carried instead by
  the coloured rule CodexFlow draws under each box, named once in the legend the
  host puts beside the layout switcher - the way a periodic table marks its
  categories. That is the trade: bigger pictographs, flatter structure.
-->
<script lang="ts">
  import CodexFlow from "./CodexFlow.svelte";

  let { onSelect }: { onSelect: (id: string) => void } = $props();
</script>

<div class="board-atlas">
  <div class="flow-host">
    <CodexFlow {onSelect} />
  </div>
</div>

<style>
  .board-atlas {
    container-type: inline-size;
  }

  /* Cells are solved so a full row holds twelve of them plus the gaps between
     boxes. Because boxes are atomic the wrap then lands on box boundaries by
     itself: 3+3+3+3, then 3+3+4+2, and so on down to 47 in four rows. */
  .flow-host {
    --abox-gap: 0.4rem;
    /* Whichever binds first: twelve cells plus gaps across the band, or four
       rows' share of what is left of the screen below the page chrome (34rem,
       measured against a 1440x900 laptop, where the height term is the one that
       binds). The height term is what keeps that laptop from spilling the last
       row below the fold - this direction's whole claim is one screen. */
    --codex-picto-size: min(
      calc((100cqi - 8rem) / 12),
      calc((100dvh - 34rem) / 4)
    );
  }

  /* A true 4K canvas (2350px of band and up, which no 1080p or 1440p screen
     reaches) is also 2160px TALL. Twelve across leaves the bottom third of it
     empty, so drop to nine - Type 1's boxes are three cells wide, so nine is the
     next packing down from twelve - and spend the height on much larger cells.
     Container queries in px on purpose: the root ramp changes what a rem is
     between these screens, which is exactly what this tier must not follow. */
  @container (min-width: 2350px) {
    .flow-host {
      --abox-gap: 0.5rem;
      /* Nine across packs the 47 into five rows plus a short one, so the height
         term divides by six here, not four. */
      --codex-picto-size: min(
        calc((100cqi - 4rem) / 9),
        calc((100dvh - 34rem) / 6)
      );
    }
  }

  /* Fewer columns as the band narrows - twelve across on a phone is a row of
     25px thumbnails. The divisor is the only thing that changes. */
  @container (max-width: 69.999rem) {
    .flow-host {
      --codex-picto-size: calc((100cqi - 3rem) / 8);
    }
  }
  @container (max-width: 47.999rem) {
    .flow-host {
      --codex-picto-size: calc((100cqi - 2rem) / 6);
    }
  }
  @container (max-width: 29.999rem) {
    .flow-host {
      --codex-picto-size: calc((100cqi - 1.2rem) / 4);
    }
  }
</style>
