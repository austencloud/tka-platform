<!--
  LOOP Labeler Module

  Main orchestrator component that replaces the monolithic +page.svelte.
  Manages state, coordinates mode-specific behavior, and composes all panels.
-->
<script lang="ts">
  import { getErrorHandler } from "$lib/shared/application/getErrorHandler";
  import { onMount } from "svelte";
  import type { ErrorHandler } from '$lib/shared/application/services/implementations/ErrorHandler'
  import { loopDetector } from "../services/loop-detector";
  import { convertRawToBeats, getAuthoritativeGridMode } from "../services/step-data-converter";
  import type { LOOPDetectionResult } from "../services/ILOOPDetector";
  import type { LOOPDetector } from "../services/loop-detector";
  import type { ComponentId } from "../domain/constants/loop-components";
  import type { LOOPLabelerState } from "../state/loop-labeler-state.svelte";
  import {
    loopLabelerState,
    loopLabelerController,
  } from "../state/loop-labeler-composition";
  import { createSectionModeState } from "../state/section-mode-state.svelte";
  import { createBeatPairModeState } from "../state/steppair-mode-state.svelte";
  import { createWholeModeState } from "../state/whole-mode-state.svelte";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
  import type { FilterMode } from "../domain/models/label-models";
  import { SECTION_COLORS } from "../domain/constants/section-colors";

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
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";

  // Lifecycle
  let isReady = $state(false);
  let copiedToast = $state(false);
  let verifiedToast = $state(false);
  let showBrowserDrawer = $state(false);
  let showManualBuilder = $state(false); // Hide manual designation tools behind toggle

  // Toast timers (cleaned up on unmount)
  let copiedToastTimer: ReturnType<typeof setTimeout> | null = null;
  let verifiedToastTimer: ReturnType<typeof setTimeout> | null = null;

  // Store service references after loading (to avoid resolving in $derived)
  let detectionService = $state<LOOPDetector | null>(null);

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
      if (copiedToastTimer) clearTimeout(copiedToastTimer);
      if (verifiedToastTimer) clearTimeout(verifiedToastTimer);
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

    // Don't run detection until fullMetadata (step data) is loaded
    if (!seq.fullMetadata?.sequence || seq.fullMetadata.sequence.length === 0) {
      return null;
    }

    // Cache key includes sequence length to bust stale cache when fullMetadata arrives
    const metaLen = seq.fullMetadata.sequence.length;
    const cacheKey = `${seq.id}:${metaLen}`;
    const cached = detectionCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    let detection = detectionService.detectLOOP(seq);

    // If the algorithm found no candidates but the sequence already has a loopType
    // from the publishing pipeline, surface it as a pre-existing candidate
    if (
      detection.candidateDesignations.length === 0 &&
      seq.loopType &&
      seq.loopType !== "unknown" &&
      seq.loopType !== "freeform"
    ) {
      const components = seq.loopType.split("_").map(c => c.toLowerCase()) as ComponentId[];
      const label = components.join(" + ");
      const description = `Pre-existing: ${label}`;

      detection = {
        ...detection,
        isFreeform: false,
        candidateDesignations: [{
          components,
          loopType: seq.loopType,
          label: seq.loopType,
          description,
          confirmed: false,
        }],
      };
    }

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
  const hasError = $derived(syncStatus === "error");
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

  // Lazy-fetch full sequence data when current sequence changes
  $effect(() => {
    if (currentSequence && !currentSequence.fullMetadata?.sequence) {
      loopLabelerController.ensureSequenceDetail();
    }
  });

  // Parse steps for current sequence
  const parsedData = $derived.by(() => {
    if (!currentSequence?.fullMetadata?.sequence) {
      return { steps: [], startPosition: null };
    }

    const gridMode = getAuthoritativeGridMode(currentSequence);
    return convertRawToBeats(
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
      // Show saved sections with unique colors (from shared constants)
      sectionState.savedSections.forEach((section, idx) => {
        const color = SECTION_COLORS[idx % SECTION_COLORS.length]!;
        section.steps.forEach((stepNum) => {
          map.set(stepNum, { bg: color.bg, border: color.border });
        });
      });

      // Currently selected steps (bright yellow/gold)
      const selectionColor = {
        bg: "color-mix(in srgb, var(--semantic-warning) 35%, transparent)",
        border: "color-mix(in srgb, var(--semantic-warning) 90%, transparent)",
      };
      sectionState.selectedSteps.forEach((stepNum) => {
        map.set(stepNum, selectionColor);
      });
    }

    if (labelingMode === "steppair") {
      // First beat (green)
      if (stepPairState.firstStep !== null) {
        map.set(stepPairState.firstStep, {
          bg: "color-mix(in srgb, var(--semantic-success) 35%, transparent)",
          border: "color-mix(in srgb, var(--semantic-success) 90%, transparent)",
        });
      }
      // Second beat (purple)
      if (stepPairState.secondStep !== null) {
        map.set(stepPairState.secondStep, {
          bg: "color-mix(in srgb, var(--feature-edit) 35%, transparent)",
          border: "color-mix(in srgb, var(--feature-edit) 90%, transparent)",
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
      rotated: "ROTATED",
      mirrored: "MIRRORED",
      flipped: "flipped",
      swapped: "SWAPPED",
      inverted: "INVERTED",
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

  function handleRemoveStepPair(index: number) {
    if (!stepPairState) return;
    stepPairState.actions.removeStepPair(index);
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
      if (copiedToastTimer) clearTimeout(copiedToastTimer);
      copiedToastTimer = setTimeout(() => {
        copiedToast = false;
        copiedToastTimer = null;
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
      try {
        const errorHandler = getErrorHandler() as ErrorHandler | undefined;
        if (errorHandler) {
          errorHandler.showError(
            "Could not delete this sequence. Check your connection and try again.",
            new Error(result.error ?? "Delete failed"),
            { module: "loop-labeler", action: "deleteSequence" }
          );
        }
      } catch {
        // ErrorHandler not available - console.error above is the fallback
      }
    }
  }

  /**
   * Verify the computed designations for this sequence.
   * Shows a brief toast confirming the action before the UI state changes.
   */
  async function handleVerify() {
    if (!currentSequence) return;

    // Show verified toast BEFORE the verify call changes needsVerification
    verifiedToast = true;
    if (verifiedToastTimer) clearTimeout(verifiedToastTimer);
    verifiedToastTimer = setTimeout(() => {
      verifiedToast = false;
      verifiedToastTimer = null;
    }, 2500);

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
   * Confirm an individual candidate designation.
   * With on-the-fly detection, this verifies the whole sequence.
   */
  async function handleConfirmCandidate(_index: number) {
    await handleVerify();
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

        {#if hasError}
          <div class="sync-error-banner" role="alert">
            <FontAwesomeIcon icon="exclamation-triangle" size="0.9em" />
            <span>Failed to sync with Firebase. Changes saved locally.</span>
          </div>
        {/if}

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
              {verifiedToast}
              autoDetectedDesignations={[]}
              candidateDesignations={currentComputedDetection?.candidateDesignations ??
                []}
              autoDetectedBeatPairs={currentComputedDetection?.stepPairs ?? []}
              autoDetectedBeatPairGroups={currentComputedDetection?.stepPairGroups ??
                {}}
              onRemoveWholeDesignation={handleRemoveDesignation}
              onRemoveSectionDesignation={handleRemoveSection}
              onRemoveStepPairDesignation={handleRemoveStepPair}
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
    height: 100%;
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

  .sync-error-banner {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--semantic-error) 40%, transparent);
    color: var(--semantic-error);
    font-size: var(--font-size-sm);
    font-weight: 500;
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
    background: var(--scrollbar-thumb-hover);
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
