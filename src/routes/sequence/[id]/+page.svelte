<!--
  /sequence/[id]/+page.svelte

  Dedicated sequence viewer route - the canonical way to view sequences.
  Replaces SequenceDetailsModal with a full route for:
  - Better URL sharing (playback state in URL params)
  - Smoother animations (no modal fighting with split pane)
  - SSR support for social sharing (og:image, og:title)
  - Clean navigation flow with View Transitions

  Features:
  - Split pane view (animation + choreo card)
  - Full playback controls with BPM adjustment
  - Export mode (image/video)
  - LAN sync integration
  - Focus mode (expand one pane)
  - Swipe-to-dismiss (mobile)
  - Keyboard shortcuts (Space = play/pause, Escape = back)
-->
<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { ILanSyncCoordinator } from "$lib/shared/lan-sync/services/contracts/ILanSyncCoordinator";
  import type { ISequenceDataProvider } from "$lib/shared/sequence-viewer/services/contracts/ISequenceDataProvider";
  import type { ISequenceEncoder } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";
  import type { ILetterDeriver } from "$lib/shared/navigation/services/contracts/ILetterDeriver";
  import type { IPositionDeriver } from "$lib/shared/navigation/services/contracts/IPositionDeriver";
  import { createAnimationPanelState, type AnimationStateKey } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { setAnimationPlaybackRef } from "$lib/shared/coordinators/animation-playback-ref.svelte";
  import { getAnimationVisibilityManager, type TrailVisibility } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { layoutCalculator } from "$lib/shared/render/services/implementations/LayoutCalculator";
  import { sequenceModalPersistence } from "$lib/shared/sequence-viewer/services/implementations/SequenceModalPersistence";
  import { playbackTimeCalculator } from "$lib/shared/sequence-viewer/services/implementations/PlaybackTimeCalculator";
  import { sequenceModalExporter } from "$lib/shared/sequence-viewer/services/implementations/SequenceModalExporter";
  import { createModalAccessibilityHelper } from "$lib/shared/sequence-viewer/services/implementations/ModalAccessibilityHelper.svelte";
  import { createModalSwipeDismiss } from "$lib/shared/sequence-viewer/services/implementations/ModalSwipeDismiss";
  import {
    saveSequenceHandoff,
    consumeSequenceRouteHandoff,
    type SequenceRouteHandoff
  } from "$lib/shared/coordinators/sequence-handoff.svelte";
  import { getExportOptionsState } from "$lib/shared/sequence-viewer/state/export-options-state.svelte";

  // Components
  import ViewerSplitPane from "$lib/shared/sequence-viewer/components/ViewerSplitPane.svelte";
  import ViewerFooter from "$lib/shared/sequence-viewer/components/ViewerFooter.svelte";
  import MorphingFooter from "$lib/shared/sequence-viewer/components/MorphingFooter.svelte";
  import FullscreenControls from "$lib/shared/sequence-viewer/components/FullscreenControls.svelte";
  import ExportModeContent from "$lib/shared/sequence-viewer/components/ExportModeContent.svelte";
  import ExportFooter from "$lib/shared/sequence-viewer/components/ExportFooter.svelte";
  import RouteViewerHeader from "./RouteViewerHeader.svelte";

  // Types
  type ViewMode = "animation" | "image" | "split";
  type ExportType = "animation" | "image" | "both";

  // Route params
  const sequenceId = $derived($page.params.id);

  // URL params for state restoration
  const urlViewMode = $derived($page.url.searchParams.get("view") as ViewMode | null);
  const urlBpm = $derived(parseInt($page.url.searchParams.get("bpm") || "") || null);
  const urlTime = $derived(parseInt($page.url.searchParams.get("t") || "") || null);

  // State
  let sequence = $state<SequenceData | null>(null);
  let isLoading = $state(true);
  let loadError = $state<string | null>(null);
  let handoffData = $state<SequenceRouteHandoff | null>(null);

  // View mode
  let viewMode = $state<ViewMode>("split");

  // Fullscreen state
  let isFullscreen = $state(false);
  let fullscreenControlsVisible = $state(false);
  let controlsHideTimeout: ReturnType<typeof setTimeout> | null = null;

  // Export mode
  let isExportMode = $state(false);
  let exportType = $state<ExportType | null>(null);
  const exportOptions = getExportOptionsState();

  // Mobile detection
  let isMobile = $state(false);

  // Services
  let playbackController: IAnimationPlaybackController | null = null;
  let sequenceDataProvider: ISequenceDataProvider | null = null;
  let hapticService: IHapticFeedback | null = null;

  // Animation state
  const modalAnimationState = createAnimationPanelState();
  let animationServicesReady = $state(false);
  let animationLoading = $state(false);
  let lastLoadedSequenceId: string | null = null;

  // Local reactive state for animation (synced via observer pattern)
  let isPlayingLocal = $state(false);
  let currentStepLocal = $state(0);
  let bpmLocal = $state(60);
  let cleanupAnimationStateSubscription: (() => void) | undefined;

  // Which pane is in edit mode: null, 'animation', or 'image'
  let editingPane = $state<'animation' | 'image' | null>(null);

  // Export state
  let animationCanvas = $state<HTMLCanvasElement | null>(null);
  const isExporting = $derived(sequenceModalExporter.state.isExporting);
  const exportProgress = $derived(sequenceModalExporter.state.progress);
  const exportError = $derived(sequenceModalExporter.state.error);

  // LAN Sync
  let isSyncToggling = $state(false);

  // Prop type settings
  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType);
  const redPropType = $derived(settings.redPropType);
  const catDogModeEnabled = $derived(settings.catDogMode);

  // Animation visibility (global singleton)
  const animationVisibility = getAnimationVisibilityManager();
  let animTrailStyle = $state<TrailVisibility>(animationVisibility.getTrailStyle());
  let animTkaGlyph = $state(animationVisibility.getVisibility("tkaGlyph"));
  let animWordHeader = $state(animationVisibility.getVisibility("wordHeader"));

  // Image composition (global singleton, syncs to Firebase)
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
  let pageContainer: HTMLElement | null = null;

  // Swipe-to-dismiss (mobile only)
  const swipeDismiss = createModalSwipeDismiss();

  // Derived values - ensures we have a non-null sequence for rendering
  const effectiveSequence = $derived(modalAnimationState.sequenceData ?? sequence);
  const hasSequence = $derived(effectiveSequence !== null);

  const highlightedStepIndex = $derived.by(() => {
    if (!isPlayingLocal) return null;
    if (currentStepLocal < 1) return -1;
    return Math.floor(currentStepLocal) - 1;
  });

  const currentStepData = $derived.by(() => {
    const sequenceData = modalAnimationState.sequenceData;
    if (!sequenceData) return null;
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

  // Preview aspect ratio for fullscreen layout
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

  // Track cleanup functions for onDestroy
  let resizeCleanup: (() => void) | null = null;
  let keydownCleanup: (() => void) | null = null;
  let imageCompositionObserver: (() => void) | null = null;

  // Async initialization (called from onMount, but doesn't return cleanup)
  async function initializeRoute() {
    // Try to consume handoff data first (from Browse gallery)
    handoffData = consumeSequenceRouteHandoff();

    if (handoffData?.sequence) {
      // Use cached sequence from handoff (immediate, no network)
      sequence = handoffData.sequence;
      isLoading = false;

      // Restore playback state from handoff
      if (handoffData.playbackState) {
        bpmLocal = handoffData.playbackState.bpm || 60;
        currentStepLocal = handoffData.playbackState.currentStep || 0;
      }
    } else if (sequenceId) {
      // Parse the route ID to determine if it's a self-contained encoded sequence or legacy ID
      const encoderService = container.items.sequenceEncoder as ISequenceEncoder;
      const parsed = encoderService.parseSequenceRouteId(sequenceId);

      if (parsed.encoded) {
        // Self-contained URL - decode directly, no network needed
        try {
          let decoded = encoderService.decodeWithCompression(parsed.encoded);

          // Enrich with letters and positions (URL encoding doesn't store these)
          const letterDeriver = container.items.letterDeriver as ILetterDeriver | null;
          const positionDeriver = container.items.positionDeriver as IPositionDeriver | null;

          if (letterDeriver) {
            decoded = await letterDeriver.deriveLettersForSequence(decoded);
          }
          if (positionDeriver) {
            decoded = await positionDeriver.derivePositionsForSequence(decoded);
          }

          sequence = decoded;
          isLoading = false;
        } catch (err) {
          console.error("[SequenceRoute] Failed to decode sequence from URL:", err);
          loadError = "Invalid sequence URL";
          isLoading = false;
        }
      } else if (parsed.legacyId) {
        // Legacy ID - try database lookup
        await loadSequenceFromId(parsed.legacyId);
      } else {
        loadError = "No sequence data in URL";
        isLoading = false;
      }
    } else {
      loadError = "No sequence ID provided";
      isLoading = false;
    }

    // Restore view mode from URL or localStorage
    viewMode = urlViewMode || sequenceModalPersistence.loadViewMode();

    // Restore BPM from URL if present
    if (urlBpm) {
      bpmLocal = urlBpm;
    }

    // Initialize services
    await loadServices();

    // Initialize animation if we have a sequence
    if (sequence && animationServicesReady) {
      await initializeAnimation(sequence);

      // Restore playback time from URL
      if (urlTime && playbackController) {
        const targetStep = playbackTimeCalculator.timeMsToStep(urlTime, bpmLocal);
        playbackController.jumpToStep(targetStep);
      }
    }
  }

  onMount(() => {
    // Mobile detection (sync)
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    resizeCleanup = () => window.removeEventListener("resize", checkMobile);

    // Keyboard handler (sync)
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

    // Start async initialization (fire and forget - errors handled in initializeRoute)
    void initializeRoute();
  });

  onDestroy(() => {
    // Clean up event listeners
    resizeCleanup?.();
    keydownCleanup?.();
    if (imageCompositionObserver) {
      imageComposition.unregisterObserver(imageCompositionObserver);
    }

    // Clean up other resources
    cleanupAnimationStateSubscription?.();
    clearControlsTimeout();
    swipeDismiss.dispose();
    if (playbackController) {
      playbackController.dispose();
    }
    modalAnimationState.dispose();
    sequenceModalExporter.dispose();
  });

  // Subscribe to animation state changes
  cleanupAnimationStateSubscription = modalAnimationState.subscribe(
    (key: AnimationStateKey, value: unknown) => {
      switch (key) {
        case "isPlaying":
          isPlayingLocal = value as boolean;
          lanSyncState.updatePlayback({ isPlaying: value as boolean });
          break;
        case "currentStep":
          currentStepLocal = value as number;
          lanSyncState.updatePlayback({ currentStep: value as number });
          break;
        case "speed":
          bpmLocal = Math.round((value as number) * 60);
          lanSyncState.updatePlayback({ speed: value as number });
          break;
      }
    }
  );

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  async function loadSequenceFromId(id: string) {
    isLoading = true;
    loadError = null;

    try {
      // First, try to decode if it's an encoded sequence (s~ prefix or base64)
      const encoderService = container.items.sequenceEncoder as ISequenceEncoder;

      // Check if this is an inline-encoded sequence
      if (encoderService.isInlineEncoded(id)) {
        try {
          const decoded = encoderService.decodeWithCompression(decodeURIComponent(id));
          if (decoded) {
            sequence = decoded;
            isLoading = false;
            return;
          }
        } catch {
          // Not a valid encoded sequence, continue to other methods
        }
      }

      // Try to resolve via short code manager (handles both Firebase and inline)
      const shortCodeManager = container.items.shortCodeManager;
      let resolvedSequence = await shortCodeManager.resolveShortCode(id);

      if (!resolvedSequence) {
        // Try loading by ID from sequence data provider
        const provider = container.items.sequenceDataProvider as ISequenceDataProvider;
        resolvedSequence = await provider.loadByIdentifier(id);
      }

      if (!resolvedSequence) {
        loadError = "Sequence not found";
        isLoading = false;
        return;
      }

      sequence = resolvedSequence;
      isLoading = false;
    } catch (err) {
      console.error("[SequenceRoute] Failed to load sequence:", err);
      loadError = "Failed to load sequence";
      isLoading = false;
    }
  }

  async function loadServices() {
    try {
      playbackController = container.items.animationPlaybackController;
      sequenceDataProvider = container.items.sequenceDataProvider;
      hapticService = container.items.hapticFeedback;

      const lanSyncCoordinator = container.items.lanSyncCoordinator as ILanSyncCoordinator;
      lanSyncState.initialize(lanSyncCoordinator);

      animationServicesReady = true;
    } catch (error) {
      console.error("[SequenceRoute] Failed to load services:", error);
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

      // Auto-start after brief delay
      setTimeout(() => {
        if (viewMode !== "image") {
          playbackController?.togglePlayback();
        }
      }, 300);
    } catch (err) {
      console.warn("[SequenceRoute] Animation not available:", err);
      modalAnimationState.setError("Animation data not available");
    } finally {
      animationLoading = false;
      modalAnimationState.setLoading(false);
    }
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  function handleBack() {
    if (isPlayingLocal && playbackController) {
      playbackController.togglePlayback();
    }
    setAnimationPlaybackRef(null);

    if (lanSyncState.isConnected) {
      lanSyncState.disconnect();
    }

    accessibilityHelper.restoreFocus();

    // Navigate back to return path or default
    const returnPath = handoffData?.returnPath || "/browse/gallery";
    goto(returnPath);
  }

  // ============================================================================
  // PLAYBACK CONTROLS
  // ============================================================================

  function handlePlaybackToggle() {
    playbackController?.togglePlayback();
  }

  function handleBpmChange(newBpm: number) {
    hapticService?.trigger("selection");
    const speedMultiplier = newBpm / 60;
    playbackController?.setSpeed(speedMultiplier);
    // Update URL param
    updateUrlParam("bpm", String(newBpm));
  }

  function handleStepClick(stepIndex: number) {
    if (swipeDismiss.state.blockClicks) return;
    if (editingPane !== 'image' || isPlayingLocal) return;

    if (playbackController) {
      hapticService?.trigger("selection");
      const targetStep = stepIndex + 1;
      modalAnimationState.setCurrentStep(targetStep);
      playbackController.seekToStep(targetStep);
    }
  }

  // ============================================================================
  // FOCUS MODE
  // ============================================================================

  function enterEditMode(pane: 'animation' | 'image') {
    hapticService?.trigger("selection");
    editingPane = pane;

    if (!isMobile && !isFullscreen) {
      isFullscreen = true;
    }

    accessibilityHelper.announce(`${pane === 'animation' ? 'Animation' : 'Image'} expanded. Tap to collapse.`);
  }

  function exitEditMode() {
    hapticService?.trigger("selection");
    editingPane = null;

    if (!isMobile && isFullscreen) {
      isFullscreen = false;
      fullscreenControlsVisible = false;
    }

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
      returnPath: $page.url.pathname,
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

  function handleSave() {
    hapticService?.trigger("selection");
    if (!authState.isAuthenticated) {
      showToast("Sign in to save sequences", "info");
      return;
    }
    showToast("Save feature coming soon", "info");
  }

  function handleShare() {
    hapticService?.trigger("selection");
    const shareUrl = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: sequence?.word || "Sequence",
        text: `Check out this TKA sequence: ${sequence?.word || ""}`,
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Link copied to clipboard", "success");
      }).catch(() => {
        showToast("Could not copy link", "error");
      });
    }
  }

  function handleUnifiedDarkModeToggle() {
    hapticService?.trigger("selection");
    const newValue = !imgDarkMode;
    imageComposition.setDarkMode(newValue);
    animationVisibility.setDarkMode(newValue);
  }

  // ============================================================================
  // KEYBOARD HANDLING
  // ============================================================================

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (isFullscreen) {
        exitFullscreen();
      } else if (isExportMode) {
        exitExportMode();
      } else {
        handleBack();
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
    }
  }

  // ============================================================================
  // SWIPE HANDLING (MOBILE)
  // ============================================================================

  function handleTouchStart(e: TouchEvent) {
    if (!isMobile || isFullscreen || isExportMode) return;
    swipeDismiss.handleTouchStart(e);
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isMobile || isFullscreen || isExportMode) return;
    const handled = swipeDismiss.handleTouchMove(e);
    if (handled && e.cancelable) {
      e.preventDefault();
    }
  }

  async function handleTouchEnd() {
    const shouldDismiss = swipeDismiss.handleTouchEnd();
    if (shouldDismiss) {
      handleBack();
    }
  }

  // ============================================================================
  // URL HELPERS
  // ============================================================================

  function updateUrlParam(key: string, value: string) {
    if (!browser) return;
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.replaceState({}, "", url.toString());
  }
