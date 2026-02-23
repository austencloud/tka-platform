/**
 * Create Module State Factory
 *
 * Main state orchestrator for the Create module that combines all sub-controllers
 * and provides the unified API expected by the rest of the application.
 */

import { createSequenceState } from "./SequenceStateOrchestrator.svelte";
import type { SequenceState } from "./SequenceStateOrchestrator.svelte";
import { createCreateModulePersistenceController } from "./create-module/persistence-controller.svelte";
import { createNavigationController } from "./create-module/navigation-controller.svelte";
import { createOptionHistoryManager } from "./create-module/option-history-manager.svelte";
import type { ISequenceRepository } from "../services/contracts/ISequenceRepository";
import type { ISequencePersister } from "../services/contracts/ISequencePersister";
import type { ISequenceStatsCalculator } from "../services/contracts/ISequenceStatsCalculator";
import type { ISequenceTransformer } from "../services/contracts/ISequenceTransformer";
import type { ISequenceValidator } from "../services/contracts/ISequenceValidator";
import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
import type { StepData } from "../domain/models/StepData";
import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
// ARCHIVED: AssemblerTabState import removed (Feb 2026) - files kept for reference
import type { GeneratorTabState } from "./generator-tab-state.svelte";
import type { ConstructTabState } from "./construct-tab-state.svelte";
import type { SpellTabState } from "$lib/features/create/spell/state/spell-tab-state.svelte";
import type { VisualBuilderTabState } from "./visual-builder-tab-state.svelte";
import type { UndoController } from "./create-module/undo-controller.svelte";
import type {
  UndoOperationType,
  UndoMetadata,
} from "../services/contracts/IUndoManager";

/**
 * Creates the main Create Module state orchestrator
 *
 * @param sequenceService - Service for sequence operations
 * @param SequencePersister - Service for persistence
 * @param sequenceStatisticsService - Optional statistics service for sequence analysis
 * @param SequenceTransformer - Optional transformation service for sequence operations
 * @param sequenceValidationService - Optional validation service for sequence validation
 * @returns Unified state object with all Create module state and methods
 */
