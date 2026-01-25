/**
 * UFOSystem - Intelligent Wandering UFO Easter Egg
 *
 * A rare visitor that browses the night sky with curiosity and purpose.
 * Features:
 * - Wandering behavior with pauses and direction changes
 * - Intelligent tractor beam that scans stars, tracks celestial events, or observes ground
 * - State machine controlling behavior transitions
 *
 * Rendering and mood management delegated to:
 * - IUFORenderer - hull, dome, shield, beam, lights
 * - IUFOParticleRenderer - narrative effects, particles
 * - IUFOMoodManager - emotional state, wobble animations
 */

import type { AccessibilitySettings } from "../../shared/domain/models/background-models";
import type {
  Dimensions,
  QualityLevel,
} from "../../shared/domain/types/background-types";
import type { INightSkyCalculationService } from "./contracts/INightSkyCalculationService";
import type { IUFORenderer } from "./contracts/IUFORenderer";
import type { IUFOParticleRenderer } from "./contracts/IUFOParticleRenderer";
import type { IUFOMoodManager } from "./contracts/IUFOMoodManager";
import type { IUFOStarScanner } from "./contracts/IUFOStarScanner";
import type { IUFOInteractionHandler, UFOStateCallbacks } from "./contracts/IUFOInteractionHandler";
import type { IUFOBehaviorRunner, BehaviorContext, BehaviorCallbacks } from "./contracts/IUFOBehaviorRunner";
import type { IUFOEntranceAnimator } from "./contracts/IUFOEntranceAnimator";
import type { IUFOExitAnimator } from "./contracts/IUFOExitAnimator";
import type { IUFOMovementController, MovementContext } from "./contracts/IUFOMovementController";
import type { IUFODecisionMaker, DecisionContext } from "./contracts/IUFODecisionMaker";
import { UFOFactory } from "./implementations/UFOFactory";
import type {
  MoodVisuals,
  UFOConfig,
  UFO,
  UFOState,
  UFOMood,
  UFOEntranceType,
  UFOExitType,
  WobbleType,
  NarrativePhase,
  Particle,
  CommPulse,
  StarInfo,
  EventPosition,
} from "./domain/ufo-types";

// Re-export types for external consumers
export type { UFOConfig, UFOMood, UFOEntranceType, UFOExitType, WobbleType } from "./domain/ufo-types";

export class UFOSystem {
  private ufo: UFO | null = null;
  private timer: number = 0;
  private config: UFOConfig;
  private calculationService: INightSkyCalculationService;
  private quality: QualityLevel = "high";
  private dimensions: Dimensions = { width: 1920, height: 1080 };

  // Extracted services for rendering and mood
  private renderer: IUFORenderer;
  private particleRenderer: IUFOParticleRenderer;
  private moodManager: IUFOMoodManager;
  private starScanner: IUFOStarScanner;
  private interactionHandler: IUFOInteractionHandler;
  private behaviorRunner: IUFOBehaviorRunner;
  private entranceAnimator: IUFOEntranceAnimator;
  private exitAnimator: IUFOExitAnimator;
  private movementController: IUFOMovementController;
  private decisionMaker: IUFODecisionMaker;
  private ufoFactory: UFOFactory;

  // Callbacks for interaction handler state transitions
  private stateCallbacks: UFOStateCallbacks;
  private behaviorCallbacks: BehaviorCallbacks;

  // External references for intelligent beam (set by NightSkyBackgroundSystem)
  private starProvider: (() => StarInfo[]) | null = null;
  private eventProvider: (() => EventPosition | null) | null = null;

