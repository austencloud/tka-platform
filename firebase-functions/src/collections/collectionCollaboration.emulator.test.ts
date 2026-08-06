import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { testEnv } from "../test/setup";

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.GCLOUD_PROJECT ?? "tka-composer-test",
  });
}

const {
  shareCollection,
  updateCollectionShare,
  mutateSharedCollection,
  loadSharedCollectionMembers,
} =
  require("./collectionCollaboration") as typeof import("./collectionCollaboration");

const wrappedShare = testEnv.wrap(shareCollection);
const wrappedUpdateShare = testEnv.wrap(updateCollectionShare);
const wrappedMutate = testEnv.wrap(mutateSharedCollection);
const wrappedLoadMembers = testEnv.wrap(loadSharedCollectionMembers);
const db = getFirestore();

const ownerId = "owner-user";
const recipientId = "recipient-user";
const strangerId = "stranger-user";
const collectionId = "shared-collection";
const conversationId = "owner-recipient-conversation";

function request<T>(uid: string, data: T) {
  return {
    data,
    auth: {
      uid,
      token: { firebase: { sign_in_provider: "password" } },
    },
    rawRequest: {},
  } as never;
}

async function seedBaseData(): Promise<void> {
  await Promise.all([
    db.doc(`users/${ownerId}/collections/${collectionId}`).set({
      id: collectionId,
      ownerId,
      name: "Poi Legal",
      kind: "manual",
      isPublic: false,
      icon: "fa-folder",
      color: "#35c878",
      sequenceIds: ["owner-sequence"],
      sequenceOwnerIds: { "owner-sequence": ownerId },
      sequenceCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    db.doc(`users/${ownerId}/sequences/owner-sequence`).set({
      id: "owner-sequence",
      ownerId,
      name: "OWNER",
      word: "OWNER",
      visibility: "private",
    }),
    db.doc(`users/${recipientId}/sequences/recipient-sequence`).set({
      id: "recipient-sequence",
      ownerId: recipientId,
      name: "RECIPIENT",
      word: "RECIPIENT",
      visibility: "private",
    }),
    db.doc(`users/${recipientId}/sequences/recipient-second`).set({
      id: "recipient-second",
      ownerId: recipientId,
      name: "SECOND",
      word: "SECOND",
      visibility: "private",
    }),
    db.doc(`conversations/${conversationId}`).set({
      id: conversationId,
      type: "direct",
      participants: [ownerId, recipientId],
      participantInfo: {
        [ownerId]: { displayName: "Owner" },
        [recipientId]: { displayName: "Recipient" },
      },
      unreadCount: { [ownerId]: 0, [recipientId]: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ]);
}

beforeEach(async () => {
  await Promise.all([
    db.recursiveDelete(db.collection("users")),
    db.recursiveDelete(db.collection("conversations")),
    db.recursiveDelete(db.collection("publicSequences")),
  ]);
  await seedBaseData();
});

describe("collection collaboration callables", () => {
  it("atomically grants access and sends a collection message", async () => {
    const result = await wrappedShare(
      request(ownerId, {
        ownerId,
        collectionId,
        recipientId,
        conversationId,
        messageId: "share-message",
        role: "editor",
        note: "Add anything this collection needs.",
      })
    );

    expect(result).toMatchObject({
      collectionId,
      recipientId,
      role: "editor",
      alreadyShared: false,
    });

    const [grant, message, conversation] = await Promise.all([
      db
        .doc(
          `users/${ownerId}/collections/${collectionId}/shares/${recipientId}`
        )
        .get(),
      db.doc(`conversations/${conversationId}/messages/share-message`).get(),
      db.doc(`conversations/${conversationId}`).get(),
    ]);
    expect(grant.data()).toMatchObject({ recipientId, role: "editor" });
    expect(message.data()).toMatchObject({
      senderId: ownerId,
      content: "Add anything this collection needs.",
    });
    expect(message.data()?.attachments[0]).toMatchObject({
      type: "collection",
      metadata: {
        collectionId,
        collectionOwnerId: ownerId,
        collectionAccessRole: "editor",
      },
    });
    expect(conversation.data()?.unreadCount[recipientId]).toBe(1);
    expect(conversation.data()?.lastMessage.content).toBe(
      "Add anything this collection needs."
    );
  });

  it("is idempotent when the client retries the same grant and message", async () => {
    const data = {
      ownerId,
      collectionId,
      recipientId,
      conversationId,
      messageId: "retry-message",
      role: "viewer" as const,
      note: "Take a look.",
    };

    await wrappedShare(request(ownerId, data));
    const retry = await wrappedShare(request(ownerId, data));

    expect(retry).toMatchObject({ alreadyShared: true });
    const messages = await db
      .collection(`conversations/${conversationId}/messages`)
      .get();
    expect(messages.size).toBe(1);
    const conversation = await db.doc(`conversations/${conversationId}`).get();
    expect(conversation.data()?.unreadCount[recipientId]).toBe(1);
  });

  it("blocks viewers and strangers from changing a shared collection", async () => {
    await wrappedShare(
      request(ownerId, {
        ownerId,
        collectionId,
        recipientId,
        conversationId,
        messageId: "viewer-message",
        role: "viewer",
        note: "",
      })
    );

    await expect(
      wrappedMutate(
        request(recipientId, {
          ownerId,
          collectionId,
          mutation: { type: "rename", name: "Viewer rename" },
        })
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      wrappedMutate(
        request(strangerId, {
          ownerId,
          collectionId,
          mutation: { type: "rename", name: "Stranger rename" },
        })
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("preserves concurrent additions from an editor", async () => {
    await wrappedShare(
      request(ownerId, {
        ownerId,
        collectionId,
        recipientId,
        conversationId,
        messageId: "editor-message",
        role: "editor",
        note: "",
      })
    );

    await Promise.all([
      wrappedMutate(
        request(recipientId, {
          ownerId,
          collectionId,
          mutation: {
            type: "add",
            members: [
              { sequenceId: "recipient-sequence", ownerId: recipientId },
            ],
          },
        })
      ),
      wrappedMutate(
        request(recipientId, {
          ownerId,
          collectionId,
          mutation: {
            type: "add",
            members: [{ sequenceId: "recipient-second", ownerId: recipientId }],
          },
        })
      ),
    ]);

    const collection = await db
      .doc(`users/${ownerId}/collections/${collectionId}`)
      .get();
    expect(new Set(collection.data()?.sequenceIds)).toEqual(
      new Set(["owner-sequence", "recipient-sequence", "recipient-second"])
    );
    expect(collection.data()?.sequenceOwnerIds).toMatchObject({
      "owner-sequence": ownerId,
      "recipient-sequence": recipientId,
      "recipient-second": recipientId,
    });
    expect(collection.data()?.sequenceCount).toBe(3);
  });

  it("lets an owner change a role and lets a recipient leave", async () => {
    await wrappedShare(
      request(ownerId, {
        ownerId,
        collectionId,
        recipientId,
        conversationId,
        messageId: "access-message",
        role: "viewer",
        note: "",
      })
    );

    await wrappedUpdateShare(
      request(ownerId, {
        ownerId,
        collectionId,
        recipientId,
        operation: "set-role",
        role: "editor",
      })
    );
    const changed = await db
      .doc(`users/${ownerId}/collections/${collectionId}/shares/${recipientId}`)
      .get();
    expect(changed.data()?.role).toBe("editor");

    await wrappedUpdateShare(
      request(recipientId, {
        ownerId,
        collectionId,
        recipientId,
        operation: "remove",
      })
    );
    const removed = await db
      .doc(`users/${ownerId}/collections/${collectionId}/shares/${recipientId}`)
      .get();
    expect(removed.exists).toBe(false);
  });

  it("loads private members only for people with access", async () => {
    await wrappedShare(
      request(ownerId, {
        ownerId,
        collectionId,
        recipientId,
        conversationId,
        messageId: "load-message",
        role: "viewer",
        note: "",
      })
    );

    const loaded = await wrappedLoadMembers(
      request(recipientId, { ownerId, collectionId })
    );
    expect(loaded.sequences).toHaveLength(1);
    expect(loaded.sequences[0]).toMatchObject({ id: "owner-sequence" });

    await expect(
      wrappedLoadMembers(request(strangerId, { ownerId, collectionId }))
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});
