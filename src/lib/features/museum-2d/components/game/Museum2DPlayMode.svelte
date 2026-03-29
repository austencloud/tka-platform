<script lang="ts">
  import type { MuseumGrid } from "../../domain/museum-grid-types";
  import { createMuseum2DState } from "../../state/museum-2d-state.svelte";
  import { setMuseum2DContext } from "../../state/museum-2d-context";
  import SplitScreenLayout from "../layout/SplitScreenLayout.svelte";
  import Museum2DGame from "./Museum2DGame.svelte";
  import DetailPanel from "../panel/DetailPanel.svelte";

  interface Props {
    grid: MuseumGrid;
  }

  let { grid }: Props = $props();

  // Fresh state + context for each mount
  const state = createMuseum2DState(grid);
  setMuseum2DContext({ state });
</script>

<SplitScreenLayout>
  {#snippet left()}
    <Museum2DGame />
  {/snippet}
  {#snippet right()}
    <DetailPanel />
  {/snippet}
</SplitScreenLayout>
