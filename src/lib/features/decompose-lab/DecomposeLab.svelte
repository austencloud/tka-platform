<!--
  DecomposeLab.svelte

  Module root for the Decompose lab tab. Creates slot state,
  sets context, and renders the playback host.
-->
<script lang="ts">
  import { createDecomposeSlotState } from "./state/decompose-state.svelte";
  import { setDecomposeContext } from "./context/decompose-context";
  import DecomposePlaybackHost from "./components/DecomposePlaybackHost.svelte";

  const slotState = createDecomposeSlotState();
  setDecomposeContext({ slotState });
</script>

<DecomposePlaybackHost />