  constructor(
    config: UFOConfig,
    calculationService: INightSkyCalculationService,
    renderer: IUFORenderer,
    particleRenderer: IUFOParticleRenderer,
    moodManager: IUFOMoodManager,
    starScanner: IUFOStarScanner,
    interactionHandler: IUFOInteractionHandler,
    behaviorRunner: IUFOBehaviorRunner,
    entranceAnimator: IUFOEntranceAnimator,
    exitAnimator: IUFOExitAnimator,
    movementController: IUFOMovementController,
    decisionMaker: IUFODecisionMaker
  ) {
    this.config = config;
    this.calculationService = calculationService;
    this.renderer = renderer;
    this.particleRenderer = particleRenderer;
    this.moodManager = moodManager;
    this.starScanner = starScanner;
    this.interactionHandler = interactionHandler;
    this.behaviorRunner = behaviorRunner;
    this.entranceAnimator = entranceAnimator;
    this.exitAnimator = exitAnimator;
    this.movementController = movementController;
    this.decisionMaker = decisionMaker;
    this.ufoFactory = new UFOFactory(calculationService);

    // Create callbacks for interaction handler
    this.stateCallbacks = {
      startExiting: (exitType: string) => this.startExiting(exitType as UFOExitType),
      resumeWandering: () => this.resumeWandering(),
    };

    // Create callbacks for behavior runner
    this.behaviorCallbacks = {
      resumeWandering: () => this.resumeWandering(),
      startExiting: (exitType?: string) => this.startExiting(exitType as UFOExitType | undefined),
      startPause: () => this.startPause(),
      startNapping: () => this.startNapping(),
      startCelebrating: () => this.startCelebrating(),
      startHiding: () => this.startHiding(),
      startGivingUp: () => this.startGivingUp(),
      findNearbyBrightStar: () => this.findNearbyBrightStar(),
      findStarNearPosition: (x: number, y: number) => this.findStarNearPosition(x, y),
      rememberScannedStar: (x: number, y: number) => this.rememberScannedStar(x, y),
      angleDiff: (from: number, to: number) => this.angleDiff(from, to),
    };
  }

  /**
   * Set provider for nearby stars (for beam targeting)
   */
  setStarProvider(provider: () => StarInfo[]): void {
    this.starProvider = provider;
  }

  /**
   * Set provider for active celestial events (meteor/comet position)
   */
  setEventProvider(provider: () => EventPosition | null): void {
    this.eventProvider = provider;
  }

  /**
   * Create behavior context for behavior runner
   */
  private createBehaviorContext(speedMult: number): BehaviorContext | null {
    if (!this.ufo) return null;
    return {
      ufo: this.ufo,
      config: this.config,
      dimensions: this.dimensions,
      speedMult,
      moodManager: this.moodManager,
      starScanner: this.starScanner,
      calculationService: this.calculationService,
      callbacks: this.behaviorCallbacks,
      eventProvider: this.eventProvider,
      starProvider: this.starProvider,
    };
  }

  update(
    dim: Dimensions,
    a11y: AccessibilitySettings,
    quality: QualityLevel
  ): void {
    this.quality = quality;
    this.dimensions = dim;

    if (!this.config.enabledOnQuality.includes(quality)) {
      this.ufo = null;
      return;
    }

    const speedMult = a11y.reducedMotion ? 0.3 : 1;

    if (!this.ufo) {
      // No UFO active - count down to next appearance
      this.timer += speedMult;
      if (this.timer >= this.config.interval) {
        this.spawnUFO(dim);
        this.timer = 0;
      }
    } else {
      this.updateUFO(dim, speedMult);
    }
  }

  /** All entrance types for random selection */
  private readonly entranceTypes: UFOEntranceType[] = [
    "fade",
    "warp",
    "zoom",
    "descend",
  ];

  /** All exit types for random selection */
  private readonly exitTypes: UFOExitType[] = [
    "fade",
    "warp",
    "zoom",
    "shootUp",
  ];

  private spawnUFO(
    dim: Dimensions,
    entranceType?: UFOEntranceType,
    exitType?: UFOExitType
  ): void {
    this.ufo = this.ufoFactory.create({
      dimensions: dim,
      config: this.config,
      entranceType,
      exitType,
    });
  }

