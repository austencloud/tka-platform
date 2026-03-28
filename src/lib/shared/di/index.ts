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
import { compositionContainer } from "./containers/composition-container";
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
import { sequenceMandalaContainer } from "./containers/sequence-mandala-container";

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
import { createAnimation3DContainer } from "./containers/3d-container";
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
import { trigridLabContainer } from "./containers/trigrid-lab-container";
import { multiGridContainer } from "./containers/multi-grid-container";
import { createAttributionContainer } from "./containers/attribution-container";
import { createVoiceControlContainer } from "./containers/voice-control-container";
import { createComposeBrowseContainer } from "./containers/compose-browse-container";
import { createComposeArrangeContainer } from "./containers/compose-arrange-container";
import { createVoiceSessionContainer } from "./containers/voice-session-container";
import { createSkel2TKAContainer } from "./containers/skel2tka-container";
import { labContainer } from "./containers/lab-container";
import { assembleContainer } from "./containers/assemble-container";
import { fuseContainer } from "./containers/fuse-container";
import { arenaContainer } from "./containers/arena-container";
import { effectsLabContainer } from "./containers/effects-lab-container";
import { videoTrailsContainer } from "./containers/video-trails-container";
import { videoInfraContainer } from "./containers/video-infra-container";
import { createMuseumContainer } from "./containers/museum-container";
import { createPushContainer } from "./containers/push-container";
import { createOfflineContainer } from "./containers/offline-container";
import { festivalContainer } from "./containers/festival-container";
// Deep link resolution for cross-tab/cross-user URLs
import { DeepLinkResolver } from "../application/services/implementations/DeepLinkResolver";

// Print Prep services (MPC card export)
import { CardBackCanvasRenderer as CardBackCanvasRendererImpl } from "$lib/features/choreo-card/services/implementations/CardBackCanvasRenderer";
import { InfoCardCanvasRenderer as InfoCardCanvasRendererImpl } from "$lib/features/choreo-card/services/implementations/InfoCardCanvasRenderer";
import { PrintCardRenderer as PrintCardRendererImpl } from "$lib/features/choreo-card/services/implementations/PrintCardRenderer";
import { PrintPDFExporter as PrintPDFExporterImpl } from "$lib/features/choreo-card/services/implementations/PrintPDFExporter";
import { PrintZipExporter as PrintZipExporterImpl } from "$lib/features/choreo-card/services/implementations/PrintZipExporter";

// Unified sequence data provider (abstracts local + Firebase sources)
import { SequenceDataProvider } from "../sequence-viewer/services/implementations/SequenceDataProvider";

import type { IAppContainerItems } from "./container-types";

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

// Skel2TKA container - self-contained with its own IMAGE mode MediaPipe instance
const skel2tkaContainer = typeof window !== 'undefined' ? createSkel2TKAContainer() : null as any;

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
    conflictResolver: coreContainer.items.conflictResolver,
  },
  librarySaveService: {
    sharer: shareContainer.items.sharer,
    videoUploader: shareContainer.items.videoUploader,
    tagManager: coreContainer.items.tagManager,
  },
  publicIndexSyncer: {
    contentModerator: moderationContainer.items.contentModerator,
    contentAppealManager: moderationContainer.items.contentAppealManager,
    browseLoader: browseContainer.items.browseLoader,
  },
}) : null as any;

