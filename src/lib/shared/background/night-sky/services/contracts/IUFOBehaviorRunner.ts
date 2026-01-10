/**
 * IUFOBehaviorRunner - Executes UFO behavior state updates
 *
 * Each behavior has a start* and update* method pair.
 * Behaviors modify UFO state directly and may transition to other states.
 */

import type { UFO, UFOConfig, StarInfo, EventPosition } from "../domain/ufo-types";
import type { Dimensions } from "../../../shared/domain/types/background-types";
import type { IUFOMoodManager } from "./IUFOMoodManager";
import type { IUFOStarScanner } from "./IUFOStarScanner";
import type { INightSkyCalculationService } from "./INightSkyCalculationService";

/** Callbacks for state transitions that need to happen in UFOSystem */
export interface BehaviorCallbacks {
  resumeWandering: () => void;
  startExiting: (exitType?: string) => void;
  startPause: () => void;
  startNapping: () => void;
  startCelebrating: () => void;
  startHiding: () => void;
  startGivingUp: () => void;
  findNearbyBrightStar: () => StarInfo | null;
  findStarNearPosition: (x: number, y: number) => StarInfo | null;
  rememberScannedStar: (x: number, y: number) => void;
  angleDiff: (from: number, to: number) => number;
}

/** Context passed to behavior methods */
export interface BehaviorContext {
  ufo: UFO;
  config: UFOConfig;
  dimensions: Dimensions;
  speedMult: number;
  moodManager: IUFOMoodManager;
  starScanner: IUFOStarScanner;
  calculationService: INightSkyCalculationService;
  callbacks: BehaviorCallbacks;
  eventProvider: (() => EventPosition | null) | null;
  starProvider: (() => StarInfo[]) | null;
}

export interface IUFOBehaviorRunner {
  // Chase/track behaviors
  startChasing(ctx: BehaviorContext, event: EventPosition): void;
  updateChasing(ctx: BehaviorContext): void;
  startGivingUp(ctx: BehaviorContext): void;
  updateGivingUp(ctx: BehaviorContext): void;

  // Sample collection
  startCollectingSample(ctx: BehaviorContext, event: EventPosition): void;
  updateCollectingSample(ctx: BehaviorContext): void;

  // Photography
  startPhotographing(ctx: BehaviorContext, star: StarInfo): void;
  updatePhotographing(ctx: BehaviorContext): void;

  // Ground investigation
  startInvestigatingGround(ctx: BehaviorContext): void;
  updateInvestigatingGround(ctx: BehaviorContext): void;

  // Panic/surfing
  startPanicking(ctx: BehaviorContext, fromX: number, fromY: number): void;
  updatePanicking(ctx: BehaviorContext): void;
  startSurfing(ctx: BehaviorContext, event: EventPosition): void;
  updateSurfing(ctx: BehaviorContext): void;

  // Following
  startFollowing(ctx: BehaviorContext, event: EventPosition): void;
  updateFollowing(ctx: BehaviorContext): void;

  // Communication
  startCommunicating(ctx: BehaviorContext, star: StarInfo): void;
  updateCommunicating(ctx: BehaviorContext): void;

  // Rest behaviors
  startNapping(ctx: BehaviorContext): void;
  updateNapping(ctx: BehaviorContext): void;

  // Celebration
  startCelebrating(ctx: BehaviorContext): void;
  updateCelebrating(ctx: BehaviorContext): void;

  // Peekaboo (hiding)
  startHiding(ctx: BehaviorContext): void;
  updatePeekaboo(ctx: BehaviorContext): void;
}
