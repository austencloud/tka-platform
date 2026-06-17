/**
 * Construct Tab State - Sub-tab State
 *
 * Manages state specific to the Construct sub-tab functionality.
 * Handles start position selection, option picking, and construct-specific UI state.
 *
 * ✅ All construct-specific runes ($state, $derived, $effect) live here
 * ✅ Pure reactive wrappers - no business logic
 * ✅ Services injected via parameters
 * ✅ Component-scoped state (not global singleton)
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

import { createSimplifiedStartPositionState } from "$lib/shared/create/state/start-position-state.svelte";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

const debug = createComponentLogger("ConstructTabState");
import { createStartPositionData } from "$lib/shared/create/factories/create-start-position-data";
import type { CreateModuleOrchestrator } from "$lib/features/create/shared/services/create-module-orchestrator";
import type { SequencePersister } from "$lib/features/create/shared/services/sequence-persister";
import type { SequenceRepository } from "$lib/shared/create/services/sequence-repository";
import type { SequenceStatsCalculator } from "$lib/features/create/shared/services/sequence-stats-calculator";
import type { SequenceTransformer } from "$lib/features/create/shared/services/sequence-transforms/sequence-transformer";
import type { SequenceValidator } from "$lib/features/create/shared/services/sequence-validator";
import { reversalDetector, type ReversalDetector } from "$lib/shared/create/services/reversal-detector";
import { createSequenceState } from "./sequence-state-orchestrator.svelte";
import type { SequenceState } from "./sequence-state-orchestrator.svelte";
import type { UndoMetadata } from "../services/undo-manager";
import { UndoOperationType } from "../services/undo-manager";
import type { BuildModeId } from "$lib/shared/foundation/ui/ui-types";
import type { IFilterPersister } from "../../construct/option-picker/services/filter-persister";
import { ensureGuestIdentity } from "$lib/shared/auth/services/guest-identity";

/**
 * Minimal interface for createModuleState dependency
 * Only includes what createConstructTabState actually needs to avoid circular references
 */
interface CreateModuleStateMinimal {
  readonly activeSection: BuildModeId | null;
}
import { createUndoController } from "./create-module/undo-controller.svelte";
import { undoManager } from "../services/undo-manager";

import { getFilterPersister } from "$lib/features/create/construct/option-picker/get-filter-persister";

/**
 * Creates construct tab state for construct-specific concerns
 *
 * @param CreateModuleOrchestrator - Injected create module service for business logic
 * @param sequenceService - Sequence service for creating Construct tab's own sequence state
 * @param SequencePersister - Persistence service for state survival
 * @param sequenceStatisticsService - Optional statistics service for sequence analysis
 * @param SequenceTransformer - Optional transformation service for sequence operations
 * @param sequenceValidationService - Optional validation service for sequence validation
 * @param createModuleState - Create module state for accessing navigation (minimal interface to avoid circular refs)
 * @returns Reactive state object with getters and state mutations
 */
