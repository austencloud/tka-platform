/**
 * IFormationManager Contract
 *
 * Service for managing performer formations in the Stage.
 * Handles formation presets, custom formations, and smooth transitions.
 */

import type {
  Formation,
  Position2D,
} from "../../domain/formation";

/**
 * Position and facing for a single performer
 */
export interface PerformerFormationState {
  index: number;
  position: Position2D;
  facingAngle: number;
}

/**
 * Callback for formation changes
 */
export type FormationChangeCallback = (formation: Formation) => void;

/**
 * Callback for transition updates
 */
export type TransitionUpdateCallback = (
  positions: PerformerFormationState[]
) => void;

// IFormationManager interface retired — createFormationManager() return type is the contract now.
