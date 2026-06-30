/**
 * Canonical cloud-cell key.
 *
 * The per-device IndexedDB cell key (see cell-cache-key-deriver) bakes in the
 * display SIZE, which varies by viewport. For a globally-shared cloud image we
 * need a key that is identical across devices: same pictograph + prop + mode =>
 * same key, regardless of screen size. We achieve that by deriving the existing
 * cell key with size pinned to CANONICAL_CELL_SIZE and step numbers off, then
 * hashing it to a short, filename-safe digest for the storage path.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { PreviewCellRenderOptions } from "$lib/shared/sequence-viewer/services/preview-cell-renderer";
import { deriveCacheKey } from "$lib/shared/sequence-viewer/services/cell-cache-key-deriver";

/** Canonical render size for cloud-stored cells. High enough for any card cell. */
export const CANONICAL_CELL_SIZE = 480;

/** The size-normalized, number-free cell key string (deterministic, long). */
export function canonicalCellKeyString(
  pictographData: PictographData,
  isDark: boolean,
  options: PreviewCellRenderOptions,
): string {
  return deriveCacheKey(pictographData, undefined, isDark, {
    ...options,
    size: CANONICAL_CELL_SIZE,
    showStepNumbers: false,
  });
}

/**
 * SHA-256 hex digest of the canonical key — a short, filename-safe, collision-
 * free, cross-device-stable storage hash. Async because it uses SubtleCrypto.
 */
export async function deriveCloudCellHash(
  pictographData: PictographData,
  isDark: boolean,
  options: PreviewCellRenderOptions,
): Promise<string> {
  const keyString = canonicalCellKeyString(pictographData, isDark, options);
  const bytes = new TextEncoder().encode(keyString);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
