import { injectable } from "inversify";
import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type {
  FishMarineLife,
  DepthLayer,
  FishSpecies,
  FinState,
  TailState,
  FishColorPalette,
  WakeParticle,
  SpineFin,
} from "../../domain/models/DeepOceanModels";
import { SPINE_CONFIGS, SWIM_PARAMS } from "../../domain/models/DeepOceanModels";
import type { IFishAnimator } from "../contracts/IFishAnimator";
import {
  DEPTH_LAYER_CONFIG,
  DEPTH_LAYER_DISTRIBUTION,
  FISH_MOVEMENT,
  BEHAVIOR_CONFIG,
  BEHAVIOR_TRANSITION_PROBABILITY,
  EDGE_AWARENESS,
  FLOCKING_CONFIG,
  SPAWN_CONFIG,
  FISH_COUNTS,
} from "../../domain/constants/fish-constants";
import { SpineChain } from "../../physics/SpineChain";

/**
 * Species configuration for procedural fish generation
 */
const SPECIES_CONFIG: Record<
  FishSpecies,
  {
    bodyAspect: [number, number]; // Length to height ratio
    bodyLength: [number, number]; // Base length in pixels
    finScale: number; // Overall fin size multiplier
    tailForkDepth: [number, number]; // How forked the tail is
    hasLargeFins: boolean; // Prominent dorsal/pectoral fins
    hasBioluminescence: boolean;
    eyeSize: [number, number]; // Relative to body height
    colors: FishColorPalette[];
  }
> = {
  tropical: {
    bodyAspect: [2.0, 2.5],
    bodyLength: [60, 90],
    finScale: 1.3,
    tailForkDepth: [0.2, 0.4],
    hasLargeFins: true,
    hasBioluminescence: false,
    eyeSize: [0.12, 0.16],
    colors: [
      // Clownfish - vibrant orange with white bands
      {
        bodyTop: "#ff6600",
        bodyBottom: "#ffaa00",
        accent: "#ffffff",
        eye: "#1a1a1a",
        finTint: "rgba(255, 150, 0, 0.7)",
      },
      // Blue Tang - electric blue with yellow
      {
        bodyTop: "#0066ff",
        bodyBottom: "#00ccff",
        accent: "#ffff00",
        eye: "#000033",
        finTint: "rgba(0, 150, 255, 0.6)",
      },
      // Angelfish - purple and gold
      {
        bodyTop: "#9933ff",
        bodyBottom: "#cc99ff",
        accent: "#ffcc00",
        eye: "#330066",
        finTint: "rgba(153, 51, 255, 0.6)",
      },
      // Parrotfish - hot pink and turquoise
      {
        bodyTop: "#ff3399",
        bodyBottom: "#ff99cc",
        accent: "#00ffcc",
        eye: "#330033",
        finTint: "rgba(255, 51, 153, 0.6)",
      },
      // Butterflyfish - bright yellow with black
      {
        bodyTop: "#ffdd00",
        bodyBottom: "#ffff66",
        accent: "#000000",
        eye: "#1a1a00",
        finTint: "rgba(255, 220, 0, 0.7)",
      },
      // Mandarin fish - orange and blue psychedelic
      {
        bodyTop: "#ff5500",
        bodyBottom: "#0088ff",
        accent: "#00ff88",
        eye: "#1a0033",
        finTint: "rgba(255, 100, 0, 0.6)",
      },
    ],
  },
  sleek: {
    bodyAspect: [3.5, 4.5],
    bodyLength: [80, 120],
    finScale: 0.7,
    tailForkDepth: [0.5, 0.7],
    hasLargeFins: false,
    hasBioluminescence: false,
    eyeSize: [0.08, 0.1],
    colors: [
      // Barracuda - silver with dark stripe
      {
        bodyTop: "#3a4a5c",
        bodyBottom: "#c0c8d0",
        accent: "#1a2a3a",
        eye: "#1a1a1a",
        finTint: "rgba(80, 100, 120, 0.5)",
      },
      // Tuna - metallic blue/silver
      {
        bodyTop: "#2255aa",
        bodyBottom: "#88aacc",
        accent: "#ffcc00",
        eye: "#0d1f2d",
        finTint: "rgba(34, 85, 170, 0.5)",
      },
      // Mahi-mahi - iridescent green/blue
      {
        bodyTop: "#00aa55",
        bodyBottom: "#88ddaa",
        accent: "#ffdd00",
        eye: "#003322",
        finTint: "rgba(0, 170, 85, 0.5)",
      },
      // Wahoo - electric blue stripe
      {
        bodyTop: "#445566",
        bodyBottom: "#aabbcc",
        accent: "#00aaff",
        eye: "#1a2233",
        finTint: "rgba(68, 85, 102, 0.5)",
      },
    ],
  },
  deep: {
    bodyAspect: [2.2, 2.8],
    bodyLength: [50, 80],
    finScale: 0.9,
    tailForkDepth: [0.1, 0.3],
    hasLargeFins: false,
    hasBioluminescence: true,
    eyeSize: [0.18, 0.24], // Large eyes for deep water
    colors: [
      // Classic anglerfish - dark with cyan glow
      {
        bodyTop: "#0a0a1a",
        bodyBottom: "#1a1a2a",
        accent: "#00ffff",
        eye: "#00ffff",
        finTint: "rgba(0, 255, 255, 0.4)",
      },
      // Purple deep sea - violet bioluminescence
      {
        bodyTop: "#0f0818",
        bodyBottom: "#1a1028",
        accent: "#cc66ff",
        eye: "#cc66ff",
        finTint: "rgba(204, 102, 255, 0.4)",
      },
      // Green abyss - eerie green glow
      {
        bodyTop: "#080f0a",
        bodyBottom: "#101a12",
        accent: "#00ff88",
        eye: "#00ff88",
        finTint: "rgba(0, 255, 136, 0.4)",
      },
      // Pink deep - magenta bioluminescence
      {
        bodyTop: "#100810",
        bodyBottom: "#1a101a",
        accent: "#ff00ff",
        eye: "#ff66ff",
        finTint: "rgba(255, 0, 255, 0.4)",
      },
      // Multi-color alien - rainbow spots
      {
        bodyTop: "#0a0a14",
        bodyBottom: "#14142a",
        accent: "#00ffcc",
        eye: "#ff66cc",
        finTint: "rgba(0, 255, 204, 0.4)",
      },
    ],
  },
  schooling: {
    bodyAspect: [2.5, 3.0],
    bodyLength: [35, 55],
    finScale: 0.8,
    tailForkDepth: [0.3, 0.5],
    hasLargeFins: false,
    hasBioluminescence: false,
    eyeSize: [0.1, 0.12],
    colors: [
      // Sardines - silver blue shimmer
      {
        bodyTop: "#4488bb",
        bodyBottom: "#c0d8e8",
        accent: "#ffffff",
        eye: "#1b4f72",
        finTint: "rgba(68, 136, 187, 0.5)",
      },
      // Anchovies - green tint
      {
        bodyTop: "#558866",
        bodyBottom: "#b8d8c8",
        accent: "#ddffee",
        eye: "#145a32",
        finTint: "rgba(85, 136, 102, 0.5)",
      },
      // Neon tetras - red stripe
      {
        bodyTop: "#3366aa",
        bodyBottom: "#88bbee",
        accent: "#ff3333",
        eye: "#223366",
        finTint: "rgba(51, 102, 170, 0.5)",
      },
      // Golden shiners - gold flash
      {
        bodyTop: "#cc9933",
        bodyBottom: "#ffdd88",
        accent: "#ffffff",
        eye: "#664400",
        finTint: "rgba(204, 153, 51, 0.6)",
      },
    ],
  },
};

