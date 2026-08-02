<script lang="ts" module>
  import { getAnimationPlaybackController } from "$lib/shared/animation-engine/get-animation-playback-controller";
  import { getSequenceAnimationOrchestrator } from "$lib/shared/animation-engine/get-sequence-animation-orchestrator";
  // propInterpolator and sequenceConverter are now module-level functions injected directly
  import { getLanSyncCoordinator } from "$lib/shared/lan-sync/get-lan-sync-coordinator";
  import { hydrateSequence as hydrateSequenceData } from "$lib/shared/sequence-viewer/services/sequence-data-provider";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { getSequenceMotionVisibility } from "$lib/shared/foundation/services/sequence-motion-profile";
  import type { StepMap } from "$lib/shared/video-collaboration/domain/collaborative-video";
  import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import type { Letter } from "$lib/shared/foundation/domain/models/letter";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { VideoExportProgress } from "$lib/shared/compose/domain/video-export-types";
  import type { TempoPracticeConfig } from "../services/tempo-practice-orchestrator";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type {
    ViewerPlaybackState,
    ImageCompositionProps,
    PropRenderingProps,
  } from "../domain/viewer-prop-groups";
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
    cardReady: boolean;
    ensureInteractiveServices: () => void;

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
    editingPane: "animation" | "image" | "video-upload" | null;

    isExportMode: boolean;
    exportType: ExportType | null;
    exportOptions: ReturnType<
      typeof import("$lib/shared/animation-panel/state/export-options-state.svelte").getExportOptionsState
    >;
    isExporting: boolean;
    exportProgress: VideoExportProgress | null;
    exportError: string | null;
    previewBlobUrl: string | null;
    singlePlayDuration: number;

    practiceActive: boolean;
    practiceRunning: boolean;
    practiceCountdown: number;
    practiceState: ReturnType<
      typeof import("$lib/shared/sequence-viewer/state/tempo-practice-state.svelte").createTempoPracticeState
    >;
    practiceViewPrefs: import("$lib/shared/sequence-viewer/state/practice-view-prefs.svelte").PracticeViewPrefs;
    metronomeEnabled: boolean;
    handleToggleMetronome: () => void;
    mirrorEnabled: boolean;
    handleToggleMirror: () => void;

    bluePropType: PropType | undefined;
    redPropType: PropType | undefined;
    catDogModeEnabled: boolean | undefined;

    handlePropTypeChange: (propType: PropType) => void;

    imgShowWord: boolean;
    imgShowStartPos: boolean;
    imgShowDifficulty: boolean;
    imgShowStepNumbers: boolean;
    imgShowNotes: boolean;
    imgDarkMode: boolean;

    isSyncToggling: boolean;
    isSyncActive: boolean;
    isSyncConnected: boolean;

    canvasReady: boolean;

    onRenderProgress: (loaded: number, total: number) => void;

    isLoggedIn: boolean;
    isOwned: boolean;
    isSaved: boolean;
    isPublished: boolean;
    isFavorite: boolean;
    handleFavoriteToggle: () => void;
    handlePublishAction: () => Promise<void>;
    handleUnpublishAction: () => Promise<void>;

    playbackMode: import("$lib/shared/animation-engine/state/animation-panel-state.svelte").PlaybackMode;
    handlePlaybackModeChange: (
      mode: import("$lib/shared/animation-engine/state/animation-panel-state.svelte").PlaybackMode
    ) => void;

    handlePlaybackToggle: () => void;
    handleBpmChange: (bpm: number) => void;
    handleStepClick: (stepIndex: number) => void;
    handleProgressBarSeek: (targetStep: number) => void;
    handleProgressBarScrubStart: () => void;
    handleProgressBarScrubEnd: () => void;
    enterEditMode: (pane: "animation" | "image" | "video-upload") => void;
    exitEditMode: () => void;
    enterFullscreen: () => void;
    immersive: boolean;
    toggleImmersive: (host: HTMLElement | null) => Promise<void> | void;
    exitFullscreen: () => void;
    handleFullscreenTap: () => void;
    handleExport: () => Promise<void>;
    /** Measured Auto geometry from the active Download Card preview. */
    resolvedCardAutoLayout:
      | import("$lib/shared/render/services/container-aware-layout").ResolvedAutoLayout
      | null;
    setResolvedCardAutoLayout: (
      layout:
        | import("$lib/shared/render/services/container-aware-layout").ResolvedAutoLayout
        | null
    ) => void;
    handleCanvasReady: (canvas: HTMLCanvasElement | null) => void;
    handleSyncToggle: () => Promise<void>;
    handleOpenInCompose: (
      preset?: "stagger" | "mirror" | "combo-export"
    ) => Promise<void>;
    handleEdit: () => void;
    handleSave: () => void;
    handleVideoUpload: () => Promise<void>;
    handleShare: () => void;
    handleCopyLink: () => Promise<boolean>;
    handleDelete: () => Promise<void>;
    handleOpenInBrowser: (pendingType?: PendingActionType | null) => void;
    invokeGatedAction: (
      type: PendingActionType,
      realHandler: (() => void) | (() => Promise<void>) | undefined
    ) => void;
    /** Open the sign-in sheet with no queued action (the /q header account chip). */
    openSignInPrompt: () => void;
    handleUnifiedDarkModeToggle: () => void;
    handlePracticeStart: () => void;
    enterPracticeMode: () => void;
    exitPracticeMode: () => void;
    handlePracticeStepLevel: (dir: 1 | -1) => void;
    handlePracticeToggleHold: () => void;
    handlePracticeSetConfig: (patch: Partial<TempoPracticeConfig>) => void;
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
    /** Save/share the finished export video on a fresh user gesture (download on
     *  desktop, share sheet on mobile). Backs the preview's Save button + the
     *  "Video ready" toast action. */
    saveExportedVideo: () => Promise<void>;

    /** The live playback controller (null until animation services load).
     *  Exposed so lightweight hosts (QR landing page) can drive their own
     *  video export off the same controller the canvas is using. */
    playbackController: AnimationPlaybackController | null;

    /** Art-mode export entry threaded into ViewerSplitPane -> ArtPane. Tunnel
     *  routes through the shared video orchestrator with per-step kaleidoscope
     *  layers + chrome suppressed; mandala drives its OWN export worker. */
    handleArtExport: (args: {
      artType: "mandala" | "tunnel";
      controller: import("../tunnel/tunnel-view-controller.svelte").TunnelViewController;
      mandalaController: import("../state/mandala-viewer-controller.svelte").MandalaViewerController;
    }) => void;

    splitPanePlayback: ViewerPlaybackState;
    splitPaneImageComposition: ImageCompositionProps;
    splitPanePropRendering: PropRenderingProps;

    renderMode: "2d" | "3d";
    viewer3DState: ReturnType<
      typeof import("$lib/shared/3d/state/viewer-3d-state.svelte").createViewer3DState
    >;

    countdownValue: number;
    isRecording3D: boolean;
    recordingElapsed: number;
    handleStopRecording: () => void;

    viewerState: ReturnType<
      typeof import("../state/viewer-state.svelte").createViewerState
    >;
    viewerVisibility: SequenceViewerVisibilityState;
  }
