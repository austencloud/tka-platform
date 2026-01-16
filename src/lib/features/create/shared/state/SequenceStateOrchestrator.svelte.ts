/**
 * Sequence State Orchestrator
 *
 * Composes all sub-states and operations into a unified sequence state:
 * - Core state (sequences, loading, errors)
 * - Selection state (beat selection, start position)
 * - Arrow state (arrow positioning)
 * - Animation state (removal animations)
 * - Persistence coordination
 * - Beat operations
 * - Transform operations
 * - Service integration
 *
 * RESPONSIBILITY: Composition and delegation, minimal business logic
 *
 * REPLACES: The 890-line god object sequence-state.svelte.ts
 */

import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
import type { ArrowPosition } from "$lib/shared/pictograph/arrow/orchestration/domain/arrow-models";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ValidationResult } from "$lib/shared/validation/ValidationResult";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { IDeepLinker } from "$lib/shared/navigation/services/contracts/IDeepLinker";
import type { TargetHand } from "./panel-coordination-state.svelte";
import { container } from "$lib/shared/di";
import type { IActivityLogger } from "$lib/shared/analytics/services/contracts/IActivityLogger";
import type { ISequencePersister } from "../services/contracts/ISequencePersister";
import type { ISequenceRepository } from "../services/contracts/ISequenceRepository";
import type { IReversalDetector } from "../services/contracts/IReversalDetector";
import type { ISequenceStatsCalculator } from "../services/contracts/ISequenceStatsCalculator";
import type { ISequenceTransformer } from "../services/contracts/ISequenceTransformer";
import type { ISequenceValidator } from "../services/contracts/ISequenceValidator";
import { createSequenceAnimationState } from "./animation/SequenceAnimationState.svelte";
import { createSequenceArrowState } from "./arrow/SequenceArrowState.svelte";
import { createSequenceCoreState } from "./core/SequenceCoreState.svelte";
import { createSequenceBeatOperations } from "./operations/SequenceBeatOperations";
import { createSequenceTransformOperations } from "./operations/SequenceTransformOperations";
import { createSequencePersistenceCoordinator } from "./persistence/SequencePersistenceCoordinator.svelte";
import { createSequenceSelectionState } from "./selection/SequenceSelectionState.svelte";
import { isBeat } from "$lib/features/create/shared/domain/type-guards/pictograph-type-guards";

/**
 * Clean service configuration - no more type gymnastics!
 */
export interface SequenceStateServices {
  sequenceService?: ISequenceRepository;
  SequencePersister?: ISequencePersister;
  sequenceStatisticsService?: ISequenceStatsCalculator;
  SequenceTransformer?: ISequenceTransformer;
  sequenceValidationService?: ISequenceValidator;
  ReversalDetector?: IReversalDetector;
  /**
   * IMPORTANT: Tab ID for persistence isolation.
   * Each tab (constructor, assembler, generator) should have its own persisted data.
   * If not provided, persistence will use navigationState.currentSection which can cause
   * cross-tab data pollution.
   */
  tabId?: BuildModeId;
}

