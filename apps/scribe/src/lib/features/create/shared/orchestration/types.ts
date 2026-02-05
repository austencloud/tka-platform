import type { IViewportManager } from "$lib/shared/device/services/contracts/IViewportManager";
/**
 * CreateModule Orchestration Types
 *
 * Central type definitions for the CreateModule orchestration architecture.
 * These types define the contracts between different layers of the system.
 */

import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
import type { IStartPositionManager } from "../../construct/start-position-picker/services/contracts/IStartPositionManager";
import type { ICreateModuleOrchestrator } from "../services/contracts/ICreateModuleOrchestrator";
import type { ISequencePersister } from "../services/contracts/ISequencePersister";
import type { ISequenceRepository } from "../services/contracts/ISequenceRepository";
import type { ISequenceStatsCalculator } from "../services/contracts/ISequenceStatsCalculator";
import type { ISequenceTransformer } from "../services/contracts/ISequenceTransformer";
import type { ISequenceValidator } from "../services/contracts/ISequenceValidator";
import type { createCreateModuleState } from "../state/create-module-state.svelte";
import type { createConstructTabState } from "../state/construct-tab-state.svelte";

/**
 * Collection of all services required by CreateModule
 */
export interface CreateModuleOrchestrators {
  sequenceService: ISequenceRepository;
  SequencePersister: ISequencePersister;
  StartPositionManager: IStartPositionManager;
  CreateModuleOrchestrator: ICreateModuleOrchestrator;
  deviceDetector: IDeviceDetector;
  viewportService: IViewportManager;
  sequenceStatisticsService: ISequenceStatsCalculator;
  SequenceTransformer: ISequenceTransformer;
  sequenceValidationService: ISequenceValidator;
}

/**
 * Collection of all state objects used by CreateModule
 */
export interface CreateModuleStates {
  CreateModuleState: ReturnType<typeof createCreateModuleState>;
  constructTabState: ReturnType<typeof createConstructTabState>;
}

/**
 * Layout configuration for responsive layout management
 */
export interface LayoutConfiguration {
  /** Navigation layout position: top for desktop/tablet, left for landscape mobile, bottom for portrait mobile */
  navigationLayout: "top" | "left" | "bottom";

  /** Whether panels should be side-by-side (true) or stacked (false) */
  shouldUseSideBySideLayout: boolean;

  /** Current viewport width in pixels */
  viewportWidth: number;

  /** Current viewport height in pixels */
  viewportHeight: number;

  /** Whether device is detected as desktop */
  isDesktop: boolean;

  /** Whether device is in landscape mobile mode */
  isLandscapeMobile: boolean;

  /** Aspect ratio (width / height) */
  aspectRatio: number;

  /** Whether device is likely Z Fold unfolded */
  isLikelyZFoldUnfolded: boolean;
}

/**
 * Initialization status tracking
 */
export interface InitializationStatus {
  /** Whether all services have been resolved */
  servicesResolved: boolean;

  /** Whether state factories have been initialized */
  statesInitialized: boolean;

  /** Whether persistence has been loaded */
  persistenceLoaded: boolean;

  /** Whether initialization is complete and system is ready */
  ready: boolean;

  /** Any error that occurred during initialization */
  error?: string;
}

/**
 * Result of initialization process
 */
export interface InitializationResult {
  services: CreateModuleOrchestrators;
  states: CreateModuleStates;
  status: InitializationStatus;
}