/**
 * Fin physics configuration
 */
const FIN_PHYSICS = {
  // Spring constants
  stiffness: 0.15, // How quickly fin returns to target
  damping: 0.85, // How quickly oscillations die down

  // Response to movement
  accelerationResponse: 0.3, // How much fins respond to speed changes
  turnResponse: 0.5, // How much fins respond to turning

  // Idle animation
  idleWave: {
    amplitude: 0.08,
    speed: 0.02,
  },

  // Tail specific
  tail: {
    waveSpeed: 0.12, // Tail undulation speed
    waveAmplitude: 0.25, // How much tail waves
    forkSpread: 0.15, // How much fork opens during motion
  },
};

/**
 * Wake trail configuration
 */
const WAKE_CONFIG = {
  spawnInterval: 0.08, // Seconds between wake particles
  particleCount: 8, // Max particles per fish
  sizeRange: [2, 6] as [number, number],
  lifetime: 1.2, // Seconds
  fadeStart: 0.5, // Start fading at this fraction of lifetime
};

/**
 * Body flex configuration
 */
const BODY_FLEX = {
  swimSpeed: 0.08, // Phase speed for swimming motion
  amplitude: {
    cruising: 0.15,
    darting: 0.25,
    turning: 0.3,
  },
};

@injectable()
export class FishAnimator implements IFishAnimator {
  private pendingSpawns: number[] = [];
  private nextSchoolId = 0;
  private spineChains: Map<FishMarineLife, SpineChain> = new Map();

  async initializeFish(
    dimensions: Dimensions,
    count: number,
    useSpineChain: boolean = true // Spine-chain enabled by default for organic animation
  ): Promise<FishMarineLife[]> {
    const fish: FishMarineLife[] = [];
    for (let i = 0; i < count; i++) {
      fish.push(this.createFish(dimensions, useSpineChain));
    }

    this.formSchools(fish);
    return fish;
  }

