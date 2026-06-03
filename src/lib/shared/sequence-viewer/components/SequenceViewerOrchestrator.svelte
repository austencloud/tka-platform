<script lang="ts" module>
import { getAnimationPlaybackController } from "$lib/shared/animation-engine/get-animation-playback-controller";
import { getSequenceAnimationOrchestrator } from "$lib/shared/animation-engine/get-sequence-animation-orchestrator";
import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
// propInterpolator and sequenceConverter are now module-level functions injected directly
import { getLanSyncCoordinator } from "$lib/shared/lan-sync/get-lan-sync-coordinator";
import { hydrateSequence as hydrateSequenceData } from "$lib/shared/sequence-viewer/services/sequence-data-provider";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { StepMap } from "$lib/shared/video-collaboration/domain/collaborative-video";
  import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import type { Letter } from "$lib/shared/foundation/domain/models/letter";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { VideoExportProgress } from "$lib/shared/compose/domain/video-export-types";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type {
    ViewerPlaybackState, ImageCompositionProps, PropRenderingProps, } from "../domain/viewer-prop-groups";
  import type { ResolvedPresentation, ViewingContext } from "../services/presentation-resolver";
  export type ViewMode = "animation" | "image" | "split";
  export type ExportType = "animation" | "image" | "both";
  export type PlaybackSource = "animation" | "video";

  export interface OrchestratorContext {
    sequence: SequenceData | null;
    effectiveSequence: SequenceData | null;
    hasSequence: boolean;

    isPlayingLocal: boolean;
    currentStepLocal: number;
    bpmLocal: number;
    currentLetter: Letter | null;
    currentStepData: StartPositionData | StepData | null;
    highlightedStepIndex: number | null;
    animationLoading: boolean;

    playbackSource: PlaybackSource;
    videoPlaybackBeatIndex: number | null;
    activeStepMap: StepMap | null;
    setPlaybackSource: (source: PlaybackSource) => void;
    setActiveStepMap: (beatMap: StepMap | null) => void;
    onVideoTimeUpdate: (currentTime: number) => void;
    modalAnimationState: AnimationPanelState;

    viewMode: ViewMode;
    isMobile: boolean;
    isFullscreen: boolean;
    fullscreenControlsVisible: boolean;
    fullscreenStackVertical: boolean;
    editingPane: 'animation' | 'image' | 'video-upload' | null;

    isExportMode: boolean;
    exportType: ExportType | null;
    exportOptions: ReturnType<typeof import("$lib/shared/animation-panel/state/export-options-state.svelte").getExportOptionsState>;
    isExporting: boolean;
    exportProgress: VideoExportProgress | null;
    exportError: string | null;
    previewBlobUrl: string | null;
    singlePlayDuration: number;

    practiceActive: boolean;
    practiceState: ReturnType<typeof import("$lib/shared/sequence-viewer/state/tempo-practice-state.svelte").createTempoPracticeState>;

    bluePropType: PropType | undefined;
    redPropType: PropType | undefined;
    catDogModeEnabled: boolean | undefined;

    presentation: ResolvedPresentation | null;
    togglePropContext: () => void;
    activeContext: ViewingContext;

    handleSetAsIntended: () => Promise<void>;
    handlePropTypeChange: (propType: PropType) => void;

    imgShowWord: boolean;
    imgShowStartPos: boolean;
    imgShowDifficulty: boolean;
    imgShowCreatorName: boolean;
    imgShowStepNumbers: boolean;
    imgShowNotes: boolean;
    imgShowBirthday: boolean;
    imgDarkMode: boolean;
    imgColumnCount: number | null;

    isSyncToggling: boolean;
    isSyncActive: boolean;
    isSyncConnected: boolean;

    canvasReady: boolean;

    onRenderProgress: (loaded: number, total: number) => void;

    isLoggedIn: boolean;
    userName: string;
    isOwned: boolean;
    isSaved: boolean;
    isPublished: boolean;
    isFavorite: boolean;
    handleFavoriteToggle: () => void;
    handlePublishAction: () => Promise<void>;
    handleUnpublishAction: () => Promise<void>;

    playbackMode: import("$lib/shared/animation-engine/state/animation-panel-state.svelte").PlaybackMode;
    handlePlaybackModeChange: (mode: import("$lib/shared/animation-engine/state/animation-panel-state.svelte").PlaybackMode) => void;

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
    invokeGatedAction: (type: PendingActionType, realHandler: (() => void) | (() => Promise<void>) | undefined) => void;
    handleUnifiedDarkModeToggle: () => void;
    handlePracticeStart: () => void;
    handlePracticeStop: () => void;
    onClose: () => void;
    stepHalfBeatBackward: () => void;
    stepHalfBeatForward: () => void;
    stepFullBeatBackward: () => void;
    stepFullBeatForward: () => void;
    restartToStart: () => void;
    handleCancelExport: () => void;
    handleRetryExport: () => void;
    dismissPreview: () => void;

    /** The live playback controller (null until animation services load).
     *  Exposed so lightweight hosts (QR landing page) can drive their own
     *  video export off the same controller the canvas is using. */
    playbackController: AnimationPlaybackController | null;

    splitPanePlayback: ViewerPlaybackState;
    splitPaneImageComposition: ImageCompositionProps;
    splitPanePropRendering: PropRenderingProps;

    renderMode: '2d' | '3d';
    viewer3DState: ReturnType<typeof import("$lib/shared/3d/state/viewer-3d-state.svelte").createViewer3DState>;

    countdownValue: number;
    isRecording3D: boolean;
    recordingElapsed: number;
    handleStopRecording: () => void;

    viewerState: ReturnType<typeof import("../state/viewer-state.svelte").createViewerState>;
    viewerVisibility: SequenceViewerVisibilityState;
  }
