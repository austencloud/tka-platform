<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage pageNumber={7} title="The Grid">
  {#snippet intro()}
    <p class="center">The Kinetic Alphabet is based on a 4-point grid.</p>
    <p class="center">
      There are two 4-point grids: box mode and diamond mode.
      <br />
      <strong>This guide is written in diamond, but everything translates to box.</strong>
    </p>
    <p class="center">On this grid, there are three types of points:</p>
  {/snippet}

  <div class="grid-diagram">
    <div class="callouts">
      <p><strong>The center point</strong> is the hub that everything revolves around.</p>
      <p><strong>The four hand points</strong> are halfway between the center point and the outer points.</p>
      <p><strong>The outer points</strong> depict the outer edges of the grid.</p>
    </div>
    <img class="diagram-img" src="/guide/level-1/artboards/1.0 - The Grid.png" alt="Grid diagram" />
  </div>

  {#snippet outro()}
    <p class="center">Together, diamond and box form an 8-point grid:</p>
    <p class="center"><em>We'll use diamond mode to learn each concept.</em></p>
  {/snippet}
</HybridPage>

<style>
  .grid-diagram {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0;
  }
  .callouts {
    display: none;
  }
  .diagram-img {
    width: 100%;
    height: auto;
    object-fit: contain;
    /* Show only the diagram middle/bottom of the artboard, not the title */
    clip-path: inset(20% 0 0 0);
    margin-top: -20%;
  }
</style>