</script>

<svelte:head>
  <title>{sequence?.word || sequence?.name || "Sequence"} - TKA Scribe</title>
  <meta
    name="description"
    content={sequence?.word
      ? `View the "${sequence.word}" flow sequence in TKA Scribe`
      : "View this flow sequence in TKA Scribe"}
  />
</svelte:head>

<div
  class="sequence-route-page"
  bind:this={pageContainer}
  data-fullscreen={isFullscreen}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
>
  {#if isLoading}
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Loading sequence...</p>
    </div>
  {:else if loadError || !sequence}
    <div class="error-container">
      <div class="error-card">
        <i class="fas fa-exclamation-circle error-icon" aria-hidden="true"></i>
        <h1>Sequence Not Found</h1>
        <p>{loadError || "This sequence could not be loaded."}</p>
        <button class="back-button" onclick={() => goto("/browse/gallery")}>
          Browse Sequences
        </button>
      </div>
    </div>
  {:else}
    <!-- Header -->
    <RouteViewerHeader
      {isExportMode}
      {exportType}
      {isFullscreen}
      {isMobile}
      darkMode={imgDarkMode}
      returnLabel={handoffData?.returnLabel || "Back"}
      isSyncActive={lanSyncState.isActive}
      isSyncConnected={lanSyncState.isConnected}
      {isSyncToggling}
      onBack={handleBack}
      onExitExportMode={exitExportMode}
      onBackToExportTypeSelection={backToExportTypeSelection}
      onSyncToggle={handleSyncToggle}
      onOpenInCompose={() => handleOpenInCompose('stagger')}
      onDarkModeToggle={() => handleUnifiedDarkModeToggle()}
      onEnterFullscreen={enterFullscreen}
    />

    <!-- Main content - view-transition-name matches ChoreoCard thumbnail for morph animation -->
    <div
      class="route-body-content"
      data-fullscreen={isFullscreen}
      style:view-transition-name="sequence-{sequence?.id || 'viewer'}"
      onclick={isFullscreen ? handleFullscreenTap : undefined}
      onkeydown={isFullscreen ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleFullscreenTap(); } : undefined}
      role={isFullscreen ? "button" : undefined}
      tabindex={isFullscreen ? 0 : undefined}
    >
      {#if isFullscreen}
        <FullscreenControls
          visible={fullscreenControlsVisible}
          {viewMode}
          isPlaying={isPlayingLocal}
          bpm={bpmLocal}
          onExit={exitFullscreen}
          onPlaybackToggle={handlePlaybackToggle}
          onStepHalfBeatBackward={() => playbackController?.stepHalfBeatBackward()}
          onStepHalfBeatForward={() => playbackController?.stepHalfBeatForward()}
          onStepFullBeatBackward={() => playbackController?.stepFullBeatBackward()}
          onStepFullBeatForward={() => playbackController?.stepFullBeatForward()}
          onBpmChange={handleBpmChange}
        />
      {/if}

      {#if hasSequence && effectiveSequence}
        {#if isExportMode}
          <ExportModeContent
            sequence={effectiveSequence}
            {exportType}
            {exportOptions}
            animationState={modalAnimationState}
            {animationLoading}
            currentStep={currentStepLocal}
            {currentLetter}
            {currentStepData}
            userName={authState.user?.displayName || ""}
            {bluePropType}
            {redPropType}
            {catDogModeEnabled}
            onSelectType={selectExportType}
            onCanvasReady={handleCanvasReady}
          />
        {:else}
          <ViewerSplitPane
            sequence={effectiveSequence}
          animationState={modalAnimationState}
          {animationLoading}
          currentStep={currentStepLocal}
          isPlaying={isPlayingLocal}
          {currentLetter}
          {currentStepData}
          {highlightedStepIndex}
          {imgShowWord}
          {imgShowDifficulty}
          {imgShowStartPos}
          {imgShowCreatorName}
          {imgShowNotes}
          {imgDarkMode}
          {imgColumnCount}
          userName={authState.user?.displayName || ""}
          {bluePropType}
          {redPropType}
          {catDogModeEnabled}
          {isFullscreen}
          {fullscreenStackVertical}
          {isMobile}
          focusedPane={editingPane}
          onFocusPane={enterEditMode}
          onUnfocusPane={exitEditMode}
          onStepClick={handleStepClick}
          onCanvasReady={handleCanvasReady}
        />
        {/if}
      {/if}
    </div>

    <!-- Footer -->
    {#if !isFullscreen}
      {#if isExportMode}
        <ExportFooter
          {exportType}
          {isExporting}
          {exportProgress}
          {exportError}
          {isFullscreen}
          onExport={handleExport}
          onCancel={() => sequenceModalExporter.cancel()}
          onRetry={() => { sequenceModalExporter.clearError(); handleExport(); }}
        />
      {:else if isMobile}
        <MorphingFooter
          bpm={bpmLocal}
          isPlaying={isPlayingLocal}
          isLoggedIn={authState.isAuthenticated}
          darkMode={imgDarkMode}
          onBpmChange={handleBpmChange}
          onPlayPause={handlePlaybackToggle}
          onStepBack={() => playbackController?.stepFullBeatBackward()}
          onStepForward={() => playbackController?.stepFullBeatForward()}
          onStepHalfBack={() => playbackController?.stepHalfBeatBackward()}
          onStepHalfForward={() => playbackController?.stepHalfBeatForward()}
          onSave={handleSave}
          onCompose={() => handleOpenInCompose()}
          onShare={handleShare}
          onExport={enterExportMode}
          onDarkModeToggle={handleUnifiedDarkModeToggle}
        />
      {:else}
        <ViewerFooter
          bpm={bpmLocal}
          isPlaying={isPlayingLocal}
          isLoggedIn={authState.isAuthenticated}
          onBpmChange={handleBpmChange}
          onPlayPause={handlePlaybackToggle}
          onStepBack={() => playbackController?.stepFullBeatBackward()}
          onStepForward={() => playbackController?.stepFullBeatForward()}
          onStepHalfBack={() => playbackController?.stepHalfBeatBackward()}
          onStepHalfForward={() => playbackController?.stepHalfBeatForward()}
          onSave={handleSave}
          onCompose={() => handleOpenInCompose()}
          onShare={handleShare}
          onExport={enterExportMode}
        />
      {/if}
    {/if}
  {/if}
</div>

<!-- Screen reader announcements -->
<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
  {accessibilityHelper.announcement}
</div>

<style>
  .sequence-route-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }

  .route-body-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .route-body-content[data-fullscreen="true"] {
    position: relative;
  }

  /* Loading state */
  .loading-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #f43f5e);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-container p {
    font-size: var(--font-size-sm, 14px);
    margin: 0;
  }

  /* Error state */
  .error-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .error-card {
    text-align: center;
    padding: 2rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 1rem;
    max-width: 400px;
  }

  .error-icon {
    font-size: 48px;
    color: var(--semantic-error, #ef4444);
    margin-bottom: 1rem;
  }

  .error-card h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0 0 0.5rem 0;
  }

  .error-card p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0 0 1.5rem 0;
    font-size: var(--font-size-sm, 14px);
  }

  .back-button {
    min-height: 48px;
    padding: 0.75rem 1.5rem;
    background: var(--theme-accent, #f43f5e);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: filter var(--duration-normal, 200ms) ease;
  }

  .back-button:hover {
    filter: brightness(1.1);
  }

  .back-button:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  /* Screen reader only */
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

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
