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
import { multiGridContainer } from "./containers/multi-grid-container";
import { videoInfraContainer } from "./containers/video-infra-container";
import { videoTrailsContainer } from "./containers/video-trails-container";

// ============================================================================
// CORE SERVICE GETTERS (migrated from core-container)
// ============================================================================
import { getAppState } from "../application/getAppState";
import { getAppStateInitializer } from "../application/getAppStateInitializer";
import { getPerformanceMetricsState } from "../application/getPerformanceMetricsState";
import { getApplicationInitializer } from "../application/getApplicationInitializer";
import { getResourceTracker } from "../application/getResourceTracker";
import { getComponentManager } from "../application/getComponentManager";
import { getErrorHandler } from "../application/getErrorHandler";
import { getHapticFeedback } from "../application/getHapticFeedback";
import { getRippleEffect } from "../application/getRippleEffect";
import { getAuthenticator } from "../auth/getAuthenticator";
import { getProfilePictureManager } from "../auth/getProfilePictureManager";
import { getUsernameValidator } from "../auth/getUsernameValidator";
import { getUserDocumentManager } from "../auth/getUserDocumentManager";
import { getAccountManager } from "../auth/getAccountManager";
import { getGlobalFeatureFlagPersister } from "../auth/getGlobalFeatureFlagPersister";
import { getUserFeatureFlagPersister } from "../auth/getUserFeatureFlagPersister";
import { getSubscriptionManager } from "../subscription/getSubscriptionManager";
import { getPremiumGateChecker } from "../subscription/getPremiumGateChecker";
import { getDeviceDetector } from "../device/getDeviceDetector";
import { getViewportManager } from "../device/getViewportManager";
import { settingsService } from "../settings/state/SettingsState.svelte";
import { getSettingsPersister } from "../settings/getSettingsPersister";
import { getMobileFullscreenManager } from "../mobile/getMobileFullscreenManager";
import { getPlatformDetector } from "../mobile/getPlatformDetector";
import { getGestureHandler } from "../mobile/getGestureHandler";
import { getPWAEngagementTracker } from "../mobile/getPWAEngagementTracker";
import { getPWAInstallDismissalManager } from "../mobile/getPWAInstallDismissalManager";
import { getWordDeriver } from "../foundation/getWordDeriver";
import { getCsvLoader } from "../foundation/getCsvLoader";
import { getCsvParser } from "../foundation/getCsvParser";
import { getEnumMapper } from "../foundation/getEnumMapper";
import { getFileDownloader } from "../foundation/getFileDownloader";
import { getDataTransformer } from "../application/getDataTransformer";
import { getPersistenceService } from "../persistence/getPersistenceService";
import { getPersistenceInitializationService } from "../persistence/getPersistenceInitializationService";
import { getSequenceDomainManager } from "$lib/features/create/shared/getSequenceDomainManager";
import { getReversalDetector } from "$lib/features/create/shared/getReversalDetector";
import { getSequenceImporter } from "$lib/features/create/shared/getSequenceImporter";
import { getSequenceRepository } from "$lib/features/create/shared/getSequenceRepository";
import { getSequenceNormalizer } from "$lib/features/compose/getSequenceNormalizer";
import { getSequenceLoopabilityChecker } from "$lib/features/compose/getSequenceLoopabilityChecker";
import { getStorageManager } from "../foundation/getStorageManager";
import { getSeoManager } from "../foundation/getSeoManager";
import { getSvgImageConverter } from "../foundation/getSvgImageConverter";
import { getOnboardingPersister } from "../onboarding/getOnboardingPersister";
import { getTagManager } from "$lib/features/library/getTagManager";
import { getConflictResolver } from "../offline/getConflictResolver";

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
import { getActivityLogger } from "../analytics/getActivityLogger";
import { getPresenceTracker } from "../presence/getPresenceTracker";

