<script lang="ts">
  import { onMount } from "svelte";
  import BaseModal from "./BaseModal.svelte";

  let {
    cancelBeforeOpen = false,
    allowExternalOverlays = false,
  }: {
    cancelBeforeOpen?: boolean;
    allowExternalOverlays?: boolean;
  } = $props();

  let isOpen = $state(true);
  let openedCount = $state(0);
  let wasNativeOpenWhenNotified = $state(false);

  function handleOpened() {
    const dialog =
      document.querySelector<HTMLDialogElement>("dialog.base-modal");
    wasNativeOpenWhenNotified = dialog?.open ?? false;
    openedCount += 1;
  }

  onMount(() => {
    if (cancelBeforeOpen) {
      isOpen = false;
    }
  });
</script>

<BaseModal
  bind:open={isOpen}
  size="fit"
  animation="none"
  {allowExternalOverlays}
  labelledBy="base-modal-test-title"
  onopened={handleOpened}
>
  <h2 id="base-modal-test-title">Scrollable modal</h2>
  <div class="tall-content" aria-hidden="true"></div>
  <button type="button">End of modal</button>
</BaseModal>

<output data-testid="base-modal-opened-state">
  {openedCount}:{wasNativeOpenWhenNotified}
</output>

<style>
  h2 {
    margin: 0;
  }

  .tall-content {
    height: 1200px;
  }
</style>