  private updateUFO(dim: Dimensions, speedMult: number): void {
    if (!this.ufo) return;

    const u = this.ufo;

    // Get mood-based visual modifiers
    const moodVisuals = this.moodManager.getMoodVisuals(this.ufo, this.config);

    // Update animation phases with mood modifiers
    u.shieldPhase += this.config.shieldPulseSpeed * speedMult;
    u.lightPhase += this.config.lightChaseSpeed * speedMult * moodVisuals.lightSpeed;
    u.hoverPhase += this.config.hoverBobSpeed * speedMult;

    // Update narrative effect timers
    if (u.cameraFlashTimer > 0) {
      u.cameraFlashTimer = Math.max(0, u.cameraFlashTimer - speedMult);
    }

    // Update mood system
    this.moodManager.updateMood(this.ufo, this.config, speedMult);

    // Update wobble animation
    this.moodManager.updateWobble(this.ufo, speedMult);

    // Update depth (z-axis) for 3D space effect
    this.movementController.updateDepth(this.ufo, speedMult);

    // Update state timer and total time
    u.stateTimer += speedMult;
    u.totalTime += speedMult;

    // Update look around cooldown
    if (u.lookAroundTimer > 0) {
      u.lookAroundTimer -= speedMult;
    }

    // State machine
    switch (u.state) {
      case "entering":
        this.updateEntering(dim, speedMult);
        break;
      case "wandering":
        this.updateWandering(dim, speedMult);
        break;
      case "paused":
        this.updatePaused(speedMult);
        break;
      case "scanning_star":
      case "scanning_ground":
      case "tracking_event":
        this.updateScanning(speedMult);
        break;
      case "chasing":
        this.updateChasing(dim, speedMult);
        break;
      case "giving_up":
        this.updateGivingUp(speedMult);
        break;
      case "collecting_sample":
        this.updateCollectingSample(speedMult);
        break;
      case "photographing":
        this.updatePhotographing(speedMult);
        break;
      case "investigating_ground":
        this.updateInvestigatingGround(speedMult);
        break;
      case "panicking":
        this.updatePanicking(dim, speedMult);
        break;
      case "surfing":
        this.updateSurfing(speedMult);
        break;
      case "communicating":
        this.updateCommunicating(speedMult);
        break;
      case "napping":
        this.updateNapping(speedMult);
        break;
      case "hiding":
      case "peeking":
        this.updatePeekaboo(speedMult);
        break;
      case "celebrating":
        this.updateCelebrating(speedMult);
        break;
      case "following":
        this.updateFollowing(dim, speedMult);
        break;
      case "exiting":
        this.updateExiting(speedMult);
        break;
    }

    // Check if it's time to leave
    if (u.totalTime >= u.activeDuration && u.state !== "exiting") {
      this.startExiting();
    }
  }

  // ============================================================================
  // PUBLIC WOBBLE API
  // ============================================================================

  /**
   * Trigger a wobble animation (public for testing via UFO Lab)
   */
  triggerWobble(type: WobbleType): void {
    if (!this.ufo) return;
    this.moodManager.triggerWobble(this.ufo, type);
  }

  private updateEntering(_dim: Dimensions, _speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    const result = this.entranceAnimator.calculate({
      stateTimer: u.stateTimer,
      enterDuration: this.config.enterDuration,
      entranceType: u.entranceType,
      startY: u.startY,
      targetY: u.targetY,
    });

    u.opacity = result.opacity;
    u.scale = result.scale;
    u.flashIntensity = result.flashIntensity;
    u.y = result.y;

    if (result.isComplete) {
      u.state = "wandering";
      u.stateTimer = 0;
    }
  }

  private updateWandering(dim: Dimensions, speedMult: number): void {
    if (!this.ufo) return;

    const ctx: MovementContext = {
      ufo: this.ufo,
      config: this.config,
      dimensions: dim,
      speedMult,
      moodManager: this.moodManager,
      eventProvider: this.eventProvider,
    };

    const result = this.movementController.updateWandering(ctx);

    switch (result.action) {
      case "arrived_at_target":
        this.arriveAtClickTarget();
        break;
      case "start_pause":
        this.startPause();
        break;
      case "start_chasing":
        this.startChasing(result.event);
        break;
      case "start_tracking":
        this.startTrackingEvent(result.event);
        break;
      // "continue" and "near_miss_handled" - just keep wandering
    }
  }

  /** Calculate shortest angle difference - delegated to movement controller */
  private angleDiff(from: number, to: number): number {
    return this.movementController.angleDiff(from, to);
  }

  private updatePaused(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    // Check for celestial event (can interrupt pause)
    const event = this.eventProvider?.();
    if (event?.active) {
      this.startTrackingEvent(event);
      return;
    }

    if (u.stateTimer >= u.stateDuration) {
      // Pause ended - decide what to do
      this.decideAfterPause();
    }
  }

