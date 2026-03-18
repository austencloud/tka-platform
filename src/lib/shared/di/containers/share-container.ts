/**
 * Share Container - ITI Dependency Injection
 *
 * Contains all share-related services:
 * - Sharer, ExportOrchestrator
 * - InstagramLinker, MediaBundler
 * - R2Presigner, R2VideoUploader, RecordingPersister
 * - CollaborativeVideoManager, CloudThumbnailCache
 */

import { createContainer } from "iti";
import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
import { Sharer } from "$lib/shared/share/services/implementations/Sharer";
import { ExportOrchestrator } from "$lib/shared/export-panel/services/implementations/ExportOrchestrator";
import { InstagramLinker } from "$lib/shared/share/services/implementations/InstagramLinker";
import { MediaBundler } from "$lib/shared/share/services/implementations/MediaBundler";
import { R2Presigner } from "$lib/shared/share/services/implementations/R2Presigner";
import { R2VideoUploader } from "$lib/shared/share/services/implementations/R2VideoUploader";
import { RecordingPersister } from "$lib/shared/video-record/services/implementations/RecordingPersister";
import { CollaborativeVideoManager } from "$lib/shared/video-collaboration/services/implementations/CollaborativeVideoManager";
import { CloudThumbnailCache } from "$lib/features/browse/sequences/display/services/implementations/CloudThumbnailCache";
import { SequenceImageSharer } from "$lib/shared/share/services/implementations/SequenceImageSharer";

/**
 * Create the share container with external dependencies
 *
 * @param sequenceRenderer - Required dependency from render module
 */
export function createShareContainer(sequenceRenderer: ISequenceRenderer) {
  // Layer 1: Services with no internal dependencies
  const baseContainer = createContainer()
    .add({
      instagramLinker: () => new InstagramLinker(),
      r2Presigner: () => new R2Presigner(),
      recordingPersister: () => new RecordingPersister(),
      collaborativeVideoManager: () => new CollaborativeVideoManager(),
      cloudThumbnailCache: () => new CloudThumbnailCache(),
    });

  // Layer 1.5: Services that depend on r2Presigner
  const withUploader = baseContainer.add((ctx) => ({
    videoUploader: () => new R2VideoUploader(ctx.r2Presigner),
  }));

  // Layer 2: Services that depend on external dependencies
  const withSharer = withUploader.add({
    sharer: () => new Sharer(sequenceRenderer),
    sequenceImageSharer: () => new SequenceImageSharer(sequenceRenderer),
  });

  // Layer 3: Services that depend on sharer
  const fullContainer = withSharer.add((ctx) => ({
    exportOrchestrator: () => new ExportOrchestrator(ctx.sharer),
    mediaBundler: () => new MediaBundler(ctx.sharer),
  }));

  return fullContainer;
}

// Type for the share container
export type ShareContainer = ReturnType<typeof createShareContainer>;
