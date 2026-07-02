<!--
  BetaNoticeToast - One-time, non-blocking beta notice.

  Replaces the old BetaDiscoveryStep wizard gate. Shown once per device to
  everyone (guests included), then never again. Renders nothing.

  It waits for app entry to finish (the create-tutorial prompt / walkthrough)
  before firing, so a first-run user isn't hit by the beta toast at the same
  moment as the tour prompt. Once they've made their onboarding choice it fires
  alone, non-blocking, and self-dismisses. Returning users already have the
  flag set, so it never fires for them.
-->
<script lang="ts">
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { appEntryState } from "$lib/shared/onboarding/state/app-entry-state.svelte";

  const BETA_NOTICE_SEEN_KEY = "tka-beta-notice-seen";

  let fired = false;

  $effect(() => {
    if (typeof window === "undefined" || fired) return;
    // Hold until the onboarding flow is out of the way.
    if (!appEntryState.isComplete()) return;

    fired = true;
    try {
      if (localStorage.getItem(BETA_NOTICE_SEEN_KEY) === "true") return;
      localStorage.setItem(BETA_NOTICE_SEEN_KEY, "true");
    } catch {
      // Private browsing / quota — show the notice this session anyway.
    }
    toast.info("TKA Composer is in beta. Features may still change.", 8000);
  });
</script>