</script>

<script lang="ts">
  import { onMount, onDestroy, untrack, type Snippet } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { generateViewerURL, encodePropForURL } from "$lib/shared/navigation/services/sequence-encoder";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
  import type { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { setAnimationPlaybackRef } from "$lib/shared/coordinators/animation-playback-ref.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import { setScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { getSettings, updateSettings } from "$lib/shared/application/state/app-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { calculateThumbnailAspectRatio } from "$lib/shared/render/services/layout-calculator";
  import { loadViewMode } from "$lib/shared/sequence-viewer/services/sequence-modal-persistence";
  import { cellPreWarmer } from "$lib/shared/sequence-viewer/services/cell-pre-warmer";
  import { createModalAccessibilityHelper } from "$lib/shared/sequence-viewer/services/modal-accessibility-helper.svelte";
  import { saveSequenceHandoff } from "$lib/shared/coordinators/sequence-handoff.svelte";
  import type { ShareURLMetadata } from "$lib/shared/navigation/services/types";
  import { getHighlightedBeatFromVideo } from "$lib/shared/video-collaboration/utils/step-map-utils";
  import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { SequenceViewerVisibilityState } from "../state/viewer-visibility-state.svelte";
  import { setViewerVisibilityContext } from "../context/viewer-visibility-context";
  import type { PendingActionType } from "$lib/shared/sequence-viewer/services/pending-action-queue";
  import SignInSheet from "./SignInSheet.svelte";
  import GoogleOneTap from "$lib/shared/auth/components/GoogleOneTap.svelte";

  import { createPlaybackController } from "./playback-controller.svelte";
  import { createExportCoordinator } from "./export-coordinator.svelte";
  import { createPropContextResolver } from "./prop-context-resolver.svelte";
  import { createImageCompositionSync } from "./image-composition-sync.svelte";
  import { createAuthActionQueue } from "./auth-action-queue.svelte";
  import { createFullscreenController } from "../state/fullscreen-controller.svelte";
  import { createLibraryActionHandler } from "../state/library-action-handler.svelte";
  import { createViewerState } from "../state/viewer-state.svelte";

  interface Props {
    sequence: SequenceData | null;
    isMobile: boolean;
    initialBpm?: number;
    initialStep?: number;
    initialViewMode?: ViewMode;
    onClose: () => void;
    onUrlParamChange?: (key: string, value: string) => void;
    blockClicks?: boolean;
    viewingContext?: ViewingContext;
    handPathMode?: boolean;
    forceGuest?: boolean;
    initialRenderMode?: '2d' | '3d';
    initialBlueVisible?: boolean;
    initialRedVisible?: boolean;
    /** Effect to activate on mount (e.g. "trails" for the QR scan landing page).
     *  Defaults to the stored/none config when omitted. */
    initialActiveEffect?: string;
    children: Snippet<[OrchestratorContext]>;
  }

  let {
    sequence,
    isMobile,
    initialBpm = 60,
    initialStep = 0,
    initialViewMode,
    onClose,
    onUrlParamChange,
    blockClicks = false,
    viewingContext = "notation",
    handPathMode = false,
    forceGuest = false,
    initialRenderMode,
    initialBlueVisible = true,
    initialRedVisible = true,
    initialActiveEffect,
    children,
  }: Props = $props();

  const modalAnimationState = createAnimationPanelState();
  let animationServicesReady = $state(false);
  let animationLoading = $state(false);
  let lastLoadedSequenceId: string | null = null;

  let playbackControllerRef = $state<AnimationPlaybackController | null>(null);
  let hapticService: HapticFeedback | null = null;

  const playback = createPlaybackController({ modalAnimationState, initialBpm: 60, initialStep: 0 });

  $effect.pre(() => { playback.currentStepLocal = initialStep; playback.bpmLocal = initialBpm; });

  const viewer3DState = createViewer3DState();
  setViewer3DContext(viewer3DState);

  const accessibilityHelper = createModalAccessibilityHelper();

  const exportCoord = createExportCoordinator({ viewer3DState, accessibilityHelper });

  const propContext = createPropContextResolver({});

  const imgComp = createImageCompositionSync();

  const authQueue = createAuthActionQueue();

  exportCoord.setExitEditModeCallback(() => exitEditMode());

  $effect(() => {
    playback.setOnUrlParamChange(onUrlParamChange);
  });

  let viewMode = $state<ViewMode>(loadViewMode());
  $effect.pre(() => { if (initialViewMode) viewMode = initialViewMode; });

  const fullscreen = createFullscreenController({
    getHapticService: () => hapticService,
    announce: (msg, priority) => accessibilityHelper.announce(msg, priority),
  });

  const viewerState = createViewerState();

  if (viewer3DState.renderMode === '3d' && !viewerState.wants3D) {
    viewerState.setSplitPaneContent('left', 'animation-3d');
  }

  const editingPane = $derived.by((): 'animation' | 'image' | 'video-upload' | null => {
    const { viewerMode, exportContext } = viewerState;
    if (exportContext === 'animation-export') return 'animation';
    if (exportContext === 'image-export') return 'image';
    if (viewerMode === 'videos') return 'video-upload';
    return null;
  });

  let playbackSource = $state<PlaybackSource>("animation");
  let videoPlaybackBeatIndex = $state<number | null>(null);
  let activeStepMap = $state<StepMap | null>(null);

  const isExportMode = $derived(editingPane !== null);
  const exportType = $derived<ExportType | null>(
    editingPane === 'animation' ? 'animation' : editingPane === 'image' ? 'image' : null
  );

  let cellsLoaded = $state(0);
  let totalCells = $state(0);

  function handleRenderProgress(loaded: number, total: number) {
    cellsLoaded = loaded;
    totalCells = total;
  }

  let isSyncToggling = $state(false);

  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType);
  const redPropType = $derived(settings.redPropType);
  const catDogModeEnabled = $derived(settings.catDogMode);

  const viewerVisibility = new SequenceViewerVisibilityState();
  setViewerVisibilityContext(viewerVisibility);

  $effect(() => {
    void sequence?.id;
    viewerVisibility.reset();
    untrack(() => {
      if (!initialBlueVisible) viewerVisibility.setBlueMotion(false);
      if (!initialRedVisible) viewerVisibility.setRedMotion(false);
    });
  });

  const effectsConfigState = createEffectsConfigState();
  setEffectsConfigContext(effectsConfigState);
  // Activate a requested effect on mount (QR scan page asks for "trails").
  // setActiveEffect keeps tipEffectMap in sync so the renderer doesn't filter tips.
  if (initialActiveEffect) effectsConfigState.setActiveEffect(initialActiveEffect);

  const scene3DRenderState = createScene3DRenderState();
  setScene3DRenderContext(scene3DRenderState);

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

  const isHandPath = $derived(handPathMode || Boolean(sequence?.metadata?.isHandPathVisualization));
  const activeBlueProp = $derived(isHandPath ? PropType.HAND : presentation.bluePropType);
  const activeRedProp = $derived(isHandPath ? PropType.HAND : presentation.redPropType);
  const activeCatDog = $derived(isHandPath ? false : presentation.catDogMode);

  function togglePropContext() {
    propContext.togglePropContext(activeContext);
  }

  $effect(() => {
    const blue = activeBlueProp;
    const red = activeRedProp;
    propContext.syncPropsToOrchestrator(blue, red, animationServicesReady);
  });

  const effectiveSequence = $derived(modalAnimationState.sequenceData ?? sequence);
  const hasSequence = $derived(effectiveSequence !== null);

  const singlePlayDuration = $derived.by(() => {
    const steps = effectiveSequence?.steps;
    if (!steps?.length || playback.bpmLocal <= 0) return 0;
    const totalDurationUnits = steps.reduce((sum, s) => sum + (s.duration ?? 1), 0);
    const speed = playback.bpmLocal / 60;
    return totalDurationUnits / speed;
  });

  const isOwned = $derived(
    !!sequence?.ownerId &&
    !!authState.user?.uid &&
    sequence.ownerId === authState.user.uid
  );

  const libraryActions = createLibraryActionHandler({
    getSequence: () => sequence,
    getIsOwned: () => isOwned,
    getBluePropType: () => bluePropType,
    getRedPropType: () => redPropType,
    getCatDogModeEnabled: () => catDogModeEnabled,
    getHapticService: () => hapticService,
    onDeleteSuccess: () => handleClose(),
  });

  const isPublished = $derived((sequence as LibrarySequence | null)?.visibility === "public");

  $effect(() => { libraryActions.syncSavedState(sequence); });
  $effect(() => { libraryActions.syncFavoriteState(sequence); });

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
    return calculateThumbnailAspectRatio(stepCount, {
      includeStartPosition: imgComp.imgShowStartPos,
      hasHeader: imgComp.imgShowWord,
      hasFooter: imgComp.imgShowCreatorName || imgComp.imgShowNotes,
    });
  });

  const fullscreenStackVertical = $derived(previewAspectRatio > 1.3);

  let keydownCleanup: (() => void) | null = null;
  let imageCompositionCleanup: (() => void) | null = null;

  onMount(() => {
    authQueue.bootstrapFromUrl();

    window.addEventListener("keydown", handleKeydown, { capture: true });
    keydownCleanup = () => window.removeEventListener("keydown", handleKeydown, { capture: true });

    imageCompositionCleanup = imgComp.registerObserver();

    playback.registerVisibilityObserver();

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
    fullscreen.clearControlsTimeout();
  });

  $effect(() => {
    if (sequence && animationServicesReady && playbackControllerRef) {
      initializeAnimation(sequence);
    }
  });

  $effect(() => {
    const savedPathShape = sequence?.metadata?.pathShape;
    if (savedPathShape === "arc" || savedPathShape === "linear") {
      getAnimationVisibilityManager().setPathShape(savedPathShape);
    }
  });

  $effect(() => {
    if (viewer3DState.renderMode === '3d') {
      onUrlParamChange?.('render', '3d');
    } else {
      onUrlParamChange?.('render', '');
    }
  });

  $effect(() => {
    if (!sequence) return;
    if (!viewer3DState.webgl2Available) return;

    const shouldBe3D = viewerState.wants3D || initialRenderMode === '3d';
    const is3D = viewer3DState.renderMode === '3d';

    const performersReady = viewer3DState.performerManager.performers.length > 0;

    if (shouldBe3D && (!is3D || !performersReady)) {
      viewer3DState.enter3D(sequence);
    } else if (!shouldBe3D && is3D) {
      viewer3DState.exit3D();
    }
  });

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

  $effect(() => {
    authQueue.replayPendingAction({
      handleSave: libraryActions.handleSave,
      handleFavoriteToggle: libraryActions.handleFavoriteToggle,
      handlePublishAction: libraryActions.handlePublishAction,
      handleEdit,
      handleShare,
      handleOpenInBrowser,
    });
  });

  async function loadServices() {
    try {
      playbackControllerRef = getAnimationPlaybackController();
      hapticService = getHapticFeedback();

      playback.setPlaybackController(playbackControllerRef);
      playback.setHapticService(hapticService);
      playback.setAnimationVisible(() => viewerState.viewerMode !== 'card');

      const lanSyncCoordinator = getLanSyncCoordinator();
      lanSyncState.initialize(lanSyncCoordinator);

      animationServicesReady = true;
    } catch (error) {
      console.error("[SequenceViewerOrchestrator] Failed to load services:", error);
      modalAnimationState.setError("Failed to load animation services");
    }
  }

  async function initializeAnimation(seq: SequenceData) {
    if (!playbackControllerRef) return;

    const seqId = seq.id || seq.word || "unknown";
    if (seqId === lastLoadedSequenceId) return;

    animationLoading = true;
    modalAnimationState.setLoading(true);
    modalAnimationState.setError(null);

    try {
      const loadedSequence = await hydrateSequenceData(seq);
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

  let playbackRestoreOnExit = false;

  function enterEditMode(pane: 'animation' | 'image' | 'video-upload') {
    hapticService?.trigger("selection");

    if (pane === 'animation') {
      const leftContent = viewerState.splitConfig.leftPane;
      const contentType = leftContent === 'animation-3d' ? 'animation-3d' as const : 'animation' as const;
      viewerState.enterExport('animation-export', contentType);
      if (!playback.isPlayingLocal && playbackControllerRef) {
        playbackControllerRef.togglePlayback();
      }
      playbackRestoreOnExit = false;
    } else if (pane === 'image') {
      playbackRestoreOnExit = playback.isPlayingLocal;
      if (playback.isPlayingLocal && playbackControllerRef) {
        playbackControllerRef.togglePlayback();
      }
      viewerState.enterExport('image-export');
    } else if (pane === 'video-upload') {
      playbackRestoreOnExit = playback.isPlayingLocal;
      if (playback.isPlayingLocal && playbackControllerRef) {
        playbackControllerRef.togglePlayback();
      }
      viewerState.setViewerMode('videos');
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
    viewerState.exitExport();
    exportCoord.dismissPreview();

    if (playbackRestoreOnExit && !playback.isPlayingLocal && playbackControllerRef) {
      playbackControllerRef.togglePlayback();
    }
    playbackRestoreOnExit = false;

    accessibilityHelper.announce("Export closed");
  }

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

    handleClose();

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
    handleClose();

    showToast({ message: "Opening for editing...", type: "info", duration: 2000 });
    void handleModuleChange("create", "construct");
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

  function handleShare() {
    hapticService?.trigger("selection");

    let shareUrl = browser ? window.location.href : "";

    if (sequence) {
      try {
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

        const result = generateViewerURL(sequence, {
          compress: true,
          metadata,
        });
        shareUrl = result.url;
      } catch {
        // ignore
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
    getAnimationVisibilityManager().setDarkMode(newValue);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (fullscreen.isFullscreen) {
        fullscreen.exitFullscreen();
      } else {
        handleClose();
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

  function handleClose() {
    playback.stopPracticeIfActive();

    if (playback.isPlayingLocal && playbackControllerRef) {
      playbackControllerRef.togglePlayback();
    }
    setAnimationPlaybackRef(null);

    if (lanSyncState.isConnected) {
      lanSyncState.disconnect();
    }

    accessibilityHelper.restoreFocus();
    onClose();
  }

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

  const context: OrchestratorContext = $derived({
    sequence,
    effectiveSequence,
    hasSequence,

    isPlayingLocal: playback.isPlayingLocal,
    currentStepLocal: playback.currentStepLocal,
    bpmLocal: playback.bpmLocal,
    currentLetter,
    currentStepData,
    highlightedStepIndex,
    animationLoading,
    modalAnimationState,

    playbackSource,
    videoPlaybackBeatIndex,
    activeStepMap,
    setPlaybackSource,
    setActiveStepMap,
    onVideoTimeUpdate: handleVideoTimeUpdate,

    viewMode,
    isMobile,
    isFullscreen: fullscreen.isFullscreen,
    fullscreenControlsVisible: fullscreen.fullscreenControlsVisible,
    fullscreenStackVertical,
    editingPane,

    isExportMode,
    exportType,
    exportOptions: exportCoord.exportOptions,
    isExporting: exportCoord.isExporting,
    exportProgress: exportCoord.exportProgress,
    exportError: exportCoord.exportError,
    previewBlobUrl: exportCoord.previewBlobUrl,
    singlePlayDuration,

    practiceActive: playback.practiceActive,
    practiceState: playback.practiceState,

    bluePropType: activeBlueProp,
    redPropType: activeRedProp,
    catDogModeEnabled: activeCatDog,

    presentation: presentation ?? null,
    togglePropContext,
    activeContext,

    handleSetAsIntended,
    handlePropTypeChange: (propType: PropType) => {
      updateSettings({ bluePropType: propType, redPropType: propType });
      propContext.syncPropsToOrchestrator(propType, propType, animationServicesReady);
      const encoded = encodePropForURL(propType);
      onUrlParamChange?.("bp", encoded);
      onUrlParamChange?.("rp", encoded);
    },

    imgShowWord: imgComp.imgShowWord,
    imgShowStepNumbers: imgComp.imgShowStepNumbers,
    imgShowStartPos: imgComp.imgShowStartPos,
    imgShowDifficulty: imgComp.imgShowDifficulty,
    imgShowCreatorName: imgComp.imgShowCreatorName,
    imgShowNotes: imgComp.imgShowNotes,
    imgShowBirthday: imgComp.imgShowBirthday,
    imgDarkMode: imgComp.imgDarkMode,
    imgColumnCount: exportCoord.exportOptions.imageColumnCount,

    isSyncToggling,
    isSyncActive: lanSyncState.isActive,
    isSyncConnected: lanSyncState.isConnected,

    canvasReady: (viewer3DState.renderMode === '3d' ? !!viewer3DState.webglCanvas : !!exportCoord.animationCanvas) && !!playbackControllerRef,

    onRenderProgress: handleRenderProgress,

    renderMode: viewer3DState.renderMode,
    viewer3DState,

    countdownValue: exportCoord.countdownValue,
    isRecording3D: exportCoord.isRecording3D,
    recordingElapsed: exportCoord.recordingElapsed,
    handleStopRecording: () => exportCoord.handleStopRecording(),

    isLoggedIn: forceGuest ? false : authState.isAuthenticated,
    userName: authState.user?.displayName || "",
    isOwned,
    isSaved: libraryActions.isSaved,
    isPublished,
    isFavorite: libraryActions.isFavorite,
    handleFavoriteToggle: libraryActions.handleFavoriteToggle,
    handlePublishAction: libraryActions.handlePublishAction,
    handleUnpublishAction: libraryActions.handleUnpublishAction,

    playbackMode: modalAnimationState.playbackMode,
    handlePlaybackModeChange: playback.handlePlaybackModeChange,

    handlePlaybackToggle: playback.handlePlaybackToggle,
    handleProgressBarSeek: playback.handleProgressBarSeek,
    handleProgressBarScrubStart: playback.handleProgressBarScrubStart,
    handleProgressBarScrubEnd: playback.handleProgressBarScrubEnd,
    handleBpmChange: playback.handleBpmChange,
    handleStepClick: (stepIndex: number) => playback.handleStepClick(stepIndex, blockClicks, editingPane),
    enterEditMode,
    exitEditMode,
    enterFullscreen: fullscreen.enterFullscreen,
    exitFullscreen: fullscreen.exitFullscreen,
    handleFullscreenTap: fullscreen.handleFullscreenTap,
    handleExport,
    handleCanvasReady: exportCoord.handleCanvasReady,
    handleSyncToggle,
    handleOpenInCompose,
    handleEdit,
    handleSave: libraryActions.handleSave,
    handleVideoUpload,
    handleShare,
    handleDelete: libraryActions.handleDelete,
    handleOpenInBrowser,
    invokeGatedAction: (type: PendingActionType, realHandler: (() => void) | (() => Promise<void>) | undefined) =>
      authQueue.invokeGatedAction(type, realHandler, sequence),
    handleUnifiedDarkModeToggle,
    handlePracticeStart: () => playback.handlePracticeStart(sequence),
    handlePracticeStop: () => playback.handlePracticeStop(sequence),
    onClose: handleClose,
    stepHalfBeatBackward: playback.stepHalfBeatBackward,
    stepHalfBeatForward: playback.stepHalfBeatForward,
    stepFullBeatBackward: playback.stepFullBeatBackward,
    stepFullBeatForward: playback.stepFullBeatForward,
    restartToStart: playback.restartToStart,
    handleCancelExport: exportCoord.handleCancelExport,
    handleRetryExport: () => exportCoord.handleRetryExport(handleExport),
    dismissPreview: exportCoord.dismissPreview,

    playbackController: playbackControllerRef,

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
      handPathMode: isHandPath,
      darkMode: imgComp.imgDarkMode,
      columnCount: exportCoord.exportOptions.imageColumnCount,
      forceContain: false,
      userName: authState.user?.displayName || "",
    },
    splitPanePropRendering: {
      bluePropType: activeBlueProp,
      redPropType: activeRedProp,
      catDogModeEnabled: activeCatDog,
    },

    viewerState,
    viewerVisibility,
  });
</script>

{@render children(context)}

<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
  {accessibilityHelper.announcement}
</div>

<SignInSheet
  open={authQueue.signInSheetOpen}
  reason={authQueue.signInSheetReason}
  webviewMode={authQueue.isInAppWebview}
  onPrimaryAction={() => authQueue.onSignInSheetPrimary(handleOpenInBrowser)}
  onDismiss={() => authQueue.closeSignInSheet()}
/>

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