// ============================================================================
// FACTORY CONTAINERS (export function createXyzContainer(deps)...)
// These need to be called with their dependencies
// ============================================================================
import { createCreateContainer, configureLazyCreateContainer } from "./containers/create-container";
import { createComposeCoreContainer } from "./containers/compose-core-container";
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
import { create3DEngineContainer } from "./containers/3d-engine-container";
import { createViewer3DContainer } from "./containers/viewer-3d-container";
import { createDelightContainer } from "./containers/delight-container";
import { createModerationContainer } from "./containers/moderation-container";
import { createWatchContainer } from "./containers/watch-container";
import { createLanSyncContainer } from "./containers/lan-sync-container";
import { createConnectContainer } from "./containers/connect-container";
import { createDeviceSyncContainer } from "./containers/device-sync-container";
import { createAttributionContainer } from "./containers/attribution-container";
import { createVoiceControlContainer } from "./containers/voice-control-container";
import { createVoiceSessionContainer } from "./containers/voice-session-container";
import { createPushContainer } from "./containers/push-container";
import { createOfflineContainer } from "./containers/offline-container";
import { createCollisionLabContainer } from "./containers/collision-lab-container";
import { createComposeArrangeContainer } from "./containers/compose-arrange-container";
import { createComposeBrowseContainer } from "./containers/compose-browse-container";
import { createHallOfShameContainer } from "./containers/hall-of-shame-container";
import { createLandingPreviewContainer } from "./containers/landing-preview-container";
import { createMuseumContainer } from "./containers/museum-container";
import { createPoiContainer } from "./containers/poi-container";
import { createPoiLabContainer } from "./containers/poi-lab-container";
import { createSkel2TKAContainer } from "./containers/skel2tka-container";
import { createStoreContainer } from "./containers/store-container";
import { createTikaContainer } from "./containers/tika-container";
// Deep link resolution for cross-tab/cross-user URLs
import { isBootProfileVerbose } from "../analytics/boot-profiler";
import { DeepLinkResolver } from "../application/services/implementations/DeepLinkResolver";

// DeviceId service — stable per-browser identifier for scan event analytics
import { DeviceIdService } from "$lib/shared/auth/services/implementations/DeviceIdService";

// Print Prep services (MPC card export)
import { CardBackDomRenderer as CardBackDomRendererImpl } from "$lib/features/choreo-card/services/implementations/CardBackDomRenderer";
import { InfoCardCanvasRenderer as InfoCardCanvasRendererImpl } from "$lib/features/choreo-card/services/implementations/InfoCardCanvasRenderer";
import { PrintCardRenderer as PrintCardRendererImpl } from "$lib/features/choreo-card/services/implementations/PrintCardRenderer";
// PrintPDFExporter removed from DI — statically importing it pulls pdf-lib into
// the main chunk, which uses `new Function` and violates CSP. Consumers
// dynamic-import it directly (see DeckBrowser.svelte, VtgFamilyDrillDown.svelte).
import { PrintZipExporter as PrintZipExporterImpl } from "$lib/features/choreo-card/services/implementations/PrintZipExporter";

// Unified sequence data provider (abstracts local + Firebase sources)
import { SequenceDataProvider } from "../sequence-viewer/services/implementations/SequenceDataProvider";

import type { IAppContainerItems } from "./container-types";

// ============================================================================
// BOOT PROFILER — time each container factory for startup optimization
// ============================================================================
const _diStart = typeof window !== 'undefined' ? performance.now() : 0;
const _diTimings: Array<{ name: string; duration: number }> = [];

function _timeContainer<T>(name: string, factory: () => T): T {
  if (typeof window === 'undefined') return factory();
  const t0 = performance.now();
  const result = factory();
  _diTimings.push({ name, duration: performance.now() - t0 });
  return result;
}

// ============================================================================
// BROWSER-ONLY CONTAINER INSTANTIATION
// Only instantiate factory containers in browser contexts to avoid
// triggering Node.js stub errors when importing for CLI/server-side rendering
// ============================================================================

// Containers with no dependencies - just call them
const feedbackContainer = typeof window !== 'undefined' ? _timeContainer('feedback', createFeedbackContainer) : null as any;
const gamificationContainer = typeof window !== 'undefined' ? _timeContainer('gamification', createGamificationContainer) : null as any;
const promoContainer = typeof window !== 'undefined' ? _timeContainer('promo', createPromoContainer) : null as any;

// Render container needs fileDownloader from core
const renderContainer = typeof window !== 'undefined' ? _timeContainer('render', () => createRenderContainer(
  getFileDownloader()
)) : null as any;

// Navigation container needs external deps from pictograph and data containers
const navigationContainer = typeof window !== 'undefined' ? _timeContainer('navigation', () => createNavigationContainer({
  motionQueryHandler,
  gridModeDeriver,
  gridPositionDeriver,
  persistenceService: getPersistenceService(),
})) : null as any;

