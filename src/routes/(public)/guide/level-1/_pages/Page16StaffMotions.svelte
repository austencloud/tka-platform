<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={16}
  title="Staff Motions"
  figureSrc="/guide/level-1/artboards/1.0 - Layer 1 Staff Motions.png"
  figureAlt="Staff motions: Shift (Prospin/Antispin) + Dash with start/halfway/end breakdowns"
>
  {#snippet intro()}
    <p class="center">
      During a <span class="shift"><strong>Shift</strong></span>, a prop can rotate in one of two directions —
      <strong>Prospin</strong> or <strong>Antispin</strong>.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      In a base <span class="dash"><strong>Dash</strong></span>, the thumb ends also swap orientation.
      <br />
      Halfway through the motion, the center of the staff is at the grid's center point.
    </p>
  {/snippet}
</HybridPage>
