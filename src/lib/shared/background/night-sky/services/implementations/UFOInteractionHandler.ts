/**
 * UFOInteractionHandler - Handles user click interactions with the UFO
 *
 * Manages click detection, determines reaction type based on proximity
 * and mood, and triggers appropriate responses.
 */

import type {
  IUFOInteractionHandler,
  UFOStateCallbacks,
  ClickResult,
} from "../contracts/IUFOInteractionHandler";
import type { UFO } from "../domain/ufo-types";
import type { IUFOMoodManager } from "../contracts/IUFOMoodManager";

export class UFOInteractionHandler implements IUFOInteractionHandler {
  handleDirectHit(
    ufo: UFO,
    isConsecutive: boolean,
    moodManager: IUFOMoodManager,
    callbacks: UFOStateCallbacks
  ): ClickResult {
    // Update click tracking
    ufo.lastClickTime = ufo.totalTime;

    if (!isConsecutive) {
      // First click - curious reaction
      ufo.clickCount = 1;
      this.reactCuriously(ufo, moodManager);
      return { handled: true, reaction: "curious" };
    }

    // Consecutive click - escalated response based on mood
    ufo.clickCount++;

    switch (ufo.mood) {
      case "playful":
        // Playful UFO does a spin and stays
        this.reactPlayfully(ufo, moodManager, callbacks);
        return { handled: true, reaction: "playful" };

      case "bored":
      case "tired":
        // Grumpy/tired UFO flees
        this.reactFlee(ufo, moodManager, callbacks);
        return { handled: true, reaction: "flee" };

      case "startled":
        // Already startled, definitely flee
        this.reactFlee(ufo, moodManager, callbacks);
        return { handled: true, reaction: "flee" };

      case "curious":
      case "excited":
      default:
        // 50/50 chance: either play or flee
        if (Math.random() < 0.5) {
          this.reactPlayfully(ufo, moodManager, callbacks);
          return { handled: true, reaction: "playful" };
        } else {
          this.reactFlee(ufo, moodManager, callbacks);
          return { handled: true, reaction: "flee" };
        }
    }
  }

  handleNearMiss(
    ufo: UFO,
    clickX: number,
    clickY: number,
    moodManager: IUFOMoodManager
  ): ClickResult {
    // Small glance toward click - turn heading slightly
    const dx = clickX - ufo.x;
    const dy = clickY - ufo.y;
    const clickAngle = Math.atan2(dy, dx);

    // Subtle turn toward click
    const angleDelta = this.angleDiff(ufo.heading, clickAngle);
    ufo.heading += angleDelta * 0.3; // Partial turn, just a glance

    // Mark interest - something happened nearby
    moodManager.markInterest(ufo);

    return { handled: true, reaction: "glance" };
  }

  handleFarClick(
    ufo: UFO,
    clickX: number,
    clickY: number,
    moodManager: IUFOMoodManager
  ): ClickResult {
    // Only investigate if not busy
    if (ufo.state !== "wandering" && ufo.state !== "paused") {
      return { handled: false, reaction: "ignore" };
    }

    // Curious or playful UFO investigates
    if (ufo.mood === "curious" || ufo.mood === "playful" || ufo.mood === "excited") {
      // Set click target - UFO will head there
      ufo.clickTarget = { x: clickX, y: clickY };
      ufo.targetZ = 0.15; // Approach to investigate

      // Turn toward click location
      const dx = clickX - ufo.x;
      const dy = clickY - ufo.y;
      ufo.heading = Math.atan2(dy, dx);

      // Start moving (if paused, resume wandering)
      if (ufo.state === "paused") {
        ufo.state = "wandering";
        ufo.stateTimer = 0;
      }

      // Cancel drifting - UFO has purpose now
      ufo.isDrifting = false;

      moodManager.markInterest(ufo);
      return { handled: true, reaction: "investigate" };
    }

    // Bored/tired UFO ignores far clicks
    return { handled: false, reaction: "ignore" };
  }

  angleDiff(from: number, to: number): number {
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  /**
   * Curious reaction to first click - wobble and become playful
   */
  private reactCuriously(ufo: UFO, moodManager: IUFOMoodManager): void {
    // Pause current activity
    ufo.state = "paused";
    ufo.stateTimer = 0;
    ufo.stateDuration = 60; // 1 second pause
    ufo.targetZ = 0.2; // Come closer when curious

    // Stop any beam
    ufo.beamTarget = null;
    ufo.beamIntensity = 0;

    // Curious tilt wobble
    moodManager.triggerWobble(ufo, "curious_tilt");

    // Enter playful mood
    moodManager.setMood(ufo, "playful");
  }

  /**
   * Playful reaction - happy spin
   */
  private reactPlayfully(
    ufo: UFO,
    moodManager: IUFOMoodManager,
    callbacks: UFOStateCallbacks
  ): void {
    // Do a quick spin (handled visually via lightPhase acceleration)
    // Make lights go crazy briefly
    ufo.lightPhase += Math.PI * 2; // Full rotation

    // Happy bounce wobble
    moodManager.triggerWobble(ufo, "happy_bounce");

    // Stay playful
    moodManager.setMood(ufo, "playful");

    // Resume wandering happily
    callbacks.resumeWandering();
  }

  /**
   * Flee reaction - panic exit
   */
  private reactFlee(
    ufo: UFO,
    moodManager: IUFOMoodManager,
    callbacks: UFOStateCallbacks
  ): void {
    // Startled jolt wobble
    moodManager.triggerWobble(ufo, "startled_jolt");

    // Enter startled mood briefly (lights flash)
    moodManager.setMood(ufo, "startled");

    // Shoot up and out!
    callbacks.startExiting("shootUp");
  }
}
