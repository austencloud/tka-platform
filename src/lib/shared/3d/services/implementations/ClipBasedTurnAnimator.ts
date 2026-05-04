/**
 * ClipBasedTurnAnimator
 *
 * Pre-bakes Mixamo turn clips into per-frame bone rotation arrays and samples
 * them by phase (0→1). The phase clock belongs to the caller - this class is
 * purely stateless between samples.
 *
 * Two init paths:
 *   initializeFromData()  - sync, for tests and any caller that already has
 *                           parsed BakedTurnClip objects.
 *   initialize()          - async production path: loads GLBs from URLs,
 *                           bakes tracks into BakedTurnClip, then calls
 *                           initializeFromData internally.
 *
 * Clip selection: the requested heading delta is compared against supported
 * angles (±90°, ±180°). If the delta falls within SNAP_THRESHOLD of a
 * supported angle, that clip is used. Otherwise the linear fallback path
 * returns yawDelta only (no bone data).
 */

import { Quaternion, Euler, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Object3D, AnimationClip, QuaternionKeyframeTrack } from "three";
import type { ContactCurveData } from "../contact-curve-cache";

export interface TurnRequest {
  /** Heading at phase 0, in radians (0 = +Z toward audience). */
  fromHeading: number;
  /** Heading at phase 1, in radians. */
  toHeading: number;
  /** Phase 0->1 within the turn. 0 = start pose, 1 = end pose.
   *  Can go backward (scrubbing). Values outside [0,1] are clamped. */
  phase: number;
}