  createFish(dimensions: Dimensions, useSpineChain: boolean = true): FishMarineLife {
    // Assign depth layer and species
    const depthLayer = this.assignDepthLayer();
    const species = this.assignSpecies(depthLayer);
    const config = DEPTH_LAYER_CONFIG[depthLayer];
    const speciesConfig = SPECIES_CONFIG[species];

    // Calculate size
    const depthScale = this.randomInRange(config.scale);
    const bodyLength =
      this.randomInRange(speciesConfig.bodyLength) * depthScale;
    const bodyAspect = this.randomInRange(speciesConfig.bodyAspect);
    const bodyHeight = bodyLength / bodyAspect;

    // Color palette
    const colors =
      speciesConfig.colors[
        Math.floor(Math.random() * speciesConfig.colors.length)
      ] ?? speciesConfig.colors[0]!;

    // Direction and position
    const direction: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
    const depthBand = {
      min: dimensions.height * config.verticalBand[0],
      max: dimensions.height * config.verticalBand[1],
    };

    const maxOffset = Math.max(
      SPAWN_CONFIG.offScreenBuffer,
      dimensions.width * FISH_MOVEMENT.spawnOffset.fractionOfWidth
    );

    const startX =
      direction === 1
        ? -bodyLength - Math.random() * maxOffset
        : dimensions.width + bodyLength + Math.random() * maxOffset;
    const baseY =
      depthBand.min + Math.random() * (depthBand.max - depthBand.min);

    const baseSpeed =
      this.randomInRange(FISH_MOVEMENT.baseSpeed) * config.speedMultiplier;
    const opacity = this.randomInRange(config.opacity);

    // Create fin states
    const finScale = speciesConfig.finScale;
    const dorsalFin = this.createFinState(0.35 * finScale, 0.2 * finScale);
    const pectoralFinTop = this.createFinState(0.25 * finScale, 0.15 * finScale);
    const pectoralFinBottom = this.createFinState(
      0.2 * finScale,
      0.12 * finScale
    );
    const pelvicFin = this.createFinState(0.15 * finScale, 0.1 * finScale);
    const analFin = this.createFinState(0.18 * finScale, 0.1 * finScale);
    const tailFin = this.createTailState(
      0.4 * finScale,
      0.3 * finScale,
      this.randomInRange(speciesConfig.tailForkDepth)
    );

    const fish: FishMarineLife = {
      type: "fish",
      species,
      colors,

      // Body dimensions
      bodyLength,
      bodyHeight,
      bodyAspect,

      // Position and movement
      x: startX,
      y: baseY,
      baseY,
      direction,
      speed: baseSpeed,
      baseSpeed,
      verticalDrift: (Math.random() - 0.5) * FISH_MOVEMENT.verticalDrift * 2,
      bobAmplitude: this.randomInRange(FISH_MOVEMENT.bobAmplitude),
      bobSpeed: this.randomInRange(FISH_MOVEMENT.bobSpeed),
      depthBand,

      // Depth/parallax
      depthLayer,
      depthScale,

      // Behavior
      behavior: "cruising",
      behaviorTimer: this.randomInRange(BEHAVIOR_CONFIG.cruising.duration),

      // Body animation
      rotation: 0,
      bodyFlexPhase: Math.random() * Math.PI * 2,
      bodyFlexAmount: BODY_FLEX.amplitude.cruising,

      // Fins with physics
      dorsalFin,
      pectoralFinTop,
      pectoralFinBottom,
      pelvicFin,
      analFin,
      tailFin,

      // Visual details
      opacity,
      animationPhase: Math.random() * Math.PI * 2,
      scalePhase: Math.random() * Math.PI * 2,
      scaleSpeed: 0.01 + Math.random() * 0.01,
      eyeSize: this.randomInRange(speciesConfig.eyeSize),
      gillPhase: Math.random() * Math.PI * 2,
      gillSpeed: 0.03 + Math.random() * 0.02,
      hasBioluminescence: speciesConfig.hasBioluminescence,
      glowPhase: Math.random() * Math.PI * 2,
      glowIntensity: speciesConfig.hasBioluminescence ? 0.3 + Math.random() * 0.4 : 0,

      // Wake effects
      wakeTrail: [],
      lastWakeSpawn: 0,

      // Legacy compatibility
      width: bodyLength,
      height: bodyHeight,
      tailPhase: Math.random() * Math.PI * 2,
    };

    // Initialize spine chain if enabled
    if (useSpineChain) {
      this.initializeSpineChain(fish, startX, baseY, direction);
    }

    return fish;
  }

  /**
   * Initialize spine chain for organic animation
   */
  private initializeSpineChain(
    fish: FishMarineLife,
    startX: number,
    startY: number,
    direction: 1 | -1
  ): void {
    const spineConfig = SPINE_CONFIGS[fish.species];
    const swimParams = SWIM_PARAMS[fish.species];

    // Calculate segment length based on body length
    const segmentLength = fish.bodyLength / (spineConfig.jointCount - 1);

    // Create spine chain
    const spine = new SpineChain(
      { ...spineConfig, segmentLength },
      startX,
      startY,
      direction
    );

    // Set width profile scaled to body height
    const maxWidth = fish.bodyHeight / 2;
    spine.setWidthProfile(spineConfig.widthProfile, maxWidth);

    // Store spine chain reference
    this.spineChains.set(fish, spine);

    // Copy joint data to fish for rendering
    fish.useSpineChain = true;
    fish.spineConfig = spineConfig;
    fish.spineJoints = spine.joints.map((j) => ({ ...j }));
    fish.swimPhase = Math.random() * Math.PI * 2;
    fish.tailAmplitude = swimParams.tailAmplitude * (fish.bodyHeight / 20);
    fish.swimSpeed = swimParams.swimSpeed;

    // Create spine-attached fins
    fish.spineFins = this.createSpineFins(fish.species, spineConfig.jointCount);
  }

