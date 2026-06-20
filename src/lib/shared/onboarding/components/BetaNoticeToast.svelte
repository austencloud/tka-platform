<!--
  BetaNoticeToast - One-time, non-blocking beta notice.

  Replaces the old BetaDiscoveryStep wizard gate. Shown once per device to
  everyone (guests included) on first visit, then never again. Renders nothing;
  it just fires a toast on mount when the flag is unset.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  const BETA_NOTICE_SEEN_KEY = "tka-beta-notice-seen";

  onMount(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(BETA_NOTICE_SEEN_KEY) === "true") return;
      localStorage.setItem(BETA_NOTICE_SEEN_KEY, "true");
    } catch {
      // Private browsing / quota — show the notice this session anyway.
    }
    toast.info("TKA Composer is in beta. Features may still change.", 8000);
  });
</script>