  private updateScanning(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    // Charge up beam
    if (u.beamIntensity < 1) {
      u.beamIntensity = Math.min(
        1,
        u.beamIntensity + speedMult / this.config.beamChargeFrames
      );
    }

    // Update beam phase for animation
    u.beamPhase += 0.05 * speedMult;

    // Track moving targets - stars drift, so we need to follow them!
    if (u.state === "scanning_star" && u.beamTarget) {
      // Find the star closest to our current target (it may have drifted)
      const trackedStar = this.findStarNearPosition(u.beamTarget.x, u.beamTarget.y);
      if (trackedStar) {
        // Smoothly follow the star as it drifts
        u.beamTarget = { x: trackedStar.x, y: trackedStar.y };
      } else {
        // Lost the star - end scanning
        this.endScanning();
        return;
      }
    }

    // If tracking event (meteor/comet), update target position
    if (u.state === "tracking_event") {
      const event = this.eventProvider?.();
      if (event?.active) {
        u.beamTarget = { x: event.x, y: event.y };
      } else {
        // Event ended - go back to wandering
        this.endScanning();
        return;
      }
    }

    if (u.stateTimer >= u.stateDuration) {
      this.endScanning();
    }
  }

  private updateExiting(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    const result = this.exitAnimator.calculate({
      stateTimer: u.stateTimer,
      exitDuration: this.config.exitDuration,
      exitType: u.exitType,
      currentY: u.y,
      size: u.size,
      speedMult,
    });

    u.opacity = result.opacity;
    u.scale = result.scale;
    u.flashIntensity = result.flashIntensity;
    u.y += result.yDelta;

    if (result.isComplete) {
      this.ufo = null;
    }
  }

