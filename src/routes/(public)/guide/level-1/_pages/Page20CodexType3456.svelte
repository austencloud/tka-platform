<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={20}
  figureSrc="/guide/level-1/artboards/1.1 - Base Letters - Double Staff, Type 3-6.png"
  figureAlt="Codex of Type 3 (Cross-Shift), Type 4 (Dash), Type 5 (Dual-Dash), and Type 6 (Static) base letters"
>
  {#snippet intro()}
    <p class="center" style="font-size: 1.4rem; font-style: italic; font-weight: 500;">
      <span class="cross">Type 3</span> — <span class="cross">Cross</span><span class="shift">-Shift</span>
      &nbsp;&nbsp;
      <span class="dash">Type 5</span> — <span class="dual">Dual</span><span class="dash">-Dash</span>
      <br />
      <span class="dash">Type 4</span> — <span class="dash">Dash</span>
      &nbsp;&nbsp;
      <span class="static">Type 6</span> — <span class="static">Static</span>
    </p>
  {/snippet}
</HybridPage>