export function createCreateModuleState(
  sequenceService: ISequenceRepository,
  SequencePersister?: ISequencePersister,
  sequenceStatisticsService?: ISequenceStatsCalculator,
  SequenceTransformer?: ISequenceTransformer,
  sequenceValidationService?: ISequenceValidator
) {
  // Create sequence state (shared/legacy - kept for backwards compatibility)
  const sequenceState = createSequenceState({
    sequenceService,
    ...(SequencePersister && { SequencePersister }),
    ...(sequenceStatisticsService && { sequenceStatisticsService }),
    ...(SequenceTransformer && { SequenceTransformer }),
    ...(sequenceValidationService && { sequenceValidationService }),
  });

  // Create per-tab fallback sequence states
  // IMPORTANT: Each tab gets its own isolated fallback state to prevent cross-tab data pollution.
  // Previously, all tabs fell back to the shared `sequenceState`, causing data from one tab
  // (e.g., Generator) to appear in another tab (e.g., Assembler) when that tab's state was null.
  const createTabFallbackState = () =>
    createSequenceState({
      sequenceService,
      ...(SequencePersister && { SequencePersister }),
      ...(sequenceStatisticsService && { sequenceStatisticsService }),
      ...(SequenceTransformer && { SequenceTransformer }),
      ...(sequenceValidationService && { sequenceValidationService }),
    });

  const constructorFallbackState = createTabFallbackState();
  const generatorFallbackState = createTabFallbackState();
  const spellFallbackState = createTabFallbackState();
  const visualBuilderFallbackState = createTabFallbackState();

  // Create option history manager
  const optionHistoryManager = createOptionHistoryManager({
    getSequence: () => sequenceState.currentSequence,
  });

  // Store tab states in closure - moved up so getSequenceStateForTab can access them
  let _constructorTabState: ConstructTabState | null = null;
  // ARCHIVED: _assemblerTabState removed (Feb 2026)
  let _generatorTabState: GeneratorTabState | null = null;
  let _spellTabState: SpellTabState | null = null;
  let _visualBuilderTabState: VisualBuilderTabState | null = null;


  /**
   * Get the sequence state for a specific tab
   * Used by persistence controller to save/restore the correct tab's state
   *
   * IMPORTANT: Each tab falls back to its own isolated state, NOT the shared state.
   * This prevents cross-tab data pollution where one tab's sequence appears in another tab.
   */
  function getSequenceStateForTab(tab: BuildModeId): SequenceState {
    switch (tab) {
      case "construct": {
        const ctor = _constructorTabState as {
          sequenceState?: SequenceState;
        } | null;
        return ctor?.sequenceState || constructorFallbackState;
      }
      // ARCHIVED: "assemble" case removed (Feb 2026)
      case "generate": {
        return _generatorTabState?.sequenceState || generatorFallbackState;
      }
      case "spell": {
        return _spellTabState?.sequenceState || spellFallbackState;
      }
      case "visual-builder": {
        return _visualBuilderTabState?.sequenceState || visualBuilderFallbackState;
      }
      default:
        return sequenceState;
    }
  }

  // Create persistence controller with tab-specific state lookup
  const persistenceController = createCreateModulePersistenceController({
    sequenceState,
    ...(SequencePersister && { SequencePersister }),
    optionHistoryManager,
    getSequenceStateForTab,
  });

  // Create navigation controller (needs persistence controller)
  const navigationController = createNavigationController({
    sequenceState,
    persistenceController,
    getConstructTabState: () => null, // Will be set later if needed
  });

  /**
   * Initialize with persisted state
   */
  async function initializeWithPersistence() {
    await persistenceController.initialize();
  }

  /**
   * Add option to history
   */
  function addOptionToHistory(stepIndex: number, stepData: StepData) {
    optionHistoryManager.add(stepIndex, stepData);
  }

  /**
   * Guided mode header text (for displaying in current word)
   */
  let guidedModeHeaderText = $state<string | null>(null);

  /**
   * Check if workspace is empty (no steps and no start position)
   */
  function isWorkspaceEmpty(): boolean {
    const activeSequenceState = getActiveTabSequenceState();
    const sequence = activeSequenceState.currentSequence;
    if (!sequence) {
      return true;
    }
    const hasStep = sequence.steps && sequence.steps.length > 0;
    const hasStartPosition =
      sequence.startingPosition || sequence.startPosition;
    return !hasStep && !hasStartPosition;
  }

  /**
   * Get current beat count
   */
  function getCurrentBeatCount(): number {
    const activeSequenceState = getActiveTabSequenceState();
    return activeSequenceState.stepCount();
  }

  /**
   * Check if sequence has content (steps)
   */
  function hasSequence(): boolean {
    const activeSequenceState = getActiveTabSequenceState();
    return activeSequenceState.hasSequence();
  }

  /**
   * Check if can clear sequence
   */
  function canClearSequence(): boolean {
    const activeSequenceState = getActiveTabSequenceState();
    return activeSequenceState.hasSequence();
  }

  /**
   * Check if action buttons can be shown
   */
  function canShowActionButtons(): boolean {
    const activeSequenceState = getActiveTabSequenceState();
    const stepCount = activeSequenceState.stepCount();
    return stepCount > 0;
  }

  /**
   * Check if sequence actions button can be shown
   * Shows when there's a start position OR steps (not just steps)
   */
  function canShowSequenceActionsButton(): boolean {
    const activeSequenceState = getActiveTabSequenceState();
    const sequence = activeSequenceState.currentSequence;
    if (!sequence) return false;

    const hasStep = sequence.steps && sequence.steps.length > 0;
    const hasStartPosition = !!(
      sequence.startingPosition || sequence.startPosition
    );
    return hasStep || hasStartPosition;
  }

  /**
   * Get the sequence state for the currently active tab
   * This allows tab-specific sequence operations (e.g., sequence actions)
   *
   * @returns The sequence state for the active tab (construct, assembler, or generator)
   */
  function getActiveTabSequenceState(): SequenceState {
    const activeTab = navigationState.activeTab as BuildModeId;
    return getSequenceStateForTab(activeTab);
  }

  /**
   * Get the undo controller for the currently active tab
   * Each tab has its own independent undo history
   *
   * @returns The undo controller for the active tab (construct, assembler, or generator)
   */
  function getActiveTabUndoController(): UndoController | null {
    const activeTab = navigationState.activeTab as BuildModeId;
    switch (activeTab) {
      case "construct": {
        return _constructorTabState?.undoController ?? null;
      }
      case "generate": {
        return _generatorTabState?.undoController || null;
      }
      case "spell": {
        return _spellTabState?.undoController || null;
      }
      case "visual-builder": {
        return _visualBuilderTabState?.undoController || null;
      }
      default:
        return null;
    }
  }

  const stateObject = {
    // Sequence state - now returns active tab's sequence state
    get sequenceState() {
      return getActiveTabSequenceState();
    },

    // Navigation
    navigationController,
    get activeSection() {
      return navigationController.activeSection;
    },
    get isNavigatingBack() {
      return navigationController.isNavigatingBack;
    },
    get isUpdatingFromToggle() {
      return navigationController.isUpdatingFromToggle;
    },
    setActiveToolPanel: (panel: BuildModeId) =>
      navigationController.setActiveToolPanel(panel),

    // Persistence
    persistenceController,
    initializeWithPersistence,
    get isPersistenceInitialized() {
      return persistenceController.isInitialized;
    },

    // Option history
    optionHistoryManager,
    addOptionToHistory,

    // Undo (tab-scoped - delegates to active tab's undo controller)
    get undoController() {
      return getActiveTabUndoController();
    },
    pushUndoSnapshot: (type: UndoOperationType, metadata?: UndoMetadata) => {
      const controller = getActiveTabUndoController();
      controller?.pushUndoSnapshot(type, metadata);
    },
    undo: () => {
      const controller = getActiveTabUndoController();
      return controller?.undo() || false;
    },
    redo: () => {
      const controller = getActiveTabUndoController();
      return controller?.redo() || false;
    },
    clearUndoHistory: () => {
      const controller = getActiveTabUndoController();
      controller?.clearUndoHistory();
    },
    setShowStartPositionPickerCallback: (callback: () => void) => {
      const controller = getActiveTabUndoController();
      controller?.setShowStartPositionPickerCallback(callback);
    },
    setSyncPickerStateCallback: (callback: () => void) => {
      const controller = getActiveTabUndoController();
      controller?.setSyncPickerStateCallback(callback);
    },
    setOnUndoingOptionCallback: (callback: (isUndoing: boolean) => void) => {
      const controller = getActiveTabUndoController();
      controller?.setOnUndoingOptionCallback(callback);
    },
    get canUndo() {
      const controller = getActiveTabUndoController();
      return controller?.canUndo || false;
    },
    get canRedo() {
      const controller = getActiveTabUndoController();
      return controller?.canRedo || false;
    },
    get undoHistory() {
      const controller = getActiveTabUndoController();
      return controller?.undoHistory || [];
    },
    get redoHistory() {
      const controller = getActiveTabUndoController();
      return controller?.redoHistory || [];
    },
    jumpToState: (entryId: string) => {
      const controller = getActiveTabUndoController();
      return controller?.jumpToState(entryId) || false;
    },
    getTimeline: () => {
      const controller = getActiveTabUndoController();
      return controller?.getTimeline() || [];
    },
    getOperationDescription: (type: UndoOperationType) => {
      const controller = getActiveTabUndoController();
      return controller?.getOperationDescription(type) || "Unknown";
    },

    // Workspace state queries
    isWorkspaceEmpty,
    getCurrentBeatCount,
    hasSequence,
    canClearSequence,
    canShowActionButtons,
    canShowSequenceActionsButton,
    get canAccessEditTab() {
      const activeSequenceState = getActiveTabSequenceState();
      return activeSequenceState.stepCount() > 0;
    },

    // Guided mode
    get guidedModeHeaderText() {
      return guidedModeHeaderText;
    },
    setGuidedModeHeaderText: (text: string | null) => {
      guidedModeHeaderText = text;
    },

    // Tab-aware sequence access
    getActiveTabSequenceState,

    // Tab states (will be attached by initialization service)
    get constructorTabState() {
      return _constructorTabState;
    },
    set constructorTabState(value: ConstructTabState | null) {
      _constructorTabState = value;
    },
    constructTabState: null as ConstructTabState | null, // Legacy accessor - will be set by initializer
    // ARCHIVED: assemblerTabState, assemblyUndoRef, assemblyBackRef removed (Feb 2026)
    get generatorTabState() {
      return _generatorTabState;
    },
    set generatorTabState(value: GeneratorTabState | null) {
      _generatorTabState = value;
    },
    get spellTabState() {
      return _spellTabState;
    },
    set spellTabState(value: SpellTabState | null) {
      _spellTabState = value;
    },
    get visualBuilderTabState() {
      return _visualBuilderTabState;
    },
    set visualBuilderTabState(value: VisualBuilderTabState | null) {
      _visualBuilderTabState = value;
    },
  };

  return stateObject;
}

export type CreateModuleState = ReturnType<typeof createCreateModuleState>;
