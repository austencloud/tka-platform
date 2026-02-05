<!--
  LOOP Labeler Module

  Main orchestrator component that replaces the monolithic +page.svelte.
  Manages state, coordinates mode-specific behavior, and composes all panels.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import { loopDetector } from "../services/implementations/LOOPDetector";
  import type { IStepDataConverter } from "../services/contracts/IStepDataConverter";
  import type {
    ILOOPDetector,
    LOOPDetectionResult,
  } from "../services/contracts/ILOOPDetector";
  import type { LOOPLabelerState } from "../state/loop-labeler-state.svelte";
  import {
    loopLabelerState,
    loopLabelerController,
  } from "../state/loop-labeler-composition";
  import { createSectionModeState } from "../state/section-mode-state.svelte";
  import { createBeatPairModeState } from "../state/steppair-mode-state.svelte";
  import { createWholeModeState } from "../state/whole-mode-state.svelte";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import type { FilterMode } from "../domain/models/label-models";

  // Import all panel components
  import LOOPLabelerHeader from "./shared/LOOPLabelerHeader.svelte";
  import SequencePreviewPanel from "./panels/SequencePreviewPanel.svelte";
  import DesignationsPanel from "./panels/DesignationsPanel.svelte";
  import NotesInput from "./shared/NotesInput.svelte";
  import SequenceBrowserDrawer from "./shared/SequenceBrowserDrawer.svelte";
  import SequenceBrowserSidebar from "./shared/SequenceBrowserSidebar.svelte";

  // Extracted UI components
  import NavigationFooter from "./shared/NavigationFooter.svelte";
  import LOOPLabelerLoadingState from "./shared/LOOPLabelerLoadingState.svelte";
  import LOOPLabelerEmptyState from "./shared/LOOPLabelerEmptyState.svelte";
  import ViewOnlyNotice from "./shared/ViewOnlyNotice.svelte";
  import ManualBuilderSection from "./shared/ManualBuilderSection.svelte";

  // Lifecycle
  let isReady = $state(false);
  let copiedToast = $state(false);
  let showBrowserDrawer = $state(false);
  let showManualBuilder = $state(false); // Hide manual designation tools behind toggle

  // Store service references after loading (to avoid resolving in $derived)
  let detectionService = $state<ILOOPDetector | null>(null);
  let conversionService = $state<IStepDataConverter | null>(null);

  // Create mode-specific state managers (after module loads)
  let sectionState = $state<ReturnType<typeof createSectionModeState>>();
  let stepPairState = $state<ReturnType<typeof createBeatPairModeState>>();
  let wholeState = $state<ReturnType<typeof createWholeModeState>>();

  onMount(() => {
    // Initialize LOOP labeler
    (async () => {
      // Check if state already has data (from HMR or previous session)
      const hasExistingData = loopLabelerState.hasData;

      // loop-labeler services available synchronously via ITI

      detectionService = loopDetector;

      // Also cache the conversion service for beat parsing
      conversionService =
        container.items.stepDataConverter as IStepDataConverter | null;

      // Pre-cache all services to ensure they're available for subsequent operations
      loopLabelerController.cacheServices();

      // Create mode states AFTER services are registered
      sectionState = createSectionModeState();
      stepPairState = createBeatPairModeState();
      wholeState = createWholeModeState();

      // Only run full initialization if we don't have existing data
      // This prevents re-loading when HMR preserves state
      if (!hasExistingData) {
        await loopLabelerController.initialize();
      } else {
        // Just ensure loading is false since we have data
        loopLabelerState.setLoading(false);
      }

      isReady = true;
    })();

    // Return cleanup function
    return () => {
      loopLabelerController.dispose();
    };
  });

  // Derived state from main state
  // Guard service-dependent getters with isReady to prevent early access
  const filteredSequences = $derived(
    isReady ? loopLabelerState.filteredSequences : []
  );
  const currentSequence = $derived(
    isReady ? loopLabelerState.currentSequence : null
  );
  const currentLabel = $derived(isReady ? loopLabelerState.currentLabel : null);

  // Detection cache - use a plain object to avoid reactivity issues
  // We use WeakMap-like pattern with sequence ID as key
  const detectionCacheRef: { current: Map<string, LOOPDetectionResult> } = {
    current: new Map(),
  };

  // Compute detection using stored service reference
  const currentComputedDetection = $derived.by(() => {
    const seq = currentSequence;

    if (!isReady || !seq || !detectionService) {
      return null;
    }

    // Check cache first (using ref to avoid state mutation in derived)
    const cacheKey = seq.id;
    const cached = detectionCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    const detection = detectionService.detectLOOP(seq);

    // Cache the result (mutating ref, not reactive state)
    detectionCacheRef.current.set(cacheKey, detection);

    return detection;
  });
  const stats = $derived(
    isReady
      ? loopLabelerState.stats
      : { total: 0, needsVerification: 0, verified: 0 }
  );
  const filterMode = $derived(loopLabelerState.filterMode);
  const labelingMode = $derived(loopLabelerState.labelingMode);
  const showExport = $derived(loopLabelerState.showExport);
  const syncStatus = $derived(loopLabelerState.syncStatus);
  const notes = $derived(loopLabelerState.notes);
  const showStartPosition = $derived(loopLabelerState.showStartPosition);
  const manualColumnCount = $derived(loopLabelerState.manualColumnCount);
  const loading = $derived(loopLabelerState.loading);

  // Computed: whether current sequence is verified (from Firebase metadata)
  const isVerified = $derived(
    !currentLabel?.needsVerification && currentLabel !== null
  );

  // Edit mode - defaults to false for verified sequences, true for unverified
  let isEditMode = $state(false);

  // Reset edit mode when sequence changes
  $effect(() => {
    // When sequence changes, exit edit mode (will show view-only for verified)
    if (currentSequence) {
      isEditMode = false;
    }
  });

  // Parse steps for current sequence (uses cached conversionService)
  const parsedData = $derived.by(() => {
    if (!currentSequence?.fullMetadata?.sequence) {
      return { steps: [], startPosition: null };
    }

    // Use the cached conversion service instead of resolving each time
    if (!conversionService) {
      console.warn(
        "[LOOPLabelerModule] StepDataConverter not available (not cached)"
      );
      return { steps: [], startPosition: null };
    }

    const gridMode =
      conversionService.getAuthoritativeGridMode(currentSequence);
    return conversionService.convertRawToBeats(
      currentSequence.word,
      currentSequence.fullMetadata.sequence,
      gridMode
    );
  });

  const parsedSteps = $derived(parsedData.steps);
  const startPosition = $derived(parsedData.startPosition);

  // Load saved sections/beatpairs when sequence changes AND clear current selection
  $effect(() => {
    if (!sectionState || !stepPairState || !wholeState) return;

    // Clear all mode selections when sequence changes
    sectionState.actions.clearSelection();
    stepPairState.actions.clearSelection();
    wholeState.actions.clearSelection();

    // Load saved data for this sequence
    if (currentLabel) {
      sectionState.actions.loadSavedSections(currentLabel);
      stepPairState.actions.loadSavedBeatPairs(currentLabel);
    } else {
      sectionState.actions.loadSavedSections(null);
      stepPairState.actions.loadSavedBeatPairs(null);
    }
  });

  // Highlighted steps for StepGrid visualization (section + steppair modes)
  const highlightedSteps = $derived.by(() => {
    if (!sectionState || !stepPairState) return undefined;

    const map = new Map<number, { bg: string; border: string }>();

    if (labelingMode === "section") {
      // Show saved sections with unique colors
      const SECTION_COLORS = [
        { bg: "rgba(59, 130, 246, 0.35)", border: "rgba(59, 130, 246, 0.8)" },
        { bg: "rgba(168, 85, 247, 0.35)", border: "rgba(168, 85, 247, 0.8)" },
        { bg: "rgba(34, 197, 94, 0.35)", border: "rgba(34, 197, 94, 0.8)" },
        { bg: "rgba(249, 115, 22, 0.35)", border: "rgba(249, 115, 22, 0.8)" },
        { bg: "rgba(236, 72, 153, 0.35)", border: "rgba(236, 72, 153, 0.8)" },
        { bg: "rgba(20, 184, 166, 0.35)", border: "rgba(20, 184, 166, 0.8)" },
      ];

      sectionState.savedSections.forEach((section, idx) => {
        const color = SECTION_COLORS[idx % SECTION_COLORS.length]!;
        section.steps.forEach((stepNum) => {
          map.set(stepNum, { bg: color.bg, border: color.border });
        });
      });

      // Currently selected steps (bright yellow/gold)
      const selectionColor = {
        bg: "rgba(251, 191, 36, 0.35)",
        border: "rgba(251, 191, 36, 0.9)",
      };
      sectionState.selectedSteps.forEach((stepNum) => {
        map.set(stepNum, selectionColor);
      });
    }

    if (labelingMode === "steppair") {
      // First beat (green)
      if (stepPairState.firstStep !== null) {
        map.set(stepPairState.firstStep, {
          bg: "rgba(34, 197, 94, 0.35)",
          border: "rgba(34, 197, 94, 0.9)",
        });
      }
      // Second beat (purple)
      if (stepPairState.secondStep !== null) {
        map.set(stepPairState.secondStep, {
          bg: "rgba(168, 85, 247, 0.35)",
          border: "rgba(168, 85, 247, 0.9)",
        });
      }
    }

    return map.size > 0 ? map : undefined;
  });

  // Derived LOOP type from selected components (for whole/section modes)
  const derivedLoopType = $derived.by(() => {
    if (!sectionState || !wholeState) return null;

    const components =
      labelingMode === "section"
        ? sectionState.selectedComponents
        : labelingMode === "whole"
          ? wholeState.selectedComponents
          : new Set();

    if (components.size === 0) return null;

    const sorted = Array.from(components).sort().join("_");

    // Component mapping (simplified - real mapping in LOOPDesignator)
    const mapping: Record<string, string> = {
      rotated: "STRICT_ROTATED",
      mirrored: "STRICT_MIRRORED",
      flipped: "strict_flipped",
      swapped: "STRICT_SWAPPED",
      inverted: "STRICT_INVERTED",
      inverted_swapped: "SWAPPED_INVERTED",
      inverted_rotated: "ROTATED_INVERTED",
      mirrored_swapped: "MIRRORED_SWAPPED",
      flipped_swapped: "flipped_swapped",
      inverted_mirrored: "MIRRORED_INVERTED",
      flipped_inverted: "flipped_inverted",
      rotated_swapped: "ROTATED_SWAPPED",
      mirrored_rotated: "MIRRORED_ROTATED",
      flipped_rotated: "flipped_rotated",
    };

    return mapping[sorted] ?? `custom_${sorted}`;
  });

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  function handleFilterChange(mode: FilterMode) {
    loopLabelerController.setFilterMode(mode);
  }

  function handleStepClick(stepNumber: number) {
    if (labelingMode === "section" && sectionState) {
      sectionState.actions.selectStep(stepNumber, sectionState.isShiftHeld);
    } else if (labelingMode === "steppair" && stepPairState) {
      stepPairState.actions.selectStep(stepNumber);
    }
  }

  async function handleAddSection() {
    if (!currentSequence || !sectionState) return;
    await sectionState.actions.addSection(
      currentSequence.word,
      notes,
      derivedLoopType
    );
  }

  async function handleRemoveSection(index: number) {
    if (!currentSequence || !sectionState) return;
    await sectionState.actions.removeSection(
      currentSequence.word,
      index,
      notes
    );
  }

  function handleRemoveBeatPair(index: number) {
    if (!stepPairState) return;
    stepPairState.actions.removeBeatPair(index);
  }

  async function handleAddDesignation() {
    if (!wholeState) return;
    wholeState.actions.addDesignation(derivedLoopType);
  }

  function handleRemoveDesignation(index: number) {
    if (!wholeState) return;
    wholeState.actions.removeDesignation(index);
  }

  async function handleSaveAndNext() {
    if (!currentSequence) return;

    // If detection found a modular pattern, save it directly
    if (currentComputedDetection?.isModular) {
      await loopLabelerController.saveModularDetection(
        currentSequence,
        currentComputedDetection,
        currentLabel,
        notes
      );
      loopLabelerController.nextSequence();
      return;
    }

    // Otherwise use the whole state labeling flow
    if (!wholeState) return;
    await wholeState.actions.labelSequence(
      currentSequence.word,
      notes,
      derivedLoopType
    );
    loopLabelerController.nextSequence();
  }

  async function handleMarkUnknown() {
    if (!currentSequence) return;

    await loopLabelerController.markAsUnknown(currentSequence, currentLabel, notes);
    loopLabelerController.nextSequence();
  }

  function handleCopyJson() {
    if (!currentSequence) return;

    // Include detection results with sequence data
    const exportData = {
      ...currentSequence,
      _detection: currentComputedDetection
        ? {
            loopType: currentComputedDetection.loopType,
            isCircular: currentComputedDetection.isCircular,
            isFreeform: currentComputedDetection.isFreeform,
            isModular: currentComputedDetection.isModular,
            candidateDesignations:
              currentComputedDetection.candidateDesignations,
            stepPairs: currentComputedDetection.stepPairs,
            stepPairGroups: currentComputedDetection.stepPairGroups,
          }
        : null,
    };

    const json = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      copiedToast = true;
      setTimeout(() => {
        copiedToast = false;
      }, 2000);
    });
  }

  async function handleDeleteLabel() {
    if (!currentSequence) return;
    await loopLabelerController.removeLabel(currentSequence.word);
  }

  async function handleDeleteSequence() {
    if (!currentSequence) return;
    const result = await loopLabelerController.deleteSequenceFromDatabase(
      currentSequence.id,
      currentSequence.word
    );
    if (!result.success) {
      console.error("Failed to delete sequence:", result.error);
    }
  }

  /**
   * Verify the computed designations for this sequence
   * With on-the-fly detection, this just marks as "verified" - no need to store designations
   */
  async function handleVerify() {
    if (!currentSequence) return;

    await loopLabelerController.verifySequence(
      currentSequence,
      currentComputedDetection,
      currentLabel
    );
    // NOTE: Do NOT call nextSequence() here!
    // When in "Needs Review" filter, the verified item is removed from the list,
    // so the selection naturally moves to the next item.
  }

  /**
   * Legacy handler for backward compatibility
   * @deprecated Use handleVerify instead
   */
  async function handleConfirmAutoLabel() {
    await handleVerify();
  }

  /**
   * Legacy handler - now just verifies the sequence
   * @deprecated Use handleVerify instead
   */
  async function handleConfirmAllCandidates() {
    await handleVerify();
  }

  /**
   * Individual candidate confirmation is no longer needed with on-the-fly detection
   * Kept for interface compatibility but just verifies the whole thing
   */
  function handleConfirmCandidate(_index: number) {
    // No-op - individual confirmations not needed with computed designations
  }

  /**
   * Deny a candidate designation - marks the sequence as freeform
   */
  async function handleDenyCandidate(_index: number) {
    // Denying a candidate means "this detection is wrong" - mark as freeform
    await handleSetFreeform();
  }

  /**
   * Mark sequence as freeform (no recognizable pattern)
   */
  async function handleSetFreeform() {
    if (!currentSequence) return;

    await loopLabelerController.markAsFreeform(currentSequence, currentLabel, notes);
  }

  // Keyboard event handling (shift key for section selection)
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Shift" && labelingMode === "section" && sectionState) {
      sectionState.actions.setShiftHeld(true);
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (event.key === "Shift" && labelingMode === "section" && sectionState) {
      sectionState.actions.setShiftHeld(false);
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

{#if !isReady || loading}
  <LOOPLabelerLoadingState />
{:else if filteredSequences.length === 0}
  <LOOPLabelerEmptyState onShowAll={() => handleFilterChange("all")} />
{:else}
  <div class="loop-labeler-module">
    <div class="layout-container">
      <!-- Left sidebar - visible on wide screens only -->
      <SequenceBrowserSidebar
        sequences={loopLabelerState.circularSequences}
        labels={loopLabelerState.labels}
        currentSequenceId={currentSequence?.id ?? null}
        {filterMode}
        onSelectSequence={(id) => loopLabelerController.jumpToSequence(id)}
        onFilterChange={handleFilterChange}
      />

      <!-- Main content area -->
      <div class="main-area">
        <LOOPLabelerHeader
          {stats}
          {filterMode}
          onFilterChange={handleFilterChange}
          onExportToggle={() =>
            loopLabelerController.setShowExport(!showExport)}
          onExportLabels={() => loopLabelerController.exportLabels()}
          onImportFile={(file) => loopLabelerController.importLabels(file)}
          onSyncLocalStorage={() =>
            loopLabelerController.syncLocalStorageToFirebase()}
          {showExport}
          {syncStatus}
          sequences={loopLabelerState.circularSequences}
          onJumpToSequence={(id) => loopLabelerController.jumpToSequence(id)}
          onOpenBrowser={() => (showBrowserDrawer = true)}
        />

        <SequenceBrowserDrawer
          isOpen={showBrowserDrawer}
          sequences={loopLabelerState.circularSequences}
          labels={loopLabelerState.labels}
          currentSequenceId={currentSequence?.id ?? null}
          onClose={() => (showBrowserDrawer = false)}
          onSelectSequence={(id) => loopLabelerController.jumpToSequence(id)}
        />

        <div class="main-content">
          <!-- Left panel: Sequence preview and beat grid -->
          <SequencePreviewPanel
            sequence={currentSequence}
            {parsedSteps}
            {startPosition}
            {currentLabel}
            computedDetection={currentComputedDetection}
            {showStartPosition}
            {manualColumnCount}
            onShowStartPositionChange={(val) =>
              loopLabelerController.setShowStartPosition(val)}
            onColumnCountChange={(val) =>
              loopLabelerController.setManualColumnCount(val)}
            onStepClick={handleStepClick}
            {highlightedSteps}
            {labelingMode}
            onCopyJson={handleCopyJson}
            {copiedToast}
            onDeleteLabel={handleDeleteLabel}
          />

          <!-- Right panel: Controls and labeling UI -->
          <div class="labeling-panel">
            <!-- Unified Designations Panel (above mode tabs) -->
            <DesignationsPanel
              wholeDesignations={wholeState?.pendingDesignations ?? []}
              sectionDesignations={sectionState?.savedSections ?? []}
              stepPairDesignations={stepPairState?.savedStepPairs ?? []}
              isFreeform={// Freeform should be false if polyrhythmic is detected - polyrhythmic IS a pattern
              (currentComputedDetection?.isPolyrhythmic ?? false)
                ? false
                : (currentComputedDetection?.isFreeform ?? false)}
              isModular={currentComputedDetection?.isModular ?? false}
              isPolyrhythmic={currentComputedDetection?.isPolyrhythmic ?? false}
              polyrhythmic={currentComputedDetection?.polyrhythmic ?? null}
              compoundPattern={currentComputedDetection?.compoundPattern ??
                null}
              isAxisAlternating={currentComputedDetection?.isAxisAlternating ??
                false}
              axisAlternatingPattern={currentComputedDetection?.axisAlternatingPattern ??
                null}
              needsVerification={!isVerified}
              autoDetectedDesignations={[]}
              candidateDesignations={currentComputedDetection?.candidateDesignations ??
                []}
              autoDetectedBeatPairs={currentComputedDetection?.stepPairs ?? []}
              autoDetectedBeatPairGroups={currentComputedDetection?.stepPairGroups ??
                {}}
              onRemoveWholeDesignation={handleRemoveDesignation}
              onRemoveSectionDesignation={handleRemoveSection}
              onRemoveStepPairDesignation={handleRemoveBeatPair}
              onSetFreeform={handleSetFreeform}
              onMarkUnknown={handleMarkUnknown}
              onSaveAndNext={handleSaveAndNext}
              onConfirmAutoLabel={handleVerify}
              onConfirmCandidate={handleConfirmCandidate}
              onDenyCandidate={handleDenyCandidate}
              onConfirmAllCandidates={handleVerify}
              onDeleteSequence={handleDeleteSequence}
              canSave={(wholeState?.pendingDesignations.length ?? 0) > 0 ||
                (sectionState?.savedSections.length ?? 0) > 0 ||
                (stepPairState?.savedStepPairs.length ?? 0) > 0 ||
                (wholeState?.isFreeform ?? false) ||
                (currentComputedDetection?.isModular ?? false) ||
                (currentComputedDetection?.isPolyrhythmic ?? false)}
              sequenceWord={currentSequence?.word ?? ""}
            />

            <!-- Manual designation builder - hidden behind toggle -->
            {#if !isVerified || isEditMode}
              <ManualBuilderSection
                {showManualBuilder}
                {labelingMode}
                {sectionState}
                {stepPairState}
                {wholeState}
                {derivedLoopType}
                {notes}
                onToggleBuilder={(show) => (showManualBuilder = show)}
                onLabelingModeChange={(mode) =>
                  loopLabelerController.setLabelingMode(mode)}
                onAddSection={handleAddSection}
                onRemoveSection={handleRemoveSection}
                onMarkUnknown={handleMarkUnknown}
                onNext={() => loopLabelerController.nextSequence()}
                onAddDesignation={handleAddDesignation}
              />
            {:else}
              <ViewOnlyNotice onEdit={() => (isEditMode = true)} />
            {/if}

            <NotesInput
              value={notes}
              onInput={(val) => loopLabelerController.setNotes(val)}
              placeholder="Optional notes about this sequence..."
            />
          </div>
        </div>

        <!-- Navigation -->
        <NavigationFooter
          currentIndex={loopLabelerState.currentIndex}
          totalCount={filteredSequences.length}
          onPrevious={() => loopLabelerController.previousSequence()}
          onSkip={() => loopLabelerController.skipSequence()}
        />
      </div>
      <!-- End main-area -->
    </div>
    <!-- End layout-container -->
  </div>
  <!-- End loop-labeler-module -->
{/if}

<style>
  .loop-labeler-module {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--background);
    color: var(--foreground);
    overflow: hidden;
  }

  .layout-container {
    display: grid;
    grid-template-columns: 1fr 3fr;
    flex: 1;
    overflow: hidden;
    width: 100%;
  }

  /* Hide sidebar on narrow screens */
  @media (max-width: 1200px) {
    .layout-container {
      grid-template-columns: 1fr;
    }

    .layout-container > :first-child {
      display: none;
    }
  }

  .main-area {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100%;
  }

  .main-content {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: var(--spacing-lg);
    padding: 0 var(--spacing-lg) var(--spacing-lg) var(--spacing-lg);
    flex: 1;
    overflow: hidden;
  }

  .labeling-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    overflow-y: auto;
    padding-right: var(--spacing-xs);
  }

  .labeling-panel::-webkit-scrollbar {
    width: 6px;
  }

  .labeling-panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .labeling-panel::-webkit-scrollbar-thumb {
    background: var(--theme-stroke);
    border-radius: 3px;
  }

  .labeling-panel::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  @media (max-width: 1024px) {
    .main-content {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }

    .labeling-panel {
      max-height: 400px;
    }
  }
</style>