// Share container needs sequenceRenderer from render
const shareContainer = typeof window !== 'undefined' ? _timeContainer('share', () => createShareContainer(renderContainer.items.sequenceRenderer)) : null as any;

// Browse container needs multiple external deps
const browseContainer = typeof window !== 'undefined' ? _timeContainer('browse', () => createBrowseContainer({
  wordDeriver: getWordDeriver(),
  deviceDetector: getDeviceDetector(),
  sequenceRenderer: renderContainer.items.sequenceRenderer,
  startPositionDeriver,
  cloudThumbnailCache: shareContainer.items.cloudThumbnailCache,
  sheetRouter: navigationContainer.items.sheetRouter,
  collaborativeVideoManager: shareContainer.items.collaborativeVideoManager,
})) : null as any;

// Create module container needs many external deps
const createModuleContainer = typeof window !== 'undefined' ? _timeContainer('create', () => createCreateContainer({
  deviceDetector: getDeviceDetector(),
  viewportManager: getViewportManager(),
  gridPositionDeriver,
  gridModeDeriver,
  motionQueryHandler,
  sequenceRepository: getSequenceRepository(),
  persistenceService: getPersistenceService(),
  reversalDetector: getReversalDetector(),
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
  sequenceLoopabilityChecker: getSequenceLoopabilityChecker(),
})) : null as any;

// Configure lazy create container for HMR-optimized access pattern
// Components can use getCreateContainer() instead of container.items for better HMR
if (typeof window !== 'undefined') {
  configureLazyCreateContainer(() => ({
    deviceDetector: getDeviceDetector(),
    viewportManager: getViewportManager(),
    gridPositionDeriver,
    gridModeDeriver,
    motionQueryHandler,
    sequenceRepository: getSequenceRepository(),
    persistenceService: getPersistenceService(),
    reversalDetector: getReversalDetector(),
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
    sequenceLoopabilityChecker: getSequenceLoopabilityChecker(),
  }));
}

// Compose core container needs multiple external deps
const composeCoreContainer = typeof window !== 'undefined' ? _timeContainer('compose-core', () => createComposeCoreContainer({
  imageComposer: renderContainer.items.imageComposer,
  dimensionCalculator: renderContainer.items.dimensionCalculator,
  layoutCalculator: renderContainer.items.layoutCalculator,
  svgImageConverter: getSvgImageConverter(),
  fileDownloader: getFileDownloader(),
  sequenceRepository: getSequenceRepository(),
  sequenceTransformer: createModuleContainer.items.sequenceTransformer,
  browseLoader: browseContainer.items.browseLoader,
  sequenceLoopabilityChecker: getSequenceLoopabilityChecker(),
})) : null as any;

// Loop labeler container needs sequenceAnalyzer from build
const loopLabelerContainer = typeof window !== 'undefined' ? _timeContainer('loop-labeler', () => createLoopLabelerContainer({
  sequenceAnalyzer: createModuleContainer.items.sequenceAnalyzer,
})) : null as any;

// Train container needs achievementManager from gamification
const trainContainer = typeof window !== 'undefined' ? _timeContainer('train', () => createTrainContainer(
  gamificationContainer.items.achievementManager
)) : null as any;

// Admin container needs activityLogger and presenceTracker
const adminContainer = typeof window !== 'undefined' ? _timeContainer('admin', () => createAdminContainer({
  activityLogger: getActivityLogger(),
  presenceTracker: getPresenceTracker(),
})) : null as any;

// Learn container needs letterQueryHandler from pictograph
const learnContainer = typeof window !== 'undefined' ? _timeContainer('learn', () => createLearnContainer(
  letterQueryHandler
)) : null as any;

// Moderation container - self-contained, must be before library for content moderation
const moderationContainer = typeof window !== 'undefined' ? _timeContainer('moderation', createModerationContainer) : null as any;

// Library container needs multiple deps including content moderation
const libraryContainer = typeof window !== 'undefined' ? _timeContainer('library', () => createLibraryContainer({
  libraryRepository: {
    achievementManager: gamificationContainer.items.achievementManager,
    tagManager: getTagManager(),
    orientationCycleDetector: createModuleContainer.items.orientationCycleDetector,
    conflictResolver: getConflictResolver(),
  },
  librarySaveService: {
    sharer: shareContainer.items.sharer,
    videoUploader: shareContainer.items.videoUploader,
    tagManager: getTagManager(),
  },
  publicIndexSyncer: {
    contentModerator: moderationContainer.items.contentModerator,
    contentAppealManager: moderationContainer.items.contentAppealManager,
    browseLoader: browseContainer.items.browseLoader,
  },
})) : null as any;

