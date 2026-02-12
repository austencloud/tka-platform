<!--
  SequenceViewerOrchestrator.svelte

  Headless orchestrator component that owns all sequence viewer state and logic.
  Both the route (/sequence/[id]) and the drawer host render this component,
  passing a children snippet that receives the full context object.

  The orchestrator manages:
  - Animation playback (play/pause, BPM, stepping)
  - Export mode (image/video/combined)
  - Fullscreen mode
  - Tempo ramp training
  - LAN sync
  - Keyboard shortcuts
  - Image composition settings
  - Animation visibility settings

  It does NOT own:
  - URL param reading/writing (route-specific)
  - <svelte:head> / SSR metadata (route-specific)
  - view-transition-name (route-specific)
  - Swipe-to-dismiss gesture (different between route and drawer)
  - Drawer wrapper/snap points (drawer-specific)
-->
<script lang="ts" module>
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
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

  export type ViewMode = "animation" | "image" | "split";
  export type ExportType = "animation" | "image" | "both";

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
    modalAnimationState: AnimationPanelState;

    // View state
    viewMode: ViewMode;
    isMobile: boolean;
    isFullscreen: boolean;
    fullscreenControlsVisible: boolean;
    fullscreenStackVertical: boolean;
    editingPane: 'animation' | 'image' | null;

    // Export state
    isExportMode: boolean;
    exportType: ExportType | null;
    exportOptions: ReturnType<typeof import("$lib/shared/sequence-viewer/state/export-options-state.svelte").getExportOptionsState>;
    isExporting: boolean;
    exportProgress: VideoExportProgress | null;
    exportError: string | null;

    // Ramp training
    rampActive: boolean;
    rampState: ReturnType<typeof import("$lib/shared/sequence-viewer/state/tempo-ramp-state.svelte").createTempoRampState>;

    // Settings
    bluePropType: PropType | undefined;
    redPropType: PropType | undefined;
    catDogModeEnabled: boolean | undefined;
    imgShowWord: boolean;
    imgShowStartPos: boolean;
    imgShowDifficulty: boolean;
    imgShowCreatorName: boolean;
    imgShowNotes: boolean;
    imgDarkMode: boolean;
    imgColumnCount: number | null;

    // Sync
    isSyncToggling: boolean;
    isSyncActive: boolean;
    isSyncConnected: boolean;

    // Render progress
    onRenderProgress: (loaded: number, total: number) => void;

    // Auth
    isLoggedIn: boolean;
    userName: string;

    // Handlers
    handlePlaybackToggle: () => void;
    handleBpmChange: (bpm: number) => void;
    handleStepClick: (stepIndex: number) => void;
    enterEditMode: (pane: 'animation' | 'image') => void;
    exitEditMode: () => void;
    enterFullscreen: () => void;
    exitFullscreen: () => void;
    handleFullscreenTap: () => void;
    enterExportMode: () => void;
    exitExportMode: () => void;
    selectExportType: (type: ExportType) => void;
    backToExportTypeSelection: () => void;
    handleExport: () => Promise<void>;
    handleCanvasReady: (canvas: HTMLCanvasElement | null) => void;
    handleSyncToggle: () => Promise<void>;
    handleOpenInCompose: (preset?: 'stagger' | 'mirror' | 'combo-export') => Promise<void>;
    handleSave: () => void;
    handleShare: () => void;
    handleGetApp: () => void;
    handleUnifiedDarkModeToggle: () => void;
    handleRampStart: () => void;
    handleRampStop: () => void;
    onBack: () => void;
    stepHalfBeatBackward: () => void;
    stepHalfBeatForward: () => void;
    stepFullBeatBackward: () => void;
    stepFullBeatForward: () => void;
    handleCancelExport: () => void;
    handleRetryExport: () => void;

    // Pre-assembled prop groups for ViewerSplitPane
    splitPanePlayback: ViewerPlaybackState;
    splitPaneImageComposition: ImageCompositionProps;
    splitPanePropRendering: PropRenderingProps;
  }
</script>

