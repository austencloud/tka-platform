/**
 * IUFOInteractionHandler - Handles user click interactions with the UFO
 *
 * Manages click detection, determines reaction type based on proximity
 * and mood, and triggers appropriate responses (curious, playful, flee).
 */

import type { UFO } from "../domain/ufo-types";
import type { IUFOMoodManager } from "./IUFOMoodManager";

/** Callbacks for state transitions that need to happen in UFOSystem */
export interface UFOStateCallbacks {
  startExiting: (exitType: string) => void;
  resumeWandering: () => void;
}

/** Result of handling a click interaction */
export interface ClickResult {
  handled: boolean;
  reaction?: "curious" | "playful" | "flee" | "glance" | "investigate" | "ignore";
}

export interface IUFOInteractionHandler {
  /**
   * Handle a direct click on the UFO
   * Returns true if the click was handled
   */
  handleDirectHit(
    ufo: UFO,
    isConsecutive: boolean,
    moodManager: IUFOMoodManager,
    callbacks: UFOStateCallbacks
  ): ClickResult;

  /**
   * Handle a click near but not on the UFO
   * UFO glances toward the click location
   */
  handleNearMiss(
    ufo: UFO,
    clickX: number,
    clickY: number,
    moodManager: IUFOMoodManager
  ): ClickResult;

  /**
   * Handle a click far from the UFO
   * Curious UFO may investigate the location
   */
  handleFarClick(
    ufo: UFO,
    clickX: number,
    clickY: number,
    moodManager: IUFOMoodManager
  ): ClickResult;

  /**
   * Calculate the angular difference between two angles
   * Returns value in range [-PI, PI]
   */
  angleDiff(from: number, to: number): number;
}
