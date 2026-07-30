import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { buildSequenceSharePayload } from "../../domain/build-sequence-share-payload";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SendAttachmentSheet from "./SendAttachmentSheet.svelte";
import { inboxState } from "../../state/inbox-state.svelte";

const mocks = vi.hoisted(() => ({
  conversations: [] as Array<Record<string, unknown>>,
  inbox: { shareAttachmentConversationId: null as string | null },
  createShortCode: vi.fn(),
  ensureGuestIdentity: vi.fn(),
  getOrCreateConversation: vi.fn(),
  searchUsers: vi.fn(),
  sendMessage: vi.fn(),
  sendImage: vi.fn(),
  showUserError: vi.fn(),
}));

vi.mock("$lib/shared/application/get-error-handler", () => ({
  getErrorHandler: () => ({ showUserError: mocks.showUserError }),
}));

vi.mock("$lib/shared/application/get-haptic-feedback", () => ({
  getHapticFeedback: () => ({ trigger: vi.fn() }),
}));

vi.mock("$lib/shared/auth/services/guest-identity", () => ({
  ensureGuestIdentity: mocks.ensureGuestIdentity,
}));

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: { user: { uid: "current-user" } },
}));

vi.mock("$lib/shared/messaging/services/conversation-manager", () => ({
  conversationService: {
    getOrCreateConversation: mocks.getOrCreateConversation,
  },
}));

vi.mock("$lib/shared/messaging/services/messenger", () => ({
  messagingService: { sendMessage: mocks.sendMessage },
}));

vi.mock("$lib/shared/messaging/get-message-image-sender", () => ({
  getMessageImageSender: () => ({ send: mocks.sendImage }),
}));

vi.mock("$lib/shared/qr/get-short-code-manager", () => ({
  getShortCodeManager: () => ({
    createShortCode: mocks.createShortCode,
  }),
}));

vi.mock("$lib/shared/user-search/services/user-searcher", () => ({
  searchUsers: mocks.searchUsers,
}));

vi.mock("../../state/inbox-state.svelte", () => ({
  inboxState: {
    conversations: mocks.conversations,
    get shareAttachmentConversationId() {
      return mocks.inbox.shareAttachmentConversationId;
    },
    clearPendingNavigation() {
      mocks.inbox.shareAttachmentConversationId = null;
    },
    // Mirrors the one field of openAttachmentShare this sheet consumes; the
    // real state module's own contract is covered by its unit tests.
    openAttachmentShare(
      _attachment: unknown,
      options: { conversationId?: string } = {}
    ) {
      mocks.inbox.shareAttachmentConversationId = options.conversationId ?? null;
    },
  },
}));

function createPayload() {
  return buildSequenceSharePayload(
    createSequenceData({
      id: "sequence-1",
      name: "Practice pair",
      word: "ABABABAB",
    })
  );
}

function addGroupConversation(): void {
  mocks.conversations.push({
    id: "group-1",
    type: "group",
    groupName: "Tuesday Jam",
    participantCount: 4,
    participantPreviews: [],
    unreadCount: 0,
    updatedAt: new Date("2026-07-27T12:00:00Z"),
  });
}

function addDirectConversation(): void {
  mocks.conversations.push({
    id: "conv_paul",
    type: "direct",
    otherParticipant: {
      userId: "paul",
      displayName: "Paul",
      joinedAt: new Date("2026-07-01T12:00:00Z"),
    },
    unreadCount: 0,
    updatedAt: new Date("2026-07-28T12:00:00Z"),
  });
}

