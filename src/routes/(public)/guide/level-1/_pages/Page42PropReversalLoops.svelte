<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={42}
  title="Prop-Reversal LOOPs"
  figureSrc="/guide/level-1/artboards/1.2 - Prop-Reversal Permutations, EsigQY, TWKthe, BdelMX.png"
  figureAlt="Prop-reversal LOOP examples — TWKθ, BΔMX with R notation between beats"
>
  {#snippet intro()}
    <p class="center">
      Each of these words uses a prop-reversal. These examples are <em>Rotated LOOPs</em>.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      In this example of <strong>BΔMX</strong>, the right hand stops on beats 2 and 4
      before resuming its motion around the center point.
      Even when there is a beat with no motion in between, we can still mark the reversal
      with an "<strong>R</strong>" to indicate the prop reversal.
    </p>
  {/snippet}
</HybridPage>
