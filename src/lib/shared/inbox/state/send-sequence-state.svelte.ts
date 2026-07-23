/**
 * send-sequence-state.svelte.ts
 *
 * Reactive singleton that controls whether the "Send Sequence" sheet is open
 * and carries the payload describing the sequence to send.
 *
 * Any component can call openSendSequenceSheet(payload) to trigger the sheet.
 * SendSequenceSheetHost reads this state and renders the drawer + sheet.
 */

import type { SequenceSharePayload } from "../domain/models/sequence-share-payload";
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

let payload = $state<SequenceSharePayload | null>(null);

export function openSendSequenceSheet(p: SequenceSharePayload): void {
  payload = p;
}

export function closeSendSequenceSheet(): void {
  payload = null;
}

export function getSendSequencePayload(): SequenceSharePayload | null {
  return payload;
}
