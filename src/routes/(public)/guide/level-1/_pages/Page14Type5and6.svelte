<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={14}
  figureSrc="/guide/level-1/artboards/1.0 - Type 5 and 6.png"
  figureAlt="Type 5 Dual-Dash and Type 6 Static sequences"
>
  {#snippet intro()}
    <p class="center" style="font-size: 1.4rem; font-style: italic; font-weight: 500;">
      <span class="dual">Type 5</span> — <span class="dual">Dual</span><span class="dash">-Dash</span>
    </p>
    <p class="center">
      With a <span class="dual"><strong>Dual-Dash</strong></span>, both hands dash simultaneously to their opposite points.
      <br />
      Practice using Dual-Dashes, Dashes, and Cross-Shifts from different start positions.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center" style="font-size: 1.4rem; font-style: italic; font-weight: 500;">
      <span class="static">Type 6</span> — <span class="static">Static</span>
    </p>
    <p class="center">
      Finally, <span class="static"><strong>Static</strong></span> motions are indicated by no arrow.
      <br />
      Later on, static sequences gain complexity when adding prop rotations.
    </p>
  {/snippet}
</HybridPage>
