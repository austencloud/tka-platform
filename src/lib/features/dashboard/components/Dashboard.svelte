<script lang="ts">
  /**
   * Dashboard - 2026 Bento Box Design
   * Composition-based widget dashboard with modular state management
   * Supports preview mode for admin user viewing
   */

  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { resolve, tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { IFollowingFeedProvider } from "../services/contracts/IFollowingFeedProvider";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import type { ModuleId } from "$lib/shared/navigation/domain/types";
  import {
    userPreviewState,
    getEffectiveUserId,
  } from "$lib/shared/debug/state/user-preview-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import * as m from "$lib/paraglide/messages.js";

  // Components
  import DashboardHeader from "./DashboardHeader.svelte";
  import DashboardSignInToast from "./DashboardSignInToast.svelte";
  import AnnouncementBanner from "./AnnouncementBanner.svelte";
  import TodayChallengeWidget from "./widgets/TodayChallengeWidget.svelte";
  import CommunityFeedWidget from "./widgets/CommunityFeedWidget.svelte";
  import FollowingFeedWidget from "./widgets/FollowingFeedWidget.svelte";
  import MessagesWidget from "./widgets/MessagesWidget.svelte";
  import AlertsWidget from "./widgets/AlertsWidget.svelte";
  import MyFeedbackDetail from "$lib/features/feedback/components/my-feedback/MyFeedbackDetail.svelte";
  import DashboardFloatingActions from "./mobile/DashboardFloatingActions.svelte";
  import MessagesDrawer from "./drawers/MessagesDrawer.svelte";
  import NotificationsDrawer from "./drawers/NotificationsDrawer.svelte";
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
  let messagesDrawerOpen = $state(false);
  let notificationsDrawerOpen = $state(false);
  let pendingConversationId = $state("");
  let hasFollowing = $state(false);

  // Preview-aware derived values (directly in component for proper reactivity)
  const isPreviewActive = $derived(userPreviewState.isActive);
  const previewProfile = $derived(userPreviewState.data.profile);

  const greeting = $derived.by(() => {
    const hour = new Date().getHours();
    if (hour < 12) return m.dashboard_greeting_morning();
    if (hour < 18) return m.dashboard_greeting_afternoon();
    return m.dashboard_greeting_evening();
  });

  const effectiveWelcomeMessage = $derived.by(() => {
    // When previewing another user, show their name
    if (isPreviewActive && previewProfile) {
      const firstName = (
        previewProfile.displayName ||
        previewProfile.email ||
        "User"
      ).split(" ")[0];
      return m.dashboard_viewing_as({ name: firstName });
    }
    // Normal authenticated user
    if (authState.isAuthenticated && authState.user?.displayName) {
      const firstName = authState.user.displayName.split(" ")[0];
      return `${greeting}, ${firstName}`;
    }
    return m.dashboard_welcome();
  });

  // Derived
  const isMobile = $derived(
    responsiveSettings?.isMobile || responsiveSettings?.isTablet || false
  );

  // Reactive: get effective user ID (preview mode or authenticated user)
  const effectiveUserId = $derived(
    getEffectiveUserId(authState.user?.uid || null)
  );

  onMount(() => {
    let cleanup: (() => void) | undefined;
    try {
      deviceDetector = resolve<IDeviceDetector>(TYPES.IDeviceDetector);
      hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
      responsiveSettings = deviceDetector.getResponsiveSettings();

      cleanup = deviceDetector.onCapabilitiesChanged(() => {
        responsiveSettings = deviceDetector!.getResponsiveSettings();
      });
    } catch (error) {
      console.warn("Dashboard: Failed to resolve DeviceDetector", error);
    }

    setTimeout(() => {
      dashboardState.isVisible = true;
    }, 30);

    return () => {
      cleanup?.();
      dashboardState.clearToast();
    };
  });

  // Reactively check following status when effectiveUserId changes
  $effect(() => {
    if (effectiveUserId) {
      checkHasFollowing();
    }
  });

  async function checkHasFollowing(retryCount = 0) {
    if (!effectiveUserId) {
      console.log("[Dashboard] No effectiveUserId, skipping following check");
      return;
    }

    try {
      const feedService = tryResolve<IFollowingFeedProvider>(
        TYPES.IFollowingFeedProvider
      );
      if (feedService) {
        hasFollowing = await feedService.hasFollowing(effectiveUserId);
        console.log(
          `[Dashboard] hasFollowing check for user ${effectiveUserId}:`,
          hasFollowing
        );
      } else if (retryCount < 3) {
        // Service not available yet (Tier 2 still loading), retry after delay
        console.log(
          "[Dashboard] Feed service not ready, retrying...",
          retryCount + 1
        );
        setTimeout(() => checkHasFollowing(retryCount + 1), 500);
      }
    } catch (error) {
      console.warn("Dashboard: Failed to check following status", error);
    }
  }

  async function openSettings() {
    hapticService?.trigger("selection");
    await handleModuleChange("settings" as ModuleId);
  }

  // Feedback detail handlers
  async function handleFeedbackUpdate(
    feedbackId: string,
    updates: { type?: FeedbackType; description?: string },
    appendMode?: boolean
  ): Promise<FeedbackItem> {
    // Dynamically import feedback service
    const { feedbackService } =
      await import("$lib/features/feedback/services/implementations/FeedbackRepository");

    const updatedItem = await feedbackService.updateUserFeedback(
      feedbackId,
      updates,
      appendMode
    );

    // Update the detail panel with new data
    if (dashboardState.feedbackDetailItem?.id === feedbackId) {
      dashboardState.openFeedbackDetail(updatedItem);
    }

    return updatedItem;
  }

  async function handleFeedbackDelete(feedbackId: string): Promise<void> {
    // Dynamically import feedback service
    const { feedbackService } =
      await import("$lib/features/feedback/services/implementations/FeedbackRepository");

    await feedbackService.deleteUserFeedback(feedbackId);

    // Close the detail panel after deletion
    dashboardState.closeFeedbackDetail();
  }
</script>

<div class="dashboard" class:visible={dashboardState.isVisible}>
  <DashboardHeader
    welcomeMessage={effectiveWelcomeMessage}
    isVisible={dashboardState.isVisible}
  />

  <!-- Announcement Banner (when there are active announcements) -->
  {#if dashboardState.isVisible}
    <AnnouncementBanner />
  {/if}

  <!-- COMMUNITY HUB - Challenge, Community Feed, Messages, Alerts -->
  <div class="community-grid" class:mobile={isMobile}>
    <!-- Today's Challenge - Full Width -->
    {#if dashboardState.isVisible}
      <section
        class="widget-challenge"
        transition:fly={{
          y: 12,
          duration: 200,
          delay: 200,
          easing: cubicOut,
        }}
      >
        <TodayChallengeWidget />
      </section>
    {/if}

    <!-- Community/Following Feed - Show Following if user has following, else Community -->
    {#if dashboardState.isVisible}
      <section
        class="widget-community"
        transition:fly={{
          y: 12,
          duration: 200,
          delay: 250,
          easing: cubicOut,
        }}
      >
        {#if hasFollowing}
          <FollowingFeedWidget />
        {:else}
          <CommunityFeedWidget />
        {/if}
      </section>
    {/if}

    <!-- Messages - Direct messages -->
    {#if dashboardState.isVisible}
      <section
        class="widget-messages"
        transition:fly={{
          y: 12,
          duration: 200,
          delay: 300,
          easing: cubicOut,
        }}
      >
        <MessagesWidget
          onOpenMessages={() => (messagesDrawerOpen = true)}
          onOpenConversation={(conversationId) => {
            pendingConversationId = conversationId;
            messagesDrawerOpen = true;
          }}
        />
      </section>
    {/if}

    <!-- Alerts - Notifications feed -->
    {#if dashboardState.isVisible}
      <section
        class="widget-alerts"
        transition:fly={{
          y: 12,
          duration: 200,
          delay: 350,
          easing: cubicOut,
        }}
      >
        <AlertsWidget
          {dashboardState}
          onOpenNotifications={() => (notificationsDrawerOpen = true)}
        />
      </section>
    {/if}
  </div>

  <DashboardSignInToast
    message={dashboardState.signInToastMessage}
    visible={dashboardState.showSignInToast}
  />

  <!-- Feedback Detail Panel (rendered when feedback notification is clicked) -->
  <MyFeedbackDetail
    item={dashboardState.feedbackDetailItem}
    isOpen={dashboardState.feedbackDetailOpen}
    onClose={() => dashboardState.closeFeedbackDetail()}
    onUpdate={handleFeedbackUpdate}
    onDelete={handleFeedbackDelete}
  />

  <!-- Mobile-only floating action buttons -->
  {#if isMobile}
    <DashboardFloatingActions
      onMessagesClick={() => (messagesDrawerOpen = true)}
      onNotificationsClick={() => (notificationsDrawerOpen = true)}
    />
  {/if}

  <!-- Messages Drawer -->
  <MessagesDrawer bind:isOpen={messagesDrawerOpen} bind:pendingConversationId />

  <!-- Notifications Drawer -->
  <NotificationsDrawer bind:isOpen={notificationsDrawerOpen} />
</div>

<style>
  /* ========================================
     VIEW TRANSITIONS - Zoom from card effect
     ======================================== */

  /* Old page (dashboard) zooms out and fades */
  /* Exclude settings portal transitions - they have their own animations in view-transitions.css */
  :global(
    :root:not(.settings-portal-enter):not(
        .settings-portal-exit
      )::view-transition-old(root)
  ) {
    animation: 350ms cubic-bezier(0.4, 0, 0.2, 1) both zoom-out-fade;
    transform-origin: var(--transition-origin-x, 50%)
      var(--transition-origin-y, 50%);
  }

  /* New page (module) zooms in from card position */
  /* Exclude settings portal transitions - they have their own animations in view-transitions.css */
  :global(
    :root:not(.settings-portal-enter):not(
        .settings-portal-exit
      )::view-transition-new(root)
  ) {
    animation: 350ms cubic-bezier(0.4, 0, 0.2, 1) both zoom-in-reveal;
    transform-origin: var(--transition-origin-x, 50%)
      var(--transition-origin-y, 50%);
  }

  /* Dashboard zooms IN and fades (we're diving through it) */
  @keyframes zoom-out-fade {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(1.3);
    }
  }

  /* Module starts slightly small, grows to full (we're arriving) */
  @keyframes zoom-in-reveal {
    from {
      opacity: 0;
      transform: scale(0.85);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* ========================================
     BACK TRANSITION - Pull out effect (Home button)
     ======================================== */

  /* When going back to dashboard, reverse the effect */
  :global(.back-transition)::view-transition-old(root) {
    animation: 350ms cubic-bezier(0.4, 0, 0.2, 1) both pull-out-old;
  }

  :global(.back-transition)::view-transition-new(root) {
    animation: 350ms cubic-bezier(0.4, 0, 0.2, 1) both pull-out-new;
  }

  /* Module shrinks as we pull back from it */
  @keyframes pull-out-old {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.85);
    }
  }

  /* Dashboard zooms down from large to normal (we're pulling back to see it) */
  @keyframes pull-out-new {
    from {
      opacity: 0;
      transform: scale(1.3);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* ========================================
     2026 DASHBOARD - Community Hub
     Scrollable, engagement-focused layout
     ======================================== */

  .dashboard {
    box-sizing: border-box;
    width: 100%;
    max-width: 1200px;
    height: 100%;
    padding: 24px;
    padding-bottom: 40px;
    margin: 0 auto;
    overflow-x: hidden;
    overflow-y: auto;
    opacity: 0;
    transition: opacity 300ms ease;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .dashboard.visible {
    opacity: 1;
  }

  /* ========================================
     COMMUNITY GRID - Widgets layout
     ======================================== */

  .community-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: auto 1fr; /* First row auto, second row fills remaining space */
    gap: 20px;
    width: 100%;
    min-width: 0;
    flex: 1; /* Fill available vertical space in dashboard */
    min-height: 0;
  }

  /* Challenge spans full width on first row */
  .widget-challenge {
    grid-column: 1 / -1;
    min-width: 0;
  }

  /* Community, Messages, Alerts - three columns */
  .widget-community,
  .widget-messages,
  .widget-alerts {
    min-height: 280px;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  /* Make widget contents fill their containers */
  .widget-community > :global(*),
  .widget-messages > :global(*),
  .widget-alerts > :global(*) {
    flex: 1;
    min-height: 0;
  }

  /* Tablet: 2 columns with Messages and Alerts side by side */
  @media (max-width: 1024px) {
    .community-grid:not(.mobile) {
      grid-template-columns: repeat(2, 1fr);
    }

    .community-grid:not(.mobile) .widget-community {
      grid-column: 1 / -1;
    }
  }

  /* Mobile: single column */
  .community-grid.mobile {
    grid-template-columns: 1fr;
  }

  .community-grid.mobile .widget-challenge,
  .community-grid.mobile .widget-community,
  .community-grid.mobile .widget-messages,
  .community-grid.mobile .widget-alerts {
    grid-column: 1;
  }

  /* Hide Messages/Alerts widgets on mobile (replaced by floating buttons) */
  .community-grid.mobile .widget-messages,
  .community-grid.mobile .widget-alerts {
    display: none;
  }

  /* ========================================
     RESPONSIVE BREAKPOINTS
     ======================================== */

  @media (max-width: 768px) {
    .dashboard {
      padding: 16px;
      padding-bottom: 32px;
      gap: 20px;
    }

    .community-grid {
      gap: 16px;
    }
  }

  @media (max-width: 480px) {
    .dashboard {
      padding: 12px;
      padding-bottom: 24px;
      gap: 16px;
    }

    .community-grid {
      gap: 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dashboard {
      transition: none;
    }

    /* Disable view transition animations for reduced motion */
    :global(::view-transition-group(*)),
    :global(::view-transition-old(*)),
    :global(::view-transition-new(*)) {
      animation: none !important;
    }
  }
</style>
