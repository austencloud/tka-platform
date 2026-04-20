<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={37}
  title="Type 1 LOOPs"
  figureSrc="/guide/level-1/artboards/1.2 - Type 1 Permutations - DJII, BBLF, KIEC.png"
  figureAlt="Type 1 LOOP examples — DJII (Mirrored), BBLF, KIEC (Swapped & Mirrored)"
>
  {#snippet intro()}
    <p class="center">
      In this example of <strong>DJII</strong>, the graphs in the second repetition (beats 5–8)
      mirror the graphs in the first repetition (beats 1–4), classifying it as a <em>Mirrored LOOP</em>.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      In this example of <strong>KIEC</strong>, the colors are swapped in the second half,
      so it is classified as a <em>Swapped &amp; Mirrored LOOP</em>.
    </p>
  {/snippet}
</HybridPage>