export function createSequenceState(services: SequenceStateServices) {
  const {
    sequenceService,
    SequencePersister,
    sequenceStatisticsService,
    SequenceTransformer,
    sequenceValidationService,
    tabId, // Tab ID for persistence isolation
    // ReversalDetector, // Removed - not used
  } = services;

  // Create sub-states
  const coreState = createSequenceCoreState();
  const selectionState = createSequenceSelectionState();
  const arrowState = createSequenceArrowState();
  const animationState = createSequenceAnimationState();

  // Create persistence coordinator with tab ID for isolated persistence
  const persistenceCoordinator = createSequencePersistenceCoordinator(
    SequencePersister ?? null,
    undefined, // Reversal detection service removed
    tabId // Pass tab ID for persistence isolation
  );

  // 🚀 PERFORMANCE: Debounced auto-save to prevent excessive persistence operations
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  const SAVE_DEBOUNCE_MS = 500; // Wait 500ms after last change before saving

  // Create operation facades
  const beatOperations = createSequenceBeatOperations({
    coreState,
    selectionState,
    animationState,
    onSave: saveSequenceDataOnly,
  });

  const transformOperations = createSequenceTransformOperations({
    coreState,
    selectionState,
    sequenceStatisticsService: sequenceStatisticsService ?? null,
    SequenceTransformer: SequenceTransformer ?? null,
    sequenceValidationService: sequenceValidationService ?? null,
    onSave: saveSequenceDataOnly,
  });

  // ============================================================================
  // PERSISTENCE INTEGRATION
  // ============================================================================

  async function initializeWithPersistence(): Promise<void> {
    // Check if there's a pending deep link OR pending edit - if so, skip persistence restoration
    // This prevents overwriting deep link/pending edit sequences with old saved state
    let hasDeepLink = false;
    let hasPendingEdit = false;
    try {
      const deepLinkService = container.items.deepLinker as IDeepLinker | null;
      hasDeepLink = deepLinkService?.hasDataForModule("create") ?? false;

      // Also check for pending edit from Discover gallery (stored in localStorage)
      hasPendingEdit =
        localStorage.getItem("tka-pending-edit-sequence") !== null;
    } catch {
      // Service not available - assume no deep link
      void 0; // Suppress unused catch binding warning
    }

    if (hasDeepLink || hasPendingEdit) {
      // Still initialize the coordinator but don't load saved state
      await persistenceCoordinator.initialize();
      return;
    }

    const savedState = await persistenceCoordinator.initialize();

    if (savedState) {
      coreState.setCurrentSequence(savedState.currentSequence);
      selectionState.setStartPosition(savedState.selectedStartPosition);
    }
  }

  async function saveCurrentState(
    activeBuildSection: BuildModeId
  ): Promise<void> {
    await persistenceCoordinator.saveState({
      currentSequence: coreState.currentSequence,
      selectedStartPosition: selectionState.selectedStartPosition,
      hasStartPosition: selectionState.hasStartPosition,
      activeBuildSection,
    });
  }

  async function saveSequenceDataOnly(): Promise<void> {
    await persistenceCoordinator.saveSequenceOnly(
      coreState.currentSequence,
      selectionState.selectedStartPosition,
      selectionState.hasStartPosition
    );
  }

  // ============================================================================
  // SEQUENCE SERVICE INTEGRATION
  // ============================================================================

  async function loadSequences(): Promise<void> {
    if (!sequenceService) return;

    coreState.setLoading(true);
    coreState.clearError();

    try {
      const sequences = await sequenceService.getAllSequences();
      coreState.setSequences(sequences);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error loading sequences";
      coreState.setError(errorMessage);
      console.error("Failed to load sequences:", error);
    } finally {
      coreState.setLoading(false);
    }
  }

  async function createSequence(request: {
    name: string;
    length: number;
  }): Promise<SequenceData | null> {
    if (!sequenceService) return null;

    coreState.setLoading(true);
    coreState.clearError();

    try {
      const sequence = await sequenceService.createSequence({
        ...request,
        word: request.name,
      });

      coreState.addSequence(sequence);
      coreState.setCurrentSequence(sequence);

      // Log sequence creation for analytics
      try {
        const activityService = container.items.activityLogger as IActivityLogger | undefined;
        if (activityService) {
          void activityService.logSequenceAction("create", sequence.id, {
            sequenceWord: sequence.word,
            sequenceLength: sequence.beats.length,
          });
        }
      } catch {
        // Silently fail - activity logging is non-critical
      }

      return sequence;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error creating sequence";
      coreState.setError(errorMessage);
      console.error("Failed to create sequence:", error);
      return null;
    } finally {
      coreState.setLoading(false);
    }
  }

  async function updateSequenceBeats(
    sequenceId: string,
    beatIndex: number,
    beatData: BeatData
  ): Promise<void> {
    if (!sequenceService) return;

    try {
      await sequenceService.updateBeat(sequenceId, beatIndex, beatData);
      // Update local state
      if (
        coreState.currentSequence &&
        beatIndex >= 0 &&
        beatIndex < coreState.currentSequence.beats.length
      ) {
        const newBeats = [...coreState.currentSequence.beats];
        newBeats[beatIndex] = beatData;
        coreState.setCurrentSequence({
          ...coreState.currentSequence,
          beats: newBeats,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error updating beat";
      coreState.setError(errorMessage);
      console.error("Failed to update beat:", error);
    }
  }

  // ============================================================================
  // ENHANCED SEQUENCE OPERATIONS
  // ============================================================================

  function setCurrentSequence(sequence: SequenceData | null): void {
    // Only clear selection when loading a NEW sequence, not when updating the current one
    // This preserves beat selection during beat edits (turns, orientation changes, etc.)
    const previousSequenceId = coreState.currentSequence?.id;
    const newSequenceId = sequence?.id;
    const isLoadingNewSequence = previousSequenceId !== newSequenceId;

    coreState.setCurrentSequence(sequence);

    if (isLoadingNewSequence) {
      selectionState.clearSelection();
    }

    // Update start position from sequence
    // Check both startingPositionBeat (full beat format) and startPosition (raw position data)
    // Sequences from Discover gallery may only have startPosition
    let startPosBeat: StartPositionData | null =
      sequence?.startingPositionBeat || sequence?.startPosition || null;

    // If no explicit start position but sequence has beats, derive from the first beat
    // This handles sequences loaded from Discover where start position info is stored
    // in the first beat's startPosition field rather than on the sequence itself
    if (!startPosBeat && sequence?.beats?.length) {
      try {
        const startPositionDeriver = container.items.startPositionDeriver;
        const derived = startPositionDeriver.getOrDeriveStartPosition(sequence);
        // getOrDeriveStartPosition returns StartPositionData when deriving from beats
        // The BeatData return type is for legacy compatibility only
        if (derived && "isStartPosition" in derived) {
          startPosBeat = derived as StartPositionData;
        }
      } catch (error) {
        console.warn("Failed to derive start position from first beat:", error);
      }
    }

    if (startPosBeat) {
      selectionState.setStartPosition(startPosBeat);
    } else {
      selectionState.setStartPosition(null);
    }

    // 🚀 PERFORMANCE: Debounced auto-save to prevent blocking on every beat addition
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      saveSequenceDataOnly().catch((error) => {
        console.error("Failed to auto-save sequence state:", error);
      });
    }, SAVE_DEBOUNCE_MS);
  }

  function setSelectedStartPosition(
    startPosition: StartPositionData | null
  ): void {
    selectionState.setStartPosition(startPosition);

    // 🚀 PERFORMANCE: Debounced auto-save
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      saveSequenceDataOnly().catch((error) => {
        console.error("Failed to auto-save start position state:", error);
      });
    }, SAVE_DEBOUNCE_MS);
  }

  async function clearSequenceCompletely(): Promise<void> {
    try {
      animationState.startClearing();

      // Reduced delay to match the beat-grid CSS transition (300ms)
      // This allows the clearing animation and layout transition to happen simultaneously
      // The CSS transition on .beat-grid.clearing is 300ms, so we wait for it to complete
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 🐛 FIX: Cancel any pending auto-save AND prevent new one from being set
      // This prevents a race condition where auto-save fires after clearState(),
      // re-populating the storage with stale data
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }

      // Use coreState directly to avoid triggering auto-save in setCurrentSequence()
      coreState.setCurrentSequence(null);
      selectionState.reset();
      coreState.clearError();

      await persistenceCoordinator.clearState();

      animationState.endClearing();
    } catch (error) {
      console.error("❌ SequenceState: Failed to clear sequence:", error);
      coreState.setError(
        error instanceof Error ? error.message : "Failed to clear sequence"
      );
      animationState.endClearing();
    }
  }

  function getCurrentSequenceData(): BeatData[] {
    const sequence = coreState.currentSequence;
    if (sequence) {
      const beats = sequence.beats || [];
      const startPosition =
        sequence.startingPositionBeat || sequence.startPosition;

      if (beats.length > 0) {
        return beats.map((beat: BeatData) => beat).filter(Boolean);
      } else if (startPosition) {
        // MIGRATION: Only include start position if it's actually BeatData (legacy data)
        // Modern StartPositionData should not be included in beats array
        if (isBeat(startPosition) && !startPosition.isBlank) {
          return [startPosition];
        }
        // If it's a StartPositionData, don't include it in the beats array
        // (Start positions are not beats)
         
        return [];
      }
    }

    // FIXED: Don't return selectedStartPosition here!
    // The selectedStartPosition is tracked separately in construct-tab-state.
    // Returning it here causes the option picker to think there's a sequence when there isn't.
    // This was causing the "no options available" bug.
    return [];
  }

  function getSelectedBeatData(): BeatData | null {
    // If start position is selected, return it as BeatData
    if (
      selectionState.isStartPositionSelected &&
      selectionState.selectedStartPosition
    ) {
      return {
        ...selectionState.selectedStartPosition,
        beatNumber: 0,
        duration: 1,
        blueReversal: false,
        redReversal: false,
        isBlank: false,
      };
    }

    // Otherwise return selected beat
    if (
      selectionState.selectedBeatIndex === null ||
      !coreState.currentSequence
    ) {
      return null;
    }

    return (
      coreState.currentSequence.beats[selectionState.selectedBeatIndex] ?? null
    );
  }

  function selectBeat(beatNumber: number | null): void {
    if (beatNumber === null) {
      selectionState.clearSelection();
      return;
    }

    // Validate beatNumber is within valid range
    // beatNumber 0 = start position (always valid if we have a start position)
    // beatNumber 1 to N = beats in the sequence
    const currentSequence = coreState.currentSequence;

    if (beatNumber === 0) {
      // Start position - always allow selection
      selectionState.selectBeat(beatNumber);
    } else if (
      currentSequence &&
      beatNumber >= 1 &&
      beatNumber <= currentSequence.beats.length
    ) {
      // Regular beat - validate it exists
      selectionState.selectBeat(beatNumber);
    } else {
      selectionState.clearSelection();
    }
  }

  function resetSequenceState(): void {
    coreState.reset();
    selectionState.reset();
    arrowState.reset();
    animationState.reset();
  }

  // ============================================================================
  // PUBLIC API - Unified interface matching original
  // ============================================================================

  return {
    // State getters - delegate to sub-states
    get currentSequence() {
      return coreState.currentSequence;
    },
    get sequences() {
      return coreState.sequences;
    },
    get isLoading() {
      return coreState.isLoading;
    },
    get error() {
      return coreState.error;
    },
    get selectedBeatIndex() {
      return selectionState.selectedBeatIndex;
    },
    get selectedBeatNumber() {
      return selectionState.selectedBeatNumber;
    },
    get selectedSequenceId() {
      return coreState.selectedSequenceId;
    },
    get showBeatNumbers() {
      return true;
    },
    get gridMode() {
      return coreState.gridMode;
    },
    get arrowPositions() {
      return arrowState.arrowPositions;
    },
    get arrowPositioningInProgress() {
      return arrowState.arrowPositioningInProgress;
    },
    get arrowPositioningError() {
      return arrowState.arrowPositioningError;
    },
    get selectedStartPosition() {
      return selectionState.selectedStartPosition;
    },
    get hasStartPosition() {
      return selectionState.hasStartPosition;
    },
    get isInitialized() {
      return persistenceCoordinator.isInitialized;
    },
    get selectedBeatData() {
      return getSelectedBeatData();
    },

    // Computed getters
    getCurrentSequence: () => coreState.currentSequence,
    getCurrentSequenceData,
    getSequences: () => coreState.sequences,
    getIsLoading: () => coreState.isLoading,
    getError: () => coreState.error,
    getSelectedBeatIndex: () => selectionState.selectedBeatIndex,
    getSelectedBeatNumber: () => selectionState.selectedBeatNumber,
    getSelectedSequenceId: () => coreState.selectedSequenceId,
    getRemovingBeatIndex: () => animationState.removingBeatIndex,
    getRemovingBeatIndices: () => animationState.removingBeatIndices,
    getIsClearing: () => animationState.isClearing,
    getShowBeatNumbers: () => true,
    getGridMode: () => coreState.gridMode,
    getArrowPositions: () => arrowState.arrowPositions,
    getArrowPositioningInProgress: () => arrowState.arrowPositioningInProgress,
    getArrowPositioningError: () => arrowState.arrowPositioningError,
    getCurrentBeats: () =>
      coreState.currentSequence ? [...coreState.currentSequence.beats] : [],
    getSelectedBeatData,
    getSelectedBeat: () =>
      beatOperations.getBeat(selectionState.selectedBeatIndex ?? 0),
    getHasCurrentSequence: () => coreState.hasSequence,
    getSequenceCount: () => coreState.sequenceCount,
    getHasUnsavedChanges: () =>
      coreState.currentSequence !== null && coreState.sequences.length > 0,
    getHasArrowPositions: () => arrowState.hasArrowPositions,
    getArrowPositioningComplete: () => arrowState.arrowPositioningComplete,
    hasSequence: () => coreState.hasSequence,
    beatCount: () => beatOperations.getBeatCount(),
    sequenceStatistics: () => transformOperations.getSequenceStatistics(),
    sequenceWord: () => transformOperations.generateSequenceWord(),
    sequenceDuration: () => transformOperations.calculateSequenceDuration(),

    // Core actions
    setCurrentSequence,
    addSequence: (sequence: SequenceData) => {
      coreState.addSequence(sequence);
      setCurrentSequence(sequence);
    },
    updateSequence: (sequence: SequenceData) =>
      coreState.updateSequence(sequence),
    removeSequence: (sequenceId: string) =>
      coreState.removeSequence(sequenceId),
    setSequences: (sequences: SequenceData[]) =>
      coreState.setSequences(sequences),
    setLoading: (loading: boolean) => coreState.setLoading(loading),
    setError: (error: string | null) => coreState.setError(error),
    clearError: () => coreState.clearError(),
    updateCurrentBeat: (beatIndex: number, beatData: BeatData) => {
      if (
        coreState.currentSequence &&
        beatIndex >= 0 &&
        beatIndex < coreState.currentSequence.beats.length
      ) {
        const newBeats = [...coreState.currentSequence.beats];
        newBeats[beatIndex] = beatData;
        coreState.setCurrentSequence({
          ...coreState.currentSequence,
          beats: newBeats,
        });
      }
    },

    // Selection actions
    selectBeat,
    clearSelection: () => selectionState.clearSelection(),
    selectStartPositionForEditing: () => selectionState.selectStartPosition(),
    isBeatSelected: (beatNumber: number) =>
      selectionState.isBeatSelected(beatNumber),
    setSelectedStartPosition,

    // Grid mode
    setGridMode: (mode: GridMode) => coreState.setGridMode(mode),
    setShowBeatNumbers: () => {}, // No-op, always shown

    // Arrow state
    setArrowPositions: (positions: Map<string, ArrowPosition>) =>
      arrowState.setArrowPositions(positions),
    setArrowPositioningInProgress: (inProgress: boolean) =>
      arrowState.setPositioningInProgress(inProgress),
    setArrowPositioningError: (error: string | null) =>
      arrowState.setPositioningError(error),
    getArrowPosition: (color: string) => arrowState.getArrowPosition(color),
    clearArrowPositions: () => arrowState.clearArrowPositions(),

    // Animation state - expose for undo operations
    animationState,

    // Reset
    resetSequenceState,

    // Beat operations - delegate to facade
    addBeat: (beatData?: Partial<BeatData>) => beatOperations.addBeat(beatData),
    removeBeat: (beatIndex: number) => beatOperations.removeBeat(beatIndex),
    removeBeatWithAnimation: (beatIndex: number, onComplete?: () => void) =>
      beatOperations.removeBeatWithAnimation(beatIndex, onComplete),
    removeBeatAndSubsequent: (beatIndex: number) =>
      beatOperations.removeBeatAndSubsequent(beatIndex),
    removeBeatAndSubsequentWithAnimation: (
      beatIndex: number,
      onComplete?: () => void
    ) =>
      beatOperations.removeBeatAndSubsequentWithAnimation(
        beatIndex,
        onComplete
      ),
    updateBeat: (beatIndex: number, beatData: Partial<BeatData>) =>
      beatOperations.updateBeat(beatIndex, beatData),
    insertBeat: (beatIndex: number, beatData?: Partial<BeatData>) =>
      beatOperations.insertBeat(beatIndex, beatData),
    clearSequence: () => beatOperations.clearSequence(),
    clearSequenceCompletely,
    getBeat: (index: number) => beatOperations.getBeat(index),
    hasContent: () => beatOperations.hasContent(),

    // Transform operations - delegate to facade (with targetHand support)
    setStartPosition: (startPosition: StartPositionData | null) =>
      transformOperations.setStartPosition(startPosition),
    mirrorSequence: (targetHand: TargetHand = "both") =>
      transformOperations.mirrorSequence(targetHand),
    flipSequence: (targetHand: TargetHand = "both") =>
      transformOperations.flipSequence(targetHand),
    invertSequence: (targetHand: TargetHand = "both") =>
      transformOperations.invertSequence(targetHand),
    swapColors: () => transformOperations.swapColors(),
    rotateSequence: (
      direction: "clockwise" | "counterclockwise",
      targetHand: TargetHand = "both"
    ) => transformOperations.rotateSequence(direction, targetHand),
    rewindSequence: (targetHand: TargetHand = "both") =>
      transformOperations.rewindSequence(targetHand),
    shiftStartPosition: (targetBeatNumber: number) =>
      transformOperations.shiftStartPosition(targetBeatNumber),
    duplicateSequence: (newName?: string) =>
      transformOperations.duplicateSequence(newName),
    validateCurrentSequence: (): ValidationResult | null =>
      transformOperations.validateSequence(),

    // Persistence
    initializeWithPersistence,
    saveCurrentState,
    saveSequenceDataOnly,
    clearPersistedState: async () => {
      // 🐛 FIX: Cancel any pending auto-save before clearing persistence
      // This prevents the auto-save from firing after clearState() and re-populating storage
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      await persistenceCoordinator.clearState();
    },
    updateCachedActiveTab: (activeTab: BuildModeId) =>
      persistenceCoordinator.updateCachedActiveTab(activeTab),

    // Service integration
    loadSequences,
    createSequence,
    updateSequenceBeats,

    // Multi-select operations
    get selectedBeatNumbers() {
      return selectionState.selectedBeatNumbers;
    },
    get isMultiSelectMode() {
      return selectionState.isMultiSelectMode;
    },
    get selectionCount() {
      return selectionState.selectionCount;
    },
    enterMultiSelectMode: (beatNumber: number) =>
      selectionState.enterMultiSelectMode(beatNumber),
    exitMultiSelectMode: () => selectionState.exitMultiSelectMode(),
    toggleBeatInMultiSelect: (beatNumber: number) =>
      selectionState.toggleBeatInMultiSelect(beatNumber),
  };
}

export type SequenceState = ReturnType<typeof createSequenceState>;