  /**
   * Create fins attached to spine segments
   */
  private createSpineFins(species: FishSpecies, jointCount: number): SpineFin[] {
    const fins: SpineFin[] = [];

    // Dorsal fin (top, around segment 2-3)
    fins.push({
      attachmentSegment: Math.floor(jointCount * 0.25),
      attachmentSide: "top",
      baseAngle: -Math.PI / 2,
      length: species === "tropical" ? 0.35 : 0.25,
      width: 0.15,
      segments: 5,
      curvatureResponse: 0.5,
    });

    // Pectoral fins (sides, around segment 1-2)
    const pectoralSegment = Math.floor(jointCount * 0.15);
    fins.push({
      attachmentSegment: pectoralSegment,
      attachmentSide: "left",
      baseAngle: -Math.PI / 4,
      length: species === "tropical" ? 0.25 : 0.15,
      width: 0.12,
      segments: 4,
      curvatureResponse: 0.8,
    });
    fins.push({
      attachmentSegment: pectoralSegment,
      attachmentSide: "right",
      baseAngle: Math.PI / 4,
      length: species === "tropical" ? 0.25 : 0.15,
      width: 0.12,
      segments: 4,
      curvatureResponse: 0.8,
    });

    // Pelvic fins (bottom, around segment 3-4)
    fins.push({
      attachmentSegment: Math.floor(jointCount * 0.4),
      attachmentSide: "bottom",
      baseAngle: Math.PI / 2.5,
      length: 0.12,
      width: 0.08,
      segments: 3,
      curvatureResponse: 0.3,
    });

    // Anal fin (bottom, around segment 5-6)
    fins.push({
      attachmentSegment: Math.floor(jointCount * 0.65),
      attachmentSide: "bottom",
      baseAngle: Math.PI / 2.2,
      length: 0.15,
      width: 0.08,
      segments: 4,
      curvatureResponse: 0.4,
    });

    return fins;
  }

  /**
   * Get spine chain for a fish (for external access)
   */
  getSpineChain(fish: FishMarineLife): SpineChain | undefined {
    return this.spineChains.get(fish);
  }

  private createFinState(length: number, width: number): FinState {
    return {
      angle: 0,
      velocity: 0,
      targetAngle: 0,
      length,
      width,
      segments: 5,
    };
  }

  private createTailState(
    length: number,
    width: number,
    forkDepth: number
  ): TailState {
    return {
      angle: 0,
      velocity: 0,
      targetAngle: 0,
      length,
      width,
      segments: 7,
      forkAngle: 0.3 + Math.random() * 0.2,
      forkDepth,
      wavePhase: Math.random() * Math.PI * 2,
      waveAmplitude: FIN_PHYSICS.tail.waveAmplitude,
    };
  }

  private assignSpecies(depthLayer: DepthLayer): FishSpecies {
    // Deep layer gets deep species
    if (depthLayer === "far") {
      const roll = Math.random();
      if (roll < 0.4) return "deep";
      if (roll < 0.7) return "schooling";
      return "sleek";
    }

    // Mid layer is mixed
    if (depthLayer === "mid") {
      const roll = Math.random();
      if (roll < 0.25) return "tropical";
      if (roll < 0.5) return "sleek";
      if (roll < 0.8) return "schooling";
      return "deep";
    }

    // Near layer favors tropical and sleek
    const roll = Math.random();
    if (roll < 0.4) return "tropical";
    if (roll < 0.7) return "sleek";
    if (roll < 0.9) return "schooling";
    return "deep";
  }

  updateFish(
    fish: FishMarineLife[],
    dimensions: Dimensions,
    frameMultiplier: number,
    animationTime: number
  ): FishMarineLife[] {
    const updatedFish: FishMarineLife[] = [];
    const deltaSeconds = 0.016 * frameMultiplier;

    // Apply flocking forces to schooling fish
    this.applyFlockingForces(fish, deltaSeconds);

    // Update each fish
    for (const f of fish) {
      // Update behavior timer
      f.behaviorTimer -= deltaSeconds;
      if (f.behaviorTimer <= 0) {
        this.transitionBehavior(f, dimensions);
      }

      // Apply behavior-specific movement
      this.applyBehavior(f, deltaSeconds, frameMultiplier, dimensions);

      // Update animation based on mode
      if (f.useSpineChain) {
        // Spine-chain animation (organic)
        this.updateSpineChain(f, deltaSeconds, frameMultiplier);
      } else {
        // Legacy animation
        this.updateBodyFlex(f, frameMultiplier);
        this.updateFinPhysics(f, frameMultiplier);
      }

      // Update visual animations
      this.updateVisuals(f, frameMultiplier);

      // Update wake trail
      this.updateWakeTrail(f, deltaSeconds, animationTime);

      // Update bioluminescence
      if (f.hasBioluminescence) {
        this.updateBioluminescence(f, frameMultiplier);
      }

      // Check if off screen
      if (this.isOffScreen(f, dimensions)) {
        this.scheduleSpawn(
          animationTime + this.randomInRange(SPAWN_CONFIG.respawnDelay)
        );
        // Clean up spine chain reference
        this.spineChains.delete(f);
      } else {
        updatedFish.push(f);
      }
    }

    return updatedFish;
  }

