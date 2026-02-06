/**
 * Admin Navigation Context
 *
 * Enables cross-tab drill-down navigation in the admin dashboard.
 * When navigating between tabs, this context can pass entity IDs to pre-select.
 */

import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";

interface AdminNavigationContext {
  /** User ID to pre-select in Users tab */
  selectedUserId: string | null;
  /** Challenge ID to pre-select in Challenges tab */
  selectedChallengeId: string | null;
  /** Announcement ID to pre-select in Announcements tab */
  selectedAnnouncementId: string | null;
}

function createAdminNavigationContext() {
  const context = $state<AdminNavigationContext>({
    selectedUserId: null,
    selectedChallengeId: null,
    selectedAnnouncementId: null,
  });

  return {
    get selectedUserId() {
      return context.selectedUserId;
    },
    get selectedChallengeId() {
      return context.selectedChallengeId;
    },
    get selectedAnnouncementId() {
      return context.selectedAnnouncementId;
    },

    /**
     * Navigate to users tab with a specific user pre-selected
     */
    navigateToUser(userId: string) {
      context.selectedUserId = userId;
      navigationState.setActiveTab("users");
    },

    /**
     * Navigate to challenges tab with a specific challenge pre-selected
     */
    navigateToChallenge(challengeId: string) {
      context.selectedChallengeId = challengeId;
      navigationState.setActiveTab("challenges");
    },

    /**
     * Navigate to announcements tab with a specific announcement pre-selected
     */
    navigateToAnnouncement(announcementId: string) {
      context.selectedAnnouncementId = announcementId;
      navigationState.setActiveTab("announcements");
    },

    /**
     * Clear the user selection (call after consuming the context)
     */
    clearUserSelection() {
      context.selectedUserId = null;
    },

    /**
     * Clear the challenge selection
     */
    clearChallengeSelection() {
      context.selectedChallengeId = null;
    },

    /**
     * Clear the announcement selection
     */
    clearAnnouncementSelection() {
      context.selectedAnnouncementId = null;
    },

    /**
     * Clear all selections
     */
    clearAll() {
      context.selectedUserId = null;
      context.selectedChallengeId = null;
      context.selectedAnnouncementId = null;
    },
  };
}

export const adminNavigationContext = createAdminNavigationContext();
