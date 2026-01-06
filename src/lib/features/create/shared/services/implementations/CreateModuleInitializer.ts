/**
 * Create Module Initialization Service Implementation
 *
 * Manages complete initialization sequence for CreateModule's construction interface.
 * Creates state, configures callbacks for sequence building workflow.
 *
 * Domain: Create module - Sequence Construction Interface
 * Extracted from CreateModule.svelte onMount monolith.
 *
 * REFACTORED: Now uses constructor injection instead of resolve() calls.
 * All dependencies are injected via @inject decorators for:
 * - Visible dependencies (can see what class needs in constructor)
 * - Compile-time safety (missing bindings fail at startup, not runtime)
 * - Testability (can pass mocks directly to constructor)
 */

import { TYPES } from "$lib/shared/inversify/types";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { injectable, inject } from "inversify";
import type { IStartPositionManager } from "../../../construct/start-position-picker/services/contracts/IStartPositionManager";
import { createCreateModuleState } from "$lib/features/create/shared/state/create-module-state.svelte";
import { createConstructTabState } from "$lib/features/create/shared/state/construct-tab-state.svelte";
import { createAssemblerTabState } from "$lib/features/create/shared/state/assembler-tab-state.svelte";
import { createGeneratorTabState } from "$lib/features/create/shared/state/generator-tab-state.svelte";
import { createSpellTabState } from "$lib/features/create/spell/state/spell-tab-state.svelte";
import type { PanelCoordinationState } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
import type { IBeatOperator } from "../contracts/IBeatOperator";
import type { ICreateModuleEffectCoordinator } from "../contracts/ICreateModuleEffectCoordinator";
import type { ICreateModuleHandlers } from "../contracts/ICreateModuleHandlers";
import type { ICreateModuleOrchestrator } from "../contracts/ICreateModuleOrchestrator";
import type { IDeepLinkSequenceHandler } from "../contracts/IDeepLinkSequenceHandler";
import type { INavigationSyncer } from "../contracts/INavigationSyncer";
import type { IResponsiveLayoutManager } from "../contracts/IResponsiveLayoutManager";
import type { ISequencePersister } from "../contracts/ISequencePersister";
import type { ISequenceRepository } from "../contracts/ISequenceRepository";
import type { ISequenceStatsCalculator } from "../contracts/ISequenceStatsCalculator";
import type { ISequenceTransformer } from "../contracts/ISequenceTransformer";
import type { ISequenceValidator } from "../contracts/ISequenceValidator";
import type {
  CreateModuleInitializationResult,
  ICreateModuleInitializer,
  SequenceLoadResult,
} from "../contracts/ICreateModuleInitializer";
import { getCreateModuleEventHandler } from "./CreateModuleEventHandler";
import type { IDeepLinker } from "$lib/shared/navigation/services/contracts/IDeepLinker";
import type { ICreateModuleState } from "../../types/create-module-types";
import type { ISharer } from "$lib/shared/share/services/contracts/ISharer";
import type { IPanelPersister } from "../contracts/IPanelPersister";
import type { BeatData } from "../../domain/models/BeatData";
import type {
  UndoOperationType} from "../contracts/IUndoManager";
import {
  type UndoMetadata,
} from "../contracts/IUndoManager";