export function createConstructTabState(
  CreateModuleOrchestrator: CreateModuleOrchestrator,
  sequenceService?: SequenceRepository,
  SequencePersister?: SequencePersister,
  sequenceStatisticsService?: SequenceStatsCalculator,
  SequenceTransformer?: SequenceTransformer,
  sequenceValidationService?: SequenceValidator,
  createModuleState?: CreateModuleStateMinimal | null
) {
  // ============================================================================
  // HMR STATE BACKUP
  // ============================================================================

  // Create HMR backup for critical state - temporarily disabled to debug effect_orphan error
  const hmrBackup = {
    initialValue: {
      showStartPositionPicker: null as boolean | null,
      selectedStartPosition: null as PictographData | null,
      isInitialized: false,
    },
  };

  // ============================================================================
  // REACTIVE STATE (Construct-specific)
  // ============================================================================

  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let isTransitioning = $state(false);
  let showStartPositionPicker = $state<boolean | null>(
    hmrBackup.initialValue.showStartPositionPicker
  );
  let selectedStartPosition = $state<PictographData | null>(
    hmrBackup.initialValue.selectedStartPosition
  );
  let isInitialized = $state(hmrBackup.initialValue.isInitialized);
  // Filter persistence service - resolved lazily to avoid circular dependency issues
  let filterPersister: IFilterPersister | null = null;

  // Load persisted continuous filter on initialization
  function loadPersistedContinuousFilter(): boolean {
    try {
      if (!filterPersister) {
        filterPersister = getFilterPersister();
      }
      return filterPersister.loadContinuousOnly();
    } catch (e) {
      console.warn(
        "⚠️ ConstructTabState: Failed to load continuous filter:",
        e
      );
      return false;
    }
  }

  let isContinuousOnly = $state(loadPersistedContinuousFilter()); // Filter state for option viewer (persisted)

  // Construct tab has its own independent sequence state
  // IMPORTANT: Pass tabId="construct" to ensure persistence loads/saves only construct's data
  const ReversalDetector: ReversalDetector | undefined = reversalDetector;
  const sequenceState: SequenceState | null = sequenceService
    ? createSequenceState({
        sequenceService,
        ...(SequencePersister && { SequencePersister }),
        ...(sequenceStatisticsService && { sequenceStatisticsService }),
        ...(SequenceTransformer && { SequenceTransformer }),
        ...(sequenceValidationService && { sequenceValidationService }),
        ...(ReversalDetector && { ReversalDetector }),
        tabId: "construct", // Persistence isolation - only load/save construct's data
      })
    : null;

  // Construct tab has its own independent undo controller
  const undoController = sequenceState
    ? createUndoController({
        UndoManager: undoManager,
        sequenceState,
        getActiveSection: () =>
          createModuleState?.activeSection || "construct",
        setActiveSectionInternal: async (_panel, _addToHistory) => {
          // Construct tab doesn't need to change active section since it's always construct
          // This is just for compatibility with the undo controller interface
        },
      })
    : null;

  // Sub-states (construct-specific)
  // Start position state service using proper simplified state
  const startPositionStateService = createSimplifiedStartPositionState();
  let unsubscribeStartPositionListener: (() => void) | null = null;

  // Event handler function for start position selection (reactive listener compatible)
  function handleStartPositionSelected(
    pictographData: PictographData | null,
    source: "user" | "sync" = "user"
  ) {
    if (!pictographData) {
      setSelectedStartPosition(null);
      if (sequenceState) {
        sequenceState.setSelectedStartPosition(null);
      }
      if (source === "user") {
        setShowStartPositionPicker(true);
      }
      return;
    }

    if (source === "user" && undoController) {
      undoController.pushUndoSnapshot(UndoOperationType.SELECT_START_POSITION, {
        description: "Select start position",
      });
    }

    setShowStartPositionPicker(false);
    setSelectedStartPosition(pictographData);

    // Create proper StartPositionData from the selected pictograph
    const startPositionData = createStartPositionData({
      ...pictographData,
      id: `start-${Date.now()}`,
    });

    if (sequenceState) {
      sequenceState.setSelectedStartPosition(startPositionData);
    }

    if (source !== "user" || !sequenceState) {
      return;
    }

    // Provision a guest identity the moment a user starts building, so their
    // work persists and survives refresh. Non-blocking: never delays the UI.
    void ensureGuestIdentity();

    // Get the current grid mode from the start position picker to ensure
    // the sequence is created with the correct grid mode (Diamond or Box)
    const currentGridMode = startPositionStateService.currentGridMode;

    sequenceState
      .createSequence({
        name: `Sequence ${new Date().toLocaleTimeString()}`,
        length: 0,
      })
      .then((newSequence) => {
        if (newSequence) {
          // IMPORTANT: Set the gridMode on the sequence to match the start position picker
          // This ensures the option picker loads options for the correct grid mode after undo
          const sequenceWithGridMode = {
            ...newSequence,
            gridMode: currentGridMode,
          };
          sequenceState.setCurrentSequence(sequenceWithGridMode);
          try {
            sequenceState.setStartPosition(startPositionData);
          } catch (error) {
            console.error(
              "? ConstructTabState: Error setting start position:",
              error
            );
          }
        } else {
          console.error("? ConstructTabState: Failed to create new sequence");
        }
      })
      .catch((error: unknown) => {
        console.error("? ConstructTabState: Error creating sequence:", error);
      });
  }
  // ============================================================================
  // DERIVED STATE (Construct-specific derived state)
  // ============================================================================

  const hasError = $derived(error !== null);
  const canSelectOptions = $derived(selectedStartPosition !== null);

  const shouldShowStartPositionPicker = $derived(() => {
    // Don't return any state until initialization is complete
    if (!isInitialized) return null;

    // SAFEGUARD: If Constructor has NO sequence data (no steps and no start position),
    // ALWAYS show the Start Position Picker, regardless of what showStartPositionPicker says.
    // This prevents the bug where Option Viewer shows "No options available" when
    // there's nothing to show options for.
    if (sequenceState) {
      const currentSeqData = sequenceState.getCurrentSequenceData();
      const hasStartPos = sequenceState.hasStartPosition;

      // Also check currentSequence.steps directly as a backup
      // getCurrentSequenceData() can return empty in some edge cases
      const currentSeq = sequenceState.currentSequence;
      const directBeatsLength = currentSeq?.steps?.length ?? 0;

      // Has data if we have start position OR steps (from either source)
      const hasNoData =
        !hasStartPos && currentSeqData.length === 0 && directBeatsLength === 0;

      if (hasNoData) {
        return true; // Force Start Position Picker when there's no data
      }
    }

    return showStartPositionPicker;
  });
  const isPickerStateLoading = $derived(
    !isInitialized || showStartPositionPicker === null
  ); // Loading state detection like main navigation

  // ============================================================================
  // EFFECTS (Construct-specific effects)
  // ============================================================================

  // NOTE: $effect has been removed from the factory function to prevent effect_orphan error
  // The sync logic is now handled in the initializeConstructTab function
  // This is necessary because factory functions called after async operations lose Svelte context

  // Load start positions when construct tab is initialized - using onMount to prevent infinite loops
  let startPositionsLoaded = $state(false);
  let coordinationSetup = $state(false);

  // Initialize construct tab - called from component onMount
  async function initializeConstructTab() {
    if (!startPositionsLoaded) {
      // Start positions are loaded automatically on state creation
      startPositionsLoaded = true;
    }

    if (!coordinationSetup) {
      void CreateModuleOrchestrator.initialize();
      coordinationSetup = true;
    }

    if (
      !unsubscribeStartPositionListener &&
      startPositionStateService.onSelectedPositionChange
    ) {
      unsubscribeStartPositionListener =
        startPositionStateService.onSelectedPositionChange(
          (position: PictographData | null, source) => {
            handleStartPositionSelected(position, source);
          }
        );
    }

    // Register callbacks with local undo controller for undo functionality
    undoController?.setShowStartPositionPickerCallback(() => {
      setShowStartPositionPicker(true);
    });

    // Register sync picker state callback for smart picker detection after undo
    undoController?.setSyncPickerStateCallback(() => {
      syncPickerStateWithSequence();
    });

    // Check for pending edit from Browse gallery - that takes priority
    const hasPendingEdit =
      localStorage.getItem("tka-pending-edit-sequence") !== null;

    // CRITICAL FIX: Set a default state and mark initialized BEFORE async operations.
    // This allows the UI to render immediately with the start position picker shown,
    // rather than showing a loading spinner while waiting for persistence.
    // The persisted state will update this after loading if needed.
    if (!hasPendingEdit) {
      // Default: show start position picker (safe default for new sequences)
      setShowStartPositionPicker(true);
    }
    // Mark as initialized EARLY so UI can render while we load persisted state
    isInitialized = true;

    // Now load persisted state asynchronously - this may update the picker state
    if (hasPendingEdit) {
      // Just initialize without loading saved state
      if (sequenceState) {
        await sequenceState.initializeWithPersistence();
      }
      // Don't set showStartPositionPicker here - let the pending edit effect handle it
    } else if (SequencePersister && sequenceState) {
      try {
        await sequenceState.initializeWithPersistence();

        // Check if we have a persisted state that should affect UI
        // IMPORTANT: Pass "construct" to load only Construct's persisted data
        // Without this, it loads based on navigationState.currentSection which could be another tab
        const savedState =
          await SequencePersister.loadCurrentState("construct");
        debug.log("init: savedState =", savedState);
        debug.log(
          "init: savedState?.hasStartPosition =",
          savedState?.hasStartPosition
        );
        debug.log(
          "init: sequenceState.hasStartPosition =",
          sequenceState.hasStartPosition
        );
        debug.log(
          "init: sequenceState.getCurrentSequenceData() =",
          sequenceState.getCurrentSequenceData()
        );

        if (savedState?.hasStartPosition) {
          debug.log(
            "Persisted state has start position, setting showStartPositionPicker = false"
          );
          setShowStartPositionPicker(false);
          setSelectedStartPosition(savedState.selectedStartPosition);
          if (savedState.selectedStartPosition) {
            startPositionStateService.setSelectedPosition(
              savedState.selectedStartPosition
            );
          }
        } else {
          // No saved state - we already set the default above, just clear any stale state
          debug.log(
            "No persisted start position, keeping showStartPositionPicker = true"
          );
          startPositionStateService.clearSelectedPosition();
        }
      } catch (error) {
        console.error(
          "❌ ConstructTabState: Failed to restore persisted state:",
          error
        );
        // On error, default is already set to show start position picker
        startPositionStateService.clearSelectedPosition();
      }
    } else {
      // No persistence service - we already set the default above
      debug.log(
        "No persistence service, keeping showStartPositionPicker = true"
      );
      startPositionStateService.clearSelectedPosition();
    }

    // Sync picker state with construct tab's own sequence state's hasStartPosition
    // This logic was moved from $effect to avoid effect_orphan error
    // IMPORTANT: Uses construct tab's own sequence state, not the shared state
    if (sequenceState) {
      debug.log(
        "sync: sequenceState.hasStartPosition =",
        sequenceState.hasStartPosition
      );
      debug.log("sync: showStartPositionPicker =", showStartPositionPicker);
      if (sequenceState.hasStartPosition && showStartPositionPicker === true) {
        debug.log("sync: Sequence has start position, hiding picker");
        setShowStartPositionPicker(false);
      } else if (
        !sequenceState.hasStartPosition &&
        showStartPositionPicker === false
      ) {
        debug.log("sync: Sequence has NO start position, showing picker");
        setShowStartPositionPicker(true);
      }
    }

    debug.log(
      "init complete: showStartPositionPicker =",
      showStartPositionPicker
    );
  }

  // ============================================================================
  // STATE MUTATIONS (Construct-specific state updates)
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

  function setShowStartPositionPicker(show: boolean | null) {
    showStartPositionPicker = show;
  }

  function setSelectedStartPosition(position: PictographData | null) {
    selectedStartPosition = position;
  }

  function setContinuousOnly(continuous: boolean) {
    isContinuousOnly = continuous;
    // Persist the continuous filter setting
    try {
      if (!filterPersister) {
        filterPersister = getFilterPersister();
      }
      filterPersister.saveContinuousOnly(continuous);
    } catch (e) {
      console.warn(
        "⚠️ ConstructTabState: Failed to save continuous filter:",
        e
      );
    }
  }

  async function clearSequenceCompletely() {
    try {
      // Start UI transition and sequence clearing simultaneously for smooth UX
      setShowStartPositionPicker(true);
      setSelectedStartPosition(null);
      startPositionStateService.clearSelectedPosition();
      clearError();

      // TODO: Navigation logic needs to be updated after state refactoring
      // The properties lastContentTab and methods setCurrentSection have been moved/renamed
      // Commented out until navigation state is properly wired up

      // Clear sequence state asynchronously
      if (sequenceState) {
        sequenceState
          .clearSequenceCompletely()
          .then(() => {
            // Navigation logic commented out - needs update after state refactoring
          })
          .catch((error: unknown) => {
            console.error(
              "❌ ConstructTabState: Failed to clear sequence state:",
              error
            );
            setError(
              error instanceof Error
                ? error.message
                : "Failed to clear sequence"
            );
          });
      }
    } catch (error) {
      console.error(
        "❌ ConstructTabState: Failed to initiate sequence clear:",
        error
      );
      setError(
        error instanceof Error ? error.message : "Failed to clear sequence"
      );
    }
  }

  /**
   * Restore picker state after undo - shows option picker instead of start position picker
   * Called when undoing a clear sequence operation
   */
  function restorePickerStateAfterUndo() {
    setShowStartPositionPicker(false);
  }

  /**
   * Sync picker state with sequence state's hasStartPosition and grid mode
   * This replaces the $effect that was causing effect_orphan error
   * Call this method whenever sequence state changes that might affect picker visibility
   *
   * IMPORTANT: Uses the construct tab's OWN sequence state, not the shared createModuleState
   */
  function syncPickerStateWithSequence() {
    if (!isInitialized) return;

    // Use construct tab's own sequence state as the source of truth
    // This is critical - construct tab manages its own sequence independently
    if (!sequenceState) return;

    // When sequence state has a start position, hide the start position picker
    if (sequenceState.hasStartPosition && showStartPositionPicker === true) {
      setShowStartPositionPicker(false);
    }

    // When sequence state loses start position, show the start position picker
    if (!sequenceState.hasStartPosition && showStartPositionPicker === false) {
      setShowStartPositionPicker(true);
    }

    // Sync grid mode from the current sequence
    const currentSequence = sequenceState.currentSequence;
    if (currentSequence?.gridMode) {
      const sequenceGridMode = currentSequence.gridMode;
      const currentPickerGridMode = startPositionStateService.currentGridMode;

      if (sequenceGridMode !== currentPickerGridMode) {
        // Update the start position state's grid mode to match the sequence
        startPositionStateService.loadPositions(sequenceGridMode);
      }
    }
  }

  /**
   * Sync grid mode from an imported sequence
   * Call this after importing a sequence to ensure the option picker uses the correct grid mode
   * Uses synchronous setGridMode to avoid async delays that cause UI flicker
   */
  function syncGridModeFromSequence(sequenceGridMode: GridMode | undefined) {
    if (!sequenceGridMode) return;

    const currentPickerGridMode = startPositionStateService.currentGridMode;
    if (sequenceGridMode !== currentPickerGridMode) {
      // Use synchronous setter to avoid UI flicker from async loadPositions
      startPositionStateService.setGridMode(sequenceGridMode);
    }
  }

  // ============================================================================
  // DERIVED STATE - REMOVED
  // ============================================================================

  // CONSOLIDATION: Remove duplicate sequence data management
  // The SequenceState is now the single source of truth for all sequence data
  // Components should access sequence data directly through sequenceState

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
    get canSelectOptions() {
      return canSelectOptions;
    },
    get showStartPositionPicker() {
      return showStartPositionPicker;
    },
    get shouldShowStartPositionPicker() {
      return shouldShowStartPositionPicker;
    },
    get isPickerStateLoading() {
      return isPickerStateLoading;
    },
    get isInitialized() {
      return isInitialized;
    },
    // Alias for compatibility with CreationToolPanelSlot
    get isPersistenceInitialized() {
      return isInitialized;
    },
    get selectedStartPosition() {
      return selectedStartPosition;
    },
    get isContinuousOnly() {
      return isContinuousOnly;
    },
    // CONSOLIDATION: Direct access to sequence state - no duplicate data management
    get sequenceState() {
      return sequenceState;
    },

    // Sub-states
    get startPositionStateService() {
      return startPositionStateService;
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
    setShowStartPositionPicker,
    setSelectedStartPosition,
    setContinuousOnly,
    clearSequenceCompletely,
    restorePickerStateAfterUndo,
    syncPickerStateWithSequence,
    syncGridModeFromSequence,

    // Event handlers
    handleStartPositionSelected,

    // Initialization
    initializeConstructTab,
  };
}

/**
 * Type for ConstructTabState - the return type of createConstructTabState
 */
export type ConstructTabState = ReturnType<typeof createConstructTabState>;

// Import required state factories
