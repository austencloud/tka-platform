<!--
  NotificationsTab - Notification Center for Users

  Shows system announcements and notification preferences.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { container } from "$lib/shared/di";
  import type { IAnnouncementManager } from "$lib/features/admin/services/contracts/IAnnouncementManager";
  import type { Announcement } from "$lib/features/admin/domain/models/announcement-models";
  import NotificationPreferencesPanel from "$lib/features/feedback/components/NotificationPreferencesPanel.svelte";
  import NotificationsHero from "$lib/shared/settings/components/notifications/NotificationsHero.svelte";
  import NotificationsAnnouncementsSection from "$lib/shared/settings/components/notifications/NotificationsAnnouncementsSection.svelte";
  import NotificationsSectionShell from "$lib/shared/settings/components/notifications/NotificationsSectionShell.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // Services
  let announcementService: IAnnouncementManager | null = null;

  // State
  let announcements = $state<Announcement[]>([]);
  let dismissedAnnouncements = $state<Set<string>>(new Set());
  let isLoading = $state(true);

  onMount(async () => {
    try {
      announcementService = container.items.announcementManager;
      await loadAnnouncements();
    } catch (error) {
      console.error("Failed to initialize notification center:", error);
    } finally {
      isLoading = false;
    }
  });

  async function loadAnnouncements() {
    if (!announcementService || !authState.user) return;

    try {
      const allAnnouncements =
        await announcementService.getActiveAnnouncementsForUser(
          authState.user.uid
        );

      announcements = allAnnouncements;

      // Load dismissal status for each announcement
      const dismissed = new Set<string>();
      for (const announcement of allAnnouncements) {
        const isDismissed = await announcementService.hasUserDismissed(
          authState.user.uid,
          announcement.id
        );
        if (isDismissed) {
          dismissed.add(announcement.id);
        }
      }
      dismissedAnnouncements = dismissed;
    } catch (error) {
      console.error("Failed to load announcements:", error);
    }
  }

  function isAnnouncementDismissed(announcementId: string): boolean {
    return dismissedAnnouncements.has(announcementId);
  }

  // Severity colors aligned with semantic color system
  // Note: These match --semantic-error, --semantic-warning, --semantic-info
  function getSeverityColor(severity: Announcement["severity"]): string {
    switch (severity) {
      case "critical":
        return "var(--semantic-error)"; // --semantic-error
      case "warning":
        return "var(--semantic-warning)"; // --semantic-warning
      case "info":
        return "var(--semantic-info)"; // --semantic-info
    }
  }

  function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<div class="notifications-tab">
  <NotificationsHero />

  <section class="content">
    <NotificationsSectionShell
      eyebrow={t("settings_preferences")}
      title={t("settings_notifications_preferences")}
    >
      <NotificationPreferencesPanel />
    </NotificationsSectionShell>

    <NotificationsAnnouncementsSection
      {announcements}
      {isLoading}
      {dismissedAnnouncements}
      severityColor={getSeverityColor}
      {formatDate}
    />
  </section>
</div>

<style>
  .notifications-tab {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .content {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 16px;
  }

  /* Responsive */
  @media (max-width: 900px) {
    .content {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .notifications-tab {
      gap: 16px;
    }
  }
</style>
