import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "$lib/shared/feedback/domain/models/notification-models";
import NotificationPreferencesPanel from "./NotificationPreferencesPanel.svelte";

const mocks = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  savePreferences: vi.fn(),
  togglePreference: vi.fn(),
  enableAll: vi.fn(),
  disableAll: vi.fn(),
  setAllEventPreferences: vi.fn(),
  getRegistrationState: vi.fn(),
  getSetupState: vi.fn(),
  enableForCurrentDevice: vi.fn(),
  unregisterToken: vi.fn(),
}));

vi.mock(
  "$lib/features/feedback/services/notification-preferences-manager",
  () => ({
    getPreferences: mocks.getPreferences,
    savePreferences: mocks.savePreferences,
    togglePreference: mocks.togglePreference,
    enableAll: mocks.enableAll,
    disableAll: mocks.disableAll,
    setAllEventPreferences: mocks.setAllEventPreferences,
  })
);

vi.mock("$lib/shared/push/get-fcm-token-manager", () => ({
  getFCMTokenManager: () => ({
    getRegistrationState: mocks.getRegistrationState,
    getSetupState: mocks.getSetupState,
    enableForCurrentDevice: mocks.enableForCurrentDevice,
    unregisterToken: mocks.unregisterToken,
  }),
}));

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: {
    isAuthenticated: true,
    isAdmin: false,
    user: {
      uid: "notification-test-user",
      email: "spinner@example.com",
      emailVerified: true,
    },
  },
}));

vi.mock("$lib/shared/debug/state/user-preview-state.svelte", () => ({
  userPreviewState: { isActive: false, data: null },
  getPreviewNotificationPreferences: () => null,
}));

const translations: Record<string, string> = {
  feedback_notification_prefs: "Notification Preferences",
  feedback_notification_prefs_subtitle: "Choose notifications",
  feedback_delivery_methods: "Delivery methods",
  feedback_delivery_methods_desc: "Choose where notifications can reach you",
  feedback_in_app_alerts: "In-app alerts",
  feedback_in_app_alerts_desc: "Choose app alerts",
  feedback_push_notifications: "Push notifications",
  feedback_push_setup: "Set up",
  feedback_push_setup_desc: "Tap to set up push on this device",
  feedback_toggle_push: "Toggle push notifications",
  feedback_email_notifications: "Email notifications",
  feedback_email_off: "Email off",
  feedback_email_off_desc: "Off until you choose to receive email",
  feedback_toggle_email: "Toggle email notifications",
  feedback_email_categories: "Email me about",
  feedback_email_categories_desc: "Pick the updates you want",
  feedback_email_messages: "Chat messages",
  feedback_email_messages_desc: "New chat messages",
  feedback_email_feedback: "Feedback outcomes",
  feedback_email_feedback_desc: "Feedback progress and outcomes",
  feedback_email_platform_updates: "Product updates",
  feedback_email_platform_updates_desc: "New releases",
  feedback_group_messages: "Messages",
  feedback_group_messages_desc: "Choose chat alerts",
  feedback_group_feedback: "Feedback",
  feedback_group_feedback_desc: "Choose feedback alerts",
  feedback_group_activity: "Community activity",
  feedback_group_activity_desc: "Choose community alerts",
  feedback_group_admin: "Admin notifications",
  feedback_group_admin_desc: "Choose admin alerts",
  feedback_enable_all: "Enable all",
  feedback_disable_all: "Disable all",
  feedback_system_notice: "System notices stay on",
  feedback_notif_desc_message: "When someone sends you a message",
};

vi.mock("$lib/shared/i18n/i18n.svelte.js", () => ({
  t: (key: string) => translations[key] ?? key,
}));

describe("NotificationPreferencesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPreferences.mockResolvedValue({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      pushEnabled: true,
    });
    mocks.getRegistrationState.mockResolvedValue("setup-required");
    mocks.getSetupState.mockResolvedValue("setup-required");
    mocks.enableForCurrentDevice.mockResolvedValue("ready");
    mocks.savePreferences.mockResolvedValue(undefined);
    mocks.togglePreference.mockResolvedValue(undefined);
    mocks.setAllEventPreferences.mockResolvedValue(undefined);
  });

  it("shows chat controls and does not claim unregistered push is active", async () => {
    render(NotificationPreferencesPanel);

    await expect
      .element(page.getByRole("heading", { name: "Delivery methods" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("heading", { name: "Messages" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("heading", { name: "In-app alerts" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("heading", { name: "Admin notifications" }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByText("When someone sends you a message"))
      .toBeVisible();

    const pushToggle = page.getByRole("button", {
      name: "Toggle push notifications",
    });
    await expect.element(pushToggle).toHaveAttribute("aria-pressed", "false");
    await expect
      .element(page.getByText("Set up", { exact: true }))
      .toBeVisible();
  });

  it("starts email as an explicit opt-in with all requested categories", async () => {
    render(NotificationPreferencesPanel);

    const emailToggle = page.getByRole("button", {
      name: "Toggle email notifications",
    });
    await expect.element(emailToggle).toHaveAttribute("aria-pressed", "false");
    await expect
      .element(page.getByText("Chat messages", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("Feedback outcomes", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("Product updates", { exact: true }))
      .toBeVisible();

    await emailToggle.click();
    await expect.poll(() => mocks.savePreferences.mock.calls.length).toBe(1);
    expect(mocks.savePreferences).toHaveBeenCalledWith(
      "notification-test-user",
      expect.objectContaining({
        emailEnabled: true,
        emailMessages: true,
        emailFeedback: true,
        emailPlatformUpdates: true,
      })
    );
  });
});
