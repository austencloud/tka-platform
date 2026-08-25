<!--
  Atlas - the codex organised by type, without the printed page's geometry.

  The sheet's two-column letter-paper grid is what forces six tall rows and a
  scroll. Drop the paper but keep the thing the paper was carrying: each type is
  its own band, named, with its boxes flowing across the whole width. Types 1-3
  hold 8 or more letters and earn a full-width band each. Types 4, 5 and 6 hold
  three apiece, so a full-width row for each would be three rows spent on nine
  cells - they share one row instead, each still named.

  That costs one more row of height than the ungrouped run did (five instead of
  four at desktop) and buys back the organisation the guide reads by.
-->
<script lang="ts">
  import CodexFlow from "./CodexFlow.svelte";
  import CodexBandHead from "./CodexBandHead.svelte";
  import { MAJOR_TYPE_BANDS, MINOR_TYPE_BANDS } from "./codex-letters";

  let { onSelect }: { onSelect: (id: string) => void } = $props();
</script>

<div class="board-atlas">
  <div class="bands">
    {#each MAJOR_TYPE_BANDS as band (band.type.n)}
      <section class="band" aria-label={band.type.word.replace(/:\s*$/, "")}>
        <CodexBandHead type={band.type} />
        <CodexFlow boxes={band.boxes} {onSelect} />
      </section>
    {/each}

    <!-- The short types, three across. Each keeps its own heading, so the row
         reads as three bands sharing a line, not as one mixed band. -->
    <div class="minor-row">
      {#each MINOR_TYPE_BANDS as band (band.type.n)}
        <section class="band minor" aria-label={band.type.word.replace(/:\s*$/, "")}>
          <CodexBandHead type={band.type} />
          <CodexFlow boxes={band.boxes} {onSelect} />
        </section>
      {/each}
    </div>
  </div>
</div>

<style>
  .board-atlas {
    container-type: inline-size;
  }

  .bands {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    --abox-gap: 0.4rem;
    --codex-flow-justify: center;

    /* Five rows of cells at desktop: Type 1 wraps to two (its boxes are 3+3+3+3
       then 3+3+4), Types 2 and 3 are one each, and the short types share one.
       Whichever binds first - twelve cells across the band, or those five rows'
       share of the screen left under the page chrome. The subtrahend is the
       measured chrome plus the four band headings and the type rules; it is why
       this board lands inside the fold from the top of the page instead of
       needing a scroll. */
    --band-rows: 5;
    --codex-picto-size: min(
      calc((100cqi - 3rem) / 12),
      calc((100dvh - var(--codex-atlas-chrome, 28.5rem)) / var(--band-rows))
    );
  }

  .band {
    min-width: 0;
  }

  .minor-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-start;
    gap: 0.75rem 2.5rem;
  }

  /* A true 4K canvas (2350px of band and up, which no 1080p or 1440p screen
     reaches) is also 2160px tall. Twelve across leaves the bottom third empty,
     so drop to nine - Type 1's boxes are three cells wide, so nine is the next
     packing down - which puts Type 1 on three rows and the board on six, and
     spends the height on much larger cells. Container queries in px on purpose:
     the root ramp changes what a rem is between these screens, which is exactly
     what this tier must not follow. */
  @container (min-width: 2350px) {
    .bands {
      --abox-gap: 0.5rem;
      --band-rows: 6;
      --codex-picto-size: min(
        calc((100cqi - 2rem) / 9),
        calc((100dvh - var(--codex-atlas-chrome, 28.5rem)) / var(--band-rows))
      );
    }
  }

  /* Below desktop the board scrolls, so the height term comes off entirely and
     the divisor is the only thing that changes. Twelve across on a phone is a
     row of 25px thumbnails. */
  @container (max-width: 69.999rem) {
    .bands {
      --codex-picto-size: calc((100cqi - 3rem) / 8);
    }
  }
  @container (max-width: 47.999rem) {
    .bands {
      --codex-picto-size: calc((100cqi - 2rem) / 6);
    }
    .minor-row {
      gap: 0.75rem 1.5rem;
    }
  }
  @container (max-width: 29.999rem) {
    .bands {
      --codex-picto-size: calc((100cqi - 1.2rem) / 4);
    }
  }
</style>
