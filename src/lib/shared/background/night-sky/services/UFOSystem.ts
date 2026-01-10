/**
 * UFOSystem - Intelligent Wandering UFO Easter Egg
 *
 * A rare visitor that explores the night sky with curiosity and purpose.
 * Features:
 * - Wandering behavior with pauses and direction changes
 * - Intelligent tractor beam that scans stars, tracks celestial events, or observes ground
 * - Procedural rendering with shield glow, metallic hull, glass dome, and rim lights
 * - State machine controlling behavior transitions
 */

import type { AccessibilitySettings } from "../../shared/domain/models/background-models";
import type {
  Dimensions,
  QualityLevel,
} from "../../shared/domain/types/background-types";
import type { INightSkyCalculationService } from "./contracts/INightSkyCalculationService";

/** Visual modifiers for each mood state */
interface MoodVisuals {
  lightSpeed: number;
  bobDepth: number;
  shieldBrightness: number;
}

export interface UFOConfig {
  size: number;
  colors: {
    hull: string;
    hullDark: string;
    dome: string;
    domeHighlight: string;
    shield: string;
    beam: string;
    beamGlow: string;
    lights: string[];
  };
  speed: number;
  bounceMargin: number;
  // Curved exploration movement
  turnSpeed?: number; // How fast it changes direction (creates curves)
  turnVariation?: number; // Random variation in turn rate
  driftChance?: number;
  driftSpeedMultiplier?: number;
  // Timing
  interval: number;
  enterDuration: number;
  exitDuration: number;
  minActiveDuration: number;
  maxActiveDuration: number;
  // Behavior
  pauseChance: number;
  pauseDuration: { min: number; max: number };
  scanStarChance: number;
  groundScanChance: number;
  justVibeChance?: number; // Chance to just chill without scanning
  scanDuration: { min: number; max: number };
  beamChargeFrames: number;
  // Animation
  shieldPulseSpeed: number;
  lightChaseSpeed: number;
  hoverBobSpeed: number;
  hoverBobAmount: number;
  // Mood system
  mood?: {
    excitedDecay: number;
    startledDecay: number;
    playfulDecay: number;
    boredThreshold: number;
    tirednessRate: number;
    tiredThreshold: number;
    moodVisuals: Record<UFOMood, MoodVisuals>;
  };
  enabledOnQuality: QualityLevel[];
}

type UFOState =
  | "entering"
  | "wandering"
  | "paused"
  | "scanning_star"
  | "scanning_ground"
  | "tracking_event"
  | "chasing" // Pursuing a meteor/comet
  | "giving_up" // Slowing down after failed chase
  | "exiting"
  | "inactive";

/** UFO emotional state - affects behavior and visuals */
export type UFOMood =
  | "curious" // Default - investigating things
  | "excited" // Found something rare, successful catch
  | "bored" // Nothing interesting, been idle
  | "startled" // Something surprised it
  | "playful" // User interaction, having fun
  | "tired"; // Been active too long

/** How the UFO appears */
export type UFOEntranceType = "fade" | "warp" | "zoom" | "descend";

/** How the UFO leaves */
export type UFOExitType = "fade" | "warp" | "zoom" | "shootUp";

/** Wobble animation types for personality */
export type WobbleType =
  | "none"
  | "curious_tilt" // Leaning toward interest
  | "startled_jolt" // Quick shake, slight jump
  | "disappointed_shake" // Side-to-side like shaking head
  | "happy_bounce" // Quick up-down pulse
  | "yawn_stretch"; // Bored stretch animation

interface UFO {
  // Position (in pixels)
  x: number;
  y: number;
  // Movement - using heading angle for smooth curved paths
  heading: number; // Current direction in radians
  turnRate: number; // Current turning speed (changes over time for variety)

  // State machine
  state: UFOState;
  stateTimer: number;
  stateDuration: number;
  activeDuration: number; // Total time UFO will stay active
  totalTime: number; // Total time since spawn (for exit timing)

  // Entrance/exit behavior
  entranceType: UFOEntranceType;
  exitType: UFOExitType;
  targetY: number; // For descend entrance - where to stop
  startY: number; // For descend/shootUp - where started
  flashIntensity: number; // For warp effects (0-1)
  decloakPhase: number; // Reserved for future shimmer effects

  // Animation phases (independent for organic feel)
  shieldPhase: number;
  lightPhase: number;
  beamPhase: number;
  hoverPhase: number;

  // Movement style
  isDrifting: boolean; // When true, moves slower

  // Beam targeting
  beamTarget: { x: number; y: number } | null;
  beamIntensity: number; // 0-1, for charge-up effect

  // Lifecycle
  opacity: number;
  scale: number; // For zoom effects (0-1)
  size: number;

