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
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { ISequenceLoopabilityChecker } from "$lib/features/compose/services/contracts/ISequenceLoopabilityChecker";
  import type { ISequenceRepository } from "$lib/features/create/shared/services/contracts/ISequenceRepository";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { createAnimationPanelState, type PlaybackMode, type AnimationStateKey } from "$lib/features/compose/state/animation-panel-state.svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import LayeredSequencePreview from "./LayeredSequencePreview.svelte";
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import BpmChips from "$lib/features/compose/components/controls/BpmChips.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { setAnimationPlaybackRef } from "$lib/shared/coordinators/animation-playback-ref.svelte";
  import { getAnimationVisibilityManager, type TrailStyle } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { openSpotlightWithAnimation, openSpotlightWithSplit, getShowSpotlight } from "$lib/shared/application/state/ui/ui-state.svelte";
  import StaggerModeModal from "./stagger/StaggerModeModal.svelte";
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

  // Settings panel visibility (chips hidden by default)
  let showSettings = $state(false);

  // Track when we've opened spotlight so we can restore modal when it closes
  let openedSpotlightFromHere = $state(false);
  let wasPlayingBeforeSpotlight = $state(false);
  let spotlightOpen = $derived(getShowSpotlight());

  // Effective open state: modal is hidden while spotlight is open (to avoid native dialog "top layer" blocking)
  let effectiveOpen = $derived(open && !spotlightOpen);

  // Watch for spotlight closing - resume animation when it does
  $effect(() => {
    if (!spotlightOpen && openedSpotlightFromHere) {
      // Spotlight just closed and we opened it
      openedSpotlightFromHere = false;
      // Resume playback if it was playing before
      if (wasPlayingBeforeSpotlight && playbackController && !isPlayingLocal) {
        setTimeout(() => {
          playbackController?.togglePlayback();
        }, 100);
      }
    }
  });

  function toggleSettings() {
    hapticService?.trigger("selection");
    showSettings = !showSettings;
  }

  function enterFullscreen() {
    hapticService?.trigger("selection");
    // Open SpotlightViewer for true fullscreen experience
    // Native <dialog> "top layer" blocks everything, so we close the modal temporarily
    // and reopen when spotlight closes (handled by parent via callback)
    if (sequence) {
      // Remember playback state so we can resume when returning
      wasPlayingBeforeSpotlight = isPlayingLocal;
      openedSpotlightFromHere = true;

      // Pause animation while in spotlight (spotlight has its own playback)
      if (isPlayingLocal && playbackController) {
        playbackController.togglePlayback();
      }

      // Open spotlight based on current view mode
      if (viewMode === "split") {
        openSpotlightWithSplit(sequence);
      } else if (viewMode === "animation") {
        openSpotlightWithAnimation(sequence);
      } else {
        // Image mode - use split for fullscreen so animation is available
        openSpotlightWithSplit(sequence);
      }
    }
  }

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
          break;
        case "currentStep":
          currentStepLocal = value as number;
          // Periodically update URL with current position (debounced internally)
          if (isPlayingLocal) {
            const timeMs = calculatePlaybackTimeMs(value as number, bpmLocal);
            setPlaybackTimeUrl(timeMs);
          }
          break;
        case "speed":
          // Convert speed multiplier to BPM (speed 1.0 = 60 BPM)
          bpmLocal = Math.round((value as number) * 60);
          break;
      }
    }
  );

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
    onclose();
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
    if (playbackController) {
      playbackController.dispose();
    }
    modalAnimationState.dispose();
  });

  // View mode options for the picker
  const viewModes: Array<{ value: ViewMode; label: string; icon: string }> = [
    { value: "split", label: "Split", icon: "fa-columns" },
    { value: "animation", label: "Animation", icon: "fa-play-circle" },
    { value: "image", label: "Image", icon: "fa-image" },
  ];
</script>

<BaseModal
  open={effectiveOpen}
  onclose={() => handleClose()}
  size="full"
  animation="pop"
  closeOnEscape={true}
  closeOnBackdrop={true}
  class="sequence-details-modal"
