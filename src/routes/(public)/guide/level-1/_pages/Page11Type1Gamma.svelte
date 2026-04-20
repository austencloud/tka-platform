<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={11}
  figureSrc="/guide/level-1/artboards/1.0 - Type 1 - gamma and Type 2.png"
  figureAlt="Gamma quarter-time sequences: Quarter-Opp parallel/antiparallel, Quarter-Same, mixed example"
>
  {#snippet intro()}
    <p class="center">
      Gamma, aka quarter-time, is based on two often forgotten modes:
      <br />
      <strong>Quarter-Opp</strong> and <strong>Quarter-Same</strong>.
      <br />
      Quarter-Opp has variations of <em>parallel</em> and <em>antiparallel</em>.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      When in gamma, you can move to any other variation of gamma.
      <br />
      These examples are continuous, but non-continuous sequences are also possible.
    </p>
    <p class="center">
      <strong>Practice using <span class="dual">Dual-Shifts</span> to create other non-continuous Γ→Γ variations!</strong>
    </p>
  {/snippet}
</HybridPage>
