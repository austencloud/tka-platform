<!--
  SequenceViewerOrchestrator.svelte

  Headless orchestrator component that owns all sequence viewer state and logic.
  Both the route (/sequence/[id]) and the drawer host render this component,
  passing a children snippet that receives the full context object.

  Delegates to focused modules:
  - PlaybackController.svelte.ts - playback state, stepping, practice training
  - ExportCoordinator.svelte.ts - 2D/3D export routing, recording, progress
  - PropContextResolver.svelte.ts - prop context toggle, presentation resolution
  - ImageCompositionSync.svelte.ts - image composition settings sync
  - AuthActionQueue.svelte.ts - pending-action queue, sign-in routing

  The orchestrator retains:
  - Service initialization bootstrap
  - Keyboard shortcuts (Escape, Space, P)
  - Fullscreen & UI modes
  - LAN sync coordination
  - Navigation actions (Open in Compose, Edit, Save, Delete, Share)
  - Dark mode unification
  - Composing extracted children
-->
<script lang="ts" module>

import { getAnimationPlaybackController } from "$lib/features/compose/getAnimationPlaybackController";
import { getSequenceAnimationOrchestrator } from "$lib/features/compose/getSequenceAnimationOrchestrator";
import { getCollectionManager } from "$lib/features/library/getCollectionManager";
import { getLibraryRepository } from "$lib/features/library/getLibraryRepository";
import { getPropStateInterpolator } from "$lib/shared/3d/getPropStateInterpolator";
import { getSequenceConverter } from "$lib/shared/3d/getSequenceConverter";
import { getViewer3DUndoManager } from "$lib/shared/3d/getViewer3DUndoManager";
import { getLanSyncCoordinator } from "$lib/shared/lan-sync/getLanSyncCoordinator";
import { getSequenceDataProvider } from "$lib/shared/sequence-viewer/getSequenceDataProvider";
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepMap } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type {
    ViewerPlaybackState,
    ImageCompositionProps,
    PropRenderingProps,
  } from "../domain/viewer-prop-groups";
  import type { ResolvedPresentation, ViewingContext } from "../services/contracts/IPresentationResolver";

  export type ViewMode = "animation" | "image" | "split";
  export type ExportType = "animation" | "image" | "both";
  export type PlaybackSource = "animation" | "video";

  /**
   * Full context passed to children snippet.
   * Contains all state and handlers needed to render the sequence viewer UI.
   */
  export interface OrchestratorContext {
    // Sequence data
    sequence: SequenceData | null;
    effectiveSequence: SequenceData | null;
    hasSequence: boolean;

    // Playback state
    isPlayingLocal: boolean;
    currentStepLocal: number;
    bpmLocal: number;
    currentLetter: Letter | null;
    currentStepData: StartPositionData | StepData | null;
    highlightedStepIndex: number | null;
    animationLoading: boolean;

    // Video-synced playback
    playbackSource: PlaybackSource;
    videoPlaybackBeatIndex: number | null;
    activeStepMap: StepMap | null;
    setPlaybackSource: (source: PlaybackSource) => void;
    setActiveStepMap: (beatMap: StepMap | null) => void;
    onVideoTimeUpdate: (currentTime: number) => void;
    modalAnimationState: AnimationPanelState;

    // View state
    viewMode: ViewMode;
    isMobile: boolean;
    isFullscreen: boolean;
    fullscreenControlsVisible: boolean;
    fullscreenStackVertical: boolean;
    editingPane: 'animation' | 'image' | 'video-upload' | null;

    // Export state
    isExportMode: boolean;
    exportType: ExportType | null;
    exportOptions: ReturnType<typeof import("$lib/shared/sequence-viewer/state/export-options-state.svelte").getExportOptionsState>;
    isExporting: boolean;
    exportProgress: VideoExportProgress | null;
    exportError: string | null;
    /** Object URL of exported video for in-app preview, null when no preview active */
    previewBlobUrl: string | null;
    /** Duration in seconds of a single sequence playthrough at current BPM */
    singlePlayDuration: number;

    // Practice training
    practiceActive: boolean;
    practiceState: ReturnType<typeof import("$lib/shared/sequence-viewer/state/tempo-practice-state.svelte").createTempoPracticeState>;

    // Settings
    bluePropType: PropType | undefined;
    redPropType: PropType | undefined;
    catDogModeEnabled: boolean | undefined;

    // Prop context toggle (for header compact toggle)
    presentation: ResolvedPresentation | null;
    togglePropContext: () => void;
    activeContext: ViewingContext;

    // Prop source tracking
    handleSetAsIntended: () => Promise<void>;

    imgShowWord: boolean;
    imgShowStartPos: boolean;
    imgShowDifficulty: boolean;
    imgShowCreatorName: boolean;
    imgShowStepNumbers: boolean;
    imgShowNotes: boolean;
    imgShowBirthday: boolean;
    imgDarkMode: boolean;
    imgColumnCount: number | null;

    // Sync
    isSyncToggling: boolean;
    isSyncActive: boolean;
    isSyncConnected: boolean;

    // Canvas state
    canvasReady: boolean;

    // Render progress
    onRenderProgress: (loaded: number, total: number) => void;

    // Auth
    isLoggedIn: boolean;
    userName: string;
    isOwned: boolean;
    isSaved: boolean;
    isPublished: boolean;
    isFavorite: boolean;
    handleFavoriteToggle: () => void;
    handlePublishAction: () => Promise<void>;
    handleUnpublishAction: () => Promise<void>;

    // Playback mode
    playbackMode: import("$lib/features/compose/state/animation-panel-state.svelte").PlaybackMode;
    handlePlaybackModeChange: (mode: import("$lib/features/compose/state/animation-panel-state.svelte").PlaybackMode) => void;

    // Handlers
    handlePlaybackToggle: () => void;
    handleBpmChange: (bpm: number) => void;
    handleStepClick: (stepIndex: number) => void;
    handleProgressBarSeek: (targetStep: number) => void;
    handleProgressBarScrubStart: () => void;
    handleProgressBarScrubEnd: () => void;
    enterEditMode: (pane: 'animation' | 'image' | 'video-upload') => void;
    exitEditMode: () => void;
    enterFullscreen: () => void;
    exitFullscreen: () => void;
    handleFullscreenTap: () => void;
    handleExport: () => Promise<void>;
    handleCanvasReady: (canvas: HTMLCanvasElement | null) => void;
    handleSyncToggle: () => Promise<void>;
    handleOpenInCompose: (preset?: 'stagger' | 'mirror' | 'combo-export') => Promise<void>;
    handleEdit: () => void;
    handleSave: () => void;
    handleVideoUpload: () => Promise<void>;
    handleShare: () => void;
    handleDelete: () => Promise<void>;
    handleOpenInBrowser: (pendingType?: PendingActionType | null) => void;
    /** Called by footer action buttons; if signed in, runs realHandler; else captures intent + opens sign-in sheet. */
    invokeGatedAction: (type: PendingActionType, realHandler: (() => void) | (() => Promise<void>) | undefined) => void;
    handleUnifiedDarkModeToggle: () => void;
    handlePracticeStart: () => void;
    handlePracticeStop: () => void;
    onBack: () => void;
    stepHalfBeatBackward: () => void;
    stepHalfBeatForward: () => void;
    stepFullBeatBackward: () => void;
    stepFullBeatForward: () => void;
    restartToStart: () => void;
    handleCancelExport: () => void;
    handleRetryExport: () => void;
    dismissPreview: () => void;

    // Pre-assembled prop groups for ViewerSplitPane
    splitPanePlayback: ViewerPlaybackState;
    splitPaneImageComposition: ImageCompositionProps;
    splitPanePropRendering: PropRenderingProps;

    // 3D render mode
    renderMode: '2d' | '3d';
    viewer3DState: ReturnType<typeof import("$lib/shared/3d/state/viewer-3d-state.svelte").createViewer3DState>;

    // 3D recording UI state
    /** Countdown value (3, 2, 1) before 3D recording starts. 0 = not counting down. */
    countdownValue: number;
    /** Whether a real-time 3D recording is in progress */
    isRecording3D: boolean;
    /** Elapsed seconds of the current 3D recording */
    recordingElapsed: number;
    /** Stop the current 3D recording and proceed to export */
    handleStopRecording: () => void;

    /** Per-viewer motion visibility state (ephemeral, resets on sequence change) */
    viewerVisibility: SequenceViewerVisibilityState;
  }
