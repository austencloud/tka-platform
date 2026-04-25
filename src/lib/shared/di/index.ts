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

// Dissolved-container getters needed for cross-wiring
import { getAchievementManager } from "../gamification/getAchievementManager";
import { getContentModerator } from "$lib/features/moderation/getContentModerator";
import { getContentAppealManager } from "$lib/features/moderation/getContentAppealManager";
import { configureShortCodeManager } from "../qr/getShortCodeManager";
import { getQRCodeGenerator } from "../qr/getQRCodeGenerator";

// ============================================================================
// FACTORY CONTAINERS (export function createXyzContainer(deps)...)
// These need to be called with their dependencies
// ============================================================================
import { createCreateContainer, configureLazyCreateContainer } from "./containers/create-container";
import { createComposeCoreContainer } from "./containers/compose-core-container";
// loop-labeler-container dissolved — services accessed via module singleton getters
import { createBrowseContainer } from "./containers/browse-container";
// navigation-container dissolved — services accessed via module singleton getters
// render-container dissolved — services accessed via module singleton getters
import { getCanvasManager } from "../render/getCanvasManager";
import { getLayoutCalculator as getRenderLayoutCalculator } from "../render/getLayoutCalculator";
import { getDimensionCalculator as getRenderDimensionCalculator } from "../render/getDimensionCalculator";
import { getSvgToCanvasConverter } from "../render/getSvgToCanvasConverter";
import { getGlyphCache } from "../render/getGlyphCache";
import { getFilenameGenerator } from "../render/getFilenameGenerator";
import { getPictographBlobCache } from "../render/getPictographBlobCache";
import { getPictographKeyHasher } from "../render/getPictographKeyHasher";
import { getPictographMemoryCache } from "../render/getPictographMemoryCache";
import { getBeatNumberRenderer } from "../render/getBeatNumberRenderer";
import { getCanvas2DRenderer } from "../render/getCanvas2DRenderer";
import { getLayerCompositor } from "../render/getLayerCompositor";
import { getLoopIconStripRenderer } from "../render/getLoopIconStripRenderer";
import { getTextRenderer } from "../render/getTextRenderer";
import { getImageFormatConverter } from "../render/getImageFormatConverter";
import { getImageComposer } from "../render/getImageComposer";
import { getSequenceRenderer } from "../render/getSequenceRenderer";
// train-container dissolved — services accessed via module singleton getters
// admin-container dissolved — services accessed via module singleton getters
import { createShareContainer } from "./containers/share-container";
// feedback-container dissolved — services accessed via module singleton getters
// gamification-container dissolved — services accessed via module singleton getters
// learn-container dissolved — services accessed via module singleton getters
// promo-container dissolved — services accessed via module singleton getters
import { createLibraryContainer } from "./containers/library-container";
// qr-container dissolved — services accessed via module singleton getters
import { create3DEngineContainer } from "./containers/3d-engine-container";
import { createViewer3DContainer } from "./containers/viewer-3d-container";
import { createDelightContainer } from "./containers/delight-container";
// moderation-container dissolved — services accessed via module singleton getters
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
// skel2tka-container dissolved — services accessed via module singleton getters
import { createStoreContainer } from "./containers/store-container";
import { createTikaContainer } from "./containers/tika-container";
// Navigation container dissolved — services accessed via module singleton getters
import { getKeyboardNavigator } from "../navigation/getKeyboardNavigator";
import { getModuleSelector } from "../navigation/getModuleSelector";
import { getSheetRouter } from "../navigation/getSheetRouter";
import { getSequenceEncoder } from "../navigation/getSequenceEncoder";
import { getNavigationValidator } from "../navigation/getNavigationValidator";
import { getSidebarTabToggler } from "../navigation/getSidebarTabToggler";
import { getURLSyncer } from "../navigation/getURLSyncer";
import { getDeepLinker } from "../navigation/getDeepLinker";
import { getLetterDeriver } from "../navigation/getLetterDeriver";
import { getPositionDeriver } from "../navigation/getPositionDeriver";
import { getPublicSequenceHashMatcher } from "../sequence-viewer/getPublicSequenceHashMatcher";
import { getSequenceViewer } from "../sequence-viewer/getSequenceViewer";

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

// feedback-container dissolved — services accessed via module singleton getters
// gamification-container dissolved — services accessed via module singleton getters
// promo-container dissolved — services accessed via module singleton getters

// render-container dissolved — render services accessed via module singleton getters

// navigation-container dissolved — services accessed via module singleton getters

// Share container needs sequenceRenderer from render
const shareContainer = typeof window !== 'undefined' ? _timeContainer('share', () => createShareContainer(getSequenceRenderer())) : null as any;

