/**
 * Deferred Registrations
 *
 * Service registrations that are NOT needed for initial Browse/Create render.
 * Loaded via requestIdleCallback after the critical path completes.
 *
 * Moved out of index.ts to cut ~3s off composition-root import time:
 * - VideoExportOrchestrator pulls mediabunny + WebCodecs at import
 * - PublicIndexSyncer pulls content-moderator profanity wordlist at import
 * - FeedbackTesterWorkflow pulls Firestore + notification services
 * - TagMigrator pulls tag-manager
 */

import { registerPublicIndexSyncerFactory } from "$lib/shared/library/getLibraryRepository";
import { getPublicIndexSyncer } from "$lib/features/library/get-public-index-syncer";

import { registerTagMigrator } from "$lib/shared/library/getTagMigrator";
import { migrateSequenceTags } from "$lib/features/library/services/migrations/tag-migration";

import { registerFeedbackTesterWorkflow } from "$lib/shared/feedback/services/IFeedbackTesterWorkflow";
import { feedbackTesterWorkflowService } from "$lib/features/feedback/services/feedback-tester-workflow";

import { registerVideoExportOrchestratorFactory } from "../animation-engine/getVideoExportOrchestrator";
import { getVideoExporter } from "../animation-engine/getVideoExporter";
import { getCompositeVideoRenderer } from "../animation-engine/getCompositeVideoRenderer";
import { getExportGlyphPrerenderer } from "../animation-engine/getExportGlyphPrerenderer";
import { getBackgroundVideoEncoder } from "../animation-engine/getBackgroundVideoEncoder";
import { VideoExportOrchestrator } from "$lib/features/compose/services/video-export-orchestrator";

import { getQRCodeGenerator } from "../qr/getQRCodeGenerator";
import { getImageComposer } from "../render/get-image-composer";

registerPublicIndexSyncerFactory(getPublicIndexSyncer);
registerTagMigrator(migrateSequenceTags);
registerFeedbackTesterWorkflow(feedbackTesterWorkflowService);

registerVideoExportOrchestratorFactory(() =>
  new VideoExportOrchestrator(
    getVideoExporter(),
    getCompositeVideoRenderer(),
    getExportGlyphPrerenderer(),
    getBackgroundVideoEncoder()
  )
);

try {
  const composer = getImageComposer();
  if (composer) {
    (composer as unknown as { setQRCodeGenerator: (g: unknown) => void }).setQRCodeGenerator(
      getQRCodeGenerator()
    );
  }
} catch {
  // ImageComposer not yet initialized - QR injection will happen on first use
}
