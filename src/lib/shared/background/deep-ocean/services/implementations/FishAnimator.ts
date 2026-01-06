import { inject, injectable } from "inversify";
import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import { TYPES } from "../../../../inversify/types";
import type { FishMarineLife, DepthLayer } from "../../domain/models/DeepOceanModels";
import type { IFishSpriteManager } from "../contracts/IFishSpriteManager";
import type { IFishAnimator } from "../contracts/IFishAnimator";
import {
  DEPTH_LAYER_CONFIG,
  DEPTH_LAYER_DISTRIBUTION,
  FISH_MOVEMENT,
  BEHAVIOR_CONFIG,
  BEHAVIOR_TRANSITION_PROBABILITY,
  EDGE_AWARENESS,
  FLOCKING_CONFIG,
  FISH_VISUALS,
  SPAWN_CONFIG,
  FISH_COUNTS,
} from "../../domain/constants/fish-constants";

@injectable()
export class FishAnimator implements IFishAnimator {
  private pendingSpawns: number[] = [];
  private nextSchoolId = 0;

  constructor(
    @inject(TYPES.IFishSpriteManager)
    private fishSpriteManager: IFishSpriteManager
  ) {}

  async initializeFish(
    dimensions: Dimensions,
    count: number
  ): Promise<FishMarineLife[]> {
    await this.fishSpriteManager.preloadSprites();

    const fish: FishMarineLife[] = [];
    for (let i = 0; i < count; i++) {
      fish.push(this.createFish(dimensions));
    }

    this.formSchools(fish);
    return fish;
  }

  createFish(dimensions: Dimensions): FishMarineLife {
    const entry = this.fishSpriteManager.getRandomSpriteEntry();
    const sprite = entry?.sprite ?? { name: "Default", path: "" };
    const canvas = entry?.canvas;
    const baseWidth = entry?.width ?? 96;
    const baseHeight = entry?.height ?? 64;
    const hueRotate = entry?.hueRotate ?? 0;

    const depthLayer = this.assignDepthLayer();
    const config = DEPTH_LAYER_CONFIG[depthLayer];
    const depthScale = this.randomInRange(config.scale);

    const direction: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
    const width = baseWidth * depthScale;
    const height = baseHeight * depthScale;

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
        ? -width - Math.random() * maxOffset
        : dimensions.width + width + Math.random() * maxOffset;
    const baseY =
      depthBand.min + Math.random() * (depthBand.max - depthBand.min);

    const baseSpeed =
      this.randomInRange(FISH_MOVEMENT.baseSpeed) * config.speedMultiplier;
    const opacity = this.randomInRange(config.opacity);

    const fish: FishMarineLife = {
      type: "fish",
      sprite,
      width,
      height,
      direction,
      speed: baseSpeed,
      baseSpeed,
      verticalDrift: (Math.random() - 0.5) * FISH_MOVEMENT.verticalDrift * 2,
      bobAmplitude: this.randomInRange(FISH_MOVEMENT.bobAmplitude),
      bobSpeed: this.randomInRange(FISH_MOVEMENT.bobSpeed),
      depthBand,
      x: startX,
      baseY,
      y: baseY,
      opacity,
      animationPhase: Math.random() * Math.PI * 2,
      depthLayer,
      depthScale,
      behavior: "cruising",
      behaviorTimer: this.randomInRange(BEHAVIOR_CONFIG.cruising.duration),
      rotation: 0,
      tailPhase: Math.random() * Math.PI * 2,
      hueRotate,
    };

    if (canvas) {
      fish.canvas = canvas;
    } else {
      (
        fish as FishMarineLife & { _needsSpriteUpdate?: boolean }
      )._needsSpriteUpdate = true;
    }

    return fish;
  }

  updateFish(
    fish: FishMarineLife[],
    dimensions: Dimensions,
    frameMultiplier: number,
    animationTime: number
  ): FishMarineLife[] {
    const updatedFish: FishMarineLife[] = [];
    const deltaSeconds = 0.016 * frameMultiplier;

    // First pass: update sprites if needed
    for (const f of fish) {
      this.updateSpriteIfNeeded(f);
    }

    // Second pass: apply flocking forces to schooling fish
    this.applyFlockingForces(fish, deltaSeconds);

    // Third pass: update each fish
    for (const f of fish) {
      f.behaviorTimer -= deltaSeconds;
      if (f.behaviorTimer <= 0) {
        this.transitionBehavior(f, dimensions);
      }

      this.applyBehavior(f, deltaSeconds, frameMultiplier, dimensions);
      this.updateVisuals(f, frameMultiplier);

      if (this.isOffScreen(f, dimensions)) {
        this.scheduleSpawn(
          animationTime + this.randomInRange(SPAWN_CONFIG.respawnDelay)
        );
      } else {
        updatedFish.push(f);
      }
    }

    return updatedFish;
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

      for (const fish of members) {
        const forces = this.calculateFlockingForces(fish, members);
        this.applySteeringForce(fish, forces, deltaSeconds);
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
      fish.behaviorTimer = this.randomInRange(
        BEHAVIOR_CONFIG.cruising.duration
      );
      fish.rotation = 0;
      fish.speed = fish.baseSpeed;
      return;
    }

    // Complete darting: return to cruise
    if (current === "darting") {
      fish.behavior = "cruising";
      fish.behaviorTimer = this.randomInRange(
        BEHAVIOR_CONFIG.cruising.duration
      );
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
      fish.behaviorTimer = this.randomInRange(
        BEHAVIOR_CONFIG.cruising.duration
      );
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
  // VISUAL UPDATES
  // ===========================================================================

  private updateVisuals(fish: FishMarineLife, frameMultiplier: number): void {
    // Tail wiggle speed proportional to movement speed
    const tailSpeed =
      FISH_VISUALS.tailWiggleSpeed * (fish.speed / fish.baseSpeed);
    fish.tailPhase += tailSpeed * frameMultiplier;

    // Rotation based on vertical drift
    if (fish.behavior === "cruising" || fish.behavior === "schooling") {
      const targetRotation =
        fish.verticalDrift * FISH_VISUALS.driftRotationFactor * fish.direction;
      fish.rotation +=
        (targetRotation - fish.rotation) * FISH_VISUALS.rotationSmoothing;
    }
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

  private updateSpriteIfNeeded(
    fish: FishMarineLife & { _needsSpriteUpdate?: boolean }
  ): void {
    if (!fish._needsSpriteUpdate) return;

    const entry = this.fishSpriteManager.getAnyLoadedSpriteEntry();
    if (entry) {
      fish.canvas = entry.canvas;
      fish.sprite = entry.sprite;
      fish.width = entry.width * fish.depthScale;
      fish.height = entry.height * fish.depthScale;
      delete fish._needsSpriteUpdate;
    }
  }

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
    const buffer = fish.width + SPAWN_CONFIG.offScreenBuffer;
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
