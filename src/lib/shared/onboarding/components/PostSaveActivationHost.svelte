<script lang="ts">
  import { postSaveActivation } from "../state/post-save-activation-state.svelte";
  import {
    showToast,
    toastQueue,
  } from "$lib/shared/toast/state/toast-state.svelte";

  $effect(() => {
    if (!postSaveActivation.visible || toastQueue.length > 0) return;

    const timer = window.setTimeout(() => {
      if (!postSaveActivation.visible || toastQueue.length > 0) return;

      postSaveActivation.markPresented();
      showToast({
        message:
          "Sequence saved on this device. Create an account to keep it across devices.",
        type: "success",
        duration: 10_000,
        announcement: "polite",
        onDismiss: () => postSaveActivation.dismissPrompt(),
        action: {
          label: "Create account",
          onClick: () => postSaveActivation.accept(),
        },
      });
    }, 800);

    return () => window.clearTimeout(timer);
  });
</script>
