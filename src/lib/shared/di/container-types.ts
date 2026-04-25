/**
 * Composed Container Items Type
 *
 * ITI's generic inference breaks after ~15-20 chained `.add()` calls
 * ("type instantiation excessively deep"). The internal `buildAppContainer()`
 * therefore uses `any`. This file recovers type safety at the public boundary
 * by intersecting each container's items type into one flat interface.
 *
 * When adding a new container:
 *   1. Import its type here
 *   2. Extract its items via `ItemsOf<...>`
 *   3. Add it to the `IAppContainerItems` intersection
 */

// ============================================================================
// Container type imports — simple (typeof) containers
// ============================================================================
// DataContainerType removed — data services dissolved into module singleton getters

// ============================================================================
// Container type imports — factory (ReturnType<typeof create...>) containers
// ============================================================================
// FeedbackContainer removed — dissolved into module singleton getters
// GamificationContainer removed — dissolved into module singleton getters
// PromoContainer removed — dissolved into module singleton getters
// RenderContainer removed — render services dissolved into module singleton getters
import type { ShareContainer } from "./containers/share-container";
import type { BrowseContainer } from "./containers/browse-container";
import type { CreateContainer } from "./containers/create-container";
// TrainContainer removed — dissolved into module singleton getters
// Skel2TKAContainer removed — dissolved into module singleton getters
// AdminContainer removed — dissolved into module singleton getters
// LearnContainer removed — dissolved into module singleton getters
// ModerationContainer removed — dissolved into module singleton getters
import type { LibraryContainer } from "./containers/library-container";
// QRContainer removed — dissolved into module singleton getters
import type { Engine3DContainer } from "./containers/3d-engine-container";
import type { Viewer3DContainer } from "./containers/viewer-3d-container";
import type { DelightContainer } from "./containers/delight-container";
import type { AttributionContainer } from "./containers/attribution-container";
import type { VoiceControlContainer } from "./containers/voice-control-container";
import type { VoiceSessionContainer } from "./containers/voice-session-container";
import type { WatchContainer } from "./containers/watch-container";
import type { LanSyncContainer } from "./containers/lan-sync-container";
import type { ConnectContainer } from "./containers/connect-container";
import type { DeviceSyncContainer } from "./containers/device-sync-container";
import type { PushContainer } from "./containers/push-container";
import type { OfflineContainer } from "./containers/offline-container";
// Containers that already export items types directly (["items"])
// NavigationContainerItems removed — navigation-container dissolved into module singleton getters
import type { ComposeCoreContainerItems } from "./containers/compose-core-container";
// LoopLabelerContainerItems removed — dissolved into module singleton getters
// Feature containers not yet wired above
import type { CollisionLabContainer } from "./containers/collision-lab-container";
import type { ComposeArrangeContainer } from "./containers/compose-arrange-container";
import type { ComposeBrowseContainer } from "./containers/compose-browse-container";
import type { HallOfShameContainer } from "./containers/hall-of-shame-container";
import type { LandingPreviewContainer } from "./containers/landing-preview-container";
import type { MultiGridContainer } from "./containers/multi-grid-container";
import type { MuseumContainer } from "./containers/museum-container";
import type { PoiContainer } from "./containers/poi-container";
import type { PoiLabContainer } from "./containers/poi-lab-container";
import type { StoreContainer } from "./containers/store-container";
import type { TikaContainer } from "./containers/tika-container";
import type { VideoInfraContainer } from "./containers/video-infra-container";
import type { VideoTrailsContainer } from "./containers/video-trails-container";

// ============================================================================
// Standalone services registered directly in buildAppContainer()
// ============================================================================
import type { DeepLinkResolver } from "../application/services/implementations/DeepLinkResolver";
import type { SequenceDataProvider } from "../sequence-viewer/services/implementations/SequenceDataProvider";
import type { IDeviceIdService } from "../auth/services/contracts/IDeviceIdService";

// ============================================================================
// Helper: extract the resolved items type from an ITI container
// ============================================================================
type ItemsOf<C> = C extends { items: infer I } ? { [K in keyof I]: I[K] } : never;

// ============================================================================
// Extract items from each container
// ============================================================================