  // ===========================================================================
  // SPINE CHAIN PHYSICS (Organic Animation)
  // ===========================================================================

  /**
   * Update spine chain for organic swimming motion
   */
  private updateSpineChain(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number
  ): void {
    const spine = this.spineChains.get(fish);
    if (!spine || !fish.swimPhase || !fish.tailAmplitude || !fish.swimSpeed) {
      return;
    }

    // Update swim phase (drives tail oscillation)
    const speedRatio = fish.speed / fish.baseSpeed;
    fish.swimPhase += fish.swimSpeed * speedRatio * frameMultiplier;

    // Calculate head target position
    // fish.speed is in pixels per second, deltaSeconds is ~0.016 per frame
    const headTargetX = fish.x + fish.direction * fish.speed * deltaSeconds;
    const bob = Math.sin(fish.animationPhase) * fish.bobAmplitude;
    const headTargetY = fish.baseY + bob;

    // Apply tail oscillation
    spine.applyTailOscillation(
      fish.tailAmplitude * speedRatio,
      fish.swimPhase
    );

    // Update spine chain (head follows target, body follows head)
    spine.update(headTargetX, headTargetY);

    // Update fish position from spine head
    fish.x = spine.head.x;
    fish.y = spine.head.y;

    // Update rotation from spine head angle
    fish.rotation = spine.headAngle;
    if (fish.direction === -1) {
      fish.rotation += Math.PI;
    }

    // Copy spine joint data back to fish for rendering
    fish.spineJoints = spine.joints.map((j) => ({ ...j }));
  }

  // ===========================================================================
  // FIN PHYSICS
  // ===========================================================================

  private updateFinPhysics(fish: FishMarineLife, frameMultiplier: number): void {
    const speedRatio = fish.speed / fish.baseSpeed;
    const isTurning = fish.behavior === "turning";
    const isDarting = fish.behavior === "darting";

    // Calculate target angles based on movement
    const baseResponse = isTurning
      ? FIN_PHYSICS.turnResponse
      : isDarting
        ? FIN_PHYSICS.accelerationResponse * 1.5
        : FIN_PHYSICS.accelerationResponse;

    // Idle wave animation
    const idleWave =
      Math.sin(fish.animationPhase * FIN_PHYSICS.idleWave.speed * 60) *
      FIN_PHYSICS.idleWave.amplitude;

    // Update each fin with spring physics
    this.updateSingleFin(
      fish.dorsalFin,
      idleWave * 0.5,
      baseResponse,
      frameMultiplier
    );
    this.updateSingleFin(
      fish.pectoralFinTop,
      -idleWave * 0.8 + (speedRatio - 1) * 0.2,
      baseResponse,
      frameMultiplier
    );
    this.updateSingleFin(
      fish.pectoralFinBottom,
      idleWave * 0.8 + (speedRatio - 1) * 0.2,
      baseResponse,
      frameMultiplier
    );
    this.updateSingleFin(
      fish.pelvicFin,
      idleWave * 0.4,
      baseResponse * 0.5,
      frameMultiplier
    );
    this.updateSingleFin(
      fish.analFin,
      idleWave * 0.3,
      baseResponse * 0.5,
      frameMultiplier
    );

    // Tail has more complex motion
    this.updateTailFin(fish, speedRatio, frameMultiplier);
  }

  private updateSingleFin(
    fin: FinState,
    targetOffset: number,
    response: number,
    frameMultiplier: number
  ): void {
    // Set target angle
    fin.targetAngle = targetOffset;

    // Spring physics
    const displacement = fin.targetAngle - fin.angle;
    const springForce = displacement * FIN_PHYSICS.stiffness;
    fin.velocity += springForce * frameMultiplier;
    fin.velocity *= FIN_PHYSICS.damping;
    fin.angle += fin.velocity * frameMultiplier;
  }

  private updateTailFin(
    fish: FishMarineLife,
    speedRatio: number,
    frameMultiplier: number
  ): void {
    const tail = fish.tailFin;

    // Update wave phase based on speed
    tail.wavePhase += FIN_PHYSICS.tail.waveSpeed * speedRatio * frameMultiplier;

    // Calculate tail angle from swimming motion
    const swimAngle =
      Math.sin(tail.wavePhase) * tail.waveAmplitude * speedRatio;
    tail.targetAngle = swimAngle;

    // Spring physics for main angle
    const displacement = tail.targetAngle - tail.angle;
    const springForce = displacement * FIN_PHYSICS.stiffness * 1.5; // Stiffer tail
    tail.velocity += springForce * frameMultiplier;
    tail.velocity *= FIN_PHYSICS.damping;
    tail.angle += tail.velocity * frameMultiplier;

    // Fork spread based on speed
    tail.forkAngle =
      0.3 + speedRatio * FIN_PHYSICS.tail.forkSpread + Math.abs(swimAngle) * 0.1;
  }

  // ===========================================================================
  // BODY FLEX ANIMATION
  // ===========================================================================

