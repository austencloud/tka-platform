/**
 * ITI Dependency Injection Container - Composition Root
 *
 * This file composes all module containers into a single unified container.
 * Import services via: container.items.serviceName
 *
 * Example:
 *   import { container } from "$shared/di";
 *   const authenticator = container.items.authenticator;
 */

import { createContainer } from "iti";

// ============================================================================
// SIMPLE CONTAINERS (export const xyzContainer = createContainer()...)
// ============================================================================
import { coreContainer } from "./containers/core-container";
import { dataContainer } from "./containers/data-container";
import { pictographContainer } from "./containers/pictograph-container";
import { keyboardContainer } from "./containers/keyboard-container";
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
import { createDiscoverContainer } from "./containers/discover-container";
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
import { createMuseumContainer } from "./containers/museum-container";
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
  motionQueryHandler: pictographContainer.items.motionQueryHandler,
  gridModeDeriver: pictographContainer.items.gridModeDeriver,
  gridPositionDeriver: pictographContainer.items.gridPositionDeriver,
  persistenceService: dataContainer.items.persistenceService,
});

// Share container needs sequenceRenderer from render
const shareContainer = createShareContainer(renderContainer.items.sequenceRenderer);

// Discover container needs multiple external deps
const discoverContainer = createDiscoverContainer({
  wordDeriver: coreContainer.items.wordDeriver,
  deviceDetector: coreContainer.items.deviceDetector,
  sequenceRenderer: renderContainer.items.sequenceRenderer,
  startPositionDeriver: pictographContainer.items.startPositionDeriver,
  cloudThumbnailCache: shareContainer.items.cloudThumbnailCache,
  sheetRouter: navigationContainer.items.sheetRouter,
});

// Build container needs many external deps
const buildContainer = createBuildContainer({
  deviceDetector: coreContainer.items.deviceDetector,
  viewportManager: coreContainer.items.viewportManager,
  gridPositionDeriver: pictographContainer.items.gridPositionDeriver,
  gridModeDeriver: pictographContainer.items.gridModeDeriver,
  motionQueryHandler: pictographContainer.items.motionQueryHandler,
  sequenceRepository: dataContainer.items.sequenceRepository,
  persistenceService: dataContainer.items.persistenceService,
  reversalDetector: dataContainer.items.reversalDetector,
  deepLinker: navigationContainer.items.deepLinker,
  letterDeriver: navigationContainer.items.letterDeriver,
  positionDeriver: navigationContainer.items.positionDeriver,
  orientationCalculator: pictographContainer.items.orientationCalculator,
  betaDetector: pictographContainer.items.betaDetector,
  arrowPositioningOrchestrator: pictographContainer.items.arrowPositioningOrchestrator,
  letterQueryHandler: pictographContainer.items.letterQueryHandler,
  sharer: shareContainer.items.sharer,
});

// Animator container needs multiple external deps
const animatorContainer = createAnimatorContainer({
  imageComposer: renderContainer.items.imageComposer,
  dimensionCalculator: renderContainer.items.dimensionCalculator,
  svgImageConverter: coreContainer.items.svgImageConverter,
  fileDownloader: coreContainer.items.fileDownloader,
  sequenceRepository: dataContainer.items.sequenceRepository,
  sequenceTransformer: buildContainer.items.sequenceTransformer,
  discoverLoader: discoverContainer.items.discoverLoader,
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
const learnContainer = createLearnContainer(
  pictographContainer.items.letterQueryHandler
);

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

// Museum container needs libraryRepository
const museumContainer = createMuseumContainer(
  libraryContainer.items.libraryRepository
);

// QR container needs discoverLoader for loading full sequence data
const qrContainer = createQRContainer(discoverContainer.items.discoverLoader);

// Animation 3D container needs discoverLoader
const animation3DContainer = createAnimation3DContainer({
  discoverLoader: discoverContainer.items.discoverLoader,
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
  .add(pictographContainer.items)
  // Animation
  .add(animatorContainer.items)
  // Features
  .add(buildContainer.items)
  // NOTE: discoverContainer has naming conflicts (filterPersister, navigator)
  // Using upsert to allow overwriting - these should be renamed in a follow-up
  .upsert(discoverContainer.items)
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
  .add(museumContainer.items)
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