// QR container needs browseLoader and sequenceEncoder for dual-mode (online/offline)
const qrContainer = typeof window !== 'undefined' ? _timeContainer('qr', () => createQRContainer({
  browseLoader: browseContainer.items.browseLoader,
  sequenceEncoder: navigationContainer.items.sequenceEncoder,
  hashMatcher: navigationContainer.items.publicSequenceHashMatcher,
})) : null as any;

// 3D engine container — infrastructure shared by every 3D surface
const engine3DContainer = typeof window !== 'undefined' ? _timeContainer('3d-engine', () => create3DEngineContainer({
  browseLoader: browseContainer.items.browseLoader,
})) : null as any;

// Viewer-specific 3D services (undo/redo scoped to sequence viewer session)
const viewer3DContainer = typeof window !== 'undefined' ? _timeContainer('viewer-3d', createViewer3DContainer) : null as any;

// Delight container needs hapticFeedback from core
const delightContainer = typeof window !== 'undefined' ? _timeContainer('delight', () => createDelightContainer(
  getHapticFeedback()
)) : null as any;

// Attribution container - self-contained, captures how users find the app
const attributionContainer = typeof window !== 'undefined' ? _timeContainer('attribution', createAttributionContainer) : null as any;

// Voice control container - "Hey Tika" wake word + command dispatch
const voiceControlContainer = typeof window !== 'undefined' ? _timeContainer('voice-control', createVoiceControlContainer) : null as any;

// Push notification container - FCM token management, self-contained
const pushContainer = typeof window !== 'undefined' ? _timeContainer('push', createPushContainer) : null as any;

// Voice session recording, formatting, persistence, analysis, and replay
const voiceSessionContainer = typeof window !== 'undefined' ? _timeContainer('voice-session', () => createVoiceSessionContainer({
  commandInterpreter: voiceControlContainer.items.commandInterpreter,
})) : null as any;


// Watch container - needs collaborativeVideoManager from share and browseLoader from browse
const watchContainer = typeof window !== 'undefined' ? _timeContainer('watch', () => createWatchContainer({
  collaborativeVideoManager: shareContainer.items.collaborativeVideoManager,
  browseLoader: browseContainer.items.browseLoader,
})) : null as any;

// LAN Sync container - self-contained, no external dependencies
const lanSyncContainer = typeof window !== 'undefined' ? _timeContainer('lan-sync', createLanSyncContainer) : null as any;

// Device Sync container - needs peerConnectionManager from lan-sync
const deviceSyncContainer = typeof window !== 'undefined' ? _timeContainer('device-sync', () => createDeviceSyncContainer({
  peerConnectionManager: lanSyncContainer.items.peerConnectionManager,
})) : null as any;

// Connect container - needs lanSyncCoordinator from lan-sync
const connectContainer = typeof window !== 'undefined' ? _timeContainer('connect', () => createConnectContainer({
  lanSyncCoordinator: lanSyncContainer.items.lanSyncCoordinator,
})) : null as any;

// Offline container - needs networkStatusMonitor from device-sync and
// galleryOfflineCache + thumbnailLocalCache from browse
const offlineContainer = typeof window !== 'undefined' ? _timeContainer('offline', () => createOfflineContainer({
  networkStatusMonitor: deviceSyncContainer.items.networkStatusMonitor,
  galleryOfflineCache: browseContainer.items.galleryOfflineCache,
  thumbnailLocalCache: browseContainer.items.thumbnailLocalCache,
})) : null as any;

