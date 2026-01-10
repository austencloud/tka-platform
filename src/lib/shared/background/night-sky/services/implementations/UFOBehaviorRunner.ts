/**
 * UFOBehaviorRunner - Coordinates UFO behavior execution
 *
 * This is a thin coordinator that delegates to individual behavior classes.
 * Each behavior is a standalone class with clear single responsibility.
 */

import type {
  IUFOBehaviorRunner,
  BehaviorContext,
} from "../contracts/IUFOBehaviorRunner";
import type { StarInfo, EventPosition } from "../domain/ufo-types";

// Import individual behaviors
import { ChasingBehavior } from "./behaviors/ChasingBehavior";
import { GivingUpBehavior } from "./behaviors/GivingUpBehavior";
import { SampleCollectionBehavior } from "./behaviors/SampleCollectionBehavior";
import { PhotographingBehavior } from "./behaviors/PhotographingBehavior";
import { GroundInvestigationBehavior } from "./behaviors/GroundInvestigationBehavior";
import { PanickingBehavior } from "./behaviors/PanickingBehavior";
import { SurfingBehavior } from "./behaviors/SurfingBehavior";
import { FollowingBehavior } from "./behaviors/FollowingBehavior";
import { CommunicatingBehavior } from "./behaviors/CommunicatingBehavior";
import { NappingBehavior } from "./behaviors/NappingBehavior";
import { CelebratingBehavior } from "./behaviors/CelebratingBehavior";
import { PeekabooBehavior } from "./behaviors/PeekabooBehavior";

export class UFOBehaviorRunner implements IUFOBehaviorRunner {
  // Behavior instances
  private readonly chasingBehavior = new ChasingBehavior();
  private readonly givingUpBehavior = new GivingUpBehavior();
  private readonly sampleCollectionBehavior = new SampleCollectionBehavior();
  private readonly photographingBehavior = new PhotographingBehavior();
  private readonly groundInvestigationBehavior = new GroundInvestigationBehavior();
  private readonly panickingBehavior = new PanickingBehavior();
  private readonly surfingBehavior = new SurfingBehavior();
  private readonly followingBehavior = new FollowingBehavior();
  private readonly communicatingBehavior = new CommunicatingBehavior();
  private readonly nappingBehavior = new NappingBehavior();
  private readonly celebratingBehavior = new CelebratingBehavior();
  private readonly peekabooBehavior = new PeekabooBehavior();

  // === Chase/Track ===
  startChasing(ctx: BehaviorContext, event: EventPosition): void {
    this.chasingBehavior.start(ctx, event);
  }

  updateChasing(ctx: BehaviorContext): void {
    this.chasingBehavior.update(ctx);
  }

  startGivingUp(ctx: BehaviorContext): void {
    this.givingUpBehavior.start(ctx);
  }

  updateGivingUp(ctx: BehaviorContext): void {
    this.givingUpBehavior.update(ctx);
  }

  // === Sample Collection ===
  startCollectingSample(ctx: BehaviorContext, event: EventPosition): void {
    this.sampleCollectionBehavior.start(ctx, event);
  }

  updateCollectingSample(ctx: BehaviorContext): void {
    this.sampleCollectionBehavior.update(ctx);
  }

  // === Photography ===
  startPhotographing(ctx: BehaviorContext, star: StarInfo): void {
    this.photographingBehavior.start(ctx, star);
  }

  updatePhotographing(ctx: BehaviorContext): void {
    this.photographingBehavior.update(ctx);
  }

  // === Ground Investigation ===
  startInvestigatingGround(ctx: BehaviorContext): void {
    this.groundInvestigationBehavior.start(ctx);
  }

  updateInvestigatingGround(ctx: BehaviorContext): void {
    this.groundInvestigationBehavior.update(ctx);
  }

  // === Panic ===
  startPanicking(ctx: BehaviorContext, fromX: number, fromY: number): void {
    this.panickingBehavior.start(ctx, fromX, fromY);
  }

  updatePanicking(ctx: BehaviorContext): void {
    this.panickingBehavior.update(ctx);
  }

  // === Surfing ===
  startSurfing(ctx: BehaviorContext, event: EventPosition): void {
    this.surfingBehavior.start(ctx, event);
  }

  updateSurfing(ctx: BehaviorContext): void {
    this.surfingBehavior.update(ctx);
  }

  // === Following ===
  startFollowing(ctx: BehaviorContext, event: EventPosition): void {
    this.followingBehavior.start(ctx, event);
  }

  updateFollowing(ctx: BehaviorContext): void {
    this.followingBehavior.update(ctx);
  }

  // === Communication ===
  startCommunicating(ctx: BehaviorContext, star: StarInfo): void {
    this.communicatingBehavior.start(ctx, star);
  }

  updateCommunicating(ctx: BehaviorContext): void {
    this.communicatingBehavior.update(ctx);
  }

  // === Napping ===
  startNapping(ctx: BehaviorContext): void {
    this.nappingBehavior.start(ctx);
  }

  updateNapping(ctx: BehaviorContext): void {
    this.nappingBehavior.update(ctx);
  }

  // === Celebrating ===
  startCelebrating(ctx: BehaviorContext): void {
    this.celebratingBehavior.start(ctx);
  }

  updateCelebrating(ctx: BehaviorContext): void {
    this.celebratingBehavior.update(ctx);
  }

  // === Peekaboo (Hiding) ===
  startHiding(ctx: BehaviorContext): void {
    this.peekabooBehavior.start(ctx);
  }

  updatePeekaboo(ctx: BehaviorContext): void {
    this.peekabooBehavior.update(ctx);
  }
}
