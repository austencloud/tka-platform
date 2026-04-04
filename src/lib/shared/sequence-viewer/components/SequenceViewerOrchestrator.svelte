<!--
  SequenceViewerOrchestrator.svelte

  Headless orchestrator component that owns all sequence viewer state and logic.
  Both the route (/sequence/[id]) and the drawer host render this component,
  passing a children snippet that receives the full context object.

  The orchestrator manages:
  - Animation playback (play/pause, BPM, stepping)
  - Export mode (image/video/combined)
  - Fullscreen mode
  - Tempo practice training
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
  import type { BeatMap } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
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
    activeBeatMap: BeatMap | null;
    setPlaybackSource: (source: PlaybackSource) => void;
    setActiveBeatMap: (beatMap: BeatMap | null) => void;
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
    handleGetApp: () => void;
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
    /** Total expected duration of the 3D recording */
    recordingTotal: number;
  }
</script>

<script lang="ts">
  import { onMount, onDestroy, type Snippet } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { container } from "$lib/shared/di";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { ISequenceAnimationOrchestrator } from "$lib/features/compose/services/contracts/ISequenceAnimationOrchestrator";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { ISequenceDataProvider } from "$lib/shared/sequence-viewer/services/contracts/ISequenceDataProvider";
  import { createAnimationPanelState, type AnimationStateKey } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { setAnimationPlaybackRef } from "$lib/shared/coordinators/animation-playback-ref.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { getSettings, updateSettings } from "$lib/shared/application/state/app-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { layoutCalculator } from "$lib/shared/render/services/implementations/LayoutCalculator";
  import { sequenceModalPersistence } from "$lib/shared/sequence-viewer/services/implementations/SequenceModalPersistence";
  import { cellPreWarmer } from "$lib/shared/sequence-viewer/services/implementations/CellPreWarmer";
  import { sequenceModalExporter } from "$lib/shared/sequence-viewer/services/implementations/SequenceModalExporter.svelte";
  import { createModalAccessibilityHelper } from "$lib/shared/sequence-viewer/services/implementations/ModalAccessibilityHelper.svelte";
  import { saveSequenceHandoff } from "$lib/shared/coordinators/sequence-handoff.svelte";
  import { getExportOptionsState } from "$lib/shared/sequence-viewer/state/export-options-state.svelte";
  import { TempoPracticeOrchestrator } from "$lib/shared/sequence-viewer/services/implementations/TempoPracticeOrchestrator";
  import { createTempoPracticeState } from "$lib/shared/sequence-viewer/state/tempo-practice-state.svelte";
  import { page } from "$app/stores";
  import type { ShareURLMetadata } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";
  import type { IPresentationResolver } from "../services/contracts/IPresentationResolver";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { getHighlightedBeatFromVideo } from "$lib/shared/video-collaboration/utils/beat-map-utils";
  import PropContextChip from "./PropContextChip.svelte";
  import type { ICollectionManager } from "$lib/features/library/services/contracts/ICollectionManager";
  import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
  import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";

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
  // STATE
  // ============================================================================

  // View mode
  let viewMode = $state<ViewMode>(sequenceModalPersistence.loadViewMode());
  $effect.pre(() => { if (initialViewMode) viewMode = initialViewMode; });

  // Fullscreen state
  let isFullscreen = $state(false);
  let fullscreenControlsVisible = $state(false);
  let controlsHideTimeout: ReturnType<typeof setTimeout> | null = null;

  const exportOptions = getExportOptionsState();

  // Services
  let playbackController = $state<IAnimationPlaybackController | null>(null);
  let sequenceDataProvider: ISequenceDataProvider | null = null;
  let hapticService: IHapticFeedback | null = null;

  // 3D viewer state — created once, distributed via Svelte context
  const viewer3DState = createViewer3DState({
    propInterpolator: container.items.propStateInterpolator,
    sequenceConverter: container.items.sequenceConverter,
  });
  setViewer3DContext(viewer3DState);

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

  // Edit mode (single source of truth for export state)
  let editingPane = $state<'animation' | 'image' | 'video-upload' | null>(null);

  // Video-synced playback: when a beat-mapped video is playing, the choreo card's
  // gold border follows the video's beat position instead of the animation clock.
  let playbackSource = $state<PlaybackSource>("animation");
  let videoPlaybackBeatIndex = $state<number | null>(null);
  let activeBeatMap = $state<BeatMap | null>(null);

  // Export mode (derived from editingPane)
  const isExportMode = $derived(editingPane !== null);
  const exportType = $derived<ExportType | null>(
    editingPane === 'animation' ? 'animation' : editingPane === 'image' ? 'image' : null
  );

  // Export state
  let animationCanvas = $state<HTMLCanvasElement | null>(null);
  const isExporting = $derived(sequenceModalExporter.state.isExporting);
  const exportProgress = $derived(sequenceModalExporter.state.progress);
  const exportError = $derived(sequenceModalExporter.state.error);
  const previewBlobUrl = $derived(sequenceModalExporter.state.previewBlobUrl);

  // 3D recording UI state
  let countdownValue = $state(0);
  let isRecording3D = $state(false);
  let recordingElapsed = $state(0);
  let recordingTotal = $state(0);
  let recordingTimer: ReturnType<typeof setInterval> | null = null;

  // Duration of a single sequence playthrough (for export UI)
  const singlePlayDuration = $derived.by(() => {
    const steps = effectiveSequence?.steps;
    if (!steps?.length || bpmLocal <= 0) return 0;
    const totalDurationUnits = steps.reduce((sum, s) => sum + (s.duration ?? 1), 0);
    const speed = bpmLocal / 60;
    return totalDurationUnits / speed;
  });

  // LAN Sync
  let isSyncToggling = $state(false);

  // Settings
  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType);
  const redPropType = $derived(settings.redPropType);
  const catDogModeEnabled = $derived(settings.catDogMode);

  // Prop context — viewer sees creator's intended props by default ("creator-expression"),
  // or their own settings ("notation"). User can toggle via the PropContextChip.
  let contextOverride = $state<ViewingContext | null>(null);
  const activeContext = $derived(contextOverride ?? viewingContext);

  const presentation = $derived.by((): ResolvedPresentation => {
    if (!sequence) {
      return {
        bluePropType: bluePropType ?? PropType.STAFF,
        redPropType: redPropType ?? PropType.STAFF,
        catDogMode: catDogModeEnabled ?? false,
        effortTimeline: null,
        source: "viewer-settings",
      };
    }
    const resolver = container.items.presentationResolver as IPresentationResolver;
    return resolver.resolve(
      sequence,
      activeContext,
      bluePropType ?? PropType.STAFF,
      redPropType ?? PropType.STAFF,
      catDogModeEnabled ?? false
    );
  });

  // Hand path visualization sequences always use HAND prop type — they represent
  // pure spatial paths, not prop-based sequences. Only synthetic sequences built
  // by DeckFamilySection set this flag. Regular sequences with handPathId metadata
  // (for grouping/sorting) are NOT hand path visualizations.
  const isHandPath = $derived(Boolean(sequence?.metadata?.isHandPathVisualization));

  const activeBlueProp = $derived(isHandPath ? PropType.HAND : presentation.bluePropType);
  const activeRedProp = $derived(isHandPath ? PropType.HAND : presentation.redPropType);
  const activeCatDog = $derived(isHandPath ? false : presentation.catDogMode);

  // Toggle between creator-intent and viewer-settings prop contexts
  function togglePropContext() {
    contextOverride = activeContext === "creator-expression" ? "notation" : "creator-expression";
  }

  // When active props change (chip toggle), update the animation orchestrator's prop types
  // so the canvas re-renders with the correct prop visuals.
  $effect(() => {
    const blue = activeBlueProp;
    const red = activeRedProp;
    if (blue && red && animationServicesReady) {
      try {
        const orchestrator = container.items.sequenceAnimationOrchestrator as ISequenceAnimationOrchestrator;
        orchestrator.updatePropTypes(blue, red);
      } catch {
        // Animation services not ready yet — will pick up correct props on init
      }
    }
  });

  // Animation visibility
  const animationVisibility = getAnimationVisibilityManager();

  // Image composition
  const imageComposition = getImageCompositionManager();
  let imgShowWord = $state(imageComposition.addWord);
  let imgShowStartPos = $state(imageComposition.includeStartPosition);
  let imgShowStepNumbers = $state(imageComposition.addStepNumbers);
  let imgShowDifficulty = $state(imageComposition.addDifficultyLevel);
  let imgShowCreatorName = $state(imageComposition.showCreatorName);
  let imgShowNotes = $state(imageComposition.showNotes);
  let imgShowBirthday = $state(imageComposition.showBirthday);
  let imgShowQRCode = $state(imageComposition.showQRCode);
  let imgDarkMode = $state(imageComposition.darkMode);
  let imgColumnCount = $state<number | null>(sequenceModalPersistence.loadColumnCount());

  // Accessibility
  const accessibilityHelper = createModalAccessibilityHelper();

  // Tempo practice
  const practiceOrchestrator = new TempoPracticeOrchestrator();
  const practiceState = createTempoPracticeState();
  let practiceActive = $derived(practiceState.progress.active);

  // ============================================================================
  // DERIVED
  // ============================================================================

  const effectiveSequence = $derived(modalAnimationState.sequenceData ?? sequence);
  const hasSequence = $derived(effectiveSequence !== null);
  const isOwned = $derived(
    !!sequence?.ownerId &&
    !!authState.user?.uid &&
    sequence.ownerId === authState.user.uid
  );

  let isSaved = $state(true);
  let isFavorite = $state(false);
  // Runtime sequences loaded from Firestore are LibrarySequence (extends SequenceData),
  // so visibility and contentHash are present even though SequenceData doesn't declare them.
  const isPublished = $derived((sequence as LibrarySequence | null)?.visibility === "public");

  // Content hash cache — avoids redundant Firestore reads for the same hash
  const savedHashCache = new Map<string, boolean>();

  // Check if this sequence is already saved to the user's library
  $effect(() => {
    const seq = sequence as LibrarySequence | null;
    if (!seq?.contentHash || !authState.user?.uid) {
      // No contentHash means we can't verify against the library.
      // If the sequence is owned by the current user (e.g. from create module),
      // treat it as unsaved so the Save button appears. Otherwise default to true
      // (viewing someone else's sequence or not logged in — Save is irrelevant).
      isSaved = !(isOwned && seq && !seq.contentHash);
      return;
    }

    const hash = seq.contentHash;
    if (savedHashCache.has(hash)) {
      isSaved = savedHashCache.get(hash)!;
      return;
    }

    const repo = container.items.libraryRepository as ILibraryRepository;
    repo.hasMatchingContent(hash)
      .then((found) => {
        savedHashCache.set(hash, found);
        if (sequence?.id === seq.id) isSaved = found;
      })
      .catch(() => {});
  });

  // Check favorite status for the current sequence
  $effect(() => {
    const seq = sequence;
    if (!seq) { isFavorite = false; return; }

    const cm = container.items.collectionManager as ICollectionManager;
    cm.isFavorite(seq.id)
      .then((fav) => { if (sequence?.id === seq.id) isFavorite = fav; })
      .catch(() => {});
  });

  function handleFavoriteToggle() {
    if (!sequence) return;
    isFavorite = !isFavorite; // optimistic
    const cm = container.items.collectionManager as ICollectionManager;
    cm.toggleFavorite(sequence.id).catch(() => { isFavorite = !isFavorite; });
  }

  async function handlePublishAction() {
    console.log("[Orchestrator] handlePublishAction called, sequence:", sequence?.id);
    if (!sequence) return;
    try {
      const repo = container.items.libraryRepository as ILibraryRepository;
      await repo.publishSequence(sequence.id);
      console.log("[Orchestrator] publishSequence completed");
    } catch (e) {
      console.error("[Orchestrator] publishSequence FAILED:", e);
    }
  }

  async function handleUnpublishAction() {
    if (!sequence) return;
    const repo = container.items.libraryRepository as ILibraryRepository;
    await repo.unpublishSequence(sequence.id);
  }

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
    // When a video with beat map is driving playback, use its beat index
    if (playbackSource === "video" && videoPlaybackBeatIndex !== null) {
      return videoPlaybackBeatIndex;
    }

    // Original animation-driven logic
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

  // Visibility observer ref for cleanup
  let visibilityObserver: (() => void) | undefined;

  onMount(() => {
    // Keyboard handler
    window.addEventListener("keydown", handleKeydown, { capture: true });
    keydownCleanup = () => window.removeEventListener("keydown", handleKeydown, { capture: true });

    // Sync image composition from manager
    const observer = () => {
      imgShowWord = imageComposition.addWord;
      imgShowStepNumbers = imageComposition.addStepNumbers;
      imgShowStartPos = imageComposition.includeStartPosition;
      imgShowDifficulty = imageComposition.addDifficultyLevel;
      imgShowCreatorName = imageComposition.showCreatorName;
      imgShowNotes = imageComposition.showNotes;
      imgShowBirthday = imageComposition.showBirthday;
      imgShowQRCode = imageComposition.showQRCode;
      imgDarkMode = imageComposition.darkMode;
    };
    imageComposition.registerObserver(observer);
    imageCompositionObserver = observer;

    // Sync playback mode from visibility manager (e.g. user toggles step/continuous in settings)
    const visObs = () => {
      const newMode = animationVisibility.getPlaybackMode();
      if (modalAnimationState.playbackMode !== newMode) {
        const wasPlaying = modalAnimationState.isPlaying;
        if (wasPlaying && playbackController) {
          playbackController.togglePlayback(); // stop
        }
        modalAnimationState.setPlaybackMode(newMode);
        if (wasPlaying && playbackController) {
          playbackController.togglePlayback(); // restart in new mode
        }
      }
    };
    animationVisibility.registerObserver(visObs);
    visibilityObserver = visObs;

    // Load services
    void loadServices();
  });

  onDestroy(() => {
    // Stop practice if active
    if (practiceOrchestrator.isActive()) {
      practiceOrchestrator.stop();
      playbackController?.offLoopComplete();
    }

    keydownCleanup?.();
    if (visibilityObserver) {
      animationVisibility.unregisterObserver(visibilityObserver);
    }
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
    viewer3DState.dispose();
  });

  // Initialize animation when sequence becomes available and services are ready
  $effect(() => {
    if (sequence && animationServicesReady && playbackController) {
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

  // Sync render mode to URL param when it changes
  $effect(() => {
    if (viewer3DState.renderMode === '3d') {
      onUrlParamChange?.('render', '3d');
    } else {
      onUrlParamChange?.('render', '');
    }
  });

  // Enter 3D mode on first load — URL param takes priority, then persisted preference.
  // One-shot: only runs once when sequence first becomes available. Using a flag
  // prevents re-triggering when enter3D writes to $state (which would cause an
  // infinite effect_update_depth_exceeded loop).
  let _3dRestored = false;
  $effect(() => {
    if (_3dRestored) return;
    const shouldStart3D = initialRenderMode === '3d' || viewer3DState.preferredMode === '3d';
    if (shouldStart3D && viewer3DState.webgl2Available && sequence) {
      _3dRestored = true;
      viewer3DState.enter3D(sequence);
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

      const lanSyncCoordinator = container.items.lanSyncCoordinator;
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
      // Viewer always uses continuous mode - don't inherit step mode from localStorage
      modalAnimationState.setPlaybackMode("continuous");
      const success = playbackController.initialize(loadedSequence, modalAnimationState);
      if (!success) throw new Error("Failed to initialize playback");

      setAnimationPlaybackRef(playbackController);

      lastLoadedSequenceId = seqId;
      modalAnimationState.setSequenceData(loadedSequence);

      // Always sync controller speed to match UI state.
      // bpmLocal defaults to 60 (initialBpm prop) but modalAnimationState
      // loads persisted speed from localStorage which can differ.
      playbackController.setSpeed(bpmLocal / 60);

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
    if (practiceOrchestrator.isActive()) {
      practiceOrchestrator.adjustBpm(newBpm);
      practiceState.updateProgress(practiceOrchestrator.getProgress());
    }
  }

  function handlePlaybackModeChange(mode: import("$lib/features/compose/state/animation-panel-state.svelte").PlaybackMode) {
    const wasPlaying = isPlayingLocal;
    if (wasPlaying && playbackController) {
      playbackController.togglePlayback();
    }
    modalAnimationState.setPlaybackMode(mode);
    if (wasPlaying && playbackController) {
      setTimeout(() => playbackController?.togglePlayback(), 0);
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
  // PRACTICE TRAINING
  // ============================================================================

  function handlePracticeStart() {
    if (!playbackController) {
      showToast("Animation not ready yet. Wait for it to load.", "info");
      return;
    }

    hapticService?.trigger("selection");
    practiceState.clearCompletion();

    const startBpm = practiceOrchestrator.start(practiceState.userConfig);
    practiceState.updateProgress(practiceOrchestrator.getProgress());

    handleBpmChange(startBpm);

    playbackController.onLoopComplete(() => {
      const newBpm = practiceOrchestrator.onLoopComplete();
      practiceState.updateProgress(practiceOrchestrator.getProgress());

      if (newBpm !== null) {
        handleBpmChange(newBpm);
        hapticService?.trigger("selection");
      }

      if (!practiceOrchestrator.isActive()) {
        handlePracticeStop();
      }
    });

    modalAnimationState.setShouldLoop(true);
    if (!isPlayingLocal) {
      playbackController.togglePlayback();
    }
  }

  function handlePracticeStop() {
    if (!playbackController) return;

    const finalBpm = practiceOrchestrator.stop();
    practiceState.updateProgress(practiceOrchestrator.getProgress());

    playbackController.offLoopComplete();

    const seqId = sequence?.id || sequence?.word || "unknown";
    practiceState.recordPersonalBest(seqId, finalBpm);

    practiceState.showCompletion(finalBpm);
    hapticService?.trigger("success");

    const personalBest = practiceState.getPersonalBest(seqId);
    const isNewBest = personalBest !== null && finalBpm >= personalBest;
    const message = isNewBest
      ? `Practice complete: ${finalBpm} BPM (new best!)`
      : `Practice complete: ${finalBpm} BPM`;
    showToast(message, "success");
  }

  // ============================================================================
  // FOCUS MODE
  // ============================================================================

  // Track whether playback was active before entering image export,
  // so we can restore the prior state when exiting.
  let wasPlayingBeforeImageExport = false;

  function enterEditMode(pane: 'animation' | 'image' | 'video-upload') {
    // Auto-exit 3D when entering export mode (export works on 2D canvas only)
    if (viewer3DState.renderMode === '3d') {
      viewer3DState.exit3D();
    }
    hapticService?.trigger("selection");
    editingPane = pane;

    // Video export: start playback for live preview
    // Image export: pause playback (save state for restore)
    if (pane === "animation") {
      if (!isPlayingLocal && playbackController) {
        playbackController.togglePlayback();
      }
    } else if (pane === "image" || pane === "video-upload") {
      wasPlayingBeforeImageExport = isPlayingLocal;
      if (isPlayingLocal && playbackController) {
        playbackController.togglePlayback();
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
    sequenceModalExporter.dismissPreview();

    // Restore playback state after image export
    if (wasPaneImage && wasPlayingBeforeImageExport && !isPlayingLocal && playbackController) {
      playbackController.togglePlayback();
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
  // EXPORT
  // ============================================================================

  async function handleExport() {
    if (isExporting || !exportType) return;
    hapticService?.trigger("selection");

    const isVideoExport = exportType === "animation";
    const callbacks = {
      onSuccess: (message: string) => {
        showToast(message, "success");
        accessibilityHelper.announce(message, "assertive");
        // Video exports stay in export mode to show preview panel
        // Image exports exit immediately (no preview needed)
        if (!isVideoExport) {
          exitEditMode();
        }
      },
      onError: (message: string) => {
        accessibilityHelper.announce(`Export failed: ${message}`, "assertive");
      },
      onHaptic: (type: "success" | "error" | "selection") => {
        hapticService?.trigger(type);
      },
    };

    // 3D mode: real-time capture from WebGL canvas
    const is3DMode = viewer3DState.renderMode === '3d';
    const webglCanvas = viewer3DState.webglCanvas;

    if (exportType === "animation" && is3DMode && webglCanvas && playbackController) {
      const pc = playbackController; // narrow for closures
      const opts = exportOptions.getVideoOptions();
      const secondsPerBeat = 1.0 / modalAnimationState.speed;
      const steps = effectiveSequence?.steps ?? [];
      const totalDurationUnits = steps.reduce((sum, s) => sum + (s.duration ?? 1), 0);
      const startDur = opts.includeStartPosition ? 1 : 0;
      const endDur = opts.includeEndHold ? 1 : 0;
      const totalSec = (startDur + totalDurationUnits + endDur) * secondsPerBeat * opts.loopCount;

      // 3-2-1 countdown before recording
      for (let c = 3; c >= 1; c--) {
        countdownValue = c;
        await new Promise((r) => setTimeout(r, 800));
        if (!editingPane) { countdownValue = 0; return; } // user cancelled
      }
      countdownValue = 0;

      // Start recording indicator
      isRecording3D = true;
      recordingElapsed = 0;
      recordingTotal = totalSec;
      const recordStart = performance.now();
      recordingTimer = setInterval(() => {
        recordingElapsed = Math.min((performance.now() - recordStart) / 1000, totalSec);
      }, 100);

      try {
        await sequenceModalExporter.export3DAnimation(
          {
            fps: opts.fps,
            loopCount: opts.loopCount,
            resolution: opts.resolution,
            includeStartPosition: opts.includeStartPosition,
            includeEndHold: opts.includeEndHold,
          },
          {
            webglCanvas,
            startPlayback: () => {
              pc.jumpToStep(0);
              if (!isPlayingLocal) pc.togglePlayback();
            },
            stopPlayback: () => {
              if (isPlayingLocal) pc.togglePlayback();
            },
            getTotalDurationSeconds: () => {
              return (startDur + totalDurationUnits + endDur) * secondsPerBeat;
            },
          },
          callbacks
        );
      } finally {
        isRecording3D = false;
        recordingElapsed = 0;
        if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null; }
      }
      return;
    }

    // 2D mode: frame-by-frame capture from PixiJS canvas
    if (exportType === "animation" && playbackController && animationCanvas) {
      const opts = exportOptions.getVideoOptions();
      await sequenceModalExporter.exportAnimation(
        {
          fps: opts.fps,
          loopCount: opts.loopCount,
          resolution: opts.resolution,
          includeStartPosition: opts.includeStartPosition,
          includeEndHold: opts.includeEndHold,
        },
        { canvas: animationCanvas, playbackController, panelState: modalAnimationState },
        callbacks
      );
    } else if (exportType === "animation" && (!playbackController || !animationCanvas)) {
      showToast("Animation not ready yet. Wait a moment and try again.", "error");
      return;
    } else if (exportType === "image" && effectiveSequence) {
      if (!effectiveSequence.steps || effectiveSequence.steps.length === 0) {
        showToast("Sequence has no beats to export.", "error");
        return;
      }
      const opts = exportOptions.getImageOptions();
      await sequenceModalExporter.exportImage(
        opts,
        { sequence: effectiveSequence, userName: authState.user?.displayName ?? "" },
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

  function dismissPreview() {
    sequenceModalExporter.dismissPreview();
    // Stay in export mode so user returns to the Download Animation view,
    // not the full viewer with split pane
    accessibilityHelper.announce("Ready to export again");
  }

  // ============================================================================
  // LAN SYNC
  // ============================================================================

  // Track last applied sync timestamp to avoid feedback loops
  let lastAppliedSyncTimestamp = 0;

  // Listen for incoming sync state changes from remote peers
  $effect(() => {
    const playback = lanSyncState.playbackState;
    if (!lanSyncState.isConnected || !playbackController) return;

    // Only apply if this is a remote update (timestamp changed)
    if (playback.timestamp > lastAppliedSyncTimestamp) {
      lastAppliedSyncTimestamp = playback.timestamp;

      // Apply play/pause changes
      if (playback.isPlaying !== isPlayingLocal) {
        if (playback.isPlaying) {
          if (!isPlayingLocal) playbackController.togglePlayback();
        } else {
          if (isPlayingLocal) playbackController.togglePlayback();
        }
      }

      // Seek if step is significantly different (>0.5 step difference)
      if (Math.abs(playback.currentStep - currentStepLocal) > 0.5) {
        playbackController.jumpToStep(playback.currentStep);
      }

      // Apply speed/BPM changes
      const currentSpeed = bpmLocal / 60;
      if (Math.abs(playback.speed - currentSpeed) > 0.01) {
        playbackController.setSpeed(playback.speed);
      }
    }
  });

  async function handleSyncToggle() {
    if (isSyncToggling || !sequence) return;
    isSyncToggling = true;
    hapticService?.trigger("selection");

    try {
      const sequenceWord = sequence.word || sequence.name || "Sequence";
      // Store the full sequence data so joining peers can receive it
      lanSyncState.setLocalSequence(sequence as unknown as Record<string, unknown>);

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
  // COMPOSE NAVIGATION
  // ============================================================================

  async function handleOpenInCompose(preset: 'stagger' | 'mirror' | 'combo-export' = 'stagger') {
    if (!sequence) return;
    hapticService?.trigger("selection");

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

    // Close the viewer (stops playback, disconnects LAN, restores focus)
    handleBackInternal();

    const message = preset === 'combo-export'
      ? "Opening in Compose for combined export..."
      : "Opening in Compose...";
    showToast({ message, type: "info", duration: 2000 });

    await goto('/compose?handoff=true');
  }

  // ============================================================================
  // CONSTRUCTOR NAVIGATION
  // ============================================================================

  function handleEdit() {
    if (!sequence) return;
    if (!authState.isAuthenticated) {
      authDrawerState.show();
      return;
    }
    hapticService?.trigger("selection");

    // Store the sequence for the Constructor to pick up
    localStorage.setItem("tka-pending-edit-sequence", JSON.stringify(sequence));

    // Close the viewer (stops playback, disconnects LAN, restores focus)
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
      const libraryRepo = container.items.libraryRepository;
      // Attach current prop config as intended prop, and capture pathShape in metadata
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
      const libraryRepo = container.items.libraryRepository;
      // Capture pathShape in metadata alongside prop intent
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
      const libraryRepo = container.items.libraryRepository;
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

    // Build a share URL with metadata for the best experience on the receiving end
    let shareUrl = browser ? window.location.href : "";

    if (sequence) {
      try {
        const encoder = container.items.sequenceEncoder;
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
    // Sync to all three dark mode stores so they stay consistent.
    // Without the AppSettings update, the Firebase real-time listener would
    // read the stale darkMode value after the imageExport write triggers a
    // document change, resetting the animation canvas back to the old state.
    void updateSettings({ darkMode: newValue });
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
    // Stop practice if active
    if (practiceOrchestrator.isActive()) {
      practiceOrchestrator.stop();
      playbackController?.offLoopComplete();
      practiceState.updateProgress(practiceOrchestrator.getProgress());
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

  // ============================================================================
  // VIDEO-SYNCED PLAYBACK
  // ============================================================================

  function handleVideoTimeUpdate(currentTime: number) {
    if (playbackSource !== "video" || !activeBeatMap) return;
    const beatIndex = getHighlightedBeatFromVideo(
      currentTime,
      activeBeatMap.beatTimestamps
    );
    // Only update when the beat actually changes to avoid unnecessary re-renders
    if (beatIndex !== videoPlaybackBeatIndex) {
      videoPlaybackBeatIndex = beatIndex;
    }
  }

  function setPlaybackSource(source: PlaybackSource) {
    playbackSource = source;
    if (source === "animation") {
      videoPlaybackBeatIndex = null;
    }
  }

  function setActiveBeatMap(beatMap: BeatMap | null) {
    activeBeatMap = beatMap;
    if (!beatMap) {
      playbackSource = "animation";
      videoPlaybackBeatIndex = null;
    }
  }

  // ============================================================================
  // STEPPING
  // ============================================================================

  function stepHalfBeatBackward() { arrivedViaStepping = true; playbackController?.stepHalfBeatBackward(); }
  function stepHalfBeatForward() { arrivedViaStepping = true; playbackController?.stepHalfBeatForward(); }
  function stepFullBeatBackward() { arrivedViaStepping = true; playbackController?.stepFullBeatBackward(); }
  function stepFullBeatForward() { arrivedViaStepping = true; playbackController?.stepFullBeatForward(); }
  function restartToStart() { arrivedViaStepping = true; playbackController?.seekToStep(0); }

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

    // Video-synced playback
    playbackSource,
    videoPlaybackBeatIndex,
    activeBeatMap,
    setPlaybackSource,
    setActiveBeatMap,
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
    exportOptions,
    isExporting,
    exportProgress,
    exportError,
    previewBlobUrl,
    singlePlayDuration,

    // Practice
    practiceActive,
    practiceState,

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

    imgShowWord,
    imgShowStepNumbers,
    imgShowStartPos,
    imgShowDifficulty,
    imgShowCreatorName,
    imgShowNotes,
    imgShowBirthday,
    imgDarkMode,
    imgColumnCount,

    // Sync
    isSyncToggling,
    isSyncActive: lanSyncState.isActive,
    isSyncConnected: lanSyncState.isConnected,

    // Canvas state
    canvasReady: (viewer3DState.renderMode === '3d' ? !!viewer3DState.webglCanvas : !!animationCanvas) && !!playbackController,

    // Render progress
    onRenderProgress: handleRenderProgress,

    // 3D render mode
    renderMode: viewer3DState.renderMode,
    viewer3DState,

    // 3D recording UI state
    countdownValue,
    isRecording3D,
    recordingElapsed,
    recordingTotal,

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
    handlePlaybackModeChange,

    // Handlers
    handlePlaybackToggle,
    handleBpmChange,
    handleStepClick,
    enterEditMode,
    exitEditMode,
    enterFullscreen,
    exitFullscreen,
    handleFullscreenTap,
    handleExport,
    handleCanvasReady,
    handleSyncToggle,
    handleOpenInCompose,
    handleEdit,
    handleSave,
    handleVideoUpload,
    handleShare,
    handleDelete,
    handleGetApp,
    handleUnifiedDarkModeToggle,
    handlePracticeStart,
    handlePracticeStop,
    onBack: handleBackInternal,
    stepHalfBeatBackward,
    stepHalfBeatForward,
    stepFullBeatBackward,
    stepFullBeatForward,
    restartToStart,
    handleCancelExport,
    handleRetryExport,
    dismissPreview,

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
      showStepNumbers: imgShowStepNumbers,
      showDifficulty: isHandPath ? false : imgShowDifficulty,
      showStartPos: imgShowStartPos,
      showCreatorName: imgShowCreatorName,
      showNotes: imgShowNotes,
      showBirthday: imgShowBirthday,
      showQRCode: imgShowQRCode,
      showLoopGlyph: !isHandPath,
      darkMode: imgDarkMode,
      columnCount: imgColumnCount,
      forceContain: false,
      userName: authState.user?.displayName || "",
    },
    splitPanePropRendering: {
      bluePropType: activeBlueProp,
      redPropType: activeRedProp,
      catDogModeEnabled: activeCatDog,
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
