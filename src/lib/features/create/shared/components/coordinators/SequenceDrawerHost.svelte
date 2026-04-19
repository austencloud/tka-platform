<script lang="ts">
  /**
   * SequenceDrawerHost
   *
   * Hosts the SequenceDrawer in Create module, providing animation state and export coordination.
   * This is the "host" that owns state and provides context to the drawer.
   *
   * Flow:
   * 1. User opens sequence drawer (single entry point)
   * 2. Selects format (Animation | Static | Performance)
   * 3. If Animation: initializes playback services, shows live preview
   * 4. Clicks Export button
   * 5. If sequence not saved, show SaveToLibraryPanel
   * 6. After save (or if already saved), proceed with export
   *
   * Architecture:
   * - SequenceDrawerHost OWNS animation state (unidirectional data flow)
   * - SequenceDrawer receives state as props via AnimationExportContext
   * - Services lazy-loaded when Animation format selected
   */

  import { onMount, onDestroy } from "svelte";
  import SequenceDrawer from "$lib/shared/sequence-viewer/components/SequenceDrawer.svelte";
  import type { ExportSettings } from "$lib/shared/export-panel/domain/models/ExportSettings";
  import type { ExportSettings as SequenceViewerExportSettings } from "$lib/shared/sequence-viewer/domain/types";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IPlatformDetector } from "$lib/shared/mobile/services/contracts/IPlatformDetector";
  import type { IExportOrchestrator } from "$lib/shared/export-panel/services/contracts/IExportOrchestrator";

  import { container } from "$lib/shared/di";
  import { responsiveLayoutManager } from "$lib/features/create/shared/services/implementations/ResponsiveLayoutManager";
  import { getCreateModuleContext } from "../../context/create-module-context";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/implementations/SequenceViewerNavigator";
  import { getReturnContext } from "$lib/shared/coordinators/sequence-handoff.svelte";

  // Animation imports
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type {
    IVideoExportOrchestrator,
    VideoExportProgress,
  } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
  import type { ISequenceLoopabilityChecker } from "$lib/features/compose/services/contracts/ISequenceLoopabilityChecker";
  import type { ISequenceRepository } from "$lib/features/create/shared/services/contracts/ISequenceRepository";
  import type { ISheetRouter } from "$lib/shared/navigation/services/contracts/ISheetRouter";
  import { ExportUrlManager } from "$lib/shared/export-panel/services/implementations/ExportUrlManager";
  import type { IResponsiveLayoutManager } from "$lib/features/create/shared/services/contracts/IResponsiveLayoutManager";
  import {
    createAnimationPanelState,
    type PlaybackMode,
    type StepPlaybackStepSize,
    type AnimationStateKey,
  } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { setAnimationPlaybackRef } from "$lib/shared/coordinators/animation-playback-ref.svelte";
  import { ANIMATION_AUTO_START_DELAY_MS } from "$lib/features/compose/shared/domain/constants/timing";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
  import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";

  // Get context
  const ctx = getCreateModuleContext();
  const { CreateModuleState, panelState } = ctx;

  // Core services (resolved immediately)
  let hapticService: IHapticFeedback | null = null;
  let exportOrchestrator: IExportOrchestrator | null = null;
  let platformService: IPlatformDetector | null = null;
  let sheetRouterService: ISheetRouter | null = null;
  let sequenceService: ISequenceRepository | null = null;

  // Animation services (lazy-loaded when Animation format selected)
  let playbackController: IAnimationPlaybackController | null = null;
  let videoExportOrchestrator: IVideoExportOrchestrator | null = null;
  let loopabilityChecker: ISequenceLoopabilityChecker | null = null;
  let layoutService: IResponsiveLayoutManager | null = null;
  let animationCanvas: HTMLCanvasElement | null = null;

  // Animation state - owned by this coordinator (unidirectional flow)
  const animationPanelState = createAnimationPanelState();
  let animationServicesReady = $state(false);
  let animationLoading = $state(false);
  let lastLoadedSequenceId: string | null = null;

  // Local reactive state for animation (synced via observer pattern)
  let isPlayingLocal = $state(false);
  let playbackModeLocal = $state<PlaybackMode>("continuous");
  let stepPlaybackPauseMsLocal = $state(300);
  let stepPlaybackStepSizeLocal = $state<StepPlaybackStepSize>(1);
  let cleanupAnimationStateSubscription: (() => void) | undefined;

  // Visibility state management
  const visibilityManager = getVisibilityStateManager();
  let savedMotionVisibility: { blue: boolean; red: boolean } | null = null;

  // Layout detection
  let isSideBySideLayout = $state(false);

  // Resolve core services
  try {
    hapticService = container.items.hapticFeedback;
  } catch (error) {
    console.warn("⚠️ Failed to resolve haptic feedback service:", error);
  }

  try {
    exportOrchestrator = container.items.exportOrchestrator;
  } catch (error) {
    console.warn("⚠️ Failed to resolve export orchestrator:", error);
  }

  try {
    platformService = container.items.platformDetector;
  } catch (error) {
    console.warn("⚠️ Failed to resolve platform detection service:", error);
  }

  try {
    sheetRouterService = container.items.sheetRouter;
  } catch (error) {
    console.warn("⚠️ Failed to resolve sheet router service:", error);
  }

  try {
    sequenceService = container.items.sequenceRepository;
  } catch (error) {
    console.warn("⚠️ Failed to resolve sequence repository:", error);
  }

  // Detect if we're on mobile (for share vs download behavior)
  const platform = platformService?.detectPlatform() ?? "desktop";
  const isMobile = platform === "ios" || platform === "android";

  // URL state manager for deep linking and history
  const urlManager = new ExportUrlManager(sheetRouterService);
  let cleanupUrlManager: (() => void) | undefined;

  // State
  let isExporting = $state(false);
  let exportProgress = $state<VideoExportProgress | null>(null);

  // Track selected format for animation loading
  let selectedFormat = $state<"animation" | "static" | "performance">(
    "animation"
  );

  // Handle requested format from keyboard shortcut or external trigger
  $effect(() => {
    if (panelState.isExportPanelOpen && panelState.requestedExportFormat) {
      selectedFormat = panelState.requestedExportFormat;
      panelState.clearRequestedExportFormat();
    }
  });

  // Derived: Get current sequence from active tab
  const currentSequence = $derived(
    CreateModuleState.sequenceState.currentSequence
  );

  // Animation-specific derived values
  const isCircular = $derived.by(() => {
    const seq = animationPanelState.sequenceData;
    if (!seq || !loopabilityChecker) return false;
    return loopabilityChecker.isSeamlesslyLoopable(seq);
  });

  const exportLoopCount = $derived(animationPanelState.exportLoopCount);

  const resolvedGridMode = $derived(
    animationPanelState.sequenceData?.gridMode ?? currentSequence?.gridMode
  );

  // Current letter for glyph display
  const currentLetter = $derived.by(() => {
    if (!animationPanelState.sequenceData) return null;
    const currentStep = animationPanelState.currentStep;
    if (currentStep < 1 && animationPanelState.sequenceData.startPosition) {
      return animationPanelState.sequenceData.startPosition.letter || null;
    }
    if (animationPanelState.sequenceData.steps?.length > 0) {
      const stepNumber = Math.ceil(currentStep - 1);
      const stepIndex = Math.max(0, stepNumber - 1);
      const clampedIndex = Math.min(
        stepIndex,
        animationPanelState.sequenceData.steps.length - 1
      );
      return (
        animationPanelState.sequenceData.steps[clampedIndex]?.letter || null
      );
    }
    return null;
  });

  // Current beat data for AnimatorCanvas
  const currentStepData = $derived.by(() => {
    if (!animationPanelState.sequenceData) return null;
    const currentStep = animationPanelState.currentStep;
    if (currentStep < 1 && animationPanelState.sequenceData.startPosition) {
      return animationPanelState.sequenceData.startPosition;
    }
    if (animationPanelState.sequenceData.steps?.length > 0) {
      const stepNumber = Math.ceil(currentStep - 1);
      const stepIndex = Math.max(0, stepNumber - 1);
      const clampedIndex = Math.min(
        stepIndex,
        animationPanelState.sequenceData.steps.length - 1
      );
      return animationPanelState.sequenceData.steps[clampedIndex] || null;
    }
    return null;
  });

  // Subscribe to animation state changes (replaces polling)
  cleanupAnimationStateSubscription = animationPanelState.subscribe(
    (key: AnimationStateKey, value: unknown) => {
      switch (key) {
        case "isPlaying":
          isPlayingLocal = value as boolean;
          break;
        case "playbackMode":
          playbackModeLocal = value as PlaybackMode;
          break;
        case "stepPlaybackPauseMs":
          stepPlaybackPauseMsLocal = value as number;
          break;
        case "stepPlaybackStepSize":
          stepPlaybackStepSizeLocal = value as StepPlaybackStepSize;
          break;
      }
    }
  );

  // Save visibility state when export panel opens, restore when it closes
  $effect(() => {
    if (
      panelState.isExportPanelOpen &&
      selectedFormat === "animation" &&
      savedMotionVisibility === null
    ) {
      savedMotionVisibility = visibilityManager.saveMotionVisibilityState();
    }
  });

  // Update layout detection
  $effect(() => {
    if (layoutService) {
      isSideBySideLayout = layoutService.shouldUseSideBySideLayout();
    }
  });

  // Lazy load animation services when Animation format selected
  // Check requestedExportFormat to avoid loading when user explicitly requested static format
  $effect(() => {
    const pendingFormat = panelState.requestedExportFormat;
    const effectiveFormat = pendingFormat ?? selectedFormat;
    if (
      effectiveFormat === "animation" &&
      panelState.isExportPanelOpen &&
      !animationServicesReady
    ) {
      loadAnimationServices();
    }
  });

  async function loadAnimationServices() {
    try {
      // Animation services available synchronously via ITI
      playbackController = container.items.animationPlaybackController;
      videoExportOrchestrator = container.items.videoExportOrchestrator;
      loopabilityChecker = container.items.sequenceLoopabilityChecker;
      layoutService = responsiveLayoutManager;
      setAnimationPlaybackRef(playbackController);

      // Pass video orchestrator to export orchestrator for animation exports
      if (exportOrchestrator && videoExportOrchestrator) {
        (exportOrchestrator as any).setVideoOrchestrator(videoExportOrchestrator);
      }

      // Update layout detection
      if (layoutService) {
        isSideBySideLayout = layoutService.shouldUseSideBySideLayout();
      }

      animationServicesReady = true;
    } catch (error) {
      console.error("❌ Failed to load animation services:", error);
      animationPanelState.setError("Failed to load animation services");
    }
  }

  // When panelState.isSequenceViewerOpen becomes true, open the sequence viewer
  $effect(() => {
    if (panelState.isSequenceViewerOpen && currentSequence) {
      // Clear the flag immediately
      panelState.closeSequenceViewer();

      // Stamp ownership on the sequence so the viewer shows Save/Edit/Delete actions.
      // Sequences built in the create module don't have ownerId since they haven't
      // been persisted to Firestore yet.
      const sequenceWithOwner = currentSequence.ownerId
        ? currentSequence
        : {
            ...currentSequence,
            ownerId: authState.user?.uid ?? undefined,
            ownerDisplayName: authState.user?.displayName ?? undefined,
          };

      const { returnPath, returnLabel } = getReturnContext();
      openSequenceViewer(sequenceWithOwner, { returnPath, returnLabel });
    }
  });

  // Initialize animation when services ready and sequence available
  // Check requestedExportFormat to avoid initializing when user explicitly requested static format
  $effect(() => {
    // Only initialize if we're actually in the Create module
    const isInCreateModule = navigationState.currentModule === "create";
    const pendingFormat = panelState.requestedExportFormat;
    const effectiveFormat = pendingFormat ?? selectedFormat;

    if (
      isInCreateModule &&
      effectiveFormat === "animation" &&
      panelState.isExportPanelOpen &&
      animationServicesReady &&
      currentSequence &&
      playbackController &&
      sequenceService
    ) {
      const sequenceId =
        currentSequence.id || currentSequence.word || "unknown";
      if (sequenceId !== lastLoadedSequenceId) {
        initializeAnimation(currentSequence, sequenceId);
      }
    }
  });

  // Sync sequence data changes to animation (e.g., when user edits beat duration)
  // This triggers when currentSequence content changes but ID stays the same
  let lastSequenceHash = $state<string | null>(null);

  function getSequenceHash(seq: SequenceData | null): string | null {
    if (!seq) return null;
    // Create a simple hash from beat durations to detect relevant changes
    const beatDurations = seq.steps?.map(b => b.duration ?? 1).join(',') || '';
    return `${seq.id || seq.word || 'unknown'}-${seq.steps?.length || 0}-${beatDurations}`;
  }

  $effect(() => {
    if (
      selectedFormat === "animation" &&
      panelState.isExportPanelOpen &&
      animationServicesReady &&
      currentSequence &&
      playbackController &&
      lastLoadedSequenceId // Only sync after initial load
    ) {
      const currentHash = getSequenceHash(currentSequence);
      if (currentHash !== lastSequenceHash && lastSequenceHash !== null) {
        // Sequence content changed - sync to animation
        playbackController.updateSequenceData(currentSequence);
        animationPanelState.setSequenceData(currentSequence);
      }
      lastSequenceHash = currentHash;
    }
  });

  async function initializeAnimation(seq: SequenceData, sequenceId: string) {
    if (!playbackController || !sequenceService) return;

    animationLoading = true;
    animationPanelState.setLoading(true);
    animationPanelState.setError(null);

    try {
      // Load and hydrate sequence data
      const loadedSequence = await loadSequenceData(seq);
      if (!loadedSequence) throw new Error("Failed to load sequence");

      // Initialize playback
      animationPanelState.setShouldLoop(true);
      const success = playbackController.initialize(
        loadedSequence,
        animationPanelState
      );
      if (!success) throw new Error("Failed to initialize playback");

      lastLoadedSequenceId = sequenceId;
      animationPanelState.setSequenceData(loadedSequence);

      // Auto-start after delay - but only if still viewing animation format
      // This prevents step grid from animating when user opened with static format
      setTimeout(() => {
        if (selectedFormat === "animation") {
          playbackController?.togglePlayback();
        }
      }, ANIMATION_AUTO_START_DELAY_MS);
    } catch (err) {
      // Use warn instead of error - animation init failures are expected for sequences
      // without full motion data (user-generated sequences, test sequences, etc.)
      console.warn("[SequenceDrawerHost] Animation not available for this sequence");
      animationPanelState.setError("Animation data not available for this sequence");
    } finally {
      animationLoading = false;
      animationPanelState.setLoading(false);
    }
  }

  async function loadSequenceData(
    sequence: SequenceData
  ): Promise<SequenceData | null> {
    if (!sequenceService) return ensureWordPopulated(sequence);

    const hasMotionData = (s: SequenceData) =>
      Array.isArray(s.steps) &&
      s.steps.length > 0 &&
      s.steps.some((beat) => beat?.motions?.blue && beat?.motions?.red);

    if (hasMotionData(sequence)) return ensureWordPopulated(sequence);

    // Try to hydrate from gallery
    const galleryId = sequence.word || sequence.id;
    if (galleryId) {
      const hydrated = await sequenceService.getSequence(galleryId);
      if (hydrated && hasMotionData(hydrated)) return ensureWordPopulated(hydrated);
    }

    return ensureWordPopulated(sequence);
  }

  /**
   * Ensures the sequence has a word property populated.
   * If not set, derives it from beat letters.
   * This fixes the word header not showing in Construct tab's Sequence Viewer.
   */
  function ensureWordPopulated(sequence: SequenceData): SequenceData {
    if (sequence.word) return sequence;

    // Derive word from beat letters (same logic as SequenceStatsCalculator.generateSequenceWord)
    const derivedWord = sequence.steps
      ?.filter((beat) => !!beat.letter)
      .map((beat) => beat.letter)
      .join("") || "";

    if (!derivedWord) return sequence;

    // Return new object with word populated
    // simplifyRepeatedWord handles LOOP sequences where steps contain both halves
    return {
      ...sequence,
      word: simplifyRepeatedWord(derivedWord),
    };
  }

  // Initialize URL manager on mount
  onMount(() => {
    cleanupUrlManager = urlManager.initialize({
      onAnimationPanelOpen: () => {
        if (!panelState.isExportPanelOpen) {
          selectedFormat = "animation";
          panelState.openExportPanel("animation");
        }
      },
      onStateRestore: (urlState) => {
        if (!playbackController || !animationServicesReady) return;

        // Restore speed if specified (safe to do while playing)
        if (urlState.speed !== undefined && urlState.speed !== animationPanelState.speed) {
          playbackController.setSpeed(urlState.speed);
        }

        // Only restore current beat on initial load (when not playing)
        if (!animationPanelState.isPlaying && urlState.currentStep !== undefined) {
          animationPanelState.setCurrentStep(urlState.currentStep);
        }
      },
    });
  });

  // Sync panel open/close with URL
  // Use a mounted flag to prevent reset during initial mount when state is settling
  let hasMounted = false;
  let previousIsOpen = panelState.isExportPanelOpen;
  $effect(() => {
    const isOpen = panelState.isExportPanelOpen;

    // Handle animation URL state (only when animation format selected)
    if (selectedFormat === "animation") {
      if (isOpen && !previousIsOpen && currentSequence) {
        urlManager.pushAnimationPanelOpen({
          sequenceId: currentSequence.id,
          speed: animationPanelState.speed,
          isPlaying: animationPanelState.isPlaying,
          currentStep: animationPanelState.currentStep,
        });
      }
    }

    // ALWAYS reset animation state on close, regardless of format
    // This ensures reopening after adding beats shows the updated sequence
    // CRITICAL: Skip reset if we're in the middle of a reopen operation (guard flag set)
    // This prevents the transient close from closeAllPanels() within openExportPanel() from
    // corrupting state before the panel actually opens
    if (!isOpen && previousIsOpen && hasMounted && !panelState.isExportPanelReopening) {
      urlManager.clearUrlState();
      // Reset loaded sequence tracking so reopening triggers full reinitialization
      lastLoadedSequenceId = null;
      lastSequenceHash = null;
      // Reset animation state to start
      animationPanelState.reset();
    }

    previousIsOpen = isOpen;
    // Set mounted flag after first effect run
    if (!hasMounted) {
      hasMounted = true;
    }
  });

  // Sync animation state changes to URL (without pushing new history)
  let previousSpeed = animationPanelState.speed;
  let previousPlaying = animationPanelState.isPlaying;
  $effect(() => {
    if (panelState.isExportPanelOpen && selectedFormat === "animation") {
      const currentSpeed = animationPanelState.speed;
      const currentPlaying = animationPanelState.isPlaying;

      if (currentSpeed !== previousSpeed || currentPlaying !== previousPlaying) {
        urlManager.updateAnimationState({
          speed: currentSpeed,
          isPlaying: currentPlaying,
        });
        previousSpeed = currentSpeed;
        previousPlaying = currentPlaying;
      }
    }
  });

  // Cleanup on unmount
  onDestroy(() => {
    cleanupUrlManager?.();
    cleanupAnimationStateSubscription?.();
    if (playbackController) {
      playbackController.dispose();
      setAnimationPlaybackRef(null);
    }
    animationPanelState.dispose();
  });

  // Animation playback handlers
  function handlePlaybackToggle() {
    playbackController?.togglePlayback();
  }

  function handleSpeedChange(newSpeed: number) {
    hapticService?.trigger("selection");
    playbackController?.setSpeed(newSpeed);
  }

  function handleStepHalfBeatForward() {
    playbackController?.stepHalfBeatForward();
  }

  function handleStepHalfBeatBackward() {
    playbackController?.stepHalfBeatBackward();
  }

  function handleStepFullBeatForward() {
    playbackController?.stepFullBeatForward();
  }

  function handleStepFullBeatBackward() {
    playbackController?.stepFullBeatBackward();
  }

  function handleLoopCountChange(count: number) {
    animationPanelState.setExportLoopCount(count);
  }

  function handleCanvasReady(canvas: HTMLCanvasElement | null) {
    animationCanvas = canvas;
  }

  function handlePlaybackModeChange(mode: PlaybackMode) {
    animationPanelState.setPlaybackMode(mode);
  }

  function handleStepPlaybackPauseMsChange(pauseMs: number) {
    animationPanelState.setStepPlaybackPauseMs(pauseMs);
  }

  function handleStepPlaybackStepSizeChange(stepSize: StepPlaybackStepSize) {
    animationPanelState.setStepPlaybackStepSize(stepSize);
  }

  function handleFormatChange(format: "animation" | "static" | "performance") {
    // Pause animation when switching away from Animation format
    if (
      selectedFormat === "animation" &&
      format !== "animation" &&
      isPlayingLocal
    ) {
      playbackController?.togglePlayback();
    }
    selectedFormat = format;
  }

  // Event handlers
  function handleClose() {
    hapticService?.trigger("selection");

    // Pause animation when closing export panel
    if (isPlayingLocal && playbackController) {
      playbackController.togglePlayback();
    }

    // Restore saved motion visibility state
    if (savedMotionVisibility !== null) {
      visibilityManager.restoreMotionVisibilityState(savedMotionVisibility);
      savedMotionVisibility = null;
    }

    // Cancel any ongoing export
    if (videoExportOrchestrator?.isExporting()) {
      videoExportOrchestrator.cancelExport();
      exportProgress = null;
    }

    panelState.closeExportPanel();
  }

  // Adapter function to convert between ExportSettings types
  function adaptExportSettings(settings: SequenceViewerExportSettings): ExportSettings {
    return {
      format: settings.format as "animation" | "static" | "performance",
      animationSettings: settings.animationSettings ? {
        ...settings.animationSettings,
        preset: null, // sequence-viewer doesn't have preset, default to null
      } : undefined,
      staticSettings: settings.staticSettings,
      performanceSettings: undefined,
    };
  }

  async function handleExport(
    mode: "single" | "composite",
    settings?: SequenceViewerExportSettings
  ) {
    if (isExporting) return;
    const adaptedSettings = settings ? adaptExportSettings(settings) : undefined;
    await performExport(mode, adaptedSettings);
  }

  async function performExport(
    mode: "single" | "composite",
    settings?: ExportSettings
  ) {
    if (!currentSequence) {
      showToast("No sequence to export", "error");
      return;
    }

    if (!exportOrchestrator) {
      showToast("Export service not available", "error");
      return;
    }

    if (mode === "composite") {
      // Composite export - TODO: implement full composite rendering
      showToast("Composite export coming soon!", "info");
      hapticService?.trigger("selection");
      return;
    }

    if (!settings) {
      showToast("Export settings required", "error");
      return;
    }

    isExporting = true;

    try {
      // Build animation dependencies if needed
      const animationDependencies =
        settings.format === "animation" && playbackController && animationCanvas
          ? {
              canvas: animationCanvas,
              playbackController,
              animationState: animationPanelState,
            }
          : undefined;

      const result = await exportOrchestrator.export(currentSequence, settings, {
        animationDependencies,
        userInfo: { displayName: authState.user?.displayName ?? null },
        isMobile,
        onProgress: (progress) => {
          exportProgress = progress;
          if (progress.stage === "error") {
            showToast(progress.error || "Export failed", "error");
          }
        },
      });

      if (result.success) {
        hapticService?.trigger("success");
        showToast("Export complete!", "success");
        panelState.closeExportPanel();
      } else {
        throw new Error(result.error || "Export failed");
      }
    } catch (error) {
      console.error("Export failed:", error);
      hapticService?.trigger("error");
      showToast(
        error instanceof Error ? error.message : "Export failed",
        "error"
      );
    } finally {
      isExporting = false;
      exportProgress = null;
    }
  }

  function handleCancelExport() {
    exportOrchestrator?.cancelExport();
    exportProgress = null;
    showToast("Export cancelled", "info");
  }

  async function handleExportVideo() {
    if (isExporting) return;
    await performExport("single", { format: "animation" });
  }

