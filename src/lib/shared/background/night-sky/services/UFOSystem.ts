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
  | "collecting_sample" // Pulling sample from comet/meteor
  | "photographing" // Taking photo of a star
  | "investigating_ground" // Ground anomaly with particle effects
  | "panicking" // Near miss evasive action
  | "surfing" // Joy riding on a comet
  | "communicating" // Trying to talk to a star
  | "napping" // Power nap when tired
  | "hiding" // Peek-a-boo hide
  | "peeking" // Peek-a-boo peek
  | "celebrating" // Rare discovery celebration
  | "following" // Buddy system - following alongside something
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

/** Narrative phase for multi-step interactions */
type NarrativePhase =
  | "none"
  | "detection" // Spotting something
  | "approach" // Moving toward it
  | "action" // Main interaction
  | "resolution" // Wrapping up
  | "transition"; // Returning to normal

/** A particle effect (sample, ground dust, etc.) */
interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number; // 0-1
  color: string;
  size: number;
  type: "sample" | "dust" | "sparkle" | "z";
}

/** Communication pulse for morse-like patterns */
interface CommPulse {
  duration: number; // frames
  isOn: boolean;
}

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

  // Narrative arc system
  narrativePhase: NarrativePhase;
  narrativeTimer: number; // Progress within current phase
  narrativePhaseDuration: number; // How long current phase lasts

  // Sample collection (from comet/meteor)
  sampleParticle: Particle | null;
  collectedSamples: number; // Count of collected samples

  // Star photography
  photographedStars: Set<string>; // Stars we've photographed
  cameraFlashTimer: number; // Flash effect countdown
  photoTarget: { x: number; y: number } | null;

  // Ground investigation
  groundParticles: Particle[]; // Dust/particles rising from ground
  anomalyPosition: { x: number; y: number } | null;

  // Panic / evasion
  panicDirection: number; // Direction to flee (radians)
  panicSpeed: number; // Current panic speed
  afterimagePositions: Array<{ x: number; y: number; opacity: number }>;

  // Comet surfing
  surfTarget: { x: number; y: number; vx: number; vy: number } | null;
  surfOffset: { x: number; y: number }; // Offset from comet center

  // Communication
  commPattern: CommPulse[]; // Current communication pattern
  commPatternIndex: number; // Current position in pattern
  commPulseTimer: number; // Timer for current pulse
  commTarget: { x: number; y: number } | null;
  awaitingResponse: boolean;

  // Napping
  sleepZs: Particle[]; // Floating Z particles
  napStartY: number; // Original Y position before settling

  // Peek-a-boo
  hidePosition: { x: number; y: number } | null;
  peekProgress: number; // How much we're peeking out (0-1)
  peekDirection: number; // Which way we're peeking

  // Celebration
  celebrationSpinSpeed: number;
  celebrationBouncePhase: number;
  rainbowPhase: number; // For rainbow light effect

  // Buddy system
  buddyTarget: { x: number; y: number; vx: number; vy: number } | null;
  buddyOffset: number; // Parallel distance to maintain

  // Rare discovery tracking
  rareDiscoveries: number;
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
    const moodVisuals = this.getMoodVisuals();

    // Update animation phases with mood modifiers
    u.shieldPhase += this.config.shieldPulseSpeed * speedMult;
    u.lightPhase += this.config.lightChaseSpeed * speedMult * moodVisuals.lightSpeed;
    u.hoverPhase += this.config.hoverBobSpeed * speedMult;

    // Update narrative effect timers
    if (u.cameraFlashTimer > 0) {
      u.cameraFlashTimer = Math.max(0, u.cameraFlashTimer - speedMult);
    }

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
   * Trigger a wobble animation (public for testing via UFO Lab)
   */
  triggerWobble(type: WobbleType): void {
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
          this.markInterest();
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

    // Layer 7: Narrative effects (particles, flashes, etc.)
    this.drawNarrativeEffects(ctx, u);

    ctx.restore();
  }

  /**
   * Draw all narrative arc visual effects
   */
  private drawNarrativeEffects(ctx: CanvasRenderingContext2D, u: UFO): void {
    // Sample particle traveling up the beam
    if (u.sampleParticle) {
      this.drawSampleParticle(ctx, u.sampleParticle);
    }

    // Camera flash effect
    if (u.cameraFlashTimer > 0) {
      this.drawCameraFlash(ctx, u);
    }

    // Ground investigation particles
    if (u.groundParticles.length > 0) {
      this.drawGroundParticles(ctx, u.groundParticles);
    }

    // Panic afterimages
    if (u.afterimagePositions.length > 0) {
      this.drawAfterimages(ctx, u);
    }

    // Sleep Zs for napping
    if (u.sleepZs.length > 0) {
      this.drawSleepZs(ctx, u.sleepZs);
    }

    // Celebration rainbow lights
    if (u.state === "celebrating") {
      this.drawCelebrationEffects(ctx, u);
    }

    // Communication pulses
    if (u.state === "communicating" && u.commTarget) {
      this.drawCommunicationPulses(ctx, u);
    }
  }

  /**
   * Draw sample particle (golden orb traveling up beam)
   */
  private drawSampleParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
    const glow = 12 + Math.sin(p.progress * Math.PI * 4) * 4;

    // Outer glow
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
    gradient.addColorStop(0, "rgba(251, 191, 36, 0.9)");
    gradient.addColorStop(0.4, "rgba(251, 191, 36, 0.4)");
    gradient.addColorStop(1, "rgba(251, 191, 36, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle highlight
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw camera flash effect (brief white burst)
   */
  private drawCameraFlash(ctx: CanvasRenderingContext2D, u: UFO): void {
    const flashAlpha = Math.min(1, u.cameraFlashTimer / 8);
    const flashRadius = u.size * 3;

    const gradient = ctx.createRadialGradient(u.x, u.y, 0, u.x, u.y, flashRadius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
    gradient.addColorStop(0.3, `rgba(200, 220, 255, ${flashAlpha * 0.6})`);
    gradient.addColorStop(1, "rgba(200, 220, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(u.x, u.y, flashRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw ground investigation particles (dust rising)
   */
  private drawGroundParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
    for (const p of particles) {
      const alpha = 1 - p.progress;
      const size = p.size * (1 + p.progress * 0.5);

      // Dust particle
      ctx.fillStyle = `rgba(180, 160, 140, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();

      // Sparkle for some particles
      if (p.type === "sparkle") {
        ctx.fillStyle = `rgba(255, 230, 180, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Draw panic afterimages (motion blur effect)
   */
  private drawAfterimages(ctx: CanvasRenderingContext2D, u: UFO): void {
    for (const img of u.afterimagePositions) {
      if (img.opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = img.opacity * 0.3;

      // Simple ghost silhouette
      const gradient = ctx.createRadialGradient(
        img.x, img.y, 0,
        img.x, img.y, u.size
      );
      gradient.addColorStop(0, this.config.colors.shield);
      gradient.addColorStop(1, "rgba(100, 200, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(img.x, img.y, u.size * 0.8, u.size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Draw floating sleep Zs
   */
  private drawSleepZs(ctx: CanvasRenderingContext2D, zs: Particle[]): void {
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const z of zs) {
      const alpha = 1 - z.progress;
      const scale = 0.5 + z.progress * 0.8;
      const wobble = Math.sin(z.progress * Math.PI * 3) * 3;

      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.translate(z.x + wobble, z.y);
      ctx.scale(scale, scale);

      // Z shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillText("Z", 1, 1);

      // Z text
      ctx.fillStyle = "#a5b4fc";
      ctx.fillText("Z", 0, 0);

      ctx.restore();
    }
  }

  /**
   * Draw celebration effects (rainbow lights, sparkles)
   */
  private drawCelebrationEffects(ctx: CanvasRenderingContext2D, u: UFO): void {
    const rainbowColors = [
      "#ef4444", // red
      "#f97316", // orange
      "#eab308", // yellow
      "#22c55e", // green
      "#3b82f6", // blue
      "#8b5cf6", // violet
    ];

    // Rainbow ring around UFO
    const ringRadius = u.size * 1.5;
    const numLights = 12;

    for (let i = 0; i < numLights; i++) {
      const angle = (i / numLights) * Math.PI * 2 + u.rainbowPhase;
      const colorIndex = Math.floor((i / numLights) * rainbowColors.length);
      const color = rainbowColors[colorIndex % rainbowColors.length]!;

      const lx = u.x + Math.cos(angle) * ringRadius;
      const ly = u.y + Math.sin(angle) * ringRadius * 0.4; // Flatten for perspective

      const pulse = 0.7 + Math.sin(angle * 3 + u.celebrationBouncePhase) * 0.3;

      // Light glow
      const gradient = ctx.createRadialGradient(lx, ly, 0, lx, ly, 8);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.5, `${color}80`);
      gradient.addColorStop(1, `${color}00`);

      ctx.fillStyle = gradient;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(lx, ly, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  /**
   * Draw communication pulses traveling to target star
   */
  private drawCommunicationPulses(ctx: CanvasRenderingContext2D, u: UFO): void {
    if (!u.commTarget) return;

    // Draw a pulsing beam line toward the star
    const currentPulse = u.commPattern[u.commPatternIndex];
    if (!currentPulse?.isOn) return;

    const dx = u.commTarget.x - u.x;
    const dy = u.commTarget.y - u.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Animated pulse traveling along the beam
    const pulseProgress = (u.commPulseTimer % 30) / 30;
    const pulseX = u.x + dx * pulseProgress;
    const pulseY = u.y + dy * pulseProgress;

    // Beam line (thin)
    ctx.strokeStyle = "rgba(147, 197, 253, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    ctx.lineTo(u.commTarget.x, u.commTarget.y);
    ctx.stroke();

    // Traveling pulse
    const pulseSize = 6 + Math.sin(pulseProgress * Math.PI) * 3;
    const gradient = ctx.createRadialGradient(pulseX, pulseY, 0, pulseX, pulseY, pulseSize * 2);
    gradient.addColorStop(0, "rgba(147, 197, 253, 0.9)");
    gradient.addColorStop(0.5, "rgba(147, 197, 253, 0.4)");
    gradient.addColorStop(1, "rgba(147, 197, 253, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pulseX, pulseY, pulseSize * 2, 0, Math.PI * 2);
    ctx.fill();
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
  // NARRATIVE ARC UPDATE METHODS
  // ============================================================================

  /**
   * Sample Collection - UFO collects a sample from comet/meteor
   * Phases: detection -> action (beam lock) -> resolution (particle travel) -> transition
   */
  private updateCollectingSample(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.narrativeTimer += speedMult;

    switch (u.narrativePhase) {
      case "detection":
        // Beam charging toward target
        u.beamIntensity = Math.min(1, u.beamIntensity + speedMult * 0.03);
        if (u.narrativeTimer >= 60) {
          u.narrativePhase = "action";
          u.narrativeTimer = 0;
          u.narrativePhaseDuration = 120; // 2 seconds scanning
          this.setMood("excited");
        }
        break;

      case "action":
        // Scanning - beam pulses
        u.beamIntensity = 0.7 + Math.sin(u.narrativeTimer * 0.2) * 0.3;

        // Update beam target if tracking moving object
        const event = this.eventProvider?.();
        if (event?.active && u.beamTarget) {
          u.beamTarget = { x: event.x, y: event.y };
        }

        if (u.narrativeTimer >= u.narrativePhaseDuration) {
          // Spawn sample particle at beam target
          if (u.beamTarget) {
            u.sampleParticle = {
              x: u.beamTarget.x,
              y: u.beamTarget.y,
              targetX: u.x,
              targetY: u.y,
              progress: 0,
              color: "#fbbf24", // Golden
              size: 6,
              type: "sample",
            };
          }
          u.narrativePhase = "resolution";
          u.narrativeTimer = 0;
          u.narrativePhaseDuration = 90; // 1.5 seconds for particle travel
        }
        break;

      case "resolution":
        // Sample particle traveling up the beam
        if (u.sampleParticle) {
          u.sampleParticle.progress = Math.min(
            1,
            u.sampleParticle.progress + speedMult * 0.015
          );
          // Update particle position along beam
          const p = u.sampleParticle.progress;
          const eased = 1 - Math.pow(1 - p, 3); // Ease out cubic
          u.sampleParticle.x =
            u.beamTarget!.x + (u.x - u.beamTarget!.x) * eased;
          u.sampleParticle.y =
            u.beamTarget!.y + (u.y - u.beamTarget!.y) * eased;

          // Particle reached UFO
          if (u.sampleParticle.progress >= 1) {
            u.collectedSamples++;
            u.sampleParticle = null;
            this.triggerWobble("happy_bounce");
            u.narrativePhase = "transition";
            u.narrativeTimer = 0;
            // Flash effect
            u.cameraFlashTimer = 15;
          }
        }
        break;

      case "transition":
        // Brief satisfaction pause then return to wandering
        u.beamIntensity = Math.max(0, u.beamIntensity - speedMult * 0.05);
        if (u.narrativeTimer >= 30) {
          u.beamTarget = null;
          u.narrativePhase = "none";
          this.resumeWandering();
        }
        break;

      default:
        this.resumeWandering();
    }
  }

  /**
   * Start sample collection from a comet/meteor
   */
  private startCollectingSample(event: EventPosition): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.state = "collecting_sample";
    u.stateTimer = 0;
    u.narrativePhase = "detection";
    u.narrativeTimer = 0;
    u.beamTarget = { x: event.x, y: event.y };
    u.beamIntensity = 0;
    this.markInterest();
  }

  /**
   * Star Photography - UFO takes a photo of a star
   */
  private updatePhotographing(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.narrativeTimer += speedMult;

    switch (u.narrativePhase) {
      case "approach":
        // Drift toward photo target
        if (u.photoTarget) {
          const dx = u.photoTarget.x - u.x;
          const dy = u.photoTarget.y - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 100) {
            // Move closer
            const speed = this.config.speed * this.dimensions.width * speedMult * 0.5;
            u.x += (dx / dist) * speed;
            u.y += (dy / dist) * speed;
          } else {
            u.narrativePhase = "action";
            u.narrativeTimer = 0;
            this.triggerWobble("curious_tilt");
          }
        }
        break;

      case "action":
        // Focusing - beam flickers
        u.beamIntensity = 0.3 + Math.random() * 0.3; // Autofocus flicker
        u.beamTarget = u.photoTarget;

        if (u.narrativeTimer >= 90) {
          // FLASH!
          u.cameraFlashTimer = 20;
          u.narrativePhase = "resolution";
          u.narrativeTimer = 0;

          // Remember this star
          if (u.photoTarget) {
            const key = `${Math.round(u.photoTarget.x / 50)},${Math.round(u.photoTarget.y / 50)}`;
            u.photographedStars.add(key);
          }
        }
        break;

      case "resolution":
        // Flash fade and admire
        u.beamIntensity = Math.max(0, u.beamIntensity - speedMult * 0.05);
        u.cameraFlashTimer = Math.max(0, u.cameraFlashTimer - speedMult);

        if (u.narrativeTimer >= 30) {
          this.triggerWobble("happy_bounce");
          this.setMood("playful");
          u.narrativePhase = "transition";
          u.narrativeTimer = 0;
        }
        break;

      case "transition":
        if (u.narrativeTimer >= 30) {
          u.photoTarget = null;
          u.beamTarget = null;
          u.narrativePhase = "none";
          this.resumeWandering();
        }
        break;

      default:
        this.resumeWandering();
    }
  }

  /**
   * Start photographing a star
   */
  private startPhotographing(star: StarInfo): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.state = "photographing";
    u.stateTimer = 0;
    u.narrativePhase = "approach";
    u.narrativeTimer = 0;
    u.photoTarget = { x: star.x, y: star.y };
    u.beamIntensity = 0;
    this.markInterest();
  }

  /**
   * Ground Investigation - UFO finds something on the ground
   */
  private updateInvestigatingGround(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.narrativeTimer += speedMult;

    switch (u.narrativePhase) {
      case "detection":
        // Pause and look down
        this.triggerWobble("curious_tilt");
        if (u.narrativeTimer >= 30) {
          u.narrativePhase = "approach";
          u.narrativeTimer = 0;
          // Set anomaly position at bottom of screen
          u.anomalyPosition = {
            x: u.x + (Math.random() - 0.5) * 100,
            y: this.dimensions.height - 50,
          };
        }
        break;

      case "approach":
        // Descend toward anomaly
        if (u.anomalyPosition) {
          const targetY = this.dimensions.height * 0.7;
          if (u.y < targetY) {
            u.y += speedMult * 2;
          } else {
            u.narrativePhase = "action";
            u.narrativeTimer = 0;
            u.beamTarget = u.anomalyPosition;
            u.beamIntensity = 0;
          }
        }
        break;

      case "action":
        // Beam sweeps and collects particles
        u.beamIntensity = Math.min(1, u.beamIntensity + speedMult * 0.02);

        // Beam sweeps side to side
        if (u.anomalyPosition) {
          const sweep = Math.sin(u.narrativeTimer * 0.05) * 50;
          u.beamTarget = {
            x: u.anomalyPosition.x + sweep,
            y: u.anomalyPosition.y,
          };
        }

        // Spawn rising particles
        if (Math.random() < 0.1 && u.groundParticles.length < 10) {
          u.groundParticles.push({
            x: u.beamTarget!.x + (Math.random() - 0.5) * 30,
            y: u.beamTarget!.y,
            targetX: u.x,
            targetY: u.y,
            progress: 0,
            color: `hsl(${40 + Math.random() * 20}, 80%, 60%)`,
            size: 2 + Math.random() * 3,
            type: "dust",
          });
        }

        // Update particles
        u.groundParticles = u.groundParticles.filter((p) => {
          p.progress += speedMult * 0.01;
          const eased = 1 - Math.pow(1 - p.progress, 2);
          p.x = p.x + (p.targetX - p.x) * eased * 0.1;
          p.y = p.y + (p.targetY - p.y) * eased * 0.1;
          return p.progress < 1;
        });

        if (u.narrativeTimer >= 180) {
          this.setMood("excited");
          u.narrativePhase = "resolution";
          u.narrativeTimer = 0;
          u.cameraFlashTimer = 10; // Dome flash
        }
        break;

      case "resolution":
        // Analysis complete - particles absorbed
        u.groundParticles = u.groundParticles.filter((p) => {
          p.progress += speedMult * 0.03;
          return p.progress < 1;
        });

        u.beamIntensity = Math.max(0, u.beamIntensity - speedMult * 0.02);

        if (u.narrativeTimer >= 60) {
          // Random outcome
          if (Math.random() < 0.7) {
            this.triggerWobble("happy_bounce");
          } else {
            this.triggerWobble("curious_tilt");
          }
          u.narrativePhase = "transition";
          u.narrativeTimer = 0;
        }
        break;

      case "transition":
        // Rise back up
        if (u.y > this.dimensions.height * 0.3) {
          u.y -= speedMult * 2;
        } else if (u.narrativeTimer >= 30) {
          u.anomalyPosition = null;
          u.beamTarget = null;
          u.groundParticles = [];
          u.narrativePhase = "none";
          this.resumeWandering();
        }
        break;

      default:
        this.resumeWandering();
    }
  }

  /**
   * Start ground investigation
   */
  private startInvestigatingGround(): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.state = "investigating_ground";
    u.stateTimer = 0;
    u.narrativePhase = "detection";
    u.narrativeTimer = 0;
    u.groundParticles = [];
    this.markInterest();
  }

  /**
   * Panic - UFO reacts to near miss
   */
  private updatePanicking(dim: Dimensions, speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.narrativeTimer += speedMult;

    switch (u.narrativePhase) {
      case "detection":
        // Initial jolt
        this.triggerWobble("startled_jolt");
        this.setMood("startled");
        u.panicSpeed = this.config.speed * dim.width * 4; // 4x normal speed
        u.narrativePhase = "action";
        u.narrativeTimer = 0;
        // Add afterimage at current position
        u.afterimagePositions = [{ x: u.x, y: u.y, opacity: 0.8 }];
        break;

      case "action":
        // Zip away in panic direction
        u.x += Math.cos(u.panicDirection) * u.panicSpeed * speedMult;
        u.y += Math.sin(u.panicDirection) * u.panicSpeed * speedMult;

        // Gradually slow down
        u.panicSpeed *= 0.95;

        // Add afterimages
        if (u.narrativeTimer % 5 < speedMult) {
          u.afterimagePositions.push({ x: u.x, y: u.y, opacity: 0.6 });
          if (u.afterimagePositions.length > 5) {
            u.afterimagePositions.shift();
          }
        }

        // Fade afterimages
        u.afterimagePositions.forEach((a) => (a.opacity *= 0.9));

        // Keep in bounds
        const margin = dim.width * this.config.bounceMargin;
        u.x = Math.max(margin, Math.min(dim.width - margin, u.x));
        u.y = Math.max(margin, Math.min(dim.height - margin, u.y));

        if (u.narrativeTimer >= 60) {
          u.narrativePhase = "resolution";
          u.narrativeTimer = 0;
        }
        break;

      case "resolution":
        // Shaky recovery
        u.heading += (Math.random() - 0.5) * 0.1 * speedMult;

        // Fade afterimages
        u.afterimagePositions = u.afterimagePositions.filter((a) => {
          a.opacity *= 0.9;
          return a.opacity > 0.05;
        });

        if (u.narrativeTimer >= 120) {
          u.narrativePhase = "transition";
          u.narrativeTimer = 0;
        }
        break;

      case "transition":
        // Cautiously return to wandering
        if (u.narrativeTimer >= 60) {
          u.afterimagePositions = [];
          u.narrativePhase = "none";
          this.resumeWandering();
        }
        break;

      default:
        this.resumeWandering();
    }
  }

  /**
   * Trigger panic from near miss
   */
  private startPanicking(fromX: number, fromY: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    // Calculate flee direction (away from threat)
    const dx = u.x - fromX;
    const dy = u.y - fromY;
    u.panicDirection = Math.atan2(dy, dx);

    u.state = "panicking";
    u.stateTimer = 0;
    u.narrativePhase = "detection";
    u.narrativeTimer = 0;
  }

  /**
   * Comet Surfing - UFO rides on a comet
   */
  private updateSurfing(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.narrativeTimer += speedMult;

    // Check if comet is still active
    const event = this.eventProvider?.();
    if (!event?.active) {
      // Comet gone - dismount
      this.triggerWobble("curious_tilt");
      this.setMood("playful");
      u.surfTarget = null;
      u.narrativePhase = "none";
      this.resumeWandering();
      return;
    }

    switch (u.narrativePhase) {
      case "approach":
        // Intercept the comet
        if (u.surfTarget) {
          const predictX = event.x + (event.vx ?? 0) * 30;
          const predictY = event.y + (event.vy ?? 0) * 30;
          const dx = predictX - u.x;
          const dy = predictY - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const speed = this.config.speed * this.dimensions.width * speedMult * 2;
          u.x += (dx / dist) * speed;
          u.y += (dy / dist) * speed;

          if (dist < 50) {
            u.narrativePhase = "action";
            u.narrativeTimer = 0;
            this.triggerWobble("happy_bounce");
            this.setMood("playful");
            // Calculate offset from comet center
            u.surfOffset = { x: u.x - event.x, y: u.y - event.y - 20 };
          }
        }
        break;

      case "action":
        // Riding the comet!
        u.x = event.x + u.surfOffset.x;
        u.y = event.y + u.surfOffset.y;

        // Happy bobbing while riding
        u.surfOffset.y += Math.sin(u.narrativeTimer * 0.1) * 0.5;

        // Beam retracted while surfing
        u.beamIntensity = 0;
        u.beamTarget = null;

        // Occasional playful spin
        if (Math.random() < 0.005) {
          u.spinAngle += Math.PI * 2;
        }
        u.spinAngle *= 0.95; // Decay spin

        // Rainbow lights while surfing
        u.rainbowPhase += speedMult * 0.1;

        // Auto-dismount after a while or if near edge
        if (
          u.narrativeTimer >= 300 ||
          event.x < 50 ||
          event.x > this.dimensions.width - 50
        ) {
          u.narrativePhase = "resolution";
          u.narrativeTimer = 0;
        }
        break;

      case "resolution":
        // Peel off from comet
        u.y -= speedMult * 3; // Rise up
        u.x += speedMult * 2; // Drift to side

        if (u.narrativeTimer >= 60) {
          this.triggerWobble("curious_tilt"); // Wave goodbye
          u.narrativePhase = "transition";
          u.narrativeTimer = 0;
        }
        break;

      case "transition":
        if (u.narrativeTimer >= 30) {
          u.surfTarget = null;
          u.rainbowPhase = 0;
          u.narrativePhase = "none";
          this.resumeWandering();
        }
        break;

      default:
        this.resumeWandering();
    }
  }

  /**
   * Start surfing a comet
   */
  private startSurfing(event: EventPosition): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.state = "surfing";
    u.stateTimer = 0;
    u.narrativePhase = "approach";
    u.narrativeTimer = 0;
    u.surfTarget = {
      x: event.x,
      y: event.y,
      vx: event.vx ?? 0,
      vy: event.vy ?? 0,
    };
    this.markInterest();
    this.setMood("excited");
  }

  /**
   * Communication - UFO tries to talk to a star
   */
  private updateCommunicating(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.narrativeTimer += speedMult;

    switch (u.narrativePhase) {
      case "approach":
        // Drift toward target star
        if (u.commTarget) {
          const dx = u.commTarget.x - u.x;
          const dy = u.commTarget.y - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 150) {
            const speed = this.config.speed * this.dimensions.width * speedMult * 0.5;
            u.x += (dx / dist) * speed;
            u.y += (dy / dist) * speed;
          } else {
            u.narrativePhase = "action";
            u.narrativeTimer = 0;
            // Generate communication pattern (morse-like)
            u.commPattern = [
              { duration: 10, isOn: true },
              { duration: 10, isOn: false },
              { duration: 10, isOn: true },
              { duration: 10, isOn: false },
              { duration: 30, isOn: true },
              { duration: 20, isOn: false },
            ];
            u.commPatternIndex = 0;
            u.commPulseTimer = 0;
          }
        }
        break;

      case "action":
        // Send transmission - beam pulses in pattern
        u.beamTarget = u.commTarget;

        if (u.commPatternIndex < u.commPattern.length) {
          const pulse = u.commPattern[u.commPatternIndex]!;
          u.beamIntensity = pulse.isOn ? 1 : 0.2;

          u.commPulseTimer += speedMult;
          if (u.commPulseTimer >= pulse.duration) {
            u.commPulseTimer = 0;
            u.commPatternIndex++;
          }
        } else {
          // Transmission complete - wait for response
          u.beamIntensity = 0.3;
          u.awaitingResponse = true;
          u.narrativePhase = "resolution";
          u.narrativeTimer = 0;
        }
        break;

      case "resolution":
        // Listening for response...
        u.beamIntensity = 0.2 + Math.sin(u.narrativeTimer * 0.1) * 0.1;

        // "Response" is random - if target star happens to twinkle (we fake this)
        const gotResponse = u.narrativeTimer > 60 && Math.random() < 0.02;

        if (gotResponse) {
          this.triggerWobble("happy_bounce");
          this.setMood("excited");
          // Mark as contacted
          if (u.commTarget) {
            const key = `${Math.round(u.commTarget.x / 50)},${Math.round(u.commTarget.y / 50)}`;
            u.photographedStars.add(key); // Reuse this set for contacted stars
          }
          u.narrativePhase = "transition";
          u.narrativeTimer = 0;
        } else if (u.narrativeTimer >= 120) {
          // No response :(
          this.triggerWobble("disappointed_shake");
          this.setMood("bored");
          u.narrativePhase = "transition";
          u.narrativeTimer = 0;
        }
        break;

      case "transition":
        u.beamIntensity = Math.max(0, u.beamIntensity - speedMult * 0.03);
        if (u.narrativeTimer >= 60) {
          u.commTarget = null;
          u.beamTarget = null;
          u.awaitingResponse = false;
          u.narrativePhase = "none";
          this.resumeWandering();
        }
        break;

      default:
        this.resumeWandering();
    }
  }

  /**
   * Start communication attempt with a star
   */
  private startCommunicating(star: StarInfo): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.state = "communicating";
    u.stateTimer = 0;
    u.narrativePhase = "approach";
    u.narrativeTimer = 0;
    u.commTarget = { x: star.x, y: star.y };
    u.beamIntensity = 0;
    this.markInterest();
  }

  /**
   * Power Nap - UFO takes a rest when tired
   */
  private updateNapping(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.narrativeTimer += speedMult;

    switch (u.narrativePhase) {
      case "detection":
        // Yawning
        this.triggerWobble("yawn_stretch");
        u.narrativePhase = "approach";
        u.narrativeTimer = 0;
        u.napStartY = u.y;
        break;

      case "approach":
        // Settling down - drift to a quiet corner
        const targetX = this.dimensions.width * 0.85;
        const targetY = this.dimensions.height * 0.2;

        const dx = targetX - u.x;
        const dy = targetY - u.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 20) {
          const speed = this.config.speed * this.dimensions.width * speedMult * 0.3;
          u.x += (dx / dist) * speed;
          u.y += (dy / dist) * speed;
        } else {
          u.narrativePhase = "action";
          u.narrativeTimer = 0;
        }
        break;

      case "action":
        // Sleeping - very still, gentle bob, Zzz particles
        u.beamIntensity = 0;
        u.beamTarget = null;

        // Slow, deep hover bob
        u.y += Math.sin(u.narrativeTimer * 0.02) * 0.3;

        // Lights dim
        u.opacity = Math.max(0.6, u.opacity - speedMult * 0.001);

        // Spawn Z particles occasionally
        if (Math.random() < 0.02 && u.sleepZs.length < 5) {
          u.sleepZs.push({
            x: u.x + 15,
            y: u.y - 10,
            targetX: u.x + 40 + Math.random() * 20,
            targetY: u.y - 60 - Math.random() * 40,
            progress: 0,
            color: "rgba(167, 139, 250, 0.8)",
            size: 8 + Math.random() * 4,
            type: "z",
          });
        }

        // Update Z particles
        u.sleepZs = u.sleepZs.filter((z) => {
          z.progress += speedMult * 0.008;
          const eased = z.progress;
          z.x = z.x + (z.targetX - z.x) * eased * 0.02;
          z.y = z.y + (z.targetY - z.y) * eased * 0.02;
          z.size *= 0.995; // Shrink slightly
          return z.progress < 1;
        });

        // Wake up after rest or if clicked (handled elsewhere)
        if (u.narrativeTimer >= 600) {
          // 10 seconds nap
          u.narrativePhase = "resolution";
          u.narrativeTimer = 0;
        }
        break;

      case "resolution":
        // Waking up - stretch
        this.triggerWobble("yawn_stretch");
        u.opacity = Math.min(1, u.opacity + speedMult * 0.02);

        if (u.narrativeTimer >= 60) {
          // Refreshed!
          u.tiredness = Math.max(0, u.tiredness - 0.5);
          this.setMood("curious");
          u.narrativePhase = "transition";
          u.narrativeTimer = 0;
        }
        break;

      case "transition":
        u.sleepZs = [];
        if (u.narrativeTimer >= 30) {
          u.narrativePhase = "none";
          this.resumeWandering();
        }
        break;

      default:
        this.resumeWandering();
    }
  }

  /**
   * Start taking a nap
   */
  private startNapping(): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.state = "napping";
    u.stateTimer = 0;
    u.narrativePhase = "detection";
    u.narrativeTimer = 0;
    u.sleepZs = [];
    this.setMood("tired");
  }

  /**
   * Peek-a-boo - UFO hides and peeks when clicked
   */
  private updatePeekaboo(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.narrativeTimer += speedMult;

    if (u.state === "hiding") {
      switch (u.narrativePhase) {
        case "action":
          // Zip to hide position
          if (u.hidePosition) {
            const dx = u.hidePosition.x - u.x;
            const dy = u.hidePosition.y - u.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 10) {
              const speed = this.config.speed * this.dimensions.width * speedMult * 3;
              u.x += (dx / dist) * speed;
              u.y += (dy / dist) * speed;
            } else {
              u.narrativePhase = "resolution";
              u.narrativeTimer = 0;
              u.scale = 0.3; // Shrink while hiding
            }
          }
          break;

        case "resolution":
          // Wait hidden
          if (u.narrativeTimer >= 90) {
            u.state = "peeking";
            u.narrativePhase = "action";
            u.narrativeTimer = 0;
            u.peekProgress = 0;
          }
          break;
      }
    } else if (u.state === "peeking") {
      switch (u.narrativePhase) {
        case "action":
          // Slowly peek out
          u.peekProgress = Math.min(1, u.peekProgress + speedMult * 0.02);
          u.scale = 0.3 + u.peekProgress * 0.7;

          // Move slightly in peek direction
          u.x += Math.cos(u.peekDirection) * speedMult * 0.5;
          u.y += Math.sin(u.peekDirection) * speedMult * 0.5;

          if (u.peekProgress >= 1) {
            u.narrativePhase = "resolution";
            u.narrativeTimer = 0;
          }
          break;

        case "resolution":
          // Full reveal!
          this.triggerWobble("happy_bounce");
          this.setMood("playful");

          if (u.narrativeTimer >= 60) {
            u.narrativePhase = "transition";
            u.narrativeTimer = 0;
          }
          break;

        case "transition":
          if (u.narrativeTimer >= 30) {
            u.hidePosition = null;
            u.peekProgress = 0;
            u.narrativePhase = "none";
            this.resumeWandering();
          }
          break;
      }
    }
  }

  /**
   * Start peek-a-boo hide
   */
  private startHiding(): void {
    if (!this.ufo) return;
    const u = this.ufo;

    // Find a hide position (corner of screen)
    const corners = [
      { x: 50, y: 50 },
      { x: this.dimensions.width - 50, y: 50 },
      { x: 50, y: this.dimensions.height - 50 },
      { x: this.dimensions.width - 50, y: this.dimensions.height - 50 },
    ];

    // Pick farthest corner from current position
    let farthest = corners[0]!;
    let maxDist = 0;
    for (const corner of corners) {
      const dist = Math.sqrt(
        Math.pow(corner.x - u.x, 2) + Math.pow(corner.y - u.y, 2)
      );
      if (dist > maxDist) {
        maxDist = dist;
        farthest = corner;
      }
    }

    u.hidePosition = farthest;
    u.peekDirection = Math.atan2(u.y - farthest.y, u.x - farthest.x);
    u.state = "hiding";
    u.stateTimer = 0;
    u.narrativePhase = "action";
    u.narrativeTimer = 0;
    this.setMood("playful");
  }

  /**
   * Celebration - UFO celebrates a rare discovery
   */
  private updateCelebrating(speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.narrativeTimer += speedMult;

    switch (u.narrativePhase) {
      case "detection":
        // Lights flash in unison
        u.cameraFlashTimer = 15;
        this.setMood("excited");
        u.narrativePhase = "action";
        u.narrativeTimer = 0;
        u.celebrationSpinSpeed = 0.3;
        break;

      case "action":
        // Spinning and bouncing celebration
        u.spinAngle += u.celebrationSpinSpeed * speedMult;
        u.celebrationBouncePhase += speedMult * 0.15;
        u.y += Math.sin(u.celebrationBouncePhase) * 2;

        // Rainbow lights
        u.rainbowPhase += speedMult * 0.2;

        // Gradually slow spin
        u.celebrationSpinSpeed *= 0.995;

        if (u.narrativeTimer >= 180) {
          u.narrativePhase = "resolution";
          u.narrativeTimer = 0;
        }
        break;

      case "resolution":
        // Satisfied hover
        this.triggerWobble("happy_bounce");
        u.spinAngle *= 0.9;
        u.rainbowPhase += speedMult * 0.05;

        if (u.narrativeTimer >= 60) {
          u.narrativePhase = "transition";
          u.narrativeTimer = 0;
        }
        break;

      case "transition":
        u.rainbowPhase = 0;
        u.spinAngle = 0;
        if (u.narrativeTimer >= 30) {
          u.narrativePhase = "none";
          this.resumeWandering();
        }
        break;

      default:
        this.resumeWandering();
    }
  }

  /**
   * Start celebrating a rare discovery
   */
  private startCelebrating(): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.state = "celebrating";
    u.stateTimer = 0;
    u.narrativePhase = "detection";
    u.narrativeTimer = 0;
    u.rareDiscoveries++;
    this.markInterest();
  }

  /**
   * Following - UFO follows alongside another object
   */
  private updateFollowing(dim: Dimensions, speedMult: number): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.narrativeTimer += speedMult;

    // Check if buddy is still around
    const event = this.eventProvider?.();
    if (!event?.active) {
      this.triggerWobble("curious_tilt");
      this.setMood("bored");
      u.buddyTarget = null;
      u.narrativePhase = "none";
      this.resumeWandering();
      return;
    }

    // Update buddy position
    u.buddyTarget = {
      x: event.x,
      y: event.y,
      vx: event.vx ?? 0,
      vy: event.vy ?? 0,
    };

    switch (u.narrativePhase) {
      case "approach":
        // Move to parallel position
        {
          const targetX = event.x + u.buddyOffset;
          const targetY = event.y;
          const dx = targetX - u.x;
          const dy = targetY - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 30) {
            const speed = this.config.speed * dim.width * speedMult * 2;
            u.x += (dx / dist) * speed;
            u.y += (dy / dist) * speed;
          } else {
            u.narrativePhase = "action";
            u.narrativeTimer = 0;
            this.setMood("playful");
          }
        }
        break;

      case "action":
        // Flying alongside
        {
          const targetX = event.x + u.buddyOffset;
          const targetY = event.y;

          // Match buddy velocity
          u.x += (u.buddyTarget.vx ?? 0) * speedMult * 60;
          u.y += (u.buddyTarget.vy ?? 0) * speedMult * 60;

          // Correct drift
          u.x += (targetX - u.x) * 0.05;
          u.y += (targetY - u.y) * 0.05;

          // Friendly beam pulse
          u.beamTarget = { x: event.x, y: event.y };
          u.beamIntensity = 0.3 + Math.sin(u.narrativeTimer * 0.1) * 0.2;

          // Occasional playful up/down
          if (Math.random() < 0.01) {
            u.y += (Math.random() - 0.5) * 20;
          }

          // Break off after a while or at screen edge
          if (
            u.narrativeTimer >= 300 ||
            event.x < 100 ||
            event.x > dim.width - 100
          ) {
            u.narrativePhase = "resolution";
            u.narrativeTimer = 0;
          }
        }
        break;

      case "resolution":
        // Peel away
        u.buddyOffset += speedMult * 2;
        u.y -= speedMult;
        u.beamIntensity *= 0.95;

        if (u.narrativeTimer >= 60) {
          this.triggerWobble("curious_tilt"); // Wave goodbye
          u.narrativePhase = "transition";
          u.narrativeTimer = 0;
        }
        break;

      case "transition":
        u.beamTarget = null;
        if (u.narrativeTimer >= 60) {
          u.buddyTarget = null;
          u.narrativePhase = "none";
          this.resumeWandering();
        }
        break;

      default:
        this.resumeWandering();
    }
  }

  /**
   * Start following alongside an object
   */
  private startFollowing(event: EventPosition): void {
    if (!this.ufo) return;
    const u = this.ufo;

    u.state = "following";
    u.stateTimer = 0;
    u.narrativePhase = "approach";
    u.narrativeTimer = 0;
    u.buddyTarget = {
      x: event.x,
      y: event.y,
      vx: event.vx ?? 0,
      vy: event.vy ?? 0,
    };
    u.buddyOffset = 50 + Math.random() * 30;
    this.markInterest();
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
