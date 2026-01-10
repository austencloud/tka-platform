/**
 * UFOSystem - Intelligent Wandering UFO Easter Egg
 *
 * A rare visitor that explores the night sky with curiosity and purpose.
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
    behaviorRunner: IUFOBehaviorRunner
  ) {
    this.config = config;
    this.calculationService = calculationService;
    this.renderer = renderer;
    this.particleRenderer = particleRenderer;
    this.moodManager = moodManager;
    this.starScanner = starScanner;
    this.interactionHandler = interactionHandler;
    this.behaviorRunner = behaviorRunner;

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
    const margin = dim.width * this.config.bounceMargin * 1.5;

    // Pick random entrance/exit types if not specified
    const entrance =
      entranceType ??
      this.entranceTypes[Math.floor(Math.random() * this.entranceTypes.length)]!;
    const exit =
      exitType ??
      this.exitTypes[Math.floor(Math.random() * this.exitTypes.length)]!;

    // Position depends on entrance type
    let x: number;
    let y: number;
    let startY = 0;
    let targetY = 0;

    if (entrance === "descend") {
      // Start above screen, descend to random position
      x = margin + Math.random() * (dim.width - margin * 2);
      targetY = margin + Math.random() * (dim.height * 0.5 - margin); // Upper half
      startY = -this.config.size * 2;
      y = startY;
    } else {
      // All other entrances: random position in viewable area
      x = margin + Math.random() * (dim.width - margin * 2);
      y = margin + Math.random() * (dim.height - margin * 2);
      targetY = y;
      startY = y;
    }

    // Random initial heading
    const heading = Math.random() * Math.PI * 2;

    // Random initial turn rate for curved movement
    const turnSpeed = this.config.turnSpeed ?? 0.003;
    const turnVariation = this.config.turnVariation ?? 0.5;
    const turnRate = (Math.random() - 0.5) * 2 * turnSpeed * turnVariation;

    const activeDuration = this.calculationService.randInt(
      this.config.minActiveDuration,
      this.config.maxActiveDuration
    );

    // Decide initial movement style
    const startsDrifting = Math.random() < (this.config.driftChance ?? 0.15);

    // Initial state based on entrance type
    let initialOpacity = 0;
    let initialScale = 1;

    if (entrance === "warp") {
      // Warp: start invisible, flash in
      initialOpacity = 0;
      initialScale = 1;
    } else if (entrance === "zoom") {
      // Zoom: start tiny and distant
      initialOpacity = 0.5;
      initialScale = 0.05;
    } else if (entrance === "descend") {
      // Descend: start visible, move down
      initialOpacity = 0.8;
      initialScale = 1;
    } else {
      // Fade: simple opacity fade
      initialOpacity = 0;
      initialScale = 1;
    }

    this.ufo = {
      x,
      y,
      heading,
      turnRate,
      state: "entering",
      stateTimer: 0,
      stateDuration: this.config.enterDuration,
      activeDuration,
      totalTime: 0,
      entranceType: entrance,
      exitType: exit,
      targetY,
      startY,
      flashIntensity: entrance === "warp" ? 1 : 0,
      decloakPhase: 0,
      shieldPhase: 0,
      lightPhase: 0,
      beamPhase: 0,
      hoverPhase: Math.random() * Math.PI * 2,
      isDrifting: startsDrifting,
      beamTarget: null,
      beamIntensity: 0,
      opacity: initialOpacity,
      scale: initialScale,
      size: this.config.size,
      // Mood system - start curious and fresh
      mood: "curious",
      moodTimer: 0,
      tiredness: 0,
      lastInterestTime: 0,
      // Click interaction - fresh start
      lastClickTime: -9999, // Long ago, so first click doesn't count as consecutive
      clickCount: 0,
      clickTarget: null,
      // Chase behavior - not chasing yet
      chaseTarget: null,
      chaseStartTime: 0,
      lastChaseDistance: Infinity,
      giveUpTimer: 0,
      // Idle animations / personality
      wobbleType: "none",
      wobbleTimer: 0,
      wobbleIntensity: 0,
      spinAngle: 0,
      isSneaky: false,
      scannedStars: new Set<string>(),
      lookAroundTimer: 0,

      // Narrative arc system
      narrativePhase: "none",
      narrativeTimer: 0,
      narrativePhaseDuration: 0,

      // Sample collection
      sampleParticle: null,
      collectedSamples: 0,

      // Star photography
      photographedStars: new Set<string>(),
      cameraFlashTimer: 0,
      photoTarget: null,

      // Ground investigation
      groundParticles: [],
      anomalyPosition: null,

      // Panic / evasion
      panicDirection: 0,
      panicSpeed: 0,
      afterimagePositions: [],

      // Comet surfing
      surfTarget: null,
      surfOffset: { x: 0, y: 0 },

      // Communication
      commPattern: [],
      commPatternIndex: 0,
      commPulseTimer: 0,
      commTarget: null,
      awaitingResponse: false,

      // Napping
      sleepZs: [],
      napStartY: y,

      // Peek-a-boo
      hidePosition: null,
      peekProgress: 0,
      peekDirection: 0,

      // Celebration
      celebrationSpinSpeed: 0,
      celebrationBouncePhase: 0,
      rainbowPhase: 0,

      // Buddy system
      buddyTarget: null,
      buddyOffset: 50,

      // Rare discovery tracking
      rareDiscoveries: 0,
    };
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

  private updateEntering(dim: Dimensions, speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    const progress = Math.min(1, u.stateTimer / this.config.enterDuration);

    switch (u.entranceType) {
      case "warp":
        // Warp: bright flash then instant appear
        if (progress < 0.3) {
          // Flash phase - bright shield pulse
          u.flashIntensity = 1 - progress / 0.3;
          u.opacity = progress / 0.3;
          u.scale = 0.8 + 0.4 * (progress / 0.3); // Slight scale pulse
        } else {
          // Settle phase
          u.flashIntensity = 0;
          u.opacity = 1;
          u.scale = 1.2 - 0.2 * ((progress - 0.3) / 0.7); // Shrink back to normal
        }
        break;

      case "zoom":
        // Zoom: approach from far away (tiny to full size)
        // Ease-out for deceleration effect
        const zoomEase = 1 - Math.pow(1 - progress, 3);
        u.scale = 0.05 + 0.95 * zoomEase;
        u.opacity = 0.5 + 0.5 * zoomEase;
        break;

      case "descend":
        // Descend: drop down from above, slowing as it arrives
        const descendEase = 1 - Math.pow(1 - progress, 2); // Ease-out
        u.y = u.startY + (u.targetY - u.startY) * descendEase;
        u.opacity = 0.8 + 0.2 * progress;
        u.scale = 1;
        break;

      case "fade":
      default:
        // Simple fade in
        u.opacity = progress;
        u.scale = 1;
        break;
    }

    // Transition to wandering once complete
    if (progress >= 1) {
      u.opacity = 1;
      u.scale = 1;
      u.flashIntensity = 0;
      u.state = "wandering";
      u.stateTimer = 0;
    }
  }

  private updateWandering(dim: Dimensions, speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    // Check if we're heading toward a click target
    if (u.clickTarget) {
      const dx = u.clickTarget.x - u.x;
      const dy = u.clickTarget.y - u.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 30) {
        // Arrived at click target! Scan it.
        this.arriveAtClickTarget();
        return;
      }

      // Steer toward click target
      const targetAngle = Math.atan2(dy, dx);
      const angleDiff = this.angleDiff(u.heading, targetAngle);
      u.heading += angleDiff * 0.1 * speedMult; // Gradual steering
    } else {
      // Normal wandering - smoothly update heading for curved movement
      const turnSpeed = this.config.turnSpeed ?? 0.003;
      u.heading += u.turnRate * speedMult;

      // Occasionally vary the turn rate for more organic curves
      if (Math.random() < 0.02 * speedMult) {
        const turnVariation = this.config.turnVariation ?? 0.5;
        u.turnRate = (Math.random() - 0.5) * 2 * turnSpeed * turnVariation;

        // Small chance to switch drift mode
        if (Math.random() < 0.15) {
          u.isDrifting = !u.isDrifting;
        }
      }
    }

    // Calculate speed (slower when drifting, faster when investigating)
    const driftMult = this.config.driftSpeedMultiplier ?? 0.4;
    const investigateMult = u.clickTarget ? 1.3 : 1.0; // Bit faster when investigating
    const speedMod = u.isDrifting ? driftMult : investigateMult;
    const speed = this.config.speed * dim.width * speedMult * speedMod;

    // Move in direction of heading (curved path)
    u.x += Math.cos(u.heading) * speed;
    u.y += Math.sin(u.heading) * speed;

    // Gently steer away from edges (creates natural curved boundaries)
    const margin = dim.width * this.config.bounceMargin;
    const steerStrength = 0.05;

    if (u.x < margin) {
      // Steer right
      u.heading += steerStrength * speedMult;
      u.x = Math.max(margin * 0.5, u.x);
    } else if (u.x > dim.width - margin) {
      // Steer left
      u.heading -= steerStrength * speedMult;
      u.x = Math.min(dim.width - margin * 0.5, u.x);
    }

    if (u.y < margin) {
      // Steer down
      const targetAngle = Math.PI / 2; // Down
      const diff = this.angleDiff(u.heading, targetAngle);
      u.heading += diff * steerStrength * speedMult;
      u.y = Math.max(margin * 0.5, u.y);
    } else if (u.y > dim.height - margin) {
      // Steer up
      const targetAngle = -Math.PI / 2; // Up
      const diff = this.angleDiff(u.heading, targetAngle);
      u.heading += diff * steerStrength * speedMult;
      u.y = Math.min(dim.height - margin * 0.5, u.y);
    }

    // Check for celestial event
    const event = this.eventProvider?.();
    if (event?.active) {
      // Check for near-miss (meteor passing very close - startle!)
      const dx = event.x - u.x;
      const dy = event.y - u.y;
      const eventDist = Math.sqrt(dx * dx + dy * dy);

      if (eventDist < 50) {
        // TOO CLOSE! Startle and dodge!
        this.reactToNearMiss(event);
        return;
      }

      // Decide whether to chase or just watch based on mood
      if (u.mood === "curious" || u.mood === "excited" || u.mood === "playful") {
        // Chase the celestial event!
        this.startChasing(event);
        return;
      } else if (u.mood === "bored" || u.mood === "tired") {
        // Just watch passively (track with beam briefly)
        this.startTrackingEvent(event);
        return;
      }
    }

    // Occasional pause to look around
    if (Math.random() < this.config.pauseChance * speedMult) {
      this.startPause();
    }

    // Idle behavior: Look around occasionally
    if (u.lookAroundTimer <= 0 && Math.random() < 0.003 * speedMult) {
      this.moodManager.triggerWobble(this.ufo,"curious_tilt");
      u.lookAroundTimer = 180; // Cooldown before next look-around
    }

    // Idle behavior: Yawn when bored
    if (u.mood === "bored" && Math.random() < 0.002 * speedMult) {
      this.moodManager.triggerWobble(this.ufo,"yawn_stretch");
      // Dim lights during yawn (handled by mood visuals)
    }
  }

  /**
   * React to a near-miss - something passed too close!
   */
  private reactToNearMiss(event: EventPosition): void {
    if (!this.ufo) return;
    const u = this.ufo;

    // Calculate dodge direction (opposite to event)
    const dx = u.x - event.x;
    const dy = u.y - event.y;
    const dodgeAngle = Math.atan2(dy, dx);

    // Jolt away
    u.heading = dodgeAngle;
    u.x += Math.cos(dodgeAngle) * 15; // Quick dodge
    u.y += Math.sin(dodgeAngle) * 15;

    // Startled jolt wobble
    this.moodManager.triggerWobble(this.ufo,"startled_jolt");

    // Enter startled mood
    this.moodManager.setMood(this.ufo!,"startled");

    // Quick flash of lights (acceleration)
    u.lightPhase += Math.PI;

    // Stay in wandering but with startled mood
    // (mood decay will return to curious)
  }

  /** Calculate shortest angle difference - delegated to interaction handler */
  private angleDiff(from: number, to: number): number {
    return this.interactionHandler.angleDiff(from, to);
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

    const progress = Math.min(1, u.stateTimer / this.config.exitDuration);

    switch (u.exitType) {
      case "warp":
        // Warp out: flash bright then vanish instantly
        if (progress < 0.4) {
          // Charge-up phase - shield brightens
          u.flashIntensity = progress / 0.4;
          u.opacity = 1;
          u.scale = 1 + 0.2 * (progress / 0.4); // Slight grow
        } else if (progress < 0.5) {
          // Flash peak
          u.flashIntensity = 1;
          u.opacity = 1;
          u.scale = 1.2;
        } else {
          // Instant vanish after flash
          u.opacity = 0;
          u.flashIntensity = Math.max(0, 1 - (progress - 0.5) / 0.5);
        }
        break;

      case "zoom":
        // Zoom away: rapidly shrink to dot and vanish
        // Ease-in for acceleration effect
        const zoomEase = Math.pow(progress, 2);
        u.scale = Math.max(0, 1 - zoomEase);
        u.opacity = Math.max(0, 1 - zoomEase * 0.8);
        // Slight upward drift as it flies away
        u.y -= 2 * speedMult;
        break;

      case "shootUp":
        // Shoot up: rapid acceleration upward, leaves screen
        // Quadratic acceleration
        const shootSpeed = progress * progress * 25 * speedMult;
        u.y -= shootSpeed;
        u.opacity = u.y > -u.size * 2 ? 1 : 0;
        u.scale = 1;
        break;

      case "fade":
      default:
        // Simple fade out
        u.opacity = Math.max(0, 1 - progress);
        u.scale = 1;
        break;
    }

    // Check if exit is complete
    const exitComplete =
      progress >= 1 ||
      (u.exitType === "shootUp" && u.y < -u.size * 2) ||
      (u.exitType === "warp" && progress >= 0.6);

    if (exitComplete) {
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

    // If tired, might take a nap
    if (u.mood === "tired" && Math.random() < 0.4) {
      this.startNapping();
      return;
    }

    // Sometimes the alien just wants to vibe - no scanning, just chill longer
    const justVibeChance = this.config.justVibeChance ?? 0.3;
    if (Math.random() < justVibeChance) {
      // Keep paused state, but reset timer for another rest
      u.stateTimer = 0;
      u.stateDuration = this.calculationService.randInt(
        this.config.pauseDuration.min,
        this.config.pauseDuration.max
      );
      // Maybe switch drift mode while vibing
      if (Math.random() < 0.5) {
        u.isDrifting = true; // Get extra lazy after vibing
      }
      return;
    }

    // Check for nearby bright star - decide how to interact based on mood
    if (Math.random() < this.config.scanStarChance) {
      const star = this.findNearbyBrightStar();
      if (star) {
        // Choose interaction style based on mood and randomness
        const roll = Math.random();

        if (u.mood === "playful" && roll < 0.3) {
          // Try to communicate with the star!
          this.startCommunicating(star);
        } else if ((u.mood === "curious" || u.mood === "bored") && roll < 0.4) {
          // Take a photo of the star (tourist mode)
          this.startPhotographing(star);
        } else {
          // Default: just scan the star
          u.state = "scanning_star";
          u.stateTimer = 0;
          u.stateDuration = this.calculationService.randInt(
            this.config.scanDuration.min,
            this.config.scanDuration.max
          );
          u.beamTarget = { x: star.x, y: star.y };
          u.beamIntensity = 0;
          this.moodManager.markInterest(this.ufo!);
          this.rememberScannedStar(star.x, star.y);
        }
        return;
      }
    }

    // Ground observation - what's down there?
    if (Math.random() < this.config.groundScanChance) {
      // Sometimes investigate ground more thoroughly with particles
      if (Math.random() < 0.4) {
        this.startInvestigatingGround();
      } else {
        // Simple ground scan
        u.state = "scanning_ground";
        u.stateTimer = 0;
        u.stateDuration = this.calculationService.randInt(
          this.config.scanDuration.min,
          this.config.scanDuration.max
        );
        u.beamTarget = { x: u.x, y: this.dimensions.height + 100 };
        u.beamIntensity = 0;
      }
      return;
    }

    // Alright, time to wander again (maybe lazily)
    this.resumeWandering();
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
    const u = this.ufo;

    u.state = "wandering";
    u.stateTimer = 0;

    // Give a new random turn rate for variety in curve direction
    const turnSpeed = this.config.turnSpeed ?? 0.003;
    const turnVariation = this.config.turnVariation ?? 0.5;
    u.turnRate = (Math.random() - 0.5) * 2 * turnSpeed * turnVariation;

    // Decide movement style
    const driftChance = this.config.driftChance ?? 0.15;
    u.isDrifting = Math.random() < driftChance;
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
