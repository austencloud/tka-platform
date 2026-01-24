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
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
  import { sequenceModalExporter } from "../services/implementations/SequenceModalExporter";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { container } from "$lib/shared/di";
  import { layoutCalculator } from "$lib/shared/render/services/implementations/LayoutCalculator";
  import { createAnimationPanelState, type PlaybackMode, type AnimationStateKey } from "$lib/features/compose/state/animation-panel-state.svelte";
  import ViewerFooter from "./ViewerFooter.svelte";
  import ViewerHeader from "./ViewerHeader.svelte";
  import ExportModeContent from "./ExportModeContent.svelte";
  import ExportFooter from "./ExportFooter.svelte";
  import FullscreenControls from "./FullscreenControls.svelte";
  import SplitViewContent from "./SplitViewContent.svelte";
  import { sequenceModalPersistence } from "../services/implementations/SequenceModalPersistence";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { setAnimationPlaybackRef } from "$lib/shared/coordinators/animation-playback-ref.svelte";
  import { getAnimationVisibilityManager, type TrailStyle } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { goto } from "$app/navigation";
  import { saveSequenceHandoff } from "$lib/shared/coordinators/sequence-handoff.svelte";
  // Button components
  import SyncToggleButton from "$lib/shared/ui/components/SyncToggleButton.svelte";
  import MultiPerformerButton from "$lib/shared/ui/components/MultiPerformerButton.svelte";
  import LightsToggleButton from "$lib/shared/ui/components/LightsToggleButton.svelte";
  import ExpandButton from "$lib/shared/ui/components/ExpandButton.svelte";
  // Animation and playback
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import BpmChips from "$lib/features/compose/components/controls/BpmChips.svelte";
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import LayeredSequencePreview from "./LayeredSequencePreview.svelte";
  import { browser } from "$app/environment";
  import {
    getExportOptionsState,
    type VideoFps,
    type GridStepSize,
    type CompositeOrientation,
  } from "../state/export-options-state.svelte";
  // LAN Sync
  import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
  import {
    setSequenceModalUrl,
    setViewModeUrl,
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
  }

  let {
    open = $bindable(false),
    sequence,
    onclose,
    initialBpm,
    initialPlaybackTimeMs,
    initialViewMode,
  }: Props = $props();

  // View mode state (persisted via localStorage, but prefer initialViewMode if provided)
  let viewMode = $state<ViewMode>(initialViewMode || loadViewMode());

  // Export mode state
  let isExportMode = $state(false);
  const exportOptions = getExportOptionsState();

  // LAN Sync - just a toggle, no complex UI
  let isSyncToggling = $state(false);

  // Mobile detection for responsive behaviors
  let isMobile = $state(false);

  $effect(() => {
    if (browser) {
      const checkMobile = () => {
        isMobile = window.innerWidth < 768;
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }
  });

  // Swipe-to-dismiss state (mobile only)
  let swipeY = $state(0);
  let swipeStartY = $state(0);
  let isSwiping = $state(false);
  const SWIPE_THRESHOLD = 100; // px to trigger dismiss

  function handleTouchStart(e: TouchEvent) {
    if (!isMobile || isFullscreen) return;
    // Only start swipe from the top portion of the modal
    const touch = e.touches[0];
    if (touch.clientY < 150) {
      swipeStartY = touch.clientY;
      isSwiping = true;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isSwiping) return;
    const touch = e.touches[0];
    const delta = touch.clientY - swipeStartY;
    // Only allow downward swipe
    if (delta > 0) {
      swipeY = delta;
    }
  }

  function handleTouchEnd() {
    if (!isSwiping) return;
    if (swipeY > SWIPE_THRESHOLD) {
      // Dismiss the modal
      handleClose();
    }
    // Reset
    swipeY = 0;
    isSwiping = false;
  }

  // Which pane is in edit mode: null, 'animation', or 'image'
  let editingPane = $state<'animation' | 'image' | null>(null);

  // Export button label based on focused pane
  const exportButtonLabel = $derived.by(() => {
    if (editingPane === 'image') return 'Export Image';
    if (editingPane === 'animation') return 'Export Animation';
    return 'Export'; // Both visible (split view)
  });

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

  // Simple sync toggle - one tap to connect/disconnect
  async function handleSyncToggle() {
    if (isSyncToggling) return;
    isSyncToggling = true;
    hapticService?.trigger("selection");

    try {
      // Use sequence.word for display in discovery banners
      const sequenceWord = sequence.word || sequence.name || "Sequence";
      const isNowSyncing = await lanSyncState.toggleSync(
        sequence.id,
        sequenceWord,
        {
          sequenceId: sequence.id,
          currentStep: currentStepLocal,
          isPlaying: isPlayingLocal,
          speed: bpmLocal / 60, // Convert BPM to speed multiplier
          shouldLoop: true
        }
      );
      hapticService?.trigger(isNowSyncing ? "success" : "selection");
    } catch (err) {
      console.error("[Sync] Toggle failed:", err);
      hapticService?.trigger("error");
    } finally {
      isSyncToggling = false;
    }
  }

  /**
   * Open sequence in Compose module for multi-performer visualization.
   * Disconnects LAN sync if active, saves handoff data, and navigates to Compose.
   */
  async function handleOpenInCompose(preset: 'stagger' | 'mirror' = 'stagger') {
    hapticService?.trigger("selection");

    // Disconnect LAN sync if active
    if (lanSyncState.isActive) {
      lanSyncState.disconnect();
    }

    // Save handoff data for Compose to consume
    saveSequenceHandoff({
      sequence,
      playbackState: {
        currentStep: currentStepLocal,
        bpm: bpmLocal,
        isPlaying: isPlayingLocal,
      },
      preferredPreset: preset,
      returnPath: window.location.pathname,
    });

    // Show feedback toast
    showToast({
      message: "Opening in Compose...",
      type: "info",
      duration: 2000,
    });

    // Close modal and navigate
    open = false;
    await goto('/compose?handoff=true');
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

  // Footer auto-hide state (for mobile playback)
  let footerControlsVisible = $state(true);
  let footerHideTimeout: ReturnType<typeof setTimeout> | null = null;

  function showFooterControls() {
    footerControlsVisible = true;
    scheduleFooterHide();
  }

  function scheduleFooterHide() {
    clearFooterTimeout();
    // Only auto-hide on mobile when playing
    if (!isPlayingLocal) return;
    if (typeof window !== "undefined" && window.innerWidth >= 768) return;

    footerHideTimeout = setTimeout(() => {
      footerControlsVisible = false;
    }, 3000);
  }

  function clearFooterTimeout() {
    if (footerHideTimeout) {
      clearTimeout(footerHideTimeout);
      footerHideTimeout = null;
    }
  }

  // Keep footer visible when paused
  $effect(() => {
    if (!isPlayingLocal) {
      footerControlsVisible = true;
      clearFooterTimeout();
    } else {
      scheduleFooterHide();
    }
  });

  // Footer action handlers
  function handleSave() {
    hapticService?.trigger("selection");
    // TODO: Implement save to library
    // For now, show a toast indicating the feature
    if (!authState.isAuthenticated) {
      showToast("Sign in to save sequences", "info");
      return;
    }
    showToast("Save feature coming soon", "info");
  }

  function handleCompose() {
    handleOpenInCompose();
  }

  function handleShare() {
    hapticService?.trigger("selection");
    // Use Web Share API if available, otherwise copy link
    const shareUrl = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: sequence?.word || "Sequence",
        text: `Check out this TKA sequence: ${sequence?.word || ""}`,
        url: shareUrl,
      }).catch(() => {
        // User cancelled or share failed - silent
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Link copied to clipboard", "success");
      }).catch(() => {
        showToast("Could not copy link", "error");
      });
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
    return sequenceModalPersistence.loadViewMode();
  }

  function saveViewMode(mode: ViewMode) {
    sequenceModalPersistence.saveViewMode(mode);
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
  let imgColumnCount = $state<number | null>(loadColumnCountSetting());

  function loadImageSetting(key: string, defaultValue: boolean): boolean {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(`tka_seq_details_img_${key}`);
      if (saved !== null) return saved === "true";
    }
    return defaultValue;
  }

  function loadColumnCountSetting(): number | null {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("tka_seq_details_img_columnCount");
      if (saved !== null && saved !== "null") return parseInt(saved, 10);
    }
    return null; // Auto
  }

  function saveImageSetting(key: string, value: boolean) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(`tka_seq_details_img_${key}`, String(value));
    }
  }

  function saveColumnCountSetting(value: number | null) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("tka_seq_details_img_columnCount", String(value));
    }
  }

  function cycleColumnCount() {
    hapticService?.trigger("selection");
    // Cycle through: Auto -> 3 -> 4 -> 5 -> 6 -> Auto
    const options: (number | null)[] = [null, 3, 4, 5, 6];
    const currentIndex = options.indexOf(imgColumnCount);
    const nextIndex = (currentIndex + 1) % options.length;
    imgColumnCount = options[nextIndex];
    saveColumnCountSetting(imgColumnCount);
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

  // Export state (from service)
  let animationCanvas = $state<HTMLCanvasElement | null>(null);
  // Reactive getters for exporter state
  const isExporting = $derived(sequenceModalExporter.state.isExporting);
  const exportProgress = $derived(sequenceModalExporter.state.progress);
  const exportError = $derived(sequenceModalExporter.state.error);

  // Human-readable stage names for export progress
  const EXPORT_STAGE_LABELS: Record<string, string> = {
    capturing: "Capturing frames",
    encoding: "Encoding video",
    complete: "Complete",
    error: "Error",
  };

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

  // Step highlighting for LayeredSequencePreview
  // -1 = start position, 0+ = motion steps
  let highlightedStepIndex = $derived.by(() => {
    if (!isPlayingLocal) return null;
    // Start position (currentStep 0 to <1)
    if (currentStepLocal < 1) return -1;
    // Motion steps (currentStep 1+ maps to index 0+)
    return Math.floor(currentStepLocal) - 1;
  });

  // Derive current step data and letter for AnimatorCanvas glyph display
  const currentStepData = $derived.by(() => {
    const sequenceData = modalAnimationState.sequenceData;
    if (!sequenceData) return null;
    // Start position (currentStep 0 to <1)
    if (currentStepLocal < 1 && sequenceData.startPosition) {
      return sequenceData.startPosition;
    }
    // Motion steps (currentStep 1+ maps to steps array)
    if (sequenceData.steps?.length > 0) {
      const stepIndex = Math.max(0, Math.floor(currentStepLocal) - 1);
      const clampedIndex = Math.min(stepIndex, sequenceData.steps.length - 1);
      return sequenceData.steps[clampedIndex] || null;
    }
    return null;
  });

  const currentLetter = $derived(currentStepData?.letter || null);

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

      // Initialize LAN sync state with coordinator from container
      const lanSyncCoordinator = container.items.lanSyncCoordinator as ILanSyncCoordinator;
      lanSyncState.initialize(lanSyncCoordinator);

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

  // Export callbacks shared across all export types
  const exportCallbacks = {
    onSuccess: (message: string) => {
      showToast(message, "success");
      exitExportMode();
    },
    onError: (message: string) => {
      // Error is already tracked in exporter state
    },
    onHaptic: (type: "success" | "error" | "selection") => {
      hapticService?.trigger(type);
    },
  };

  // Export handlers - delegate to service
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
    if (!playbackController || !animationCanvas) return;

    const opts = exportOptions.getSplitOptions();
    await sequenceModalExporter.exportSplit(
      opts,
      { canvas: animationCanvas, playbackController, panelState: modalAnimationState },
      exportCallbacks
    );
  }

  async function handleAnimationExport() {
    if (!playbackController || !animationCanvas) return;

    const opts = exportOptions.getVideoOptions();
    await sequenceModalExporter.exportAnimation(
      opts,
      { canvas: animationCanvas, playbackController, panelState: modalAnimationState },
      exportCallbacks
    );
  }

  async function handleImageExport() {
    if (!sequence) return;

    const opts = exportOptions.getImageOptions();
    await sequenceModalExporter.exportImage(
      opts,
      { sequence, userName: authState.user?.displayName ?? "" },
      exportCallbacks
    );
  }

  function handleCancelExport() {
    sequenceModalExporter.cancel();
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
      // Update URL with modal state (stagger is now handled via Compose navigation)
      setSequenceModalUrl(sequence, viewMode as SequenceViewMode, false);
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
    clearFooterTimeout();
    if (playbackController) {
      playbackController.dispose();
    }
    modalAnimationState.dispose();
    sequenceModalExporter.dispose();
  });

  // Calculate preview aspect ratio to determine optimal fullscreen split layout
  let previewAspectRatio = $derived.by(() => {
    if (!sequence?.steps?.length) return 1;

    const layoutService = layoutCalculator;
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
          <h2 class="mode-title">
            Export {viewMode === "image" ? "Image" : "Video"}
          </h2>
        </div>

        <div class="header-right">
          <!-- Spacer to balance layout -->
        </div>
      </header>
    {:else}
      <!-- Normal viewer header -->
      <header
        class="details-header"
        class:mobile={isMobile}
        data-hidden={isFullscreen}
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
        style={isSwiping ? `transform: translateY(${swipeY}px); opacity: ${1 - swipeY / 200}` : undefined}
      >
        <!-- Mobile: Swipe handle indicator -->
        {#if isMobile}
          <div class="swipe-handle" aria-hidden="true"></div>
        {/if}

        <div class="header-left">
          {#if !isMobile}
            <!-- Desktop: Full set of controls -->
            <SyncToggleButton
              isSearching={lanSyncState.isActive && !lanSyncState.isConnected}
              isConnected={lanSyncState.isConnected}
              isToggling={isSyncToggling}
              onToggle={handleSyncToggle}
              disabled={isSyncToggling}
              size="small"
            />
            <MultiPerformerButton
              onclick={() => handleOpenInCompose('stagger')}
              size="small"
            />
          {/if}
          <LightsToggleButton
            lightsOn={!imgDarkMode}
            onToggle={() => toggleImgSetting("darkMode")}
            size="small"
          />
          {#if !isMobile}
            <!-- Desktop only: Fullscreen button -->
            <ExpandButton
              isExpanded={isFullscreen}
              onclick={enterFullscreen}
              size="small"
            />
          {/if}
        </div>

        <div class="header-center">
          <h2 class="sequence-title">{isMobile ? (sequence?.word || 'Viewer') : 'Sequence Viewer'}</h2>
        </div>

        <div class="header-right">
          <button
            type="button"
            class="close-button"
            onclick={handleClose}
            aria-label="Close"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
      </header>
    {/if}
  {/snippet}

  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="modal-body-content"
    data-view-mode={viewMode}
    data-fullscreen={isFullscreen}
    onclick={isFullscreen ? handleFullscreenTap : undefined}
    onkeydown={isFullscreen ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleFullscreenTap(e); } : undefined}
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
          <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
          <div class="fs-transport" role="presentation" onclick={(e) => e.stopPropagation()}>
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
                letter={currentLetter}
                stepData={currentStepData}
                word={sequence?.word}
                onCanvasReady={handleCanvasReady}
              />
            {/if}
          {/if}
        </div>

        <!-- Export options -->
        <div class="export-options-area">
          <!-- Guidance hint -->
          <p class="export-hint">
            <i class="fas fa-info-circle" aria-hidden="true"></i>
            Customize your export, then tap the button below.
          </p>
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
        <div
          class="split-column animation-column"
          class:focused={editingPane === 'animation'}
          data-hidden={editingPane === 'image'}
          role="button"
          tabindex="0"
          onclick={() => editingPane === 'animation' ? exitEditMode() : enterEditMode('animation')}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editingPane === 'animation' ? exitEditMode() : enterEditMode('animation'); }}}
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
                letter={currentLetter}
                stepData={currentStepData}
                word={sequence?.word}
                onCanvasReady={handleCanvasReady}
              />
            {/if}
          </div>

        </div>

        <!-- Image/Preview pane -->
        <div
          class="split-column preview-column"
          class:focused={editingPane === 'image'}
          data-hidden={editingPane === 'animation'}
          role="button"
          tabindex="0"
          onclick={() => editingPane === 'image' ? exitEditMode() : enterEditMode('image')}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editingPane === 'image' ? exitEditMode() : enterEditMode('image'); }}}
          aria-label={editingPane === 'image' ? "Exit focus mode" : "Focus on image"}
          aria-expanded={editingPane === 'image'}
        >
          <!-- Inner wrapper for horizontal layout on wide screens -->
          <div class="preview-column-inner" class:focused={editingPane === 'image'}>
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
                columnCount={imgColumnCount}
              />
            </div>

          </div>
        </div>
      </div>
    {/if}
  </div>

  {#snippet footer()}
    {#if !isFullscreen}
      {#if isExportMode}
        <!-- Export mode: prominent export button with progress -->
        <footer class="controls-footer" data-hidden={isFullscreen}>
          <div
            class="export-footer-content"
            in:fade={{ duration: 200, delay: 50, easing: cubicOut }}
            out:fade={{ duration: 100, easing: cubicOut }}
          >
            {#if exportError}
              <!-- Error state with retry button -->
              <div class="export-error-state" role="alert">
                <div class="error-content">
                  <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                  <span class="error-message">{exportError}</span>
                </div>
                <button
                  type="button"
                  class="retry-export-btn"
                  onclick={() => { sequenceModalExporter.clearError(); handleExport(); }}
                >
                  <i class="fas fa-redo" aria-hidden="true"></i>
                  Retry
                </button>
              </div>
            {:else if isExporting && exportProgress}
              <!-- Progress display during export -->
              <div class="export-progress" role="status" aria-live="polite">
                <span class="progress-stage">{EXPORT_STAGE_LABELS[exportProgress.stage] || exportProgress.stage}</span>
                <div
                  class="progress-bar"
                  role="progressbar"
                  aria-valuenow={Math.round(exportProgress.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Export progress"
                >
                  <div class="progress-fill" style="width: {exportProgress.progress * 100}%"></div>
                </div>
                <span class="progress-text" aria-live="polite" aria-atomic="true">{Math.round(exportProgress.progress * 100)}%</span>
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
                aria-label={isExporting ? "Export in progress" : `Export ${viewMode === "image" ? "image" : "video"}`}
              >
                <i class="fas fa-download" aria-hidden="true"></i>
                Export {viewMode === "image" ? "Image" : "Video"}
              </button>
            {/if}
          </div>
        </footer>
      {:else}
        <!-- New unified footer with actions + playback -->
        <ViewerFooter
          bpm={bpmLocal}
          isPlaying={isPlayingLocal}
          isLoggedIn={authState.isAuthenticated}
          controlsVisible={footerControlsVisible}
          onBpmChange={handleBpmChange}
          onPlayPause={handlePlaybackToggle}
          onStepBack={() => playbackController?.stepFullBeatBackward()}
          onStepForward={() => playbackController?.stepFullBeatForward()}
          onStepHalfBack={() => playbackController?.stepHalfBeatBackward()}
          onStepHalfForward={() => playbackController?.stepHalfBeatForward()}
          onSave={handleSave}
          onCompose={handleCompose}
          onShare={handleShare}
          onExport={enterExportMode}
        />
      {/if}
    {/if}
  {/snippet}
</BaseModal>

<!-- NOTE: Stagger mode now handled by Compose module via sequence handoff -->

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

  /* Modal expands to viewport in fullscreen - no backdrop padding */
  :global(dialog.sequence-details-modal.base-modal[data-fullscreen="true"]),
  :global(dialog.sequence-details-modal.base-modal[data-size="full"][data-fullscreen="true"]) {
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    padding: 0 !important;
    border-radius: 0 !important;
    margin: auto !important;
  }

  :global(dialog.sequence-details-modal[data-fullscreen="true"] .modal-content-wrapper) {
    border-radius: 0 !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    height: 100% !important;
    box-shadow: none !important;
  }

  /* Header slide-fade out - CSS Grid for true center */
  .details-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
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

  .modal-body-content[data-fullscreen="true"] .split-view {
    padding: 0;
  }

  .modal-body-content[data-fullscreen="true"] .media-pane {
    padding: 0;
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

  /* ===== MOBILE HEADER STYLES ===== */

  /* Swipe handle - visual affordance for swipe-to-dismiss */
  .swipe-handle {
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }

  /* Mobile header - minimal, with swipe affordance */
  .details-header.mobile {
    padding-top: 16px; /* Extra space for swipe handle */
    touch-action: pan-y; /* Enable vertical swipe */
  }

  .details-header.mobile .sequence-title {
    /* Show sequence word instead of generic title */
    max-width: 150px;
    font-size: var(--font-size-min, 14px);
  }

  /* ===== END MOBILE HEADER STYLES ===== */

  .header-left {
    justify-self: start;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-right {
    justify-self: end;
    display: flex;
    align-items: center;
  }

  .header-center {
    /* Grid column 2 = always centered regardless of siblings */
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

  /* Inner wrapper for preview column - enables horizontal layout on wide screens */
  .preview-column-inner {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
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
    /* Higher opacity (35%) for better contrast - meets WCAG AA 4.5:1 on dark backgrounds */
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
    color: white;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
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

  /* Desktop: 90% viewport sizing - immersive but still modal */
  @media (min-width: 768px) {
    :global(.sequence-details-modal.base-modal[data-size="full"]) {
      /* Fill viewport but add padding to create clickable backdrop area */
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      /* Padding creates clickable "backdrop" area that's actually part of the dialog */
      padding: 5vh 5vw !important;
      /* Make the padding area look like a backdrop */
      background: transparent !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      margin: auto !important;
    }

    /* The content wrapper gets the modal styling */
    :global(.sequence-details-modal.base-modal[data-size="full"] .modal-content-wrapper) {
      background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
      border-radius: 16px;
      box-shadow:
        0 25px 80px rgba(0, 0, 0, 0.5),
        0 10px 30px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 var(--theme-stroke-strong, rgba(255, 255, 255, 0.1));
      overflow: hidden;
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

    .controls-footer {
      padding: 12px;
      gap: 8px;
    }
  }

  /* Split view needs relative positioning */
  .split-view {
    position: relative;
  }

  /* ===== EXPORT MODE STYLES ===== */

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

  .export-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 0;
    padding: 8px 12px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-align: center;
  }

  .export-hint i {
    font-size: 14px;
    color: var(--theme-accent, #6366f1);
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

  /* Progress stage text */
  .progress-stage {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    min-width: 100px;
    white-space: nowrap;
  }

  /* Export error state */
  .export-error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 320px;
    padding: 16px;
    background: color-mix(in srgb, var(--semantic-error, #f87171) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error, #f87171) 30%, transparent);
    border-radius: 12px;
  }

  .export-error-state .error-content {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--semantic-error, #f87171);
  }

  .export-error-state .error-content i {
    font-size: 16px;
  }

  .export-error-state .error-message {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    text-align: center;
  }

  .retry-export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 100px;
    height: 44px;
    padding: 0 20px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .retry-export-btn:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 85%, white);
    transform: scale(1.02);
  }

  .retry-export-btn:active {
    transform: scale(0.98);
  }

  .retry-export-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }

    :global(.sequence-details-modal.base-modal),
    .close-button,
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
    .retry-export-btn,
    .progress-fill {
      transition: none !important;
    }

    .pane-close-btn,
    .chip.active {
      animation: none !important;
    }
  }
</style>
