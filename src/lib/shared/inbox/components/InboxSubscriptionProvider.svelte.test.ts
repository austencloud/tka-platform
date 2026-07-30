import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InboxSubscriptionProvider from "./InboxSubscriptionProvider.svelte";

const mocks = vi.hoisted(() => ({
  authState: { user: { uid: "user-1" } as { uid: string } | null },
  inboxState: {
    totalUnreadCount: 1,
    setConversations: vi.fn(),
    setNotifications: vi.fn(),
  },
  claimPrompt: vi.fn<(_userId: string) => Promise<boolean>>(),
  subscribeToConversations: vi.fn(() => vi.fn()),
  subscribeToNotifications: vi.fn(() => vi.fn()),
  startForegroundListener: vi.fn(),
  stopForegroundListener: vi.fn(),
  isSupported: vi.fn<() => Promise<boolean>>(),
  getPermissionState: vi.fn<() => Promise<NotificationPermission>>(),
  registerToken: vi.fn(),
}));

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: mocks.authState,
}));

vi.mock("$lib/shared/debug/state/user-preview-state.svelte", () => ({
  userPreviewState: {
    isActive: false,
    data: { profile: null },
  },
}));

vi.mock("../state/inbox-state.svelte", () => ({
  inboxState: mocks.inboxState,
}));

vi.mock("$lib/shared/messaging/services/conversation-manager", () => ({
  conversationService: {
    subscribeToConversations: mocks.subscribeToConversations,
  },
}));

vi.mock("$lib/shared/feedback/services/notifier", () => ({
  notificationService: {
    subscribeToNotifications: mocks.subscribeToNotifications,
  },
}));

vi.mock("$lib/shared/push/get-fcm-token-manager", () => ({
  getFCMTokenManager: () => ({
    isSupported: mocks.isSupported,
    getPermissionState: mocks.getPermissionState,
    registerToken: mocks.registerToken,
  }),
}));

vi.mock("$lib/shared/push/services/push-permission-prompt-marker", () => ({
  claimPushPermissionPrompt: mocks.claimPrompt,
}));

vi.mock("$lib/shared/push/services/foreground-message-handler", () => ({
  startForegroundMessageListener: mocks.startForegroundListener,
  stopForegroundMessageListener: mocks.stopForegroundListener,
}));

describe("InboxSubscriptionProvider push prompt", () => {
  beforeEach(() => {
    mocks.authState.user = { uid: "user-1" };
    mocks.inboxState.totalUnreadCount = 1;
    mocks.claimPrompt.mockReset();
    mocks.subscribeToConversations.mockClear();
    mocks.subscribeToNotifications.mockClear();
    mocks.startForegroundListener.mockClear();
    mocks.stopForegroundListener.mockClear();
    mocks.isSupported.mockReset();
    mocks.getPermissionState.mockReset();
    mocks.registerToken.mockReset();
    mocks.isSupported.mockResolvedValue(true);
    mocks.getPermissionState.mockResolvedValue("default");
  });

  it("shows the prompt only after claiming its account-level marker", async () => {
    mocks.claimPrompt.mockResolvedValue(true);

    render(InboxSubscriptionProvider);

    await vi.waitFor(() => {
      expect(mocks.claimPrompt).toHaveBeenCalledWith("user-1");
    });
    await expect
      .element(
        page.getByRole("alertdialog", {
          name: "Enable push notifications",
        })
      )
      .toBeInTheDocument();
  });

  it("does not show a prompt that the account has already claimed", async () => {
    mocks.claimPrompt.mockResolvedValue(false);

    render(InboxSubscriptionProvider);

    await vi.waitFor(() => {
      expect(mocks.claimPrompt).toHaveBeenCalledWith("user-1");
    });
    expect(
      document.querySelector('[aria-label="Enable push notifications"]')
    ).toBeNull();
  });
});
