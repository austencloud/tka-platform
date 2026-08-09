import type { UserNotification } from "$lib/shared/notifications/domain/models/notification-models";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InboxNotificationItem from "./InboxNotificationItem.svelte";

const mocks = vi.hoisted(() => ({
  closeInbox: vi.fn(),
  goto: vi.fn(),
  handleModuleChange: vi.fn(),
  setNotificationTargetFeedback: vi.fn(),
  setScanNotificationTarget: vi.fn(),
  showUserError: vi.fn(),
}));

vi.mock("$app/navigation", () => ({
  goto: mocks.goto,
}));

vi.mock("$lib/shared/application/get-error-handler", () => ({
  getErrorHandler: () => ({ showUserError: mocks.showUserError }),
}));

vi.mock("$lib/shared/application/get-haptic-feedback", () => ({
  getHapticFeedback: () => ({ trigger: vi.fn() }),
}));

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: { effectiveUserId: "admin-user" },
}));

vi.mock(
  "$lib/shared/navigation-coordinator/navigation-coordinator.svelte",
  () => ({
    handleModuleChange: mocks.handleModuleChange,
  })
);

vi.mock("$lib/shared/feedback/state/notification-action-state.svelte", () => ({
  setNotificationTargetFeedback: mocks.setNotificationTargetFeedback,
}));

vi.mock(
  "$lib/features/choreo-card/state/scan-notification-target.svelte",
  () => ({
    setScanNotificationTarget: mocks.setScanNotificationTarget,
  })
);

vi.mock("../../state/inbox-state.svelte", () => ({
  inboxState: {
    close: mocks.closeInbox,
    setTab: vi.fn(),
  },
}));

describe("InboxNotificationItem returning-user navigation", () => {
  beforeEach(() => {
    mocks.closeInbox.mockReset();
    mocks.goto.mockReset();
    mocks.goto.mockResolvedValue(undefined);
    mocks.handleModuleChange.mockReset();
    mocks.handleModuleChange.mockResolvedValue(undefined);
    mocks.showUserError.mockReset();
  });

  it("opens the user activity page when an older live payload only has fromUserId", async () => {
    const notification = {
      id: "return-1",
      userId: "admin-user",
      type: "admin-user-returned",
      message: "Codex + Claude is back in the app",
      createdAt: new Date("2026-08-09T05:26:35.592Z"),
      read: true,
      fromUserId: "agent-codex-claude",
    } satisfies UserNotification;

    render(InboxNotificationItem, { notification });

    await page
      .getByRole("button", { name: "Codex + Claude is back in the app" })
      .click();

    await vi.waitFor(() => {
      expect(mocks.goto).toHaveBeenCalledWith(
        "/admin/users?inspectUser=agent-codex-claude",
        { replaceState: true, keepFocus: true, noScroll: true }
      );
    });
    expect(mocks.closeInbox).toHaveBeenCalledOnce();
    expect(mocks.handleModuleChange).toHaveBeenCalledWith("admin", "users", {
      skipHistory: true,
    });
    expect(mocks.showUserError).not.toHaveBeenCalled();
  });
});
