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

  Accessibility (WCAG AAA):
  - Focus trap within modal when open
  - Focus restoration to trigger element on close
  - aria-live regions for dynamic content (playback state, export progress)
  - All interactive elements have 48px minimum touch targets
  - Full keyboard navigation support
  - Screen reader announcements for mode changes
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { ISequenceLoopabilityChecker } from "$lib/features/compose/services/contracts/ISequenceLoopabilityChecker";
  import type { ISequenceDataProvider } from "../services/contracts/ISequenceDataProvider";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
  import type { ILanSyncCoordinator } from "$lib/shared/lan-sync/services/contracts/ILanSyncCoordinator";
  import { sequenceModalExporter } from "../services/implementations/SequenceModalExporter";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { container } from "$lib/shared/di";
  import { layoutCalculator } from "$lib/shared/render/services/implementations/LayoutCalculator";
  import { createAnimationPanelState, type PlaybackMode, type AnimationStateKey } from "$lib/features/compose/state/animation-panel-state.svelte";
  import ViewerFooter from "./ViewerFooter.svelte";
  import FullscreenControls from "./FullscreenControls.svelte";
  import { sequenceModalPersistence } from "../services/implementations/SequenceModalPersistence";
  import { playbackTimeCalculator } from "../services/implementations/PlaybackTimeCalculator";
  import { createModalSwipeDismiss } from "../services/implementations/ModalSwipeDismiss";
  import { createModalAccessibilityHelper } from "../services/implementations/ModalAccessibilityHelper.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { setAnimationPlaybackRef } from "$lib/shared/coordinators/animation-playback-ref.svelte";
  import { setSequenceViewerRef } from "$lib/shared/coordinators/sequence-viewer-ref.svelte";
  import { getAnimationVisibilityManager, type TrailVisibility } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { goto } from "$app/navigation";
  import { saveSequenceHandoff } from "$lib/shared/coordinators/sequence-handoff.svelte";
  // Extracted child components
  import ViewerHeader from "./ViewerHeader.svelte";
  import ViewerSplitPane from "./ViewerSplitPane.svelte";
  import ExportModeContent from "./ExportModeContent.svelte";
  import ExportFooter from "./ExportFooter.svelte";
  // Animation and playback
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import { TempoRampOrchestrator } from "../services/implementations/TempoRampOrchestrator";
  import { createTempoRampState } from "../state/tempo-ramp-state.svelte";
  import RampProgressIndicator from "./RampProgressIndicator.svelte";
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import LayeredSequencePreview from "./LayeredSequencePreview.svelte";
  import { browser } from "$app/environment";
  import {
    getExportOptionsState,
    type VideoFps,
  } from "../state/export-options-state.svelte";
  // LAN Sync
  import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
  import {
    setViewModeUrl,
    setPlaybackTimeUrl,
    setBpmUrl,
    clearModalUrlState,
    getModalUrlState,
    cacheSequence,
    type SequenceViewMode,
  } from "$lib/shared/application/state/ui/modal-url-state.svelte";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";

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
    open = $bindable(),
    sequence,
    onclose,
    initialBpm,
    initialPlaybackTimeMs,
    initialViewMode,
  }: Props = $props();

  // Internal open state - syncs with prop, allows BaseModal to write to it
  let internalOpen = $state(open);

  // Sync internal state when prop changes (parent opening the modal)
  $effect(() => {
    internalOpen = open;
  });

  // When internal state closes, notify parent via callback
  $effect(() => {
    if (!internalOpen && open) {
      // BaseModal closed us - notify parent
      onclose();
    }
  });

  // View mode state (persisted via localStorage, but prefer initialViewMode if provided)
  let viewMode = $state<ViewMode>(loadViewMode());
  $effect.pre(() => { if (initialViewMode) viewMode = initialViewMode; });

  // Export mode state
  let isExportMode = $state(false);
  // What to export: animation, image, or both (redirects to Compose)
  type ExportType = "animation" | "image" | "both";
  let exportType = $state<ExportType | null>(null);
  const exportOptions = getExportOptionsState();

  // LAN Sync - just a toggle, no complex UI
  let isSyncToggling = $state(false);

  // Mobile: no auto-hide - controls stay visible until user collapses

  // Prop type settings for LayeredSequencePreview
  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType);
  const redPropType = $derived(settings.redPropType);
  const catDogModeEnabled = $derived(settings.catDogMode);

  // ========== ACCESSIBILITY ==========
  const accessibilityHelper = createModalAccessibilityHelper();
  // Reference to modal container for focus management
  let modalContainer: HTMLElement | null = null;

  // Capture trigger element when modal opens
  $effect(() => {
    if (open && browser) {
      accessibilityHelper.captureTrigger();
      accessibilityHelper.focusFirstElement(modalContainer);
      const sequenceWord = sequence?.word || "sequence";
      accessibilityHelper.announce(`Sequence viewer opened for ${sequenceWord}`, "assertive");
    }
  });

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
    return undefined;
  });

  // Swipe-to-dismiss handler (works at all viewport sizes)
  const swipeDismiss = createModalSwipeDismiss();

  function handleTouchStart(e: TouchEvent) {
    if (isFullscreen || isExportMode) return;
    swipeDismiss.handleTouchStart(e);
  }

  function handleTouchMove(e: TouchEvent) {
    if (isFullscreen || isExportMode) return;
    const handled = swipeDismiss.handleTouchMove(e);
    if (handled) {
      // Only prevent default if the event is cancelable
      // (won't be cancelable if browser already started scrolling)
      if (e.cancelable) {
        e.preventDefault();
      }
      // Apply visual feedback
      const dialog = document.querySelector("dialog.sequence-details-modal") as HTMLDialogElement | null;
      swipeDismiss.applyTransformToDialog(dialog);
    }
  }

  async function handleTouchEnd() {
    const shouldDismiss = swipeDismiss.handleTouchEnd();
    const dialog = document.querySelector("dialog.sequence-details-modal") as HTMLDialogElement | null;

    if (shouldDismiss) {
      await swipeDismiss.animateDismiss(dialog);
      handleClose();
    } else if (swipeDismiss.state.isCommitted) {
      // Was swiping but didn't meet threshold - snap back
      await swipeDismiss.animateSnapBack(dialog);
    }
  }

  // Attach touchmove handler at document level with capture phase
  $effect(() => {
    if (!browser || !open) return;

    document.addEventListener("touchmove", handleTouchMove, { passive: false, capture: true });

    return () => {
      document.removeEventListener("touchmove", handleTouchMove, { capture: true });
    };
  });

  // Which pane is in edit mode: null, 'animation', or 'image'
  let editingPane = $state<'animation' | 'image' | null>(null);

  // Export button label based on focused pane
  const exportButtonLabel = $derived.by(() => {
    if (editingPane === 'image') return 'Export Image';
    if (editingPane === 'animation') return 'Export Animation';
    return 'Export'; // Both visible (split view)
  });

  function enterEditMode(pane: 'animation' | 'image') {
    hapticService?.trigger("selection");
    editingPane = pane;

    // On desktop, also enter fullscreen for maximum screen real estate
    if (!isMobile && !isFullscreen) {
      isFullscreen = true;
    }

    accessibilityHelper.announce(`${pane === 'animation' ? 'Animation' : 'Image'} expanded. Tap to collapse.`);
  }

  function exitEditMode() {
    hapticService?.trigger("selection");
    editingPane = null;

    // On desktop, also exit fullscreen when unfocusing
    if (!isMobile && isFullscreen) {
      isFullscreen = false;
      fullscreenControlsVisible = false;
    }

    accessibilityHelper.announce("Split view restored");
  }

  // Export mode functions
  function enterExportMode() {
    hapticService?.trigger("selection");
    isExportMode = true;
    exportType = null; // Reset to show type selector
    // Pause playback when entering export mode
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
      // Redirect to Compose with combo-export preset
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
      accessibilityHelper.announce(isNowSyncing ? "Sync enabled. Searching for peers." : "Sync disabled");
    } catch (err) {
      console.error("[Sync] Toggle failed:", err);
      hapticService?.trigger("error");
      accessibilityHelper.announce("Sync failed. Please try again.");
    } finally {
      isSyncToggling = false;
    }
  }

  /**
   * Open sequence in Compose module for multi-performer visualization or combo export.
   * Disconnects LAN sync if active, saves handoff data, and navigates to Compose.
   */
  async function handleOpenInCompose(preset: 'stagger' | 'mirror' | 'combo-export' = 'stagger') {
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
    const message = preset === 'combo-export'
      ? "Opening in Compose for combined export..."
      : "Opening in Compose...";
    showToast({
      message,
      type: "info",
      duration: 2000,
    });

    // Close modal and navigate
    internalOpen = false;
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
    // Only handle keys when modal is open
    if (!open) return;

    if (event.key === "Escape" && isFullscreen) {
      event.preventDefault();
      event.stopPropagation();
      exitFullscreen();
      return;
    }

    // Spacebar toggles playback (capture phase prevents button activation)
    if (event.key === " " || event.code === "Space") {
      // Don't intercept if user is typing in an input
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      playbackController?.togglePlayback();
    }
  }

  // Register keydown handler with capture phase to intercept before buttons
  $effect(() => {
    if (open && browser) {
      window.addEventListener("keydown", handleKeydown, { capture: true });
      return () => {
        window.removeEventListener("keydown", handleKeydown, { capture: true });
      };
    }
    return undefined;
  });

  // Sync fullscreen state to dialog element (BaseModal doesn't pass data attributes through)
  // This effect tracks isFullscreen and updates the dialog's data-fullscreen attribute
  $effect(() => {
    const fullscreenState = isFullscreen;

    const dialog = document.querySelector("dialog.sequence-details-modal") as HTMLDialogElement | null;
    if (dialog) {
      if (fullscreenState) {
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
  let animTrailStyle = $state<TrailVisibility>(animationVisibility.getTrailStyle());
  let animTkaGlyph = $state(animationVisibility.getVisibility("tkaGlyph"));
  let animWordHeader = $state(animationVisibility.getVisibility("wordHeader"));

  // Image visibility (uses global ImageCompositionManager for Firebase sync)
  const imageComposition = getImageCompositionManager();

  // Reactive state synced from manager (using local state with observer pattern)
  let imgShowWord = $state(imageComposition.addWord);
  let imgShowStartPos = $state(imageComposition.includeStartPosition);
  let imgShowDifficulty = $state(imageComposition.addDifficultyLevel);
  let imgShowCreatorName = $state(imageComposition.showCreatorName);
  let imgShowNotes = $state(imageComposition.showNotes);
  let imgDarkMode = $state(imageComposition.darkMode);

  // Column count is modal-specific (not in global settings)
  let imgColumnCount = $state<number | null>(sequenceModalPersistence.loadColumnCount());

  // Sync from ImageCompositionManager when it changes externally
  $effect(() => {
    if (!browser) return;

    const observer = () => {
      imgShowWord = imageComposition.addWord;
      imgShowStartPos = imageComposition.includeStartPosition;
      imgShowDifficulty = imageComposition.addDifficultyLevel;
      imgShowCreatorName = imageComposition.showCreatorName;
      imgShowNotes = imageComposition.showNotes;
      imgDarkMode = imageComposition.darkMode;
    };

    imageComposition.registerObserver(observer);
    return () => imageComposition.unregisterObserver(observer);
  });

  function cycleColumnCount() {
    hapticService?.trigger("selection");
    // Cycle through: Auto -> 3 -> 4 -> 5 -> 6 -> Auto
    const options: (number | null)[] = [null, 3, 4, 5, 6];
    const currentIndex = options.indexOf(imgColumnCount ?? null);
    const nextIndex = (currentIndex + 1) % options.length;
    imgColumnCount = options[nextIndex] ?? null;
    sequenceModalPersistence.saveColumnCount(imgColumnCount);
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
        imageComposition.setAddWord(!imgShowWord);
        break;
      case "startPos":
        imageComposition.setIncludeStartPosition(!imgShowStartPos);
        break;
      case "difficulty":
        imageComposition.setAddDifficultyLevel(!imgShowDifficulty);
        break;
      case "creatorName":
        imageComposition.setShowCreatorName(!imgShowCreatorName);
        break;
      case "notes":
        imageComposition.setShowNotes(!imgShowNotes);
        break;
      case "darkMode":
        imageComposition.setDarkMode(!imgDarkMode);
        break;
    }
  }

  /**
   * Unified dark mode toggle - affects both animation canvas and choreo card.
   * Single toggle provides consistent experience across all visual elements.
   */
  function handleUnifiedDarkModeToggle() {
    hapticService?.trigger("selection");
    const newValue = !imgDarkMode;
    // Update choreo card dark mode (this also syncs to Firebase)
    imageComposition.setDarkMode(newValue);
    // Update animation canvas dark mode
    animationVisibility.setDarkMode(newValue);
  }

  // Services (lazy-loaded)
  let playbackController: IAnimationPlaybackController | null = null;
  let loopabilityChecker: ISequenceLoopabilityChecker | null = null;
  let sequenceDataProvider: ISequenceDataProvider | null = null;
  let hapticService: IHapticFeedback | null = null;

  // Export state (from service)
  let animationCanvas = $state<HTMLCanvasElement | null>(null);
  // Reactive getters for exporter state
  const isExporting = $derived(sequenceModalExporter.state.isExporting);
  const exportProgress = $derived(sequenceModalExporter.state.progress);
  const exportError = $derived(sequenceModalExporter.state.error);

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

  // Track whether current position was reached via step buttons
  let arrivedViaStepping = $state(false);

  // Use hydrated sequence data when available, otherwise fall back to prop
  // This ensures LayeredSequencePreview gets the full sequence with motion data
  const effectiveSequence = $derived(modalAnimationState.sequenceData ?? sequence);

  // After stepping (via step buttons), props land at the START of the next beat,
  // meaning the PREVIOUS beat's motion just completed. Offset the glyph and highlight
  // to show the just-completed beat instead of the upcoming one.
  const showPreviousBeat = $derived(
    arrivedViaStepping &&
    !isPlayingLocal &&
    currentStepLocal >= 1 &&
    Math.abs(currentStepLocal - Math.round(currentStepLocal)) < 0.01
  );

  // Step highlighting for LayeredSequencePreview
  // -1 = start position, 0+ = motion steps
  let highlightedStepIndex = $derived.by(() => {
    if (!isPlayingLocal && currentStepLocal < 0.5) return null;
    if (currentStepLocal < 1) return -1;
    // After stepping to an integer beat, show the just-completed beat
    if (showPreviousBeat) {
      return Math.round(currentStepLocal) - 2;
    }
    return Math.floor(currentStepLocal) - 1;
  });

  // Derive current step data and letter for AnimatorCanvas glyph display
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

  // Track beat transitions for haptic feedback during playback
  let lastBeatNumber = 0;

  // Subscribe to animation state changes
  cleanupAnimationStateSubscription = modalAnimationState.subscribe(
    (key: AnimationStateKey, value: unknown) => {
      switch (key) {
        case "isPlaying":
          isPlayingLocal = value as boolean;
          // When playback stops, save the current position to URL
          if (!(value as boolean)) {
            const timeMs = playbackTimeCalculator.stepToTimeMs(currentStepLocal, bpmLocal);
            setPlaybackTimeUrl(timeMs, true);
          }
          // Broadcast to sync peers
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
          // Periodically update URL with current position (debounced internally)
          if (isPlayingLocal) {
            const timeMs = playbackTimeCalculator.stepToTimeMs(newStep, bpmLocal);
            setPlaybackTimeUrl(timeMs);
          }
          // Broadcast to sync peers
          lanSyncState.updatePlayback({ currentStep: newStep });
          break;
        }
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

  // Load animation services
  async function loadServices() {
    try {
      playbackController = container.items.animationPlaybackController;
      loopabilityChecker = container.items.sequenceLoopabilityChecker;
      sequenceDataProvider = container.items.sequenceDataProvider;
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
    if (!playbackController || !sequenceDataProvider) return;

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
      setSequenceViewerRef({
        enterExportMode,
        save: handleSave,
        share: handleShare,
        openInCompose: handleCompose,
        isInExportMode: () => isExportMode,
      });

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
        const targetStep = playbackTimeCalculator.timeMsToStep(initialPlaybackTimeMs, initialBpm || 60);
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
    if (!sequenceDataProvider) return seq;
    return sequenceDataProvider.hydrateSequence(seq);
  }

  // Event handlers
  function handleViewModeChange(mode: ViewMode) {
    hapticService?.trigger("selection");
    viewMode = mode;
    saveViewMode(mode);

    // Sync to URL for HMR persistence
    setViewModeUrl(mode as SequenceViewMode);

    // Playback continues seamlessly regardless of view mode change
    // User can use spacebar or play/pause button to control playback
  }

  function handlePlaybackToggle() {
    arrivedViaStepping = false;
    playbackController?.togglePlayback();
    // Announcement handled by isPlayingLocal state change below
  }

  function handleStepHalfBack() { arrivedViaStepping = true; playbackController?.stepHalfBeatBackward(); }
  function handleStepHalfFwd() { arrivedViaStepping = true; playbackController?.stepHalfBeatForward(); }
  function handleStepFullBack() { arrivedViaStepping = true; playbackController?.stepFullBeatBackward(); }
  function handleStepFullFwd() { arrivedViaStepping = true; playbackController?.stepFullBeatForward(); }

  // Announce playback state changes
  $effect(() => {
    // Only announce after initial load (when services are ready)
    if (animationServicesReady) {
      accessibilityHelper.announce(isPlayingLocal ? "Playing" : "Paused");
    }
  });

  // ========== TEMPO RAMP TRAINING ==========
  const rampOrchestrator = new TempoRampOrchestrator();
  const rampState = createTempoRampState();
  // Derived flag to ensure Svelte tracks reactivity for the ramp active state
  let rampActive = $derived(rampState.progress.active);

  function handleBpmChange(newBpm: number) {
    hapticService?.trigger("selection");
    // Convert BPM to speed multiplier (60 BPM = 1.0 speed)
    const speedMultiplier = newBpm / 60;
    playbackController?.setSpeed(speedMultiplier);
    // Sync BPM to URL for persistence
    setBpmUrl(newBpm);
    // If ramp is active, sync the orchestrator's baseline BPM
    if (rampOrchestrator.isActive()) {
      rampOrchestrator.adjustBpm(newBpm);
      rampState.updateProgress(rampOrchestrator.getProgress());
    }
  }

  function handleRampStart() {
    if (!playbackController) {
      showToast("Animation not ready yet. Wait for it to load.", "info");
      return;
    }

    hapticService?.trigger("selection");
    rampState.clearCompletion();

    // Start the ramp orchestrator with user's saved config
    const startBpm = rampOrchestrator.start(rampState.userConfig);
    rampState.updateProgress(rampOrchestrator.getProgress());

    // Set BPM to start value
    handleBpmChange(startBpm);

    // Wire loop completion callback
    playbackController.onLoopComplete(() => {
      const newBpm = rampOrchestrator.onLoopComplete();
      rampState.updateProgress(rampOrchestrator.getProgress());

      if (newBpm !== null) {
        // BPM bumped - apply it
        handleBpmChange(newBpm);
        hapticService?.trigger("selection");
      }

      // Check if ramp ended (hit max BPM)
      if (!rampOrchestrator.isActive()) {
        handleRampStop();
      }
    });

    // Ensure playback is running and looping
    modalAnimationState.setShouldLoop(true);
    if (!isPlayingLocal) {
      playbackController.togglePlayback();
    }
  }

  function handleRampStop() {
    if (!playbackController) return;

    const finalBpm = rampOrchestrator.stop();
    rampState.updateProgress(rampOrchestrator.getProgress());

    // Remove loop completion callback
    playbackController.offLoopComplete();

    // Record personal best
    const sequenceId = sequence?.id || sequence?.word || "unknown";
    rampState.recordPersonalBest(sequenceId, finalBpm);

    // Show completion feedback
    rampState.showCompletion(finalBpm);
    hapticService?.trigger("success");

    const personalBest = rampState.getPersonalBest(sequenceId);
    const isNewBest = personalBest !== null && finalBpm >= personalBest;
    const message = isNewBest
      ? `Ramp complete: ${finalBpm} BPM (new best!)`
      : `Ramp complete: ${finalBpm} BPM`;
    showToast(message, "success");
  }

  function handleStepClick(stepIndex: number) {
    // Block clicks that follow a swipe gesture (prevents accidental step seeks when dismissing)
    if (swipeDismiss.state.blockClicks) {
      return;
    }

    // Only seek if the image pane is already focused AND playback is paused
    // When clicking to focus/unfocus the pane or during playback, don't interrupt
    if (editingPane !== 'image' || isPlayingLocal) {
      return;
    }

    if (playbackController) {
      hapticService?.trigger("selection");
      const targetStep = stepIndex + 1;
      arrivedViaStepping = false;
      modalAnimationState.setCurrentStep(targetStep);
      // Use seekToStep to maintain playback state (don't pause if playing)
      playbackController.seekToStep(targetStep);
    }
  }

  function handleClose() {
    // Stop ramp training if active
    if (rampOrchestrator.isActive()) {
      rampOrchestrator.stop();
      playbackController?.offLoopComplete();
      rampState.updateProgress(rampOrchestrator.getProgress());
    }

    if (isPlayingLocal && playbackController) {
      playbackController.togglePlayback();
    }
    setAnimationPlaybackRef(null);
    setSequenceViewerRef(null);
    // Clear URL state when closing modal
    clearModalUrlState();
    // Disconnect from LAN sync if connected
    if (lanSyncState.isConnected) {
      lanSyncState.disconnect();
    }
    // Restore focus to the element that triggered the modal
    accessibilityHelper.restoreFocus();
    onclose();
  }

  // Export callbacks shared across all export types
  const exportCallbacks = {
    onSuccess: (message: string) => {
      showToast(message, "success");
      accessibilityHelper.announce(message, "assertive");
      exitExportMode();
    },
    onError: (message: string) => {
      // Error is already tracked in exporter state
      accessibilityHelper.announce(`Export failed: ${message}`, "assertive");
    },
    onHaptic: (type: "success" | "error" | "selection") => {
      hapticService?.trigger(type);
    },
  };

  // Export handlers - delegate to service
  async function handleExport() {
    if (isExporting || !exportType) return;

    hapticService?.trigger("selection");

    // Route to appropriate export based on exportType (not viewMode)
    switch (exportType) {
      case "animation":
        await handleAnimationExport();
        break;
      case "image":
        await handleImageExport();
        break;
      // "both" is handled by selectExportType -> redirects to Compose
    }
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

  // Cache sequence data when opening (for HMR restoration)
  $effect(() => {
    if (open && sequence) {
      cacheSequence(sequence);
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
    swipeDismiss.dispose();
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

<!-- Screen reader announcements (visually hidden) -->
<div
  class="sr-only"
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {accessibilityHelper.announcement}
</div>

<BaseModal
  bind:open={internalOpen}
  onclose={() => handleClose()}
  size="full"
  animation="pop"
  closeOnEscape={!isFullscreen}
  closeOnBackdrop={!isFullscreen}
  class="sequence-details-modal"
>
  {#snippet header()}
    <ViewerHeader
      {isExportMode}
      {exportType}
      {isFullscreen}
      {isMobile}
      darkMode={imgDarkMode}
      onClose={handleClose}
      onExitExportMode={exitExportMode}
      onBackToExportTypeSelection={backToExportTypeSelection}
      onDarkModeToggle={() => toggleImgSetting("darkMode")}
    />
  {/snippet}

  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    bind:this={modalContainer}
    class="modal-body-content"
    data-view-mode={viewMode}
    data-fullscreen={isFullscreen}
    onclick={isFullscreen ? handleFullscreenTap : undefined}
    onkeydown={isFullscreen ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleFullscreenTap(); } : undefined}
    ontouchstart={handleTouchStart}
    ontouchend={handleTouchEnd}
    role={isFullscreen ? "button" : undefined}
    tabindex={isFullscreen ? 0 : undefined}
    aria-label={isFullscreen ? "Fullscreen viewer. Tap to show controls." : undefined}
  >
    <!-- Fullscreen floating controls overlay -->
    {#if isFullscreen}
      <FullscreenControls
        visible={fullscreenControlsVisible}
        {viewMode}
        isPlaying={isPlayingLocal}
        bpm={bpmLocal}
        onExit={exitFullscreen}
        onPlaybackToggle={handlePlaybackToggle}
        onStepHalfBeatBackward={handleStepHalfBack}
        onStepHalfBeatForward={handleStepHalfFwd}
        onStepFullBeatBackward={handleStepFullBack}
        onStepFullBeatForward={handleStepFullFwd}
        onBpmChange={handleBpmChange}
      />
    {/if}

    {#if isExportMode}
      <!-- Export mode: show type selector or preview/options -->
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
      <!-- Split view: Animation and Image side by side, tap to focus -->
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
  </div>

  {#snippet footer()}
    {#if !isFullscreen}
      {#if isExportMode}
        <!-- Export footer: shows button when type is selected, hint when selecting -->
        <ExportFooter
          {exportType}
          {isExporting}
          {exportProgress}
          {exportError}
          {isFullscreen}
          onExport={handleExport}
          onCancel={handleCancelExport}
          onRetry={() => { sequenceModalExporter.clearError(); handleExport(); }}
        />
      {:else}
        <!-- Footer: ViewerFooter with MorphChip toolbar (handles all screen sizes) -->
        <ViewerFooter
          bpm={bpmLocal}
          isPlaying={isPlayingLocal}
          isLoggedIn={authState.isAuthenticated}
          rampActive={rampActive}
          isSyncToggling={isSyncToggling}
          isSyncActive={lanSyncState.isActive}
          isSyncConnected={lanSyncState.isConnected}
          onBpmChange={handleBpmChange}
          onPlayPause={handlePlaybackToggle}
          onStepBack={handleStepFullBack}
          onStepForward={handleStepFullFwd}
          onStepHalfBack={handleStepHalfBack}
          onStepHalfForward={handleStepHalfFwd}
          onSave={handleSave}
          onCompose={handleCompose}
          onShare={handleShare}
          onExport={enterExportMode}
          onRampStart={() => handleRampStart()}
          onRampStop={() => handleRampStop()}
          onConnect={handleSyncToggle}
        />
        {#if rampActive}
          <RampProgressIndicator
            progress={rampState.progress}
            onStop={() => handleRampStop()}
            variant="floating"
          />
        {/if}
      {/if}
    {/if}
  {/snippet}
</BaseModal>

<!-- NOTE: Stagger mode now handled by Compose module via sequence handoff -->

<style>
  /* ===== ACCESSIBILITY: Screen reader only ===== */
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

  /* Content fills viewport in fullscreen */
  .modal-body-content[data-fullscreen="true"] {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    position: relative;
  }

  /* ===== END FULLSCREEN MORPH STYLES ===== */

  /* Body content - must fill the modal-body wrapper completely */
  .modal-body-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* Create stacking context for view transitions */
    position: relative;
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

    /* Desktop fullscreen: Override the padding to fill entire viewport */
    :global(.sequence-details-modal.base-modal[data-size="full"][data-fullscreen="true"]) {
      padding: 0 !important;
      border-radius: 0 !important;
    }

    :global(.sequence-details-modal.base-modal[data-size="full"][data-fullscreen="true"] .modal-content-wrapper) {
      border-radius: 0 !important;
      box-shadow: none !important;
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
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    :global(.sequence-details-modal.base-modal) {
      transition: none !important;
    }
  }
</style>
