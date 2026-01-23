<!--
  SequenceDetailsModal.svelte

  Full-screen viewer for sequence details with view and export capabilities.

  Architecture:
  - Desktop: 85% viewport modal with backdrop click to close
  - Mobile: 100% full-screen takeover

  View Modes:
  - Split: Animation on top, Image on bottom (mobile) or side-by-side (desktop)
  - Animation: Full-screen animation with inline visibility chips
  - Image: Full-screen choreo card with inline visibility chips

  Mobile Split View:
  - Tap either media to expand it temporarily with visibility controls
  - Uses existing TransportControls and BpmChips primitives
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { ISequenceLoopabilityChecker } from "$lib/features/compose/services/contracts/ISequenceLoopabilityChecker";
  import type { ISequenceRepository } from "$lib/features/create/shared/services/contracts/ISequenceRepository";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IVideoExportOrchestrator, VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
  import type { ISequenceRenderer } from "$lib/shared/share/services/contracts/ISequenceRenderer";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { container } from "$lib/shared/di";
  import { createAnimationPanelState, type PlaybackMode, type AnimationStateKey } from "$lib/features/compose/state/animation-panel-state.svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import LayeredSequencePreview from "./LayeredSequencePreview.svelte";
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import BpmChips from "$lib/features/compose/components/controls/BpmChips.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { setAnimationPlaybackRef } from "$lib/shared/coordinators/animation-playback-ref.svelte";
  import { getAnimationVisibilityManager, type TrailStyle } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import StaggerModeModal from "./stagger/StaggerModeModal.svelte";
  import SimilarSequencesPanel from "./SimilarSequencesPanel.svelte";
  import {
    getExportOptionsState,
    type VideoFps,
    type GridStepSize,
    type CompositeOrientation,
  } from "../state/export-options-state.svelte";
  // LAN Sync
  import SyncFab from "$lib/shared/lan-sync/components/SyncFab.svelte";
  import SyncConnectionSheet from "$lib/shared/lan-sync/components/SyncConnectionSheet.svelte";
  import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
  import {
    setSequenceModalUrl,
    setViewModeUrl,
    setStaggerModeUrl,
    setPlaybackTimeUrl,
    setBpmUrl,
    clearModalUrlState,
    getModalUrlState,
    cacheSequence,
    type SequenceViewMode,
  } from "$lib/shared/application/state/ui/modal-url-state.svelte";

  // Types
  export type ViewMode = "animation" | "image" | "split";

  interface Props {
    open: boolean;
    sequence: SequenceData;
    onclose: () => void;
    /** Initial BPM to restore (for HMR/refresh persistence) */
    initialBpm?: number;
    /** Initial playback time in ms to restore (for HMR/refresh persistence) */
    initialPlaybackTimeMs?: number;
    /** Initial view mode to restore */
    initialViewMode?: ViewMode;
    /** Whether to open stagger mode immediately */
    initialStaggerOpen?: boolean;
  }

  let {
    open = $bindable(false),
    sequence,
    onclose,
    initialBpm,
    initialPlaybackTimeMs,
    initialViewMode,
    initialStaggerOpen,
  }: Props = $props();

  // View mode state (persisted via localStorage, but prefer initialViewMode if provided)
  let viewMode = $state<ViewMode>(initialViewMode || loadViewMode());

  // Stagger mode state
  let staggerModeOpen = $state(initialStaggerOpen || false);

  // Export mode state
  let isExportMode = $state(false);
  const exportOptions = getExportOptionsState();

  // LAN Sync state
  let syncSheetOpen = $state(false);

  // Similar sequences state (for comparison panel)
  let allSequences = $state<readonly SequenceData[]>([]);

  // Which pane is in edit mode: null, 'animation', or 'image'
  let editingPane = $state<'animation' | 'image' | null>(null);

  function enterEditMode(pane: 'animation' | 'image') {
    hapticService?.trigger("impact"); // Heavier feedback for mode expansion
    editingPane = pane;
  }

  function exitEditMode() {
    hapticService?.trigger("selection"); // Lighter feedback for collapse
    editingPane = null;
  }

  // Export mode functions
  function enterExportMode() {
    hapticService?.trigger("selection");
    isExportMode = true;
    // Pause playback when entering export mode
    if (isPlayingLocal && playbackController) {
      playbackController.togglePlayback();
    }
  }

  function exitExportMode() {
    hapticService?.trigger("selection");
    isExportMode = false;
  }

  // Fullscreen state (morph-to-fullscreen instead of SpotlightViewer)
  let isFullscreen = $state(false);
  let fullscreenControlsVisible = $state(false);
  let controlsHideTimeout: ReturnType<typeof setTimeout> | null = null;

  function enterFullscreen() {
    hapticService?.trigger("selection");
    isFullscreen = true;
    showFullscreenControls();
  }

  function exitFullscreen() {
    hapticService?.trigger("selection");
    isFullscreen = false;
    fullscreenControlsVisible = false;
    clearControlsTimeout();
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

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isFullscreen) {
      event.preventDefault();
      event.stopPropagation();
      exitFullscreen();
    }
  }

  // Sync fullscreen state to dialog element (BaseModal doesn't pass data attributes through)
  $effect(() => {
    const dialog = document.querySelector("dialog.sequence-details-modal") as HTMLDialogElement | null;
    if (dialog) {
      if (isFullscreen) {
        dialog.setAttribute("data-fullscreen", "true");
      } else {
        dialog.removeAttribute("data-fullscreen");
      }
    }
  });

  function loadViewMode(): ViewMode {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("tka_sequence_details_view_mode");
      // If saved mode is "image", default to "split" instead
      // (spacebar implies wanting to see animation, not static image)
      if (saved === "animation" || saved === "split") {
        return saved;
      }
      // "image" saved mode gets converted to "split" so animation is visible
      if (saved === "image") {
        return "split";
      }
    }
    return "split";
  }

  function saveViewMode(mode: ViewMode) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("tka_sequence_details_view_mode", mode);
    }
  }

  // Animation visibility (global singleton)
  const animationVisibility = getAnimationVisibilityManager();
  let animTrailStyle = $state<TrailStyle>(animationVisibility.getTrailStyle());
  let animTkaGlyph = $state(animationVisibility.getVisibility("tkaGlyph"));
  let animWordHeader = $state(animationVisibility.getVisibility("wordHeader"));

  // Image visibility (local state, persisted to localStorage)
  let imgShowWord = $state(loadImageSetting("word", true));
  let imgShowStartPos = $state(loadImageSetting("startPos", true));
  let imgShowDifficulty = $state(loadImageSetting("difficulty", true));
  let imgShowCreatorName = $state(loadImageSetting("creatorName", true));
  let imgShowNotes = $state(loadImageSetting("notes", true));
  let imgDarkMode = $state(loadImageSetting("darkMode", false));

  function loadImageSetting(key: string, defaultValue: boolean): boolean {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(`tka_seq_details_img_${key}`);
      if (saved !== null) return saved === "true";
    }
    return defaultValue;
  }

  function saveImageSetting(key: string, value: boolean) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(`tka_seq_details_img_${key}`, String(value));
    }
  }

  function toggleAnimSetting(key: "trailStyle" | "tkaGlyph" | "wordHeader") {
    hapticService?.trigger("selection");
    if (key === "trailStyle") {
      const newStyle = animTrailStyle === "on" ? "off" : "on";
      animTrailStyle = newStyle;
      animationVisibility.setTrailStyle(newStyle);
    } else if (key === "tkaGlyph") {
      animTkaGlyph = !animTkaGlyph;
      animationVisibility.setVisibility("tkaGlyph", animTkaGlyph);
    } else if (key === "wordHeader") {
      animWordHeader = !animWordHeader;
      animationVisibility.setVisibility("wordHeader", animWordHeader);
    }
  }

  function toggleImgSetting(key: "word" | "startPos" | "difficulty" | "creatorName" | "notes" | "darkMode") {
    hapticService?.trigger("selection");
    switch (key) {
      case "word":
        imgShowWord = !imgShowWord;
        saveImageSetting("word", imgShowWord);
        break;
      case "startPos":
        imgShowStartPos = !imgShowStartPos;
        saveImageSetting("startPos", imgShowStartPos);
        break;
      case "difficulty":
        imgShowDifficulty = !imgShowDifficulty;
        saveImageSetting("difficulty", imgShowDifficulty);
        break;
      case "creatorName":
        imgShowCreatorName = !imgShowCreatorName;
        saveImageSetting("creatorName", imgShowCreatorName);
        break;
      case "notes":
        imgShowNotes = !imgShowNotes;
        saveImageSetting("notes", imgShowNotes);
        break;
      case "darkMode":
        imgDarkMode = !imgDarkMode;
        saveImageSetting("darkMode", imgDarkMode);
        break;
    }
  }

  // Services (lazy-loaded)
  let playbackController: IAnimationPlaybackController | null = null;
  let loopabilityChecker: ISequenceLoopabilityChecker | null = null;
  let sequenceRepository: ISequenceRepository | null = null;
  let hapticService: IHapticFeedback | null = null;
  let videoExportOrchestrator: IVideoExportOrchestrator | null = null;
  let sequenceRenderer: ISequenceRenderer | null = null;

  // Export state
  let isExporting = $state(false);
  let exportProgress = $state<VideoExportProgress | null>(null);
  let animationCanvas = $state<HTMLCanvasElement | null>(null);

  function handleCanvasReady(canvas: HTMLCanvasElement | null) {
    animationCanvas = canvas;
  }

  // Isolated animation state (NOT shared with workspace)
  const modalAnimationState = createAnimationPanelState();
  let animationServicesReady = $state(false);
  let animationLoading = $state(false);
  let lastLoadedSequenceId: string | null = null;

  // Local reactive state for animation (synced via observer pattern)
  let isPlayingLocal = $state(false);
  let currentStepLocal = $state(0);
  let bpmLocal = $state(60);
  let cleanupAnimationStateSubscription: (() => void) | undefined;

  // Step highlighting for LayeredSequencePreview (0-indexed)
  let highlightedStepIndex = $derived.by(() => {
    if (!isPlayingLocal || currentStepLocal < 1) return null;
    return Math.floor(currentStepLocal) - 1;
  });

  // Subscribe to animation state changes
  cleanupAnimationStateSubscription = modalAnimationState.subscribe(
    (key: AnimationStateKey, value: unknown) => {
      switch (key) {
        case "isPlaying":
          isPlayingLocal = value as boolean;
          // When playback stops, save the current position to URL
          if (!(value as boolean)) {
            const timeMs = calculatePlaybackTimeMs(currentStepLocal, bpmLocal);
            setPlaybackTimeUrl(timeMs, true);
          }
          // Broadcast to sync peers
          lanSyncState.updatePlayback({ isPlaying: value as boolean });
          break;
        case "currentStep":
          currentStepLocal = value as number;
          // Periodically update URL with current position (debounced internally)
          if (isPlayingLocal) {
            const timeMs = calculatePlaybackTimeMs(value as number, bpmLocal);
            setPlaybackTimeUrl(timeMs);
          }
          // Broadcast to sync peers
          lanSyncState.updatePlayback({ currentStep: value as number });
          break;
        case "speed":
          // Convert speed multiplier to BPM (speed 1.0 = 60 BPM)
          bpmLocal = Math.round((value as number) * 60);
          // Broadcast to sync peers
          lanSyncState.updatePlayback({ speed: value as number });
          break;
      }
    }
  );

  // Track last applied sync timestamp to avoid feedback loops
  let lastAppliedSyncTimestamp = 0;

  // Listen for incoming sync state changes from remote peers
  $effect(() => {
    const playback = lanSyncState.playbackState;
    if (!lanSyncState.isConnected || !playbackController) return;

    // Check if this is a remote update (timestamp changed)
    if (playback.timestamp > lastAppliedSyncTimestamp) {
      lastAppliedSyncTimestamp = playback.timestamp;

      // Apply remote state changes
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

  // Calculate playback time in milliseconds from step and BPM
  function calculatePlaybackTimeMs(step: number, bpm: number): number {
    const msPerBeat = 60000 / bpm;
    return Math.round(step * msPerBeat);
  }

  // Calculate step from playback time in milliseconds
  function calculateStepFromTimeMs(timeMs: number, bpm: number): number {
    const msPerBeat = 60000 / bpm;
    return timeMs / msPerBeat;
  }

  // Load animation services
  async function loadServices() {
    try {
      playbackController = container.items.animationPlaybackController;
      loopabilityChecker = container.items.sequenceLoopabilityChecker;
      sequenceRepository = container.items.sequenceRepository;
      hapticService = container.items.hapticFeedback;
      videoExportOrchestrator = container.items.videoExportOrchestrator;
      sequenceRenderer = container.items.sequenceRenderer;
      animationServicesReady = true;
    } catch (error) {
      console.error("[SequenceDetailsModal] Failed to load services:", error);
      modalAnimationState.setError("Failed to load animation services");
    }
  }

  // Initialize animation when open and services ready
  async function initializeAnimation(seq: SequenceData) {
    if (!playbackController || !sequenceRepository) return;

    const sequenceId = seq.id || seq.word || "unknown";
    if (sequenceId === lastLoadedSequenceId) return;

    animationLoading = true;
    modalAnimationState.setLoading(true);
    modalAnimationState.setError(null);

    try {
      const loadedSequence = await loadSequenceData(seq);
      if (!loadedSequence) throw new Error("Failed to load sequence");

      modalAnimationState.setShouldLoop(true);
      const success = playbackController.initialize(loadedSequence, modalAnimationState);
      if (!success) throw new Error("Failed to initialize playback");

      setAnimationPlaybackRef(playbackController);

      lastLoadedSequenceId = sequenceId;
      modalAnimationState.setSequenceData(loadedSequence);

      // Restore BPM if provided
      if (initialBpm && initialBpm !== 60) {
        const speedMultiplier = initialBpm / 60;
        playbackController.setSpeed(speedMultiplier);
        bpmLocal = initialBpm;
      }

      // Restore playback position if provided
      if (initialPlaybackTimeMs && initialPlaybackTimeMs > 0) {
        const targetStep = calculateStepFromTimeMs(initialPlaybackTimeMs, initialBpm || 60);
        playbackController.jumpToStep(targetStep);
        currentStepLocal = targetStep;
      }

      // Auto-start after brief delay (only if viewing animation)
      setTimeout(() => {
        if (viewMode !== "image") {
          playbackController?.togglePlayback();
        }
      }, 300);
    } catch (err) {
      console.warn("[SequenceDetailsModal] Animation not available:", err);
      modalAnimationState.setError("Animation data not available");
    } finally {
      animationLoading = false;
      modalAnimationState.setLoading(false);
    }
  }

  async function loadSequenceData(seq: SequenceData): Promise<SequenceData | null> {
    if (!sequenceRepository) return ensureWordPopulated(seq);

    const hasMotionData = (s: SequenceData) =>
      Array.isArray(s.steps) &&
      s.steps.length > 0 &&
      s.steps.some((step) => step?.motions?.blue && step?.motions?.red);

    if (hasMotionData(seq)) return ensureWordPopulated(seq);

    const galleryId = seq.word || seq.name;
    if (galleryId) {
      const hydrated = await sequenceRepository.getSequence(galleryId);
      if (hydrated && hasMotionData(hydrated)) return ensureWordPopulated(hydrated);
    }

    return ensureWordPopulated(seq);
  }

  function ensureWordPopulated(seq: SequenceData): SequenceData {
    if (seq.word) return seq;
    const derivedWord = seq.steps
      ?.filter((step) => !!step.letter)
      .map((step) => step.letter)
      .join("") || "";
    if (!derivedWord) return seq;
    return { ...seq, word: derivedWord };
  }

  // Event handlers
  function handleViewModeChange(mode: ViewMode) {
    hapticService?.trigger("selection");
    viewMode = mode;
    saveViewMode(mode);

    // Sync to URL for HMR persistence
    setViewModeUrl(mode as SequenceViewMode);

    if (mode === "image" && isPlayingLocal) {
      playbackController?.togglePlayback();
    }
    if ((mode === "animation" || mode === "split") && !isPlayingLocal && animationServicesReady) {
      playbackController?.togglePlayback();
    }
  }

  function handlePlaybackToggle() {
    playbackController?.togglePlayback();
  }

  function handleBpmChange(newBpm: number) {
    hapticService?.trigger("selection");
    // Convert BPM to speed multiplier (60 BPM = 1.0 speed)
    const speedMultiplier = newBpm / 60;
    playbackController?.setSpeed(speedMultiplier);
    // Sync BPM to URL for persistence
    setBpmUrl(newBpm);
  }

  function handleStepClick(stepIndex: number) {
    if (playbackController) {
      hapticService?.trigger("selection");
      const targetStep = stepIndex + 1;
      modalAnimationState.setCurrentStep(targetStep);
      playbackController.jumpToStep(targetStep);
    }
  }

  function handleClose() {
    if (isPlayingLocal && playbackController) {
      playbackController.togglePlayback();
    }
    setAnimationPlaybackRef(null);
    // Clear URL state when closing modal
    clearModalUrlState();
    // Disconnect from LAN sync if connected
    if (lanSyncState.isConnected) {
      lanSyncState.disconnect();
    }
    onclose();
  }

  // Export handlers
  async function handleExport() {
    if (isExporting) return;

    hapticService?.trigger("selection");

    // Route to appropriate export based on view mode
    switch (viewMode) {
      case "split":
        await handleSplitExport();
        break;
      case "animation":
        await handleAnimationExport();
        break;
      case "image":
        await handleImageExport();
        break;
    }
  }

  async function handleSplitExport() {
    if (!videoExportOrchestrator || !playbackController || !animationCanvas) {
      showToast("Export services not ready", "error");
      return;
    }

    const opts = exportOptions.getSplitOptions();
    isExporting = true;
    exportProgress = { progress: 0, stage: "capturing" };

    try {
      await videoExportOrchestrator.executeExport(
        animationCanvas,
        playbackController,
        modalAnimationState,
        (progress) => {
          exportProgress = progress;
          if (progress.stage === "complete") {
            hapticService?.trigger("success");
            showToast("Video exported!", "success");
            exitExportMode();
          } else if (progress.stage === "error") {
            hapticService?.trigger("error");
            showToast(progress.error || "Export failed", "error");
          }
        },
        {
          compositeMode: opts.compositeOrientation,
          gridStepSize: opts.gridStepSize,
          showStepNumbers: opts.showStepNumbers,
          includeStartPosition: opts.includeStartPosition,
          fps: opts.fps,
          loopCount: opts.loopCount,
        }
      );
    } catch (error) {
      if ((error as Error).message !== "Export cancelled") {
        console.error("[SequenceDetailsModal] Export failed:", error);
        showToast("Export failed", "error");
      }
    } finally {
      isExporting = false;
      exportProgress = null;
    }
  }

  async function handleAnimationExport() {
    if (!videoExportOrchestrator || !playbackController || !animationCanvas) {
      showToast("Export services not ready", "error");
      return;
    }

    const opts = exportOptions.getVideoOptions();
    isExporting = true;
    exportProgress = { progress: 0, stage: "capturing" };

    try {
      await videoExportOrchestrator.executeExport(
        animationCanvas,
        playbackController,
        modalAnimationState,
        (progress) => {
          exportProgress = progress;
          if (progress.stage === "complete") {
            hapticService?.trigger("success");
            showToast("Video exported!", "success");
            exitExportMode();
          } else if (progress.stage === "error") {
            hapticService?.trigger("error");
            showToast(progress.error || "Export failed", "error");
          }
        },
        {
          compositeMode: "none",
          fps: opts.fps,
          loopCount: opts.loopCount,
        }
      );
    } catch (error) {
      if ((error as Error).message !== "Export cancelled") {
        console.error("[SequenceDetailsModal] Export failed:", error);
        showToast("Export failed", "error");
      }
    } finally {
      isExporting = false;
      exportProgress = null;
    }
  }

  async function handleImageExport() {
    if (!sequenceRenderer || !sequence) {
      showToast("Export services not ready", "error");
      return;
    }

    const opts = exportOptions.getImageOptions();
    isExporting = true;

    try {
      const blob = await sequenceRenderer.renderSequenceToBlob(sequence, {
        stepSize: 240,
        format: "PNG",
        quality: 1.0,
        includeStartPosition: opts.includeStartPosition,
        addStepNumbers: opts.showStepNumbers,
        addWord: opts.showWord,
        addDifficultyLevel: opts.showDifficulty,
        addUserInfo: opts.showCreatorName || opts.showNotes,
        userName: authState.user?.displayName ?? "",
        showCreatorName: opts.showCreatorName,
        showNotes: opts.showNotes,
        showBirthday: true,
        addReversalSymbols: true,
        visibilityOverrides: {
          darkMode: opts.darkMode,
        },
      });

      // Download the image
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sequence.word || "sequence"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      hapticService?.trigger("success");
      showToast("Image exported!", "success");
      exitExportMode();
    } catch (error) {
      console.error("[SequenceDetailsModal] Image export failed:", error);
      hapticService?.trigger("error");
      showToast("Export failed", "error");
    } finally {
      isExporting = false;
    }
  }

  function handleCancelExport() {
    videoExportOrchestrator?.cancelExport();
    isExporting = false;
    exportProgress = null;
    showToast("Export cancelled", "info");
  }

  // Effects
  $effect(() => {
    if (open && !animationServicesReady) {
      loadServices();
    }
  });

  // Sync modal state to URL when opening
  $effect(() => {
    if (open && sequence) {
      // Cache sequence for HMR restoration
      cacheSequence(sequence);
      // Update URL with modal state
      setSequenceModalUrl(sequence, viewMode as SequenceViewMode, staggerModeOpen);
    }
  });

  $effect(() => {
    if (open && animationServicesReady && sequence && playbackController) {
      initializeAnimation(sequence);
    }
  });

  $effect(() => {
    if (!open && lastLoadedSequenceId) {
      lastLoadedSequenceId = null;
      modalAnimationState.reset();
    }
  });

  onDestroy(() => {
    cleanupAnimationStateSubscription?.();
    clearControlsTimeout();
    if (playbackController) {
      playbackController.dispose();
    }
    modalAnimationState.dispose();
  });

  // Calculate preview aspect ratio to determine optimal fullscreen split layout
  let previewAspectRatio = $derived.by(() => {
    if (!sequence?.steps?.length) return 1;

    const layoutService = container.items.layoutCalculator;
    const stepCount = sequence.steps.length;

    // Use the existing calculateThumbnailAspectRatio method which accounts for header/footer
    return layoutService.calculateThumbnailAspectRatio(stepCount, {
      includeStartPosition: imgShowStartPos,
      hasHeader: imgShowWord,
      hasFooter: imgShowCreatorName || imgShowNotes,
    });
  });

  // Wide sequences (aspect > 1.3) stack vertically in fullscreen (animation top, preview bottom)
  // Tall/square sequences stack horizontally (animation left, preview right)
  let fullscreenStackVertical = $derived(previewAspectRatio > 1.3);
</script>

<svelte:window onkeydown={handleKeydown} />

<BaseModal
  bind:open
  onclose={() => handleClose()}
  size="full"
  animation="pop"
  closeOnEscape={!isFullscreen}
  closeOnBackdrop={!isFullscreen}
  class="sequence-details-modal"
>
  {#snippet header()}
    {#if isExportMode}
      <!-- Export mode header -->
      <header class="details-header export-header" data-hidden={isFullscreen}>
        <div class="header-left">
          <button
            type="button"
            class="close-button"
            onclick={exitExportMode}
            aria-label="Back to viewer"
          >
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
          </button>
        </div>

        <div class="header-center">
          <h2 class="export-title">
            Export {viewMode === "image" ? "Image" : "Video"}
          </h2>
        </div>

        <div class="header-right">
          <!-- Spacer to balance layout -->
        </div>
      </header>
    {:else}
      <!-- Normal viewer header -->
      <header class="details-header" data-hidden={isFullscreen}>
        <div class="header-left">
          <button
            type="button"
            class="close-button"
            onclick={handleClose}
            aria-label="Close"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>

        <div class="header-center">
          <h2 class="sequence-title">{sequence?.word || "Sequence"}</h2>
        </div>

        <div class="header-right">
          <SyncFab onclick={() => { syncSheetOpen = true; }} />
          <button
            type="button"
            class="header-icon-btn"
            onclick={() => toggleImgSetting("darkMode")}
            aria-label={imgDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={imgDarkMode ? "Light mode" : "Dark mode"}
          >
            <i class="fas {imgDarkMode ? 'fa-moon' : 'fa-sun'}" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="header-icon-btn"
            onclick={enterFullscreen}
            aria-label="Enter fullscreen"
            title="Fullscreen"
          >
            <i class="fas fa-expand" aria-hidden="true"></i>
          </button>
        </div>
      </header>
    {/if}
  {/snippet}

  <div
    class="modal-body-content"
    data-view-mode={viewMode}
    data-fullscreen={isFullscreen}
    onclick={isFullscreen ? handleFullscreenTap : undefined}
    role={isFullscreen ? "button" : undefined}
    tabindex={isFullscreen ? 0 : undefined}
  >
    <!-- Fullscreen floating controls overlay -->
    {#if isFullscreen}
      <div class="fullscreen-overlay-controls" class:visible={fullscreenControlsVisible}>
        <button
          type="button"
          class="fs-close-btn"
          onclick={(e) => { e.stopPropagation(); exitFullscreen(); }}
          aria-label="Exit fullscreen"
        >
          <i class="fas fa-compress" aria-hidden="true"></i>
        </button>

        {#if viewMode !== "image"}
          <div class="fs-transport" onclick={(e) => e.stopPropagation()}>
            <TransportControls
              isPlaying={isPlayingLocal}
              onPlaybackToggle={handlePlaybackToggle}
              onStepHalfBeatBackward={() => playbackController?.stepHalfBeatBackward()}
              onStepHalfBeatForward={() => playbackController?.stepHalfBeatForward()}
              onStepFullBeatBackward={() => playbackController?.stepFullBeatBackward()}
              onStepFullBeatForward={() => playbackController?.stepFullBeatForward()}
            />
            <BpmChips
              bpm={bpmLocal}
              variant="compact"
              onBpmChange={handleBpmChange}
            />
          </div>
        {/if}
      </div>
    {/if}

    {#if isExportMode}
      <!-- Export mode: show preview and export options -->
      <div
        class="export-mode-container view-container"
        in:fade={{ duration: 250, delay: 50, easing: cubicOut }}
        out:fade={{ duration: 150, easing: cubicOut }}
      >
        <!-- Preview area (smaller) -->
        <div class="export-preview-area">
          {#if viewMode === "image"}
            <LayeredSequencePreview
              {sequence}
              showHighlight={false}
              showWord={exportOptions.imageShowWord}
              showStepNumbers={exportOptions.imageShowStepNumbers}
              showDifficultyLevel={exportOptions.imageShowDifficulty}
              includeStartPosition={exportOptions.imageIncludeStartPosition}
              showCreatorName={exportOptions.imageShowCreatorName}
              showNotes={exportOptions.imageShowNotes}
              showBirthday={true}
              showLoopGlyph={true}
              darkMode={exportOptions.imageDarkMode}
              userName={authState.user?.displayName || ""}
            />
          {:else}
            <!-- For video exports, show the animation canvas -->
            {#if animationLoading}
              <div class="loading-state">
                <div class="spinner"></div>
              </div>
            {:else if modalAnimationState.error}
              <div class="error-state">
                <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
                <span>{modalAnimationState.error}</span>
              </div>
            {:else}
              <AnimatorCanvas
                sequenceData={modalAnimationState.sequenceData}
                currentStep={currentStepLocal}
                isPlaying={false}
                blueProp={modalAnimationState.bluePropState}
                redProp={modalAnimationState.redPropState}
                gridMode={sequence?.gridMode}
                onCanvasReady={handleCanvasReady}
              />
            {/if}
          {/if}
        </div>

        <!-- Export options -->
        <div class="export-options-area">
          <div class="export-options-card">
            {#if viewMode === "image"}
              <!-- Image export options -->
              <div class="option-group">
                <span class="option-label">Include</span>
                <div class="option-chips">
                  <button
                    type="button"
                    class="chip"
                    class:active={exportOptions.imageShowWord}
                    onclick={() => exportOptions.setImageShowWord(!exportOptions.imageShowWord)}
                    aria-pressed={exportOptions.imageShowWord}
                  >Word</button>
                  <button
                    type="button"
                    class="chip"
                    class:active={exportOptions.imageIncludeStartPosition}
                    onclick={() => exportOptions.setImageIncludeStartPosition(!exportOptions.imageIncludeStartPosition)}
                    aria-pressed={exportOptions.imageIncludeStartPosition}
                  >Start</button>
                  <button
                    type="button"
                    class="chip"
                    class:active={exportOptions.imageShowDifficulty}
                    onclick={() => exportOptions.setImageShowDifficulty(!exportOptions.imageShowDifficulty)}
                    aria-pressed={exportOptions.imageShowDifficulty}
                  >Level</button>
                  <button
                    type="button"
                    class="chip"
                    class:active={exportOptions.imageShowCreatorName}
                    onclick={() => exportOptions.setImageShowCreatorName(!exportOptions.imageShowCreatorName)}
                    aria-pressed={exportOptions.imageShowCreatorName}
                  >Name</button>
                  <button
                    type="button"
                    class="chip"
                    class:active={exportOptions.imageShowNotes}
                    onclick={() => exportOptions.setImageShowNotes(!exportOptions.imageShowNotes)}
                    aria-pressed={exportOptions.imageShowNotes}
                  >Notes</button>
                  <button
                    type="button"
                    class="chip"
                    class:active={exportOptions.imageDarkMode}
                    onclick={() => exportOptions.setImageDarkMode(!exportOptions.imageDarkMode)}
                    aria-pressed={exportOptions.imageDarkMode}
                  >Dark</button>
                </div>
              </div>
            {:else if viewMode === "split"}
              <!-- Split video export options -->
              <div class="option-group">
                <span class="option-label">FPS</span>
                <div class="option-chips">
                  {#each [30, 50, 60] as fps}
                    <button
                      type="button"
                      class="chip"
                      class:active={exportOptions.splitFps === fps}
                      onclick={() => exportOptions.setSplitFps(fps as VideoFps)}
                      aria-pressed={exportOptions.splitFps === fps}
                    >{fps}</button>
                  {/each}
                </div>
              </div>
              <div class="option-group">
                <span class="option-label">Layout</span>
                <div class="option-chips">
                  <button
                    type="button"
                    class="chip"
                    class:active={exportOptions.splitOrientation === "horizontal"}
                    onclick={() => exportOptions.setSplitOrientation("horizontal")}
                    aria-pressed={exportOptions.splitOrientation === "horizontal"}
                  >Horizontal</button>
                  <button
                    type="button"
                    class="chip"
                    class:active={exportOptions.splitOrientation === "vertical"}
                    onclick={() => exportOptions.setSplitOrientation("vertical")}
                    aria-pressed={exportOptions.splitOrientation === "vertical"}
                  >Vertical</button>
                </div>
              </div>
              <div class="option-group">
                <span class="option-label">Grid Size</span>
                <div class="option-chips">
                  {#each [80, 120, 160] as size}
                    <button
                      type="button"
                      class="chip"
                      class:active={exportOptions.splitGridStepSize === size}
                      onclick={() => exportOptions.setSplitGridStepSize(size as GridStepSize)}
                      aria-pressed={exportOptions.splitGridStepSize === size}
                    >{size === 80 ? "S" : size === 120 ? "M" : "L"}</button>
                  {/each}
                </div>
              </div>
              <div class="option-group">
                <span class="option-label">Include</span>
                <div class="option-chips">
                  <button
                    type="button"
                    class="chip"
                    class:active={exportOptions.splitIncludeStartPosition}
                    onclick={() => exportOptions.setSplitIncludeStartPosition(!exportOptions.splitIncludeStartPosition)}
                    aria-pressed={exportOptions.splitIncludeStartPosition}
                  >Start</button>
                  <button
                    type="button"
                    class="chip"
                    class:active={exportOptions.splitShowStepNumbers}
                    onclick={() => exportOptions.setSplitShowStepNumbers(!exportOptions.splitShowStepNumbers)}
                    aria-pressed={exportOptions.splitShowStepNumbers}
                  >Numbers</button>
                </div>
              </div>
            {:else}
              <!-- Animation-only video export options -->
              <div class="option-group">
                <span class="option-label">FPS</span>
                <div class="option-chips">
                  {#each [30, 50, 60] as fps}
                    <button
                      type="button"
                      class="chip"
                      class:active={exportOptions.videoFps === fps}
                      onclick={() => exportOptions.setVideoFps(fps as VideoFps)}
                      aria-pressed={exportOptions.videoFps === fps}
                    >{fps}</button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {:else}
      <!-- Split view: Animation and Image side by side, tap to focus -->
      <div
        class="split-view view-container"
        data-fullscreen-stack={isFullscreen ? (fullscreenStackVertical ? 'vertical' : 'horizontal') : undefined}
        data-focused={editingPane}
        in:fade={{ duration: 250, delay: 50, easing: cubicOut }}
        out:fade={{ duration: 150, easing: cubicOut }}
      >
        <!-- Animation pane -->
        <button
          type="button"
          class="split-column animation-column"
          class:focused={editingPane === 'animation'}
          data-hidden={editingPane === 'image'}
          onclick={() => editingPane === 'animation' ? exitEditMode() : enterEditMode('animation')}
          aria-label={editingPane === 'animation' ? "Exit focus mode" : "Focus on animation"}
          aria-expanded={editingPane === 'animation'}
        >
          <div class="media-pane animation-pane">
            <!-- Close button - shown when focused -->
            {#if editingPane === 'animation'}
              <div
                class="pane-close-btn"
                role="button"
                tabindex="0"
                onclick={(e) => { e.stopPropagation(); exitEditMode(); }}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); exitEditMode(); }}}
                aria-label="Exit focus mode"
              >
                <i class="fas fa-times" aria-hidden="true"></i>
              </div>
            {/if}

            {#if animationLoading}
              <div class="loading-state">
                <div class="spinner"></div>
              </div>
            {:else if modalAnimationState.error}
              <div class="error-state">
                <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
                <span>{modalAnimationState.error}</span>
              </div>
            {:else}
              <AnimatorCanvas
                sequenceData={modalAnimationState.sequenceData}
                currentStep={currentStepLocal}
                isPlaying={isPlayingLocal}
                blueProp={modalAnimationState.bluePropState}
                redProp={modalAnimationState.redPropState}
                gridMode={sequence?.gridMode}
                onCanvasReady={handleCanvasReady}
              />
            {/if}
          </div>

          <!-- Visibility chips - shown when this pane is focused -->
          {#if editingPane === 'animation'}
            <div class="focus-mode-chips" onclick={(e) => e.stopPropagation()}>
              <button type="button" class="chip" class:active={animTrailStyle === "on"} onclick={() => toggleAnimSetting("trailStyle")} aria-pressed={animTrailStyle === "on"}>Trails</button>
              <button type="button" class="chip" class:active={animTkaGlyph} onclick={() => toggleAnimSetting("tkaGlyph")} aria-pressed={animTkaGlyph}>TKA</button>
              <button type="button" class="chip" class:active={animWordHeader} onclick={() => toggleAnimSetting("wordHeader")} aria-pressed={animWordHeader}>Word</button>
            </div>
          {/if}
        </button>

        <!-- Image/Preview pane -->
        <button
          type="button"
          class="split-column preview-column"
          class:focused={editingPane === 'image'}
          data-hidden={editingPane === 'animation'}
          onclick={() => editingPane === 'image' ? exitEditMode() : enterEditMode('image')}
          aria-label={editingPane === 'image' ? "Exit focus mode" : "Focus on image"}
          aria-expanded={editingPane === 'image'}
        >
          <div class="media-pane preview-pane">
            <!-- Close button - shown when focused -->
            {#if editingPane === 'image'}
              <div
                class="pane-close-btn"
                role="button"
                tabindex="0"
                onclick={(e) => { e.stopPropagation(); exitEditMode(); }}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); exitEditMode(); }}}
                aria-label="Exit focus mode"
              >
                <i class="fas fa-times" aria-hidden="true"></i>
              </div>
            {/if}

            <LayeredSequencePreview
              {sequence}
              highlightedStepIndex={highlightedStepIndex}
              showHighlight={isPlayingLocal}
              onStepClick={handleStepClick}
              showWord={imgShowWord}
              showStepNumbers={true}
              showDifficultyLevel={imgShowDifficulty}
              includeStartPosition={imgShowStartPos}
              showCreatorName={imgShowCreatorName}
              showNotes={imgShowNotes}
              showBirthday={true}
              showLoopGlyph={true}
              darkMode={imgDarkMode}
              userName={authState.user?.displayName || ""}
            />
          </div>

          <!-- Visibility chips - shown when this pane is focused -->
          {#if editingPane === 'image'}
            <div class="focus-mode-chips" onclick={(e) => e.stopPropagation()}>
              <button type="button" class="chip" class:active={imgShowWord} onclick={() => toggleImgSetting("word")} aria-pressed={imgShowWord}>Word</button>
              <button type="button" class="chip" class:active={imgShowStartPos} onclick={() => toggleImgSetting("startPos")} aria-pressed={imgShowStartPos}>Start</button>
              <button type="button" class="chip" class:active={imgShowDifficulty} onclick={() => toggleImgSetting("difficulty")} aria-pressed={imgShowDifficulty}>Level</button>
              <button type="button" class="chip" class:active={imgShowCreatorName} onclick={() => toggleImgSetting("creatorName")} aria-pressed={imgShowCreatorName}>Name</button>
              <button type="button" class="chip" class:active={imgShowNotes} onclick={() => toggleImgSetting("notes")} aria-pressed={imgShowNotes}>Notes</button>
            </div>
          {/if}
        </button>
      </div>
    {/if}
  </div>

  {#snippet footer()}
    {#if !isFullscreen}
      <footer class="controls-footer" data-hidden={isFullscreen}>
        {#if isExportMode}
          <!-- Export mode: prominent export button with progress -->
          <div
            class="export-footer-content"
            in:fade={{ duration: 200, delay: 50, easing: cubicOut }}
            out:fade={{ duration: 100, easing: cubicOut }}
          >
            {#if isExporting && exportProgress}
              <!-- Progress display during export -->
              <div class="export-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: {exportProgress.progress * 100}%"></div>
                </div>
                <span class="progress-text">{Math.round(exportProgress.progress * 100)}%</span>
                <button
                  type="button"
                  class="cancel-export-btn"
                  onclick={handleCancelExport}
                  aria-label="Cancel export"
                >
                  <i class="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
            {:else}
              <!-- Prominent export button -->
              <button
                type="button"
                class="primary-export-btn"
                onclick={handleExport}
                disabled={isExporting}
              >
                <i class="fas fa-download" aria-hidden="true"></i>
                Export {viewMode === "image" ? "Image" : "Video"}
              </button>
            {/if}
          </div>
        {:else}
          <!-- Transport controls and export -->
          <div
            class="footer-content"
            in:fade={{ duration: 200, delay: 50, easing: cubicOut }}
            out:fade={{ duration: 100, easing: cubicOut }}
          >
          <div class="transport-row">
            <TransportControls
              isPlaying={isPlayingLocal}
              onPlaybackToggle={handlePlaybackToggle}
              onStepHalfBeatBackward={() => playbackController?.stepHalfBeatBackward()}
              onStepHalfBeatForward={() => playbackController?.stepHalfBeatForward()}
              onStepFullBeatBackward={() => playbackController?.stepFullBeatBackward()}
              onStepFullBeatForward={() => playbackController?.stepFullBeatForward()}
            />
            <button
              type="button"
              class="stagger-btn"
              onclick={() => {
                staggerModeOpen = true;
                // Update URL to reflect stagger open
                setStaggerModeUrl(true);
              }}
              aria-label="Open stagger mode"
              title="Preview with multiple performers"
            >
              <i class="fas fa-users" aria-hidden="true"></i>
            </button>
          </div>
          <div class="bpm-row">
            <BpmChips
              bpm={bpmLocal}
              variant="compact"
              onBpmChange={handleBpmChange}
            />
            <!-- Export button -->
            <button
              type="button"
              class="export-btn-prominent"
              onclick={enterExportMode}
              aria-label="Export"
              title="Export"
            >
              <i class="fas fa-download" aria-hidden="true"></i>
              <span>Export</span>
            </button>
          </div>
          </div>
        {/if}
      </footer>
    {/if}
  {/snippet}
</BaseModal>

<StaggerModeModal
  bind:open={staggerModeOpen}
  {sequence}
  bpm={bpmLocal}
  onclose={() => {
    staggerModeOpen = false;
    // Update URL to reflect stagger closed
    setStaggerModeUrl(false);
  }}
/>

<SyncConnectionSheet
  bind:open={syncSheetOpen}
  sequenceId={sequence?.id || sequence?.word || "unknown"}
/>

<style>
  /* ===== FULLSCREEN MORPH STYLES ===== */

  /* Base modal transition for morphing effect - keep margin:auto for centering */
  :global(dialog.sequence-details-modal.base-modal) {
    transition:
      width 400ms cubic-bezier(0.32, 0.72, 0, 1),
      height 400ms cubic-bezier(0.32, 0.72, 0, 1),
      max-width 400ms cubic-bezier(0.32, 0.72, 0, 1),
      max-height 400ms cubic-bezier(0.32, 0.72, 0, 1),
      border-radius 400ms cubic-bezier(0.32, 0.72, 0, 1) !important;
  }

  /* Modal expands to viewport in fullscreen - use margin:auto to stay centered while growing */
  :global(dialog.sequence-details-modal.base-modal[data-fullscreen="true"]),
  :global(dialog.sequence-details-modal.base-modal[data-size="full"][data-fullscreen="true"]) {
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    border-radius: 0 !important;
    /* Keep margin:auto - the dialog stays centered as it grows to fill viewport */
    margin: auto !important;
  }

  :global(dialog.sequence-details-modal[data-fullscreen="true"] .modal-content-wrapper) {
    border-radius: 0 !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    height: 100% !important;
  }

  /* Header slide-fade out */
  .details-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
    transition:
      opacity var(--duration-normal, 200ms) var(--ease-out, ease-out),
      transform var(--duration-normal, 200ms) var(--ease-out, ease-out);
  }

  .details-header[data-hidden="true"] {
    opacity: 0;
    transform: translateY(-100%);
    pointer-events: none;
    position: absolute;
  }

  /* Footer slide-fade out */
  .controls-footer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    transition:
      opacity var(--duration-normal, 200ms) var(--ease-out, ease-out),
      transform var(--duration-normal, 200ms) var(--ease-out, ease-out);
  }

  .controls-footer[data-hidden="true"] {
    opacity: 0;
    transform: translateY(100%);
    pointer-events: none;
  }

  /* Content fills viewport in fullscreen */
  .modal-body-content[data-fullscreen="true"] {
    background: #000;
    position: relative;
  }

  .modal-body-content[data-fullscreen="true"] .split-view,
  .modal-body-content[data-fullscreen="true"] .single-view {
    padding: 0;
  }

  .modal-body-content[data-fullscreen="true"] .media-pane,
  .modal-body-content[data-fullscreen="true"] .media-container {
    padding: 0;
  }

  /* Hide settings buttons in fullscreen mode */
  .modal-body-content[data-fullscreen="true"] .pane-settings-btn {
    display: none;
  }

  /* Fullscreen split layout: Horizontal stack (animation left, preview right) - for tall/square sequences */
  .modal-body-content[data-fullscreen="true"] .split-view[data-fullscreen-stack="horizontal"] {
    flex-direction: row;
  }

  .modal-body-content[data-fullscreen="true"] .split-view[data-fullscreen-stack="horizontal"] .preview-column {
    border-top: none;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Fullscreen split layout: Vertical stack (animation top, preview bottom) - for wide sequences */
  .modal-body-content[data-fullscreen="true"] .split-view[data-fullscreen-stack="vertical"] {
    flex-direction: column;
  }

  .modal-body-content[data-fullscreen="true"] .split-view[data-fullscreen-stack="vertical"] .preview-column {
    border-left: none;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Ensure both columns can shrink/grow to fit in fullscreen */
  .modal-body-content[data-fullscreen="true"] .split-column {
    flex: 1 1 0;
    min-height: 0;
    min-width: 0;
  }

  /* Floating fullscreen controls overlay */
  .fullscreen-overlay-controls {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--duration-fast, 150ms) ease;
    z-index: 10;
  }

  .fullscreen-overlay-controls.visible {
    opacity: 1;
  }

  .fullscreen-overlay-controls > * {
    pointer-events: auto;
  }

  .fs-close-btn {
    position: absolute;
    top: max(env(safe-area-inset-top, 16px), 16px);
    right: max(env(safe-area-inset-right, 16px), 16px);
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .fs-close-btn:hover {
    background: rgba(0, 0, 0, 0.8);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .fs-close-btn:active {
    transform: scale(0.95);
  }

  .fs-close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .fs-transport {
    position: absolute;
    bottom: max(env(safe-area-inset-bottom, 24px), 24px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px 24px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* ===== END FULLSCREEN MORPH STYLES ===== */

  .header-left,
  .header-right {
    flex: 0 0 48px;
    display: flex;
    align-items: center;
  }

  .header-center {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: 18px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .close-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }

  /* Sequence title in header */
  .sequence-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, white);
    text-align: center;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Body content - must fill the modal-body wrapper completely */
  .modal-body-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* Create stacking context for view transitions */
    position: relative;
  }

  /* View containers need absolute positioning for crossfade to work */
  .view-container {
    position: absolute;
    inset: 0;
  }

  /* Split view */
  .split-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }

  /* Split columns are tappable buttons */
  .split-column {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    /* Button reset */
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    /* Transitions */
    transition:
      flex 0.35s cubic-bezier(0.32, 0.72, 0, 1),
      opacity 0.25s ease,
      transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
    transform-origin: center;
  }

  .split-column:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }

  .animation-column {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .preview-column {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .media-pane {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    overflow: hidden;
    /* Establish container for child container queries */
    container-type: size;
    /* For absolute-positioned close button */
    position: relative;
  }

  .animation-pane {
    background: transparent;
  }

  .preview-pane {
    background: transparent;
    border-top: none;
    /* Override container-type for preview - it uses max-width/max-height, not container queries */
    container-type: normal;
  }

  /* Close button - shown when pane is focused */
  .pane-close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    -webkit-tap-highlight-color: transparent;
    /* Pop-in animation */
    animation: closeButtonPopIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes closeButtonPopIn {
    from {
      opacity: 0;
      transform: scale(0.7);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .pane-close-btn:hover {
    background: rgba(0, 0, 0, 0.7);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .pane-close-btn:active {
    transform: scale(0.92);
  }

  .pane-close-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* ===== FOCUS MODE TRANSITIONS ===== */

  /* Hidden column animates out */
  .split-view[data-focused] .split-column[data-hidden="true"] {
    flex: 0 0 0%;
    opacity: 0;
    transform: scale(0.95);
    pointer-events: none;
    overflow: hidden;
  }

  /* Focused column expands to fill */
  .split-view[data-focused="animation"] .animation-column,
  .split-view[data-focused="image"] .preview-column {
    flex: 1 1 100%;
  }

  /* Focus mode chips at bottom of expanded pane */
  .focus-mode-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    /* Slide up animation */
    animation: slideUpFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes slideUpFadeIn {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Individual chip stagger animation */
  .focus-mode-chips .chip {
    animation: chipPopIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  }

  .focus-mode-chips .chip:nth-child(1) { animation-delay: 0.05s; }
  .focus-mode-chips .chip:nth-child(2) { animation-delay: 0.08s; }
  .focus-mode-chips .chip:nth-child(3) { animation-delay: 0.14s; }
  .focus-mode-chips .chip:nth-child(4) { animation-delay: 0.17s; }
  .focus-mode-chips .chip:nth-child(5) { animation-delay: 0.20s; }

  @keyframes chipPopIn {
    from {
      opacity: 0;
      transform: scale(0.8) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Remove border between columns when in edit mode - with transition */
  .preview-column {
    transition:
      border-color 0.25s ease,
      flex 0.35s cubic-bezier(0.32, 0.72, 0, 1),
      opacity 0.25s ease,
      transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .split-view[data-focused] .preview-column {
    border-left-color: transparent;
    border-top-color: transparent;
  }

  /* Media pane children should fill available space */
  .media-pane > :global(*) {
    max-width: 100%;
    max-height: 100%;
  }

  /* Single view (animation or image only) */
  .single-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 16px;
  }

  .media-container {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Establish container for child container queries */
    container-type: size;
  }

  /* Loading/Error states */
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 14px);
  }

  .error-state {
    color: var(--semantic-error, #f87171);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Footer controls - base styles defined above in fullscreen section */
  .transport-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
  }

  .stagger-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .stagger-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .stagger-btn:active {
    transform: scale(0.95);
  }

  .stagger-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .bpm-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
  }

  .image-footer-row {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0;
  }

  /* Footer content wrapper for view transitions */
  .footer-content {
    display: contents;
  }

  .footer-spacer {
    flex: 1;
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .export-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 85%, white);
    transform: scale(1.02);
  }

  .export-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .export-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Prominent export button - shown in footer when not in export mode */
  .export-btn-prominent {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 120px;
    height: 48px;
    padding: 0 20px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .export-btn-prominent i {
    font-size: 16px;
  }

  .export-btn-prominent:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 85%, white);
    transform: scale(1.02);
  }

  .export-btn-prominent:active {
    transform: scale(0.98);
  }

  .export-btn-prominent:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    min-width: 48px;
    padding: 8px 14px;
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .chip:active {
    transform: scale(0.92);
    transition-duration: 50ms;
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 45%, transparent);
    color: white;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
    /* Subtle pulse when becoming active */
    animation: chipActivate 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes chipActivate {
    0% { transform: scale(0.92); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  .chip:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  /* Desktop: 85% viewport sizing */
  @media (min-width: 768px) {
    :global(.sequence-details-modal.base-modal[data-size="full"]) {
      width: clamp(600px, 85vw, 1400px) !important;
      height: clamp(500px, 85vh, 900px) !important;
      max-width: 85vw !important;
      max-height: 85vh !important;
      border-radius: 16px !important;
      margin: auto !important;
    }

    .split-view {
      flex-direction: row;
    }

    .split-column {
      flex: 1;
    }

    .preview-column {
      border-top: none;
      border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }

    .media-pane {
      padding: 24px;
    }
  }

  /* Mobile: Full screen */
  @media (max-width: 767px) {
    :global(.sequence-details-modal.base-modal[data-size="full"]) {
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      border-radius: 0 !important;
      margin: 0 !important;
    }

    .mode-label {
      display: none;
    }

    .mode-button {
      padding: 10px 12px;
    }

    .controls-footer {
      padding: 12px;
      gap: 8px;
    }
  }

  /* Header icon buttons (lights + settings) */
  .header-right {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: 16px;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .header-icon-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }

  .header-icon-btn.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
    color: var(--theme-accent, #6366f1);
  }

  .header-icon-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Split view needs relative positioning */
  .split-view {
    position: relative;
  }

  .single-view {
    position: relative;
  }

  /* ===== EXPORT MODE STYLES ===== */

  .export-header {
    /* Inherits from .details-header */
  }

  .export-title {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .export-mode-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
    gap: 16px;
    overflow-y: auto;
  }

  .export-preview-area {
    flex: 0 0 auto;
    max-height: 40vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: 12px;
    overflow: hidden;
  }

  .export-options-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }

  .export-options-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .option-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .option-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* Export mode footer */
  .export-footer-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .primary-export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    max-width: 320px;
    height: 56px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 16px;
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .primary-export-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 85%, white);
    transform: scale(1.02);
  }

  .primary-export-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .primary-export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .primary-export-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .primary-export-btn i {
    font-size: 18px;
  }

  /* Export progress display */
  .export-progress {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 320px;
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    border-radius: 4px;
    transition: width 0.2s ease;
  }

  .progress-text {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, white);
    min-width: 40px;
    text-align: right;
  }

  .cancel-export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-export-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--semantic-error, #f87171);
    color: var(--semantic-error, #f87171);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }

    :global(.sequence-details-modal.base-modal),
    .close-button,
    .header-icon-btn,
    .pane-close-btn,
    .split-column,
    .preview-column,
    .details-header,
    .controls-footer,
    .fullscreen-overlay-controls,
    .fs-close-btn,
    .chip,
    .primary-export-btn,
    .cancel-export-btn,
    .progress-fill {
      transition: none !important;
    }

    .focus-mode-chips,
    .focus-mode-chips .chip,
    .pane-close-btn,
    .chip.active {
      animation: none !important;
    }
  }
</style>