// Feature factory containers (no external dependencies)
const collisionLabContainer = typeof window !== 'undefined' ? _timeContainer('collision-lab', createCollisionLabContainer) : null as any;
const composeArrangeModuleContainer = typeof window !== 'undefined' ? _timeContainer('compose-arrange', createComposeArrangeContainer) : null as any;
const composeBrowseModuleContainer = typeof window !== 'undefined' ? _timeContainer('compose-browse', createComposeBrowseContainer) : null as any;
const hallOfShameContainer = typeof window !== 'undefined' ? _timeContainer('hall-of-shame', createHallOfShameContainer) : null as any;
const landingPreviewContainer = typeof window !== 'undefined' ? _timeContainer('landing-preview', createLandingPreviewContainer) : null as any;
const museumContainer = typeof window !== 'undefined' ? _timeContainer('museum', createMuseumContainer) : null as any;
const poiContainer = typeof window !== 'undefined' ? _timeContainer('poi', createPoiContainer) : null as any;
const poiLabContainer = typeof window !== 'undefined' ? _timeContainer('poi-lab', createPoiLabContainer) : null as any;
const skel2tkaContainer = typeof window !== 'undefined' ? _timeContainer('skel2tka', createSkel2TKAContainer) : null as any;
const storeContainer = typeof window !== 'undefined' ? _timeContainer('store', createStoreContainer) : null as any;
const tikaContainer = typeof window !== 'undefined' ? _timeContainer('tika', createTikaContainer) : null as any;

// DeepLinkResolver - needs sequenceRepository from data and browseLoader from browse
const deepLinkResolver = typeof window !== 'undefined' ? new DeepLinkResolver(
  getSequenceRepository(),
  browseContainer.items.browseLoader
) : null as any;

// SequenceDataProvider - unified interface for loading sequences from any source
// Abstracts local IndexedDB (user sequences) vs Firebase (public sequences)
const sequenceDataProvider = typeof window !== 'undefined' ? new SequenceDataProvider(
  getSequenceRepository(),
  browseContainer.items.browseLoader
) : null as any;

// ============================================================================
// COMPOSE ALL CONTAINERS INTO ONE
// ============================================================================