export interface TurnSample {
  /** Accumulated yaw delta from phase=0 to this phase, in radians.
   *  Positive = counterclockwise (left turn) when viewed from above. */
  yawDelta: number;
  /** Per-bone local rotations to apply to the skeleton.
   *  Keys are canonical bone names without prefix (e.g. "Hips", "LeftUpLeg").
   *  Only lower-body + spine bones are included. */
  boneRotations: Map<string, Quaternion>;
  /** Hips local position at this phase (for root motion extraction).
   *  Null when using linear fallback (no clip data). */
  hipsPosition: Vector3 | null;
  /** Per-foot contact state: 0 = airborne, 1 = fully planted. */
  leftFootContact: number;
  rightFootContact: number;
  /** Name of the clip being sampled (for ContactCurveCache lookup).
   *  Empty string when using linear fallback. */
  clipName: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Bone names baked into turn clips (without model prefix). */
const TURN_BONE_NAMES = new Set([
  "Hips",
  "Spine",
  "Spine1",
  "Spine2",
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "LeftToeBase",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
  "RightToeBase",
]);

/** Angles within this many radians of a supported clip angle snap to that clip. */
const SNAP_THRESHOLD = (22.5 * Math.PI) / 180;

/** Frames per second used when baking clip tracks. */
const BAKE_FPS = 30;

/** Known Mixamo bone prefixes for model and clip detection. */
const KNOWN_PREFIXES = ["mixamorig1", "mixamorig:", "mixamorig", ""];

// ---------------------------------------------------------------------------
// Module-level temporaries - zero per-frame allocation during sampling
// ---------------------------------------------------------------------------

const _tmpQuat = new Quaternion();
const _tmpQuat2 = new Quaternion();
const _tmpEuler = new Euler();
const _tmpVec = new Vector3();

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * A pre-baked turn clip ready for phase-based sampling.
 * Both initializeFromData() (tests) and the production load path produce this.
 */
export interface BakedTurnClip {
  /** Target heading change in degrees. Positive = CCW (left). */
  angleDeg: number;
  /** Name matching the GLB clip name, used for ContactCurveCache lookup. */
  clipName: string;
  /** Duration of the original clip in seconds. */
  duration: number;
  /** Number of frames baked at BAKE_FPS. */
  frameCount: number;
  /** Per-bone frame arrays. Key = canonical bone name (no prefix). */
  boneFrames: Map<string, Quaternion[]>;
  /** Hips world-space position per frame (for root motion extraction). */
  hipsPositions: Vector3[];
  /** Per-frame left foot contact: 0=airborne, 1=planted. */
  contactLeft: number[];
  /** Per-frame right foot contact: 0=airborne, 1=planted. */
  contactRight: number[];
}

/**
 * One entry in the production turn clip manifest JSON.
 * Maps to a GLB URL and an optional JSON sidecar for contact curves.
 */
export interface TurnClipManifestEntry {
  /** Canonical clip name (e.g. "turn-left-90"). */
  clipName: string;
  /** Heading change in degrees. Positive = CCW. */
  angleDeg: number;
  /** URL of the GLB containing the clip. */
  glbUrl: string;
  /** Optional URL of a JSON sidecar with { leftFoot, rightFoot } arrays. */
  contactUrl?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function wrapAngle(a: number): number {
  // Wrap to [-π, π]
  let w = a % (2 * Math.PI);
  if (w > Math.PI) w -= 2 * Math.PI;
  if (w < -Math.PI) w += 2 * Math.PI;
  return w;
}

function detectClipPrefix(clip: AnimationClip): string {
  if (clip.tracks.length === 0) return "";
  const boneName = clip.tracks[0]!.name.split(".")[0] ?? "";
  for (const prefix of KNOWN_PREFIXES) {
    if (prefix && boneName.startsWith(prefix)) return prefix;
  }
  return "";
}

function detectModelPrefix(root: Object3D): string {
  for (const prefix of KNOWN_PREFIXES) {
    if (root.getObjectByName(`${prefix}Hips`)) return prefix;
  }
  let found = "mixamorig";
  root.traverse((obj) => {
    if (obj.name.includes("Hips")) {
      found = obj.name.slice(0, obj.name.indexOf("Hips"));
    }
  });
  return found;
}

/**
 * Bake a Three.js AnimationClip into a BakedTurnClip.
 * Samples bone rotations at BAKE_FPS intervals and reads the Hips position
 * track for root motion. Strips the model/clip prefix from bone names.
 */
function bakeClip(
  clip: AnimationClip,
  modelPrefix: string,
  angleDeg: number,
  contactLeft: number[],
  contactRight: number[]
): BakedTurnClip {
  const clipPrefix = detectClipPrefix(clip);
  const frameCount = Math.max(2, Math.ceil(clip.duration * BAKE_FPS) + 1);
  const boneFrames = new Map<string, Quaternion[]>();
  const hipsPositions: Vector3[] = [];

  // Build empty frame arrays for each wanted bone
  for (const bone of TURN_BONE_NAMES) {
    boneFrames.set(bone, Array.from({ length: frameCount }, () => new Quaternion()));
  }
  for (let i = 0; i < frameCount; i++) {
    hipsPositions.push(new Vector3());
  }

  for (const track of clip.tracks) {
    const dotIdx = track.name.indexOf(".");
    if (dotIdx === -1) continue;

    const rawBoneName = track.name.slice(0, dotIdx);
    const property = track.name.slice(dotIdx + 1);
    const coreName = clipPrefix ? rawBoneName.slice(clipPrefix.length) : rawBoneName;

    if (property === "quaternion" && TURN_BONE_NAMES.has(coreName)) {
      const frames = boneFrames.get(coreName)!;
      // QuaternionKeyframeTrack stores interleaved [x,y,z,w] values
      const values = (track as QuaternionKeyframeTrack).values as Float32Array;
      const times = track.times as Float32Array;
      const lastTime = times[times.length - 1] ?? clip.duration;

      for (let f = 0; f < frameCount; f++) {
        const t = (f / (frameCount - 1)) * clip.duration;
        // Find surrounding keyframes
        let lo = 0;
        let hi = times.length - 1;
        for (let k = 0; k < times.length - 1; k++) {
          if (times[k]! <= t && times[k + 1]! >= t) {
            lo = k;
            hi = k + 1;
            break;
          }
        }
        const tLo = times[lo] ?? 0;
        const tHi = times[hi] ?? lastTime;
        const blend = tHi > tLo ? (t - tLo) / (tHi - tLo) : 0;

        _tmpQuat.set(
          values[lo * 4]!,
          values[lo * 4 + 1]!,
          values[lo * 4 + 2]!,
          values[lo * 4 + 3]!
        );
        _tmpQuat2.set(
          values[hi * 4]!,
          values[hi * 4 + 1]!,
          values[hi * 4 + 2]!,
          values[hi * 4 + 3]!
        );
        frames[f]!.slerpQuaternions(_tmpQuat, _tmpQuat2, blend);
      }
    }

    if (coreName === "Hips" && property === "position") {
      const values = track.values as Float32Array;
      const times = track.times as Float32Array;
      const lastTime = times[times.length - 1] ?? clip.duration;

      for (let f = 0; f < frameCount; f++) {
        const t = (f / (frameCount - 1)) * clip.duration;
        let lo = 0;
        let hi = times.length - 1;
        for (let k = 0; k < times.length - 1; k++) {
          if (times[k]! <= t && times[k + 1]! >= t) {
            lo = k;
            hi = k + 1;
            break;
          }
        }
        const tLo = times[lo] ?? 0;
        const tHi = times[hi] ?? lastTime;
        const blend = tHi > tLo ? (t - tLo) / (tHi - tLo) : 0;
        hipsPositions[f]!.set(
          (values[lo * 3]! * (1 - blend)) + values[hi * 3]! * blend,
          (values[lo * 3 + 1]! * (1 - blend)) + values[hi * 3 + 1]! * blend,
          (values[lo * 3 + 2]! * (1 - blend)) + values[hi * 3 + 2]! * blend
        );
      }
    }
  }

  // Pad contact curves to frameCount if shorter
  const padArray = (arr: number[], len: number): number[] => {
    if (arr.length >= len) return arr.slice(0, len);
    const last = arr[arr.length - 1] ?? 0;
    return [...arr, ...Array<number>(len - arr.length).fill(last)];
  };

  return {
    angleDeg,
    clipName: clip.name,
    duration: clip.duration,
    frameCount,
    boneFrames,
    hipsPositions,
    contactLeft: padArray(contactLeft, frameCount),
    contactRight: padArray(contactRight, frameCount),
  };
}

// ---------------------------------------------------------------------------
// Sampling helpers
// ---------------------------------------------------------------------------

/**
 * Sample a per-bone quaternion at the given phase by linear interpolation.
 * Writes into `out` (no allocation).
 */
function sampleBoneAtPhase(
  frames: Quaternion[],
  phase: number,
  out: Quaternion
): void {
  const fc = frames.length;
  const floatIdx = phase * (fc - 1);
  const i0 = Math.floor(floatIdx);
  const i1 = Math.min(fc - 1, i0 + 1);
  const t = floatIdx - i0;
  out.slerpQuaternions(frames[i0]!, frames[i1]!, t);
}

function sampleContactAtPhase(curve: number[], phase: number): number {
  const fc = curve.length;
  const floatIdx = phase * (fc - 1);
  const i0 = Math.floor(floatIdx);
  const i1 = Math.min(fc - 1, i0 + 1);
  const t = floatIdx - i0;
  return curve[i0]! * (1 - t) + curve[i1]! * t;
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

export class ClipBasedTurnAnimator {
  private clips: BakedTurnClip[] = [];
  private ready = false;

  // -------------------------------------------------------------------------
  // Init - sync (tests)
  // -------------------------------------------------------------------------

  initializeFromData(clips: BakedTurnClip[]): void {
    this.clips = clips;
    this.ready = true;
  }

  // -------------------------------------------------------------------------
  // Init - async production path (GLTFLoader)
  // -------------------------------------------------------------------------

  async initialize(
    modelRoot: Object3D,
    manifest: TurnClipManifestEntry[]
  ): Promise<void> {
    const modelPrefix = detectModelPrefix(modelRoot);
    const loader = new GLTFLoader();

    const bakedClips = await Promise.all(
      manifest.map(async (entry) => {
        const gltf = await new Promise<import("three/examples/jsm/loaders/GLTFLoader.js").GLTF>(
          (resolve, reject) => loader.load(entry.glbUrl, resolve, undefined, reject)
        );
        const rawClip = gltf.animations[0];
        if (!rawClip) throw new Error(`[ClipBasedTurnAnimator] No animation in ${entry.glbUrl}`);
        rawClip.name = entry.clipName;

        let contactLeft: number[] = [];
        let contactRight: number[] = [];

        if (entry.contactUrl) {
          try {
            const res = await fetch(entry.contactUrl);
            const json = (await res.json()) as { leftFoot: number[]; rightFoot: number[] };
            contactLeft = json.leftFoot;
            contactRight = json.rightFoot;
          } catch {
            console.warn(`[ClipBasedTurnAnimator] Could not load contact sidecar: ${entry.contactUrl}`);
          }
        }

        return bakeClip(rawClip, modelPrefix, entry.angleDeg, contactLeft, contactRight);
      })
    );

    this.initializeFromData(bakedClips);
  }

  // -------------------------------------------------------------------------
  // ITurnAnimator
  // -------------------------------------------------------------------------

  computeShortestAngle(fromHeading: number, toHeading: number): number {
    return wrapAngle(toHeading - fromHeading);
  }

  sample(request: TurnRequest): TurnSample {
    const { fromHeading, toHeading, phase } = request;
    const clampedPhase = Math.max(0, Math.min(1, phase));
    const totalAngle = this.computeShortestAngle(fromHeading, toHeading);

    // Try to find a matching clip
    const clip = this.findClip(totalAngle);

    if (!clip) {
      // Linear fallback - no bone data available
      return {
        yawDelta: totalAngle * clampedPhase,
        boneRotations: new Map(),
        hipsPosition: null,
        leftFootContact: 0,
        rightFootContact: 0,
        clipName: "",
      };
    }

    // Sample all baked bones at this phase
    const boneRotations = new Map<string, Quaternion>();
    for (const [boneName, frames] of clip.boneFrames) {
      const out = new Quaternion();
      sampleBoneAtPhase(frames, clampedPhase, out);
      boneRotations.set(boneName, out);
    }

    // yawDelta from the Hips Z euler at phase vs phase 0
    const hipsFrames = clip.boneFrames.get("Hips");
    let yawDelta = totalAngle * clampedPhase; // Sensible fallback
    let hipsPosition: Vector3 | null = null;

    if (hipsFrames) {
      // Frame 0 yaw
      _tmpEuler.setFromQuaternion(hipsFrames[0]!, "XYZ");
      const yaw0 = _tmpEuler.z;
      // Current phase yaw
      sampleBoneAtPhase(hipsFrames, clampedPhase, _tmpQuat);
      _tmpEuler.setFromQuaternion(_tmpQuat, "XYZ");
      const yawNow = _tmpEuler.z;
      yawDelta = wrapAngle(yawNow - yaw0);
    }

    // Hips world position
    if (clip.hipsPositions.length > 0) {
      const floatIdx = clampedPhase * (clip.frameCount - 1);
      const i0 = Math.floor(floatIdx);
      const i1 = Math.min(clip.frameCount - 1, i0 + 1);
      const t = floatIdx - i0;
      hipsPosition = new Vector3().lerpVectors(
        clip.hipsPositions[i0]!,
        clip.hipsPositions[i1]!,
        t
      );
    }

    const leftFootContact = sampleContactAtPhase(clip.contactLeft, clampedPhase);
    const rightFootContact = sampleContactAtPhase(clip.contactRight, clampedPhase);

    return {
      yawDelta,
      boneRotations,
      hipsPosition,
      leftFootContact,
      rightFootContact,
      clipName: clip.clipName,
    };
  }

  isReady(): boolean {
    return this.ready;
  }

  dispose(): void {
    this.clips = [];
    this.ready = false;
  }

  // -------------------------------------------------------------------------
  // Contact curve export (for ContactCurveCache registration)
  // -------------------------------------------------------------------------

  getContactCurves(): ContactCurveData[] {
    return this.clips.map((clip) => ({
      clipName: clip.clipName,
      frameRate: BAKE_FPS,
      frameCount: clip.frameCount,
      leftFoot: clip.contactLeft,
      rightFoot: clip.contactRight,
    }));
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  /**
   * Find the best matching clip for the given heading delta.
   * Snaps to the nearest supported angle within SNAP_THRESHOLD.
   * Returns null when the angle is too far from any supported clip (linear fallback).
   */
  private findClip(totalAngle: number): BakedTurnClip | null {
    let best: BakedTurnClip | null = null;
    let bestDist = Infinity;

    for (const clip of this.clips) {
      const clipAngleRad = (clip.angleDeg * Math.PI) / 180;
      // Raw angular difference (not wrapped) for sign-preserving comparison
      // at the ±π boundary. A right-180 clip has angleDeg=-180 (negative),
      // and a left-180 clip has angleDeg=+180 (positive). When totalAngle is
      // exactly ±π, we want the clip whose sign matches.
      const rawDiff = totalAngle - clipAngleRad;
      // Wrapped distance for snapping threshold
      const dist = Math.abs(wrapAngle(rawDiff));
      // Break ties by preferring the clip whose raw angle is closer to totalAngle
      // (avoids the +π / -π ambiguity where wrapAngle collapses both to 0 distance)
      const absRaw = Math.abs(rawDiff);
      const tieBreaker = absRaw < Math.abs(totalAngle - (best ? (best.angleDeg * Math.PI) / 180 : Infinity));
      if (dist < bestDist || (dist === bestDist && tieBreaker)) {
        bestDist = dist;
        best = clip;
      }
    }

    return bestDist <= SNAP_THRESHOLD ? best : null;
  }
}
