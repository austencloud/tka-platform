/**
 * One shared repair path for a thumbnail whose bytes turned out bad — wired by
 * PropAwareThumbnail's image-error handler. A confirmed cloud 404 is
 * authoritative (markMissing: kills the persisted positive, writes the 24h
 * negative). A blob-decode failure only proves the LOCAL tiers are poisoned.
 */
import { markMissing, type CloudThumbnailKey } from "./cloud-thumbnail-cache";

export interface ThumbnailRepairInput {
  kind: "cloud-404" | "blob-decode";
  hash: string;
  cloudKey: CloudThumbnailKey | null;
  /** ThumbnailLocalCache.delete resolves a boolean — the result is ignored. */
  localCache: { delete(hash: string): Promise<unknown> } | null;
  evictHash: (hash: string) => void;
}

export async function repairThumbnailCaches(input: ThumbnailRepairInput): Promise<void> {
  if (input.kind === "cloud-404" && input.cloudKey) markMissing(input.cloudKey);
  input.evictHash(input.hash);
  await input.localCache?.delete(input.hash).catch(() => {});
}
