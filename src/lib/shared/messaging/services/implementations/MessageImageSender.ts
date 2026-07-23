import {
  getAuthInstance,
  getFunctionsInstance,
  getStorageInstance,
} from "$lib/shared/auth/firebase";
import { httpsCallable } from "firebase/functions";
import {
  deleteObject,
  ref,
  uploadBytesResumable,
  type UploadTask,
} from "firebase/storage";
import type {
  IMessageImageSender,
  MessageImageSendHandle,
  MessageImageSendRequest,
  MessageImageSendResult,
} from "../contracts/IMessageImageSender";

export class MessageImageSender implements IMessageImageSender {
  send(request: MessageImageSendRequest): MessageImageSendHandle {
    let cancelled = false;
    let uploadTask: UploadTask | undefined;

    const promise = (async (): Promise<MessageImageSendResult> => {
      const [auth, storage, functions] = await Promise.all([
        getAuthInstance(),
        getStorageInstance(),
        getFunctionsInstance(),
      ]);
      const user = auth.currentUser;
      if (!user || user.isAnonymous) {
        throw new Error("Sign in with an account to send images.");
      }
      if (cancelled) throw new Error("Image send cancelled.");

      const stagingPath =
        `message-image-staging/${user.uid}/${request.conversationId}/` +
        `${request.messageId}/${request.attachmentId}`;
      const stagingRef = ref(storage, stagingPath);

      try {
        uploadTask = uploadBytesResumable(stagingRef, request.file, {
          contentType: request.file.type,
          customMetadata: {
            conversationId: request.conversationId,
            messageId: request.messageId,
            attachmentId: request.attachmentId,
          },
        });

        await new Promise<void>((resolve, reject) => {
          uploadTask?.on(
            "state_changed",
            (snapshot) => {
              const fraction = snapshot.totalBytes
                ? snapshot.bytesTransferred / snapshot.totalBytes
                : 0;
              request.onProgress?.({ phase: "uploading", fraction });
            },
            reject,
            resolve
          );
        });

        if (cancelled) throw new Error("Image send cancelled.");
        request.onProgress?.({ phase: "finalizing", fraction: 1 });
        const finalize = httpsCallable<
          Omit<MessageImageSendRequest, "file" | "onProgress">,
          MessageImageSendResult
        >(functions, "finalizeMessageImage");
        const result = await finalize({
          conversationId: request.conversationId,
          messageId: request.messageId,
          attachmentId: request.attachmentId,
          content: request.content,
          ...(request.replyTo ? { replyTo: request.replyTo } : {}),
        });
        return result.data;
      } finally {
        await deleteObject(stagingRef).catch(() => undefined);
      }
    })();

    return {
      promise,
      cancel() {
        cancelled = true;
        uploadTask?.cancel();
      },
    };
  }
}
