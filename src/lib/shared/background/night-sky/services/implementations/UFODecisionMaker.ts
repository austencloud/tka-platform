/**
 * UFODecisionMaker - Decides what UFO should do after pausing
 *
 * Extracted from UFOSystem.decideAfterPause() - pure decision logic
 * with no side effects. Returns a decision that the caller acts upon.
 */

import type {
  IUFODecisionMaker,
  DecisionContext,
  PauseDecision,
} from "../contracts/IUFODecisionMaker";

export class UFODecisionMaker implements IUFODecisionMaker {
  decideAfterPause(ctx: DecisionContext): PauseDecision {
    const { ufo: u, config, calculationService, screenHeight, findNearbyBrightStar } = ctx;

    // If tired, might take a nap
    if (u.mood === "tired" && Math.random() < 0.4) {
      return { action: "nap" };
    }

    // Sometimes the alien just wants to vibe - no scanning, just chill longer
    const justVibeChance = config.justVibeChance ?? 0.3;
    if (Math.random() < justVibeChance) {
      const newDuration = calculationService.randInt(
        config.pauseDuration.min,
        config.pauseDuration.max
      );
      return { action: "vibe_longer", newDuration };
    }

    // Check for nearby bright star - decide how to interact based on mood
    if (Math.random() < config.scanStarChance) {
      const star = findNearbyBrightStar();
      if (star) {
        return this.decideStarInteraction(u, config, calculationService, star);
      }
    }

    // Ground observation - what's down there?
    if (Math.random() < config.groundScanChance) {
      // Sometimes investigate ground more thoroughly with particles
      if (Math.random() < 0.4) {
        return { action: "investigate_ground" };
      } else {
        const duration = calculationService.randInt(
          config.scanDuration.min,
          config.scanDuration.max
        );
        return { action: "scan_ground", duration };
      }
    }

    // Default: time to wander again
    return { action: "resume_wandering" };
  }

  private decideStarInteraction(
    u: { mood: string },
    config: { scanDuration: { min: number; max: number } },
    calculationService: { randInt: (min: number, max: number) => number },
    star: { x: number; y: number; brightness: number }
  ): PauseDecision {
    const roll = Math.random();

    if (u.mood === "playful" && roll < 0.3) {
      // Try to communicate with the star!
      return { action: "communicate", star };
    } else if ((u.mood === "curious" || u.mood === "bored") && roll < 0.4) {
      // Take a photo of the star (tourist mode)
      return { action: "photograph", star };
    } else {
      // Default: just scan the star
      const duration = calculationService.randInt(
        config.scanDuration.min,
        config.scanDuration.max
      );
      return { action: "scan_star", star, duration };
    }
  }
}
