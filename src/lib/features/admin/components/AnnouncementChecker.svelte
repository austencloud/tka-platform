<!--
  AnnouncementChecker - Check and Display Undismissed Announcements

  Runs on app load to check for announcements that need to be shown as modals.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { getAnnouncementManager } from "$lib/features/admin/getAnnouncementManager";
  import type { AnnouncementManager } from "../services/implementations/AnnouncementManager";
  import type { Announcement } from "../domain/models/announcement-models";
  import AnnouncementModal from "./AnnouncementModal.svelte";

  // Services
  let announcementService: AnnouncementManager | null = null;

  // State
  let pendingAnnouncements = $state<Announcement[]>([]);
  let currentAnnouncement = $state<Announcement | null>(null);

  // Watch for auth state changes
  $effect(() => {
    if (authState.isAuthenticated && authState.user) {
      checkForAnnouncements();
    }
  });

  onMount(async () => {
    try {
      announcementService = getAnnouncementManager();

      if (authState.isAuthenticated) {
        checkForAnnouncements();
      }
    } catch (error) {
      console.error("Failed to initialize announcement checker:", error);
    }
  });

  async function checkForAnnouncements() {
    if (!announcementService || !authState.user) return;

    try {
      const undismissed =
        await announcementService.getUndismissedModalAnnouncements(
          authState.user.uid
        );

      pendingAnnouncements = undismissed;
      if (undismissed.length > 0) {
        currentAnnouncement = undismissed[0] ?? null;
      }
    } catch (error) {
      console.error("Failed to check for announcements:", error);
    }
  }

  function handleDismiss() {
    // Remove current announcement from queue
    pendingAnnouncements = pendingAnnouncements.slice(1);

    // Show next announcement if available
    if (pendingAnnouncements.length > 0) {
      currentAnnouncement = pendingAnnouncements[0] ?? null;
    } else {
      currentAnnouncement = null;
    }
  }
</script>

{#if currentAnnouncement}
  <AnnouncementModal
    announcement={currentAnnouncement}
    onDismiss={handleDismiss}
  />
{/if}
