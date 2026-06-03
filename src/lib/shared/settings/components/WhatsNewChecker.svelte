<!--
  WhatsNewChecker - Detects version changes and shows What's New modal

  Runs on app load to check if user has seen the current version.
  If not, loads version data and triggers the What's New modal.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { whatsNewState } from "../state/whats-new-state.svelte";
  import * as versionService from "$lib/shared/feedback/services/version-service";
  import WhatsNewModal from "./WhatsNewModal.svelte";

  // Configuration
  const CHECK_DELAY_MS = 1500; // Delay before checking (let app stabilize)

  // Track if we've already checked this session
  let hasChecked = false;

  // Watch for auth state - only show to authenticated users
  $effect(() => {
    if (authState.isAuthenticated && authState.user && !hasChecked) {
      // Small delay to let the app settle
      setTimeout(checkForNewVersion, CHECK_DELAY_MS);
    }
  });

  onMount(() => {
    // Also check on mount if already authenticated
    if (authState.isAuthenticated && !hasChecked) {
      setTimeout(checkForNewVersion, CHECK_DELAY_MS);
    }
  });

  async function checkForNewVersion() {
    // Prevent multiple checks
    if (hasChecked) return;
    hasChecked = true;

    // Load cloud data before checking - ensures cross-device persistence works.
    // Without this, hasSeenVersion falls back to localStorage which is empty
    // on new devices, causing the modal to show every time.
    const { syncOnboardingFromCloud } = await import(
      "$lib/shared/onboarding/config/storage-keys"
    );
    await syncOnboardingFromCloud();

    // Check if user has already seen this version
    const currentVersion = __APP_VERSION__;
    if (whatsNewState.hasSeenVersion(currentVersion)) {
      return;
    }

    // Load version data
    whatsNewState.setLoading(true);
    try {
      const versions = await versionService.getVersions();
      const versionData = versions.find((v) => v.version === currentVersion);

      if (versionData && versionData.changelogEntries?.length) {
        // Only show if there's actual changelog content
        whatsNewState.open(versionData);
      } else {
        // No changelog for this version, mark as seen silently
        whatsNewState.markVersionAsSeen(currentVersion);
      }
    } catch (error) {
      console.error("Failed to load version data for What's New:", error);
      // Don't show modal on error, but don't mark as seen either
      // User will see it next time if load succeeds
    } finally {
      whatsNewState.setLoading(false);
    }
  }
</script>

<!-- Render the modal (controlled by whatsNewState) -->
<WhatsNewModal />
