<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={13}
  figureSrc="/guide/level-1/artboards/1.0  Type 3 and 4.png"
  figureAlt="Type 3 Cross-Shift and Type 4 Dash sequences"
>
  {#snippet intro()}
    <p class="center" style="font-size: 1.4rem; font-style: italic; font-weight: 500;">
      <span class="cross">Type 3</span> — <span class="cross">Cross</span><span class="shift">-Shifts</span>
    </p>
    <p class="center">
      A <span class="cross"><strong>Cross-Shift</strong></span> combines a shift and a dash.
      Since a dash has further to travel, it moves slightly faster.
      <br />
      To understand <span class="cross">Cross-Shifts</span>, let's break one down into parts.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center" style="font-size: 1.4rem; font-style: italic; font-weight: 500;">
      <span class="dash">Type 4</span> — <span class="dash">Dash</span>
    </p>
    <p class="center">
      With a <span class="dash"><strong>Dash</strong></span>, one hand executes a dash while the other hand remains static.
    </p>
  {/snippet}
</HybridPage>