  // Mood system
  mood: UFOMood;
  moodTimer: number; // Time in current mood (for decay)
  tiredness: number; // Accumulates over lifetime (0-1), doesn't reset
  lastInterestTime: number; // When something interesting last happened

  // Click interaction tracking
  lastClickTime: number; // Frame when last clicked
  clickCount: number; // Consecutive clicks for escalating response
  clickTarget: { x: number; y: number } | null; // Where to investigate after far click

  // Chase behavior
  chaseTarget: { x: number; y: number; vx: number; vy: number } | null; // Target with velocity
  chaseStartTime: number; // When chase started
  lastChaseDistance: number; // Previous distance to target (to detect giving up)
  giveUpTimer: number; // Countdown during giving_up state

  // Idle animations / personality
  wobbleType: WobbleType;
  wobbleTimer: number; // Progress through wobble animation
  wobbleIntensity: number; // How intense the current wobble is (0-1)
  spinAngle: number; // For happy spin animation
  isSneaky: boolean; // Sneaky approach mode
  scannedStars: Set<string>; // Memory of recently scanned star positions
  lookAroundTimer: number; // Cooldown for look-around behavior
}

/** External star data for beam targeting */
interface StarInfo {
  x: number;
  y: number;
  brightness: number;
}

/** External event position for tracking */
interface EventPosition {
  x: number;
  y: number;
  vx?: number; // Velocity X for chase calculations
  vy?: number; // Velocity Y for chase calculations
  active: boolean;
}

export class UFOSystem {
  private ufo: UFO | null = null;
  private timer: number = 0;
  private config: UFOConfig;
  private calculationService: INightSkyCalculationService;
  private quality: QualityLevel = "high";
  private dimensions: Dimensions = { width: 1920, height: 1080 };

  // External references for intelligent beam (set by NightSkyBackgroundSystem)
  private starProvider: (() => StarInfo[]) | null = null;
  private eventProvider: (() => EventPosition | null) | null = null;

