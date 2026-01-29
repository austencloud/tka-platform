/**
 * Application Dependency Injection Container
 *
 * ITI (Isomorphic Type-safe IoC) container for the TKA application.
 * All services are registered here and accessed via container.items.
 *
 * Usage:
 *   import { container } from "$lib/shared/di";
 *   const myService = container.items.myService;
 *
 * Adding new services:
 *   1. Create interface in services/contracts/IServiceName.ts
 *   2. Create implementation in services/implementations/ServiceName.ts
 *   3. Create or update container in di/containers/your-container.ts
 *   4. Wire into this file's container composition
 *
 * See .claude/rules/code-style.md for DI patterns.
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
import { screenSpaceAdjustmentTransformer } from "$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ScreenSpaceAdjustmentTransformer";
import { arrowAdjustmentCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator";
import { arrowLocationCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowLocationCalculator";
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
import { turnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator";
import { analyticsContainer } from "./containers/analytics-container";
import { presenceContainer } from "./containers/presence-container";
import { communityContainer } from "./containers/community-container";
import { writeContainer } from "./containers/write-container";
import { mandalaContainer } from "./containers/mandala-container";

// ============================================================================
// FACTORY CONTAINERS (export function createXyzContainer(deps)...)
// These need to be called with their dependencies
// ============================================================================
import { createBuildContainer, configureLazyBuildContainer } from "./containers/build-container";
import { createAnimatorContainer } from "./containers/animator-container";
import { createLoopLabelerContainer } from "./containers/loop-labeler-container";
import { createBrowseContainer } from "./containers/browse-container";
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
import { createLandingPreviewContainer } from "./containers/landing-preview-container";
import { createModerationContainer } from "./containers/moderation-container";
import { createHallOfShameContainer } from "./containers/hall-of-shame-container";
import { createWatchContainer } from "./containers/watch-container";
import { createLanSyncContainer } from "./containers/lan-sync-container";
import { createConnectContainer } from "./containers/connect-container";
import { createDeviceSyncContainer } from "./containers/device-sync-container";

// Deep link resolution for cross-tab/cross-user URLs
import { DeepLinkResolver } from "../application/services/implementations/DeepLinkResolver";

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
  motionQueryHandler,
  gridModeDeriver,
  gridPositionDeriver,
  persistenceService: dataContainer.items.persistenceService,
}) : null as any;

// Share container needs sequenceRenderer from render
const shareContainer = typeof window !== 'undefined' ? createShareContainer(renderContainer.items.sequenceRenderer) : null as any;

// Browse container needs multiple external deps
const browseContainer = typeof window !== 'undefined' ? createBrowseContainer({
  wordDeriver: coreContainer.items.wordDeriver,
  deviceDetector: coreContainer.items.deviceDetector,
  sequenceRenderer: renderContainer.items.sequenceRenderer,
  startPositionDeriver,
  cloudThumbnailCache: shareContainer.items.cloudThumbnailCache,
  sheetRouter: navigationContainer.items.sheetRouter,
  collaborativeVideoManager: shareContainer.items.collaborativeVideoManager,
}) : null as any;

// Build container needs many external deps
const buildContainer = typeof window !== 'undefined' ? createBuildContainer({
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
  // Arrow adjustment services
  screenSpaceAdjustmentTransformer,
  arrowAdjustmentCalculator,
  arrowLocationCalculator,
  pictographPreparer,
  turnsTupleGenerator,
  sharer: shareContainer.items.sharer,
  // Animation services (from data container to avoid circular deps)
  sequenceLoopabilityChecker: dataContainer.items.sequenceLoopabilityChecker,
}) : null as any;

// Configure lazy build container for HMR-optimized access pattern
// Components can use getBuildContainer() instead of container.items for better HMR
if (typeof window !== 'undefined') {
  configureLazyBuildContainer(() => ({
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
    screenSpaceAdjustmentTransformer,
    arrowAdjustmentCalculator,
    arrowLocationCalculator,
    pictographPreparer,
    turnsTupleGenerator,
    sharer: shareContainer.items.sharer,
    sequenceLoopabilityChecker: dataContainer.items.sequenceLoopabilityChecker,
  }));
}

// Animator container needs multiple external deps
const animatorContainer = typeof window !== 'undefined' ? createAnimatorContainer({
  imageComposer: renderContainer.items.imageComposer,
  dimensionCalculator: renderContainer.items.dimensionCalculator,
  layoutCalculator: renderContainer.items.layoutCalculator,
  svgImageConverter: coreContainer.items.svgImageConverter,
  fileDownloader: coreContainer.items.fileDownloader,
  sequenceRepository: dataContainer.items.sequenceRepository,
  sequenceTransformer: buildContainer.items.sequenceTransformer,
  browseLoader: browseContainer.items.browseLoader,
  sequenceLoopabilityChecker: dataContainer.items.sequenceLoopabilityChecker,
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
  letterQueryHandler
) : null as any;

// Moderation container - self-contained, must be before library for content moderation
const moderationContainer = typeof window !== 'undefined' ? createModerationContainer() : null as any;

// Library container needs multiple deps including content moderation
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
  publicIndexSyncer: {
    contentModerator: moderationContainer.items.contentModerator,
    contentAppealManager: moderationContainer.items.contentAppealManager,
  },
}) : null as any;

// QR container needs browseLoader and sequenceEncoder for dual-mode (online/offline)
const qrContainer = typeof window !== 'undefined' ? createQRContainer({
  browseLoader: browseContainer.items.browseLoader,
  sequenceEncoder: navigationContainer.items.sequenceEncoder,
}) : null as any;

// Animation 3D container needs browseLoader
const animation3DContainer = typeof window !== 'undefined' ? createAnimation3DContainer({
  browseLoader: browseContainer.items.browseLoader,
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

// Landing preview container - self-contained, no external dependencies
const landingPreviewContainer = typeof window !== 'undefined' ? createLandingPreviewContainer() : null as any;

// Hall of Shame container - self-contained, no external dependencies
const hallOfShameContainer = typeof window !== 'undefined' ? createHallOfShameContainer() : null as any;


// Watch container - needs collaborativeVideoManager from share and browseLoader from browse
const watchContainer = typeof window !== 'undefined' ? createWatchContainer({
  collaborativeVideoManager: shareContainer.items.collaborativeVideoManager,
  browseLoader: browseContainer.items.browseLoader,
}) : null as any;

// LAN Sync container - self-contained, no external dependencies
const lanSyncContainer = typeof window !== 'undefined' ? createLanSyncContainer() : null as any;

// Device Sync container - needs peerConnectionManager from lan-sync
const deviceSyncContainer = typeof window !== 'undefined' ? createDeviceSyncContainer({
  peerConnectionManager: lanSyncContainer.items.peerConnectionManager,
}) : null as any;

// Connect container - needs lanSyncCoordinator from lan-sync
const connectContainer = typeof window !== 'undefined' ? createConnectContainer({
  lanSyncCoordinator: lanSyncContainer.items.lanSyncCoordinator,
}) : null as any;

// DeepLinkResolver - needs sequenceRepository from data and browseLoader from browse
const deepLinkResolver = typeof window !== 'undefined' ? new DeepLinkResolver(
  dataContainer.items.sequenceRepository,
  browseContainer.items.browseLoader
) : null as any;

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
  // NOTE: pictographContainer removed - all services now use direct imports
  // Animation
  .add(animatorContainer.items)
  // Features
  .add(buildContainer.items)
  // NOTE: browseContainer has naming conflicts (filterPersister, navigator)
  // Using upsert to allow overwriting - these should be renamed in a follow-up
  .upsert(browseContainer.items)
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
  .add(poiLabContainer.items)
  .add(landingPreviewContainer.items)
  .add(moderationContainer.items)
  .add(hallOfShameContainer.items)
  .add(watchContainer.items)
  .add(lanSyncContainer.items)
  .add(deviceSyncContainer.items)
  .add(connectContainer.items)
  // Cross-container services (depend on multiple container outputs)
  .add({ deepLinkResolver: () => deepLinkResolver }) : null as any;

// Export type for the composed container
export type AppContainer = typeof container;

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================
import { clearPictographCaches } from "./containers/pictograph-container";
import { clearSvgImageCache } from "../render/services/implementations/SvgImageCache";

/**
 * Clear all rendering-related caches.
 * Call this when the app needs to re-render with fresh data
 * (e.g., after code updates that affect colors, SVG content, etc.)
 */
export function clearAllRenderCaches(): void {
  clearPictographCaches();
  clearSvgImageCache();
  console.log("[DI] All render caches cleared");
}

// Default export for convenience
export default container;