// Browse container needs multiple external deps
const browseContainer = typeof window !== 'undefined' ? _timeContainer('browse', () => createBrowseContainer({
  wordDeriver: getWordDeriver(),
  deviceDetector: getDeviceDetector(),
  sequenceRenderer: getSequenceRenderer(),
  startPositionDeriver,
  cloudThumbnailCache: shareContainer.items.cloudThumbnailCache,
  sheetRouter: getSheetRouter(),
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
  deepLinker: getDeepLinker(),
  letterDeriver: getLetterDeriver(),
  positionDeriver: getPositionDeriver(),
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
    deepLinker: getDeepLinker(),
    letterDeriver: getLetterDeriver(),
    positionDeriver: getPositionDeriver(),
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
  imageComposer: getImageComposer(),
  dimensionCalculator: getRenderDimensionCalculator(),
  layoutCalculator: getRenderLayoutCalculator(),
  svgImageConverter: getSvgImageConverter(),
  fileDownloader: getFileDownloader(),
  sequenceRepository: getSequenceRepository(),
  sequenceTransformer: createModuleContainer.items.sequenceTransformer,
  browseLoader: browseContainer.items.browseLoader,
  sequenceLoopabilityChecker: getSequenceLoopabilityChecker(),
})) : null as any;

// loop-labeler-container dissolved — services accessed via module singleton getters

// train-container dissolved — services accessed via module singleton getters

// admin-container dissolved — services accessed via module singleton getters

// learn-container dissolved — services accessed via module singleton getters

// moderation-container dissolved — services accessed via module singleton getters

// Library container needs multiple deps including content moderation (now via getters)
const libraryContainer = typeof window !== 'undefined' ? _timeContainer('library', () => createLibraryContainer({
  libraryRepository: {
    achievementManager: getAchievementManager(),
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
    contentModerator: getContentModerator(),
    contentAppealManager: getContentAppealManager(),
    browseLoader: browseContainer.items.browseLoader,
  },
})) : null as any;

// qr-container dissolved — configure ShortCodeManager with browse dep, then getters handle the rest
if (typeof window !== 'undefined') {
  configureShortCodeManager(browseContainer.items.browseLoader);
}

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
// skel2tka-container dissolved — services accessed via module singleton getters
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
  // Navigation (dissolved from navigation-container — services accessed via module singleton getters)
  c = c.add({
    keyboardNavigator: () => getKeyboardNavigator(),
    moduleSelector: () => getModuleSelector(),
    sheetRouter: () => getSheetRouter(),
    sequenceEncoder: () => getSequenceEncoder(),
    navigationValidator: () => getNavigationValidator(),
    sidebarTabToggler: () => getSidebarTabToggler(),
    urlSyncer: () => getURLSyncer(),
    deepLinker: () => getDeepLinker(),
    letterDeriver: () => getLetterDeriver(),
    positionDeriver: () => getPositionDeriver(),
    publicSequenceHashMatcher: () => getPublicSequenceHashMatcher(),
    sequenceViewer: () => getSequenceViewer(),
  });
  // Rendering (dissolved from render-container — services accessed via module singleton getters)
  c = c.add({
    canvasManager: () => getCanvasManager(),
    layoutCalculator: () => getRenderLayoutCalculator(),
    dimensionCalculator: () => getRenderDimensionCalculator(),
    svgToCanvasConverter: () => getSvgToCanvasConverter(),
    glyphCache: () => getGlyphCache(),
    filenameGenerator: () => getFilenameGenerator(),
    pictographBlobCache: () => getPictographBlobCache(),
    pictographKeyHasher: () => getPictographKeyHasher(),
    pictographMemoryCache: () => getPictographMemoryCache(),
    beatNumberRenderer: () => getBeatNumberRenderer(),
    canvas2DRenderer: () => getCanvas2DRenderer(),
    layerCompositor: () => getLayerCompositor(),
    loopIconStripRenderer: () => getLoopIconStripRenderer(),
    textRenderer: () => getTextRenderer(),
    imageFormatConverter: () => getImageFormatConverter(),
    imageComposer: () => getImageComposer(),
    sequenceRenderer: () => getSequenceRenderer(),
  });
  // Compose core (animation pipeline, video export)
  c = c.add(composeCoreContainer.items);
  // Create module (sequence construction, generation, option picker)
  c = c.add(createModuleContainer.items);
  // NOTE: browseContainer has naming conflicts (filterPersister, navigator)
  // Using upsert to allow overwriting - these should be renamed in a follow-up
  c = c.upsert(browseContainer.items);
  // train, learn, gamification, feedback, admin, promo, qr, moderation, loop-labeler dissolved
  c = c.add(libraryContainer.items);
  c = c.add(shareContainer.items);
  c = c.add(engine3DContainer.items);
  c = c.add(viewer3DContainer.items);
  c = c.add(delightContainer.items);
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
      getImageComposer(),
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
  // skel2tka-container dissolved
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
if (typeof window !== 'undefined' && container?.items?.imageComposer) {
  (container.items.imageComposer as unknown as { setQRCodeGenerator: (g: unknown) => void }).setQRCodeGenerator(
    getQRCodeGenerator()
  );
}

// Export type for the composed container
export type AppContainer = { items: IAppContainerItems };

// Default export for convenience
export default container;
