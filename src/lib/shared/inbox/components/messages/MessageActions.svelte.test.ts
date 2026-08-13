import { createRawSnippet } from "svelte";
import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "$lib/shared/messaging/domain/models/message-models";
import MessageActions from "./MessageActions.svelte";

vi.mock("$lib/shared/application/get-haptic-feedback", () => ({
  getHapticFeedback: () => ({ trigger: vi.fn() }),
}));

vi.mock("$lib/shared/layout/layout-state.svelte", () => ({
  layoutState: { isSideBySideLayout: true },
}));

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: {
    isAuthenticated: true,
    loading: false,
    isAdmin: false,
  },
}));

vi.mock("$lib/shared/messaging/services/messenger", () => ({
  messagingService: {
    toggleReaction: vi.fn(),
    deleteMessage: vi.fn(),
  },
}));

vi.mock("../../state/inbox-state.svelte", () => ({
  inboxState: {
    setReplyTo: vi.fn(),
    setEditingMessage: vi.fn(),
  },
}));

vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const message: Message = {
  id: "message-1",
  conversationId: "conversation-1",
  senderId: "other-user",
  senderName: "Morgan",
  content: "Selectable text",
  createdAt: new Date("2026-08-12T12:00:00Z"),
  readBy: [],
};

describe("MessageActions selection boundary", () => {
  it("keeps the native context menu and text selection inside message copy", () => {
    const children = createRawSnippet(() => ({
      render: () =>
        '<p data-message-selectable="true">Selectable message copy</p>',
    }));

    render(MessageActions, { message, isOwn: false, children });

    const wrapper = document.querySelector<HTMLElement>(".message-wrapper");
    const selectable = document.querySelector<HTMLElement>(
      '[data-message-selectable="true"]'
    );
    expect(wrapper).not.toBeNull();
    expect(selectable).not.toBeNull();
    expect(getComputedStyle(selectable!).userSelect).toBe("text");

    const textMenu = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    selectable!.dispatchEvent(textMenu);
    expect(textMenu.defaultPrevented).toBe(false);

    const bubbleMenu = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    wrapper!.dispatchEvent(bubbleMenu);
    expect(bubbleMenu.defaultPrevented).toBe(true);
  });
});
