<script lang="ts">
  /**
   * Dashboard - Minimal Launcher
   *
   * Now that Create is the default landing, Dashboard serves as:
   * - Quick module access cards
   * - Announcements banner
   * - Sign-in toast
   *
   * The TikTok-style feed has moved to Watch > Feed
   */

  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import type { ModuleId } from "$lib/shared/navigation/domain/types";
  import {
    userPreviewState,
    getEffectiveUserId,
  } from "$lib/shared/debug/state/user-preview-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // Supporting components
  import DashboardSignInToast from "./DashboardSignInToast.svelte";
  import AnnouncementBanner from "./AnnouncementBanner.svelte";
  import MyFeedbackDetail from "$lib/features/feedback/components/my-feedback/MyFeedbackDetail.svelte";

  // State
  import { createDashboard } from "../state/dashboard-state.svelte";
  import type {
    FeedbackItem,
    FeedbackType,
  } from "$lib/features/feedback/domain/models/feedback-models";

  // Services
  let deviceDetector: IDeviceDetector | null = null;
  let responsiveSettings = $state<ResponsiveSettings | null>(null);
  let hapticService: IHapticFeedback | undefined;

  // State
  const dashboardState = createDashboard();
  let isVisible = $state(false);

  // Preview-aware derived values
  const isPreviewActive = $derived(userPreviewState.isActive);
  const previewProfile = $derived(userPreviewState.data.profile);

  const greeting = $derived.by(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard_greeting_morning");
    if (hour < 18) return t("dashboard_greeting_afternoon");
    return t("dashboard_greeting_evening");
  });

  const effectiveWelcomeMessage = $derived.by(() => {
    if (isPreviewActive && previewProfile) {
      const firstName = (
        previewProfile.displayName ||
        previewProfile.email ||
        "User"
      ).split(" ")[0] ?? "User";
      return t("dashboard_viewing_as", { name: firstName });
    }
    if (authState.isAuthenticated && authState.user?.displayName) {
      const firstName = authState.user.displayName.split(" ")[0];
      return `${greeting}, ${firstName}`;
    }
    return t("dashboard_welcome");
  });

  // Derived
  const isMobile = $derived(
    responsiveSettings?.isMobile || responsiveSettings?.isTablet || false
  );

  // Reactive: get effective user ID
  const effectiveUserId = $derived(
    getEffectiveUserId(authState.user?.uid || null)
  );

  // Quick access cards
  const quickAccessCards = [
    {
      id: "create",
      label: "Create",
      icon: "fa-wand-magic-sparkles",
      color: "#8b5cf6",
      description: "Build sequences",
    },
    {
      id: "watch",
      label: "Watch",
      icon: "fa-play",
      color: "#ef4444",
      description: "Browse videos",
    },
    {
      id: "explore",
      label: "Explore",
      icon: "fa-compass",
      color: "#a855f7",
      description: "Discover sequences",
    },
    {
      id: "learn",
      label: "Learn",
      icon: "fa-graduation-cap",
      color: "#3b82f6",
      description: "Get started",
    },
  ];

  onMount(() => {
    let cleanup: (() => void) | undefined;
    try {
      deviceDetector = container.items.deviceDetector;
      hapticService = container.items.hapticFeedback;
      responsiveSettings = deviceDetector.getResponsiveSettings();

      cleanup = deviceDetector.onCapabilitiesChanged(() => {
        responsiveSettings = deviceDetector!.getResponsiveSettings();
      });
    } catch (error) {
      console.warn("Dashboard: Failed to resolve DeviceDetector", error);
    }

    setTimeout(() => {
      isVisible = true;
    }, 30);

    return () => {
      cleanup?.();
      dashboardState.clearToast();
    };
  });

  function handleCardClick(moduleId: string) {
    hapticService?.trigger("selection");
    handleModuleChange(moduleId as ModuleId);
  }

  // Feedback detail handlers (keep existing functionality)
  async function handleFeedbackUpdate(
    feedbackId: string,
    updates: { type?: FeedbackType; description?: string },
    appendMode?: boolean
  ): Promise<FeedbackItem> {
    const { feedbackService } =
      await import("$lib/features/feedback/services/implementations/FeedbackRepository");

    const updatedItem = await feedbackService.updateUserFeedback(
      feedbackId,
      updates,
      appendMode
    );

    if (dashboardState.feedbackDetailItem?.id === feedbackId) {
      dashboardState.openFeedbackDetail(updatedItem);
    }

    return updatedItem;
  }

  async function handleFeedbackDelete(feedbackId: string): Promise<void> {
    const { feedbackService } =
      await import("$lib/features/feedback/services/implementations/FeedbackRepository");

    await feedbackService.deleteUserFeedback(feedbackId);
    dashboardState.closeFeedbackDetail();
  }