  private updateBodyFlex(fish: FishMarineLife, frameMultiplier: number): void {
    // Update phase
    const speedRatio = fish.speed / fish.baseSpeed;
    fish.bodyFlexPhase += BODY_FLEX.swimSpeed * speedRatio * frameMultiplier;

    // Set flex amount based on behavior
    switch (fish.behavior) {
      case "darting":
        fish.bodyFlexAmount = BODY_FLEX.amplitude.darting;
        break;
      case "turning":
        fish.bodyFlexAmount = BODY_FLEX.amplitude.turning;
        break;
      default:
        fish.bodyFlexAmount = BODY_FLEX.amplitude.cruising;
    }
  }

  // ===========================================================================
  // WAKE TRAIL
  // ===========================================================================

  private updateWakeTrail(
    fish: FishMarineLife,
    deltaSeconds: number,
    animationTime: number
  ): void {
    // Age existing particles
    for (let i = fish.wakeTrail.length - 1; i >= 0; i--) {
      const particle = fish.wakeTrail[i]!;
      particle.age += deltaSeconds / WAKE_CONFIG.lifetime;

      // Fade out
      if (particle.age > WAKE_CONFIG.fadeStart) {
        particle.opacity =
          1 - (particle.age - WAKE_CONFIG.fadeStart) / (1 - WAKE_CONFIG.fadeStart);
      }

      // Remove dead particles
      if (particle.age >= 1) {
        fish.wakeTrail.splice(i, 1);
      }
    }

    // Spawn new particles
    if (
      animationTime - fish.lastWakeSpawn > WAKE_CONFIG.spawnInterval &&
      fish.wakeTrail.length < WAKE_CONFIG.particleCount
    ) {
      const speedRatio = fish.speed / fish.baseSpeed;

      // Only spawn wake when moving fast enough
      if (speedRatio > 0.5) {
        const tailX = fish.x - fish.direction * fish.bodyLength * 0.4;
        const particle: WakeParticle = {
          x: tailX + (Math.random() - 0.5) * fish.bodyHeight * 0.3,
          y: fish.y + (Math.random() - 0.5) * fish.bodyHeight * 0.3,
          age: 0,
          size: this.randomInRange(WAKE_CONFIG.sizeRange) * speedRatio,
          opacity: 0.3 + speedRatio * 0.3,
        };
        fish.wakeTrail.push(particle);
        fish.lastWakeSpawn = animationTime;
      }
    }
  }

  // ===========================================================================
  // BIOLUMINESCENCE
  // ===========================================================================

  private updateBioluminescence(
    fish: FishMarineLife,
    frameMultiplier: number
  ): void {
    fish.glowPhase += 0.02 * frameMultiplier;

    // Pulsing glow
    const pulse = 0.5 + Math.sin(fish.glowPhase) * 0.3;
    const burst = Math.random() < 0.002 ? 0.5 : 0; // Occasional bright flash

    fish.glowIntensity = Math.min(1, pulse + burst);
  }

  // ===========================================================================
  // VISUAL UPDATES
  // ===========================================================================

  private updateVisuals(fish: FishMarineLife, frameMultiplier: number): void {
    // Animation phase (for bobbing, etc)
    fish.animationPhase += fish.bobSpeed * frameMultiplier;

    // Scale shimmer
    fish.scalePhase += fish.scaleSpeed * frameMultiplier;

    // Gill breathing
    fish.gillPhase += fish.gillSpeed * frameMultiplier;

    // Tail phase (legacy + additional animation)
    fish.tailPhase = fish.tailFin.wavePhase;

    // Rotation based on vertical drift
    if (fish.behavior === "cruising" || fish.behavior === "schooling") {
      const targetRotation = fish.verticalDrift * 0.02 * fish.direction;
      fish.rotation += (targetRotation - fish.rotation) * 0.1;
    }
  }

  // ===========================================================================
  // FLOCKING BEHAVIOR (Boids Algorithm)
  // ===========================================================================

  private applyFlockingForces(
    fish: FishMarineLife[],
    deltaSeconds: number
  ): void {
    const schoolingFish = fish.filter(
      (f) => f.behavior === "schooling" && f.schoolId !== undefined
    );
    if (schoolingFish.length < 2) return;

    // Group by school
    const schools = new Map<number, FishMarineLife[]>();
    for (const f of schoolingFish) {
      const id = f.schoolId!;
      if (!schools.has(id)) schools.set(id, []);
      schools.get(id)!.push(f);
    }

    // Apply flocking within each school
    for (const [, members] of schools) {
      if (members.length < 2) continue;

      for (const f of members) {
        const forces = this.calculateFlockingForces(f, members);
        this.applySteeringForce(f, forces, deltaSeconds);
      }
    }
  }