// Navigation items — dissolved from navigation-container into module singleton getters.
// Explicit interface replaces NavigationContainerItems.
interface NavigationItems {
	keyboardNavigator: import("../navigation/services/contracts/IKeyboardNavigator").IKeyboardNavigator;
	moduleSelector: import("../navigation/services/contracts/IModuleSelector").IModuleSelector;
	sheetRouter: import("../navigation/services/contracts/ISheetRouter").ISheetRouter;
	sequenceEncoder: import("../navigation/services/contracts/ISequenceEncoder").ISequenceEncoder;
	navigationValidator: import("../navigation/services/contracts/INavigationValidator").INavigationValidator;
	sidebarTabToggler: import("../navigation/services/contracts/ISidebarTabToggler").ISidebarTabToggler;
	urlSyncer: import("../navigation/services/contracts/IURLSyncer").IURLSyncer;
	deepLinker: import("../navigation/services/contracts/IDeepLinker").IDeepLinker;
	letterDeriver: import("../navigation/services/contracts/ILetterDeriver").ILetterDeriver;
	positionDeriver: import("../navigation/services/contracts/IPositionDeriver").IPositionDeriver;
	publicSequenceHashMatcher: import("../sequence-viewer/services/contracts/IPublicSequenceHashMatcher").IPublicSequenceHashMatcher;
	sequenceViewer: import("../sequence-viewer/services/contracts/ISequenceViewer").ISequenceViewer;
}

// Core items — dissolved from core-container into module singleton getters.
// Explicit interface replaces ItemsOf<CoreContainer>.
interface CoreItems {
	appState: import("../application/state/IAppState").IAppState;
	appStateInitializer: import("../application/state/app-state-contracts").IAppStateInitializer;
	performanceMetricsState: import("../application/state/IPerformanceMetricsState").IPerformanceMetricsState;
	settingsState: import("../settings/services/contracts/ISettingsState").ISettingsState;
	settingsPersister: import("../settings/services/contracts/ISettingsPersister").ISettingsPersister;
	globalFeatureFlagPersister: import("../auth/services/contracts/IGlobalFeatureFlagPersister").IGlobalFeatureFlagPersister;
	userFeatureFlagPersister: import("../auth/services/contracts/IUserFeatureFlagPersister").IUserFeatureFlagPersister;
	viewportManager: import("../device/services/contracts/IViewportManager").IViewportManager;
	deviceDetector: import("../device/services/contracts/IDeviceDetector").IDeviceDetector;
	applicationInitializer: import("../application/services/contracts/IApplicationInitializer").IApplicationInitializer;
	resourceTracker: import("../application/services/contracts/IResourceTracker").IResourceTracker;
	componentManager: import("../application/services/contracts/IComponentManager").IComponentManager;
	errorHandler: import("../application/services/contracts/IErrorHandler").IErrorHandler;
	hapticFeedback: import("../application/services/contracts/IHapticFeedback").IHapticFeedback;
	rippleEffect: import("../application/services/contracts/IRippleEffect").IRippleEffect;
	authenticator: import("../auth/services/contracts/IAuthenticator").IAuthenticator;
	profilePictureManager: import("../auth/services/contracts/IProfilePictureManager").IProfilePictureManager;
	userDocumentManager: import("../auth/services/contracts/IUserDocumentManager").IUserDocumentManager;
	subscriptionManager: import("../subscription/services/contracts/ISubscriptionManager").ISubscriptionManager;
	premiumGateChecker: import("../subscription/services/contracts/IPremiumGateChecker").IPremiumGateChecker;
	usernameValidator: import("../auth/services/contracts/IUsernameValidator").IUsernameValidator;
	accountManager: import("../auth/services/contracts/IAccountManager").IAccountManager;
	mobileFullscreenManager: import("../mobile/services/contracts/IMobileFullscreenManager").IMobileFullscreenManager;
	platformDetector: import("../mobile/services/contracts/IPlatformDetector").IPlatformDetector;
	gestureHandler: import("../mobile/services/contracts/IGestureHandler").IGestureHandler;
	pwaEngagementTracker: import("../mobile/services/contracts/IPWAEngagementTracker").IPWAEngagementTracker;
	pwaInstallDismissalManager: import("../mobile/services/contracts/IPWAInstallDismissalManager").IPWAInstallDismissalManager;
	wordDeriver: import("../foundation/services/contracts/IWordDeriver").IWordDeriver;
	fileDownloader: import("../foundation/services/contracts/IFileDownloader").IFileDownloader;
	storageManager: import("../foundation/services/contracts/IStorageManager").IStorageManager;
	seoManager: import("../foundation/services/contracts/ISeoManager").ISeoManager;
	svgImageConverter: import("../foundation/services/contracts/ISvgImageConverter").ISvgImageConverter;
	onboardingPersister: import("../onboarding/services/contracts/IOnboardingPersister").IOnboardingPersister;
	tagManager: import("$lib/features/library/services/contracts/ITagManager").ITagManager;
	conflictResolver: import("../offline/services/contracts/IConflictResolver").IConflictResolver;
}

