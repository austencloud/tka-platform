// src/lib/features/stage/locomotion/motion-matching/rig-binding.ts

import type { Bone, Object3D, Vector3 } from "three";
import type { PoseSample } from "./feature-types";

/** A leg chain matching the package BoneChain shape used by solveLegIK. */
export interface LegChain {
  root: Bone;
  middle: Bone;
  effector: Bone;
  upperLength: number;
  lowerLength: number;
  rootRestDir: Vector3;
  middleRestDir: Vector3;
}

/**
 * The only rig surface the motion-matching controller depends on. A provider
 * owns the avatar GLB, its bone map + leg chains, an AnimationMixer for
 * stateless pose sampling, and the package RootMotionExtractor — so the MM
 * controller never touches the package's private Avatar3D services.
 */
export interface RigBinding {
  readonly root: Object3D;
  getBone(name: string): Bone | null;
  getLeftLegChain(): LegChain;
  getRightLegChain(): LegChain;
  clipSpecs(): { clipId: string; durationSec: number }[];
  samplePose(clipId: string, time: number): PoseSample;
  /** Read the CURRENT live skeleton pose without re-posing (no scrub). */
  readLivePose(): PoseSample;
  applyClip(clipId: string, time: number): void;
  rootMotionDelta(): { x: number; forward: number; yawDelta: number };
  /** Reset root-motion accumulation (call after a discontinuous clip switch). */
  resetRootMotion(): void;
}
