import type { Firestore } from "firebase-admin/firestore";
import { deliverMessageRequest } from "./deliverMessage";

function createHarness() {
  let messageExists = false;
  const create = jest.fn(() => {
    messageExists = true;
  });
  const update = jest.fn();
  const conversationData = {
    participants: ["sender", "recipient-a", "recipient-b"],
    participantInfo: {
      sender: { displayName: "Austen", avatar: "avatar.webp" },
    },
  };
  const doc = jest.fn((path: string) => ({
    path,
    collection: (name: string) => ({
      doc: (id: string) => ({ path: `${path}/${name}/${id}` }),
    }),
  }));
  const transaction = {
    get: jest.fn(async (ref: { path: string }) => {
      if (ref.path === "conversations/conversation-1") {
        return { exists: true, data: () => conversationData };
      }
      if (ref.path.endsWith("/messages/message-1")) {
        return {
          exists: messageExists,
          data: () => (messageExists ? { senderId: "sender" } : undefined),
        };
      }
      return { exists: false, data: () => undefined };
    }),
    create,
    update,
  };
  const runTransaction = jest.fn(
    async (callback: (tx: typeof transaction) => Promise<void>) =>
      callback(transaction)
  );
  const firestore = { doc, runTransaction } as unknown as Firestore;
  return { create, update, runTransaction, firestore };
}

describe("deliverMessageRequest", () => {
  it("delivers a repeated stable message ID exactly once", async () => {
    const harness = createHarness();
    const request = {
      conversationId: "conversation-1",
      messageId: "message-1",
      content: "Hello",
    };

    const first = await deliverMessageRequest(
      "sender",
      request,
      harness.firestore
    );
    const retry = await deliverMessageRequest(
      "sender",
      request,
      harness.firestore
    );

    expect(first.alreadyDelivered).toBe(false);
    expect(retry.alreadyDelivered).toBe(true);
    expect(harness.create).toHaveBeenCalledTimes(1);
    expect(harness.update).toHaveBeenCalledTimes(1);
    expect(harness.update.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        "unreadCount.recipient-a": expect.anything(),
        "unreadCount.recipient-b": expect.anything(),
      })
    );
  });

  it("rejects private image attachments from the non-image endpoint", async () => {
    const harness = createHarness();

    await expect(
      deliverMessageRequest(
        "sender",
        {
          conversationId: "conversation-1",
          messageId: "message-1",
          content: "",
          attachments: [{ type: "image", storagePath: "message-images/x" }],
        },
        harness.firestore
      )
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(harness.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects executable attachment URLs", async () => {
    const harness = createHarness();

    await expect(
      deliverMessageRequest(
        "sender",
        {
          conversationId: "conversation-1",
          messageId: "message-1",
          content: "Open this",
          attachments: [{ type: "link", url: "javascript:alert(1)" }],
        },
        harness.firestore
      )
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(harness.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects a sender who is not in the conversation", async () => {
    const harness = createHarness();

    await expect(
      deliverMessageRequest(
        "outsider",
        {
          conversationId: "conversation-1",
          messageId: "message-1",
          content: "Nope",
        },
        harness.firestore
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(harness.create).not.toHaveBeenCalled();
  });
});
