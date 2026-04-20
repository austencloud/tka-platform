<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={9}
  title="Hand Motions"
  figureSrc="/guide/level-1/artboards/1.0 - Hand Motions.png"
  figureAlt="Hand motion types: shift, dash, static + 6 derived combinations"
>
  {#snippet intro()}
    <p class="center">
      There are three fundamental hand motions in the Alphabet.
      <br />
      The arrow shows the direction of motion.
      <br />
      The hand shows the end position.
    </p>
  {/snippet}
</HybridPage>