// QR container needs browseLoader and sequenceEncoder for dual-mode (online/offline)
const qrContainer = typeof window !== 'undefined' ? createQRContainer({
  browseLoader: browseContainer.items.browseLoader,
  sequenceEncoder: navigationContainer.items.sequenceEncoder,
  hashMatcher: navigationContainer.items.publicSequenceHashMatcher,
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

// Attribution container - self-contained, captures how users find the app
const attributionContainer = typeof window !== 'undefined' ? createAttributionContainer() : null as any;

// Voice control container - "Hey Tika" wake word + command dispatch
const voiceControlContainer = typeof window !== 'undefined' ? createVoiceControlContainer() : null as any;

// Compose Browse container - self-contained, no external dependencies
const composeBrowseContainer = typeof window !== 'undefined' ? createComposeBrowseContainer() : null as any;

// Compose Arrange container - beat calculation, persistence, playback, transforms
const composeArrangeContainer = typeof window !== 'undefined' ? createComposeArrangeContainer() : null as any;

// Museum container - self-contained, no external dependencies
const museumContainer = typeof window !== 'undefined' ? createMuseumContainer() : null as any;

// Push notification container - FCM token management, self-contained
const pushContainer = typeof window !== 'undefined' ? createPushContainer() : null as any;

// Voice session recording, formatting, persistence, analysis, and replay
const voiceSessionContainer = typeof window !== 'undefined' ? createVoiceSessionContainer({
  commandInterpreter: voiceControlContainer.items.commandInterpreter,
}) : null as any;


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

// Offline container - needs networkStatusMonitor from device-sync and
// galleryOfflineCache + thumbnailLocalCache from browse
const offlineContainer = typeof window !== 'undefined' ? createOfflineContainer({
  networkStatusMonitor: deviceSyncContainer.items.networkStatusMonitor,
  galleryOfflineCache: browseContainer.items.galleryOfflineCache,
  thumbnailLocalCache: browseContainer.items.thumbnailLocalCache,
}) : null as any;

// DeepLinkResolver - needs sequenceRepository from data and browseLoader from browse
const deepLinkResolver = typeof window !== 'undefined' ? new DeepLinkResolver(
  dataContainer.items.sequenceRepository,
  browseContainer.items.browseLoader
) : null as any;

// SequenceDataProvider - unified interface for loading sequences from any source
// Abstracts local IndexedDB (user sequences) vs Firebase (public sequences)
const sequenceDataProvider = typeof window !== 'undefined' ? new SequenceDataProvider(
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
// Build container imperatively to avoid "type instantiation excessively deep" error.
// A single chained expression with 30+ .add() calls exceeds TypeScript's generic depth limit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAppContainer(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let c: any = createContainer();

  // Compositional model services (hand path, solo prop, decompose/derive)
  c = c.add(compositionContainer.items);
  // Core infrastructure (must be first)
  c = c.add(coreContainer.items);
  // Data and persistence
  c = c.add(dataContainer.items);
  // Navigation
  c = c.add(navigationContainer.items);
  // Rendering
  c = c.add(renderContainer.items);
  // Animation
  c = c.add(animatorContainer.items);
  // Features
  c = c.add(buildContainer.items);
  // NOTE: browseContainer has naming conflicts (filterPersister, navigator)
  // Using upsert to allow overwriting - these should be renamed in a follow-up
  c = c.upsert(browseContainer.items);
  c = c.add(trainContainer.items);
  c = c.add(learnContainer.items);
  c = c.add(libraryContainer.items);
  // NOTE: loopLabelerContainer has naming conflicts (loopDetector, navigator)
  // Using upsert to allow overwriting - these should be renamed in a follow-up
  c = c.upsert(loopLabelerContainer.items);
  c = c.add(gamificationContainer.items);
  c = c.add(feedbackContainer.items);
  c = c.add(shareContainer.items);
  c = c.add(adminContainer.items);
  c = c.add(promoContainer.items);
  c = c.add(keyboardContainer.items);
  c = c.add(analyticsContainer.items);
  c = c.add(presenceContainer.items);
  c = c.add(communityContainer.items);
  c = c.add(writeContainer.items);
  c = c.add(mandalaContainer.items);
  c = c.add(sequenceMandalaContainer.items);
  c = c.add(qrContainer.items);
  c = c.add(animation3DContainer.items);
  c = c.add(galleryContainer.items);
  c = c.add(backgroundBuilderContainer.items);
  c = c.add(delightContainer.items);
  c = c.add(poiLabContainer.items);
  c = c.add(landingPreviewContainer.items);
  c = c.add(moderationContainer.items);
  c = c.add(hallOfShameContainer.items);
  c = c.add(watchContainer.items);
  c = c.add(lanSyncContainer.items);
  c = c.add(deviceSyncContainer.items);
  c = c.add(connectContainer.items);
  c = c.add(trigridLabContainer.items);
  c = c.add(multiGridContainer.items);
  // Attribution tracking services
  c = c.add({
    attributionCapture: () => attributionContainer?.items?.attributionCapture,
    attributionPersister: () => attributionContainer?.items?.attributionPersister,
    attributionPromptTrigger: () => attributionContainer?.items?.attributionPromptTrigger,
  });
  // Voice control ("Hey Tika") services
  c = c.add(voiceControlContainer.items);
  // Voice session recording + analysis
  c = c.add(voiceSessionContainer.items);
  c = c.add(composeBrowseContainer.items);
  c = c.add(composeArrangeContainer.items);
  // Skel2TKA video-to-notation pipeline
  c = c.add(skel2tkaContainer.items);
  // Lab module services (screenshot capture, etc.)
  c = c.add(labContainer.items);
  // Assemble lab services (grid hit targets, beat motion derivation)
  c = c.add(assembleContainer.items);
  // Fuse services (merge two hand paths into a combined sequence)
  c = c.add(fuseContainer.items);
  // Arena module services (pairwise ranking)
  c = c.add(arenaContainer.items);
  // Effects Lab services (fire + LED point override providers, fuel sources)
  c = c.add(effectsLabContainer.items);
  // Video Trails services (endpoint detection, tip adaptation, export)
  c = c.add(videoTrailsContainer.items);
  // Shared video infrastructure (source provider, training data, frame extraction)
  c = c.add(videoInfraContainer.items);
  // Museum services (persistence, interaction detection)
  c = c.add(museumContainer.items);
  // Push notification services (FCM token management)
  c = c.add(pushContainer.items);
  // Offline caching (proactive gallery + thumbnail prefetch)
  c = c.add(offlineContainer.items);
  // Festival Hub (discovery, attendance, tracker, portfolio, submissions)
  c = c.add(festivalContainer.items);
  // Print Prep services (MPC card export — depend on render + build containers)
  c = c.add({
    cardBackCanvasRenderer: () => new CardBackCanvasRendererImpl(),
    infoCardCanvasRenderer: () => new InfoCardCanvasRendererImpl(),
    printPDFExporter: () => new PrintPDFExporterImpl(),
    printZipExporter: () => new PrintZipExporterImpl(),
  });
  c = c.add((ctx: any) => ({
    printCardRenderer: () => new PrintCardRendererImpl(
      renderContainer.items.imageComposer,
      ctx.cardBackCanvasRenderer,
      ctx.infoCardCanvasRenderer,
      buildContainer.items.sequenceToEntryConverter,
      buildContainer.items.loopExplainer,
    ),
  }));

  // Cross-container services (depend on multiple container outputs)
  c = c.add({ deepLinkResolver: () => deepLinkResolver });
  c = c.add({ sequenceDataProvider: () => sequenceDataProvider });

  return c;
}

// Cast to the composed type. The null branch only executes in SSR/Node where
// no consumer code runs, so the non-null assertion is safe for all browser consumers.
export const container = (typeof window !== 'undefined' ? buildAppContainer() : null) as unknown as
  { items: IAppContainerItems };

// Late binding: Inject QR generator into ImageComposer after container is fully composed
// This resolves the circular dependency between render-container and qr-container
if (typeof window !== 'undefined' && container?.items?.imageComposer && container?.items?.qrCodeGenerator) {
  (container.items.imageComposer as { setQRCodeGenerator: (g: unknown) => void }).setQRCodeGenerator(
    container.items.qrCodeGenerator
  );
}

// Export type for the composed container
export type AppContainer = { items: IAppContainerItems };

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
