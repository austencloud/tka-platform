/**
 * Share Module - InversifyJS Container Module
 *
 * Binds share services for dependency injection.
 */

import type { ContainerModuleLoadOptions } from "inversify";
import { ContainerModule } from "inversify";
import { Sharer } from "../../share/services/implementations/Sharer";
import { InstagramLinker } from "../../share/services/implementations/InstagramLinker";
import { MediaBundler } from "../../share/services/implementations/MediaBundler";
import { FirebaseVideoUploader } from "../../share/services/implementations/FirebaseVideoUploader";
import { RecordingPersister } from "../../video-record/services/implementations/RecordingPersister";
import { CollaborativeVideoManager } from "../../video-collaboration/services/implementations/CollaborativeVideoManager";
import { CloudThumbnailCache } from "../../../features/discover/gallery/display/services/implementations/CloudThumbnailCache";
import { ShareHubExportOrchestrator } from "../../share-hub/services/implementations/ShareHubExportOrchestrator";
import { TYPES } from "../types";

export const shareModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    // === SHARE SERVICES ===
    options.bind(TYPES.ISharer).to(Sharer);
    options.bind(TYPES.IShareHubExportOrchestrator).to(ShareHubExportOrchestrator);
    options.bind(TYPES.IInstagramLinker).to(InstagramLinker);
    options.bind(TYPES.IMediaBundler).to(MediaBundler);
    options.bind(TYPES.IFirebaseVideoUploader).to(FirebaseVideoUploader);
    options.bind(TYPES.IRecordingPersister).to(RecordingPersister);
    options
      .bind(TYPES.ICollaborativeVideoManager)
      .to(CollaborativeVideoManager);

    // Cloud thumbnail cache - singleton for Firebase Storage (crowd-sourced rendering)
    options
      .bind(TYPES.ICloudThumbnailCache)
      .to(CloudThumbnailCache)
      .inSingletonScope();
  }
);
