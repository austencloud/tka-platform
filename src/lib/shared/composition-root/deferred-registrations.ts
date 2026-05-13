/**
 * Deferred Registrations
 *
 * Service registrations that are NOT needed for initial Browse/Create render.
 * Loaded via requestIdleCallback after the critical path completes.
 *
 * Moved out of index.ts to cut ~3s off composition-root import time:
 * - VideoExportOrchestrator pulls mediabunny + WebCodecs at import
 * - EndlessSpinnerOrchestrator pulls @tka/sequence-engine generation at import
 * - PublicIndexSyncer pulls content-moderator profanity wordlist at import
 * - FeedbackTesterWorkflow pulls Firestore + notification services
 * - TagMigrator pulls tag-manager
 */

import { registerPublicIndexSyncerFactory } from "$lib/shared/library/getLibraryRepository";
import { getPublicIndexSyncer } from "$lib/features/library/getPublicIndexSyncer";

import { registerTagMigrator } from "$lib/shared/library/getTagMigrator";
import { migrateSequenceTags } from "$lib/features/library/services/migrations/tag-migration";

import { registerFeedbackTesterWorkflow } from "$lib/shared/feedback/services/IFeedbackTesterWorkflow";
import { feedbackTesterWorkflowService } from "$lib/features/feedback/services/FeedbackTesterWorkflow";

import { registerVideoExportOrchestratorFactory } from "../animation-engine/getVideoExportOrchestrator";
import { getVideoExporter } from "../animation-engine/getVideoExporter";
import { getCompositeVideoRenderer } from "../animation-engine/getCompositeVideoRenderer";
import { getExportGlyphPrerenderer } from "../animation-engine/getExportGlyphPrerenderer";
import { getBackgroundVideoEncoder } from "../animation-engine/getBackgroundVideoEncoder";
import { VideoExportOrchestrator } from "$lib/features/compose/services/implementations/VideoExportOrchestrator";

import { registerEndlessSpinnerOrchestratorFactory } from "../animation-engine/getEndlessSpinnerOrchestrator";
import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/EndlessSpinnerOrchestrator";
import { getBrowseLoader } from "$lib/shared/browse/getBrowseLoader";
import { getSequenceTransformer } from "../create/getSequenceTransformer";
import { generationOrchestrator } from "../create/services/GenerationOrchestrator";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";

import { getQRCodeGenerator } from "../qr/getQRCodeGenerator";
import { getImageComposer } from "../render/getImageComposer";

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

registerEndlessSpinnerOrchestratorFactory(() =>
  new EndlessSpinnerOrchestrator(
    getBrowseLoader(),
    generationOrchestrator,
    getSequenceTransformer(),
    startPositionDeriver,
    orientationCalculator,
    gridPositionDeriver
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
