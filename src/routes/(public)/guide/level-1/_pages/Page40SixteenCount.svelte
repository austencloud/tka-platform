<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={40}
  title="16-Count Sequences"
  figureSrc="/guide/level-1/artboards/1.2 - 16-count sequences - GθOZ, EΔQY.png"
  figureAlt="16-count sequence examples — GθOZ (Rotated+Swapped LOOP) and EΔQY (Rotated+Mirrored+Swapped LOOP)"
>
  {#snippet intro()}
    <p class="center">
      These 4-letter words repeat 4 times, giving us 16-count sequences.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      <strong>GθOZ</strong> — Here, each repetition of the word ends in a Γ that is 90° from its start.
      This means it will take 4 repetitions to return to home.
      <em>(Rotated + Swapped LOOP)</em>
    </p>
    <p class="center">
      <strong>EΔQY</strong> — Here, the staves return to home after two word repetitions.
      To make it symmetrical, it repeats twice more, filling the rest of the quadrants.
      <em>(Rotated + Mirrored + Swapped LOOP)</em>
    </p>
  {/snippet}
</HybridPage>