// Data items — dissolved from data-container into module singleton getters.
// Explicit interface replaces ItemsOf<DataContainerType>.
interface DataItems {
	csvLoader: import("../foundation/services/contracts/data/ICSVLoader").ICSVLoader;
	csvParser: import("../foundation/services/contracts/data/ICSVParser").ICSVParser;
	enumMapper: import("../foundation/services/contracts/data/IEnumMapper").IEnumMapper;
	dataTransformer: import("../application/services/contracts/IDataTransformer").IDataTransformer;
	persistenceService: import("../persistence/services/contracts/IPersistenceService").IPersistenceService;
	sequenceDomainManager: import("$lib/features/create/shared/services/contracts/ISequenceDomainManager").ISequenceDomainManager;
	reversalDetector: import("$lib/features/create/shared/services/contracts/IReversalDetector").IReversalDetector;
	sequenceNormalizer: import("$lib/features/compose/services/contracts/ISequenceNormalizer").ISequenceNormalizer;
	sequenceLoopabilityChecker: import("$lib/features/compose/services/contracts/ISequenceLoopabilityChecker").ISequenceLoopabilityChecker;
	persistenceInitializationService: import("../persistence/services/contracts/IPersistenceInitializationService").IPersistenceInitializationService;
	sequenceImporter: import("$lib/features/create/shared/services/contracts/ISequenceImporter").ISequenceImporter;
	sequenceRepository: import("$lib/features/create/shared/services/contracts/ISequenceRepository").ISequenceRepository;
}

// Factory containers
// FeedbackItems removed — dissolved into module singleton getters
// GamificationItems removed — dissolved into module singleton getters
// PromoItems removed — dissolved into module singleton getters
// RenderItems — dissolved from render-container into module singleton getters.
// Explicit interface replaces ItemsOf<RenderContainer>.
interface RenderItems {
	canvasManager: import("../render/services/contracts/ICanvasManager").ICanvasManager;
	layoutCalculator: import("../render/services/contracts/ILayoutCalculator").ILayoutCalculator;
	dimensionCalculator: import("../render/services/contracts/IDimensionCalculator").IDimensionCalculator;
	svgToCanvasConverter: import("../render/services/contracts/ISVGToCanvasConverter").ISVGToCanvasConverter;
	glyphCache: import("../render/services/implementations/GlyphCache").IGlyphCache;
	filenameGenerator: import("../render/services/implementations/FilenameGenerator").FilenameGenerator;
	pictographBlobCache: import("../render/services/contracts/IPictographBlobCache").IPictographBlobCache;
	pictographKeyHasher: import("../render/services/contracts/IPictographKeyHasher").IPictographKeyHasher;
	pictographMemoryCache: import("../render/services/implementations/PictographMemoryCache").PictographMemoryCache;
	beatNumberRenderer: import("../render/services/contracts/IStepNumberRenderer").IStepNumberRenderer;
	canvas2DRenderer: import("../render/services/contracts/IDirectRenderer").IDirectRenderer;
	layerCompositor: import("../render/services/contracts/ILayerCompositor").ILayerCompositor;
	loopIconStripRenderer: import("../render/services/contracts/ILOOPIconStripRenderer").ILOOPIconStripRenderer;
	textRenderer: import("../render/services/contracts/ITextRenderer").ITextRenderer;
	imageFormatConverter: import("../render/services/contracts/IImageFormatConverter").IImageFormatConverter;
	imageComposer: import("../render/services/contracts/IImageComposer").IImageComposer;
	sequenceRenderer: import("../render/services/contracts/ISequenceRenderer").ISequenceRenderer;
}
type ShareItems = ItemsOf<ShareContainer>;
type BrowseItems = ItemsOf<BrowseContainer>;
// TrainItems removed — dissolved into module singleton getters
// Skel2TKAItems removed — dissolved into module singleton getters
// AdminItems removed — dissolved into module singleton getters
// LearnItems removed — dissolved into module singleton getters
// ModerationItems removed — dissolved into module singleton getters
type LibraryItems = ItemsOf<LibraryContainer>;
// QRItems removed — dissolved into module singleton getters
type Engine3DItems = ItemsOf<Engine3DContainer>;
type Viewer3DItems = ItemsOf<Viewer3DContainer>;
type DelightItems = ItemsOf<DelightContainer>;
type AttributionItems = ItemsOf<AttributionContainer>;
type VoiceControlItems = ItemsOf<VoiceControlContainer>;
type VoiceSessionItems = ItemsOf<VoiceSessionContainer>;
type WatchItems = ItemsOf<WatchContainer>;
type LanSyncItems = ItemsOf<LanSyncContainer>;
type ConnectItems = ItemsOf<ConnectContainer>;
type DeviceSyncItems = ItemsOf<DeviceSyncContainer>;
type PushItems = ItemsOf<PushContainer>;
type OfflineItems = ItemsOf<OfflineContainer>;