  private calculateFlockingForces(
    fish: FishMarineLife,
    schoolmates: FishMarineLife[]
  ): { x: number; y: number } {
    let separationX = 0,
      separationY = 0,
      separationCount = 0;
    let alignmentX = 0,
      alignmentY = 0,
      alignmentCount = 0;
    let cohesionX = 0,
      cohesionY = 0,
      cohesionCount = 0;

    for (const other of schoolmates) {
      if (other === fish) continue;

      const dx = other.x - fish.x;
      const dy = other.y - fish.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Separation: steer away from nearby fish
      if (distance < FLOCKING_CONFIG.separation.radius && distance > 0) {
        separationX -= dx / distance;
        separationY -= dy / distance;
        separationCount++;
      }

      // Alignment: match heading of nearby fish
      if (distance < FLOCKING_CONFIG.alignment.radius) {
        alignmentX += other.direction * other.speed;
        alignmentY += other.verticalDrift;
        alignmentCount++;
      }

      // Cohesion: steer toward center of mass
      if (distance < FLOCKING_CONFIG.cohesion.radius) {
        cohesionX += other.x;
        cohesionY += other.y;
        cohesionCount++;
      }
    }

    let forceX = 0,
      forceY = 0;

    if (separationCount > 0) {
      forceX +=
        (separationX / separationCount) * FLOCKING_CONFIG.separation.weight;
      forceY +=
        (separationY / separationCount) * FLOCKING_CONFIG.separation.weight;
    }

    if (alignmentCount > 0) {
      const avgVx = alignmentX / alignmentCount;
      const avgVy = alignmentY / alignmentCount;
      forceX +=
        (avgVx - fish.direction * fish.speed) *
        FLOCKING_CONFIG.alignment.weight *
        0.01;
      forceY +=
        (avgVy - fish.verticalDrift) * FLOCKING_CONFIG.alignment.weight * 0.1;
    }

    if (cohesionCount > 0) {
      const centerX = cohesionX / cohesionCount;
      const centerY = cohesionY / cohesionCount;
      forceX += (centerX - fish.x) * FLOCKING_CONFIG.cohesion.weight * 0.001;
      forceY += (centerY - fish.y) * FLOCKING_CONFIG.cohesion.weight * 0.01;
    }

    return { x: forceX, y: forceY };
  }

  private applySteeringForce(
    fish: FishMarineLife,
    force: { x: number; y: number },
    deltaSeconds: number
  ): void {
    const maxForce = FLOCKING_CONFIG.maxSteeringForce;
    const magnitude = Math.sqrt(force.x * force.x + force.y * force.y);

    if (magnitude > maxForce) {
      force.x = (force.x / magnitude) * maxForce;
      force.y = (force.y / magnitude) * maxForce;
    }

    // Apply to vertical drift (horizontal direction is more stable)
    fish.verticalDrift += force.y * deltaSeconds * 60;
    fish.verticalDrift = Math.max(
      -FISH_MOVEMENT.verticalDrift,
      Math.min(FISH_MOVEMENT.verticalDrift, fish.verticalDrift)
    );
  }

  // ===========================================================================
  // BEHAVIOR STATE MACHINE
  // ===========================================================================

  private applyBehavior(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number,
    _dimensions: Dimensions
  ): void {
    switch (fish.behavior) {
      case "cruising":
      case "schooling":
        this.applyCruising(fish, deltaSeconds, frameMultiplier);
        break;
      case "turning":
        this.applyTurning(fish, deltaSeconds);
        break;
      case "darting":
        this.applyDarting(fish, deltaSeconds);
        break;
    }

    // Clamp to depth band
    fish.baseY = Math.max(
      fish.depthBand.min,
      Math.min(fish.depthBand.max, fish.baseY)
    );
  }

  private applyCruising(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number
  ): void {
    fish.animationPhase += fish.bobSpeed * frameMultiplier;
    fish.x += fish.direction * fish.speed * deltaSeconds;
    fish.baseY += fish.verticalDrift * deltaSeconds;

    const bob = Math.sin(fish.animationPhase) * fish.bobAmplitude;
    fish.y = fish.baseY + bob;
  }

  private applyTurning(fish: FishMarineLife, deltaSeconds: number): void {
    fish.speed = fish.baseSpeed * BEHAVIOR_CONFIG.turning.speedMultiplier;
    fish.x += fish.direction * fish.speed * deltaSeconds;

    const turnProgress =
      1 - fish.behaviorTimer / BEHAVIOR_CONFIG.turning.duration;
    fish.rotation =
      fish.direction *
      Math.sin(turnProgress * Math.PI) *
      BEHAVIOR_CONFIG.turning.maxRotation;
  }

  private applyDarting(fish: FishMarineLife, deltaSeconds: number): void {
    fish.speed =
      fish.dartSpeed ??
      fish.baseSpeed * BEHAVIOR_CONFIG.darting.speedMultiplier[0];
    fish.x += fish.direction * fish.speed * deltaSeconds;
    fish.y += (Math.random() - 0.5) * 2; // Slight vertical jitter
  }

