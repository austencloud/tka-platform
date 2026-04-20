<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={38}
  title="Gamma LOOPs"
  figureSrc="/guide/level-1/artboards/1.2 - Type 1 Gamma Permutations - SOTR, VPUQ, MVNU.png"
  figureAlt="Gamma LOOP examples — SOTR, VPUQ, MVNU each ending in gamma on the opposite side"
>
  {#snippet intro()}
    <p class="center">
      The Γ→Γ letters can connect to any other Γ→Γ letter.
      In these examples, each word ends in gamma position on the opposite side.
      By repeating the word from there, we return to home position.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      <em>Note that the pictographs in each second word repetition are rotated 180°.
      Because of this, these examples are classified as Rotated LOOPs.</em>
    </p>
  {/snippet}
</HybridPage>
