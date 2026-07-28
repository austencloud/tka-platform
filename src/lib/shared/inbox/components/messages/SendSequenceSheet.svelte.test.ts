import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { buildSequenceSharePayload } from "../../domain/build-sequence-share-payload";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SendSequenceSheet from "./SendSequenceSheet.svelte";

const mocks = vi.hoisted(() => ({
  conversations: [] as Array<Record<string, unknown>>,
  createShortCode: vi.fn(),
  ensureGuestIdentity: vi.fn(),
  getOrCreateConversation: vi.fn(),
  searchUsers: vi.fn(),
  sendMessage: vi.fn(),
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

vi.mock("$lib/shared/qr/get-short-code-manager", () => ({
  getShortCodeManager: () => ({
    createShortCode: mocks.createShortCode,
  }),
}));

vi.mock("$lib/shared/user-search/services/user-searcher", () => ({
  searchUsers: mocks.searchUsers,
}));

vi.mock("../../state/inbox-state.svelte", () => ({
  inboxState: { conversations: mocks.conversations },
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

describe("SendSequenceSheet", () => {
  beforeEach(() => {
    mocks.conversations.length = 0;
    mocks.createShortCode.mockReset();
    mocks.createShortCode.mockResolvedValue({ code: "SHARE1" });
    mocks.ensureGuestIdentity.mockReset();
    mocks.ensureGuestIdentity.mockResolvedValue(undefined);
    mocks.getOrCreateConversation.mockReset();
    mocks.searchUsers.mockReset();
    mocks.sendMessage.mockReset();
    mocks.sendMessage.mockResolvedValue({ id: "message-1" });
    mocks.showUserError.mockReset();
  });

  it("sends an attachment-only message to an existing group", async () => {
    addGroupConversation();
    const onSent = vi.fn();

    render(SendSequenceSheet, {
      payload: createPayload(),
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

    render(SendSequenceSheet, {
      payload: createPayload(),
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

    render(SendSequenceSheet, {
      payload: createPayload(),
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
});
