<script lang="ts">
  /**
   * AnnouncementBanner - System announcements display
   * Shows at top of dashboard when there are active announcements
   * Dismissible, with link to view all announcements history
   */

  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { container } from "$lib/shared/di";
  import type { IAnnouncementManager } from "$lib/features/admin/services/contracts/IAnnouncementManager";
  import type { Announcement } from "$lib/features/admin/domain/models/announcement-models";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";

  // State
  let announcements = $state<Announcement[]>([]);
  let currentIndex = $state(0);
  let isLoading = $state(true);
  let announcementService: IAnnouncementManager | null = null;

  const currentAnnouncement = $derived(announcements[currentIndex] ?? null);
  const hasMultiple = $derived(announcements.length > 1);
  const isVisible = $derived(announcements.length > 0);

  onMount(async () => {
    if (!authState.isAuthenticated || !authState.user) {
      isLoading = false;
      return;
    }

    try {
      announcementService = container.items.announcementManager;
      if (announcementService) {
        // Get announcements user hasn't dismissed
        const active = await announcementService.getActiveAnnouncementsForUser(
          authState.user.uid
        );

        // Filter to non-dismissed ones (the service should handle this, but double-check)
        const undismissed: Announcement[] = [];
        for (const announcement of active) {
          const dismissed = await announcementService.hasUserDismissed(
            authState.user.uid,
            announcement.id
          );
          if (!dismissed) {
            undismissed.push(announcement);
          }
        }

        announcements = undismissed.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
    } catch (error) {
      console.warn("[AnnouncementBanner] Failed to load announcements:", error);
    }
    isLoading = false;
  });

  async function dismissCurrent() {
    if (!currentAnnouncement || !announcementService || !authState.user) return;

    try {
      await announcementService.dismissAnnouncement(
        authState.user.uid,
        currentAnnouncement.id
      );
      announcements = announcements.filter(
        (a) => a.id !== currentAnnouncement.id
      );
      if (currentIndex >= announcements.length) {
        currentIndex = Math.max(0, announcements.length - 1);
      }
    } catch (error) {
      console.error("[AnnouncementBanner] Failed to dismiss:", error);
    }
  }

  function nextAnnouncement() {
    if (currentIndex < announcements.length - 1) {
      currentIndex++;
    }
  }

  function prevAnnouncement() {
    if (currentIndex > 0) {
      currentIndex--;
    }
  }

  async function viewAllAnnouncements() {
    // Navigate to settings module - notifications tab
    await handleModuleChange("settings", "notifications");
  }

  function handleAction() {
    if (currentAnnouncement?.actionUrl) {
      window.open(currentAnnouncement.actionUrl, "_blank");
    }
  }

  function getSeverityIcon(severity: Announcement["severity"]): string {
    switch (severity) {
      case "critical":
        return "fa-exclamation-triangle";
      case "warning":
        return "fa-exclamation-circle";
      default:
        return "fa-bullhorn";
    }
  }

  function getSeverityColor(severity: Announcement["severity"]): string {
    switch (severity) {
      case "critical":
        return "var(--semantic-error, var(--semantic-error))";
      case "warning":
        return "var(--semantic-warning, var(--semantic-warning))";
      default:
        return "var(--theme-accent)";
    }
  }
</script>

{#if isVisible && currentAnnouncement}
  <div
    class="announcement-banner"
    class:critical={currentAnnouncement.severity === "critical"}
    class:warning={currentAnnouncement.severity === "warning"}
    style="--severity-color: {getSeverityColor(currentAnnouncement.severity)}"
    transition:fly={{ y: -20, duration: 300, easing: cubicOut }}
  >
    <div class="banner-icon">
      <i
        class="fas {getSeverityIcon(currentAnnouncement.severity)}"
        aria-hidden="true"
      ></i>
    </div>

    <div class="banner-content">
      <div class="banner-title">{currentAnnouncement.title}</div>
      <div class="banner-message">{currentAnnouncement.message}</div>
    </div>

    <div class="banner-actions">
      {#if currentAnnouncement.actionUrl}
        <button class="action-btn primary" onclick={handleAction}>
          {currentAnnouncement.actionLabel || "Learn More"}
        </button>
      {/if}

      <button class="action-btn secondary" onclick={viewAllAnnouncements}>
        View All
      </button>

      <button
        class="dismiss-btn"
        onclick={dismissCurrent}
        aria-label="Dismiss announcement"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    {#if hasMultiple}
      <div class="pagination">
        <button
          class="page-btn"
          onclick={prevAnnouncement}
          disabled={currentIndex === 0}
          aria-label="Previous announcement"
        >
          <i class="fas fa-chevron-left" aria-hidden="true"></i>
        </button>
        <span class="page-indicator"
          >{currentIndex + 1} / {announcements.length}</span
        >
        <button
          class="page-btn"
          onclick={nextAnnouncement}
          disabled={currentIndex === announcements.length - 1}
          aria-label="Next announcement"
        >
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .announcement-banner {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    background: var(--theme-panel-bg);
    border: 1px solid
      var(--severity-color, var(--theme-accent, var(--theme-accent)));
    border-left-width: 4px;
    border-radius: 16px;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  }

  .announcement-banner.critical {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 10%,
      var(--theme-panel-bg)
    );
  }

  .announcement-banner.warning {
    background: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 10%,
      var(--theme-panel-bg)
    );
  }

  .banner-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: color-mix(
      in srgb,
      var(--severity-color) 20%,
      var(--theme-card-bg)
    );
    border-radius: 10px;
    color: var(--severity-color);
    font-size: var(--font-size-base);
    flex-shrink: 0;
  }

  .banner-content {
    flex: 1;
    min-width: 0;
  }

  .banner-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--theme-text);
    margin-bottom: 2px;
  }

  .banner-message {
    font-size: 0.8125rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .banner-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .action-btn {
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
  }

  .action-btn.primary {
    background: var(--severity-color, var(--theme-accent, var(--theme-accent)));
    color: white;
  }

  .action-btn.primary:hover {
    filter: brightness(1.1);
  }

  .action-btn.secondary {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    color: var(--theme-text, var(--theme-text));
  }

  .action-btn.secondary:hover {
    background: var(--theme-card-hover-bg);
  }

  .dismiss-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all 150ms ease;
  }

  .dismiss-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, var(--theme-text));
  }

  .pagination {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 12px;
    border-left: 1px solid var(--theme-stroke, var(--theme-stroke));
    flex-shrink: 0;
  }

  .page-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 6px;
    color: var(--theme-text);
    cursor: pointer;
    transition: all 150ms ease;
    font-size: var(--font-size-compact);
  }

  .page-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
  }

  .page-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .page-indicator {
    font-size: 0.75rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
    min-width: 40px;
    text-align: center;
  }

  @media (max-width: 768px) {
    .announcement-banner {
      flex-wrap: wrap;
      padding: 14px 16px;
      gap: 12px;
    }

    .banner-content {
      flex-basis: calc(100% - 56px);
    }

    .banner-actions {
      width: 100%;
      justify-content: flex-end;
    }

    .pagination {
      border-left: none;
      padding-left: 0;
      width: 100%;
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .action-btn.secondary {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .action-btn,
    .dismiss-btn,
    .page-btn {
      transition: none;
    }
  }
</style>