describe("SendAttachmentSheet", () => {
  beforeEach(() => {
    mocks.conversations.length = 0;
    mocks.inbox.shareAttachmentConversationId = null;
    mocks.createShortCode.mockReset();
    mocks.createShortCode.mockResolvedValue({ code: "SHARE1" });
    mocks.ensureGuestIdentity.mockReset();
    mocks.ensureGuestIdentity.mockResolvedValue(undefined);
    mocks.getOrCreateConversation.mockReset();
    mocks.searchUsers.mockReset();
    mocks.sendMessage.mockReset();
    mocks.sendMessage.mockResolvedValue({ id: "message-1" });
    mocks.sendImage.mockReset();
    mocks.sendImage.mockReturnValue({
      promise: Promise.resolve({
        messageId: "message-1",
        storagePath: "p",
        width: 1,
        height: 1,
      }),
      cancel: vi.fn(),
    });
    mocks.showUserError.mockReset();
  });

  it("sends an attachment-only message to an existing group", async () => {
    addGroupConversation();
    const onSent = vi.fn();

    render(SendAttachmentSheet, {
      attachment: { type: "sequence", payload: createPayload() },
      onSent,
    });

    await page.getByRole("button", { name: /Send to Tuesday Jam/ }).click();

    await expect
      .element(page.getByRole("combobox", { name: "Search users" }))
      .not.toBeInTheDocument();
    await page.getByRole("button", { name: "Change" }).click();
    await expect
      .element(page.getByRole("combobox", { name: "Search users" }))
      .toBeInTheDocument();
    await page.getByRole("button", { name: /Send to Tuesday Jam/ }).click();
    await page.getByRole("button", { name: "Send sequence" }).click();

    await vi.waitFor(() => {
      expect(mocks.sendMessage).toHaveBeenCalledOnce();
    });

    expect(mocks.getOrCreateConversation).not.toHaveBeenCalled();
    expect(mocks.createShortCode).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sequence-1" }),
      { embedSequenceData: true }
    );
    expect(mocks.sendMessage).toHaveBeenCalledWith({
      conversationId: "group-1",
      content: "",
      attachments: [
        expect.objectContaining({
          type: "sequence",
          url: "/q/SHARE1",
          name: "AB",
        }),
      ],
    });
    expect(onSent).toHaveBeenCalledWith("group-1");
  });

  it("starts a direct conversation for a searched person and sends the note", async () => {
    mocks.searchUsers.mockResolvedValue([
      {
        uid: "new-user",
        displayName: "Alex Rivera",
        username: "alex",
      },
    ]);
    mocks.getOrCreateConversation.mockResolvedValue({
      conversation: { id: "direct-1" },
      isNew: true,
    });
    const onSent = vi.fn();

    render(SendAttachmentSheet, {
      attachment: { type: "sequence", payload: createPayload() },
      onSent,
    });

    const search = page.getByRole("combobox", { name: "Search users" });
    await search.fill("alex");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await page.getByRole("option", { name: /Alex Rivera/ }).click();
    await page.getByRole("textbox", { name: /Note/ }).fill("  Try this one  ");
    await page.getByRole("button", { name: "Send sequence" }).click();

    await vi.waitFor(() => {
      expect(mocks.sendMessage).toHaveBeenCalledOnce();
    });

    expect(mocks.getOrCreateConversation).toHaveBeenCalledWith("new-user", {
      silent: true,
    });
    expect(mocks.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "direct-1",
        content: "Try this one",
      })
    );
    expect(onSent).toHaveBeenCalledWith("direct-1");
  });

  it("surfaces a send failure and restores the send action", async () => {
    addGroupConversation();
    mocks.sendMessage.mockRejectedValue(new Error("permission denied"));

    render(SendAttachmentSheet, {
      attachment: { type: "sequence", payload: createPayload() },
      onSent: vi.fn(),
    });

    await page.getByRole("button", { name: /Send to Tuesday Jam/ }).click();
    await page.getByRole("button", { name: "Send sequence" }).click();

    await vi.waitFor(() => {
      expect(mocks.showUserError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "The sequence wasn’t sent. Try again.",
          technicalDetails: "permission denied",
        })
      );
    });

    await expect
      .element(page.getByRole("button", { name: "Send sequence" }))
      .toBeEnabled();
  });

  it("uploads an image attachment through the image sender", async () => {
    addGroupConversation();
    const onSent = vi.fn();

    render(SendAttachmentSheet, {
      attachment: {
        type: "image",
        file: new File([new Uint8Array([1, 2, 3])], "shared.png", {
          type: "image/png",
        }),
        messageId: "msg-1",
        attachmentId: "att-1",
      },
      initialNote: "from the share sheet",
      onSent,
    });

    await page.getByRole("button", { name: /Send to Tuesday Jam/ }).click();
    await page.getByRole("button", { name: "Send image" }).click();

    await vi.waitFor(() => {
      expect(mocks.sendImage).toHaveBeenCalledOnce();
    });

    expect(mocks.sendImage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "group-1",
        messageId: "msg-1",
        attachmentId: "att-1",
        content: "from the share sheet",
      })
    );
    // An image never goes through the message writer; the sender owns the write.
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(onSent).toHaveBeenCalledWith("group-1");
  });

  it("opens with the direct-share conversation already selected", async () => {
    addDirectConversation();
    inboxState.openAttachmentShare(
      {
        type: "image",
        file: new File([new Uint8Array([1])], "a.png", { type: "image/png" }),
        messageId: "m1",
        attachmentId: "a1",
      },
      { conversationId: "conv_paul", receiptId: "si_1" }
    );

    render(SendAttachmentSheet, {
      attachment: {
        type: "image",
        file: new File([new Uint8Array([1])], "a.png", { type: "image/png" }),
        messageId: "m1",
        attachmentId: "a1",
      },
      onSent: vi.fn(),
    });

    // The whole point of a Direct Share tap: the next tap is Send, not a pick.
    await expect
      .element(page.getByRole("button", { name: "Send image" }))
      .toBeEnabled();
    // Pre-selected, not merely enabled: the picker is gone and Paul is named.
    await expect.element(page.getByText("Paul")).toBeInTheDocument();
    await expect
      .element(page.getByRole("combobox", { name: "Search users" }))
      .not.toBeInTheDocument();
  });

  it("leaves the sheet unselected when the shortcut names a stale conversation", async () => {
    addDirectConversation();
    inboxState.openAttachmentShare(
      { type: "sequence", payload: createPayload() },
      { conversationId: "conv_deleted" }
    );

    render(SendAttachmentSheet, {
      attachment: { type: "sequence", payload: createPayload() },
      onSent: vi.fn(),
    });

    await expect
      .element(page.getByRole("button", { name: "Send sequence" }))
      .toBeDisabled();
    await expect
      .element(page.getByRole("combobox", { name: "Search users" }))
      .toBeInTheDocument();
  });
});
