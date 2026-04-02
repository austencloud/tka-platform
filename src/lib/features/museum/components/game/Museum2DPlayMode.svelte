<script lang="ts">
  import type { MuseumGrid } from "../../domain/museum-grid-types";
  import type { AvatarState } from "../../state/avatar-state.svelte";
  import { createMuseumState } from "../../state/museum-state.svelte";
  import { setMuseumContext } from "../../state/museum-context";
  import SplitScreenLayout from "../layout/SplitScreenLayout.svelte";
  import Museum2DGame from "./Museum2DGame.svelte";
  import DetailPanel from "../panel/DetailPanel.svelte";

  interface Props {
    grid: MuseumGrid;
    avatar: AvatarState;
  }

  let { grid, avatar }: Props = $props();

  // Fresh state + context for each mount
  const state = createMuseumState(grid);
  setMuseumContext({ state });
</script>

<SplitScreenLayout>
  {#snippet left()}
    <Museum2DGame {avatar} />
  {/snippet}
  {#snippet right()}
    <DetailPanel />
  {/snippet}
</SplitScreenLayout>
