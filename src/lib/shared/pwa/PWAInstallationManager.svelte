<script lang="ts">
  /**
   * PWAInstallationManager
   * Domain: PWA Installation & Mobile Experience
   *
   * Responsibilities:
   * - Manage PWA installation guide
   * - Respond to app installation events
   */
  import { onMount } from "svelte";
  // import FullscreenHint from "../mobile/components/FullscreenHint.svelte";
  import EnhancedPWAInstallGuide from "../mobile/components/EnhancedPWAInstallGuide.svelte";

  let showPWAInstallGuide = $state(false);

  onMount(() => {
    if (typeof window === "undefined") {
      return;
    }

    // Listen for custom event to open install guide
    const handleOpenInstallGuide = () => {
      showPWAInstallGuide = true;
    };
    window.addEventListener("pwa:open-install-guide", handleOpenInstallGuide);

    return () => {
      window.removeEventListener(
        "pwa:open-install-guide",
        handleOpenInstallGuide
      );
    };
  });
</script>

<!-- Subtle Fullscreen Hint (non-blocking) -->
<!-- <FullscreenHint /> -->

<!-- Enhanced PWA Install Guide (modal with device-specific instructions) -->
<EnhancedPWAInstallGuide bind:showGuide={showPWAInstallGuide} />
