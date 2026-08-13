import { flushSync } from "svelte";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "$lib/shared/messaging/domain/models/message-models";
import { inboxState } from "../../state/inbox-state.svelte";
import MessageComposer from "./MessageComposer.svelte";

const mocks = vi.hoisted(() => ({
  editMessage: vi.fn(),
  sendMessage: vi.fn(),
  setTyping: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("$lib/shared/application/get-haptic-feedback", () => ({
  getHapticFeedback: () => ({ trigger: vi.fn() }),
}));

vi.mock("$lib/shared/messaging/services/messenger", () => ({
  messagingService: {
    editMessage: mocks.editMessage,
    sendMessage: mocks.sendMessage,
    setTyping: mocks.setTyping,
  },
}));

vi.mock("$lib/shared/messaging/get-message-image-sender", () => ({
  getMessageImageSender: () => ({
    send: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
  }),
}));

vi.mock("$lib/shared/browse/get-browse-loader", () => ({
  getBrowseLoader: () => ({}),
}));

vi.mock("$lib/shared/qr/get-short-code-manager", () => ({
  getShortCodeManager: () => ({ createShortCode: vi.fn() }),
}));

vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  toastQueue: [],
  showToast: vi.fn(),
  removeToast: vi.fn(),
  clearToasts: vi.fn(),
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: mocks.toastError,
  },
}));

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "message-1",
    conversationId: "conversation-1",
    senderId: "current-user",
    senderName: "Austen",
    content: "Original message",
    createdAt: new Date("2026-07-31T12:00:00Z"),
    readBy: ["current-user"],
    ...overrides,
  };
}

function dispatchKey(key: string): void {
  const input = document.querySelector("textarea");
  if (!(input instanceof HTMLTextAreaElement)) {
    throw new Error("Message textarea was not rendered");
  }
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
  );
  flushSync();
}

describe("MessageComposer editing", () => {
  beforeEach(() => {
    inboxState.clearEditingMessage();
    inboxState.clearReplyTo();
    inboxState.setMessages([]);
    mocks.editMessage.mockReset();
    mocks.editMessage.mockResolvedValue(message({ content: "Corrected" }));
    mocks.sendMessage.mockReset();
    mocks.setTyping.mockReset();
    mocks.setTyping.mockResolvedValue(undefined);
    mocks.toastError.mockReset();
  });

  it("restores an unsent draft after saving an edit", async () => {
    render(MessageComposer, { conversationId: "conversation-1" });
    const composer = page.getByRole("textbox", { name: "Message input" });
    await composer.fill("Keep this draft");

    inboxState.setEditingMessage(message());
    flushSync();

    const editor = page.getByRole("textbox", { name: "Edit message" });
    await expect.element(editor).toHaveValue("Original message");
    await expect
      .element(page.getByRole("button", { name: "Save changes" }))
      .toBeDisabled();

    await editor.fill("  Corrected message  ");
    await page.getByRole("button", { name: "Save changes" }).click();

    await vi.waitFor(() => {
      expect(mocks.editMessage).toHaveBeenCalledWith(
        "conversation-1",
        "message-1",
        "Corrected message"
      );
    });
    await expect
      .element(page.getByRole("textbox", { name: "Message input" }))
      .toHaveValue("Keep this draft");
  });

  it("opens the latest editable message with Arrow Up and cancels with Escape", async () => {
    const latest = message();
    render(MessageComposer, {
      conversationId: "conversation-1",
      lastEditableMessage: latest,
    });

    dispatchKey("ArrowUp");
    await expect
      .element(page.getByRole("textbox", { name: "Edit message" }))
      .toHaveValue("Original message");

    dispatchKey("Escape");
    await expect
      .element(page.getByRole("textbox", { name: "Message input" }))
      .toHaveValue("");
    expect(mocks.editMessage).not.toHaveBeenCalled();
  });

  it("lets an attachment caption be cleared", async () => {
    inboxState.setEditingMessage(
      message({
        content: "Photo caption",
        attachments: [{ type: "image", storagePath: "message-images/x.webp" }],
      })
    );
    render(MessageComposer, { conversationId: "conversation-1" });

    const editor = page.getByRole("textbox", { name: "Edit message" });
    await expect.element(editor).toHaveValue("Photo caption");
    await editor.fill("");

    const save = page.getByRole("button", { name: "Save changes" });
    await expect.element(save).toBeEnabled();
    await save.click();

    await vi.waitFor(() => {
      expect(mocks.editMessage).toHaveBeenCalledWith(
        "conversation-1",
        "message-1",
        ""
      );
    });
  });

  it("keeps the edited text in place when saving fails", async () => {
    mocks.editMessage.mockRejectedValueOnce(new Error("offline"));
    inboxState.setEditingMessage(message());
    render(MessageComposer, { conversationId: "conversation-1" });

    const editor = page.getByRole("textbox", { name: "Edit message" });
    await editor.fill("Keep this correction");
    await page.getByRole("button", { name: "Save changes" }).click();

    await vi.waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to save changes. Please try again."
      );
    });
    await expect.element(editor).toHaveValue("Keep this correction");
    await expect
      .element(page.getByRole("button", { name: "Save changes" }))
      .toBeEnabled();
  });

  it("keeps typing keystrokes away from background app hotkeys", () => {
    const backgroundHotkey = vi.fn((event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "s") event.preventDefault();
    });
    window.addEventListener("keydown", backgroundHotkey);

    try {
      render(MessageComposer, { conversationId: "conversation-1" });
      const input = document.querySelector("textarea");
      if (!(input instanceof HTMLTextAreaElement)) {
        throw new Error("Message textarea was not rendered");
      }

      const event = new KeyboardEvent("keydown", {
        key: "s",
        code: "KeyS",
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(backgroundHotkey).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", backgroundHotkey);
    }
  });

  it("focuses the existing draft and sends a complete reply snapshot", async () => {
    const originalText = "A".repeat(240);
    inboxState.setReplyTo(
      message({
        id: "original-message",
        senderId: "other-user",
        senderName: "Morgan",
        content: originalText,
        attachments: [{ type: "sequence" }],
      })
    );
    render(MessageComposer, { conversationId: "conversation-1" });

    const composer = page.getByRole("textbox", { name: "Message input" });
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector("textarea"));
    });
    await expect.element(page.getByText("Replying to Morgan")).toBeVisible();
    await composer.fill("This is the answer");
    await page.getByRole("button", { name: "Send message" }).click();

    await vi.waitFor(() => {
      expect(mocks.sendMessage).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        content: "This is the answer",
        attachments: undefined,
        replyTo: {
          messageId: "original-message",
          senderId: "other-user",
          senderName: "Morgan",
          content: originalText,
          attachmentType: "sequence",
        },
      });
    });
    expect(inboxState.replyToMessage).toBeNull();
  });

  it("cancels a reply with Escape without clearing the draft", async () => {
    inboxState.setReplyTo(
      message({
        id: "original-message",
        senderId: "other-user",
        senderName: "Morgan",
      })
    );
    render(MessageComposer, { conversationId: "conversation-1" });
    const composer = page.getByRole("textbox", { name: "Message input" });
    await composer.fill("Keep this draft");

    dispatchKey("Escape");

    expect(inboxState.replyToMessage).toBeNull();
    await expect.element(composer).toHaveValue("Keep this draft");
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });
});
