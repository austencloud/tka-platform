<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={15}
  title="Staff Positions"
  figureSrc="/guide/level-1/artboards/1.0 - Layer 1 Staff Positions.png"
  figureAlt="Staff positions with thumb-end markers — Alpha, Beta, Gamma in various thumb orientations"
>
  {#snippet intro()}
    <p class="center">
      When writing sequences with staves, it helps to mark the thumb end with a line.
      <br />
      The performer can use it to keep track of rotations and check their position on every beat.
    </p>
    <p class="center">
      It also encourages negative space / body turns instead of finger spinning.
      <br />
      In the following examples, an end is always at the center point.
    </p>
    <p class="center">
      <strong>Practice each position below, paying attention to the thumb orientation.</strong>
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      Many pictographs in this guide are depicted with no thumb ends when categorizing.
      It is usually noted only during sequences.
      <br />
      Most sequences in this guide start with thumbs in for consistency.
    </p>
    <p class="center"><em>It's equally valid to start any sequence from a different thumb orientation.</em></p>
  {/snippet}
</HybridPage>
