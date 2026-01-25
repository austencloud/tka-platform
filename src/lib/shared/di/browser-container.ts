/**
 * Browser-Only DI Container
 *
 * This file contains all DI container composition and should ONLY be loaded in browser contexts.
 * Node.js scripts should use manual dependency wiring instead.
 */

import { createContainer } from "iti";

// ============================================================================
// SIMPLE CONTAINERS (export const xyzContainer = createContainer()...)
// ============================================================================
import { coreContainer } from "./containers/core-container";
import { dataContainer } from "./containers/data-container";
import { keyboardContainer } from "./containers/keyboard-container";

// ============================================================================
// DIRECT PICTOGRAPH IMPORTS (migrated away from DI container)
// ============================================================================
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler";
import { gridModeDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridModeDeriver";
import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { betaDetector } from "$lib/shared/pictograph/prop/services/implementations/BetaDetector";
import { arrowPositioningOrchestrator } from "$lib/shared/pictograph/arrow/orchestration/services/implementations/ArrowPositioningOrchestrator";
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler";
import { analyticsContainer } from "./containers/analytics-container";
import { presenceContainer } from "./containers/presence-container";
import { communityContainer } from "./containers/community-container";
import { writeContainer } from "./containers/write-container";
import { mandalaContainer } from "./containers/mandala-container";

// ============================================================================
// FACTORY CONTAINERS (export function createXyzContainer(deps)...)
// These need to be called with their dependencies
// ============================================================================
import { createBuildContainer } from "./containers/build-container";
import { createAnimatorContainer } from "./containers/animator-container";
import { createLoopLabelerContainer } from "./containers/loop-labeler-container";
import { createExploreContainer } from "./containers/browse-container";
import { createNavigationContainer } from "./containers/navigation-container";
import { createRenderContainer } from "./containers/render-container";
import { createTrainContainer } from "./containers/train-container";
import { createAdminContainer } from "./containers/admin-container";
import { createShareContainer } from "./containers/share-container";
import { createFeedbackContainer } from "./containers/feedback-container";
import { createGamificationContainer } from "./containers/gamification-container";
import { createLearnContainer } from "./containers/learn-container";
import { createPromoContainer } from "./containers/promo-container";
import { createLibraryContainer } from "./containers/library-container";
import { createQRContainer } from "./containers/qr-container";
import { createAnimation3DContainer } from "./containers/animation-3d-container";
import { deepOceanContainer } from "./containers/deep-ocean-container";
import { createGalleryContainer } from "./containers/gallery-container";
import { createDelightContainer } from "./containers/delight-container";
import { backgroundBuilderContainer } from "./containers/background-builder-container";
import { createPoiLabContainer } from "./containers/poi-lab-container";

// ============================================================================
// INSTANTIATE FACTORY CONTAINERS WITH STUB DEPENDENCIES
// NOTE: This is a temporary fix to get the app compiling.
// Proper dependency wiring should be done in a follow-up task.
// ============================================================================

// Containers with no dependencies - just call them
const feedbackContainer = createFeedbackContainer();
const gamificationContainer = createGamificationContainer();
const promoContainer = createPromoContainer();

// Render container needs fileDownloader from core
const renderContainer = createRenderContainer(
  coreContainer.items.fileDownloader
);

// Navigation container needs external deps from pictograph and data containers
const navigationContainer = createNavigationContainer({
  motionQueryHandler,
  gridModeDeriver,
  gridPositionDeriver,
  persistenceService: dataContainer.items.persistenceService,
});

// Share container needs sequenceRenderer from render
const shareContainer = createShareContainer(renderContainer.items.sequenceRenderer);

// Discover container needs multiple external deps
const exploreContainer = createExploreContainer({
  wordDeriver: coreContainer.items.wordDeriver,
  deviceDetector: coreContainer.items.deviceDetector,
  sequenceRenderer: renderContainer.items.sequenceRenderer,
  startPositionDeriver,
  cloudThumbnailCache: shareContainer.items.cloudThumbnailCache,
  sheetRouter: navigationContainer.items.sheetRouter,
  collaborativeVideoManager: shareContainer.items.collaborativeVideoManager,
});

// Build container needs many external deps
const buildContainer = createBuildContainer({
  deviceDetector: coreContainer.items.deviceDetector,
  viewportManager: coreContainer.items.viewportManager,
  gridPositionDeriver,
  gridModeDeriver,
  motionQueryHandler,
  sequenceRepository: dataContainer.items.sequenceRepository,
  persistenceService: dataContainer.items.persistenceService,
  reversalDetector: dataContainer.items.reversalDetector,
  deepLinker: navigationContainer.items.deepLinker,
  letterDeriver: navigationContainer.items.letterDeriver,
  positionDeriver: navigationContainer.items.positionDeriver,
  orientationCalculator,
  betaDetector,
  arrowPositioningOrchestrator,
  letterQueryHandler,
  sharer: shareContainer.items.sharer,
});

// Animator container needs multiple external deps
const animatorContainer = createAnimatorContainer({
  imageComposer: renderContainer.items.imageComposer,
  dimensionCalculator: renderContainer.items.dimensionCalculator,
  layoutCalculator: renderContainer.items.layoutCalculator,
  svgImageConverter: coreContainer.items.svgImageConverter,
  fileDownloader: coreContainer.items.fileDownloader,
  sequenceRepository: dataContainer.items.sequenceRepository,
  sequenceTransformer: buildContainer.items.sequenceTransformer,
  exploreLoader: exploreContainer.items.exploreLoader,
  sequenceLoopabilityChecker: dataContainer.items.sequenceLoopabilityChecker,
});

// Loop labeler container needs sequenceAnalyzer from build
const loopLabelerContainer = createLoopLabelerContainer({
  sequenceAnalyzer: buildContainer.items.sequenceAnalyzer,
});

// Train container needs achievementManager from gamification
const trainContainer = createTrainContainer(
  gamificationContainer.items.achievementManager
);

// Admin container needs activityLogger and presenceTracker
const adminContainer = createAdminContainer({
  activityLogger: analyticsContainer.items.activityLogger,
  presenceTracker: presenceContainer.items.presenceTracker,
});

// Learn container needs letterQueryHandler from pictograph
const learnContainer = createLearnContainer(letterQueryHandler);

// Library container needs multiple deps
const libraryContainer = createLibraryContainer({
  libraryRepository: {
    achievementManager: gamificationContainer.items.achievementManager,
    tagManager: coreContainer.items.tagManager,
    orientationCycleDetector: buildContainer.items.orientationCycleDetector,
    publicIndexSyncer: null as any, // Will use internal one
  },
  librarySaveService: {
    sharer: shareContainer.items.sharer,
    firebaseVideoUploader: shareContainer.items.firebaseVideoUploader,
    tagManager: coreContainer.items.tagManager,
  },
});

// QR container needs exploreLoader for loading full sequence data
const qrContainer = createQRContainer(exploreContainer.items.exploreLoader);

// Animation 3D container needs exploreLoader
const animation3DContainer = createAnimation3DContainer({
  exploreLoader: exploreContainer.items.exploreLoader,
});

// Gallery container needs libraryRepository
const galleryContainer = createGalleryContainer(
  libraryContainer.items.libraryRepository
);

// Delight container needs hapticFeedback from core
const delightContainer = createDelightContainer(
  coreContainer.items.hapticFeedback
);

// Poi lab container - self-contained, no external dependencies
const poiLabContainer = createPoiLabContainer();

// ============================================================================
// COMPOSE ALL CONTAINERS INTO ONE
// ============================================================================

/**
 * The main application container, composed from all module containers.
 *
 * Services are accessed via container.items:
 *   container.items.authenticator
 *   container.items.sequenceRenderer
 *   etc.
 */
export const container = createContainer()
  // Core infrastructure (must be first)
  .add(coreContainer.items)
  // Data and persistence
  .add(dataContainer.items)
  // Navigation
  .add(navigationContainer.items)
  // Rendering
  .add(renderContainer.items)
  // NOTE: pictographContainer removed - all services now use direct imports
  // Animation
  .add(animatorContainer.items)
  // Features
  .add(buildContainer.items)
  // NOTE: exploreContainer has naming conflicts (filterPersister, navigator)
  // Using upsert to allow overwriting - these should be renamed in a follow-up
  .upsert(exploreContainer.items)
  .add(trainContainer.items)
  .add(learnContainer.items)
  .add(libraryContainer.items)
  // Utilities
  // NOTE: loopLabelerContainer has naming conflicts (loopDetector, navigator)
  // Using upsert to allow overwriting - these should be renamed in a follow-up
  .upsert(loopLabelerContainer.items)
  .add(gamificationContainer.items)
  .add(feedbackContainer.items)
  .add(shareContainer.items)
  .add(adminContainer.items)
  .add(promoContainer.items)
  .add(keyboardContainer.items)
  .add(analyticsContainer.items)
  .add(presenceContainer.items)
  .add(communityContainer.items)
  .add(writeContainer.items)
  .add(mandalaContainer.items)
  .add(qrContainer.items)
  .add(animation3DContainer.items)
  .add(deepOceanContainer.items)
  .add(galleryContainer.items)
  .add(backgroundBuilderContainer.items)
  .add(delightContainer.items)
  .add(poiLabContainer.items);

// Export type for the composed container
export type AppContainer = typeof container;

// Default export for convenience
export default container;
