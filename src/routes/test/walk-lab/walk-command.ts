/**
 * What the lab is telling the performer to do, and what the keyboard is
 * telling the lab.
 *
 * Separate from the driver component because a Svelte component cannot export
 * a type from its instance script, and both halves of the page need these.
 */

import type { TurnRequest } from "@austencloud/scene-3d";

/** Held keys, resolved into the character's own frame. */
export interface ManualInput {
  /** +1 ahead, -1 behind. */
  forward: number;
  /** +1 the character's right, -1 their left. */
  right: number;
  /** +1 turns left, -1 turns right. */
  turn: number;
}

export interface WalkState {
  /** Seconds the pattern has been running. */
  t: number;
  x: number;
  z: number;
  /** Absolute facing in radians. 0 faces +Z. */
  facing: number;
  isMoving: boolean;
  /** Commanded ground speed this frame, m/s. */
  speed: number;
  /** Travel direction in the character's own frame, normalised. */
  direction: { x: number; z: number };
  phase: string;
  /** Metres covered since the last reset. */
  travelled: number;
  /** Requested authored steps for an exact mark-to-mark move. */
  plannedSteps?: number;
  /** Completed and fractional authored steps since departure. */
  completedSteps?: number;
  /** Straight-line distance still owed to the requested mark, in metres. */
  endpointError?: number;
  /** Turn clip request for a stationary authored pivot. */
  turnRequest?: TurnRequest | null;
}