  constructor(
    config: UFOConfig,
    calculationService: INightSkyCalculationService
  ) {
    this.config = config;
    this.calculationService = calculationService;
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
    };
  }

  private updateUFO(dim: Dimensions, speedMult: number): void {
    if (!this.ufo) return;

    const u = this.ufo;

    // Get mood-based visual modifiers
    const moodVisuals = this.getMoodVisuals();

    // Update animation phases with mood modifiers
    u.shieldPhase += this.config.shieldPulseSpeed * speedMult;
    u.lightPhase += this.config.lightChaseSpeed * speedMult * moodVisuals.lightSpeed;
    u.hoverPhase += this.config.hoverBobSpeed * speedMult;

    // Update mood system
    this.updateMood(speedMult);

    // Update wobble animation
    this.updateWobble(speedMult);

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
      case "exiting":
        this.updateExiting(speedMult);
        break;
    }

    // Check if it's time to leave
    if (u.totalTime >= u.activeDuration && u.state !== "exiting") {
      this.startExiting();
    }
  }

  /**
   * Update the UFO's emotional state
   * Handles mood decay, tiredness accumulation, and bored detection
   */
  private updateMood(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;
    const moodConfig = this.config.mood;
    if (!moodConfig) return;

    // Increment mood timer
    u.moodTimer += speedMult;

    // Accumulate tiredness over lifetime (never resets)
    u.tiredness = Math.min(1, u.tiredness + moodConfig.tirednessRate * speedMult);

    // Check for tired mood (overrides other moods when very tired)
    if (u.tiredness > moodConfig.tiredThreshold && u.mood !== "tired") {
      u.mood = "tired";
      u.moodTimer = 0;
      return;
    }

    // Handle mood-specific decay back to curious
    switch (u.mood) {
      case "excited":
        if (u.moodTimer >= moodConfig.excitedDecay) {
          u.mood = "curious";
          u.moodTimer = 0;
        }
        break;

      case "startled":
        if (u.moodTimer >= moodConfig.startledDecay) {
          u.mood = "curious";
          u.moodTimer = 0;
        }
        break;

      case "playful":
        if (u.moodTimer >= moodConfig.playfulDecay) {
          u.mood = "curious";
          u.moodTimer = 0;
        }
        break;

      case "bored":
        // Bored can transition back to curious if something interesting happens
        // (handled externally via setMood when interest is triggered)
        break;

      case "curious":
        // Check if UFO has been uninterested for too long → become bored
        const timeSinceInterest = u.totalTime - u.lastInterestTime;
        if (timeSinceInterest >= moodConfig.boredThreshold) {
          u.mood = "bored";
          u.moodTimer = 0;
        }
        break;

      case "tired":
        // Tired is permanent for this visit - UFO will leave soon
        break;
    }
  }

  /**
   * Get visual modifiers based on current mood
   */
  private getMoodVisuals(): MoodVisuals {
    if (!this.ufo || !this.config.mood) {
      // Default neutral values
      return { lightSpeed: 1.0, bobDepth: 1.0, shieldBrightness: 1.0 };
    }

    return (
      this.config.mood.moodVisuals[this.ufo.mood] ?? {
        lightSpeed: 1.0,
        bobDepth: 1.0,
        shieldBrightness: 1.0,
      }
    );
  }

  /**
   * Mark that something interesting happened (resets bored timer)
   */
  private markInterest(): void {
    if (!this.ufo) return;
    this.ufo.lastInterestTime = this.ufo.totalTime;

    // If bored, snap back to curious
    if (this.ufo.mood === "bored") {
      this.ufo.mood = "curious";
      this.ufo.moodTimer = 0;
    }
  }

  // ============================================================================
  // WOBBLE & IDLE ANIMATIONS
  // ============================================================================

  /**
   * Update wobble animation progress
   */
  private updateWobble(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    if (u.wobbleType === "none") return;

    u.wobbleTimer += speedMult;

    // Wobble durations (frames)
    const wobbleDurations: Record<WobbleType, number> = {
      none: 0,
      curious_tilt: 30,
      startled_jolt: 20,
      disappointed_shake: 45,
      happy_bounce: 25,
      yawn_stretch: 90,
    };

    const duration = wobbleDurations[u.wobbleType];

    if (u.wobbleTimer >= duration) {
      // Wobble complete
      u.wobbleType = "none";
      u.wobbleTimer = 0;
      u.wobbleIntensity = 0;
    } else {
      // Calculate intensity (peaks in middle, fades at ends)
      const progress = u.wobbleTimer / duration;
      u.wobbleIntensity = Math.sin(progress * Math.PI);
    }
  }

  /**
   * Trigger a wobble animation
   */
  private triggerWobble(type: WobbleType): void {
    if (!this.ufo) return;

    // Don't interrupt existing wobble
    if (this.ufo.wobbleType !== "none") return;

    this.ufo.wobbleType = type;
    this.ufo.wobbleTimer = 0;
    this.ufo.wobbleIntensity = 0;
  }

  /**
   * Get wobble offset for rendering
   */
  private getWobbleOffset(): { x: number; y: number; rotation: number; scale: number } {
    if (!this.ufo || this.ufo.wobbleType === "none") {
      return { x: 0, y: 0, rotation: 0, scale: 1 };
    }

    const u = this.ufo;
    const intensity = u.wobbleIntensity;

    switch (u.wobbleType) {
      case "curious_tilt":
        // Lean to one side
        return {
          x: intensity * 3,
          y: 0,
          rotation: intensity * 0.15,
          scale: 1,
        };

      case "startled_jolt":
        // Quick shake and slight jump
        const joltShake = Math.sin(u.wobbleTimer * 1.5) * intensity;
        return {
          x: joltShake * 4,
          y: -intensity * 5,
          rotation: joltShake * 0.1,
          scale: 1 + intensity * 0.05,
        };

      case "disappointed_shake":
        // Side to side head shake
        const shakeOscillation = Math.sin(u.wobbleTimer * 0.4) * intensity;
        return {
          x: shakeOscillation * 6,
          y: intensity * 2, // Slight droop
          rotation: shakeOscillation * 0.08,
          scale: 1,
        };

      case "happy_bounce":
        // Up-down bounce
        const bouncePhase = Math.sin(u.wobbleTimer * 0.5) * intensity;
        return {
          x: 0,
          y: -Math.abs(bouncePhase) * 8,
          rotation: 0,
          scale: 1 + bouncePhase * 0.08,
        };

      case "yawn_stretch":
        // Stretch up then settle
        const yawnProgress = u.wobbleTimer / 90;
        const stretchAmount =
          yawnProgress < 0.4
            ? yawnProgress / 0.4 // Stretch up
            : 1 - (yawnProgress - 0.4) / 0.6; // Settle back
        return {
          x: 0,
          y: -stretchAmount * intensity * 6,
          rotation: 0,
          scale: 1 + stretchAmount * intensity * 0.1,
        };

      default:
        return { x: 0, y: 0, rotation: 0, scale: 1 };
    }
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
      this.triggerWobble("curious_tilt");
      u.lookAroundTimer = 180; // Cooldown before next look-around
    }

    // Idle behavior: Yawn when bored
    if (u.mood === "bored" && Math.random() < 0.002 * speedMult) {
      this.triggerWobble("yawn_stretch");
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
    this.triggerWobble("startled_jolt");

    // Enter startled mood
    this.setMood("startled");

    // Quick flash of lights (acceleration)
    u.lightPhase += Math.PI;

    // Stay in wandering but with startled mood
    // (mood decay will return to curious)
  }

  /** Calculate shortest angle difference */
  private angleDiff(from: number, to: number): number {
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
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

    // Check for nearby bright star to scan - curious!
    if (Math.random() < this.config.scanStarChance) {
      const star = this.findNearbyBrightStar();
      if (star) {
        u.state = "scanning_star";
        u.stateTimer = 0;
        u.stateDuration = this.calculationService.randInt(
          this.config.scanDuration.min,
          this.config.scanDuration.max
        );
        u.beamTarget = { x: star.x, y: star.y };
        u.beamIntensity = 0;
        this.markInterest(); // Found something to scan!
        this.rememberScannedStar(star.x, star.y); // Remember this one
        return;
      }
    }

    // Ground observation - what's down there?
    if (Math.random() < this.config.groundScanChance) {
      u.state = "scanning_ground";
      u.stateTimer = 0;
      u.stateDuration = this.calculationService.randInt(
        this.config.scanDuration.min,
        this.config.scanDuration.max
      );
      // Point beam straight down, past bottom of screen
      u.beamTarget = { x: u.x, y: this.dimensions.height + 100 };
      u.beamIntensity = 0;
      return;
    }

    // Alright, time to wander again (maybe lazily)
    this.resumeWandering();
  }

  private startTrackingEvent(event: EventPosition): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.state = "tracking_event";
    u.stateTimer = 0;
    u.stateDuration = 9999; // Track until event ends
    u.beamTarget = { x: event.x, y: event.y };
    u.beamIntensity = 0;
    this.markInterest(); // Celestial event is exciting!
  }

  // ============================================================================
  // CHASE BEHAVIOR
  // ============================================================================

  /**
   * Start chasing a celestial event (meteor/comet)
   */
  private startChasing(event: EventPosition): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.state = "chasing";
    u.stateTimer = 0;
    u.chaseTarget = {
      x: event.x,
      y: event.y,
      vx: event.vx ?? 0,
      vy: event.vy ?? 0,
    };
    u.chaseStartTime = u.totalTime;

    // Calculate initial distance
    const dx = event.x - u.x;
    const dy = event.y - u.y;
    u.lastChaseDistance = Math.sqrt(dx * dx + dy * dy);

    // Point beam at target
    u.beamTarget = { x: event.x, y: event.y };
    u.beamIntensity = 0;

    // Turn toward target
    u.heading = Math.atan2(dy, dx);

    // Cancel drifting - we have a mission!
    u.isDrifting = false;

    this.markInterest();
  }

  /**
   * Update chase state - pursue the target
   */
  private updateChasing(dim: Dimensions, speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    // Get current event position
    const event = this.eventProvider?.();

    // If event ended or no chase target, give up
    if (!event?.active || !u.chaseTarget) {
      this.startGivingUp();
      return;
    }

    // Update chase target position
    u.chaseTarget = {
      x: event.x,
      y: event.y,
      vx: event.vx ?? u.chaseTarget.vx,
      vy: event.vy ?? u.chaseTarget.vy,
    };

    // Track with beam
    u.beamTarget = { x: event.x, y: event.y };
    if (u.beamIntensity < 1) {
      u.beamIntensity = Math.min(
        1,
        u.beamIntensity + speedMult / this.config.beamChargeFrames
      );
    }
    u.beamPhase += 0.05 * speedMult;

    // Calculate distance and direction to target
    const dx = event.x - u.x;
    const dy = event.y - u.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const targetAngle = Math.atan2(dy, dx);

    // Steer toward target
    const angleDiff = this.angleDiff(u.heading, targetAngle);
    u.heading += angleDiff * 0.15 * speedMult; // Aggressive steering

    // Move faster when chasing (2x normal speed)
    const chaseSpeed = this.config.speed * dim.width * speedMult * 2.0;
    u.x += Math.cos(u.heading) * chaseSpeed;
    u.y += Math.sin(u.heading) * chaseSpeed;

    // Check if we're catching up or falling behind
    const catchingUp = distance < u.lastChaseDistance;
    u.lastChaseDistance = distance;

    // If very close, we caught up - excited!
    if (distance < 80) {
      this.setMood("excited");
      // Do a quick happy light pulse
      u.lightPhase += Math.PI;
      // Continue flying alongside briefly, then return to wandering
      if (u.stateTimer > 120) {
        // 2 seconds alongside
        this.resumeWandering();
      }
      return;
    }

    // Check for giving up conditions
    const chaseTime = u.totalTime - u.chaseStartTime;

    // Give up if:
    // 1. Chasing for too long (300 frames = 5 seconds)
    // 2. Falling behind consistently
    if (chaseTime > 300 && !catchingUp) {
      this.startGivingUp();
      return;
    }

    // Extra condition: way too far away
    if (distance > dim.width * 0.6) {
      this.startGivingUp();
    }
  }

  /**
   * Start giving up animation
   */
  private startGivingUp(): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.state = "giving_up";
    u.stateTimer = 0;
    u.giveUpTimer = 90; // 1.5 seconds to give up animation

    // Keep beam briefly pointing at last known position
    // (will fade during giving_up)
  }

  /**
   * Update giving up state - disappointed slowdown
   */
  private updateGivingUp(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    // Decrement give up timer
    u.giveUpTimer -= speedMult;

    // Calculate progress (0 to 1)
    const progress = 1 - u.giveUpTimer / 90;

    // Gradually slow down
    const slowdownFactor = Math.max(0.1, 1 - progress * 0.9);

    // Apply slowdown to movement (continue in current direction, slowing)
    const slowSpeed = this.config.speed * this.dimensions.width * speedMult * slowdownFactor;
    u.x += Math.cos(u.heading) * slowSpeed;
    u.y += Math.sin(u.heading) * slowSpeed;

    // Fade beam
    u.beamIntensity = Math.max(0, u.beamIntensity - speedMult * 0.02);

    // Disappointed wobble - small side-to-side oscillation
    const wobbleFreq = 15; // Fast wobble
    const wobbleAmount = 0.05 * (1 - progress); // Fade out wobble
    u.heading += Math.sin(u.stateTimer * 0.3) * wobbleAmount * speedMult;

    // Animation complete
    if (u.giveUpTimer <= 0) {
      // Clear chase state
      u.chaseTarget = null;
      u.beamTarget = null;
      u.beamIntensity = 0;

      // Enter slightly bored mood (the target got away!)
      this.setMood("bored");

      // Return to wandering
      this.resumeWandering();
    }
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
      this.markInterest();
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

  private findNearbyBrightStar(): StarInfo | null {
    if (!this.starProvider || !this.ufo) return null;

    const stars = this.starProvider();
    const u = this.ufo;

    // Find all scannable stars within range (50% of screen width)
    const maxDist = this.dimensions.width * 0.5;
    const candidates: StarInfo[] = [];

    for (const star of stars) {
      const dx = star.x - u.x;
      const dy = star.y - u.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Star must be in range but not too close
      if (dist < maxDist && dist > 30) {
        // Check memory - skip recently scanned stars
        const starKey = this.getStarKey(star.x, star.y);
        if (!u.scannedStars.has(starKey)) {
          candidates.push(star);
        }
      }
    }

    if (candidates.length === 0) {
      // All nearby stars scanned - clear memory and allow rescanning
      u.scannedStars.clear();
      return null;
    }

    // Randomly pick from candidates, weighted slightly toward brighter stars
    // This gives variety while still preferring interesting targets
    const weights = candidates.map(star => 0.3 + star.brightness * 0.7);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < candidates.length; i++) {
      const weight = weights[i];
      const candidate = candidates[i];
      if (weight !== undefined && candidate) {
        random -= weight;
        if (random <= 0) {
          return candidate;
        }
      }
    }

    // Fallback to random pick
    const fallbackIndex = Math.floor(Math.random() * candidates.length);
    return candidates[fallbackIndex] ?? null;
  }

  /**
   * Generate a key for star position (for memory system)
   */
  private getStarKey(x: number, y: number): string {
    // Round to grid cells to handle slight position drift
    const gridX = Math.round(x / 20);
    const gridY = Math.round(y / 20);
    return `${gridX},${gridY}`;
  }

  /**
   * Remember that we scanned a star at this position
   */
  private rememberScannedStar(x: number, y: number): void {
    if (!this.ufo) return;
    const key = this.getStarKey(x, y);
    this.ufo.scannedStars.add(key);

    // Keep memory limited to last ~10 stars
    if (this.ufo.scannedStars.size > 10) {
      const firstKey = this.ufo.scannedStars.values().next().value;
      if (firstKey) this.ufo.scannedStars.delete(firstKey);
    }
  }

  /**
   * Find star nearest to a given position (for tracking drifting stars)
   */
  private findStarNearPosition(targetX: number, targetY: number): StarInfo | null {
    if (!this.starProvider) return null;

    const stars = this.starProvider();

    // Find the star closest to the target position
    // Use a tight radius - if the star drifted too far, we lost it
    const maxDist = 50; // pixels - stars don't drift that fast
    let closestStar: StarInfo | null = null;
    let closestDist = maxDist;

    for (const star of stars) {
      const dx = star.x - targetX;
      const dy = star.y - targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
        closestStar = star;
      }
    }

    return closestStar;
  }

  draw(ctx: CanvasRenderingContext2D, a11y: AccessibilitySettings): void {
    if (!this.ufo) return;

    const u = this.ufo;
    const baseAlpha = a11y.reducedMotion ? 0.7 : 1;
    const moodVisuals = this.getMoodVisuals();
    const wobble = this.getWobbleOffset();

    ctx.save();
    ctx.globalAlpha = u.opacity * baseAlpha;

    // Calculate hover bob offset with mood-based depth
    const bobOffset =
      Math.sin(u.hoverPhase) * this.config.hoverBobAmount * moodVisuals.bobDepth;

    // Apply wobble offsets
    const drawX = u.x + wobble.x;
    const drawY = u.y + bobOffset + wobble.y;

    // Apply scale transform (for zoom entrance/exit + wobble scale)
    const totalScale = u.scale * wobble.scale;
    if (totalScale !== 1 || wobble.rotation !== 0) {
      ctx.translate(drawX, drawY);
      if (totalScale !== 1) ctx.scale(totalScale, totalScale);
      if (wobble.rotation !== 0) ctx.rotate(wobble.rotation);
      ctx.translate(-drawX, -drawY);
    }

    // Layer 0: Warp flash effect (bright glow during warp in/out)
    if (u.flashIntensity > 0) {
      this.drawWarpFlash(ctx, u, drawY);
    }

    // Layer 1: Tractor beam (when active)
    if (u.beamTarget && u.beamIntensity > 0) {
      this.drawBeam(ctx, u, drawY);
    }

    // Layer 2: Shield glow
    this.drawShield(ctx, u, drawY);

    // Layer 3: Hull (saucer body)
    this.drawHull(ctx, u, drawY, a11y);

    // Layer 4: Dome
    this.drawDome(ctx, u, drawY);

    // Layer 5: Rim lights
    this.drawLights(ctx, u, drawY);

    // Layer 6: Engine glow (underneath)
    this.drawEngineGlow(ctx, u, drawY);

    ctx.restore();
  }

  private drawWarpFlash(
    ctx: CanvasRenderingContext2D,
    ufo: UFO,
    drawY: number
  ): void {
    // Bright expanding glow for warp effect
    const flashRadius = ufo.size * (1.5 + ufo.flashIntensity * 2);

    const gradient = ctx.createRadialGradient(
      ufo.x,
      drawY,
      0,
      ufo.x,
      drawY,
      flashRadius
    );

    gradient.addColorStop(
      0,
      `rgba(200, 230, 255, ${0.9 * ufo.flashIntensity})`
    );
    gradient.addColorStop(
      0.3,
      `rgba(150, 200, 255, ${0.5 * ufo.flashIntensity})`
    );
    gradient.addColorStop(0.7, `rgba(100, 150, 255, ${0.2 * ufo.flashIntensity})`);
    gradient.addColorStop(1, "rgba(100, 150, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ufo.x, drawY, flashRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBeam(
    ctx: CanvasRenderingContext2D,
    ufo: UFO,
    drawY: number
  ): void {
    if (!ufo.beamTarget) return;

    const { x } = ufo;
    const target = ufo.beamTarget;

    // Calculate beam direction and length
    const dx = target.x - x;
    const dy = target.y - drawY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(x, drawY);
    ctx.rotate(angle);

    // Beam width at source and end
    const sourceWidth = ufo.size * 0.3;
    const endWidth = ufo.size * 1.5;

    // Pulsing intensity
    const pulseIntensity =
      0.7 + Math.sin(ufo.beamPhase * 3) * 0.3 * ufo.beamIntensity;

    // Draw beam cone
    const gradient = ctx.createLinearGradient(0, 0, length, 0);
    const beamColor = this.config.colors.beam;
    gradient.addColorStop(
      0,
      this.colorWithAlpha(beamColor, 0.6 * ufo.beamIntensity * pulseIntensity)
    );
    gradient.addColorStop(
      0.3,
      this.colorWithAlpha(beamColor, 0.4 * ufo.beamIntensity * pulseIntensity)
    );
    gradient.addColorStop(1, this.colorWithAlpha(beamColor, 0));

    ctx.beginPath();
    ctx.moveTo(0, -sourceWidth / 2);
    ctx.lineTo(length, -endWidth / 2);
    ctx.lineTo(length, endWidth / 2);
    ctx.lineTo(0, sourceWidth / 2);
    ctx.closePath();

    ctx.fillStyle = gradient;
    ctx.fill();

    // Add glow overlay
    const glowGradient = ctx.createLinearGradient(0, 0, length * 0.5, 0);
    glowGradient.addColorStop(
      0,
      this.colorWithAlpha(
        this.config.colors.beamGlow,
        0.4 * ufo.beamIntensity * pulseIntensity
      )
    );
    glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = glowGradient;
    ctx.fill();

    ctx.restore();
  }

  private drawShield(
    ctx: CanvasRenderingContext2D,
    ufo: UFO,
    drawY: number
  ): void {
    const shieldRadius = ufo.size * 1.8;
    const pulseScale = 1 + Math.sin(ufo.shieldPhase) * 0.05;

    // Apply mood-based brightness to shield
    const moodVisuals = this.getMoodVisuals();
    const brightness = moodVisuals.shieldBrightness;

    const gradient = ctx.createRadialGradient(
      ufo.x,
      drawY,
      0,
      ufo.x,
      drawY,
      shieldRadius * pulseScale
    );

    const shieldColor = this.config.colors.shield;
    gradient.addColorStop(0, this.colorWithAlpha(shieldColor, 0.1 * brightness));
    gradient.addColorStop(0.5, this.colorWithAlpha(shieldColor, 0.08 * brightness));
    gradient.addColorStop(0.8, this.colorWithAlpha(shieldColor, 0.03 * brightness));
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ufo.x, drawY, shieldRadius * pulseScale, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHull(
    ctx: CanvasRenderingContext2D,
    ufo: UFO,
    drawY: number,
    a11y: AccessibilitySettings
  ): void {
    const { size, x } = ufo;

    // Saucer dimensions
    const bodyWidth = size;
    const bodyHeight = size * 0.25;

    // Main hull gradient (metallic)
    const hullGradient = ctx.createLinearGradient(
      x,
      drawY - bodyHeight,
      x,
      drawY + bodyHeight
    );

    const hullColor = a11y.highContrast ? "#ffffff" : this.config.colors.hull;
    const hullDark = a11y.highContrast
      ? "#cccccc"
      : this.config.colors.hullDark;

    hullGradient.addColorStop(0, hullColor);
    hullGradient.addColorStop(0.4, hullColor);
    hullGradient.addColorStop(0.6, hullDark);
    hullGradient.addColorStop(1, hullDark);

    ctx.fillStyle = hullGradient;
    ctx.beginPath();
    ctx.ellipse(x, drawY, bodyWidth, bodyHeight, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle rim highlight
    ctx.strokeStyle = this.colorWithAlpha(hullColor, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawDome(
    ctx: CanvasRenderingContext2D,
    ufo: UFO,
    drawY: number
  ): void {
    const { size, x } = ufo;

    const domeWidth = size * 0.4;
    const domeHeight = size * 0.35;
    const domeY = drawY - size * 0.15;

    // Glass dome gradient
    const domeGradient = ctx.createRadialGradient(
      x - domeWidth * 0.2,
      domeY - domeHeight * 0.3,
      0,
      x,
      domeY,
      domeWidth
    );

    domeGradient.addColorStop(0, this.config.colors.domeHighlight);
    domeGradient.addColorStop(0.3, this.config.colors.dome);
    domeGradient.addColorStop(1, this.colorWithAlpha(this.config.colors.dome, 0.3));

    ctx.fillStyle = domeGradient;
    ctx.beginPath();
    ctx.ellipse(x, domeY, domeWidth, domeHeight, 0, Math.PI, 0); // Top half
    ctx.fill();
  }

  private drawLights(
    ctx: CanvasRenderingContext2D,
    ufo: UFO,
    drawY: number
  ): void {
    const { size, x } = ufo;
    const colors = this.config.colors.lights;
    const numLights = colors.length;
    const lightRadius = size * 0.06;
    const orbitRadius = size * 0.85;

    for (let i = 0; i < numLights; i++) {
      const color = colors[i] ?? "#ffffff";
      const angle = (i / numLights) * Math.PI * 2 + ufo.lightPhase;

      // Chase pattern - each light pulses in sequence
      const chaseOffset = (ufo.lightPhase * 2 + i) % numLights;
      const brightness = 0.4 + Math.sin(chaseOffset * 0.5) * 0.6;

      const lx = x + Math.cos(angle) * orbitRadius;
      const ly = drawY + Math.sin(angle) * orbitRadius * 0.3; // Flattened for perspective

      // Light glow
      const glowGradient = ctx.createRadialGradient(
        lx,
        ly,
        0,
        lx,
        ly,
        lightRadius * 3
      );
      glowGradient.addColorStop(
        0,
        this.colorWithAlpha(color, brightness * 0.8)
      );
      glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(lx, ly, lightRadius * 3, 0, Math.PI * 2);
      ctx.fill();

      // Light core
      ctx.fillStyle = this.colorWithAlpha(color, brightness);
      ctx.beginPath();
      ctx.arc(lx, ly, lightRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawEngineGlow(
    ctx: CanvasRenderingContext2D,
    ufo: UFO,
    drawY: number
  ): void {
    const { size, x } = ufo;

    // Subtle glow underneath
    const glowGradient = ctx.createRadialGradient(
      x,
      drawY + size * 0.1,
      0,
      x,
      drawY + size * 0.1,
      size * 0.5
    );

    const pulse = 0.3 + Math.sin(ufo.shieldPhase * 2) * 0.1;
    glowGradient.addColorStop(0, `rgba(150, 200, 255, ${pulse})`);
    glowGradient.addColorStop(0.5, `rgba(100, 150, 255, ${pulse * 0.5})`);
    glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.ellipse(x, drawY + size * 0.1, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private colorWithAlpha(color: string, alpha: number): string {
    // Handle hex colors
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    // Handle rgba - replace alpha
    if (color.startsWith("rgba")) {
      return color.replace(/[\d.]+\)$/, `${alpha})`);
    }
    return color;
  }

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
    this.ufo.mood = mood;
    this.ufo.moodTimer = 0;

    // Certain moods count as "interesting" and reset bored timer
    if (mood === "excited" || mood === "playful" || mood === "startled") {
      this.markInterest();
    }
  }

  /**
   * Get UFO tiredness level (0-1)
   */
  getTiredness(): number | null {
    return this.ufo?.tiredness ?? null;
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

  /**
   * Handle direct click on UFO - escalating responses
   */
  private handleDirectHit(isConsecutive: boolean): boolean {
    if (!this.ufo) return false;
    const u = this.ufo;

    // Update click tracking
    u.lastClickTime = u.totalTime;

    if (!isConsecutive) {
      // First click - curious reaction
      u.clickCount = 1;
      this.reactCuriously();
      return true;
    }

    // Consecutive click - escalated response based on mood
    u.clickCount++;

    switch (u.mood) {
      case "playful":
        // Playful UFO does a spin and stays
        this.reactPlayfully();
        return true;

      case "bored":
      case "tired":
        // Grumpy/tired UFO flees
        this.reactFlee();
        return true;

      case "startled":
        // Already startled, definitely flee
        this.reactFlee();
        return true;

      case "curious":
      case "excited":
      default:
        // 50/50 chance: either play or flee
        if (Math.random() < 0.5) {
          this.reactPlayfully();
        } else {
          this.reactFlee();
        }
        return true;
    }
  }

  /**
   * Handle click near but not on UFO
   */
  private handleNearMiss(clickX: number, clickY: number): boolean {
    if (!this.ufo) return false;
    const u = this.ufo;

    // Small glance toward click - turn heading slightly
    const dx = clickX - u.x;
    const dy = clickY - u.y;
    const clickAngle = Math.atan2(dy, dx);

    // Subtle turn toward click
    const angleDiff = this.angleDiff(u.heading, clickAngle);
    u.heading += angleDiff * 0.3; // Partial turn, just a glance

    // Mark interest - something happened nearby
    this.markInterest();

    return true;
  }

  /**
   * Handle click far from UFO - might investigate
   */
  private handleFarClick(clickX: number, clickY: number): boolean {
    if (!this.ufo) return false;
    const u = this.ufo;

    // Only investigate if not busy
    if (u.state !== "wandering" && u.state !== "paused") {
      return false;
    }

    // Curious or playful UFO investigates
    if (u.mood === "curious" || u.mood === "playful" || u.mood === "excited") {
      // Set click target - UFO will head there
      u.clickTarget = { x: clickX, y: clickY };

      // Turn toward click location
      const dx = clickX - u.x;
      const dy = clickY - u.y;
      u.heading = Math.atan2(dy, dx);

      // Start moving (if paused, resume wandering)
      if (u.state === "paused") {
        u.state = "wandering";
        u.stateTimer = 0;
      }

      // Cancel drifting - UFO has purpose now
      u.isDrifting = false;

      this.markInterest();
      return true;
    }

    // Bored/tired UFO ignores far clicks
    return false;
  }

  /**
   * Curious reaction to first click - wobble and become playful
   */
  private reactCuriously(): void {
    if (!this.ufo) return;
    const u = this.ufo;

    // Pause current activity
    u.state = "paused";
    u.stateTimer = 0;
    u.stateDuration = 60; // 1 second pause

    // Stop any beam
    u.beamTarget = null;
    u.beamIntensity = 0;

    // Curious tilt wobble
    this.triggerWobble("curious_tilt");

    // Enter playful mood
    this.setMood("playful");
  }

  /**
   * Playful reaction - happy spin
   */
  private reactPlayfully(): void {
    if (!this.ufo) return;
    const u = this.ufo;

    // Do a quick spin (handled visually via lightPhase acceleration)
    // Make lights go crazy briefly
    u.lightPhase += Math.PI * 2; // Full rotation

    // Happy bounce wobble
    this.triggerWobble("happy_bounce");

    // Stay playful
    this.setMood("playful");

    // Resume wandering happily
    this.resumeWandering();
  }

  /**
   * Flee reaction - panic exit
   */
  private reactFlee(): void {
    if (!this.ufo) return;

    // Startled jolt wobble
    this.triggerWobble("startled_jolt");

    // Enter startled mood briefly (lights flash)
    this.setMood("startled");

    // Shoot up and out!
    this.startExiting("shootUp");
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
      this.markInterest(); // Found something to scan!
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