  private startPause(): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.state = "paused";
    u.stateTimer = 0;
    u.stateDuration = this.calculationService.randInt(
      this.config.pauseDuration.min,
      this.config.pauseDuration.max
    );
  }

  private decideAfterPause(): void {
    if (!this.ufo) return;
    const u = this.ufo;

    const ctx: DecisionContext = {
      ufo: u,
      config: this.config,
      calculationService: this.calculationService,
      screenHeight: this.dimensions.height,
      findNearbyBrightStar: () => this.findNearbyBrightStar(),
    };

    const decision = this.decisionMaker.decideAfterPause(ctx);

    switch (decision.action) {
      case "nap":
        this.startNapping();
        break;
      case "vibe_longer":
        u.stateTimer = 0;
        u.stateDuration = decision.newDuration;
        if (Math.random() < 0.5) u.isDrifting = true;
        break;
      case "communicate":
        this.startCommunicating(decision.star);
        break;
      case "photograph":
        this.startPhotographing(decision.star);
        break;
      case "scan_star":
        u.state = "scanning_star";
        u.stateTimer = 0;
        u.stateDuration = decision.duration;
        u.beamTarget = { x: decision.star.x, y: decision.star.y };
        u.beamIntensity = 0;
        this.moodManager.markInterest(u);
        this.rememberScannedStar(decision.star.x, decision.star.y);
        break;
      case "investigate_ground":
        this.startInvestigatingGround();
        break;
      case "scan_ground":
        u.state = "scanning_ground";
        u.stateTimer = 0;
        u.stateDuration = decision.duration;
        u.beamTarget = { x: u.x, y: this.dimensions.height + 100 };
        u.beamIntensity = 0;
        break;
      case "resume_wandering":
        this.resumeWandering();
        break;
    }
  }

  private startTrackingEvent(event: EventPosition): void {
    if (!this.ufo) return;

    // Instead of tracking forever, start the sample collection narrative
    // This gives the UFO a clear goal: detect, scan, collect, celebrate
    this.startCollectingSample(event);
  }

  // ============================================================================
  // CHASE BEHAVIOR
  // ============================================================================

  // === Chasing ===
  private startChasing(event: EventPosition): void {
    const ctx = this.createBehaviorContext(1);
    if (ctx) this.behaviorRunner.startChasing(ctx, event);
  }

  private updateChasing(dim: Dimensions, speedMult: number): void {
    const ctx = this.createBehaviorContext(speedMult);
    if (ctx) this.behaviorRunner.updateChasing(ctx);
  }

  // === Giving Up ===
  private startGivingUp(): void {
    const ctx = this.createBehaviorContext(1);
    if (ctx) this.behaviorRunner.startGivingUp(ctx);
  }

  private updateGivingUp(speedMult: number): void {
    const ctx = this.createBehaviorContext(speedMult);
    if (ctx) this.behaviorRunner.updateGivingUp(ctx);
  }

  private endScanning(): void {
    if (!this.ufo) return;
    this.ufo.beamTarget = null;
    this.ufo.beamIntensity = 0;
    this.resumeWandering();
  }

  /**
   * UFO arrived at the location user clicked - scan it!
   */
  private arriveAtClickTarget(): void {
    if (!this.ufo) return;
    const u = this.ufo;

    const target = u.clickTarget;
    u.clickTarget = null; // Clear the target

    if (!target) {
      this.resumeWandering();
      return;
    }

    // Look for a nearby star to scan
    const star = this.findStarNearPosition(target.x, target.y);

    if (star) {
      // Found a star! Scan it
      u.state = "scanning_star";
      u.stateTimer = 0;
      u.stateDuration = this.calculationService.randInt(
        this.config.scanDuration.min,
        this.config.scanDuration.max
      );
      u.beamTarget = { x: star.x, y: star.y };
      u.beamIntensity = 0;
      this.moodManager.markInterest(this.ufo!);
    } else {
      // No star here - do a ground scan
      u.state = "scanning_ground";
      u.stateTimer = 0;
      u.stateDuration = this.calculationService.randInt(
        this.config.scanDuration.min,
        this.config.scanDuration.max
      );
      u.beamTarget = { x: target.x, y: this.dimensions.height + 100 };
      u.beamIntensity = 0;
    }
  }

  private resumeWandering(): void {
    if (!this.ufo) return;
    this.movementController.resetWanderingState(this.ufo, this.config);
  }

  private startExiting(exitType?: UFOExitType): void {
    if (!this.ufo) return;
    const u = this.ufo;

    // Use specified exit type or the one chosen at spawn
    if (exitType) {
      u.exitType = exitType;
    }

    u.state = "exiting";
    u.stateTimer = 0;
    u.beamTarget = null;
    u.beamIntensity = 0;

    // Prepare for specific exit animations
    if (u.exitType === "shootUp") {
      u.startY = u.y;
    }
    if (u.exitType === "warp") {
      u.flashIntensity = 0;
    }
  }

  // Star scanning delegated to IUFOStarScanner
  private findNearbyBrightStar(): StarInfo | null {
    if (!this.starProvider || !this.ufo) return null;
    return this.starScanner.findNearbyBrightStar(this.ufo, this.dimensions, this.starProvider);
  }

  private rememberScannedStar(x: number, y: number): void {
    if (!this.ufo) return;
    this.starScanner.rememberScannedStar(this.ufo, x, y);
  }

  private findStarNearPosition(targetX: number, targetY: number): StarInfo | null {
    if (!this.starProvider) return null;
    return this.starScanner.findStarNearPosition(targetX, targetY, this.starProvider);
  }

  draw(ctx: CanvasRenderingContext2D, a11y: AccessibilitySettings): void {
    if (!this.ufo) return;

    const moodVisuals = this.moodManager.getMoodVisuals(this.ufo, this.config);
    const wobble = this.moodManager.getWobbleOffset(this.ufo);

    // Delegate core rendering to the renderer service
    this.renderer.draw(ctx, this.ufo, this.config, a11y, moodVisuals, wobble);

    // Delegate narrative effects to the particle renderer
    this.particleRenderer.drawNarrativeEffects(ctx, this.ufo, this.config);
  }

  // ============================================================================
  // OLD DRAWING METHODS REMOVED - Now handled by:
  // - IUFORenderer (hull, dome, shield, beam, lights, engine glow)
  // - IUFOParticleRenderer (narrative effects, particles)
  // ============================================================================

  // The following methods have been migrated to extracted services:
  // - drawNarrativeEffects -> UFOParticleRenderer
  // - drawSampleParticle -> UFOParticleRenderer
  // - drawCameraFlash -> UFOParticleRenderer
  // - drawGroundParticles -> UFOParticleRenderer
  // - drawAfterimages -> UFOParticleRenderer
  // - drawSleepZs -> UFOParticleRenderer
  // - drawCelebrationEffects -> UFOParticleRenderer
  // - drawCommunicationPulses -> UFOParticleRenderer
  // - drawWarpFlash -> UFORenderer
  // - drawBeam -> UFORenderer
  // - drawShield -> UFORenderer
  // - drawHull -> UFORenderer
  // - drawDome -> UFORenderer
  // - drawLights -> UFORenderer
  // - drawEngineGlow -> UFORenderer
  // - colorWithAlpha -> UFORenderer (private)

  /**
   * Manually trigger UFO to appear
   * @param dim - Screen dimensions
   * @param entranceType - Optional specific entrance animation
   * @param exitType - Optional specific exit animation (saved for when UFO leaves)
   */
  trigger(
    dim: Dimensions,
    entranceType?: UFOEntranceType,
    exitType?: UFOExitType
  ): void {
    if (!this.ufo) {
      this.dimensions = dim;
      this.spawnUFO(dim, entranceType, exitType);
      this.timer = 0;
    }
  }

  /**
   * Trigger UFO with a specific entrance type
   */
  triggerWithEntrance(dim: Dimensions, entranceType: UFOEntranceType): void {
    // If UFO is already active, force exit then respawn
    if (this.ufo) {
      this.ufo = null;
    }
    this.dimensions = dim;
    this.spawnUFO(dim, entranceType);
    this.timer = 0;
  }

  /**
   * Check if UFO is currently visible
   */
  isActive(): boolean {
    return this.ufo !== null;
  }

  /**
   * Get UFO position for external systems
   */
  getPosition(): { x: number; y: number } | null {
    return this.ufo ? { x: this.ufo.x, y: this.ufo.y } : null;
  }

  /**
   * Get current UFO state for UI display
   */
  getState(): UFOState | null {
    return this.ufo?.state ?? null;
  }

  /**
   * Get current UFO mood for external systems
   */
  getMood(): UFOMood | null {
    return this.ufo?.mood ?? null;
  }

  /**
   * Set UFO mood externally (for click interactions, events, etc.)
   */
  setMood(mood: UFOMood): void {
    if (!this.ufo) return;
    this.moodManager.setMood(this.ufo, mood);
  }

  /**
   * Get UFO tiredness level (0-1)
   */
  getTiredness(): number | null {
    return this.ufo?.tiredness ?? null;
  }

  /**
   * Reset UFO tiredness to 0 (for testing)
   */
  resetTiredness(): void {
    if (this.ufo) {
      this.ufo.tiredness = 0;
    }
  }

  /**
   * Get count of scanned stars in UFO's memory
   */
  getScannedStarsCount(): number {
    return this.ufo?.scannedStars.size ?? 0;
  }

  /**
   * Clear UFO's memory of scanned stars
   */
  clearScannedStars(): void {
    if (this.ufo) {
      this.ufo.scannedStars.clear();
    }
  }

  /**
   * Get UFO heading in radians
   */
  getHeading(): number | null {
    return this.ufo?.heading ?? null;
  }

  // ============================================================================
  // NARRATIVE ARC BEHAVIORS - Delegated to IUFOBehaviorRunner
  // ============================================================================

  private updateCollectingSample(speedMult: number): void {
    const ctx = this.createBehaviorContext(speedMult);
    if (ctx) this.behaviorRunner.updateCollectingSample(ctx);
  }

  private startCollectingSample(event: EventPosition): void {
    const ctx = this.createBehaviorContext(1);
    if (ctx) this.behaviorRunner.startCollectingSample(ctx, event);
  }

  private updatePhotographing(speedMult: number): void {
    const ctx = this.createBehaviorContext(speedMult);
    if (ctx) this.behaviorRunner.updatePhotographing(ctx);
  }

  private startPhotographing(star: StarInfo): void {
    const ctx = this.createBehaviorContext(1);
    if (ctx) this.behaviorRunner.startPhotographing(ctx, star);
  }

  private updateInvestigatingGround(speedMult: number): void {
    const ctx = this.createBehaviorContext(speedMult);
    if (ctx) this.behaviorRunner.updateInvestigatingGround(ctx);
  }

  private startInvestigatingGround(): void {
    const ctx = this.createBehaviorContext(1);
    if (ctx) this.behaviorRunner.startInvestigatingGround(ctx);
  }

  private updatePanicking(dim: Dimensions, speedMult: number): void {
    const ctx = this.createBehaviorContext(speedMult);
    if (ctx) this.behaviorRunner.updatePanicking(ctx);
  }

  private startPanicking(fromX: number, fromY: number): void {
    const ctx = this.createBehaviorContext(1);
    if (ctx) this.behaviorRunner.startPanicking(ctx, fromX, fromY);
  }

  // === Comet Surfing ===
  private updateSurfing(speedMult: number): void {
    const ctx = this.createBehaviorContext(speedMult);
    if (ctx) this.behaviorRunner.updateSurfing(ctx);
  }

  private startSurfing(event: EventPosition): void {
    const ctx = this.createBehaviorContext(1);
    if (ctx) this.behaviorRunner.startSurfing(ctx, event);
  }

  // === Communication ===
  private updateCommunicating(speedMult: number): void {
    const ctx = this.createBehaviorContext(speedMult);
    if (ctx) this.behaviorRunner.updateCommunicating(ctx);
  }

  private startCommunicating(star: StarInfo): void {
    const ctx = this.createBehaviorContext(1);
    if (ctx) this.behaviorRunner.startCommunicating(ctx, star);
  }

  // === Napping ===
  private updateNapping(speedMult: number): void {
    const ctx = this.createBehaviorContext(speedMult);
    if (ctx) this.behaviorRunner.updateNapping(ctx);
  }

  private startNapping(): void {
    const ctx = this.createBehaviorContext(1);
    if (ctx) this.behaviorRunner.startNapping(ctx);
  }

  // === Peekaboo (hiding/peeking) ===
  private updatePeekaboo(speedMult: number): void {
    const ctx = this.createBehaviorContext(speedMult);
    if (ctx) this.behaviorRunner.updatePeekaboo(ctx);
  }

  private startHiding(): void {
    const ctx = this.createBehaviorContext(1);
    if (ctx) this.behaviorRunner.startHiding(ctx);
  }

  // === Celebrating ===
  private updateCelebrating(speedMult: number): void {
    const ctx = this.createBehaviorContext(speedMult);
    if (ctx) this.behaviorRunner.updateCelebrating(ctx);
  }

  private startCelebrating(): void {
    const ctx = this.createBehaviorContext(1);
    if (ctx) this.behaviorRunner.startCelebrating(ctx);
  }

  // === Following ===
  private updateFollowing(dim: Dimensions, speedMult: number): void {
    const ctx = this.createBehaviorContext(speedMult);
    if (ctx) this.behaviorRunner.updateFollowing(ctx);
  }

  private startFollowing(event: EventPosition): void {
    const ctx = this.createBehaviorContext(1);
    if (ctx) this.behaviorRunner.startFollowing(ctx, event);
  }

  // ============================================================================
  // CLICK INTERACTION
  // ============================================================================

  /**
   * Handle a click on the canvas - UFO reacts based on distance and mood
   * @param clickX - Click X position in canvas coordinates
   * @param clickY - Click Y position in canvas coordinates
   * @returns true if UFO reacted to the click
   */
  handleClick(clickX: number, clickY: number): boolean {
    if (!this.ufo) return false;
    if (this.ufo.state === "entering" || this.ufo.state === "exiting") return false;

    const u = this.ufo;
    const dx = clickX - u.x;
    const dy = clickY - u.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check click timing for consecutive clicks
    const timeSinceLastClick = u.totalTime - u.lastClickTime;
    const isConsecutiveClick = timeSinceLastClick < 180; // ~3 seconds at 60fps

    // Hit zones
    const directHitRadius = u.size * 1.5;
    const nearMissRadius = u.size * 4;

    if (distance <= directHitRadius) {
      // DIRECT HIT - UFO was clicked!
      return this.handleDirectHit(isConsecutiveClick);
    } else if (distance <= nearMissRadius) {
      // NEAR MISS - Click was close
      return this.handleNearMiss(clickX, clickY);
    } else {
      // FAR CLICK - UFO might investigate
      return this.handleFarClick(clickX, clickY);
    }
  }

  // ============================================================================
  // INTERACTION HANDLING - Delegated to IUFOInteractionHandler
  // ============================================================================

  private handleDirectHit(isConsecutive: boolean): boolean {
    if (!this.ufo) return false;
    const result = this.interactionHandler.handleDirectHit(
      this.ufo,
      isConsecutive,
      this.moodManager,
      this.stateCallbacks
    );
    return result.handled;
  }

  private handleNearMiss(clickX: number, clickY: number): boolean {
    if (!this.ufo) return false;
    const result = this.interactionHandler.handleNearMiss(
      this.ufo,
      clickX,
      clickY,
      this.moodManager
    );
    return result.handled;
  }

  private handleFarClick(clickX: number, clickY: number): boolean {
    if (!this.ufo) return false;
    const result = this.interactionHandler.handleFarClick(
      this.ufo,
      clickX,
      clickY,
      this.moodManager
    );
    return result.handled;
  }

  // ============================================================================
  // COMMAND METHODS - For manual control via UI
  // ============================================================================

  /**
   * Command UFO to scan a nearby star
   */
  commandScanStar(): boolean {
    if (!this.ufo) return false;

    const star = this.findNearbyBrightStar();
    if (star) {
      this.ufo.state = "scanning_star";
      this.ufo.stateTimer = 0;
      this.ufo.stateDuration = this.calculationService.randInt(
        this.config.scanDuration.min,
        this.config.scanDuration.max
      );
      this.ufo.beamTarget = { x: star.x, y: star.y };
      this.ufo.beamIntensity = 0;
      this.moodManager.markInterest(this.ufo!); // Found something to scan!
      return true;
    }
    return false; // No star nearby to scan
  }

  /**
   * Command UFO to scan the ground below
   */
  commandScanGround(): void {
    if (!this.ufo) return;

    this.ufo.state = "scanning_ground";
    this.ufo.stateTimer = 0;
    this.ufo.stateDuration = this.calculationService.randInt(
      this.config.scanDuration.min,
      this.config.scanDuration.max
    );
    this.ufo.beamTarget = { x: this.ufo.x, y: this.dimensions.height + 100 };
    this.ufo.beamIntensity = 0;
  }

  /**
   * Command UFO to pause and chill
   */
  commandPause(): void {
    if (!this.ufo) return;

    this.ufo.state = "paused";
    this.ufo.stateTimer = 0;
    this.ufo.stateDuration = this.calculationService.randInt(
      this.config.pauseDuration.min,
      this.config.pauseDuration.max
    );
    this.ufo.beamTarget = null;
    this.ufo.beamIntensity = 0;
  }

  /**
   * Command UFO to wander around
   */
  commandWander(): void {
    if (!this.ufo) return;

    this.resumeWandering();
  }

  /**
   * Command UFO to drift lazily
   */
  commandDrift(): void {
    if (!this.ufo) return;

    this.ufo.state = "wandering";
    this.ufo.stateTimer = 0;
    this.ufo.isDrifting = true;
    // Set a gentle turn rate for lazy curved drifting
    const turnSpeed = this.config.turnSpeed ?? 0.003;
    const turnVariation = this.config.turnVariation ?? 0.5;
    this.ufo.turnRate = (Math.random() - 0.5) * turnSpeed * turnVariation;
  }

  /**
   * Command UFO to leave with its preset exit type
   */
  commandExit(): void {
    if (!this.ufo) return;
    this.startExiting();
  }

  /**
   * Command UFO to leave with a specific exit animation
   */
  commandExitWith(exitType: UFOExitType): void {
    if (!this.ufo) return;
    this.startExiting(exitType);
  }

  /**
   * Get current entrance/exit types for UI display
   */
  getEntranceExitTypes(): {
    entrance: UFOEntranceType;
    exit: UFOExitType;
  } | null {
    if (!this.ufo) return null;
    return {
      entrance: this.ufo.entranceType,
      exit: this.ufo.exitType,
    };
  }

  /**
   * Get all available entrance types
   */
  getAvailableEntranceTypes(): UFOEntranceType[] {
    return [...this.entranceTypes];
  }

  /**
   * Get all available exit types
   */
  getAvailableExitTypes(): UFOExitType[] {
    return [...this.exitTypes];
  }

  cleanup(): void {
    this.ufo = null;
    this.timer = 0;
  }
}
