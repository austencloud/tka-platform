import type { SharedFileDescriptor } from "./share-intake-models";

interface ReceiptInput {
  files: SharedFileDescriptor[];
  texts: string[];
}

/**
 * A stable id derived from the share's CONTENT, not from a counter or clock.
 *
 * Why this matters: Capacitor's BridgeActivity calls onNewIntent(getIntent())
 * immediately after load(), and @capgo/capacitor-share-target handles the
 * intent in both. A cold-launch share fires twice. Deriving the id from content
 * makes the second delivery a no-op instead of a duplicate upload.
 *
 * Files are sorted so two deliveries that enumerate in a different order still
 * collapse to one id. The uri is deliberately EXCLUDED - the plugin can write
 * the same share to a different cache path on the second delivery.
 */
export function deriveReceiptId(input: ReceiptInput): string {
  const fileParts = input.files
    .map((f) => `${f.name}\u0000${f.mimeType}\u0000${f.size ?? 0}`)
    .sort();
  const material = [...fileParts, "\u0001", ...input.texts].join("\u0002");

  // FNV-1a 32-bit, doubled with a second offset basis for a wider key. No
  // crypto needed - this is a dedup key, not a security boundary.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < material.length; i++) {
    const c = material.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x811c9dc5);
  }
  const a = (h1 >>> 0).toString(36);
  const b = (h2 >>> 0).toString(36);
  return `si_${a}${b}`;
}