// Feature container items (not previously wired into the intersection)
type CollisionLabItems = ItemsOf<CollisionLabContainer>;
type ComposeArrangeItems = ItemsOf<ComposeArrangeContainer>;
type ComposeBrowseItems = ItemsOf<ComposeBrowseContainer>;
type HallOfShameItems = ItemsOf<HallOfShameContainer>;
type LandingPreviewItems = ItemsOf<LandingPreviewContainer>;
type MultiGridItems = ItemsOf<MultiGridContainer>;
type MuseumItems = ItemsOf<MuseumContainer>;
type PoiItems = ItemsOf<PoiContainer>;
type PoiLabItems = ItemsOf<PoiLabContainer>;
type StoreItems = ItemsOf<StoreContainer>;
type TikaItems = ItemsOf<TikaContainer>;
type VideoInfraItems = ItemsOf<VideoInfraContainer>;
type VideoTrailsItems = ItemsOf<VideoTrailsContainer>;
// ============================================================================
// Upsert conflict handling
//
// createModuleContainer registers `loopDetector` which loopLabelerContainer
// later overwrites via upsert. Omit the overwritten key from the earlier
// container so the intersection reflects runtime (last writer wins).
// ============================================================================
type CreateItemsClean = Omit<ItemsOf<CreateContainer>, "loopDetector">;

// ============================================================================
// Standalone services added directly in buildAppContainer()
// ============================================================================
interface StandaloneItems {
	deepLinkResolver: DeepLinkResolver;
	sequenceDataProvider: SequenceDataProvider;
	deviceIdService: IDeviceIdService;
	// Print Prep services (MPC card export)
	printCardRenderer: import("$lib/features/choreo-card/services/contracts/IPrintCardRenderer").IPrintCardRenderer;
	cardBackDomRenderer: import("$lib/features/choreo-card/services/contracts/ICardBackDomRenderer").ICardBackDomRenderer;
	infoCardCanvasRenderer: import("$lib/features/choreo-card/services/contracts/IInfoCardCanvasRenderer").IInfoCardCanvasRenderer;
	// printPDFExporter removed from DI — lazy-loaded at call sites (pdf-lib is CSP-incompatible when eagerly imported)
	printZipExporter: import("$lib/features/choreo-card/services/contracts/IPrintZipExporter").IPrintZipExporter;
}

// ============================================================================
// Composed type: flat intersection of every container's items
//
// Order follows buildAppContainer() in index.ts for easy cross-reference.
// ============================================================================
export type IAppContainerItems =
	// Core infrastructure
	CoreItems &
	DataItems &
	NavigationItems &
	RenderItems &
	ComposeCoreContainerItems &
	// Create module (with loopDetector omitted — overwritten by loop-labeler)
	CreateItemsClean &
	// Browse (upsert, but no actual key conflicts remain after browse* prefix rename)
	BrowseItems &
	// Train, Learn, Gamification, Feedback, Admin, Promo, QR, Moderation,
	// LoopLabeler, Skel2TKA dissolved — services accessed via module singleton getters
	LibraryItems &
	ShareItems &
	Engine3DItems &
	Viewer3DItems &
	DelightItems &
	WatchItems &
	LanSyncItems &
	DeviceSyncItems &
	ConnectItems &
	// Attribution (proxy keys match container items)
	AttributionItems &
	VoiceControlItems &
	VoiceSessionItems &
	// Push notifications (FCM token management)
	PushItems &
	// Offline caching (proactive gallery + thumbnail prefetch)
	OfflineItems &
	// Feature containers (wired via buildAppContainer)
	CollisionLabItems &
	ComposeArrangeItems &
	ComposeBrowseItems &
	HallOfShameItems &
	LandingPreviewItems &
	MultiGridItems &
	MuseumItems &
	PoiItems &
	PoiLabItems &
	StoreItems &
	TikaItems &
	VideoInfraItems &
	VideoTrailsItems &
	// Standalone services
	StandaloneItems;
