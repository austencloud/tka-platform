import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { IFishFlockingCalculator } from "../contracts/IFishFlockingCalculator";
import {
  FLOCKING_CONFIG,
  BEHAVIOR_CONFIG,
  FISH_MOVEMENT,
} from "../../domain/constants/fish-constants";
import { fishDebugConfig } from "../../domain/debug-config";

/**
 * FishFlockingCalculator - Implements Boids algorithm for schooling behavior
 *
 * Handles school formation, calculates separation/alignment/cohesion forces,
 * and applies steering to maintain natural schooling patterns.
 */
export class FishFlockingCalculator implements IFishFlockingCalculator {
  private nextSchoolId = 0;

  applyFlockingForces(fish: FishMarineLife[], deltaSeconds: number): void {
    // DEBUG: Skip flocking if disabled via toggle
    if (!fishDebugConfig.enableFlocking) {
      return;
    }

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

  formSchools(fish: FishMarineLife[]): void {
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

  private randomInRange(
    range: [number, number] | readonly [number, number]
  ): number {
    return range[0] + Math.random() * (range[1] - range[0]);
  }
}
