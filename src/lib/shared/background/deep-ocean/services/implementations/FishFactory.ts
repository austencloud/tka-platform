import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type {
  FishMarineLife,
  DepthLayer,
  FishSpecies,
  FinState,
  TailState,
  FishColorPalette,
} from "../../domain/models/DeepOceanModels";
import type { IFishFactory } from "../contracts/IFishFactory";
import type { IFishPersonalityGenerator } from "../contracts/IFishPersonalityGenerator";
import {
  DEPTH_LAYER_CONFIG,
  DEPTH_LAYER_DISTRIBUTION,
  FISH_MOVEMENT,
  BEHAVIOR_CONFIG,
  SPAWN_CONFIG,
  SPECIES_SPEED_MULTIPLIERS,
  DEPTH_TRANSITION,
} from "../../domain/constants/fish-constants";

/**
 * Maps depth layer to initial z value for 3D depth simulation.
 * z = 0 is closest to camera, z = 1 is farthest.
 */
const DEPTH_LAYER_TO_Z: Record<DepthLayer, number> = {
  near: 0.2,  // Close to camera (larger, faster)
  mid: 0.5,   // Middle distance
  far: 0.8,   // Far from camera (smaller, slower)
};
import { FishPersonalityGenerator } from "./FishPersonalityGenerator";

/**
 * Species configuration for procedural fish generation
 */