<script lang="ts">
  import { onMount, onDestroy, type Snippet } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { container } from "$lib/shared/di";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
  import type { ILanSyncCoordinator } from "$lib/shared/lan-sync/services/contracts/ILanSyncCoordinator";
  import type { ISequenceDataProvider } from "$lib/shared/sequence-viewer/services/contracts/ISequenceDataProvider";
  import { createAnimationPanelState, type AnimationStateKey } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { setAnimationPlaybackRef } from "$lib/shared/coordinators/animation-playback-ref.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { layoutCalculator } from "$lib/shared/render/services/implementations/LayoutCalculator";
  import { sequenceModalPersistence } from "$lib/shared/sequence-viewer/services/implementations/SequenceModalPersistence";
  import { cellPreWarmer } from "$lib/shared/sequence-viewer/services/implementations/CellPreWarmer";
  import { sequenceModalExporter } from "$lib/shared/sequence-viewer/services/implementations/SequenceModalExporter";
  import { createModalAccessibilityHelper } from "$lib/shared/sequence-viewer/services/implementations/ModalAccessibilityHelper.svelte";
  import { saveSequenceHandoff } from "$lib/shared/coordinators/sequence-handoff.svelte";
  import { getExportOptionsState } from "$lib/shared/sequence-viewer/state/export-options-state.svelte";
  import { TempoRampOrchestrator } from "$lib/shared/sequence-viewer/services/implementations/TempoRampOrchestrator";
  import { createTempoRampState } from "$lib/shared/sequence-viewer/state/tempo-ramp-state.svelte";
  import { page } from "$app/stores";
  import type { ISequenceEncoder, ShareURLMetadata } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";

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
    children,
  }: Props = $props();

  // ============================================================================
  // STATE
  // ============================================================================

  // View mode
  let viewMode = $state<ViewMode>(sequenceModalPersistence.loadViewMode());
  $effect.pre(() => { if (initialViewMode) viewMode = initialViewMode; });

  // Fullscreen state
  let isFullscreen = $state(false);
  let fullscreenControlsVisible = $state(false);
  let controlsHideTimeout: ReturnType<typeof setTimeout> | null = null;

  // Export mode
  let isExportMode = $state(false);
  let exportType = $state<ExportType | null>(null);
  const exportOptions = getExportOptionsState();

  // Services
  let playbackController: IAnimationPlaybackController | null = null;
  let sequenceDataProvider: ISequenceDataProvider | null = null;
  let hapticService: IHapticFeedback | null = null;

  // Animation state
  const modalAnimationState = createAnimationPanelState();
  let animationServicesReady = $state(false);
  let animationLoading = $state(false);
  let lastLoadedSequenceId: string | null = null;

  // Render progress tracking for sequential cell rendering
  let cellsLoaded = $state(0);
  let totalCells = $state(0);

  function handleRenderProgress(loaded: number, total: number) {
    cellsLoaded = loaded;
    totalCells = total;
  }

  // Local reactive state for animation (synced via observer pattern)
  let isPlayingLocal = $state(false);
  let currentStepLocal = $state(0);
  let bpmLocal = $state(120);
  $effect.pre(() => { currentStepLocal = initialStep; bpmLocal = initialBpm; });
  let cleanupAnimationStateSubscription: (() => void) | undefined;

  // Track whether current position was reached via step buttons (vs. direct seek or playback)
  // Used to show "just completed" beat in glyph/highlight instead of "about to start" beat
  let arrivedViaStepping = $state(false);

  // Edit mode
  let editingPane = $state<'animation' | 'image' | null>(null);

  // Export state
  let animationCanvas = $state<HTMLCanvasElement | null>(null);
  const isExporting = $derived(sequenceModalExporter.state.isExporting);
  const exportProgress = $derived(sequenceModalExporter.state.progress);
  const exportError = $derived(sequenceModalExporter.state.error);

  // LAN Sync
  let isSyncToggling = $state(false);

  // Settings
  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType);
  const redPropType = $derived(settings.redPropType);
  const catDogModeEnabled = $derived(settings.catDogMode);

  // Animation visibility
  const animationVisibility = getAnimationVisibilityManager();

  // Image composition
  const imageComposition = getImageCompositionManager();
  let imgShowWord = $state(imageComposition.addWord);
  let imgShowStartPos = $state(imageComposition.includeStartPosition);
  let imgShowDifficulty = $state(imageComposition.addDifficultyLevel);
  let imgShowCreatorName = $state(imageComposition.showCreatorName);
  let imgShowNotes = $state(imageComposition.showNotes);
  let imgDarkMode = $state(imageComposition.darkMode);
  let imgColumnCount = $state<number | null>(sequenceModalPersistence.loadColumnCount());

  // Accessibility
  const accessibilityHelper = createModalAccessibilityHelper();

  // Tempo ramp
  const rampOrchestrator = new TempoRampOrchestrator();
  const rampState = createTempoRampState();
  let rampActive = $derived(rampState.progress.active);

  // ============================================================================
  // DERIVED
  // ============================================================================

  const effectiveSequence = $derived(modalAnimationState.sequenceData ?? sequence);
  const hasSequence = $derived(effectiveSequence !== null);

  // After stepping (via step buttons), props land at the START of the next beat,
  // meaning the PREVIOUS beat's motion just completed. Offset the glyph and highlight
  // to show the just-completed beat instead of the upcoming one.
  // Only applies when paused at an integer beat after using step buttons.
  const showPreviousBeat = $derived(
    arrivedViaStepping &&
    !isPlayingLocal &&
    currentStepLocal >= 1 &&
    Math.abs(currentStepLocal - Math.round(currentStepLocal)) < 0.01
  );

  const highlightedStepIndex = $derived.by(() => {
    if (!isPlayingLocal && currentStepLocal < 0.5) return null;
    if (currentStepLocal < 1) return -1;
    // After stepping to an integer beat, show the just-completed beat
    if (showPreviousBeat) {
      return Math.round(currentStepLocal) - 2;
    }
    return Math.floor(currentStepLocal) - 1;
  });

  const currentStepData = $derived.by(() => {
    const sequenceData = modalAnimationState.sequenceData;
    if (!sequenceData) return null;
    // After stepping to an integer beat, show the just-completed beat's data
    if (showPreviousBeat) {
      const prevIndex = Math.round(currentStepLocal) - 2;
      if (prevIndex < 0 && sequenceData.startPosition) {
        return sequenceData.startPosition;
      }
      if (sequenceData.steps?.length > 0) {
        const clampedIndex = Math.min(Math.max(0, prevIndex), sequenceData.steps.length - 1);
        return sequenceData.steps[clampedIndex] || null;
      }
    }
    if (currentStepLocal < 1 && sequenceData.startPosition) {
      return sequenceData.startPosition;
    }
    if (sequenceData.steps?.length > 0) {
      const stepIndex = Math.max(0, Math.floor(currentStepLocal) - 1);
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
      includeStartPosition: imgShowStartPos,
      hasHeader: imgShowWord,
      hasFooter: imgShowCreatorName || imgShowNotes,
    });
  });

  const fullscreenStackVertical = $derived(previewAspectRatio > 1.3);

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  let keydownCleanup: (() => void) | null = null;
  let imageCompositionObserver: (() => void) | null = null;

  // Track beat transitions for haptic feedback during playback
  let lastBeatNumber = 0;

  // Subscribe to animation state changes (runs immediately, not in onMount)
  cleanupAnimationStateSubscription = modalAnimationState.subscribe(
    (key: AnimationStateKey, value: unknown) => {
      switch (key) {
        case "isPlaying":
          isPlayingLocal = value as boolean;
          lanSyncState.updatePlayback({ isPlaying: value as boolean });
          break;
        case "currentStep": {
          const newStep = value as number;
          // Haptic pulse on beat transitions during playback
          const newBeat = Math.floor(newStep);
          if (isPlayingLocal && newBeat !== lastBeatNumber && newBeat >= 1) {
            hapticService?.trigger("selection");
          }
          lastBeatNumber = newBeat;
          currentStepLocal = newStep;
          lanSyncState.updatePlayback({ currentStep: newStep });
          break;
        }
        case "speed":
          bpmLocal = Math.round((value as number) * 60);
          lanSyncState.updatePlayback({ speed: value as number });
          break;
      }
    }
  );

  onMount(() => {
    // Keyboard handler
    window.addEventListener("keydown", handleKeydown, { capture: true });
    keydownCleanup = () => window.removeEventListener("keydown", handleKeydown, { capture: true });

    // Sync image composition from manager
    const observer = () => {
      imgShowWord = imageComposition.addWord;
      imgShowStartPos = imageComposition.includeStartPosition;
      imgShowDifficulty = imageComposition.addDifficultyLevel;
      imgShowCreatorName = imageComposition.showCreatorName;
      imgShowNotes = imageComposition.showNotes;
      imgDarkMode = imageComposition.darkMode;
    };
    imageComposition.registerObserver(observer);
    imageCompositionObserver = observer;

    // Load services
    void loadServices();
  });

  onDestroy(() => {
    // Stop ramp if active
    if (rampOrchestrator.isActive()) {
      rampOrchestrator.stop();
      playbackController?.offLoopComplete();
    }

    keydownCleanup?.();
    if (imageCompositionObserver) {
      imageComposition.unregisterObserver(imageCompositionObserver);
    }
    cleanupAnimationStateSubscription?.();
    clearControlsTimeout();
    if (playbackController) {
      playbackController.dispose();
    }
    modalAnimationState.dispose();
    sequenceModalExporter.dispose();
  });

  // Initialize animation when sequence becomes available and services are ready
  $effect(() => {
    if (sequence && animationServicesReady && playbackController) {
      initializeAnimation(sequence);
    }
  });

  // ============================================================================
  // SERVICES
  // ============================================================================

  async function loadServices() {
    try {
      playbackController = container.items.animationPlaybackController;
      sequenceDataProvider = container.items.sequenceDataProvider;
      hapticService = container.items.hapticFeedback;

      const lanSyncCoordinator = container.items.lanSyncCoordinator as ILanSyncCoordinator;
      lanSyncState.initialize(lanSyncCoordinator);

      animationServicesReady = true;
    } catch (error) {
      console.error("[SequenceViewerOrchestrator] Failed to load services:", error);
      modalAnimationState.setError("Failed to load animation services");
    }
  }

  async function initializeAnimation(seq: SequenceData) {
    if (!playbackController || !sequenceDataProvider) return;

    const seqId = seq.id || seq.word || "unknown";
    if (seqId === lastLoadedSequenceId) return;

    animationLoading = true;
    modalAnimationState.setLoading(true);
    modalAnimationState.setError(null);

    try {
      const loadedSequence = await sequenceDataProvider.hydrateSequence(seq);
      if (!loadedSequence) throw new Error("Failed to load sequence");

      // Pre-warm at user-blocking priority (fire-and-forget).
      // First open renders fresh; second open is instant from IndexedDB cache.
      cellPreWarmer.preWarmSequence(loadedSequence, "user-blocking");

      modalAnimationState.setShouldLoop(true);
      const success = playbackController.initialize(loadedSequence, modalAnimationState);
      if (!success) throw new Error("Failed to initialize playback");

      setAnimationPlaybackRef(playbackController);

      lastLoadedSequenceId = seqId;
      modalAnimationState.setSequenceData(loadedSequence);

      // Apply BPM from state
      if (bpmLocal !== 60) {
        const speedMultiplier = bpmLocal / 60;
        playbackController.setSpeed(speedMultiplier);
      }

      // Auto-start when enough cells are rendered (or after max wait).
      // This replaces the old fixed 300ms delay with render-aware coordination.
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
            playbackController?.togglePlayback();
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
  // PLAYBACK
  // ============================================================================

  function handlePlaybackToggle() {
    arrivedViaStepping = false;
    playbackController?.togglePlayback();
  }

  function handleBpmChange(newBpm: number) {
    hapticService?.trigger("selection");
    const speedMultiplier = newBpm / 60;
    playbackController?.setSpeed(speedMultiplier);
    onUrlParamChange?.("bpm", String(newBpm));
    if (rampOrchestrator.isActive()) {
      rampOrchestrator.adjustBpm(newBpm);
      rampState.updateProgress(rampOrchestrator.getProgress());
    }
  }

  function handleStepClick(stepIndex: number) {
    if (blockClicks) return;
    if (editingPane !== 'image' || isPlayingLocal) return;

    if (playbackController) {
      hapticService?.trigger("selection");
      const targetStep = stepIndex + 1;
      // Seeking directly to a cell — disable the "show previous beat" offset
      arrivedViaStepping = false;
      modalAnimationState.setCurrentStep(targetStep);
      playbackController.seekToStep(targetStep);
    }
  }

  // ============================================================================
  // RAMP TRAINING
  // ============================================================================

  function handleRampStart() {
    if (!playbackController) {
      showToast("Animation not ready yet. Wait for it to load.", "info");
      return;
    }

    hapticService?.trigger("selection");
    rampState.clearCompletion();

    const startBpm = rampOrchestrator.start(rampState.userConfig);
    rampState.updateProgress(rampOrchestrator.getProgress());

    handleBpmChange(startBpm);

    playbackController.onLoopComplete(() => {
      const newBpm = rampOrchestrator.onLoopComplete();
      rampState.updateProgress(rampOrchestrator.getProgress());

      if (newBpm !== null) {
        handleBpmChange(newBpm);
        hapticService?.trigger("selection");
      }

      if (!rampOrchestrator.isActive()) {
        handleRampStop();
      }
    });

    modalAnimationState.setShouldLoop(true);
    if (!isPlayingLocal) {
      playbackController.togglePlayback();
    }
  }

  function handleRampStop() {
    if (!playbackController) return;

    const finalBpm = rampOrchestrator.stop();
    rampState.updateProgress(rampOrchestrator.getProgress());

    playbackController.offLoopComplete();

    const seqId = sequence?.id || sequence?.word || "unknown";
    rampState.recordPersonalBest(seqId, finalBpm);

    rampState.showCompletion(finalBpm);
    hapticService?.trigger("success");

    const personalBest = rampState.getPersonalBest(seqId);
    const isNewBest = personalBest !== null && finalBpm >= personalBest;
    const message = isNewBest
      ? `Ramp complete: ${finalBpm} BPM (new best!)`
      : `Ramp complete: ${finalBpm} BPM`;
    showToast(message, "success");
  }

  // ============================================================================
  // FOCUS MODE
  // ============================================================================

  function enterEditMode(pane: 'animation' | 'image') {
    hapticService?.trigger("selection");
    editingPane = pane;
    accessibilityHelper.announce(`${pane === 'animation' ? 'Animation' : 'Image'} expanded. Tap to collapse.`);
  }

  function exitEditMode() {
    hapticService?.trigger("selection");
    editingPane = null;
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
  // EXPORT MODE
  // ============================================================================

  function enterExportMode() {
    hapticService?.trigger("selection");
    isExportMode = true;
    exportType = null;
    if (isPlayingLocal && playbackController) {
      playbackController.togglePlayback();
    }
    accessibilityHelper.announce("Export mode. Choose Video, Image, or Combined format.", "assertive");
  }

  function exitExportMode() {
    hapticService?.trigger("selection");
    isExportMode = false;
    exportType = null;
    accessibilityHelper.announce("Returned to viewer");
  }

  function selectExportType(type: ExportType) {
    hapticService?.trigger("selection");
    if (type === "both") {
      accessibilityHelper.announce("Opening Compose for combined export");
      handleOpenInCompose("combo-export");
    } else {
      exportType = type;
      accessibilityHelper.announce(`${type === 'animation' ? 'Video' : 'Image'} export selected. Configure options below.`);
    }
  }

  function backToExportTypeSelection() {
    hapticService?.trigger("selection");
    exportType = null;
    accessibilityHelper.announce("Back to export format selection");
  }

  async function handleExport() {
    if (isExporting || !exportType) return;
    hapticService?.trigger("selection");

    const callbacks = {
      onSuccess: (message: string) => {
        showToast(message, "success");
        accessibilityHelper.announce(message, "assertive");
        exitExportMode();
      },
      onError: (message: string) => {
        accessibilityHelper.announce(`Export failed: ${message}`, "assertive");
      },
      onHaptic: (type: "success" | "error" | "selection") => {
        hapticService?.trigger(type);
      },
    };

    if (exportType === "animation" && playbackController && animationCanvas) {
      const opts = exportOptions.getVideoOptions();
      await sequenceModalExporter.exportAnimation(
        opts,
        { canvas: animationCanvas, playbackController, panelState: modalAnimationState },
        callbacks
      );
    } else if (exportType === "image" && sequence) {
      const opts = exportOptions.getImageOptions();
      await sequenceModalExporter.exportImage(
        opts,
        { sequence, userName: authState.user?.displayName ?? "" },
        callbacks
      );
    }
  }

  function handleCanvasReady(canvas: HTMLCanvasElement | null) {
    animationCanvas = canvas;
  }

  function handleCancelExport() {
    sequenceModalExporter.cancel();
  }

  function handleRetryExport() {
    sequenceModalExporter.clearError();
    handleExport();
  }

  // ============================================================================
  // LAN SYNC
  // ============================================================================

  async function handleSyncToggle() {
    if (isSyncToggling || !sequence) return;
    isSyncToggling = true;
    hapticService?.trigger("selection");

    try {
      const sequenceWord = sequence.word || sequence.name || "Sequence";
      const isNowSyncing = await lanSyncState.toggleSync(
        sequence.id,
        sequenceWord,
        {
          sequenceId: sequence.id,
          currentStep: currentStepLocal,
          isPlaying: isPlayingLocal,
          speed: bpmLocal / 60,
          shouldLoop: true
        }
      );
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
  // COMPOSE NAVIGATION
  // ============================================================================

  async function handleOpenInCompose(preset: 'stagger' | 'mirror' | 'combo-export' = 'stagger') {
    if (!sequence) return;
    hapticService?.trigger("selection");

    if (lanSyncState.isActive) {
      lanSyncState.disconnect();
    }

    saveSequenceHandoff({
      sequence,
      playbackState: {
        currentStep: currentStepLocal,
        bpm: bpmLocal,
        isPlaying: isPlayingLocal,
      },
      preferredPreset: preset,
      returnPath: browser ? window.location.pathname : "/browse/gallery",
    });

    const message = preset === 'combo-export'
      ? "Opening in Compose for combined export..."
      : "Opening in Compose...";
    showToast({ message, type: "info", duration: 2000 });

    await goto('/compose?handoff=true');
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
      const libraryRepo = container.items.libraryRepository as ILibraryRepository;
      await libraryRepo.saveSequence(sequence);
      showToast("Saved to library", "success");
    } catch (error) {
      console.error("Failed to save sequence:", error);
      showToast("Failed to save sequence", "error");
    }
  }

  function handleShare() {
    hapticService?.trigger("selection");

    // Build a share URL with metadata for the best experience on the receiving end
    let shareUrl = browser ? window.location.href : "";

    if (sequence) {
      try {
        const encoder = container.items.sequenceEncoder as ISequenceEncoder;
        const metadata: ShareURLMetadata = {};

        if (sequence.word) metadata.word = sequence.word;
        if (sequence.ownerDisplayName) metadata.creator = sequence.ownerDisplayName;
        if (typeof sequence.metadata?.notes === "string") metadata.notes = sequence.metadata.notes;
        if (typeof sequence.metadata?.difficulty === "string") metadata.difficulty = sequence.metadata.difficulty;
        if (sequence.createdAt) {
          const d = sequence.createdAt instanceof Date ? sequence.createdAt : new Date(sequence.createdAt);
          if (!isNaN(d.getTime())) {
            metadata.birthday = d.toISOString().slice(0, 10).replace(/-/g, "");
          }
        }
        metadata.bpm = bpmLocal;
        metadata.darkMode = imgDarkMode;

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

  function handleGetApp() {
    hapticService?.trigger("selection");
    // Open the current URL in a real browser (strips in-app browser context)
    const url = browser ? window.location.href : "";
    if (url) {
      // Attempt intent-based open for Android in-app browsers
      try {
        window.location.href = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;end`;
      } catch {
        // Fallback: open in current window (this usually opens a real browser from IAB)
        window.open(url, "_blank");
      }
    }
  }

  function handleUnifiedDarkModeToggle() {
    hapticService?.trigger("selection");
    const newValue = !imgDarkMode;
    imageComposition.setDarkMode(newValue);
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
      } else if (isExportMode) {
        exitExportMode();
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
      playbackController?.togglePlayback();
      return;
    }

    // P / Shift+P - Handled by global keyboard shortcut system
    // (register-global-shortcuts.ts "global.cycle-prop-type")
  }

  // ============================================================================
  // BACK HANDLER
  // ============================================================================

  function handleBackInternal() {
    // Stop ramp if active
    if (rampOrchestrator.isActive()) {
      rampOrchestrator.stop();
      playbackController?.offLoopComplete();
      rampState.updateProgress(rampOrchestrator.getProgress());
    }

    if (isPlayingLocal && playbackController) {
      playbackController.togglePlayback();
    }
    setAnimationPlaybackRef(null);

    if (lanSyncState.isConnected) {
      lanSyncState.disconnect();
    }

    accessibilityHelper.restoreFocus();
    onBack();
  }

  // ============================================================================
  // STEP SHORTCUTS (forwarded from playback controller)
  // ============================================================================

  function stepHalfBeatBackward() { arrivedViaStepping = true; playbackController?.stepHalfBeatBackward(); }
  function stepHalfBeatForward() { arrivedViaStepping = true; playbackController?.stepHalfBeatForward(); }
  function stepFullBeatBackward() { arrivedViaStepping = true; playbackController?.stepFullBeatBackward(); }
  function stepFullBeatForward() { arrivedViaStepping = true; playbackController?.stepFullBeatForward(); }

  // ============================================================================
  // CONTEXT OBJECT
  // ============================================================================

  const context: OrchestratorContext = $derived({
    // Sequence data
    sequence,
    effectiveSequence,
    hasSequence,

    // Playback
    isPlayingLocal,
    currentStepLocal,
    bpmLocal,
    currentLetter,
    currentStepData,
    highlightedStepIndex,
    animationLoading,
    modalAnimationState,

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
    exportOptions,
    isExporting,
    exportProgress,
    exportError,

    // Ramp
    rampActive,
    rampState,

    // Settings
    bluePropType,
    redPropType,
    catDogModeEnabled,
    imgShowWord,
    imgShowStartPos,
    imgShowDifficulty,
    imgShowCreatorName,
    imgShowNotes,
    imgDarkMode,
    imgColumnCount,

    // Sync
    isSyncToggling,
    isSyncActive: lanSyncState.isActive,
    isSyncConnected: lanSyncState.isConnected,

    // Render progress
    onRenderProgress: handleRenderProgress,

    // Auth
    isLoggedIn: authState.isAuthenticated,
    userName: authState.user?.displayName || "",

    // Handlers
    handlePlaybackToggle,
    handleBpmChange,
    handleStepClick,
    enterEditMode,
    exitEditMode,
    enterFullscreen,
    exitFullscreen,
    handleFullscreenTap,
    enterExportMode,
    exitExportMode,
    selectExportType,
    backToExportTypeSelection,
    handleExport,
    handleCanvasReady,
    handleSyncToggle,
    handleOpenInCompose,
    handleSave,
    handleShare,
    handleGetApp,
    handleUnifiedDarkModeToggle,
    handleRampStart,
    handleRampStop,
    onBack: handleBackInternal,
    stepHalfBeatBackward,
    stepHalfBeatForward,
    stepFullBeatBackward,
    stepFullBeatForward,
    handleCancelExport,
    handleRetryExport,

    // Pre-assembled prop groups for ViewerSplitPane
    splitPanePlayback: {
      animationState: modalAnimationState,
      animationLoading,
      currentStep: currentStepLocal,
      isPlaying: isPlayingLocal,
      currentLetter,
      currentStepData,
      highlightedStepIndex,
    },
    splitPaneImageComposition: {
      showWord: imgShowWord,
      showDifficulty: imgShowDifficulty,
      showStartPos: imgShowStartPos,
      showCreatorName: imgShowCreatorName,
      showNotes: imgShowNotes,
      darkMode: imgDarkMode,
      columnCount: imgColumnCount,
      userName: authState.user?.displayName || "",
    },
    splitPanePropRendering: {
      bluePropType,
      redPropType,
      catDogModeEnabled,
    },
  });
</script>

<!-- Render children with full context -->
{@render children(context)}

<!-- Screen reader announcements -->
<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
  {accessibilityHelper.announcement}
</div>

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
