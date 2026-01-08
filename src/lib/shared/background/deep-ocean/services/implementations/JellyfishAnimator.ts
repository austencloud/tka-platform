import { injectable } from "inversify";
import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type {
  JellyfishMarineLife,
  JellyfishSpecies,
  GonadConfig,
  OralArm,
  Tentacle,
  TentacleSegment,
} from "../../domain/models/DeepOceanModels";
import type { IJellyfishAnimator } from "../contracts/IJellyfishAnimator";
import { JELLYFISH_COUNTS } from "../../domain/constants/fish-constants";

/**
 * Jellyfish Configuration
 * Tuned for beautiful, realistic jellyfish movement
 */
const JELLYFISH_CONFIG = {
  // Size and positioning
  size: { min: 35, max: 70 },
  spawnMargin: 80,
  verticalBand: { min: 0.15, max: 0.75 },

  // Movement - slow and serene
  horizontalSpeed: 2, // Gentle sideways drift
  baseVerticalSpeed: -3, // Very slow upward drift
  pulseVerticalBoost: -8, // Subtle propulsion during contraction

  // Pulse animation - relaxed, dreamy rhythm
  pulseSpeed: { min: 0.12, max: 0.25 }, // Much slower pulses
  bellAspect: { min: 0.7, max: 0.9 }, // Height to width ratio

  // Anatomy
  frillCount: { min: 12, max: 20 },
  radialChannels: { min: 4, max: 8 },
  oralArmCount: { min: 4, max: 6 },
  tentacleCount: { min: 6, max: 12 }, // Fewer tentacles
  tentacleSegments: { min: 4, max: 7 }, // Shorter tentacles

  // Opacity
  opacity: { min: 0.5, max: 0.85 },

  // Bioluminescence - slow, hypnotic pulse
  glowIntensity: { min: 0.4, max: 0.8 },
  glowSpeed: { min: 0.08, max: 0.18 },

  // Tentacle physics - peaceful and flowing
  tentacleWaveSpeed: 0.006, // Very slow, dreamy wave motion
  tentacleDamping: 0.97, // High damping for smooth motion
  tentacleStiffness: 0.025, // Very soft and floppy
  tentacleWaveAmplitude: 0.12, // Subtle sway
};

/**
 * Species definitions with visual characteristics
 */
interface SpeciesDefinition {
  species: JellyfishSpecies;
  color: string;
  accent: string;
  detail: string;
  bellAspect: [number, number]; // [min, max]
  hasGonads: boolean;
  gonadLobes: number;
  frillIntensity: number; // 0-1, how prominent frills are
  tentacleLength: number; // multiplier
  tentacleCount: [number, number];
  glowIntensity: [number, number];
}

const SPECIES_DEFINITIONS: SpeciesDefinition[] = [
  // Moon jellyfish - classic with visible gonads
  {
    species: "moon",
    color: "#b8d4e8",
    accent: "#e8f4ff",
    detail: "#8bb8d8",
    bellAspect: [0.6, 0.75],
    hasGonads: true,
    gonadLobes: 4,
    frillIntensity: 0.3,
    tentacleLength: 0.8,
    tentacleCount: [4, 8],
    glowIntensity: [0.3, 0.5],
  },
  // Crystal jellyfish - transparent, bright glow
  {
    species: "crystal",
    color: "#c8e8f4",
    accent: "#f0ffff",
    detail: "#a8d8e8",
    bellAspect: [0.7, 0.85],
    hasGonads: false,
    gonadLobes: 0,
    frillIntensity: 0.6,
    tentacleLength: 1.2,
    tentacleCount: [8, 14],
    glowIntensity: [0.5, 0.8],
  },
  // Lion's mane - large with many tentacles
  {
    species: "lionsMane",
    color: "#d4a878",
    accent: "#f8d4a8",
    detail: "#c89858",
    bellAspect: [0.5, 0.65],
    hasGonads: true,
    gonadLobes: 4,
    frillIntensity: 0.8,
    tentacleLength: 1.8,
    tentacleCount: [12, 20],
    glowIntensity: [0.2, 0.4],
  },
  // Phantom - deep sea bioluminescent
  {
    species: "phantom",
    color: "#6858a8",
    accent: "#b898f8",
    detail: "#9878c8",
    bellAspect: [0.75, 0.9],
    hasGonads: false,
    gonadLobes: 0,
    frillIntensity: 0.4,
    tentacleLength: 1.0,
    tentacleCount: [6, 10],
    glowIntensity: [0.6, 0.9],
  },
  // Pink moon variant
  {
    species: "moon",
    color: "#e8b8c8",
    accent: "#ffd8e8",
    detail: "#d898a8",
    bellAspect: [0.6, 0.75],
    hasGonads: true,
    gonadLobes: 4,
    frillIntensity: 0.3,
    tentacleLength: 0.8,
    tentacleCount: [4, 8],
    glowIntensity: [0.3, 0.5],
  },
  // Blue phantom variant
  {
    species: "phantom",
    color: "#4878b8",
    accent: "#88c8f8",
    detail: "#6898d8",
    bellAspect: [0.75, 0.9],
    hasGonads: false,
    gonadLobes: 0,
    frillIntensity: 0.4,
    tentacleLength: 1.0,
    tentacleCount: [6, 10],
    glowIntensity: [0.6, 0.9],
  },
];

