<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={29}
  figureSrc="/guide/level-1/artboards/1.1 - Type 4,5,6.png"
  figureAlt="Type 4 Dash letters Phi/Psi/Lambda, Type 5 Dual-Dash, Type 6 Static letters Alpha/Beta/Gamma"
>
  {#snippet intro()}
    <p class="center" style="font-size: 1.4rem; font-style: italic; font-weight: 500;">
      <span class="dash">Type 4</span> — <span class="dash">Dash</span>
    </p>
    <p class="center">
      With a <span class="dash">Dash</span>, one prop executes a dash and the other remains static.
      <br />
      "Lambda" can be further shortened by calling it "Lam".
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center" style="font-size: 1.4rem; font-style: italic; font-weight: 500;">
      <span class="dual">Type 5</span> — <span class="dual">Dual</span><span class="dash">-Dash</span>
    </p>
    <p class="center">
      In a <span class="dual">Dual-Dash</span>, both hands are dashing. The end position remains the same.
    </p>
    <p class="center" style="font-size: 1.4rem; font-style: italic; font-weight: 500; margin-top: 1rem;">
      <span class="static">Type 6</span> — <span class="static">Static</span>
    </p>
    <p class="center">
      In a <span class="static">Static</span> motion, both hands remain still for a beat.
      These become more interesting when adding turns.
    </p>
  {/snippet}
</HybridPage>