>
  {#snippet header()}
    <header class="details-header">
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
        <div class="view-mode-switcher" role="tablist" aria-label="View mode">
          {#each viewModes as mode}
            <button
              type="button"
              role="tab"
              class="mode-button"
              class:active={viewMode === mode.value}
              aria-selected={viewMode === mode.value}
              onclick={() => handleViewModeChange(mode.value)}
            >
              <i class="fas {mode.icon}" aria-hidden="true"></i>
              <span class="mode-label">{mode.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="header-right">
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
          class:active={showSettings}
          onclick={toggleSettings}
          aria-label={showSettings ? "Hide settings" : "Show settings"}
          aria-pressed={showSettings}
          title="Visibility settings"
        >
          <i class="fas fa-sliders-h" aria-hidden="true"></i>
        </button>
      </div>
    </header>
  {/snippet}

  <div class="modal-body-content" data-view-mode={viewMode}>
    {#if viewMode === "split"}
      <!-- Split view: Animation and Image side by side -->
      <div class="split-view">
        <div class="split-column animation-column">
          <div class="media-pane animation-pane">
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
              />
            {/if}
          </div>
          {#if showSettings}
            <div class="split-chips">
              <button type="button" class="chip" class:active={animTrailStyle === "on"} onclick={() => toggleAnimSetting("trailStyle")} aria-pressed={animTrailStyle === "on"}>Trails</button>
              <button type="button" class="chip" class:active={animTkaGlyph} onclick={() => toggleAnimSetting("tkaGlyph")} aria-pressed={animTkaGlyph}>TKA</button>
              <button type="button" class="chip" class:active={animWordHeader} onclick={() => toggleAnimSetting("wordHeader")} aria-pressed={animWordHeader}>Word</button>
            </div>
          {/if}
        </div>
        <div class="split-column preview-column">
          <div class="media-pane preview-pane">
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
          {#if showSettings}
            <div class="split-chips">
              <button type="button" class="chip" class:active={imgShowWord} onclick={() => toggleImgSetting("word")} aria-pressed={imgShowWord}>Word</button>
              <button type="button" class="chip" class:active={imgShowStartPos} onclick={() => toggleImgSetting("startPos")} aria-pressed={imgShowStartPos}>Start</button>
              <button type="button" class="chip" class:active={imgShowDifficulty} onclick={() => toggleImgSetting("difficulty")} aria-pressed={imgShowDifficulty}>Level</button>
              <button type="button" class="chip" class:active={imgShowCreatorName} onclick={() => toggleImgSetting("creatorName")} aria-pressed={imgShowCreatorName}>Name</button>
            </div>
          {/if}
        </div>
        <!-- Fullscreen button for split mode -->
        <button
          type="button"
          class="fullscreen-btn split-fullscreen-btn"
          onclick={enterFullscreen}
          aria-label="Enter fullscreen"
          title="Fullscreen"
        >
          <i class="fas fa-expand" aria-hidden="true"></i>
        </button>
      </div>
    {:else if viewMode === "animation"}
      <!-- Animation only view -->
      <div class="single-view animation-view">
        <div class="media-container">
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
            />
          {/if}
        </div>
        {#if showSettings}
          <div class="visibility-chips">
            <button
              type="button"
              class="chip"
              class:active={animTrailStyle === "on"}
              onclick={() => toggleAnimSetting("trailStyle")}
              aria-pressed={animTrailStyle === "on"}
            >Trails</button>
            <button
              type="button"
              class="chip"
              class:active={animTkaGlyph}
              onclick={() => toggleAnimSetting("tkaGlyph")}
              aria-pressed={animTkaGlyph}
            >TKA</button>
            <button
              type="button"
              class="chip"
              class:active={animWordHeader}
              onclick={() => toggleAnimSetting("wordHeader")}
              aria-pressed={animWordHeader}
            >Word</button>
          </div>
        {/if}
        <!-- Fullscreen button for animation mode -->
        <button
          type="button"
          class="fullscreen-btn"
          onclick={enterFullscreen}
          aria-label="Enter fullscreen"
          title="Fullscreen"
        >
          <i class="fas fa-expand" aria-hidden="true"></i>
        </button>
      </div>
    {:else}
      <!-- Image only view -->
      <div class="single-view image-view">
        <div class="media-container">
          <LayeredSequencePreview
            {sequence}
            showHighlight={false}
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
        {#if showSettings}
          <div class="visibility-chips">
            <button
              type="button"
              class="chip"
              class:active={imgShowWord}
              onclick={() => toggleImgSetting("word")}
              aria-pressed={imgShowWord}
            >Word</button>
            <button
              type="button"
              class="chip"
              class:active={imgShowStartPos}
              onclick={() => toggleImgSetting("startPos")}
              aria-pressed={imgShowStartPos}
            >Start</button>
            <button
              type="button"
              class="chip"
              class:active={imgShowDifficulty}
              onclick={() => toggleImgSetting("difficulty")}
              aria-pressed={imgShowDifficulty}
            >Level</button>
            <button
              type="button"
              class="chip"
              class:active={imgShowCreatorName}
              onclick={() => toggleImgSetting("creatorName")}
              aria-pressed={imgShowCreatorName}
            >Name</button>
            <button
              type="button"
              class="chip"
              class:active={imgShowNotes}
              onclick={() => toggleImgSetting("notes")}
              aria-pressed={imgShowNotes}
            >Notes</button>
          </div>
        {/if}
        <!-- Fullscreen button for image mode -->
        <button
          type="button"
          class="fullscreen-btn"
          onclick={enterFullscreen}
          aria-label="Enter fullscreen"
          title="Fullscreen"
        >
          <i class="fas fa-expand" aria-hidden="true"></i>
        </button>
      </div>
    {/if}
  </div>

  {#snippet footer()}
    {#if viewMode !== "image"}
      <footer class="controls-footer">
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
        </div>
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

<style>
  /* Header */
  .details-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

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

  /* View Mode Switcher */
  .view-mode-switcher {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .mode-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 48px;
  }

  .mode-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }

  .mode-button.active {
    background: var(--theme-accent, #6366f1);
    color: white;
  }

  .mode-label {
    font-weight: 500;
  }

  /* Body content - must fill the modal-body wrapper completely */
  .modal-body-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Split view */
  .split-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }

  .split-column {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
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

  /* Split view chips beneath each media */
  .split-chips {
    display: none; /* Hidden on mobile by default */
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    padding: 8px 16px 16px;
    flex-shrink: 0;
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

  /* Footer controls */
  .controls-footer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

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
  }

  /* Visibility chips */
  .visibility-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    padding: 12px 0;
    margin-top: auto;
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
    transform: scale(0.95);
    transition-duration: 50ms;
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 45%, transparent);
    color: white;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
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

    /* Show split chips on desktop */
    .split-chips {
      display: flex;
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

  /* Fullscreen button */
  .fullscreen-btn {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: 16px;
    cursor: pointer;
    transition: all 0.15s ease;
    z-index: 10;
    -webkit-tap-highlight-color: transparent;
  }

  .fullscreen-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .fullscreen-btn:active {
    transform: scale(0.95);
  }

  .fullscreen-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Split view needs relative positioning for fullscreen button */
  .split-view {
    position: relative;
  }

  .single-view {
    position: relative;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }

    .mode-button,
    .close-button,
    .header-icon-btn,
    .fullscreen-btn {
      transition: none;
    }
  }
</style>