@injectable()
export class JellyfishAnimator implements IJellyfishAnimator {
  initializeJellyfish(
    dimensions: Dimensions,
    count: number
  ): JellyfishMarineLife[] {
    const jellyfish: JellyfishMarineLife[] = [];
    for (let i = 0; i < count; i++) {
      jellyfish.push(this.createJellyfish(dimensions));
    }
    return jellyfish;
  }

  createJellyfish(dimensions: Dimensions): JellyfishMarineLife {
    // Pick a random species
    const speciesIndex = Math.floor(Math.random() * SPECIES_DEFINITIONS.length);
    const speciesDef = SPECIES_DEFINITIONS[speciesIndex] ?? SPECIES_DEFINITIONS[0]!;

    const size = this.randomInRange(
      JELLYFISH_CONFIG.size.min,
      JELLYFISH_CONFIG.size.max
    );

    // Position
    const baseY =
      dimensions.height * JELLYFISH_CONFIG.verticalBand.min +
      Math.random() *
        dimensions.height *
        (JELLYFISH_CONFIG.verticalBand.max - JELLYFISH_CONFIG.verticalBand.min);

    const x =
      JELLYFISH_CONFIG.spawnMargin +
      Math.random() * (dimensions.width - JELLYFISH_CONFIG.spawnMargin * 2);

    // Species-specific anatomy
    const tentacleCount = this.randomIntInRange(
      speciesDef.tentacleCount[0],
      speciesDef.tentacleCount[1]
    );
    const oralArmCount = this.randomIntInRange(
      JELLYFISH_CONFIG.oralArmCount.min,
      JELLYFISH_CONFIG.oralArmCount.max
    );

    const oralArms = this.generateOralArms(oralArmCount);
    const tentacles = this.generateTentacles(
      tentacleCount,
      size,
      speciesDef.tentacleLength
    );

    // Generate gonads for species that have them
    const gonads = speciesDef.hasGonads
      ? this.generateGonads(speciesDef.gonadLobes, speciesDef.detail)
      : null;

    // Bell deformation seeds for asymmetric pulse
    const bellDeformSeeds = Array.from({ length: 8 }, () => Math.random());

    // Mesoglea vein pattern seeds
    const mesogleaSeeds = Array.from({ length: 12 }, () => Math.random());

    const pulseSpeed = this.randomInRange(
      JELLYFISH_CONFIG.pulseSpeed.min,
      JELLYFISH_CONFIG.pulseSpeed.max
    );

    return {
      type: "jellyfish",
      species: speciesDef.species,
      size,
      color: speciesDef.color,
      accentColor: speciesDef.accent,
      detailColor: speciesDef.detail,
      x,
      y: baseY,
      baseY,
      opacity: this.randomInRange(
        JELLYFISH_CONFIG.opacity.min,
        JELLYFISH_CONFIG.opacity.max
      ),
      animationPhase: Math.random() * Math.PI * 2,

      // Movement
      horizontalSpeed:
        (Math.random() - 0.5) * JELLYFISH_CONFIG.horizontalSpeed * 2,
      verticalSpeed: JELLYFISH_CONFIG.baseVerticalSpeed,

      // Pulse
      pulsePhase: Math.random(),
      pulseSpeed,
      bellAspect: this.randomInRange(speciesDef.bellAspect[0], speciesDef.bellAspect[1]),

      // Frills
      frillCount: Math.round(
        this.randomIntInRange(
          JELLYFISH_CONFIG.frillCount.min,
          JELLYFISH_CONFIG.frillCount.max
        ) * speciesDef.frillIntensity + 8
      ),
      frillPhase: Math.random() * Math.PI * 2,
      bellDeformSeeds,

      // Internal structure
      radialChannels: this.randomIntInRange(
        JELLYFISH_CONFIG.radialChannels.min,
        JELLYFISH_CONFIG.radialChannels.max
      ),
      oralArms,
      gonads,
      mesogleaSeeds,
      tentacles,

      // Bioluminescence
      glowIntensity: this.randomInRange(
        speciesDef.glowIntensity[0],
        speciesDef.glowIntensity[1]
      ),
      glowPhase: Math.random(),
      glowSpeed: this.randomInRange(
        JELLYFISH_CONFIG.glowSpeed.min,
        JELLYFISH_CONFIG.glowSpeed.max
      ),

      // Particle trail
      trailPositions: [],

      // Legacy compatibility
      tentacleSeeds: [],
      waveAmplitude: 0,
      waveFrequency: 0,
    };
  }

