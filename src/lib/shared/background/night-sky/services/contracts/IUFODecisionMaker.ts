/**
 * IUFODecisionMaker - Decides what UFO should do after pausing
 */

import type { UFO, UFOConfig, StarInfo } from "../domain/ufo-types";
import type { INightSkyCalculationService } from "./INightSkyCalculationService";

export interface DecisionContext {
  ufo: UFO;
  config: UFOConfig;
  calculationService: INightSkyCalculationService;
  screenHeight: number;
  findNearbyBrightStar: () => StarInfo | null;
}

export type PauseDecision =
  | { action: "nap" }
  | { action: "vibe_longer"; newDuration: number }
  | { action: "communicate"; star: StarInfo }
  | { action: "photograph"; star: StarInfo }
  | { action: "scan_star"; star: StarInfo; duration: number }
  | { action: "investigate_ground" }
  | { action: "scan_ground"; duration: number }
  | { action: "resume_wandering" };

export interface IUFODecisionMaker {
  /**
   * Decide what to do after a pause ends
   */
  decideAfterPause(ctx: DecisionContext): PauseDecision;
}
