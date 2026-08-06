import { type Object3D, Vector3 } from "three";
import { BoundedSourcePath3D } from "../scene-effects/bounded-source-path-3d";
import {
  isTrackedTip,
  type AnimalTipSource3D,
} from "../scene-effects/scene-effect-source-3d";
import type { Animal3DParams } from "$lib/shared/effects/translators/webgl3d-types";
import { AnimalAnatomy3D } from "./animal-anatomy-3d";
import {
  applyAnimalGravity3D,
  applyAnimalSlither3D,
  dampAnimalGravityBlend3D,
  writeAnimalRotationMinimizingFrames3D,
} from "./animal-spine-3d";

const PATH_CAPACITY = 384;
const MAX_SEGMENTS = 64;
const FALLBACK_TAIL = new Vector3(0, -1, 0);

interface AnimalState {
  path: BoundedSourcePath3D;
  params: Animal3DParams;
  seenEpoch: number;
  currentX: number;
  currentY: number;
  currentZ: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  speed: number;
  gravityBlend: number;
  lastStep: number;
}

export class AnimalRenderer3D {
  private readonly anatomy = new AnimalAnatomy3D();
  private readonly states = new Map<number, AnimalState>();
  private readonly sampled = new Float32Array(MAX_SEGMENTS * 3);
  private readonly tangents = new Float32Array(MAX_SEGMENTS * 3);
  private readonly normals = new Float32Array(MAX_SEGMENTS * 3);
  private readonly binormals = new Float32Array(MAX_SEGMENTS * 3);
  private readonly frames = {
    tangents: this.tangents,
    normals: this.normals,
    binormals: this.binormals,
  };
  private readonly tailDirection = new Vector3();
  private clock = 0;
  private epoch = 0;

  initialize(parent: Object3D): void {
    this.anatomy.initialize(parent);
  }

  update(sources: readonly AnimalTipSource3D[], delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 15);
    this.clock += dt;
    this.epoch++;
    for (const source of sources) {
      if (!isTrackedTip(source.params.trackingMode, source.tipIndex)) continue;
      let state = this.states.get(source.sourceId);
      if (!state) {
        state = {
          path: new BoundedSourcePath3D(PATH_CAPACITY),
          params: source.params,
          seenEpoch: this.epoch,
          currentX: source.position.x,
          currentY: source.position.y,
          currentZ: source.position.z,
          velocityX: source.velocity.x,
          velocityY: source.velocity.y,
          velocityZ: source.velocity.z,
          speed: source.speed,
          gravityBlend: source.speed <= 0.08 ? 1 : 0,
          lastStep: source.currentStep,
        };
        this.states.set(source.sourceId, state);
      }
      // A loop or backward scrub teleports the head to an earlier pose. Keeping
      // the old polyline would stretch one giant body segment across the stage.
      if (source.currentStep + 0.001 < state.lastStep) state.path.clear();
      state.params = source.params;
      state.seenEpoch = this.epoch;
      state.currentX = source.position.x;
      state.currentY = source.position.y;
      state.currentZ = source.position.z;
      state.velocityX = source.velocity.x;
      state.velocityY = source.velocity.y;
      state.velocityZ = source.velocity.z;
      state.speed = source.speed;
      state.gravityBlend = dampAnimalGravityBlend3D(
        state.gravityBlend,
        source.speed,
        dt
      );
      state.lastStep = source.currentStep;
      state.path.push(source.position, this.clock, source.speed, 0.028);
    }

    this.anatomy.beginFrame();
    for (const [sourceId, state] of this.states) {
      if (state.seenEpoch !== this.epoch) {
        this.states.delete(sourceId);
        continue;
      }
      const count = Math.min(
        MAX_SEGMENTS,
        Math.max(8, state.params.segmentCount)
      );
      this.sampleSpine(state, count);
      this.anatomy.writeCreature({
        sourceId,
        params: state.params,
        clock: this.clock,
        sampled: this.sampled,
        frames: this.frames,
      });
    }
    this.anatomy.commit();
  }

  clear(): void {
    this.states.clear();
    this.anatomy.clear();
  }

  dispose(): void {
    this.anatomy.dispose();
  }

  private sampleSpine(state: AnimalState, count: number): void {
    const { path, params } = state;
    // History is distance-throttled so the bounded buffer retains useful arc
    // length during slow movement. The head is not: it must remain pinned to
    // the live prop endpoint on every frame, including sub-threshold motion.
    this.sampled[0] = state.currentX;
    this.sampled[1] = state.currentY;
    this.sampled[2] = state.currentZ;
    const spacing = params.bodyLengthWorld / (count - 1);
    let written = 1;
    let targetDistance = spacing;
    let travelled = 0;
    let previousX = state.currentX;
    let previousY = state.currentY;
    let previousZ = state.currentZ;

    // Include the newest retained history point. When the current endpoint has
    // moved less than the path's sampling threshold, this first segment joins
    // the exact live head back to the most recent stored point.
    for (let offset = 0; offset < path.count && written < count; offset++) {
      const index = path.indexFromNewest(offset);
      const currentX = path.xAt(index);
      const currentY = path.yAt(index);
      const currentZ = path.zAt(index);
      const dx = currentX - previousX;
      const dy = currentY - previousY;
      const dz = currentZ - previousZ;
      const segmentLength = Math.hypot(dx, dy, dz);
      while (travelled + segmentLength >= targetDistance && written < count) {
        const amount =
          segmentLength > 0 ? (targetDistance - travelled) / segmentLength : 0;
        const i3 = written * 3;
        this.sampled[i3] = previousX + dx * amount;
        this.sampled[i3 + 1] = previousY + dy * amount;
        this.sampled[i3 + 2] = previousZ + dz * amount;
        written++;
        targetDistance += spacing;
      }
      travelled += segmentLength;
      previousX = currentX;
      previousY = currentY;
      previousZ = currentZ;
    }

    if (written > 1) {
      const previousIndex = (written - 2) * 3;
      const lastIndex = (written - 1) * 3;
      this.tailDirection.set(
        this.sampled[lastIndex]! - this.sampled[previousIndex]!,
        this.sampled[lastIndex + 1]! - this.sampled[previousIndex + 1]!,
        this.sampled[lastIndex + 2]! - this.sampled[previousIndex + 2]!
      );
    } else {
      this.tailDirection.set(
        -state.velocityX,
        -state.velocityY,
        -state.velocityZ
      );
    }
    if (this.tailDirection.lengthSq() < 1e-6) {
      this.tailDirection.copy(FALLBACK_TAIL);
    } else {
      this.tailDirection.normalize();
    }

    while (written < count) {
      const previousIndex = (written - 1) * 3;
      const i3 = written * 3;
      this.sampled[i3] =
        this.sampled[previousIndex]! + this.tailDirection.x * spacing;
      this.sampled[i3 + 1] =
        this.sampled[previousIndex + 1]! + this.tailDirection.y * spacing;
      this.sampled[i3 + 2] =
        this.sampled[previousIndex + 2]! + this.tailDirection.z * spacing;
      written++;
    }

    applyAnimalGravity3D(this.sampled, count, spacing, state.gravityBlend);
    writeAnimalRotationMinimizingFrames3D(this.sampled, count, this.frames);
    applyAnimalSlither3D(
      this.sampled,
      count,
      this.frames,
      this.clock,
      spacing,
      params.slitherAmplitudeWorld,
      Math.min(1, state.speed / 3)
    );
    // Orient anatomy from the visible curve after displacement, not the
    // unmodified history, so every ornament stays attached to the final body.
    writeAnimalRotationMinimizingFrames3D(this.sampled, count, this.frames);
  }
}