@injectable()
export class CreateModuleInitializer implements ICreateModuleInitializer {
  constructor(
    // Core services
    @inject(TYPES.ISequenceRepository)
    private readonly sequenceService: ISequenceRepository,
    @inject(TYPES.ISequencePersister)
    private readonly SequencePersister: ISequencePersister,
    @inject(TYPES.IStartPositionManager)
    private readonly StartPositionManager: IStartPositionManager,
    @inject(TYPES.ICreateModuleOrchestrator)
    private readonly CreateModuleOrchestrator: ICreateModuleOrchestrator,
    @inject(TYPES.IResponsiveLayoutManager)
    private readonly layoutService: IResponsiveLayoutManager,
    @inject(TYPES.INavigationSyncer)
    private readonly NavigationSyncer: INavigationSyncer,
    @inject(TYPES.IBeatOperator)
    private readonly BeatOperator: IBeatOperator,
    @inject(TYPES.IDeepLinkSequenceHandler)
    private readonly deepLinkService: IDeepLinkSequenceHandler,
    @inject(TYPES.IDeepLinker)
    private readonly navigationDeepLinker: IDeepLinker,

    // UI coordination services
    @inject(TYPES.ICreateModuleHandlers)
    private readonly handlers: ICreateModuleHandlers,
    @inject(TYPES.ICreateModuleEffectCoordinator)
    private readonly effectCoordinator: ICreateModuleEffectCoordinator,
    @inject(TYPES.ISharer)
    private readonly shareService: ISharer,
    @inject(TYPES.IPanelPersister)
    private readonly panelPersistenceService: IPanelPersister,

    // Sequence operation services
    @inject(TYPES.ISequenceStatsCalculator)
    private readonly sequenceStatisticsService: ISequenceStatsCalculator,
    @inject(TYPES.ISequenceTransformer)
    private readonly SequenceTransformer: ISequenceTransformer,
    @inject(TYPES.ISequenceValidator)
    private readonly sequenceValidationService: ISequenceValidator
  ) {}

  async initialize(): Promise<CreateModuleInitializationResult> {
    // Wait a tick to ensure component context is fully established
    await new Promise((r) => setTimeout(r, 0));

    // Create state objects using injected services
    const CreateModuleState = createCreateModuleState(
      this.sequenceService,
      this.SequencePersister,
      this.sequenceStatisticsService,
      this.SequenceTransformer,
      this.sequenceValidationService
    );

    // Create tab-specific states - each tab has its own independent sequence state
    const constructTabState = createConstructTabState(
      this.CreateModuleOrchestrator,
      this.sequenceService,
      this.SequencePersister,
      this.sequenceStatisticsService,
      this.SequenceTransformer,
      this.sequenceValidationService,
      CreateModuleState
    );

    const assemblerTabState = createAssemblerTabState(
      this.sequenceService,
      this.SequencePersister,
      this.sequenceStatisticsService,
      this.SequenceTransformer,
      this.sequenceValidationService
    );

    const generatorTabState = createGeneratorTabState(
      this.sequenceService,
      this.SequencePersister,
      this.sequenceStatisticsService,
      this.SequenceTransformer,
      this.sequenceValidationService
    );

    const spellTabState = createSpellTabState(
      this.sequenceService,
      this.SequencePersister,
      this.sequenceStatisticsService,
      this.SequenceTransformer,
      this.sequenceValidationService
    );

    // Attach tab states to CreateModuleState for easy access
    CreateModuleState.constructTabState = constructTabState; // Legacy accessor
    CreateModuleState.constructorTabState = constructTabState; // Main accessor (triggers setter for _constructorTabState)
    CreateModuleState.assemblerTabState = assemblerTabState;
    CreateModuleState.generatorTabState = generatorTabState;
    CreateModuleState.spellTabState = spellTabState;

    // Initialize services
    await this.CreateModuleOrchestrator.initialize();

    // Initialize tab states (but NOT persistence - that's done after deep link check)
    await constructTabState.initializeConstructTab();
    await assemblerTabState.initializeAssemblerTab();
    await generatorTabState.initializeGeneratorTab();
    await spellTabState.initializeSpellTab();

    // Note: Event callbacks configured separately via configureEventCallbacks()
    // after component has created panelState

    // Load start positions
    await this.loadStartPositions(GridMode.DIAMOND);

    return {
      // State objects
      CreateModuleState,
      constructTabState,
      assemblerTabState,
      generatorTabState,
      spellTabState,

      // Core services
      sequenceService: this.sequenceService,
      SequencePersister: this.SequencePersister,
      StartPositionManager: this.StartPositionManager,
      CreateModuleOrchestrator: this.CreateModuleOrchestrator,
      layoutService: this.layoutService,
      NavigationSyncer: this.NavigationSyncer,
      BeatOperator: this.BeatOperator,

      // UI coordination services
      handlers: this.handlers,
      effectCoordinator: this.effectCoordinator,
      deepLinkService: this.deepLinkService,
      shareService: this.shareService,
      panelPersistenceService: this.panelPersistenceService,
    };
  }