/**
 * The main application container, composed from all module containers.
 *
 * Services are accessed via container.items:
 *   getAuthenticator()
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

  // Core infrastructure (dissolved from core-container — services accessed via getters)
  c = c.add({
    appState: () => getAppState(),
    appStateInitializer: () => getAppStateInitializer(),
    performanceMetricsState: () => getPerformanceMetricsState(),
    settingsState: () => settingsService,
    settingsPersister: () => getSettingsPersister(),
    globalFeatureFlagPersister: () => getGlobalFeatureFlagPersister(),
    userFeatureFlagPersister: () => getUserFeatureFlagPersister(),
    viewportManager: () => getViewportManager(),
    deviceDetector: () => getDeviceDetector(),
    applicationInitializer: () => getApplicationInitializer(),
    resourceTracker: () => getResourceTracker(),
    componentManager: () => getComponentManager(),
    errorHandler: () => getErrorHandler(),
    hapticFeedback: () => getHapticFeedback(),
    rippleEffect: () => getRippleEffect(),
    authenticator: () => getAuthenticator(),
    profilePictureManager: () => getProfilePictureManager(),
    userDocumentManager: () => getUserDocumentManager(),
    subscriptionManager: () => getSubscriptionManager(),
    premiumGateChecker: () => getPremiumGateChecker(),
    usernameValidator: () => getUsernameValidator(),
    accountManager: () => getAccountManager(),
    mobileFullscreenManager: () => getMobileFullscreenManager(),
    platformDetector: () => getPlatformDetector(),
    gestureHandler: () => getGestureHandler(),
    pwaEngagementTracker: () => getPWAEngagementTracker(),
    pwaInstallDismissalManager: () => getPWAInstallDismissalManager(),
    wordDeriver: () => getWordDeriver(),
    fileDownloader: () => getFileDownloader(),
    storageManager: () => getStorageManager(),
    seoManager: () => getSeoManager(),
    svgImageConverter: () => getSvgImageConverter(),
    onboardingPersister: () => getOnboardingPersister(),
    tagManager: () => getTagManager(),
    conflictResolver: () => getConflictResolver(),
  });
  // Data and persistence (dissolved from data-container)
  c = c.add({
    csvLoader: () => getCsvLoader(),
    csvParser: () => getCsvParser(),
    enumMapper: () => getEnumMapper(),
    dataTransformer: () => getDataTransformer(),
    persistenceService: () => getPersistenceService(),
    sequenceDomainManager: () => getSequenceDomainManager(),
    reversalDetector: () => getReversalDetector(),
    sequenceNormalizer: () => getSequenceNormalizer(),
    sequenceLoopabilityChecker: () => getSequenceLoopabilityChecker(),
    persistenceInitializationService: () => getPersistenceInitializationService(),
    sequenceImporter: () => getSequenceImporter(),
    sequenceRepository: () => getSequenceRepository(),
  });
  // Navigation
  c = c.add(navigationContainer.items);
  // Rendering
  c = c.add(renderContainer.items);
  // Compose core (animation pipeline, video export)
  c = c.add(composeCoreContainer.items);
  // Create module (sequence construction, generation, option picker)
  c = c.add(createModuleContainer.items);
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
  c = c.add(qrContainer.items);
  c = c.add(engine3DContainer.items);
  c = c.add(viewer3DContainer.items);
  c = c.add(delightContainer.items);
  c = c.add(moderationContainer.items);
  c = c.add(watchContainer.items);
  c = c.add(lanSyncContainer.items);
  c = c.add(deviceSyncContainer.items);
  c = c.add(connectContainer.items);
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
  // Push notification services (FCM token management)
  c = c.add(pushContainer.items);
  // Offline caching (proactive gallery + thumbnail prefetch)
  c = c.add(offlineContainer.items);
  // Print Prep services (MPC card export — depend on render + build containers)
  c = c.add({
    cardBackDomRenderer: () => new CardBackDomRendererImpl(),
    infoCardCanvasRenderer: () => new InfoCardCanvasRendererImpl(),
    // printPDFExporter removed — see comment above the import block
    printZipExporter: () => new PrintZipExporterImpl(),
  });
  c = c.add((ctx: any) => ({
    printCardRenderer: () => new PrintCardRendererImpl(
      renderContainer.items.imageComposer,
      ctx.cardBackDomRenderer,
      ctx.infoCardCanvasRenderer,
      createModuleContainer.items.sequenceToEntryConverter,
      createModuleContainer.items.loopExplainer,
    ),
  }));

  // Feature containers (simple + factory)
  c = c.add(multiGridContainer.items);
  c = c.add(videoInfraContainer.items);
  c = c.add(videoTrailsContainer.items);
  c = c.add(collisionLabContainer.items);
  c = c.add(composeArrangeModuleContainer.items);
  c = c.add(composeBrowseModuleContainer.items);
  c = c.add(hallOfShameContainer.items);
  c = c.add(landingPreviewContainer.items);
  c = c.add(museumContainer.items);
  c = c.add(poiContainer.items);
  c = c.add(poiLabContainer.items);
  c = c.add(skel2tkaContainer.items);
  c = c.add(storeContainer.items);
  c = c.add(tikaContainer.items);

  // Cross-container services (depend on multiple container outputs)
  c = c.add({ deepLinkResolver: () => deepLinkResolver });
  c = c.add({ sequenceDataProvider: () => sequenceDataProvider });
  // Device identity — stable per-browser ID for scan event analytics
  c = c.add({ deviceIdService: () => new DeviceIdService() });

  return c;
}

// Cast to the composed type. The null branch only executes in SSR/Node where
// no consumer code runs, so the non-null assertion is safe for all browser consumers.
const _buildStart = typeof window !== 'undefined' ? performance.now() : 0;
export const container = (typeof window !== 'undefined' ? buildAppContainer() : null) as unknown as
  { items: IAppContainerItems };

// Log DI container timing breakdown (verbose; gate behind ?profile=1)
if (typeof window !== 'undefined' && isBootProfileVerbose()) {
  const totalDI = performance.now() - _diStart;
  const buildTime = performance.now() - _buildStart;

  // Sort by duration descending
  const sorted = [..._diTimings].sort((a, b) => b.duration - a.duration);

  console.group(
    `%c🏗️ DI Container — ${Math.round(totalDI)}ms total (factories: ${Math.round(totalDI - buildTime)}ms, compose: ${Math.round(buildTime)}ms)`,
    "font-size: 13px; font-weight: bold; color: #81c784;"
  );
  console.table(
    sorted.map((t) => ({
      Container: t.name,
      "Duration (ms)": +t.duration.toFixed(2),
      "% of Total": `${((t.duration / totalDI) * 100).toFixed(1)}%`,
    }))
  );
  console.groupEnd();
}

// Late binding: Inject QR generator into ImageComposer after container is fully composed
// This resolves the circular dependency between render-container and qr-container
if (typeof window !== 'undefined' && container?.items?.imageComposer && container?.items?.qrCodeGenerator) {
  (container.items.imageComposer as { setQRCodeGenerator: (g: unknown) => void }).setQRCodeGenerator(
    container.items.qrCodeGenerator
  );
}

// Export type for the composed container
export type AppContainer = { items: IAppContainerItems };

// Default export for convenience
export default container;
