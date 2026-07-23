import { getStorage } from "firebase-admin/storage";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

export const deleteMessageImages = onDocumentUpdated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (
      !before ||
      !after ||
      before.isDeleted === true ||
      after.isDeleted !== true
    ) {
      return;
    }

    const { conversationId, messageId } = event.params;
    const prefix = `message-images/${conversationId}/${messageId}/`;
    const attachments = Array.isArray(after.attachments)
      ? after.attachments
      : [];
    const paths = attachments
      .filter((attachment) => attachment?.type === "image")
      .map((attachment) => attachment?.storagePath)
      .filter(
        (storagePath): storagePath is string =>
          typeof storagePath === "string" &&
          storagePath.startsWith(prefix) &&
          !storagePath.slice(prefix.length).includes("/")
      );

    const bucket = getStorage().bucket();
    await Promise.all(
      paths.map((storagePath) =>
        bucket.file(storagePath).delete({ ignoreNotFound: true })
      )
    );
  }
);