  async loadSequenceAndInitializePersistence(
    setSequence: (sequence: SequenceData) => void,
    initializePersistence: () => Promise<void>
  ): Promise<SequenceLoadResult> {
    // Try to load from deep link or pending edit
    const loadResult =
      await this.deepLinkService.loadFromAnySource(setSequence);

    if (loadResult.loaded) {
      // Initialize persistence so the deep link sequence can be saved
      // This ensures the sequence persists across navigation/reloads
      await initializePersistence();

      return {
        sequenceLoaded: true,
        targetTab: loadResult.targetTab,
        shouldMarkMethodSelected: true,
      };
    }

    // No sequence from deep link/pending edit - initialize from persistence
    await initializePersistence();

    return {
      sequenceLoaded: false,
      shouldMarkMethodSelected: false,
    };
  }

  detectCreationMethodSelection(
    _activeTab: string,
    isWorkspaceEmpty: boolean,
    currentSelection: boolean
  ): boolean {
    // If already selected (from localStorage), keep it
    if (currentSelection) {
      return true;
    }

    // Only auto-skip tutorial if workspace has content (deep link, restored sequence)
    // This indicates an existing user, not a first-timer
    // Don't skip based on current tab - let the tutorial show for new users
    return !isWorkspaceEmpty;
  }

  configureEventCallbacks(
    CreateModuleState: ICreateModuleState,
    panelState: PanelCoordinationState
  ): void {
    const CreateModuleEventHandler = getCreateModuleEventHandler();

    // Set up sequence state callbacks for CreateModuleEventHandler
    CreateModuleEventHandler.setSequenceStateCallbacks(
      () => CreateModuleState.sequenceState.getCurrentSequence(),
      (sequence) => CreateModuleState.sequenceState.setCurrentSequence(sequence)
    );

    // Set up option history callback
    CreateModuleEventHandler.setAddOptionToHistoryCallback(
      (beatIndex, beatData) =>
        CreateModuleState.addOptionToHistory(beatIndex, beatData)
    );

    // Set up undo snapshot callback
    CreateModuleEventHandler.setPushUndoSnapshotCallback((type, metadata) =>
      CreateModuleState.pushUndoSnapshot(
        type as UndoOperationType,
        metadata as UndoMetadata
      )
    );

    // Configure panel state callbacks on sequenceState
    type SequenceStateWithCallbacks = typeof CreateModuleState.sequenceState & {
      onEditPanelOpen?: (
        beatIndex: number,
        beatData: unknown,
        beatsData: unknown[]
      ) => void;
      onEditPanelClose?: () => void;
      onAnimationStart?: () => void;
      onAnimationEnd?: () => void;
    };
    const seqState = CreateModuleState.sequenceState as SequenceStateWithCallbacks;

    seqState.onEditPanelOpen = (
      beatIndex: number,
      beatData: unknown,
      beatsData: unknown[]
    ) => {
      if (beatsData && beatsData.length > 0) {
        // Multi-select: open batch edit panel
        panelState.openBatchEditPanel(beatsData as BeatData[]);
      } else {
        // Single beat: open Sequence Actions panel (auto-open effect will handle it based on selection)
        panelState.openSequenceActionsPanel();
      }
    };

    seqState.onEditPanelClose = () => {
      panelState.closeSequenceActionsPanel();
    };

    seqState.onAnimationStart = () => {
      panelState.setAnimating(true);
    };

    seqState.onAnimationEnd = () => {
      panelState.setAnimating(false);
    };
  }

  async loadStartPositions(gridMode: GridMode): Promise<void> {
    await this.StartPositionManager.getDefaultStartPositions(gridMode);
  }

}
