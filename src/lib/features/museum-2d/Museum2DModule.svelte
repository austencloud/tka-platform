<script lang="ts">
  import { buildFullMuseum } from "./data/museum-floor-plan";
  import { createMuseum2DState } from "./state/museum-2d-state.svelte";
  import { setMuseum2DContext } from "./state/museum-2d-context";
  import SplitScreenLayout from "./components/layout/SplitScreenLayout.svelte";
  import Museum2DGame from "./components/game/Museum2DGame.svelte";
  import DetailPanel from "./components/panel/DetailPanel.svelte";

  const grid = buildFullMuseum();
  const state = createMuseum2DState(grid);

  setMuseum2DContext({ state });
</script>

<div class="museum-2d-module">
  <SplitScreenLayout>
    {#snippet left()}
      <Museum2DGame />
    {/snippet}
    {#snippet right()}
      <DetailPanel />
    {/snippet}
  </SplitScreenLayout>
</div>

<style>
  .museum-2d-module {
    width: 100%;
    height: 100%;
    background: #0a0a0a;
  }
</style>