  /**
   * Generate gonads (the distinctive internal organs)
   */
  private generateGonads(lobeCount: number, color: string): GonadConfig {
    return {
      lobeCount,
      size: this.randomInRange(0.25, 0.35),
      rotation: Math.random() * Math.PI * 0.25, // Slight random rotation
      color,
    };
  }

  /**
   * Generate oral arms (thick inner tentacles)
   */
  private generateOralArms(count: number): OralArm[] {
    const arms: OralArm[] = [];
    for (let i = 0; i < count; i++) {
      const angle = ((i / count) * Math.PI - Math.PI / 2) * 0.8; // Spread across bottom
      arms.push({
        angle,
        length: this.randomInRange(0.8, 1.4),
        thickness: this.randomInRange(0.08, 0.15),
        phase: Math.random() * Math.PI * 2,
      });
    }
    return arms;
  }

  /**
   * Generate trailing tentacles with segments
   */
  private generateTentacles(
    count: number,
    jellySize: number,
    lengthMultiplier: number = 1.0
  ): Tentacle[] {
    const tentacles: Tentacle[] = [];

    for (let i = 0; i < count; i++) {
      // Distribute across bell width (-1 to 1)
      const originX = (i / (count - 1)) * 2 - 1;

      const segmentCount = this.randomIntInRange(
        JELLYFISH_CONFIG.tentacleSegments.min,
        JELLYFISH_CONFIG.tentacleSegments.max
      );

      const segments: TentacleSegment[] = [];
      // Shorter segment lengths for less distracting tentacles
      const baseLength = jellySize * this.randomInRange(0.08, 0.14) * lengthMultiplier;

      for (let j = 0; j < segmentCount; j++) {
        segments.push({
          angle: 0, // Will be animated
          length: baseLength * (1 - j * 0.05), // Taper more towards tip
          velocity: 0,
          phase: Math.random() * Math.PI * 2,
        });
      }

      tentacles.push({
        originX,
        segments,
        thickness: this.randomInRange(0.8, 1.8), // Thinner, more delicate
        opacity: this.randomInRange(0.3, 0.55), // Slightly more transparent
      });
    }

    return tentacles;
  }

  updateJellyfish(
    jellyfish: JellyfishMarineLife[],
    dimensions: Dimensions,
    frameMultiplier: number
  ): JellyfishMarineLife[] {
    const updatedJellyfish: JellyfishMarineLife[] = [];
    const deltaSeconds = 0.016 * frameMultiplier;

    for (const jelly of jellyfish) {
      // Update pulse phase
      jelly.pulsePhase += jelly.pulseSpeed * deltaSeconds;
      if (jelly.pulsePhase > 1) jelly.pulsePhase -= 1;

      // Calculate pulse-affected vertical speed
      // Jellyfish propel upward during contraction
      const pulseAmount = this.getPulseAmount(jelly.pulsePhase);
      const verticalBoost = pulseAmount * JELLYFISH_CONFIG.pulseVerticalBoost;
      const effectiveVerticalSpeed =
        JELLYFISH_CONFIG.baseVerticalSpeed + verticalBoost;

      // Update position
      jelly.x += jelly.horizontalSpeed * deltaSeconds;
      jelly.baseY += effectiveVerticalSpeed * deltaSeconds;
      jelly.y = jelly.baseY;

      // Update animation phases - slow and meditative
      jelly.animationPhase += 0.008 * frameMultiplier;
      jelly.frillPhase += 0.012 * frameMultiplier;
      jelly.glowPhase += jelly.glowSpeed * deltaSeconds;
      if (jelly.glowPhase > 1) jelly.glowPhase -= 1;

      // Update oral arm phases - gentle undulation
      for (const arm of jelly.oralArms) {
        arm.phase += 0.006 * frameMultiplier;
      }

      // Update tentacle physics
      this.updateTentaclePhysics(jelly, frameMultiplier, pulseAmount);

      // Update particle trail
      this.updateTrailPositions(jelly, frameMultiplier);

      // Check if off-screen
      const offScreen =
        jelly.x < -jelly.size * 2 ||
        jelly.x > dimensions.width + jelly.size * 2 ||
        jelly.y < -jelly.size * 3 ||
        jelly.y > dimensions.height + jelly.size * 2;

      if (offScreen) {
        // Respawn at bottom
        const newJelly = this.createJellyfish(dimensions);
        newJelly.y = dimensions.height + newJelly.size;
        newJelly.baseY = newJelly.y;
        updatedJellyfish.push(newJelly);
      } else {
        updatedJellyfish.push(jelly);
      }
    }

    return updatedJellyfish;
  }

