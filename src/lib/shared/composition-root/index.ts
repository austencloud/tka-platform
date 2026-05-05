/**
 * Composition Root
 *
 * The single sanctioned location where features/ implementations are wired
 * into shared/ service slots. This is the ONLY file in shared/ that may
 * import from features/ — all other shared/ files use interfaces and
 * registration patterns to avoid reverse imports.
 *
 * Boot sequence:
 *   1. +layout.svelte dynamically imports this module
 *   2. Side-effect registrations fire (browser-only)
 *   3. Factory getters throughout shared/ can now resolve their deps
 *
 * To access a service, import its getter directly:
 *   import { getAuthenticator } from "$lib/shared/auth/getAuthenticator";
 *   const auth = getAuthenticator();
 */

// Side-effect: configure ShortCodeManager with browse dep
import { configureShortCodeManager } from "../qr/getShortCodeManager";
import { getBrowseLoader } from "$lib/shared/browse/getBrowseLoader";

// Side-effect: register PublicIndexSyncer factory
import { registerPublicIndexSyncerFactory } from "$lib/shared/library/getLibraryRepository";
import { getPublicIndexSyncer } from "$lib/features/library/getPublicIndexSyncer";

// Side-effect: register TagMigrator
import { registerTagMigrator } from "$lib/shared/library/getTagMigrator";
import { migrateSequenceTags } from "$lib/features/library/services/migrations/tag-migration";

// Side-effect: register FeedbackTesterWorkflow
import { registerFeedbackTesterWorkflow } from "$lib/shared/feedback/services/IFeedbackTesterWorkflow";
import { feedbackTesterWorkflowService } from "$lib/features/feedback/services/implementations/FeedbackTesterWorkflow";

// Side-effect: register VideoExportOrchestrator factory
import { registerVideoExportOrchestratorFactory } from "../animation-engine/getVideoExportOrchestrator";
import { getVideoExporter } from "../animation-engine/getVideoExporter";
import { getCompositeVideoRenderer } from "../animation-engine/getCompositeVideoRenderer";
import { getExportGlyphPrerenderer } from "../animation-engine/getExportGlyphPrerenderer";
import { getBackgroundVideoEncoder } from "../animation-engine/getBackgroundVideoEncoder";
import { VideoExportOrchestrator } from "$lib/features/compose/services/implementations/VideoExportOrchestrator";

// Side-effect: register LOOPDetector singleton
import { registerLoopDetector } from "../create/getLoopDetector";
import { loopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";

// Side-effect: register resolveLoopDisplay function
import { registerLoopDisplayResolver } from "../loop-labeler/getLoopDisplayResolver";
import { resolveLoopDisplay } from "$lib/features/loop-labeler/services/loop-display-resolver";

// Side-effect: register EndlessSpinnerOrchestrator factory
import { registerEndlessSpinnerOrchestratorFactory } from "../animation-engine/getEndlessSpinnerOrchestrator";
import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/implementations/EndlessSpinnerOrchestrator";
import { getSequenceTransformer } from "../create/getSequenceTransformer";
import { generationOrchestrator } from "../create/services/GenerationOrchestrator";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";

// Side-effect: late-bind QR generator into ImageComposer
import { getQRCodeGenerator } from "../qr/getQRCodeGenerator";
import { getImageComposer } from "../render/getImageComposer";

// Boot profiler
import { isBootProfileVerbose } from "../analytics/boot-profiler";

// ============================================================================
// BOOT PROFILER
// ============================================================================
const _bootStart = typeof window !== 'undefined' ? performance.now() : 0;

// ============================================================================
// SIDE-EFFECT REGISTRATIONS (browser-only)
// ============================================================================
if (typeof window !== 'undefined') {
  configureShortCodeManager(getBrowseLoader());
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

  registerLoopDetector(loopDetector);
  registerLoopDisplayResolver(resolveLoopDisplay);

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
}

// ============================================================================
// LEGACY CONTAINER SHIM (retained for retro module compatibility)
// ============================================================================
export const container = (typeof window !== 'undefined' ? { items: {} } : null) as unknown as
  { items: Record<string, unknown> };

if (typeof window !== 'undefined' && isBootProfileVerbose()) {
  const totalBoot = performance.now() - _bootStart;
  console.log(
    `%c Composition root - ${Math.round(totalBoot)}ms`,
    "font-size: 13px; font-weight: bold; color: #81c784;"
  );
}

// Late binding: Inject QR generator into ImageComposer
if (typeof window !== 'undefined') {
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
}

export type AppContainer = { items: Record<string, unknown> };

export default container;
