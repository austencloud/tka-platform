/**
 * Create Module Services Type Definition
 *
 * Container interface for all CreateModule services.
 * Used by the context system to provide services to descendant components.
 *
 * Domain: Create module - Service types
 */

import type { ISharer } from "$lib/shared/share/services/contracts/ISharer";
import type { IStartPositionManager } from "../../construct/start-position-picker/services/contracts/IStartPositionManager";
import type { IStepOperator } from "../services/contracts/IStepOperator";
import type { ICreateModuleOrchestrator } from "../services/contracts/ICreateModuleOrchestrator";
import type { INavigationSyncer } from "../services/contracts/INavigationSyncer";
import type { IResponsiveLayoutManager } from "../services/contracts/IResponsiveLayoutManager";
import type { ISequencePersister } from "../services/contracts/ISequencePersister";
import type { ISequenceRepository } from "../services/contracts/ISequenceRepository";

/**
 * Container for all CreateModule services
 */
export interface CreateModuleOrchestrators {
  sequenceService: ISequenceRepository;
  SequencePersister: ISequencePersister;
  StartPositionManager: IStartPositionManager;
  CreateModuleOrchestrator: ICreateModuleOrchestrator;
  layoutService: IResponsiveLayoutManager;
  NavigationSyncer: INavigationSyncer;
  StepOperator: IStepOperator;
  shareService: ISharer;
}