</script>

<script lang="ts">
  import { onMount, onDestroy, untrack, type Snippet } from "svelte";
  import { SCENE_BPM_INTENT_KEY } from "$lib/features/scene-3d-collection/services/open-3d-scene";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import {
    generateViewerURL,
    encodePropForURL,
  } from "$lib/shared/navigation/services/sequence-encoder";
  import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
  import type { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { setAnimationPlaybackRef } from "$lib/shared/coordinators/animation-playback-ref.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { EffectType } from "$lib/shared/effects/domain/effects-config";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import { setScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { logShareAction } from "$lib/shared/analytics/services/posthog-activity-logger";
  import {
    getSettings,
    updateSettings,
  } from "$lib/shared/application/state/app-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { calculateThumbnailAspectRatio } from "$lib/shared/render/services/layout-calculator";
  import { loadViewMode } from "$lib/shared/sequence-viewer/services/sequence-modal-persistence";
  import { cellPreWarmer } from "$lib/shared/sequence-viewer/services/cell-pre-warmer";
  import { getScanCardCloudProbe } from "$lib/shared/sequence-viewer/scan-card-cloud-context";
  import { isViewerReadyToAutoplay } from "$lib/shared/sequence-viewer/services/viewer-autoplay-readiness";
  import { shouldAutoplayViewer } from "$lib/shared/sequence-viewer/services/viewer-autoplay-policy";
  import { createModalAccessibilityHelper } from "$lib/shared/sequence-viewer/services/modal-accessibility-helper.svelte";
  import { saveSequenceHandoff } from "$lib/shared/coordinators/sequence-handoff.svelte";
  import type { ShareURLMetadata } from "$lib/shared/navigation/services/types";
  import { getHighlightedBeatFromVideo } from "$lib/shared/video-collaboration/utils/step-map-utils";
  import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { viewportFits3D } from "$lib/shared/3d/capabilities/viewport-3d-gate.svelte";
  import { SequenceViewerVisibilityState } from "../state/viewer-visibility-state.svelte";
  import { setViewerVisibilityContext } from "../context/viewer-visibility-context";
  import type { PendingActionType } from "$lib/shared/sequence-viewer/services/pending-action-queue";

  import type { TunnelViewController } from "../tunnel/tunnel-view-controller.svelte";
  import type { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";

  import { createPlaybackController } from "./playback-controller.svelte";
  import { createExportCoordinator } from "./export-coordinator.svelte";
  import { createImageCompositionSync } from "./image-composition-sync.svelte";
  import { createAuthActionQueue } from "./auth-action-queue.svelte";
  import { createFullscreenController } from "../state/fullscreen-controller.svelte";
  import { createLibraryActionHandler } from "../state/library-action-handler.svelte";
  import {
    createViewerState,
    type ViewerMode,
  } from "../state/viewer-state.svelte";
  import { createPracticeViewPrefs } from "$lib/shared/sequence-viewer/state/practice-view-prefs.svelte";

  interface Props {
    sequence: SequenceData | null;
    isMobile: boolean;
    initialBpm?: number;
    initialStep?: number;
    initialViewMode?: ViewMode;
    onClose: () => void;
    onUrlParamChange?: (key: string, value: string) => void;
    /** Reports tempo changes made through viewer controls. Internal practice
     *  ramp changes stay private so hosts can persist deliberate choices. */
    onBpmChange?: (bpm: number) => void;
    blockClicks?: boolean;
    handPathMode?: boolean;
    /** Force the animation surface and request playback after assets settle. */
    playOnOpen?: boolean;
    forceGuest?: boolean;
    initialRenderMode?: "2d" | "3d";
    /** Initial shared-shell surface. Scan uses card so animation work stays out
     *  of the first visible frame; other hosts retain persisted mode. */
    initialViewerMode?: ViewerMode;
    /** Hold animation/LAN services until the host promotes away from card. */
    deferInteractiveStartup?: boolean;
    /** Fires once the card has settled all of its cells. Progressive hosts use
     *  this to reveal the full viewer without exposing placeholder frames. */
    onCardReady?: () => void;
    initialBlueVisible?: boolean;
    initialRedVisible?: boolean;
    /** Effect to activate on mount (e.g. "trails" for the QR scan landing page).
     *  Defaults to the stored/none config when omitted. */
    initialActiveEffect?: EffectType;
    /** Replay handler for the gated download action (/q scan funnel): runs the
     *  page's export once the guest finishes signing in. Receives the live ctx
     *  because the export needs the playback controller + export options. */
    onGatedDownload?: (ctx: OrchestratorContext) => void;
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
    onBpmChange,
    blockClicks = false,
    handPathMode = false,
    playOnOpen = false,
    forceGuest = false,
    initialRenderMode,
    initialViewerMode,
    deferInteractiveStartup = false,
    onCardReady,
    initialBlueVisible,
    initialRedVisible,
    initialActiveEffect,
    onGatedDownload,
    children,
  }: Props = $props();

  const modalAnimationState = createAnimationPanelState();
  let animationServicesReady = $state(false);
  let animationLoading = $state(false);
  let lastLoadedSequenceId: string | null = null;

  let playbackControllerRef = $state<AnimationPlaybackController | null>(null);
  let hapticService: HapticFeedback | null = null;

  const playback = createPlaybackController({
    modalAnimationState,
    initialBpm: 60,
    initialStep: 0,
  });

  // One-shot tempo seed from "open saved 3D scene" (consumed at init so the
  // initialBpm effect below can't overwrite it afterwards).
  const _sceneBpmIntent: number | null = (() => {
    try {
      const raw = sessionStorage.getItem(SCENE_BPM_INTENT_KEY);
      if (raw === null) return null;
      sessionStorage.removeItem(SCENE_BPM_INTENT_KEY);
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  })();

  $effect.pre(() => {
    playback.currentStepLocal = initialStep;
    playback.bpmLocal = _sceneBpmIntent ?? initialBpm;
  });

  const viewer3DState = createViewer3DState();
  setViewer3DContext(viewer3DState);

  const accessibilityHelper = createModalAccessibilityHelper();

  const exportCoord = createExportCoordinator({
    viewer3DState,
    accessibilityHelper,
  });
  let resolvedCardAutoLayout = $state<
    | import("$lib/shared/render/services/container-aware-layout").ResolvedAutoLayout
    | null
  >(null);

  function setResolvedCardAutoLayout(
    layout:
      | import("$lib/shared/render/services/container-aware-layout").ResolvedAutoLayout
      | null
  ): void {
    const current = resolvedCardAutoLayout;
    if (
      current?.stepCount === layout?.stepCount &&
      current?.cols === layout?.cols &&
      current?.rows === layout?.rows &&
      current?.startPlacement === layout?.startPlacement
    ) {
      return;
    }
    resolvedCardAutoLayout = layout;
  }

  const imgComp = createImageCompositionSync();

  const authQueue = createAuthActionQueue();

  $effect(() => {
    playback.setOnUrlParamChange(onUrlParamChange);
  });

  let viewMode = $state<ViewMode>(playOnOpen ? "animation" : loadViewMode());
  $effect.pre(() => {
    if (playOnOpen) {
      viewMode = "animation";
    } else if (initialViewMode) {
      viewMode = initialViewMode;
    }
  });

  const fullscreen = createFullscreenController({
    getHapticService: () => hapticService,
    announce: (msg, priority) => accessibilityHelper.announce(msg, priority),
  });

  const viewerState = createViewerState();
  if (initialViewerMode) {
    viewerState.setViewerMode(initialViewerMode);
    viewerState.setExportContext(null);
  }
  if (playOnOpen) {
    viewerState.enterExport("animation-export", "animation");
  }
  const practiceViewPrefs = createPracticeViewPrefs();
  playback.setPracticeViewPrefs(practiceViewPrefs);

  if (viewer3DState.renderMode === "3d" && !viewerState.wants3D) {
    viewerState.setSplitPaneContent("left", "animation-3d");
  }

  const editingPane = $derived.by(
    (): "animation" | "image" | "video-upload" | null => {
      const { viewerMode, exportContext } = viewerState;
      if (exportContext === "animation-export") return "animation";
      if (exportContext === "image-export") return "image";
      if (viewerMode === "videos") return "video-upload";
      return null;
    }
  );

  let playbackSource = $state<PlaybackSource>("animation");
  let videoPlaybackBeatIndex = $state<number | null>(null);
  let activeStepMap = $state<StepMap | null>(null);

  const isExportMode = $derived(editingPane !== null);
  const exportType = $derived<ExportType | null>(
    editingPane === "animation"
      ? "animation"
      : editingPane === "image"
        ? "image"
        : null
  );

  let cellsLoaded = $state(0);
  let totalCells = $state(0);
  let cardReady = $state(false);
  let cardReadyNotified = false;
  let autoplayReadyTimer: ReturnType<typeof setInterval> | null = null;
  const cloudBackedScan = getScanCardCloudProbe();

  function handleRenderProgress(loaded: number, total: number) {
    cellsLoaded = loaded;
    totalCells = total;
    const ready = total > 0 && loaded >= total;
    cardReady = ready;
    if (ready && !cardReadyNotified) {
      cardReadyNotified = true;
      queueMicrotask(() => onCardReady?.());
    }
  }

  let isSyncToggling = $state(false);

  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType);
  const redPropType = $derived(settings.redPropType);
  const catDogModeEnabled = $derived(settings.catDogMode);

  function applyMotionVisibility(
    state: SequenceViewerVisibilityState,
    visibility: {
      showBlueMotion: boolean;
      showRedMotion: boolean;
    }
  ): void {
    state.reset();
    if (!visibility.showBlueMotion) state.setBlueMotion(false);
    if (!visibility.showRedMotion) state.setRedMotion(false);
  }

  const viewerVisibility = new SequenceViewerVisibilityState();
  applyMotionVisibility(
    viewerVisibility,
    sequence
      ? getSequenceMotionVisibility(sequence)
      : { showBlueMotion: true, showRedMotion: true }
  );
  setViewerVisibilityContext(viewerVisibility);

  $effect(() => {
    void sequence?.id;
    const visibility = sequence
      ? getSequenceMotionVisibility(sequence)
      : { showBlueMotion: true, showRedMotion: true };
    untrack(() => {
      applyMotionVisibility(viewerVisibility, {
        showBlueMotion:
          visibility.showBlueMotion && (initialBlueVisible ?? true),
        showRedMotion: visibility.showRedMotion && (initialRedVisible ?? true),
      });
    });
  });

  const effectsConfigState = createEffectsConfigState();
  setEffectsConfigContext(effectsConfigState);
  // Activate a requested effect on mount (QR scan page asks for "trails").
  // setActiveEffect keeps tipEffectMap in sync so the renderer doesn't filter tips.
  if (initialActiveEffect)
    effectsConfigState.setActiveEffect(initialActiveEffect);

  const scene3DRenderState = createScene3DRenderState();
  setScene3DRenderContext(scene3DRenderState);

  const isHandPath = $derived(
    handPathMode || Boolean(sequence?.metadata?.isHandPathVisualization)
  );
  // Props always come from the viewer's own settings. (The former "Theirs | Mine"
  // creator-prop toggle was removed — the notation is prop-agnostic, so a sequence
  // always renders with whatever prop the viewer has chosen.)
  const activeBlueProp = $derived(
    isHandPath ? PropType.HAND : (bluePropType ?? PropType.STAFF)
  );
  const activeRedProp = $derived(
    isHandPath ? PropType.HAND : (redPropType ?? PropType.STAFF)
  );
  const activeCatDog = $derived(
    isHandPath ? false : (catDogModeEnabled ?? false)
  );

  // Keep the animation engine's prop types in sync with the active props.
  function syncPropsToOrchestrator(
    blueProp: PropType,
    redProp: PropType,
    ready: boolean
  ) {
    if (blueProp && redProp && ready) {
      try {
        getSequenceAnimationOrchestrator().updatePropTypes(blueProp, redProp);
      } catch {
        // Animation services not ready yet - props get picked up on init.
      }
    }
  }

  $effect(() => {
    syncPropsToOrchestrator(
      activeBlueProp,
      activeRedProp,
      animationServicesReady
    );
  });

  const effectiveSequence = $derived(
    modalAnimationState.sequenceData ?? sequence
  );
  const hasSequence = $derived(effectiveSequence !== null);

  const singlePlayDuration = $derived.by(() => {
    const steps = effectiveSequence?.steps;
    if (!steps?.length || playback.bpmLocal <= 0) return 0;
    const totalDurationUnits = steps.reduce(
      (sum, s) => sum + (s.duration ?? 1),
      0
    );
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

  const isPublished = $derived(
    (sequence as LibrarySequence | null)?.visibility === "public"
  );

  $effect(() => {
    libraryActions.syncSavedState(sequence);
  });
  $effect(() => {
    libraryActions.syncFavoriteState(sequence);
  });

  const showPreviousBeat = $derived.by(() => {
    const parkedOnBoundary =
      playback.currentStepLocal >= 1 &&
      Math.abs(
        playback.currentStepLocal - Math.round(playback.currentStepLocal)
      ) < 0.01;
    if (!parkedOnBoundary) return false;
    // Manual step-forward/backward parks: show the beat just stepped past.
    if (playback.arrivedViaStepping && !playback.isPlayingLocal) return true;
    // Step-mode playback dwells: the freeze holds the COMPLETED beat's end
    // position, so the glyph/highlight must keep attributing the boundary to
    // that beat — not the upcoming one whose motion hasn't played yet.
    return (
      playback.isPlayingLocal && modalAnimationState.playbackMode === "step"
    );
  });

  const highlightedStepIndex = $derived.by(() => {
    if (playbackSource === "video" && videoPlaybackBeatIndex !== null) {
      return videoPlaybackBeatIndex;
    }
    if (!playback.isPlayingLocal && playback.currentStepLocal < 0.5)
      return null;
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
        const clampedIndex = Math.min(
          Math.max(0, prevIndex),
          sequenceData.steps.length - 1
        );
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
      hasFooter: imgComp.imgShowNotes,
    });
  });

  const fullscreenStackVertical = $derived(previewAspectRatio > 1.3);

  let keydownCleanup: (() => void) | null = null;
  let imageCompositionCleanup: (() => void) | null = null;

  onMount(() => {
    authQueue.bootstrapFromUrl();

    window.addEventListener("keydown", handleKeydown, { capture: true });
    keydownCleanup = () =>
      window.removeEventListener("keydown", handleKeydown, { capture: true });

    imageCompositionCleanup = imgComp.registerObserver();

    playback.registerVisibilityObserver();

    if (!deferInteractiveStartup) ensureInteractiveServices();
  });

  onDestroy(() => {
    if (autoplayReadyTimer !== null) clearInterval(autoplayReadyTimer);
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
    if (viewer3DState.renderMode === "3d") {
      onUrlParamChange?.("render", "3d");
    } else {
      onUrlParamChange?.("render", "");
    }
  });

  $effect(() => {
    if (!sequence) return;
    if (!viewer3DState.webgl2Available) return;

    // Gate 3D on viewport size. When the screen is too small (phone, folded
    // foldable), shouldBe3D is false even if the stored preference wants 3D — so
    // a persisted 3D mode auto-downgrades to 2D. viewportFits3D() is reactive, so
    // shrinking below threshold mid-3D runs exit3D(); growing back re-enters.
    const shouldBe3D =
      (viewerState.wants3D || initialRenderMode === "3d") && viewportFits3D();
    const is3D = viewer3DState.renderMode === "3d";

    const performersReady =
      viewer3DState.performerManager.performers.length > 0;

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
      handleDownload: () => onGatedDownload?.(context),
      handleOpenInBrowser,
    });
  });

  let servicesLoadPromise: Promise<void> | null = null;

  function ensureInteractiveServices(): void {
    if (animationServicesReady || servicesLoadPromise) return;
    servicesLoadPromise = loadServices().finally(() => {
      servicesLoadPromise = null;
    });
  }

  async function loadServices() {
    try {
      playbackControllerRef = getAnimationPlaybackController();
      hapticService = getHapticFeedback();

      playback.setPlaybackController(playbackControllerRef);
      playback.setHapticService(hapticService);
      playback.setAnimationVisible(() => viewerState.viewerMode !== "card");

      const lanSyncCoordinator = getLanSyncCoordinator();
      lanSyncState.initialize(lanSyncCoordinator);

      animationServicesReady = true;
    } catch (error) {
      console.error(
        "[SequenceViewerOrchestrator] Failed to load services:",
        error
      );
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

      // A scan card is guaranteed at QR creation time to have canonical cloud
      // assets. Do not launch the local worker pre-warmer on the scanner's phone.
      if (!cloudBackedScan) {
        cellPreWarmer.preWarmSequence(loadedSequence, "user-blocking");
      }

      modalAnimationState.setShouldLoop(true);
      modalAnimationState.setPlaybackMode("continuous");
      const success = playbackControllerRef.initialize(
        loadedSequence,
        modalAnimationState
      );
      if (!success) throw new Error("Failed to initialize playback");

      setAnimationPlaybackRef(playbackControllerRef);

      lastLoadedSequenceId = seqId;
      modalAnimationState.setSequenceData(loadedSequence);

      playbackControllerRef.setSpeed(playback.bpmLocal / 60);

      const CHECK_INTERVAL_MS = 50;
      const startTime = Date.now();

      if (autoplayReadyTimer !== null) clearInterval(autoplayReadyTimer);
      autoplayReadyTimer = setInterval(() => {
        const ready = isViewerReadyToAutoplay({
          cloudBackedScan,
          loadedCells: cellsLoaded,
          totalCells,
          elapsedMs: Date.now() - startTime,
        });
        if (ready) {
          clearInterval(autoplayReadyTimer!);
          autoplayReadyTimer = null;
          const systemPrefersReducedMotion =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const autoplayAllowed = shouldAutoplayViewer({
            viewMode,
            reducedMotionSetting: getSettings().reducedMotion ?? false,
            systemPrefersReducedMotion,
          });
          if (autoplayAllowed && !playback.isPlayingLocal) {
            playbackControllerRef?.togglePlayback();
          }
        }
      }, CHECK_INTERVAL_MS);
    } catch (err) {
      console.warn(
        "[SequenceViewerOrchestrator] Animation not available:",
        err
      );
      modalAnimationState.setError("Animation data not available");
    } finally {
      animationLoading = false;
      modalAnimationState.setLoading(false);
    }
  }

  let playbackRestoreOnExit = false;

  function enterEditMode(pane: "animation" | "image" | "video-upload") {
    hapticService?.trigger("selection");

    if (pane === "animation") {
      const leftContent = viewerState.splitConfig.leftPane;
      const contentType =
        leftContent === "animation-3d"
          ? ("animation-3d" as const)
          : ("animation" as const);
      viewerState.enterExport("animation-export", contentType);
      if (!playback.isPlayingLocal && playbackControllerRef) {
        playbackControllerRef.togglePlayback();
      }
      playbackRestoreOnExit = false;
    } else if (pane === "image") {
      playbackRestoreOnExit = playback.isPlayingLocal;
      if (playback.isPlayingLocal && playbackControllerRef) {
        playbackControllerRef.togglePlayback();
      }
      viewerState.enterExport("image-export");
    } else if (pane === "video-upload") {
      playbackRestoreOnExit = playback.isPlayingLocal;
      if (playback.isPlayingLocal && playbackControllerRef) {
        playbackControllerRef.togglePlayback();
      }
      viewerState.setViewerMode("videos");
    }

    if (pane === "video-upload") {
      accessibilityHelper.announce(
        "Upload a performance video for this sequence.",
        "assertive"
      );
    } else {
      const label = pane === "animation" ? "Animation" : "Card";
      accessibilityHelper.announce(
        `${label} export. Configure settings and tap Export when ready.`,
        "assertive"
      );
    }
  }

  function exitEditMode() {
    hapticService?.trigger("selection");
    viewerState.exitExport();
    exportCoord.dismissPreview();

    if (
      playbackRestoreOnExit &&
      !playback.isPlayingLocal &&
      playbackControllerRef
    ) {
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
      isHandPath,
      resolvedCardAutoLayout
    );
  }

  // Art-mode export. Mandala drives its OWN worker (separate pipeline); tunnel
  // runs the shared video orchestrator with the kaleidoscope's per-step overlaid
  // prop layers and ALL chrome suppressed (the tunnel is pure visual).
  function handleArtExport(args: {
    artType: "mandala" | "tunnel";
    controller: TunnelViewController;
    mandalaController: MandalaViewerController;
  }) {
    if (args.artType === "mandala") {
      // Reuse the mandala's existing export pipeline (its own off-main-thread
      // worker), the same path the in-pane dock's "Export MP4" button drives.
      args.mandalaController.startExport();
      return;
    }

    // Tunnel: route through the export coordinator's tunnel pipeline. It drives
    // the shared offscreen engine (the live 2D AnimatorCanvas is unmounted in
    // Art mode) with the kaleidoscope's per-step layers + all chrome suppressed,
    // AND — unlike the old inline call here — surfaces progress + an inline
    // preview (save/share) via the ArtPane overlay and a visible error toast.
    const ctrl = args.controller;
    void exportCoord.exportTunnel(
      playbackControllerRef,
      modalAnimationState,
      hapticService,
      (beat: number) => ctrl.additionalLayersAt(beat),
      ctrl.spectrum
    );
  }

  async function handleSyncToggle() {
    if (isSyncToggling || !sequence) return;
    isSyncToggling = true;
    hapticService?.trigger("selection");

    try {
      const sequenceWord = sequence.word || sequence.name || "Sequence";
      lanSyncState.setLocalSequence(
        sequence as unknown as Record<string, unknown>
      );

      const isNowSyncing = await lanSyncState.toggleSync(
        sequence.id,
        sequenceWord,
        {
          sequenceId: sequence.id,
          currentStep: playback.currentStepLocal,
          isPlaying: playback.isPlayingLocal,
          speed: playback.bpmLocal / 60,
          shouldLoop: true,
        }
      );

      if (!isNowSyncing) {
        lanSyncState.setLocalSequence(null);
      }

      hapticService?.trigger(isNowSyncing ? "success" : "selection");
      accessibilityHelper.announce(
        isNowSyncing ? "Sync enabled. Searching for peers." : "Sync disabled"
      );
    } catch (err) {
      console.error("[Sync] Toggle failed:", err);
      hapticService?.trigger("error");
      accessibilityHelper.announce("Sync failed. Please try again.");
    } finally {
      isSyncToggling = false;
    }
  }

  async function handleOpenInCompose(
    preset: "stagger" | "mirror" | "combo-export" = "stagger"
  ) {
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

    const message =
      preset === "combo-export"
        ? "Opening in Compose for combined export..."
        : "Opening in Compose...";
    showToast({ message, type: "info", duration: 2000 });

    await goto("/compose?handoff=true");
  }

  function handleEdit() {
    if (!sequence) return;
    if (!authState.isAuthenticated) {
      authDrawerState.show("signup", "edit-community");
      return;
    }
    hapticService?.trigger("selection");

    localStorage.setItem("tka-pending-edit-sequence", JSON.stringify(sequence));
    handleClose();

    showToast({
      message: "Opening for editing...",
      type: "info",
      duration: 2000,
    });
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

  function getViewerShareDetails() {
    let shareUrl = browser ? window.location.href : "";

    if (sequence) {
      try {
        const metadata: ShareURLMetadata = {};

        if (sequence.word) metadata.word = sequence.word;
        if (sequence.ownerDisplayName)
          metadata.creator = sequence.ownerDisplayName;
        if (typeof sequence.metadata?.notes === "string")
          metadata.notes = sequence.metadata.notes;
        if (typeof sequence.metadata?.difficulty === "string")
          metadata.difficulty = sequence.metadata.difficulty;
        const birthdaySource = sequence.birthday ?? sequence.createdAt;
        if (birthdaySource) {
          const d =
            birthdaySource instanceof Date
              ? birthdaySource
              : new Date(birthdaySource);
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

    const sequenceName =
      sequence?.displayName ||
      sequence?.intendedWord ||
      sequence?.word ||
      sequence?.name ||
      "Sequence";

    return {
      url: shareUrl,
      title: sequenceName,
      text: `TKA sequence: ${sequenceName}`,
      activityMetadata: {
        sequenceId: sequence?.id,
        sequenceWord: sequence?.word,
        sequenceLength: sequence?.steps.length,
      },
    };
  }

  async function copyViewerLink(
    shareMethod: "clipboard" | "viewer_copy_link"
  ): Promise<boolean> {
    const details = getViewerShareDetails();

    if (
      typeof navigator === "undefined" ||
      typeof navigator.clipboard?.writeText !== "function"
    ) {
      showToast("Clipboard access is unavailable", "error");
      return false;
    }

    try {
      await navigator.clipboard.writeText(details.url);
      showToast("Link copied to clipboard", "success");
      void logShareAction("link_copy", {
        ...details.activityMetadata,
        shareMethod,
      });
      return true;
    } catch (error) {
      console.error("[SequenceViewer] Link copy failed:", error);
      showToast("Could not copy link", "error");
      return false;
    }
  }

  function handleShare() {
    hapticService?.trigger("selection");
    const details = getViewerShareDetails();

    if (typeof navigator !== "undefined" && navigator.share) {
      navigator
        .share({
          title: details.title,
          text: details.text,
          url: details.url,
        })
        .then(() => {
          void logShareAction("sequence_share", {
            ...details.activityMetadata,
            shareMethod: "native_link_share",
          });
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          console.error("[SequenceViewer] Native share failed:", error);
          showToast("Could not open share options", "error");
        });
    } else if (typeof navigator !== "undefined") {
      void copyViewerLink("clipboard");
    }
  }

  function handleCopyLink(): Promise<boolean> {
    hapticService?.trigger("selection");
    return copyViewerLink("viewer_copy_link");
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
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
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
    cardReady,
    ensureInteractiveServices,
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
    practiceRunning: playback.practiceRunning,
    practiceCountdown: playback.practiceCountdown,
    practiceState: playback.practiceState,
    practiceViewPrefs,
    metronomeEnabled: playback.metronomeEnabled,
    handleToggleMetronome: playback.handleToggleMetronome,
    mirrorEnabled: playback.mirrorEnabled,
    handleToggleMirror: playback.handleToggleMirror,

    bluePropType: activeBlueProp,
    redPropType: activeRedProp,
    catDogModeEnabled: activeCatDog,

    handlePropTypeChange: (propType: PropType) => {
      updateSettings({ bluePropType: propType, redPropType: propType });
      syncPropsToOrchestrator(propType, propType, animationServicesReady);
      const encoded = encodePropForURL(propType);
      onUrlParamChange?.("bp", encoded);
      onUrlParamChange?.("rp", encoded);
    },

    imgShowWord: imgComp.imgShowWord,
    imgShowStepNumbers: imgComp.imgShowStepNumbers,
    imgShowStartPos: imgComp.imgShowStartPos,
    imgShowDifficulty: imgComp.imgShowDifficulty,
    imgShowNotes: imgComp.imgShowNotes,
    imgDarkMode: imgComp.imgDarkMode,

    isSyncToggling,
    isSyncActive: lanSyncState.isActive,
    isSyncConnected: lanSyncState.isConnected,

    canvasReady:
      (viewer3DState.renderMode === "3d"
        ? !!viewer3DState.webglCanvas
        : !!exportCoord.animationCanvas) && !!playbackControllerRef,

    onRenderProgress: handleRenderProgress,

    renderMode: viewer3DState.renderMode,
    viewer3DState,

    countdownValue: exportCoord.countdownValue,
    isRecording3D: exportCoord.isRecording3D,
    recordingElapsed: exportCoord.recordingElapsed,
    handleStopRecording: () => exportCoord.handleStopRecording(),

    isLoggedIn: forceGuest ? false : authState.isAuthenticated,
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
    handleBpmChange: (bpm: number) => {
      playback.handleBpmChange(bpm);
      onBpmChange?.(bpm);
    },
    handleStepClick: (stepIndex: number) =>
      playback.handleStepClick(stepIndex, blockClicks, editingPane),
    enterEditMode,
    exitEditMode,
    enterFullscreen: fullscreen.enterFullscreen,
    immersive: fullscreen.immersive,
    toggleImmersive: fullscreen.toggleImmersive,
    exitFullscreen: fullscreen.exitFullscreen,
    handleFullscreenTap: fullscreen.handleFullscreenTap,
    handleExport,
    resolvedCardAutoLayout,
    setResolvedCardAutoLayout,
    handleCanvasReady: exportCoord.handleCanvasReady,
    handleSyncToggle,
    handleOpenInCompose,
    handleEdit,
    handleSave: libraryActions.handleSave,
    handleVideoUpload,
    handleShare,
    handleCopyLink,
    handleDelete: libraryActions.handleDelete,
    handleOpenInBrowser,
    invokeGatedAction: (
      type: PendingActionType,
      realHandler: (() => void) | (() => Promise<void>) | undefined
    ) => authQueue.invokeGatedAction(type, realHandler, sequence),
    openSignInPrompt: () => authQueue.openSignInSheet("account"),
    handleUnifiedDarkModeToggle,
    handlePracticeStart: () => {
      // Practice needs the clean Side-by-Side view (animation + steps). The
      // gallery opens cards in export/download views (Card, 2D, 3D all set an
      // export context), so leave any export and force split unless already there.
      if (viewerState.viewerMode !== "split") {
        viewerState.exitExport();
        viewerState.setSplitConfig({
          leftPane: "animation",
          rightPane: "card",
        });
        viewerState.setViewerMode("split");
      }
      playback.handlePracticeStart();
    },
    enterPracticeMode: () => {
      // Setup screen lives in the split companion pane — force split view first.
      if (viewerState.viewerMode !== "split") {
        viewerState.exitExport();
        viewerState.setSplitConfig({
          leftPane: "animation",
          rightPane: "card",
        });
        viewerState.setViewerMode("split");
      }
      playback.enterPracticeMode();
    },
    exitPracticeMode: () => playback.exitPracticeMode(),
    handlePracticeStepLevel: (dir: 1 | -1) =>
      playback.handlePracticeStepLevel(dir),
    handlePracticeToggleHold: () => playback.handlePracticeToggleHold(),
    handlePracticeSetConfig: (patch: Partial<TempoPracticeConfig>) =>
      playback.handlePracticeSetConfig(patch),
    handlePracticeStop: () => playback.handlePracticeStop(),
    onClose: handleClose,
    stepHalfBeatBackward: playback.stepHalfBeatBackward,
    stepHalfBeatForward: playback.stepHalfBeatForward,
    stepFullBeatBackward: playback.stepFullBeatBackward,
    stepFullBeatForward: playback.stepFullBeatForward,
    restartToStart: playback.restartToStart,
    handleCancelExport: exportCoord.handleCancelExport,
    handleRetryExport: () => exportCoord.handleRetryExport(handleExport),
    dismissPreview: exportCoord.dismissPreview,
    saveExportedVideo: () => exportCoord.saveExportedVideo(effectiveSequence),

    playbackController: playbackControllerRef,
    handleArtExport,

    splitPanePlayback: {
      animationState: modalAnimationState,
      animationLoading,
      currentStep: playback.currentStepLocal,
      isPlaying: playback.isPlayingLocal,
      currentLetter,
      currentStepData,
      highlightedStepIndex,
      getPlaybackController: () => playbackControllerRef,
    },
    splitPaneImageComposition: {
      showWord: imgComp.imgShowWord,
      showStepNumbers: imgComp.imgShowStepNumbers,
      showDifficulty: isHandPath ? false : imgComp.imgShowDifficulty,
      showStartPos: imgComp.imgShowStartPos,
      showNotes: imgComp.imgShowNotes,
      showQRCode: imgComp.imgShowQRCode,
      showMandala: imgComp.imgShowMandala,
      showLoopGlyph: !isHandPath && imgComp.imgShowLoopGlyph,
      handPathMode: isHandPath,
      darkMode: imgComp.imgDarkMode,
      // Null delegates to ChoreoCard's per-length composition preference.
      columnCount: null,
      forceContain: false,
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

<!-- The one shared auth surface. AuthModal owns every provider flow (Google,
     Facebook, email/password, magic link) and renders its own contextual copy
     from the `viewer-signin-*` trigger keys, so the viewer holds no auth copy
     or provider code of its own. Lazy so the scan landing doesn't pay for the
     auth bundle until a guest actually hits a gate. AuthModal mounts its own
     GoogleOneTap, which is why the viewer no longer mounts a second one. -->
{#if authQueue.signInSheetOpen}
  {#await import("$lib/shared/auth/components/AuthModal.svelte") then mod}
    <mod.default
      open={authQueue.signInSheetOpen}
      reason={authQueue.signInTrigger}
      onClose={() => authQueue.closeSignInSheet()}
    />
  {/await}
{/if}

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