  /**
   * Calculate pulse amount (0-1) with asymmetric timing
   */
  private getPulseAmount(phase: number): number {
    const normalizedPhase = phase % 1;
    if (normalizedPhase < 0.3) {
      return Math.sin((normalizedPhase / 0.3) * Math.PI * 0.5);
    } else {
      const relaxPhase = (normalizedPhase - 0.3) / 0.7;
      return Math.cos(relaxPhase * Math.PI * 0.5);
    }
  }

  /**
   * Update tentacle segment physics for fluid motion
   */
  private updateTentaclePhysics(
    jelly: JellyfishMarineLife,
    frameMultiplier: number,
    pulseAmount: number
  ): void {
    for (const tentacle of jelly.tentacles) {
      for (let i = 0; i < tentacle.segments.length; i++) {
        const segment = tentacle.segments[i];
        if (!segment) continue;

        // Depth factor - segments further down the tentacle move more
        const depthFactor = (i + 1) / tentacle.segments.length;

        // Gentle wave motion - slow, dreamy sway
        const waveTarget =
          Math.sin(segment.phase + jelly.animationPhase * 0.3) *
          JELLYFISH_CONFIG.tentacleWaveAmplitude *
          depthFactor;

        // Subtle pulse influence - tentacles barely respond to bell contraction
        const pulseSwing = pulseAmount * 0.05 * depthFactor;

        // Very gentle horizontal drift influence
        const driftInfluence =
          (jelly.horizontalSpeed * 0.003 * depthFactor);

        // Target angle with all influences
        const targetAngle = waveTarget + pulseSwing + driftInfluence;

        // Soft spring physics - slow, floppy response
        const angleDiff = targetAngle - segment.angle;
        segment.velocity +=
          angleDiff * JELLYFISH_CONFIG.tentacleStiffness * frameMultiplier;
        segment.velocity *= JELLYFISH_CONFIG.tentacleDamping;
        segment.angle += segment.velocity * frameMultiplier;

        // Gentler angle limits for smoother curves
        segment.angle = Math.max(-0.4, Math.min(0.4, segment.angle));

        // Slow phase update for lazy, drifting motion
        segment.phase += JELLYFISH_CONFIG.tentacleWaveSpeed * frameMultiplier;
      }
    }
  }

  /**
   * Update particle trail positions
   */
  private updateTrailPositions(
    jelly: JellyfishMarineLife,
    frameMultiplier: number
  ): void {
    // Age existing trail points
    for (let i = jelly.trailPositions.length - 1; i >= 0; i--) {
      const pos = jelly.trailPositions[i];
      if (pos) {
        pos.age += 0.02 * frameMultiplier;
        if (pos.age > 1) {
          jelly.trailPositions.splice(i, 1);
        }
      }
    }

    // Add new trail point occasionally (during pulse)
    const pulseAmount = this.getPulseAmount(jelly.pulsePhase);
    if (pulseAmount > 0.3 && Math.random() < 0.15 * frameMultiplier) {
      // Spawn from bottom of bell
      const spawnX = jelly.x + (Math.random() - 0.5) * jelly.size * 0.3;
      const spawnY = jelly.y + jelly.size * jelly.bellAspect * 0.4;
      jelly.trailPositions.push({ x: spawnX, y: spawnY, age: 0 });
    }

    // Limit trail length
    if (jelly.trailPositions.length > 8) {
      jelly.trailPositions.shift();
    }
  }

  getJellyfishCount(quality: string): number {
    return JELLYFISH_COUNTS[quality] ?? 3;
  }

  private randomInRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private randomIntInRange(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
  }
}
