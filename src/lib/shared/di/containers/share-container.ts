/**
 * Share Container - ITI Dependency Injection
 *
 * Contains all share-related services:
 * - Sharer, ShareHubExportOrchestrator
 * - InstagramLinker, MediaBundler
 * - FirebaseVideoUploader, RecordingPersister
 * - CollaborativeVideoManager, CloudThumbnailCache
 */

import { createContainer } from "iti";
import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
import { Sharer } from "$lib/shared/share/services/implementations/Sharer";
import { ShareHubExportOrchestrator } from "$lib/shared/share-hub/services/implementations/ShareHubExportOrchestrator";
import { InstagramLinker } from "$lib/shared/share/services/implementations/InstagramLinker";
import { MediaBundler } from "$lib/shared/share/services/implementations/MediaBundler";
import { FirebaseVideoUploader } from "$lib/shared/share/services/implementations/FirebaseVideoUploader";
import { RecordingPersister } from "$lib/shared/video-record/services/implementations/RecordingPersister";
import { CollaborativeVideoManager } from "$lib/shared/video-collaboration/services/implementations/CollaborativeVideoManager";
import { CloudThumbnailCache } from "$lib/features/discover/sequences/display/services/implementations/CloudThumbnailCache";

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
      firebaseVideoUploader: () => new FirebaseVideoUploader(),
      recordingPersister: () => new RecordingPersister(),
      collaborativeVideoManager: () => new CollaborativeVideoManager(),
      // Singleton for Firebase Storage (crowd-sourced rendering)
      cloudThumbnailCache: () => new CloudThumbnailCache(),
    });

  // Layer 2: Services that depend on external dependencies
  const withSharer = baseContainer.add({
    sharer: () => new Sharer(sequenceRenderer),
  });

  // Layer 3: Services that depend on sharer
  const fullContainer = withSharer.add((ctx) => ({
    shareHubExportOrchestrator: () => new ShareHubExportOrchestrator(ctx.sharer),
    mediaBundler: () => new MediaBundler(ctx.sharer),
  }));

  return fullContainer;
}

// Type for the share container
export type ShareContainer = ReturnType<typeof createShareContainer>;