</script>

<script lang="ts">
  import { onMount, onDestroy, untrack, type Snippet } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { getSequenceEncoder } from "$lib/shared/navigation/getSequenceEncoder";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { ISequenceAnimationOrchestrator } from "$lib/features/compose/services/contracts/ISequenceAnimationOrchestrator";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { ISequenceDataProvider } from "$lib/shared/sequence-viewer/services/contracts/ISequenceDataProvider";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { setAnimationPlaybackRef } from "$lib/shared/coordinators/animation-playback-ref.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import { setScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import { snapshotConfigFromVm, bindVmToEffectsConfig } from "$lib/shared/effects/compat/vm-shim";
  import { seedTrailsFromAnimationSettings } from "$lib/shared/effects/compat/animation-settings-shim";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { getSettings, updateSettings } from "$lib/shared/application/state/app-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { layoutCalculator } from "$lib/shared/render/services/implementations/LayoutCalculator";
  import { sequenceModalPersistence } from "$lib/shared/sequence-viewer/services/implementations/SequenceModalPersistence";
  import { cellPreWarmer } from "$lib/shared/sequence-viewer/services/implementations/CellPreWarmer";
  import { createModalAccessibilityHelper } from "$lib/shared/sequence-viewer/services/implementations/ModalAccessibilityHelper.svelte";
  import { saveSequenceHandoff } from "$lib/shared/coordinators/sequence-handoff.svelte";
  import type { ShareURLMetadata } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";
  import { getHighlightedBeatFromVideo } from "$lib/shared/video-collaboration/utils/step-map-utils";
  import type { ICollectionManager } from "$lib/features/library/services/contracts/ICollectionManager";
  import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
  import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { SequenceViewerVisibilityState } from "../state/viewer-visibility-state.svelte";
  import { setViewerVisibilityContext } from "../context/viewer-visibility-context";
  import type { PendingActionType } from "$lib/shared/sequence-viewer/services/contracts/IPendingActionQueue";
  import SignInSheet from "./SignInSheet.svelte";
  import GoogleOneTap from "$lib/shared/auth/components/GoogleOneTap.svelte";

  // ── Extracted modules ──
  import { createPlaybackController } from "./PlaybackController.svelte";
  import { createExportCoordinator } from "./ExportCoordinator.svelte";
  import { createPropContextResolver } from "./PropContextResolver.svelte";
  import { createImageCompositionSync } from "./ImageCompositionSync.svelte";
  import { createAuthActionQueue } from "./AuthActionQueue.svelte";

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    /** The sequence to display. Null while loading. */
    sequence: SequenceData | null;
    /** Whether we're on mobile. */
    isMobile: boolean;
    /** Initial BPM to restore. */
    initialBpm?: number;
    /** Initial playback step to restore. */
    initialStep?: number;
    /** Initial view mode. */
    initialViewMode?: ViewMode;
    /** Callback when back/dismiss is triggered. */
    onBack: () => void;
    /** Optional: callback to update a URL param (route-only). */
    onUrlParamChange?: (key: string, value: string) => void;
    /** Whether to block clicks (e.g., during swipe). */
    blockClicks?: boolean;
    /** Controls how props are resolved: "notation" uses viewer settings, "creator-expression" uses creator's intent. */
    viewingContext?: ViewingContext;
    /** When true, forces unauthenticated view (shows "Get App" footer instead of save/edit). Debug tool via ?guest=1. */
    forceGuest?: boolean;
    /** Initial 2D/3D render mode (e.g. from URL param). */
    initialRenderMode?: '2d' | '3d';
    /** Children snippet receiving the full orchestrator context. */
    children: Snippet<[OrchestratorContext]>;
  }

  let {
    sequence,
    isMobile,
    initialBpm = 60,
    initialStep = 0,
    initialViewMode,
    onBack,
    onUrlParamChange,
    blockClicks = false,
    viewingContext = "notation",
    forceGuest = false,
    initialRenderMode,
    children,
  }: Props = $props();

  // ============================================================================
  // SERVICE BOOTSTRAP
  // ============================================================================

  const modalAnimationState = createAnimationPanelState();
  let animationServicesReady = $state(false);
  let animationLoading = $state(false);
  let lastLoadedSequenceId: string | null = null;

  // Services
  let playbackControllerRef = $state<IAnimationPlaybackController | null>(null);
  let sequenceDataProvider: ISequenceDataProvider | null = null;
  let hapticService: IHapticFeedback | null = null;

  // ============================================================================
  // EXTRACTED MODULES
  // ============================================================================

  // ── Playback ──
  // Factory receives hardcoded defaults; the $effect.pre below immediately
  // syncs the real prop values (runs before first render), avoiding
  // state_referenced_locally by never reading initialBpm/initialStep outside
  // a reactive context.
  const playback = createPlaybackController({ modalAnimationState, initialBpm: 60, initialStep: 0 });

  // Sync initial values when props change (mirrors original $effect.pre)
  $effect.pre(() => { playback.currentStepLocal = initialStep; playback.bpmLocal = initialBpm; });

  // ── Export ──
  // 3D viewer state - created once, distributed via Svelte context
  const viewer3DState = createViewer3DState({
    propInterpolator: getPropStateInterpolator(),
    sequenceConverter: getSequenceConverter(),
    viewer3DUndoManager: getViewer3DUndoManager(),
  });
  setViewer3DContext(viewer3DState);

  const accessibilityHelper = createModalAccessibilityHelper();

  const exportCoord = createExportCoordinator({ viewer3DState, accessibilityHelper });

  // ── Prop context ──
  // viewingContext is NOT passed here - the factory doesn't read it from deps.
  // Instead, activeContext is resolved reactively via getActiveContext(viewingContext)
  // in the $derived block below.
  const propContext = createPropContextResolver({});

  // ── Image composition ──
  const imgComp = createImageCompositionSync();

  // ── Auth action queue ──
  const authQueue = createAuthActionQueue();

  // Wire export's exit-edit-mode callback
  exportCoord.setExitEditModeCallback(() => exitEditMode());

  // Wire playback's URL param callback reactively so the reference stays
  // current if the parent swaps it (avoids state_referenced_locally warning).
  $effect(() => {
    playback.setOnUrlParamChange(onUrlParamChange);
  });

  // ============================================================================
  // VIEW MODE STATE
  // ============================================================================

  let viewMode = $state<ViewMode>(sequenceModalPersistence.loadViewMode());
  $effect.pre(() => { if (initialViewMode) viewMode = initialViewMode; });

  // ============================================================================
  // FULLSCREEN STATE
  // ============================================================================

  let isFullscreen = $state(false);
  let fullscreenControlsVisible = $state(false);
  let controlsHideTimeout: ReturnType<typeof setTimeout> | null = null;

  // ============================================================================
  // EDIT MODE STATE
  // ============================================================================

  const EDITING_PANE_SESSION_KEY = "tka-viewer-editing-pane";
  const EDITING_PANE_TTL_MS = 2000;
  type PersistedEditingPane = {
    pane: 'animation' | 'image' | 'video-upload';
    ts: number;
    sequenceId: string | null;
  };
  function loadRecentEditingPane(currentSequenceId: string | null): 'animation' | 'image' | 'video-upload' | null {
    if (typeof sessionStorage === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(EDITING_PANE_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedEditingPane;
      const fresh = Date.now() - parsed.ts <= EDITING_PANE_TTL_MS;
      const sameSequence = parsed.sequenceId === currentSequenceId;
      if (!fresh || !sameSequence) {
        sessionStorage.removeItem(EDITING_PANE_SESSION_KEY);
        return null;
      }
      return parsed.pane ?? null;
    } catch {
      return null;
    }
  }
  function persistEditingPane(pane: 'animation' | 'image' | 'video-upload' | null, sequenceId: string | null) {
    if (typeof sessionStorage === "undefined") return;
    try {
      if (pane === null) {
        sessionStorage.removeItem(EDITING_PANE_SESSION_KEY);
      } else {
        const payload: PersistedEditingPane = { pane, ts: Date.now(), sequenceId };
        sessionStorage.setItem(EDITING_PANE_SESSION_KEY, JSON.stringify(payload));
      }
    } catch {
      // storage unavailable or full
    }
  }
  let editingPane = $state<'animation' | 'image' | 'video-upload' | null>(
    untrack(() => loadRecentEditingPane(sequence?.id ?? null))
  );
  $effect(() => {
    persistEditingPane(editingPane, sequence?.id ?? null);
  });

  // ============================================================================
  // VIDEO-SYNCED PLAYBACK
  // ============================================================================

  let playbackSource = $state<PlaybackSource>("animation");
  let videoPlaybackBeatIndex = $state<number | null>(null);
  let activeStepMap = $state<StepMap | null>(null);

  // ============================================================================
  // EXPORT MODE (derived)
  // ============================================================================

  const isExportMode = $derived(editingPane !== null);
  const exportType = $derived<ExportType | null>(
    editingPane === 'animation' ? 'animation' : editingPane === 'image' ? 'image' : null
  );

  // ============================================================================
  // RENDER PROGRESS
  // ============================================================================

  let cellsLoaded = $state(0);
  let totalCells = $state(0);

  function handleRenderProgress(loaded: number, total: number) {
    cellsLoaded = loaded;
    totalCells = total;
  }

  // ============================================================================
  // LAN SYNC
  // ============================================================================

  let isSyncToggling = $state(false);

  // ============================================================================
  // SETTINGS
  // ============================================================================

  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType);
  const redPropType = $derived(settings.redPropType);
  const catDogModeEnabled = $derived(settings.catDogMode);

  // ============================================================================
  // MOTION VISIBILITY
  // ============================================================================

  const viewerVisibility = new SequenceViewerVisibilityState();
  setViewerVisibilityContext(viewerVisibility);

  $effect(() => {
    void sequence?.id;
    viewerVisibility.reset();
  });

  // ============================================================================
  // ANIMATION VISIBILITY & EFFECTS
  // ============================================================================

  const animationVisibility = getAnimationVisibilityManager();

  const effectsConfigState = createEffectsConfigState(snapshotConfigFromVm(animationVisibility));
  seedTrailsFromAnimationSettings(effectsConfigState);
  setEffectsConfigContext(effectsConfigState);

  const scene3DRenderState = createScene3DRenderState();
  setScene3DRenderContext(scene3DRenderState);

  $effect(() => {
    const dispose = bindVmToEffectsConfig(animationVisibility, effectsConfigState);
    return dispose;
  });

  $effect(() => {
    animationSettings.trail.lineWidth;
    animationSettings.trail.maxOpacity;
    animationSettings.trail.blueColor;
    animationSettings.trail.redColor;
    animationSettings.trail.trackingMode;
    untrack(() => seedTrailsFromAnimationSettings(effectsConfigState));
  });

  // ============================================================================
  // PROP CONTEXT (derived from extracted module)
  // ============================================================================

  const activeContext = $derived(propContext.getActiveContext(viewingContext));

  const presentation = $derived.by((): ResolvedPresentation => {
    return propContext.resolvePresentation(
      sequence,
      activeContext,
      bluePropType,
      redPropType,
      catDogModeEnabled,
    );
  });

  const isHandPath = $derived(Boolean(sequence?.metadata?.isHandPathVisualization));
  const activeBlueProp = $derived(isHandPath ? PropType.HAND : presentation.bluePropType);
  const activeRedProp = $derived(isHandPath ? PropType.HAND : presentation.redPropType);
  const activeCatDog = $derived(isHandPath ? false : presentation.catDogMode);

  function togglePropContext() {
    propContext.togglePropContext(activeContext);
  }

  // Sync active props to animation orchestrator
  $effect(() => {
    const blue = activeBlueProp;
    const red = activeRedProp;
    propContext.syncPropsToOrchestrator(blue, red, animationServicesReady);
  });

  // ============================================================================
  // DURATION (for export UI)
  // ============================================================================

  const effectiveSequence = $derived(modalAnimationState.sequenceData ?? sequence);
  const hasSequence = $derived(effectiveSequence !== null);

  const singlePlayDuration = $derived.by(() => {
    const steps = effectiveSequence?.steps;
    if (!steps?.length || playback.bpmLocal <= 0) return 0;
    const totalDurationUnits = steps.reduce((sum, s) => sum + (s.duration ?? 1), 0);
    const speed = playback.bpmLocal / 60;
    return totalDurationUnits / speed;
  });

  // ============================================================================
  // AUTH / OWNERSHIP DERIVED
  // ============================================================================

  const isOwned = $derived(
    !!sequence?.ownerId &&
    !!authState.user?.uid &&
    sequence.ownerId === authState.user.uid
  );

  let isSaved = $state(true);
  let isFavorite = $state(false);
  const isPublished = $derived((sequence as LibrarySequence | null)?.visibility === "public");

  const savedHashCache = new Map<string, boolean>();

  $effect(() => {
    const seq = sequence as LibrarySequence | null;
    if (!seq?.contentHash || !authState.user?.uid) {
      isSaved = !(isOwned && seq && !seq.contentHash);
      return;
    }

    const hash = seq.contentHash;
    if (savedHashCache.has(hash)) {
      isSaved = savedHashCache.get(hash)!;
      return;
    }

    const repo = getLibraryRepository() as ILibraryRepository;
    repo.hasMatchingContent(hash)
      .then((found) => {
        savedHashCache.set(hash, found);
        if (sequence?.id === seq.id) isSaved = found;
      })
      .catch(() => {});
  });

  $effect(() => {
    const seq = sequence;
    if (!seq) { isFavorite = false; return; }

    const cm = getCollectionManager() as ICollectionManager;
    cm.isFavorite(seq.id)
      .then((fav) => { if (sequence?.id === seq.id) isFavorite = fav; })
      .catch(() => {});
  });

  function handleFavoriteToggle() {
    if (!sequence) return;
    isFavorite = !isFavorite;
    const cm = getCollectionManager() as ICollectionManager;
    cm.toggleFavorite(sequence.id).catch(() => { isFavorite = !isFavorite; });
  }

  async function handlePublishAction() {
    console.log("[Orchestrator] handlePublishAction called, sequence:", sequence?.id);
    if (!sequence) return;
    try {
      const repo = getLibraryRepository() as ILibraryRepository;
      await repo.publishSequence(sequence.id);
      console.log("[Orchestrator] publishSequence completed");
    } catch (e) {
      console.error("[Orchestrator] publishSequence FAILED:", e);
    }
  }

  async function handleUnpublishAction() {
    if (!sequence) return;
    const repo = getLibraryRepository() as ILibraryRepository;
    await repo.unpublishSequence(sequence.id);
  }

  // ============================================================================
  // STEP / LETTER DERIVED (uses playback state)
  // ============================================================================

  const showPreviousBeat = $derived(
    playback.arrivedViaStepping &&
    !playback.isPlayingLocal &&
    playback.currentStepLocal >= 1 &&
    Math.abs(playback.currentStepLocal - Math.round(playback.currentStepLocal)) < 0.01
  );

  const highlightedStepIndex = $derived.by(() => {
    if (playbackSource === "video" && videoPlaybackBeatIndex !== null) {
      return videoPlaybackBeatIndex;
    }
    if (!playback.isPlayingLocal && playback.currentStepLocal < 0.5) return null;
    if (playback.currentStepLocal < 1) return -1;
    if (showPreviousBeat) {
      return Math.round(playback.currentStepLocal) - 2;
    }
    return Math.floor(playback.currentStepLocal) - 1;
  });

  const currentStepData = $derived.by(() => {
    const sequenceData = modalAnimationState.sequenceData;
    if (!sequenceData) return null;
    if (showPreviousBeat) {
      const prevIndex = Math.round(playback.currentStepLocal) - 2;
      if (prevIndex < 0 && sequenceData.startPosition) {
        return sequenceData.startPosition;
      }
      if (sequenceData.steps?.length > 0) {
        const clampedIndex = Math.min(Math.max(0, prevIndex), sequenceData.steps.length - 1);
        return sequenceData.steps[clampedIndex] || null;
      }
    }
    if (playback.currentStepLocal < 1 && sequenceData.startPosition) {
      return sequenceData.startPosition;
    }
    if (sequenceData.steps?.length > 0) {
      const stepIndex = Math.max(0, Math.floor(playback.currentStepLocal) - 1);
      const clampedIndex = Math.min(stepIndex, sequenceData.steps.length - 1);
      return sequenceData.steps[clampedIndex] || null;
    }
    return null;
  });

  const currentLetter = $derived(currentStepData?.letter || null);

  const previewAspectRatio = $derived.by(() => {
    if (!sequence?.steps?.length) return 1;
    const stepCount = sequence.steps.length;
    return layoutCalculator.calculateThumbnailAspectRatio(stepCount, {
      includeStartPosition: imgComp.imgShowStartPos,
      hasHeader: imgComp.imgShowWord,
      hasFooter: imgComp.imgShowCreatorName || imgComp.imgShowNotes,
    });
  });

  const fullscreenStackVertical = $derived(previewAspectRatio > 1.3);

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  let keydownCleanup: (() => void) | null = null;
  let imageCompositionCleanup: (() => void) | null = null;

  onMount(() => {
    // Bootstrap auth queue from URL
    authQueue.bootstrapFromUrl();

    // Keyboard handler
    window.addEventListener("keydown", handleKeydown, { capture: true });
    keydownCleanup = () => window.removeEventListener("keydown", handleKeydown, { capture: true });

    // Image composition sync
    imageCompositionCleanup = imgComp.registerObserver();

    // Playback mode sync from visibility manager
    playback.registerVisibilityObserver();

    // Load services
    void loadServices();
  });

  onDestroy(() => {
    playback.stopPracticeIfActive();
    keydownCleanup?.();
    imageCompositionCleanup?.();
    playback.dispose();
    modalAnimationState.dispose();
    exportCoord.dispose();
    viewer3DState.dispose();
    clearControlsTimeout();
  });

  // Initialize animation when sequence becomes available and services are ready
  $effect(() => {
    if (sequence && animationServicesReady && playbackControllerRef) {
      initializeAnimation(sequence);
    }
  });

  // Restore pathShape from sequence metadata when the sequence changes
  $effect(() => {
    const savedPathShape = sequence?.metadata?.pathShape;
    if (savedPathShape === "arc" || savedPathShape === "linear") {
      getAnimationVisibilityManager().setPathShape(savedPathShape);
    }
  });

  // Sync render mode to URL param
  $effect(() => {
    if (viewer3DState.renderMode === '3d') {
      onUrlParamChange?.('render', '3d');
    } else {
      onUrlParamChange?.('render', '');
    }
  });

  // Restore 3D mode on first load
  let _3dRestored = false;
  $effect(() => {
    if (_3dRestored) return;
    if (!sequence) return;
    if (!viewer3DState.webgl2Available) {
      _3dRestored = true;
      return;
    }
    const shouldBe3D = initialRenderMode === '3d' || viewer3DState.renderMode === '3d';
    if (shouldBe3D) {
      viewer3DState.enter3D(sequence);
    }
    _3dRestored = true;
  });

  // ============================================================================
  // LAN SYNC EFFECT
  // ============================================================================

  let lastAppliedSyncTimestamp = 0;

  $effect(() => {
    const pb = lanSyncState.playbackState;
    if (!lanSyncState.isConnected || !playbackControllerRef) return;

    if (pb.timestamp > lastAppliedSyncTimestamp) {
      lastAppliedSyncTimestamp = pb.timestamp;

      if (pb.isPlaying !== playback.isPlayingLocal) {
        if (pb.isPlaying) {
          if (!playback.isPlayingLocal) playbackControllerRef.togglePlayback();
        } else {
          if (playback.isPlayingLocal) playbackControllerRef.togglePlayback();
        }
      }

      if (Math.abs(pb.currentStep - playback.currentStepLocal) > 0.5) {
        playbackControllerRef.jumpToStep(pb.currentStep);
      }

      const currentSpeed = playback.bpmLocal / 60;
      if (Math.abs(pb.speed - currentSpeed) > 0.01) {
        playbackControllerRef.setSpeed(pb.speed);
      }
    }
  });

  // ============================================================================
  // AUTH REPLAY EFFECT
  // ============================================================================

  $effect(() => {
    authQueue.replayPendingAction({
      handleSave,
      handleFavoriteToggle,
      handlePublishAction,
      handleEdit,
      handleShare,
      handleOpenInBrowser,
    });
  });

  // ============================================================================
  // SERVICES
  // ============================================================================

  async function loadServices() {
    try {
      playbackControllerRef = getAnimationPlaybackController();
      sequenceDataProvider = getSequenceDataProvider();
      hapticService = getHapticFeedback();

      // Wire dependencies to extracted modules
      playback.setPlaybackController(playbackControllerRef);
      playback.setHapticService(hapticService);

      const lanSyncCoordinator = getLanSyncCoordinator();
      lanSyncState.initialize(lanSyncCoordinator);

      animationServicesReady = true;
    } catch (error) {
      console.error("[SequenceViewerOrchestrator] Failed to load services:", error);
      modalAnimationState.setError("Failed to load animation services");
    }
  }

  async function initializeAnimation(seq: SequenceData) {
    if (!playbackControllerRef || !sequenceDataProvider) return;

    const seqId = seq.id || seq.word || "unknown";
    if (seqId === lastLoadedSequenceId) return;

    animationLoading = true;
    modalAnimationState.setLoading(true);
    modalAnimationState.setError(null);

    try {
      const loadedSequence = await sequenceDataProvider.hydrateSequence(seq);
      if (!loadedSequence) throw new Error("Failed to load sequence");

      cellPreWarmer.preWarmSequence(loadedSequence, "user-blocking");

      modalAnimationState.setShouldLoop(true);
      modalAnimationState.setPlaybackMode("continuous");
      const success = playbackControllerRef.initialize(loadedSequence, modalAnimationState);
      if (!success) throw new Error("Failed to initialize playback");

      setAnimationPlaybackRef(playbackControllerRef);

      lastLoadedSequenceId = seqId;
      modalAnimationState.setSequenceData(loadedSequence);

      playbackControllerRef.setSpeed(playback.bpmLocal / 60);

      const MINIMUM_CELLS = 4;
      const MAX_WAIT_MS = 500;
      const CHECK_INTERVAL_MS = 50;
      const startTime = Date.now();

      const checkReady = setInterval(() => {
        const enough = cellsLoaded >= Math.min(MINIMUM_CELLS, totalCells) && totalCells > 0;
        const timedOut = Date.now() - startTime >= MAX_WAIT_MS;
        if (enough || timedOut) {
          clearInterval(checkReady);
          if (viewMode !== "image") {
            playbackControllerRef?.togglePlayback();
          }
        }
      }, CHECK_INTERVAL_MS);
    } catch (err) {
      console.warn("[SequenceViewerOrchestrator] Animation not available:", err);
      modalAnimationState.setError("Animation data not available");
    } finally {
      animationLoading = false;
      modalAnimationState.setLoading(false);
    }
  }

  // ============================================================================
  // FOCUS MODE (EDIT MODE)
  // ============================================================================

  let wasPlayingBeforeImageExport = false;

  function enterEditMode(pane: 'animation' | 'image' | 'video-upload') {
    if (viewer3DState.renderMode === '3d' && pane !== 'animation') {
      viewer3DState.exit3D();
    }
    hapticService?.trigger("selection");
    editingPane = pane;

    if (pane === "animation") {
      if (!playback.isPlayingLocal && playbackControllerRef) {
        playbackControllerRef.togglePlayback();
      }
    } else if (pane === "image" || pane === "video-upload") {
      wasPlayingBeforeImageExport = playback.isPlayingLocal;
      if (playback.isPlayingLocal && playbackControllerRef) {
        playbackControllerRef.togglePlayback();
      }
    }

    if (pane === 'video-upload') {
      accessibilityHelper.announce("Upload a performance video for this sequence.", "assertive");
    } else {
      const label = pane === 'animation' ? 'Animation' : 'Card';
      accessibilityHelper.announce(`${label} export. Configure settings and tap Export when ready.`, "assertive");
    }
  }

  function exitEditMode() {
    hapticService?.trigger("selection");
    const wasPaneImage = editingPane === "image" || editingPane === "video-upload";
    editingPane = null;
    exportCoord.dismissPreview();

    if (wasPaneImage && wasPlayingBeforeImageExport && !playback.isPlayingLocal && playbackControllerRef) {
      playbackControllerRef.togglePlayback();
    }
    wasPlayingBeforeImageExport = false;

    accessibilityHelper.announce("Split view restored");
  }

  // ============================================================================
  // FULLSCREEN
  // ============================================================================

  function enterFullscreen() {
    hapticService?.trigger("selection");
    isFullscreen = true;
    showFullscreenControls();
    accessibilityHelper.announce("Fullscreen mode. Tap to show controls, press Escape to exit.", "assertive");
  }

  function exitFullscreen() {
    hapticService?.trigger("selection");
    isFullscreen = false;
    fullscreenControlsVisible = false;
    clearControlsTimeout();
    accessibilityHelper.announce("Exited fullscreen");
  }

  function showFullscreenControls() {
    fullscreenControlsVisible = true;
    scheduleControlsHide();
  }

  function scheduleControlsHide() {
    clearControlsTimeout();
    controlsHideTimeout = setTimeout(() => {
      fullscreenControlsVisible = false;
    }, 3000);
  }

  function clearControlsTimeout() {
    if (controlsHideTimeout) {
      clearTimeout(controlsHideTimeout);
      controlsHideTimeout = null;
    }
  }

  function handleFullscreenTap() {
    if (isFullscreen && !fullscreenControlsVisible) {
      showFullscreenControls();
    }
  }

  // ============================================================================
  // EXPORT (delegates to ExportCoordinator)
  // ============================================================================

  async function handleExport() {
    await exportCoord.handleExport(
      editingPane,
      effectiveSequence,
      playbackControllerRef,
      modalAnimationState,
      hapticService,
      playback.isPlayingLocal,
      playback.bpmLocal,
      imgComp.imgShowStartPos,
      imgComp.imgShowWord,
      imgComp.imgShowStepNumbers,
      imgComp.imgShowDifficulty,
      imgComp.imgShowCreatorName,
      imgComp.imgShowNotes,
      imgComp.imgShowQRCode,
    );
  }

  // ============================================================================
  // LAN SYNC TOGGLE
  // ============================================================================

  async function handleSyncToggle() {
    if (isSyncToggling || !sequence) return;
    isSyncToggling = true;
    hapticService?.trigger("selection");

    try {
      const sequenceWord = sequence.word || sequence.name || "Sequence";
      lanSyncState.setLocalSequence(sequence as unknown as Record<string, unknown>);

      const isNowSyncing = await lanSyncState.toggleSync(
        sequence.id,
        sequenceWord,
        {
          sequenceId: sequence.id,
          currentStep: playback.currentStepLocal,
          isPlaying: playback.isPlayingLocal,
          speed: playback.bpmLocal / 60,
          shouldLoop: true
        }
      );

      if (!isNowSyncing) {
        lanSyncState.setLocalSequence(null);
      }

      hapticService?.trigger(isNowSyncing ? "success" : "selection");
      accessibilityHelper.announce(isNowSyncing ? "Sync enabled. Searching for peers." : "Sync disabled");
    } catch (err) {
      console.error("[Sync] Toggle failed:", err);
      hapticService?.trigger("error");
      accessibilityHelper.announce("Sync failed. Please try again.");
    } finally {
      isSyncToggling = false;
    }
  }

  // ============================================================================
  // NAVIGATION ACTIONS
  // ============================================================================

  async function handleOpenInCompose(preset: 'stagger' | 'mirror' | 'combo-export' = 'stagger') {
    if (!sequence) return;
    hapticService?.trigger("selection");

    saveSequenceHandoff({
      sequence,
      playbackState: {
        currentStep: playback.currentStepLocal,
        bpm: playback.bpmLocal,
        isPlaying: playback.isPlayingLocal,
      },
      preferredPreset: preset,
      returnPath: browser ? window.location.pathname : "/browse/gallery",
    });

    handleBackInternal();

    const message = preset === 'combo-export'
      ? "Opening in Compose for combined export..."
      : "Opening in Compose...";
    showToast({ message, type: "info", duration: 2000 });

    await goto('/compose?handoff=true');
  }

  function handleEdit() {
    if (!sequence) return;
    if (!authState.isAuthenticated) {
      authDrawerState.show();
      return;
    }
    hapticService?.trigger("selection");

    localStorage.setItem("tka-pending-edit-sequence", JSON.stringify(sequence));
    handleBackInternal();

    showToast({ message: "Opening for editing...", type: "info", duration: 2000 });
    void handleModuleChange("create", "construct");
  }

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  async function handleSave() {
    hapticService?.trigger("selection");
    if (!authState.isAuthenticated) {
      showToast("Sign in to save sequences", "info");
      return;
    }
    if (!sequence) {
      showToast("No sequence to save", "info");
      return;
    }
    try {
      const libraryRepo = getLibraryRepository();
      const currentPathShape = getAnimationVisibilityManager().getPathShape();
      const pathShapeMetadata = currentPathShape !== "arc"
        ? { ...sequence.metadata, pathShape: currentPathShape }
        : sequence.metadata;
      const sequenceWithIntent = createSequenceData({
        ...sequence,
        metadata: pathShapeMetadata,
        creatorIntent: {
          propConfig: {
            bluePropType: bluePropType ?? PropType.STAFF,
            redPropType: redPropType ?? PropType.STAFF,
            catDogMode: catDogModeEnabled ?? false,
          },
          ...(sequence?.creatorIntent?.effortTimeline && { effortTimeline: sequence.creatorIntent.effortTimeline }),
          ...(sequence?.effortTimeline && { effortTimeline: sequence.effortTimeline }),
        },
        intendedProp: {
          bluePropType: bluePropType ?? PropType.STAFF,
          redPropType: redPropType ?? PropType.STAFF,
          catDogMode: catDogModeEnabled ?? false,
        },
      });
      await libraryRepo.saveSequence(sequenceWithIntent);
      showToast("Saved to library", "success");
    } catch (error) {
      console.error("Failed to save sequence:", error);
      showToast("Failed to save sequence", "error");
    }
  }

  async function handleVideoUpload() {
    if (!authState.isAuthenticated) {
      showToast("Sign in to upload videos", "info");
      return;
    }
    if (!sequence) {
      showToast("No sequence to upload video for", "info");
      return;
    }
    enterEditMode("video-upload");
  }

  async function handleSetAsIntended() {
    if (!sequence || !isOwned) return;
    const currentBlue = activeBlueProp;
    const currentRed = activeRedProp;
    const currentCatDog = activeCatDog;
    if (!currentBlue || !currentRed) return;

    try {
      const libraryRepo = getLibraryRepository();
      const currentPathShape = getAnimationVisibilityManager().getPathShape();
      const pathShapeMetadata = currentPathShape !== "arc"
        ? { ...sequence.metadata, pathShape: currentPathShape }
        : sequence.metadata;
      const updatedSequence = createSequenceData({
        ...sequence,
        metadata: pathShapeMetadata,
        creatorIntent: {
          propConfig: {
            bluePropType: currentBlue,
            redPropType: currentRed,
            catDogMode: currentCatDog ?? false,
          },
          ...(sequence?.creatorIntent?.effortTimeline && { effortTimeline: sequence.creatorIntent.effortTimeline }),
          ...(sequence?.effortTimeline && { effortTimeline: sequence.effortTimeline }),
        },
        intendedProp: {
          bluePropType: currentBlue,
          redPropType: currentRed,
          catDogMode: currentCatDog ?? false,
        },
      });
      await libraryRepo.saveSequence(updatedSequence);
      showToast("Intended prop updated", "success");
    } catch (error) {
      console.error("Failed to update intended prop:", error);
      showToast("Failed to update intended prop", "error");
    }
  }

  async function handleDelete() {
    if (!sequence) return;
    hapticService?.trigger("warning");
    try {
      const libraryRepo = getLibraryRepository();
      await libraryRepo.deleteSequence(sequence.id);
      showToast("Sequence deleted", "success");
      handleBackInternal();
    } catch (error) {
      console.error("Failed to delete sequence:", error);
      showToast("Failed to delete sequence", "error");
    }
  }

  function handleShare() {
    hapticService?.trigger("selection");

    let shareUrl = browser ? window.location.href : "";

    if (sequence) {
      try {
        const encoder = getSequenceEncoder();
        const metadata: ShareURLMetadata = {};

        if (sequence.word) metadata.word = sequence.word;
        if (sequence.ownerDisplayName) metadata.creator = sequence.ownerDisplayName;
        if (typeof sequence.metadata?.notes === "string") metadata.notes = sequence.metadata.notes;
        if (typeof sequence.metadata?.difficulty === "string") metadata.difficulty = sequence.metadata.difficulty;
        const birthdaySource = sequence.birthday ?? sequence.createdAt;
        if (birthdaySource) {
          const d = birthdaySource instanceof Date ? birthdaySource : new Date(birthdaySource);
          if (!isNaN(d.getTime())) {
            metadata.birthday = d.toISOString().slice(0, 10).replace(/-/g, "");
          }
        }
        metadata.bpm = playback.bpmLocal;
        metadata.darkMode = imgComp.imgDarkMode;

        const result = encoder.generateViewerURL(sequence, {
          compress: true,
          metadata,
        });
        shareUrl = result.url;
      } catch {
        // Fallback to current URL if encoding fails
      }
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: sequence?.word || "Sequence",
        text: `Check out this TKA sequence: ${sequence?.word || ""}`,
        url: shareUrl,
      }).catch(() => {});
    } else if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Link copied to clipboard", "success");
      }).catch(() => {
        showToast("Could not copy link", "error");
      });
    }
  }

  function handleOpenInBrowser(pendingType: PendingActionType | null = null) {
    hapticService?.trigger("selection");
    const baseUrl = browser ? window.location.href : "";
    if (!baseUrl) return;

    let url = baseUrl;
    if (pendingType) {
      const parsed = new URL(baseUrl);
      parsed.searchParams.set("pending", pendingType);
      url = parsed.toString();
    }

    try {
      window.location.href = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;end`;
    } catch {
      window.open(url, "_blank");
    }
  }

  function handleUnifiedDarkModeToggle() {
    hapticService?.trigger("selection");
    const newValue = !imgComp.imgDarkMode;
    void updateSettings({ darkMode: newValue });
    imgComp.imageComposition.setDarkMode(newValue);
    animationVisibility.setDarkMode(newValue);
  }

  // ============================================================================
  // KEYBOARD
  // ============================================================================

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (isFullscreen) {
        exitFullscreen();
      } else if (editingPane) {
        exitEditMode();
      } else {
        handleBackInternal();
      }
      return;
    }

    if (event.key === " " || event.code === "Space") {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      playbackControllerRef?.togglePlayback();
      return;
    }
  }

  // ============================================================================
  // BACK HANDLER
  // ============================================================================

  function handleBackInternal() {
    playback.stopPracticeIfActive();

    if (playback.isPlayingLocal && playbackControllerRef) {
      playbackControllerRef.togglePlayback();
    }
    setAnimationPlaybackRef(null);

    if (lanSyncState.isConnected) {
      lanSyncState.disconnect();
    }

    accessibilityHelper.restoreFocus();
    onBack();
  }

  // ============================================================================
  // VIDEO-SYNCED PLAYBACK
  // ============================================================================

  function handleVideoTimeUpdate(currentTime: number) {
    if (playbackSource !== "video" || !activeStepMap) return;
    const stepNumber = getHighlightedBeatFromVideo(
      currentTime,
      activeStepMap.beatTimestamps
    );
    if (stepNumber !== videoPlaybackBeatIndex) {
      videoPlaybackBeatIndex = stepNumber;
    }
  }

  function setPlaybackSource(source: PlaybackSource) {
    playbackSource = source;
    if (source === "animation") {
      videoPlaybackBeatIndex = null;
    }
  }

  function setActiveStepMap(beatMap: StepMap | null) {
    activeStepMap = beatMap;
    if (!beatMap) {
      playbackSource = "animation";
      videoPlaybackBeatIndex = null;
    }
  }

  // ============================================================================
  // CONTEXT OBJECT
  // ============================================================================

  const context: OrchestratorContext = $derived({
    // Sequence data
    sequence,
    effectiveSequence,
    hasSequence,

    // Playback
    isPlayingLocal: playback.isPlayingLocal,
    currentStepLocal: playback.currentStepLocal,
    bpmLocal: playback.bpmLocal,
    currentLetter,
    currentStepData,
    highlightedStepIndex,
    animationLoading,
    modalAnimationState,

    // Video-synced playback
    playbackSource,
    videoPlaybackBeatIndex,
    activeStepMap,
    setPlaybackSource,
    setActiveStepMap,
    onVideoTimeUpdate: handleVideoTimeUpdate,

    // View state
    viewMode,
    isMobile,
    isFullscreen,
    fullscreenControlsVisible,
    fullscreenStackVertical,
    editingPane,

    // Export
    isExportMode,
    exportType,
    exportOptions: exportCoord.exportOptions,
    isExporting: exportCoord.isExporting,
    exportProgress: exportCoord.exportProgress,
    exportError: exportCoord.exportError,
    previewBlobUrl: exportCoord.previewBlobUrl,
    singlePlayDuration,

    // Practice
    practiceActive: playback.practiceActive,
    practiceState: playback.practiceState,

    // Settings (active prop values, resolved from source)
    bluePropType: activeBlueProp,
    redPropType: activeRedProp,
    catDogModeEnabled: activeCatDog,

    // Prop context toggle
    presentation: presentation ?? null,
    togglePropContext,
    activeContext,

    // Prop source tracking
    handleSetAsIntended,

    imgShowWord: imgComp.imgShowWord,
    imgShowStepNumbers: imgComp.imgShowStepNumbers,
    imgShowStartPos: imgComp.imgShowStartPos,
    imgShowDifficulty: imgComp.imgShowDifficulty,
    imgShowCreatorName: imgComp.imgShowCreatorName,
    imgShowNotes: imgComp.imgShowNotes,
    imgShowBirthday: imgComp.imgShowBirthday,
    imgDarkMode: imgComp.imgDarkMode,
    imgColumnCount: imgComp.imgColumnCount,

    // Sync
    isSyncToggling,
    isSyncActive: lanSyncState.isActive,
    isSyncConnected: lanSyncState.isConnected,

    // Canvas state
    canvasReady: (viewer3DState.renderMode === '3d' ? !!viewer3DState.webglCanvas : !!exportCoord.animationCanvas) && !!playbackControllerRef,

    // Render progress
    onRenderProgress: handleRenderProgress,

    // 3D render mode
    renderMode: viewer3DState.renderMode,
    viewer3DState,

    // 3D recording UI state
    countdownValue: exportCoord.countdownValue,
    isRecording3D: exportCoord.isRecording3D,
    recordingElapsed: exportCoord.recordingElapsed,
    handleStopRecording: () => exportCoord.handleStopRecording(),

    // Auth (?guest=1 overrides to unauthenticated view for debugging shared link UX)
    isLoggedIn: forceGuest ? false : authState.isAuthenticated,
    userName: authState.user?.displayName || "",
    isOwned,
    isSaved,
    isPublished,
    isFavorite,
    handleFavoriteToggle,
    handlePublishAction,
    handleUnpublishAction,

    // Playback mode
    playbackMode: modalAnimationState.playbackMode,
    handlePlaybackModeChange: playback.handlePlaybackModeChange,

    // Handlers
    handlePlaybackToggle: playback.handlePlaybackToggle,
    handleProgressBarSeek: playback.handleProgressBarSeek,
    handleProgressBarScrubStart: playback.handleProgressBarScrubStart,
    handleProgressBarScrubEnd: playback.handleProgressBarScrubEnd,
    handleBpmChange: playback.handleBpmChange,
    handleStepClick: (stepIndex: number) => playback.handleStepClick(stepIndex, blockClicks, editingPane),
    enterEditMode,
    exitEditMode,
    enterFullscreen,
    exitFullscreen,
    handleFullscreenTap,
    handleExport,
    handleCanvasReady: exportCoord.handleCanvasReady,
    handleSyncToggle,
    handleOpenInCompose,
    handleEdit,
    handleSave,
    handleVideoUpload,
    handleShare,
    handleDelete,
    handleOpenInBrowser,
    invokeGatedAction: (type: PendingActionType, realHandler: (() => void) | (() => Promise<void>) | undefined) =>
      authQueue.invokeGatedAction(type, realHandler, sequence),
    handleUnifiedDarkModeToggle,
    handlePracticeStart: () => playback.handlePracticeStart(sequence),
    handlePracticeStop: () => playback.handlePracticeStop(sequence),
    onBack: handleBackInternal,
    stepHalfBeatBackward: playback.stepHalfBeatBackward,
    stepHalfBeatForward: playback.stepHalfBeatForward,
    stepFullBeatBackward: playback.stepFullBeatBackward,
    stepFullBeatForward: playback.stepFullBeatForward,
    restartToStart: playback.restartToStart,
    handleCancelExport: exportCoord.handleCancelExport,
    handleRetryExport: () => exportCoord.handleRetryExport(handleExport),
    dismissPreview: exportCoord.dismissPreview,

    // Pre-assembled prop groups for ViewerSplitPane
    splitPanePlayback: {
      animationState: modalAnimationState,
      animationLoading,
      currentStep: playback.currentStepLocal,
      isPlaying: playback.isPlayingLocal,
      currentLetter,
      currentStepData,
      highlightedStepIndex,
    },
    splitPaneImageComposition: {
      showWord: imgComp.imgShowWord,
      showStepNumbers: imgComp.imgShowStepNumbers,
      showDifficulty: isHandPath ? false : imgComp.imgShowDifficulty,
      showStartPos: imgComp.imgShowStartPos,
      showCreatorName: imgComp.imgShowCreatorName,
      showNotes: imgComp.imgShowNotes,
      showBirthday: imgComp.imgShowBirthday,
      showQRCode: imgComp.imgShowQRCode,
      showMandala: imgComp.imgShowMandala,
      showLoopGlyph: !isHandPath && imgComp.imgShowLoopGlyph,
      darkMode: imgComp.imgDarkMode,
      columnCount: imgComp.imgColumnCount,
      forceContain: false,
      userName: authState.user?.displayName || "",
    },
    splitPanePropRendering: {
      bluePropType: activeBlueProp,
      redPropType: activeRedProp,
      catDogModeEnabled: activeCatDog,
    },

    // Motion visibility
    viewerVisibility,
  });
</script>

<!-- Render children with full context -->
{@render children(context)}


<!-- Screen reader announcements -->
<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
  {accessibilityHelper.announcement}
</div>

<!-- Pending-action sign-in sheet. Appears when a guest taps a gated action
     or arrives with a ?pending= URL param after a browser handoff. -->
<SignInSheet
  open={authQueue.signInSheetOpen}
  reason={authQueue.signInSheetReason}
  webviewMode={authQueue.isInAppWebview}
  onPrimaryAction={() => authQueue.onSignInSheetPrimary(handleOpenInBrowser)}
  onDismiss={() => authQueue.closeSignInSheet()}
/>

<!-- Loads the Google Identity Services script and registers the FedCM
     credential callback. The sheet's primary button invokes `prompt()` on
     this to show Google's native One Tap card - the only sign-in flow that
     works reliably on mobile web. autoPrompt is false so it doesn't appear
     unprompted; we trigger it on user click. -->
<GoogleOneTap autoPrompt={false} />

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

</style>
