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

// ============================================================================
// BROWSER-ONLY CONTAINER INSTANTIATION
// Only instantiate factory containers in browser contexts to avoid
// triggering Node.js stub errors when importing for CLI/server-side rendering
// ============================================================================

// Containers with no dependencies - just call them
const feedbackContainer = typeof window !== 'undefined' ? createFeedbackContainer() : null as any;
const gamificationContainer = typeof window !== 'undefined' ? createGamificationContainer() : null as any;
const promoContainer = typeof window !== 'undefined' ? createPromoContainer() : null as any;

// Render container needs fileDownloader from core
const renderContainer = typeof window !== 'undefined' ? createRenderContainer(
  coreContainer.items.fileDownloader
) : null as any;

// Navigation container needs external deps from pictograph and data containers
const navigationContainer = typeof window !== 'undefined' ? createNavigationContainer({
  motionQueryHandler: pictographContainer.items.motionQueryHandler,
  gridModeDeriver: pictographContainer.items.gridModeDeriver,
  gridPositionDeriver: pictographContainer.items.gridPositionDeriver,
  persistenceService: dataContainer.items.persistenceService,
}) : null as any;

// Share container needs sequenceRenderer from render
const shareContainer = typeof window !== 'undefined' ? createShareContainer(renderContainer.items.sequenceRenderer) : null as any;

// Discover container needs multiple external deps
const discoverContainer = typeof window !== 'undefined' ? createDiscoverContainer({
  wordDeriver: coreContainer.items.wordDeriver,
  deviceDetector: coreContainer.items.deviceDetector,
  sequenceRenderer: renderContainer.items.sequenceRenderer,
  startPositionDeriver: pictographContainer.items.startPositionDeriver,
  cloudThumbnailCache: shareContainer.items.cloudThumbnailCache,
  sheetRouter: navigationContainer.items.sheetRouter,
  collaborativeVideoManager: shareContainer.items.collaborativeVideoManager,
}) : null as any;

// Build container needs many external deps
const buildContainer = typeof window !== 'undefined' ? createBuildContainer({
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
}) : null as any;

// Animator container needs multiple external deps
const animatorContainer = typeof window !== 'undefined' ? createAnimatorContainer({
  imageComposer: renderContainer.items.imageComposer,
  dimensionCalculator: renderContainer.items.dimensionCalculator,
  svgImageConverter: coreContainer.items.svgImageConverter,
  fileDownloader: coreContainer.items.fileDownloader,
  sequenceRepository: dataContainer.items.sequenceRepository,
  sequenceTransformer: buildContainer.items.sequenceTransformer,
  discoverLoader: discoverContainer.items.discoverLoader,
}) : null as any;

// Loop labeler container needs sequenceAnalyzer from build
const loopLabelerContainer = typeof window !== 'undefined' ? createLoopLabelerContainer({
  sequenceAnalyzer: buildContainer.items.sequenceAnalyzer,
}) : null as any;

// Train container needs achievementManager from gamification
const trainContainer = typeof window !== 'undefined' ? createTrainContainer(
  gamificationContainer.items.achievementManager
) : null as any;

// Admin container needs activityLogger and presenceTracker
const adminContainer = typeof window !== 'undefined' ? createAdminContainer({
  activityLogger: analyticsContainer.items.activityLogger,
  presenceTracker: presenceContainer.items.presenceTracker,
}) : null as any;

// Learn container needs letterQueryHandler from pictograph
const learnContainer = typeof window !== 'undefined' ? createLearnContainer(
  pictographContainer.items.letterQueryHandler
) : null as any;

// Library container needs multiple deps
const libraryContainer = typeof window !== 'undefined' ? createLibraryContainer({
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
}) : null as any;

// QR container needs discoverLoader for loading full sequence data
const qrContainer = typeof window !== 'undefined' ? createQRContainer(discoverContainer.items.discoverLoader) : null as any;

// Animation 3D container needs discoverLoader
const animation3DContainer = typeof window !== 'undefined' ? createAnimation3DContainer({
  discoverLoader: discoverContainer.items.discoverLoader,
}) : null as any;

// Gallery container needs libraryRepository
const galleryContainer = typeof window !== 'undefined' ? createGalleryContainer(
  libraryContainer.items.libraryRepository
) : null as any;

// Delight container needs hapticFeedback from core
const delightContainer = typeof window !== 'undefined' ? createDelightContainer(
  coreContainer.items.hapticFeedback
) : null as any;

// Poi lab container - self-contained, no external dependencies
const poiLabContainer = typeof window !== 'undefined' ? createPoiLabContainer() : null as any;

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
 *
 * In Node.js contexts, this will be null. Use manual dependency wiring instead.
 */
export const container = typeof window !== 'undefined' ? createContainer()
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
  .add(qrContainer.items)
  .add(animation3DContainer.items)
  .add(deepOceanContainer.items)
  .add(galleryContainer.items)
  .add(backgroundBuilderContainer.items)
  .add(delightContainer.items)
  .add(poiLabContainer.items) : null as any;

// Export type for the composed container
export type AppContainer = typeof container;

// Default export for convenience
export default container;