const SPECIES_CONFIG: Record<
  FishSpecies,
  {
    bodyAspect: [number, number];
    bodyLength: [number, number];
    finScale: number;
    tailForkDepth: [number, number];
    hasLargeFins: boolean;
    hasBioluminescence: boolean;
    eyeSize: [number, number];
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
      {
        bodyTop: "#ff6600",
        bodyBottom: "#ffaa00",
        accent: "#ffffff",
        eye: "#1a1a1a",
        finTint: "rgba(255, 150, 0, 0.7)",
      },
      {
        bodyTop: "#0066ff",
        bodyBottom: "#00ccff",
        accent: "#ffff00",
        eye: "#000033",
        finTint: "rgba(0, 150, 255, 0.6)",
      },
      {
        bodyTop: "#9933ff",
        bodyBottom: "#cc99ff",
        accent: "#ffcc00",
        eye: "#330066",
        finTint: "rgba(153, 51, 255, 0.6)",
      },
      {
        bodyTop: "#ff3399",
        bodyBottom: "#ff99cc",
        accent: "#00ffcc",
        eye: "#330033",
        finTint: "rgba(255, 51, 153, 0.6)",
      },
      {
        bodyTop: "#ffdd00",
        bodyBottom: "#ffff66",
        accent: "#000000",
        eye: "#1a1a00",
        finTint: "rgba(255, 220, 0, 0.7)",
      },
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
      {
        bodyTop: "#3a4a5c",
        bodyBottom: "#c0c8d0",
        accent: "#1a2a3a",
        eye: "#1a1a1a",
        finTint: "rgba(80, 100, 120, 0.5)",
      },
      {
        bodyTop: "#2255aa",
        bodyBottom: "#88aacc",
        accent: "#ffcc00",
        eye: "#0d1f2d",
        finTint: "rgba(34, 85, 170, 0.5)",
      },
      {
        bodyTop: "#00aa55",
        bodyBottom: "#88ddaa",
        accent: "#ffdd00",
        eye: "#003322",
        finTint: "rgba(0, 170, 85, 0.5)",
      },
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
    eyeSize: [0.18, 0.24],
    colors: [
      {
        bodyTop: "#0a0a1a",
        bodyBottom: "#1a1a2a",
        accent: "#00ffff",
        eye: "#00ffff",
        finTint: "rgba(0, 255, 255, 0.4)",
      },
      {
        bodyTop: "#0f0818",
        bodyBottom: "#1a1028",
        accent: "#cc66ff",
        eye: "#cc66ff",
        finTint: "rgba(204, 102, 255, 0.4)",
      },
      {
        bodyTop: "#080f0a",
        bodyBottom: "#101a12",
        accent: "#00ff88",
        eye: "#00ff88",
        finTint: "rgba(0, 255, 136, 0.4)",
      },
      {
        bodyTop: "#100810",
        bodyBottom: "#1a101a",
        accent: "#ff00ff",
        eye: "#ff66ff",
        finTint: "rgba(255, 0, 255, 0.4)",
      },
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
      {
        bodyTop: "#4488bb",
        bodyBottom: "#c0d8e8",
        accent: "#ffffff",
        eye: "#1b4f72",
        finTint: "rgba(68, 136, 187, 0.5)",
      },
      {
        bodyTop: "#558866",
        bodyBottom: "#b8d8c8",
        accent: "#ddffee",
        eye: "#145a32",
        finTint: "rgba(85, 136, 102, 0.5)",
      },
      {
        bodyTop: "#3366aa",
        bodyBottom: "#88bbee",
        accent: "#ff3333",
        eye: "#223366",
        finTint: "rgba(51, 102, 170, 0.5)",
      },
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
 * Fin physics configuration for tail creation
 */
const FIN_PHYSICS = {
  tail: {
    waveAmplitude: 0.25,
  },
};

/**
 * Body flex configuration
 */
const BODY_FLEX = {
  amplitude: {
    cruising: 0.15,
  },
};

/**
 * FishFactory - Creates and initializes fish entities
 *
 * Handles species assignment, body/fin generation, color selection,
 * personality generation, and initial positioning. Does not manage
 * spine chains or animations.
 */
export class FishFactory implements IFishFactory {
  private personalityGenerator: IFishPersonalityGenerator;

  /** Counter for generating unique fish IDs */
  private static nextFishId = 1;

  constructor(personalityGenerator?: IFishPersonalityGenerator) {
    this.personalityGenerator = personalityGenerator ?? new FishPersonalityGenerator();
  }

  initializeFish(
    dimensions: Dimensions,
    count: number,
    useSpineChain: boolean = true,
    spawnOnScreen: boolean = false
  ): FishMarineLife[] {
    const fish: FishMarineLife[] = [];
    for (let i = 0; i < count; i++) {
      fish.push(this.createFish(dimensions, useSpineChain, spawnOnScreen));
    }
    return fish;
  }

  createFish(
    dimensions: Dimensions,
    useSpineChain: boolean = true,
    spawnOnScreen: boolean = false
  ): FishMarineLife {
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

    let startX: number;
    if (spawnOnScreen) {
      // Spawn within visible area with some margin
      const margin = bodyLength;
      startX = margin + Math.random() * (dimensions.width - 2 * margin);
    } else {
      // Spawn off-screen (default behavior)
      const maxOffset = Math.max(
        SPAWN_CONFIG.offScreenBuffer,
        dimensions.width * FISH_MOVEMENT.spawnOffset.fractionOfWidth
      );
      startX =
        direction === 1
          ? -bodyLength - Math.random() * maxOffset
          : dimensions.width + bodyLength + Math.random() * maxOffset;
    }
    const baseY =
      depthBand.min + Math.random() * (depthBand.max - depthBand.min);

    // Apply species-specific speed multiplier on top of depth layer multiplier
    const speciesSpeedMult = this.randomInRange(SPECIES_SPEED_MULTIPLIERS[species]);
    const baseSpeed =
      this.randomInRange(FISH_MOVEMENT.baseSpeed) * config.speedMultiplier * speciesSpeedMult;
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

      // 3D Depth (UFO-style continuous z-axis)
      z: DEPTH_LAYER_TO_Z[depthLayer],
      targetZ: DEPTH_LAYER_TO_Z[depthLayer],

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
      glowIntensity: speciesConfig.hasBioluminescence
        ? 0.3 + Math.random() * 0.4
        : 0,

      // Wake effects
      wakeTrail: [],
      lastWakeSpawn: 0,

      // Legacy compatibility
      width: bodyLength,
      height: bodyHeight,
      tailPhase: Math.random() * Math.PI * 2,

      // Spine chain flag (actual initialization done by FishSpineController)
      useSpineChain,

      // Personality & Mood system
      personality: this.personalityGenerator.generatePersonality(species),
      mood: "calm",
      moodTimer: 0,
      lastStimulusTime: 0,
      energy: 0.7 + Math.random() * 0.3, // Start with 70-100% energy
      hunger: Math.random() * 0.3, // Start with low hunger
      wobbleType: "none",
      wobbleTimer: 0,
      wobbleIntensity: 0,

      // Social identity
      fishId: FishFactory.nextFishId++,
      socialMemory: new Set(),
    };

    // Home zone will be initialized by FishHomeZoneHandler after spawn

    return fish;
  }

  private assignDepthLayer(): DepthLayer {
    const roll = Math.random();
    if (roll < DEPTH_LAYER_DISTRIBUTION.farThreshold) return "far";
    if (roll < DEPTH_LAYER_DISTRIBUTION.midThreshold) return "mid";
    return "near";
  }

  private assignSpecies(depthLayer: DepthLayer): FishSpecies {
    if (depthLayer === "far") {
      const roll = Math.random();
      if (roll < 0.4) return "deep";
      if (roll < 0.7) return "schooling";
      return "sleek";
    }

    if (depthLayer === "mid") {
      const roll = Math.random();
      if (roll < 0.25) return "tropical";
      if (roll < 0.5) return "sleek";
      if (roll < 0.8) return "schooling";
      return "deep";
    }

    const roll = Math.random();
    if (roll < 0.4) return "tropical";
    if (roll < 0.7) return "sleek";
    if (roll < 0.9) return "schooling";
    return "deep";
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

  private randomInRange(
    range: [number, number] | readonly [number, number]
  ): number {
    return range[0] + Math.random() * (range[1] - range[0]);
  }
}
