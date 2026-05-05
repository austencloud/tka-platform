<!--
  DisassembleLab.svelte

  Module root for the Disassemble lab tab. Creates slot state,
  sets context, and renders the playback host.
-->
<script lang="ts">
  import { createDisassembleSlotState } from "./state/disassemble-state.svelte";
  import { setDisassembleContext } from "./context/disassemble-context";
  import DisassemblePlaybackHost from "./components/DisassemblePlaybackHost.svelte";

  const slotState = createDisassembleSlotState();
  setDisassembleContext({ slotState });
</script>

<DisassemblePlaybackHost />
