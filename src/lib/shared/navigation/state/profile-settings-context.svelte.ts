/**
 * Profile Settings Context
 *
 * Context-based state for profile settings feature.
 * State lives in the component tree, not the module graph.
 * This enables proper HMR without full page reloads.
 *
 * HMR test edit - this should NOT cause a full page reload!
 *
 * Usage:
 *   // In root component (ProfileTab.svelte):
 *   const state = createProfileSettingsState();
 *   setContext(PROFILE_SETTINGS_KEY, state);
 *
 *   // In child components:
 *   const state = getProfileSettingsContext();
 */

import { getContext, setContext } from "svelte";
import type { User } from "firebase/auth";

// ============================================================================
// CONTEXT KEY
// ============================================================================

const PROFILE_SETTINGS_KEY = Symbol("profile-settings");

// ============================================================================
// TYPES
// ============================================================================

export type SettingsTab =
  | "personal"
  | "security"
  | "subscription"
  | "developer";

export interface PersonalInfoState {
  displayName: string;
  email: string;
}

export interface PasswordState {
  current: string;
  new: string;
}

export interface EmailChangeState {
  newEmail: string;
  password: string;
}

export interface UIState {
  activeTab: SettingsTab;
  previousTab: SettingsTab;
  transitionDirection: -1 | 0 | 1;
  saving: boolean;
  uploadingPhoto: boolean;
  showPasswordSection: boolean;
  showDeleteConfirmation: boolean;
  showEmailChangeSection: boolean;
  changingEmail: boolean;
}

export interface ViewportState {
  contentContainer: HTMLDivElement | null;
  availableHeight: number;
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createProfileSettingsState() {
  // Form state
  const personalInfo = $state<PersonalInfoState>({
    displayName: "",
    email: "",
  });

  const originalPersonalInfo = $state<PersonalInfoState>({
    displayName: "",
    email: "",
  });

  const password = $state<PasswordState>({
    current: "",
    new: "",
  });

  const emailChange = $state<EmailChangeState>({
    newEmail: "",
    password: "",
  });

  // UI state
  const ui = $state<UIState>({
    activeTab: "personal",
    previousTab: "personal",
    transitionDirection: 0,
    saving: false,
    uploadingPhoto: false,
    showPasswordSection: false,
    showDeleteConfirmation: false,
    showEmailChangeSection: false,
    changingEmail: false,
  });

  // Viewport state
  const viewport = $state<ViewportState>({
    contentContainer: null,
    availableHeight: 0,
  });

  // Tab order for transitions
  const TAB_ORDER: SettingsTab[] = ["personal", "security", "subscription"];

  return {
    // State objects (reactive)
    personalInfo,
    originalPersonalInfo,
    password,
    emailChange,
    ui,
    viewport,

    // Computed values
    isCompactMode: () => viewport.availableHeight > 0 && viewport.availableHeight < 600,
    isVeryCompactMode: () => viewport.availableHeight > 0 && viewport.availableHeight < 500,

    hasPersonalInfoChanges: () =>
      personalInfo.displayName !== originalPersonalInfo.displayName,

    // User-dependent helpers
    hasPasswordProvider: (user: User | null): boolean => {
      if (!user?.providerData) return false;
      return user.providerData.some(
        (provider) => provider.providerId === "password"
      );
    },

    canChangeEmail: (user: User | null): boolean => {
      if (!user?.providerData) return false;
      return (
        user.providerData.length === 1 &&
        user.providerData[0]?.providerId === "password"
      );
    },

    // State synchronization
    syncWithUser: (user: User | null) => {
      if (user) {
        const displayName = user.displayName || "";
        const email = user.email || "";

        personalInfo.displayName = displayName;
        personalInfo.email = email;
        originalPersonalInfo.displayName = displayName;
        originalPersonalInfo.email = email;
      }
    },

    // Reset functions
    resetPersonalInfoForm: () => {
      personalInfo.displayName = originalPersonalInfo.displayName;
      personalInfo.email = originalPersonalInfo.email;
    },

    resetPasswordForm: () => {
      password.current = "";
      password.new = "";
    },

    resetEmailChangeForm: () => {
      emailChange.newEmail = "";
      emailChange.password = "";
    },

    resetUIState: () => {
      ui.saving = false;
      ui.uploadingPhoto = false;
      ui.showPasswordSection = false;
      ui.showDeleteConfirmation = false;
      ui.showEmailChangeSection = false;
      ui.changingEmail = false;
    },

    // Tab transitions
    updateTabTransition: (newTab: SettingsTab) => {
      const oldIndex = TAB_ORDER.indexOf(ui.activeTab);
      const newIndex = TAB_ORDER.indexOf(newTab);

      ui.previousTab = ui.activeTab;
      ui.transitionDirection =
        newIndex > oldIndex ? 1 : newIndex < oldIndex ? -1 : 0;
      ui.activeTab = newTab;
    },

    // Viewport tracking
    setupViewportTracking: (): (() => void) | null => {
      if (!viewport.contentContainer) return null;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          viewport.availableHeight = entry.contentRect.height;
        }
      });

      resizeObserver.observe(viewport.contentContainer);

      return () => {
        resizeObserver.disconnect();
      };
    },
  };
}

export type ProfileSettingsState = ReturnType<typeof createProfileSettingsState>;

// ============================================================================
// CONTEXT HELPERS
// ============================================================================

export function setProfileSettingsContext(state: ProfileSettingsState): void {
  setContext(PROFILE_SETTINGS_KEY, state);
}

export function getProfileSettingsContext(): ProfileSettingsState {
  const ctx = getContext<ProfileSettingsState>(PROFILE_SETTINGS_KEY);
  if (!ctx) {
    throw new Error(
      "Profile settings context not found. Did you forget to call setProfileSettingsContext in a parent component?"
    );
  }
  return ctx;
}

/**
 * Optional getter that returns undefined if context not available.
 * Useful for components that can work with or without the context.
 */
export function tryGetProfileSettingsContext(): ProfileSettingsState | undefined {
  return getContext<ProfileSettingsState | undefined>(PROFILE_SETTINGS_KEY);
}
