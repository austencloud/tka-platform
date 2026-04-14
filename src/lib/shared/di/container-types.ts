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
import type { CoreContainer } from "./containers/core-container";
import type { DataContainerType } from "./containers/data-container";
import type { KeyboardContainer } from "./containers/keyboard-container";
import type { AnalyticsContainer } from "./containers/analytics-container";
import type { PresenceContainer } from "./containers/presence-container";
import type { CommunityContainer } from "./containers/community-container";
import type { WriteContainer } from "./containers/write-container";
import type { MandalaContainer } from "./containers/mandala-container";
import type { SequenceMandalaContainer } from "./containers/sequence-mandala-container";
import type { BackgroundBuilderContainerType } from "./containers/background-builder-container";
import type { CompositionContainer } from "./containers/composition-container";

// ============================================================================
// Container type imports — factory (ReturnType<typeof create...>) containers
// ============================================================================
import type { FeedbackContainer } from "./containers/feedback-container";
import type { GamificationContainer } from "./containers/gamification-container";
import type { PromoContainer } from "./containers/promo-container";
import type { RenderContainer } from "./containers/render-container";
import type { ShareContainer } from "./containers/share-container";
import type { BrowseContainer } from "./containers/browse-container";
import type { CreateContainer } from "./containers/create-container";
import type { TrainContainer } from "./containers/train-container";
import type { Skel2TKAContainer } from "./containers/skel2tka-container";
import type { AdminContainer } from "./containers/admin-container";
import type { LearnContainer } from "./containers/learn-container";
import type { ModerationContainer } from "./containers/moderation-container";
import type { LibraryContainer } from "./containers/library-container";
import type { QRContainer } from "./containers/qr-container";
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
import type { PlatformContainerType } from "./containers/platform-container";
import type { ViewerAuthContainer } from "./containers/viewer-auth-container";
// Containers that already export items types directly (["items"])
import type { NavigationContainerItems } from "./containers/navigation-container";
import type { ComposeCoreContainerItems } from "./containers/compose-core-container";
import type { LoopLabelerContainerItems } from "./containers/loop-labeler-container";

// ============================================================================
// Standalone services registered directly in buildAppContainer()
// ============================================================================
import type { DeepLinkResolver } from "../application/services/implementations/DeepLinkResolver";
import type { SequenceDataProvider } from "../sequence-viewer/services/implementations/SequenceDataProvider";

// ============================================================================
// Helper: extract the resolved items type from an ITI container
// ============================================================================
type ItemsOf<C> = C extends { items: infer I } ? { [K in keyof I]: I[K] } : never;

// ============================================================================
// Extract items from each container
// ============================================================================

// Simple containers
type CompositionItems = ItemsOf<CompositionContainer>;
type CoreItems = ItemsOf<CoreContainer>;
type DataItems = ItemsOf<DataContainerType>;
type KeyboardItems = ItemsOf<KeyboardContainer>;
type AnalyticsItems = ItemsOf<AnalyticsContainer>;
type PresenceItems = ItemsOf<PresenceContainer>;
type CommunityItems = ItemsOf<CommunityContainer>;
type WriteItems = ItemsOf<WriteContainer>;
type MandalaItems = ItemsOf<MandalaContainer>;
type SequenceMandalaItems = ItemsOf<SequenceMandalaContainer>;
type BackgroundBuilderItems = ItemsOf<BackgroundBuilderContainerType>;

// Factory containers
type FeedbackItems = ItemsOf<FeedbackContainer>;
type GamificationItems = ItemsOf<GamificationContainer>;
type PromoItems = ItemsOf<PromoContainer>;
type RenderItems = ItemsOf<RenderContainer>;
type ShareItems = ItemsOf<ShareContainer>;
type BrowseItems = ItemsOf<BrowseContainer>;
type TrainItems = ItemsOf<TrainContainer>;
type Skel2TKAItems = ItemsOf<Skel2TKAContainer>;
type AdminItems = ItemsOf<AdminContainer>;
type LearnItems = ItemsOf<LearnContainer>;
type ModerationItems = ItemsOf<ModerationContainer>;
type LibraryItems = ItemsOf<LibraryContainer>;
type QRItems = ItemsOf<QRContainer>;
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
type PlatformNativeItems = ItemsOf<PlatformContainerType>;
type ViewerAuthItems = ItemsOf<ViewerAuthContainer>;
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
	// Print Prep services (MPC card export)
	printCardRenderer: import("$lib/features/choreo-card/services/contracts/IPrintCardRenderer").IPrintCardRenderer;
	cardBackDomRenderer: import("$lib/features/choreo-card/services/contracts/ICardBackDomRenderer").ICardBackDomRenderer;
	infoCardCanvasRenderer: import("$lib/features/choreo-card/services/contracts/IInfoCardCanvasRenderer").IInfoCardCanvasRenderer;
	printPDFExporter: import("$lib/features/choreo-card/services/contracts/IPrintPDFExporter").IPrintPDFExporter;
	printZipExporter: import("$lib/features/choreo-card/services/contracts/IPrintZipExporter").IPrintZipExporter;
}

// ============================================================================
// Composed type: flat intersection of every container's items
//
// Order follows buildAppContainer() in index.ts for easy cross-reference.
// ============================================================================
export type IAppContainerItems =
	// Core infrastructure
	CompositionItems &
	CoreItems &
	DataItems &
	NavigationContainerItems &
	RenderItems &
	ComposeCoreContainerItems &
	// Create module (with loopDetector omitted — overwritten by loop-labeler)
	CreateItemsClean &
	// Browse (upsert, but no actual key conflicts remain after browse* prefix rename)
	BrowseItems &
	TrainItems &
	LearnItems &
	LibraryItems &
	// Loop labeler (upserts loopDetector + adds navigator)
	LoopLabelerContainerItems &
	GamificationItems &
	FeedbackItems &
	ShareItems &
	AdminItems &
	PromoItems &
	KeyboardItems &
	AnalyticsItems &
	PresenceItems &
	CommunityItems &
	WriteItems &
	MandalaItems &
	SequenceMandalaItems &
	QRItems &
	Engine3DItems &
	Viewer3DItems &
	BackgroundBuilderItems &
	DelightItems &
	ModerationItems &
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
	// Native platform (Capacitor) services
	PlatformNativeItems &
	// Viewer auth (pending-action queue + webview detection)
	ViewerAuthItems &
	// Standalone services
	StandaloneItems;
