<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={19}
  figureSrc="/guide/level-1/artboards/1.1 - Base Letters - Double Staff, Type 1-2.png"
  figureAlt="Codex of Type 1 (Dual-Shift) and Type 2 (Shift) base letters for double staff"
>
  {#snippet intro()}
    <p class="center" style="font-size: 2rem; font-style: italic; font-weight: 500; margin: 0;">
      Double Staff
    </p>
    <p class="center">
      <span style="font-size: 1.4rem; font-style: italic;">
        <span class="dual">Type 1</span> — <span class="dual">Dual</span><span class="shift">-Shift</span>
      </span>
      &nbsp;&nbsp;
      <span style="font-size: 1.4rem; font-style: italic;">
        <span class="shift">Type 2</span> — <span class="shift">Shift</span>
      </span>
    </p>
  {/snippet}
</HybridPage>
