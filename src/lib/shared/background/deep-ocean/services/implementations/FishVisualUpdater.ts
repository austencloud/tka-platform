import type {
  FishMarineLife,
  FinState,
  WakeParticle,
} from "../../domain/models/DeepOceanModels";
import type { IFishVisualUpdater } from "../contracts/IFishVisualUpdater";

/**
 * Fin physics configuration
 */
const FIN_PHYSICS = {
  stiffness: 0.15,
  damping: 0.85,
  accelerationResponse: 0.3,
  turnResponse: 0.5,
  idleWave: {
    amplitude: 0.08,
    speed: 0.02,
  },
  tail: {
    waveSpeed: 0.12,
    waveAmplitude: 0.25,
    forkSpread: 0.15,
  },
};

/**
 * Wake trail configuration
 */
const WAKE_CONFIG = {
  spawnInterval: 0.08,
  particleCount: 8,
  sizeRange: [2, 6] as [number, number],
  lifetime: 1.2,
  fadeStart: 0.5,
};

/**
 * Body flex configuration
 */
const BODY_FLEX = {
  swimSpeed: 0.08,
  amplitude: {
    cruising: 0.15,
    darting: 0.25,
    turning: 0.3,
  },
};

/**
 * FishVisualUpdater - Handles visual animations for fish
 *
 * Manages fin physics, body flex, wake trails, bioluminescence,
 * and other visual effects that don't affect movement logic.
 */
export class FishVisualUpdater implements IFishVisualUpdater {
  updateVisuals(
    fish: FishMarineLife,
    frameMultiplier: number,
    animationTime: number
  ): void {
    // Core visual animations
    this.updateVisualPhases(fish, frameMultiplier);

    // Wake trail
    this.updateWakeTrail(fish, 0.016 * frameMultiplier, animationTime);

    // Bioluminescence
    if (fish.hasBioluminescence) {
      this.updateBioluminescence(fish, frameMultiplier);
    }
  }

  updateBodyFlex(fish: FishMarineLife, frameMultiplier: number): void {
    const speedRatio = fish.speed / fish.baseSpeed;
    fish.bodyFlexPhase += BODY_FLEX.swimSpeed * speedRatio * frameMultiplier;

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

  updateFinPhysics(fish: FishMarineLife, frameMultiplier: number): void {
    let speedRatio = fish.speed / fish.baseSpeed;

    // Tropical fish get nervous (faster fin movement) when too deep
    // They're out of their comfort zone in the darker waters
    if (fish.species === "tropical" && fish.preferredVerticalPosition !== undefined) {
      const bandHeight = fish.depthBand.max - fish.depthBand.min;
      const currentFraction = (fish.baseY - fish.depthBand.min) / bandHeight;
      const depthDiscomfort = Math.max(0, currentFraction - 0.6);
      speedRatio *= 1 + depthDiscomfort * 0.5; // Up to 20% faster fins when deep
    }

    const isTurning = fish.behavior === "turning";
    const isDarting = fish.behavior === "darting";

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

  private updateVisualPhases(
    fish: FishMarineLife,
    frameMultiplier: number
  ): void {
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

  private updateSingleFin(
    fin: FinState,
    targetOffset: number,
    _response: number,
    frameMultiplier: number
  ): void {
    fin.targetAngle = targetOffset;

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

    tail.wavePhase += FIN_PHYSICS.tail.waveSpeed * speedRatio * frameMultiplier;

    const swimAngle =
      Math.sin(tail.wavePhase) * tail.waveAmplitude * speedRatio;
    tail.targetAngle = swimAngle;

    const displacement = tail.targetAngle - tail.angle;
    const springForce = displacement * FIN_PHYSICS.stiffness * 1.5;
    tail.velocity += springForce * frameMultiplier;
    tail.velocity *= FIN_PHYSICS.damping;
    tail.angle += tail.velocity * frameMultiplier;

    tail.forkAngle =
      0.3 + speedRatio * FIN_PHYSICS.tail.forkSpread + Math.abs(swimAngle) * 0.1;
  }

  private updateWakeTrail(
    fish: FishMarineLife,
    deltaSeconds: number,
    animationTime: number
  ): void {
    // Age existing particles
    for (let i = fish.wakeTrail.length - 1; i >= 0; i--) {
      const particle = fish.wakeTrail[i]!;
      particle.age += deltaSeconds / WAKE_CONFIG.lifetime;

      if (particle.age > WAKE_CONFIG.fadeStart) {
        particle.opacity =
          1 -
          (particle.age - WAKE_CONFIG.fadeStart) / (1 - WAKE_CONFIG.fadeStart);
      }

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

  private updateBioluminescence(
    fish: FishMarineLife,
    frameMultiplier: number
  ): void {
    fish.glowPhase += 0.02 * frameMultiplier;

    let pulse = 0.5 + Math.sin(fish.glowPhase) * 0.3;
    const burst = Math.random() < 0.002 ? 0.5 : 0;

    // Deep fish glow brighter when ascending into lighter water
    // They're "seeking warmth" - bioluminescence responds to light gradient
    if (fish.species === "deep" && fish.behavior === "ascending") {
      const bandHeight = fish.depthBand.max - fish.depthBand.min;
      const verticalProgress = 1 - (fish.baseY - fish.depthBand.min) / bandHeight;
      pulse += verticalProgress * 0.3; // Up to 30% brighter at top
    }

    fish.glowIntensity = Math.min(1, pulse + burst);
  }

  private randomInRange(range: [number, number]): number {
    return range[0] + Math.random() * (range[1] - range[0]);
  }
}