</script>

{#if currentSequence}
  <!-- Key forces remount when viewId changes, ensuring fresh animation state on reopen -->
  {#key panelState.exportPanelViewId}
    <SequenceDrawer
    isOpen={panelState.isExportPanelOpen}
    sequence={currentSequence}
    mode="edit"
    {isMobile}
    respectLayoutMode={true}
    {selectedFormat}
    isExporting={isExporting}
    exportProgress={exportProgress}
    showVisibilitySettings={true}
    onClose={handleClose}
    onExport={(format, settings) => handleExport("single", settings)}
    onSaveToLibrary={() => panelState.openSaveToLibraryPanel()}
    onFormatChange={handleFormatChange}
    onCancelExport={handleCancelExport}
    animationSequenceData={animationPanelState.sequenceData}
    isAnimationPlaying={isPlayingLocal}
    animationCurrentBeat={animationPanelState.currentStep}
    animationSpeed={animationPanelState.speed}
    animationBluePropState={animationPanelState.bluePropState}
    animationRedPropState={animationPanelState.redPropState}
    {isCircular}
    {exportLoopCount}
    isAnimationExporting={isExporting && selectedFormat === "animation"}
    animationExportProgress={exportProgress}
    {animationServicesReady}
    {animationLoading}
    playbackMode={playbackModeLocal}
    stepPlaybackPauseMs={stepPlaybackPauseMsLocal}
    stepPlaybackStepSize={stepPlaybackStepSizeLocal}
    {isSideBySideLayout}
    onPlaybackToggle={handlePlaybackToggle}
    onSpeedChange={handleSpeedChange}
    onStepHalfBeatForward={handleStepHalfBeatForward}
    onStepHalfBeatBackward={handleStepHalfBeatBackward}
    onStepFullBeatForward={handleStepFullBeatForward}
    onStepFullBeatBackward={handleStepFullBeatBackward}
    onLoopCountChange={handleLoopCountChange}
    onCanvasReady={handleCanvasReady}
    onExportVideo={handleExportVideo}
    onPlaybackModeChange={handlePlaybackModeChange}
    onStepPlaybackPauseMsChange={handleStepPlaybackPauseMsChange}
    onStepPlaybackStepSizeChange={handleStepPlaybackStepSizeChange}
  />
  {/key}
{/if}

<!-- Sequence Details Modal removed - $effect intercept at line 314 redirects to /sequence/[id] route -->
