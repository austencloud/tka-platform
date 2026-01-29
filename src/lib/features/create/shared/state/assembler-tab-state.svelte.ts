/**
 * Assembler Tab State - Sub-tab State
 *
 * Manages state specific to the Assembler sub-tab functionality.
 * Handles hand path assembly and assembler-specific UI state.
 *
 * ✅ All assembler-specific runes ($state, $derived, $effect) live here
 * ✅ Pure reactive wrappers - no business logic
 * ✅ Services injected via parameters
 * ✅ Component-scoped state (not global singleton)
 * ✅ Each tab maintains its own independent sequence state
 */

import type { ISequenceRepository } from "../services/contracts/ISequenceRepository";
import type { ISequencePersister } from "../services/contracts/ISequencePersister";
import type { ISequenceStatsCalculator } from "../services/contracts/ISequenceStatsCalculator";
import type { ISequenceTransformer } from "../services/contracts/ISequenceTransformer";
import type { ISequenceValidator } from "../services/contracts/ISequenceValidator";
import { createSequenceState } from "./SequenceStateOrchestrator.svelte";
import type { SequenceState } from "./SequenceStateOrchestrator.svelte";
import type {
  UndoOperationType,
  UndoMetadata
} from "../services/contracts/IUndoManager";
import { createUndoController } from "./create-module/undo-controller.svelte";
import { undoManager } from "../services/implementations/UndoManager";

/**
 * Creates assembler tab state for assembler-specific concerns
 *
 * @param sequenceService - Injected sequence service for business logic
 * @param SequencePersister - Optional persistence service for state survival
 * @param sequenceStatisticsService - Optional statistics service for sequence analysis
 * @param SequenceTransformer - Optional transformation service for sequence operations
 * @param sequenceValidationService - Optional validation service for sequence validation
 * @returns Reactive state object with getters and state mutations
 */
export function createAssemblerTabState(
  sequenceService?: ISequenceRepository,
  SequencePersister?: ISequencePersister,
  sequenceStatisticsService?: ISequenceStatsCalculator,
  SequenceTransformer?: ISequenceTransformer,
  sequenceValidationService?: ISequenceValidator
) {
  // ============================================================================
  // REACTIVE STATE (Assembler-specific)
  // ============================================================================

  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let isTransitioning = $state(false);
  let isInitialized = $state(false);

  // Assembler tab has its own independent sequence state
  // IMPORTANT: Pass tabId="assemble" to ensure persistence loads/saves only assembler's data
  const sequenceState: SequenceState | null = sequenceService
    ? createSequenceState({
        sequenceService,
        ...(SequencePersister && { SequencePersister }),
        ...(sequenceStatisticsService && { sequenceStatisticsService }),
        ...(SequenceTransformer && { SequenceTransformer }),
        ...(sequenceValidationService && { sequenceValidationService }),
        tabId: "assemble", // Persistence isolation - only load/save assembler's data
      })
    : null;

  // Assembler tab has its own independent undo controller
  const undoController = sequenceState
    ? createUndoController({
        UndoManager: undoManager,
        sequenceState,
        getActiveSection: () => "assemble",
        setActiveSectionInternal: async (_panel, _addToHistory) => {
          // Assembler tab doesn't need to change active section since it's always assemble
          // This is just for compatibility with the undo controller interface
        },
      })
    : null;

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  const hasError = $derived(error !== null);
  const hasSequence = $derived(() => {
    return sequenceState ? sequenceState.hasSequence() : false;
  });

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize assembler tab - called from component onMount
   */
  async function initializeAssemblerTab() {
    if (!sequenceState) {
      console.warn(
        "⚠️ AssemblerTabState: No sequence service provided, skipping sequence state initialization"
      );
      isInitialized = true;
      return;
    }

    try {
      // Initialize persistence and restore state if available
      if (SequencePersister) {
        await sequenceState.initializeWithPersistence();
      }

      isInitialized = true;
    } catch (error) {
      console.error("❌ AssemblerTabState: Failed to initialize:", error);
      setError(error instanceof Error ? error.message : "Failed to initialize");
    }
  }

  // ============================================================================
  // STATE MUTATIONS
  // ============================================================================

  function setLoading(loading: boolean) {
    isLoading = loading;
  }

  function setTransitioning(transitioning: boolean) {
    isTransitioning = transitioning;
  }

  function setError(errorMessage: string | null) {
    error = errorMessage;
  }

  function clearError() {
    error = null;
  }

  async function clearSequenceCompletely() {
    try {
      clearError();

      // Clear sequence state asynchronously
      if (sequenceState) {
        await sequenceState.clearSequenceCompletely();
      }
    } catch (error) {
      console.error("❌ AssemblerTabState: Failed to clear sequence:", error);
      setError(
        error instanceof Error ? error.message : "Failed to clear sequence"
      );
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // Readonly state access
    get isLoading() {
      return isLoading;
    },
    get error() {
      return error;
    },
    get isTransitioning() {
      return isTransitioning;
    },
    get hasError() {
      return hasError;
    },
    get isInitialized() {
      return isInitialized;
    },
    get isPersistenceInitialized() {
      return isInitialized;
    },
    get hasSequence() {
      return hasSequence;
    },

    // Sequence state access
    get sequenceState() {
      return sequenceState;
    },

    // Undo controller (tab-scoped)
    get undoController() {
      return undoController;
    },
    get canUndo() {
      return undoController?.canUndo || false;
    },
    get canRedo() {
      return undoController?.canRedo || false;
    },
    get undoHistory() {
      return undoController?.undoHistory || [];
    },
    pushUndoSnapshot: (type: UndoOperationType, metadata?: UndoMetadata) => {
      undoController?.pushUndoSnapshot(type, metadata);
    },
    undo: () => {
      return undoController?.undo() || false;
    },
    redo: () => {
      return undoController?.redo() || false;
    },
    clearUndoHistory: () => {
      undoController?.clearUndoHistory();
    },

    // State mutations
    setLoading,
    setTransitioning,
    setError,
    clearError,
    clearSequenceCompletely,

    // Initialization
    initializeAssemblerTab,
  };
}

/**
 * Type for AssemblerTabState - the return type of createAssemblerTabState
 */
export type AssemblerTabState = ReturnType<typeof createAssemblerTabState>;
