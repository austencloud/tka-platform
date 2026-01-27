/**
 * Dashboard State Wrapper
 * Manages all reactive state for the dashboard
 * Supports preview mode for admin user viewing
 */

import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { featureFlagService } from "$lib/shared/auth/services/FeatureFlagService.svelte";
import { libraryState } from "$lib/features/library/state/library-state.svelte";
import { userPreviewState } from "$lib/shared/debug/state/user-preview-state.svelte";
import { getModuleGradient } from "../domain/models/dashboard-config";
import type { FeedbackItem } from "$lib/features/feedback/domain/models/feedback-models";
import type { User } from "firebase/auth";
import type { ModuleDefinition } from "$lib/shared/navigation/domain/types";
import type { PreviewUserProfile } from "$lib/shared/debug/state/user-preview-state.svelte";

/**
 * Module card displayed on the dashboard
 */
export interface DashboardModuleCard extends ModuleDefinition {
  gradient: string;
  isLocked: boolean;
}

/**
 * Internal state structure (not exported to consumers)
 */
interface InternalDashboardState {
  challengeDrawerOpen: boolean;
  signInToastMessage: string;
  showSignInToast: boolean;
  signInToastTimeout: ReturnType<typeof setTimeout> | null;
  isVisible: boolean;
  feedbackDetailItem: FeedbackItem | null;
  feedbackDetailOpen: boolean;
}

/**
 * Public interface for dashboard state consumers
 */
export interface DashboardState {
  challengeDrawerOpen: boolean;
  readonly signInToastMessage: string;
  readonly showSignInToast: boolean;
  isVisible: boolean;
  readonly feedbackDetailItem: FeedbackItem | null;
  readonly feedbackDetailOpen: boolean;
  readonly isAuthenticated: boolean;
  readonly user: User | null;
  readonly sequenceCount: number;
  readonly favoriteCount: number;
  readonly greeting: string;
  readonly welcomeMessage: string;
  readonly moduleCards: DashboardModuleCard[];
  readonly isPreviewActive: boolean;
  readonly previewProfile: PreviewUserProfile | null;
  showSignInRequiredToast: (moduleName: string) => void;
  clearToast: () => void;
  openFeedbackDetail: (item: FeedbackItem) => void;
  closeFeedbackDetail: () => void;
}

function createDashboardState() {
  const state: InternalDashboardState = $state({
    challengeDrawerOpen: false,
    signInToastMessage: "",
    showSignInToast: false,
    signInToastTimeout: null,
    isVisible: false,
    feedbackDetailItem: null,
    feedbackDetailOpen: false,
  });

  // Derived values
  const isAuthenticated = $derived(authState.isAuthenticated);
  const user = $derived(authState.user);
  const isPreviewActive = $derived(userPreviewState.isActive);
  const previewProfile = $derived(userPreviewState.data.profile);

  // Use preview data when active, otherwise use actual data
  const effectiveDisplayName = $derived(
    isPreviewActive && previewProfile
      ? previewProfile.displayName
      : (user?.displayName ?? null)
  );

  const sequenceCount = $derived(
    isPreviewActive
      ? userPreviewState.data.sequences.length
      : libraryState.sequences.length
  );
  const favoriteCount = $derived(
    isPreviewActive
      ? 0 // Preview doesn't track favorites yet
      : libraryState.sequences.filter((s) => s.isFavorite).length
  );

  const greeting = $derived.by(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  });

  const welcomeMessage = $derived.by(() => {
    // When previewing another user, show their name
    if (isPreviewActive && previewProfile) {
      const firstName = (
        previewProfile.displayName ||
        previewProfile.email ||
        "User"
      ).split(" ")[0];
      return `Viewing as ${firstName}`;
    }
    // Normal authenticated user
    if (isAuthenticated && effectiveDisplayName) {
      const firstName = effectiveDisplayName.split(" ")[0];
      return `${greeting}, ${firstName}`;
    }
    return "Welcome to TKA Scribe";
  });

  const moduleCards = $derived.by(() =>
    navigationState.moduleDefinitions
      .filter((m) => {
        // Only show main modules (exclude settings)
        if (!m.isMain) return false;

        // Filter out modules the user cannot access
        const canAccess = featureFlagService.canAccessModule(m.id);
        return canAccess;
      })
      .map((m) => ({
        ...m,
        gradient: getModuleGradient(m.id),
        isLocked: false,
      }))
  );

  // Effects
  $effect(() => {
    const userId = authState.effectiveUserId;
    if (userId) {
      // Library module is available synchronously via ITI
      libraryState.loadSequences();
    }
  });

  // Methods
  function showSignInRequiredToast(moduleName: string) {
    if (state.signInToastTimeout) {
      clearTimeout(state.signInToastTimeout);
    }

    state.signInToastMessage = `Sign in to unlock ${moduleName}`;
    state.showSignInToast = true;

    state.signInToastTimeout = setTimeout(() => {
      state.showSignInToast = false;
    }, 3000);
  }

  function clearToast() {
    if (state.signInToastTimeout) {
      clearTimeout(state.signInToastTimeout);
    }
  }

  function openFeedbackDetail(item: FeedbackItem) {
    state.feedbackDetailItem = item;
    state.feedbackDetailOpen = true;
  }

  function closeFeedbackDetail() {
    state.feedbackDetailOpen = false;
    state.feedbackDetailItem = null;
  }

  return {
    get challengeDrawerOpen() {
      return state.challengeDrawerOpen;
    },
    set challengeDrawerOpen(value: boolean) {
      state.challengeDrawerOpen = value;
    },

    get signInToastMessage() {
      return state.signInToastMessage;
    },

    get showSignInToast() {
      return state.showSignInToast;
    },

    get isVisible() {
      return state.isVisible;
    },
    set isVisible(value: boolean) {
      state.isVisible = value;
    },

    get feedbackDetailItem() {
      return state.feedbackDetailItem;
    },

    get feedbackDetailOpen() {
      return state.feedbackDetailOpen;
    },

    isAuthenticated,
    user,
    sequenceCount,
    favoriteCount,
    greeting,
    welcomeMessage,
    moduleCards,
    isPreviewActive,
    previewProfile,

    showSignInRequiredToast,
    clearToast,
    openFeedbackDetail,
    closeFeedbackDetail,
  };
}

export function createDashboard() {
  return createDashboardState();
}