  private transitionBehavior(
    fish: FishMarineLife,
    dimensions: Dimensions
  ): void {
    const current = fish.behavior;

    // Complete turning: flip direction
    if (current === "turning") {
      fish.direction =
        fish.targetDirection ?? ((fish.direction * -1) as 1 | -1);
      fish.behavior = "cruising";
      fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
      fish.rotation = 0;
      fish.speed = fish.baseSpeed;
      return;
    }

    // Complete darting: return to cruise
    if (current === "darting") {
      fish.behavior = "cruising";
      fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
      fish.speed = fish.baseSpeed;
      return;
    }

    // Determine next behavior
    const edgeProximity = this.getEdgeProximity(fish, dimensions);
    const turnProbability =
      BEHAVIOR_TRANSITION_PROBABILITY.turn *
      (edgeProximity > 0 ? EDGE_AWARENESS.turnProbabilityMultiplier : 1);

    const roll = Math.random();

    if (roll < turnProbability || edgeProximity > 0.8) {
      // Turn (more likely near edges)
      fish.behavior = "turning";
      fish.behaviorTimer = BEHAVIOR_CONFIG.turning.duration;
      fish.targetDirection = this.getTurnDirection(fish, dimensions);
    } else if (roll < turnProbability + BEHAVIOR_TRANSITION_PROBABILITY.dart) {
      // Dart (startled)
      fish.behavior = "darting";
      fish.behaviorTimer = BEHAVIOR_CONFIG.darting.duration;
      fish.dartSpeed =
        fish.baseSpeed *
        this.randomInRange(BEHAVIOR_CONFIG.darting.speedMultiplier);
    } else {
      // Continue cruising
      fish.behavior = fish.schoolId !== undefined ? "schooling" : "cruising";
      fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
    }
  }

  private getEdgeProximity(
    fish: FishMarineLife,
    dimensions: Dimensions
  ): number {
    const warningZone = dimensions.width * EDGE_AWARENESS.warningZone;

    if (fish.direction === 1) {
      // Moving right, check right edge
      const distToEdge = dimensions.width - fish.x;
      if (distToEdge < warningZone) return 1 - distToEdge / warningZone;
    } else {
      // Moving left, check left edge
      if (fish.x < warningZone) return 1 - fish.x / warningZone;
    }
    return 0;
  }

  private getTurnDirection(
    fish: FishMarineLife,
    dimensions: Dimensions
  ): 1 | -1 {
    // Turn away from nearest edge
    const distToRight = dimensions.width - fish.x;
    const distToLeft = fish.x;
    return distToRight < distToLeft ? -1 : 1;
  }

  // ===========================================================================
  // SCHOOLING FORMATION
  // ===========================================================================

  private formSchools(fish: FishMarineLife[]): void {
    const targetSchoolFraction = FLOCKING_CONFIG.school.populationFraction;
    const [minSize, maxSize] = FLOCKING_CONFIG.school.size;
    const targetSchoolingCount = Math.floor(fish.length * targetSchoolFraction);

    let schooledCount = 0;

    while (schooledCount < targetSchoolingCount) {
      const schoolSize =
        minSize + Math.floor(Math.random() * (maxSize - minSize + 1));
      const available = fish.filter((f) => f.schoolId === undefined);

      if (available.length < schoolSize) break;

      const schoolId = this.nextSchoolId++;
      const leader = available[Math.floor(Math.random() * available.length)]!;
      leader.schoolId = schoolId;
      leader.behavior = "schooling";
      leader.behaviorTimer = this.randomInRange(
        BEHAVIOR_CONFIG.schooling.duration
      );

      // Add followers with matching direction
      const followers = available
        .filter((f) => f !== leader && f.schoolId === undefined)
        .slice(0, schoolSize - 1);

      for (const follower of followers) {
        follower.schoolId = schoolId;
        follower.behavior = "schooling";
        follower.behaviorTimer = this.randomInRange(
          BEHAVIOR_CONFIG.schooling.duration
        );
        follower.direction = leader.direction;
        // Position followers near leader
        follower.x = leader.x + (Math.random() - 0.5) * 80;
        follower.y = leader.y + (Math.random() - 0.5) * 40;
        follower.baseY = follower.y;
      }

      schooledCount += schoolSize;
    }
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  private assignDepthLayer(): DepthLayer {
    const roll = Math.random();
    if (roll < DEPTH_LAYER_DISTRIBUTION.farThreshold) return "far";
    if (roll < DEPTH_LAYER_DISTRIBUTION.midThreshold) return "mid";
    return "near";
  }

  private randomInRange(
    range: [number, number] | readonly [number, number]
  ): number {
    return range[0] + Math.random() * (range[1] - range[0]);
  }

  private isOffScreen(fish: FishMarineLife, dimensions: Dimensions): boolean {
    const buffer = fish.bodyLength + SPAWN_CONFIG.offScreenBuffer;
    return fish.x > dimensions.width + buffer || fish.x < -buffer;
  }

  getFishCount(quality: string): number {
    return FISH_COUNTS[quality] ?? 8;
  }

  scheduleSpawn(spawnTime: number): void {
    this.pendingSpawns.push(spawnTime);
  }

  processPendingSpawns(
    dimensions: Dimensions,
    currentTime: number
  ): FishMarineLife[] {
    const newFish: FishMarineLife[] = [];

    for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
      const spawnTime = this.pendingSpawns[i];
      if (spawnTime !== undefined && currentTime >= spawnTime) {
        newFish.push(this.createFish(dimensions));
        this.pendingSpawns.splice(i, 1);
      }
    }

    return newFish;
  }
}
