import type { SequenceSharePayload } from "../domain/models/sequence-share-payload";
import type { PendingMessageAttachment } from "../domain/pending-message-attachment";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
import { inboxState } from "./inbox-state.svelte";
import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
export { buildSequenceSharePayload } from "../domain/build-sequence-share-payload";

const FIREBASE_STORAGE_BUCKET = "the-kinetic-alphabet.firebasestorage.app";

/**
 * Builds a direct Firebase Storage URL for a sequence thumbnail.
 * Bypasses the CloudThumbnailCache manifest check - if the thumbnail exists
 * in storage, this URL works. If not, the <img> onerror handler hides it.
 */
export function buildThumbnailUrl(
  sequenceName: string,
  propType: string,
  lightMode: boolean
): string {
  const modeSuffix = lightMode ? "_light" : "_dark";
  const storagePath = `thumbnails/gallery/${propType}/${sequenceName}${modeSuffix}.webp`;
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encodedPath}?alt=media`;
}

export function openSendSequenceSheet(p: SequenceSharePayload): void {
  if (!authState.isFullAccount) {
    authDrawerState.show("signup", "share-sequence");
    return;
  }
  inboxState.openSequenceShare(p);
}

/**
 * The share-intake entry point, called by intake-router.ts (Task 10).
 * openSendSequenceSheet stays as the sequence-shaped convenience its four
 * existing call sites already use.
 *
 * The router goes through this function rather than poking `inboxState`
 * directly so both share paths - in-app and share-sheet - enter the picker the
 * same way. An earlier revision added this function and then never called it
 * from anywhere, which is a dead export, not an entry point.
 */
export function openSendAttachmentSheet(
  attachment: PendingMessageAttachment,
  options: { note?: string; receiptId?: string; conversationId?: string } = {}
): void {
  inboxState.openAttachmentShare(attachment, options);
}

type ShareableCollection = Pick<
  LibraryCollection,
  | "id"
  | "ownerId"
  | "name"
  | "sequenceCount"
  | "coverImageUrl"
  | "color"
  | "icon"
> &
  Partial<Pick<LibraryCollection, "systemType" | "kind">>;

export function openShareCollectionSheet(
  collection: ShareableCollection
): void {
  if (!authState.isFullAccount) {
    authDrawerState.show("signup", "share-collection");
    return;
  }
  if (collection.systemType || collection.kind === "smart") return;

  inboxState.openAttachmentShare({
    type: "collection",
    payload: {
      collectionId: collection.id,
      ownerId: collection.ownerId,
      name: collection.name,
      sequenceCount: collection.sequenceCount,
      coverImageUrl: collection.coverImageUrl,
      color: collection.color,
      icon: collection.icon,
    },
  });
}
