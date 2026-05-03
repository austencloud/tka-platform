/**
 * Create Module Initialization Service Contract
 *
 * Handles all initialization logic for CreateModule including:
 * - Service resolution
 * - State object creation
 * - Persistence initialization
 * - Start position loading
 * - Event service configuration
 * - Deep link and sequence loading coordination
 *
 * Extracted from CreateModule.svelte onMount monolith.
 */

import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PanelCoordinationState } from "../../state/panel-coordination-state.svelte";
import type { StepOperator } from "../implementations/StepOperator";
import type { ICreateModuleEffectCoordinator } from "./ICreateModuleEffectCoordinator";
import type { ICreateModuleHandlers } from "./ICreateModuleHandlers";
import type { IDeepLinkSequenceHandler } from "./IDeepLinkSequenceHandler";
import type { INavigationSyncer } from "./INavigationSyncer";
import type { ResponsiveLayoutManager } from "../implementations/ResponsiveLayoutManager";
import type { SequenceRepository } from "../implementations/SequenceRepository";
import type { SequencePersister } from "../implementations/SequencePersister";
import type { CreateModuleOrchestrator } from "../implementations/CreateModuleOrchestrator";
import type { StartPositionManager } from "$lib/features/create/construct/start-position-picker/services/implementations/StartPositionManager";
import type { ISharer } from "$lib/shared/share/services/contracts/ISharer";
import type { IPanelPersister } from "./IPanelPersister";
import type { ICreateModuleState } from "../../types/create-module-types";
import type { createConstructTabState } from "../../state/construct-tab-state.svelte";
// ARCHIVED: AssemblerTabState import removed (Feb 2026)
import type { GeneratorTabState } from "../../state/generator-tab-state.svelte";
// REMOVED: SpellTabState import - Spell mode unified into Generate tab (Feb 2026)
import type { AssembleTabState } from "../../state/assemble-tab-state.svelte";

// Use the actual return type of createConstructTabState instead of the incomplete interface
type ConstructTabState = ReturnType<typeof createConstructTabState>;

export interface CreateModuleInitializationResult {
  // State objects
  CreateModuleState: ICreateModuleState;
  constructTabState: ConstructTabState;
  // ARCHIVED: assemblerTabState removed (Feb 2026)
  generatorTabState: GeneratorTabState;
  // REMOVED: spellTabState - Spell mode unified into Generate tab (Feb 2026)
  assembleTabState: AssembleTabState;

  // Core services
  sequenceService: SequenceRepository;
  SequencePersister: SequencePersister;
  StartPositionManager: StartPositionManager;
  CreateModuleOrchestrator: CreateModuleOrchestrator;
  layoutService: ResponsiveLayoutManager;
  NavigationSyncer: INavigationSyncer;
  StepOperator: StepOperator;

  // UI coordination services
  handlers: ICreateModuleHandlers;
  effectCoordinator: ICreateModuleEffectCoordinator;
  deepLinkService: IDeepLinkSequenceHandler;
  shareService: ISharer;
  panelPersistenceService: IPanelPersister;
}

export interface SequenceLoadResult {
  /** Whether a sequence was loaded from deep link or pending edit */
  sequenceLoaded: boolean;
  /** Tab to navigate to (from deep link) */
  targetTab?: string;
  /** Whether creation method should be marked as selected */
  shouldMarkMethodSelected: boolean;
}

export interface ICreateModuleInitializer {
  /**
   * Initialize all services and state for CreateModule
   * @returns Initialized services and state objects
   * @throws Error if initialization fails
   */
  initialize(): Promise<CreateModuleInitializationResult>;

  /**
   * Configure event service callbacks for sequence operations
   * @param CreateModuleState Create Module State object
   * @param panelState Panel coordination state for callback handlers
   */
  configureEventCallbacks(
    CreateModuleState: ICreateModuleState,
    panelState: PanelCoordinationState
  ): void;

  /**
   * Load default start positions for a grid mode
   * @param gridMode Grid mode to load start positions for
   */
  loadStartPositions(gridMode: GridMode): Promise<void>;

  /**
   * Load sequence from deep link or pending edit, then initialize persistence if needed.
   * Coordinates the order of operations to prevent data overwrites.
   *
   * @param setSequence Callback to set sequence in state
   * @param initializePersistence Callback to initialize persistence (only called if no sequence loaded)
   * @returns Result indicating what was loaded and what actions to take
   */
  loadSequenceAndInitializePersistence(
    setSequence: (sequence: SequenceData) => void,
    initializePersistence: () => Promise<void>
  ): Promise<SequenceLoadResult>;

  /**
   * Check if creation method was already selected based on current state.
   * Auto-detects based on workspace content (not tab - we want tutorial to show).
   *
   * @param activeTab Current active navigation tab (unused, kept for API compatibility)
   * @param isWorkspaceEmpty Whether the workspace has content
   * @param currentSelection Current selection state from persistence
   * @returns Whether method should be considered selected (skip tutorial)
   */
  detectCreationMethodSelection(
    activeTab: string,
    isWorkspaceEmpty: boolean,
    currentSelection: boolean
  ): boolean;

}
