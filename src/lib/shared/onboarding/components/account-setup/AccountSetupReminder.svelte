<script lang="ts">
  import { getAccountSetupContext } from "../../context/account-setup-context";
  import {
    showToast,
    toastQueue,
  } from "$lib/shared/toast/state/toast-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";

  const accountSetup = getAccountSetupContext();

  $effect(() => {
    if (!accountSetup.reminderRequested || accountSetup.loading) return;

    if (!accountSetup.canShowReminder()) {
      accountSetup.cancelReminderRequest();
      return;
    }

    // Setup can wait. Let save confirmations and errors finish first.
    if (toastQueue.length > 0) return;

    const timer = window.setTimeout(() => {
      if (toastQueue.length > 0 || !accountSetup.consumeReminderRequest()) {
        return;
      }

      showToast({
        message: `Finish setup: ${accountSetup.completedCount} of ${accountSetup.totalCount} done`,
        type: "info",
        duration: 10_000,
        announcement: "polite",
        onDismiss: () => {
          void accountSetup.dismissReminder();
        },
        action: {
          label: "Open profile",
          onClick: () => {
            void handleModuleChange("settings", "profile");
          },
        },
      });
    }, 1_800);

    return () => window.clearTimeout(timer);
  });
</script>
