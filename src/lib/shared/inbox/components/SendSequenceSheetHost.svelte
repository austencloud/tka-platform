<!--
  SendSequenceSheetHost - Global host for the "Send to..." sequence sharing sheet.

  Reads the singleton send-sequence-state and renders a bottom Drawer with
  SendSequenceSheet when a payload is present. Mount this once in
  MainApplication.svelte alongside other global overlays.
-->
<script lang="ts">
  import {
    getSendSequencePayload,
    closeSendSequenceSheet,
  } from "../state/send-sequence-state.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SendSequenceSheet from "./messages/SendSequenceSheet.svelte";

  let currentPayload = $derived(getSendSequencePayload());
  let isOpen = $derived(currentPayload !== null);
</script>

{#if currentPayload}
  <Drawer
    {isOpen}
    placement="bottom"
    onclose={closeSendSequenceSheet}
    ariaLabel="Send sequence"
    class="send-sequence-drawer"
  >
    <SendSequenceSheet
      payload={currentPayload}
      onClose={closeSendSequenceSheet}
      onSent={(conversationId) => {
        closeSendSequenceSheet();
      }}
    />
  </Drawer>
{/if}

<style>
  :global(.send-sequence-drawer) {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    --sheet-filter: none;
  }
</style>
