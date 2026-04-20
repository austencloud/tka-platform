<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={10}
  title="Type 1 — Dual-Shifts"
  figureSrc="/guide/level-1/artboards/1.0 - Type 1 - alpha, beta copy 2.png"
  figureAlt="Dual-Shift sequences for α→α (Split-Same), β→β (Tog-Same), α↔β (Split-Opp, Tog-Opp)"
>
  {#snippet intro()}
    <p class="center">
      When both hands move to adjacent locations, it's called a <strong class="dual">Dual-Shift</strong>.
      <br />
      Our first <strong class="dual">Dual-Shifts</strong> correspond to the four modes of timing/direction: SS, TS, SO, TO.
      <br />
      You can determine the start position by looking at the non-pointed end of the arrow.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      Notice that it can be either <em>Split-Opp</em> or <em>Tog-Opp</em> depending on start position.
    </p>
    <p class="center">
      <strong>Practice using <span class="dual">Dual-Shifts</span> to travel between Alpha and Beta in each mode.</strong>
    </p>
  {/snippet}
</HybridPage>
