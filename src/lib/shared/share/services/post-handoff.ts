/**
 * Post handoff — the platform-correct way to get an artifact from the sequence
 * viewer into an Instagram or Facebook post.
 *
 * The defect this replaces: the viewer's share action called
 * `navigator.share({ title, text, url })` — a LINK-only share. Instagram does
 * not accept a URL share as a feed post, so the OS share sheet was a dead end
 * for the exact case sharing exists to serve. Every path here carries the FILE.
 *
 * Platform ceilings, verified and permanent:
 *   - Facebook personal profiles cannot be posted to by any API (`publish_actions`
 *     removed 2018, never restored). Assist-only, forever.
 *   - Instagram personal accounts likewise — Graph publishing requires a
 *     Business/Creator account.
 * Phase 2 adds true auto-post for a Business IG + a Facebook Page on top of the
 * same presigned URL this module already produces. See
 * docs/superpowers/specs/active/2026-08-09-social-post-handoff-design.md.
 */

import {
  canNativeShareFile,
  downloadBlobToDisk,
  sanitizeFilename,
  shareBlobNatively,
  supportsNativeFileShare,
} from "$lib/shared/foundation/services/file-downloader";
import { detectPlatform } from "$lib/shared/mobile/services/platform-detector";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

export type ShareArtifact = "card" | "video";

export type HandoffDestinationId =
  | "native-share"
  | "copy-image-facebook"
  | "send-to-phone"
  | "download"
  | "copy-caption";

export interface HandoffDestination {
  id: HandoffDestinationId;
  label: string;
  icon: string;
  /** Primary renders as the filled button; the rest are secondary. */
  primary: boolean;
  /** Shown under the label when the action needs a word of explanation. */
  hint?: string;
}

export interface HandoffContext {
  artifact: ShareArtifact;
  /** Null while a video render is still in flight. */
  blob: Blob | null;
  filename: string;
}

/**
 * Which destinations this device can actually honor.
 *
 * Gated on the DEVICE, not the capability — desktop Chrome implements
 * `navigator.share`, so capability detection alone would offer a native share
 * that pops the Windows share sheet. That is the same gate
 * `shareOrDownloadBlob` makes, for the same reason.
 */
export function resolveDestinations(ctx: HandoffContext): HandoffDestination[] {
  const isMobile = detectPlatform() !== "desktop";
  const destinations: HandoffDestination[] = [];

  if (isMobile) {
    const shareable =
      supportsNativeFileShare() &&
      (!ctx.blob || canNativeShareFile(ctx.blob, ctx.filename));

    if (shareable) {
      destinations.push({
        id: "native-share",
        label: "Share",
        icon: "fa-solid fa-share-nodes",
        primary: true,
        hint: "Opens Instagram, Facebook, Messages…",
      });
    }
  } else {
    destinations.push({
      id: "send-to-phone",
      label: "Send to phone",
      icon: "fa-solid fa-qrcode",
      primary: true,
      hint: "Scan, save, post from Instagram",
    });

    if (ctx.artifact === "card") {
      destinations.push({
        id: "copy-image-facebook",
        label: "Copy image & open Facebook",
        // Solid only: the app loads solid.min.css, never brands.min.css, so a
        // fa-brands class renders as an empty box.
        icon: "fa-solid fa-image",
        primary: false,
        hint: "Paste into your post",
      });
    }
  }

  destinations.push({
    id: "download",
    label: isMobile ? "Save file" : "Download",
    icon: "fa-solid fa-download",
    primary: false,
  });

  destinations.push({
    id: "copy-caption",
    label: "Copy caption",
    icon: "fa-solid fa-clipboard",
    primary: false,
  });

  return destinations;
}

export interface HandoffResult {
  status: "done" | "canceled" | "failed";
  message?: string;
}

/**
 * Native file share. The one-tap post: the caption rides in `text`, so
 * Instagram opens with it pre-filled.
 */
export async function shareArtifactNatively(
  blob: Blob,
  filename: string,
  caption: string
): Promise<HandoffResult> {
  const result = await shareBlobNatively(blob, filename, {
    title: "TKA Sequence",
    text: caption,
  });

  switch (result.status) {
    case "shared":
      return { status: "done" };
    case "canceled":
      return { status: "canceled" };
    case "unavailable":
      return { status: "failed", message: "Sharing files isn't available here" };
    default:
      return { status: "failed", message: "Share failed" };
  }
}

export async function downloadArtifact(
  blob: Blob,
  filename: string
): Promise<HandoffResult> {
  const result = await downloadBlobToDisk(blob, filename);
  return result.success
    ? { status: "done", message: "Saved" }
    : { status: "failed", message: "Download failed" };
}

export async function copyCaption(caption: string): Promise<HandoffResult> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return { status: "failed", message: "Clipboard unavailable" };
  }

  try {
    await navigator.clipboard.writeText(caption);
    return { status: "done", message: "Caption copied" };
  } catch {
    return { status: "failed", message: "Couldn't copy caption" };
  }
}

const FACEBOOK_COMPOSER_URL = "https://www.facebook.com/";

/**
 * Desktop Facebook path: image onto the clipboard, caption onto the clipboard
 * is NOT possible simultaneously (one clipboard, one payload), so the image
 * wins — it is the part that cannot be retyped. The composer opens in a new
 * tab and the user pastes.
 *
 * Deliberately not `sharer.php?u=…`: that produces a link-preview post, not a
 * post containing the image, which is the opposite of what this is for.
 */
export async function copyImageAndOpenFacebook(
  blob: Blob
): Promise<HandoffResult> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write) {
    return { status: "failed", message: "Clipboard unavailable" };
  }

  if (blob.type !== "image/png") {
    return { status: "failed", message: "Only images can be copied" };
  }

  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
  } catch {
    return { status: "failed", message: "Couldn't copy the image" };
  }

  window.open(FACEBOOK_COMPOSER_URL, "_blank", "noopener,noreferrer");
  return { status: "done", message: "Image copied — paste into your post" };
}

/** `FΨ.png` / `FΨ.mp4`, Greek glyphs preserved, repeats simplified. */
export function buildArtifactFilename(
  word: string,
  artifact: ShareArtifact
): string {
  const safe = sanitizeFilename(simplifyRepeatedWord(word || "")) || "sequence";
  return `${safe}.${artifact === "video" ? "mp4" : "png"}`;
}
