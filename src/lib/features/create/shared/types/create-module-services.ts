/**
 * Create Module Services Type Definition
 *
 * Container interface for all CreateModule services.
 * Used by the context system to provide services to descendant components.
 *
 * Domain: Create module - Service types
 */

import type { ISharer } from "$lib/shared/share/services/contracts/ISharer";
import type { StartPositionManager } from "$lib/features/create/construct/start-position-picker/services/implementations/StartPositionManager";
import type { StepOperator } from "$lib/features/create/shared/services/implementations/StepOperator";
import type { CreateModuleOrchestrator } from "$lib/features/create/shared/services/implementations/CreateModuleOrchestrator";
import type { INavigationSyncer } from "../services/contracts/INavigationSyncer";
import type { ResponsiveLayoutManager } from "$lib/features/create/shared/services/implementations/ResponsiveLayoutManager";
import type { SequencePersister } from "$lib/features/create/shared/services/implementations/SequencePersister";
import type { SequenceRepository } from "$lib/features/create/shared/services/implementations/SequenceRepository";

/**
 * Container for all CreateModule services
 */
export interface CreateModuleOrchestrators {
  sequenceService: SequenceRepository;
  SequencePersister: SequencePersister;
  StartPositionManager: StartPositionManager;
  CreateModuleOrchestrator: CreateModuleOrchestrator;
  layoutService: ResponsiveLayoutManager;
  NavigationSyncer: INavigationSyncer;
  StepOperator: StepOperator;
  shareService: ISharer;
}
