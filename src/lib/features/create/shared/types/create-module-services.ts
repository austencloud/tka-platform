/**
 * Create Module Services Type Definition
 *
 * Container interface for all CreateModule services.
 * Used by the context system to provide services to descendant components.
 *
 * Domain: Create module - Service types
 */

import type { StartPositionManager } from "$lib/shared/create/services/StartPositionManager";
import type { StepOperator } from "$lib/features/create/shared/services/step-operator";
import type { CreateModuleOrchestrator } from "$lib/features/create/shared/services/create-module-orchestrator";
import type { NavigationSyncer } from "../services/navigation-syncer";
import type { ResponsiveLayoutManager } from "$lib/shared/create/services/ResponsiveLayoutManager";
import type { SequencePersister } from "$lib/features/create/shared/services/sequence-persister";
import type { SequenceRepository } from "$lib/shared/create/services/SequenceRepository";
import type { Sharer } from "../../../../shared/share/services/sharer";

/**
 * Container for all CreateModule services
 */
export interface CreateModuleOrchestrators {
  sequenceService: SequenceRepository;
  SequencePersister: SequencePersister;
  StartPositionManager: StartPositionManager;
  CreateModuleOrchestrator: CreateModuleOrchestrator;
  layoutService: ResponsiveLayoutManager;
  NavigationSyncer: NavigationSyncer;
  StepOperator: StepOperator;
  shareService: Sharer;
}