</script>

<div class="dashboard" class:visible={isVisible}>
  <!-- Announcement Banner -->
  {#if isVisible}
    <AnnouncementBanner />
  {/if}

  <!-- Header -->
  <header class="dashboard-header">
    <h1 class="welcome-message">{effectiveWelcomeMessage}</h1>
  </header>

  <!-- Quick Access Cards -->
  <div class="quick-access-grid">
    {#each quickAccessCards as card}
      <button
        class="quick-access-card"
        style="--card-color: {card.color}"
        onclick={() => handleCardClick(card.id)}
        type="button"
      >
        <div class="card-icon">
          <i class="fas {card.icon}" aria-hidden="true"></i>
        </div>
        <div class="card-content">
          <span class="card-label">{card.label}</span>
          <span class="card-description">{card.description}</span>
        </div>
      </button>
    {/each}
  </div>

  <!-- Sign-in toast -->
  <DashboardSignInToast
    message={dashboardState.signInToastMessage}
    visible={dashboardState.showSignInToast}
  />

  <!-- Feedback Detail Panel -->
  <MyFeedbackDetail
    item={dashboardState.feedbackDetailItem}
    isOpen={dashboardState.feedbackDetailOpen}
    onClose={() => dashboardState.closeFeedbackDetail()}
    onUpdate={handleFeedbackUpdate}
    onDelete={handleFeedbackDelete}
  />
</div>

<style>
  .dashboard {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    opacity: 0;
    transition: opacity var(--duration-emphasis, 200ms) ease;
    padding: var(--spacing-lg, 24px);
    padding-bottom: calc(var(--spacing-lg, 24px) + 80px); /* Space for bottom nav */
  }

  .dashboard.visible {
    opacity: 1;
  }

  .dashboard-header {
    margin-bottom: var(--spacing-xl, 32px);
  }

  .welcome-message {
    font-size: var(--font-size-2xl, 1.5rem);
    font-weight: 700;
    color: var(--theme-text, #fff);
    margin: 0;
  }

  .quick-access-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md, 16px);
    max-width: 600px;
  }

  .quick-access-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-lg, 24px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 16px);
    cursor: pointer;
    transition:
      transform var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease;
    text-align: left;
  }

  .quick-access-card:hover {
    transform: translateY(-2px);
    border-color: var(--card-color, var(--theme-accent));
    background: rgba(255, 255, 255, 0.06);
  }

  .quick-access-card:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .quick-access-card:active {
    transform: scale(0.98);
  }

  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md, 12px);
    background: color-mix(in srgb, var(--card-color) 15%, transparent);
    color: var(--card-color);
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card-label {
    font-size: var(--font-size-base, 16px);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .card-description {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, #9ca3af);
  }

  @media (max-width: 480px) {
    .quick-access-grid {
      grid-template-columns: 1fr;
    }

    .quick-access-card {
      padding: var(--spacing-md, 16px);
    }

    .card-icon {
      width: 40px;
      height: 40px;
      font-size: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dashboard {
      transition: none;
    }

    .quick-access-card {
      transition: none;
    }
  }
</style>
