/**
 * 3D Services Contract Types
 *
 * Combined type definitions for all 3D service contracts.
 * Each section corresponds to a service domain.
 */

import type { Vector3, Quaternion, Bone, SkinnedMesh, Object3D } from "three";
import type { PropState3D } from "../../domain/models/PropState3D";
import type { Plane } from "../../domain/enums/Plane";
import type { FingerChains } from "../../domain/models/GripPose";
import type {
  CameraKeyframe,
  CameraState,
  CameraPosition,
} from "../../domain/camera-choreography";
import type {
  Formation,
  Position2D,
} from "../../domain/formation";
import type { FormationPreset } from "../../domain/formation";
import type { MotionConfig3D } from "../../domain/models/MotionData3D";
import type { CameraKeyframeBuffer } from "$lib/shared/video-export/domain/CameraKeyframe";

// ════════════════════════════════════════════════════════════════
// AnimationStateMachine
// ════════════════════════════════════════════════════════════════

export enum LocomotionState {
	IDLE = "idle",
	WALKING = "walking",
	CROUCHING = "crouching",
	JUMPING = "jumping",
	FALLING = "falling",
	LANDING = "landing",
}

export interface LocomotionStateInput {
	/** Player is pressing movement keys */
	hasMovementInput: boolean;
	/** Horizontal movement speed in scene units/sec */
	horizontalSpeed: number;
	/** Vertical velocity - positive = ascending, negative = falling */
	verticalVelocity: number;
	/** On the ground? (from PhysicsProvider.isGrounded()) */
	isGrounded: boolean;
	/** Player is holding the crouch key (Ctrl) */
	isCrouching: boolean;
	/** True on the frame jump was requested (input-driven, not physics-driven) */
	isJumpRequested?: boolean;
	/** Movement direction relative to facing (-1..+1 per axis) */
	moveDirection?: { x: number; z: number };
	/** Facing angle in radians */
	facingAngle?: number;
}

export interface LocomotionStateOutput {
	/** Current locomotion state (drives clip selection) */
	state: LocomotionState;
	/** Smoothed speed for animation playback rate (visual only) */
	animationSpeed: number;
	/** Whether walk clips should be active */
	isMoving: boolean;
	/** Directional weights for 4-way walk blending */
	moveDirection?: { x: number; z: number };
	/** Facing angle pass-through */
	facingAngle?: number;
}

export interface AnimationStateMachineConfig {
	/** Time to ramp from 0 to full walk speed (seconds, default 0.15) */
	accelerationTime?: number;
	/** Time to ramp from full walk speed to 0 (seconds, default 0.2) */
	decelerationTime?: number;
	/** Duration of the landing state before auto-transition (seconds, default 0.4) */
	landingDuration?: number;
	/** Grace period before WALKING->FALLING to absorb bumps (seconds, default 0.1) */
	coyoteGrace?: number;
	/** Vertical velocity threshold to trigger jump/fall states (default 0.5) */
	verticalThreshold?: number;
}

// ════════════════════════════════════════════════════════════════
// AvatarAnimator
// ════════════════════════════════════════════════════════════════

export interface HandPose {
  /** Target position in world space */
  targetPosition: Vector3;
  /** Target rotation for wrist (optional) */
  wristRotation?: Quaternion;
  /** Staff rotation angle in radians - used to twist the hand to match the prop angle */
  staffAngle?: number;
  /** Grip type for fingers - see GripType enum in GripPose.ts */
  gripType?: import("../../domain/models/GripPose").GripType;
  /** Which plane this hand's prop is operating on */
  plane?: Plane;
  /** Blend weight (0-1) */
  weight: number;
}

/**
 * Full body pose.
 *
 * `leftHand` / `rightHand` may be null when that side holds no prop. Body
 * systems (spine twist, clavicle raise, pole vectors, IK) must treat null
 * as "hand not present" and skip the side rather than reading stale
 * positions from a prior frame.
 */
export interface BodyPose {
  leftHand: HandPose | null;
  rightHand: HandPose | null;
  /** Optional head look target */
  headLookAt?: Vector3;
  /** Root position offset */
  rootOffset?: Vector3;
  /** Timestamp for animation */
  timestamp: number;
}

export interface AnimationLayer {
  id: string;
  name: string;
  weight: number;
  pose: BodyPose;
}

export type BlendMode = "override" | "additive" | "multiply";

export interface TransitionConfig {
  /** Duration in seconds */
  duration: number;
  /** Easing function */
  easing: "linear" | "easeIn" | "easeOut" | "easeInOut";
  /** Blend mode */
  blendMode: BlendMode;
}

export interface PositionOffset {
  x: number;
  y: number;
  z: number;
}

// ════════════════════════════════════════════════════════════════
// AvatarCustomizer
// ════════════════════════════════════════════════════════════════

export type BodyType = "masculine" | "feminine" | "androgynous";

export interface SkinTonePreset {
  id: string;
  name: string;
  color: string;
}

export interface BodyProportions {
  /** Total height */
  height: number;
  /** Head height (crown to chin) */
  headHeight: number;
  /** Neck length */
  neckLength: number;
  /** Shoulder width (shoulder to shoulder) */
  shoulderWidth: number;
  /** Torso length (base of neck to hip) */
  torsoLength: number;
  /** Hip width */
  hipWidth: number;
  /** Upper arm length (shoulder to elbow) */
  upperArmLength: number;
  /** Forearm length (elbow to wrist) */
  forearmLength: number;
  /** Hand length */
  handLength: number;
  /** Inseam (crotch to ankle) */
  inseam: number;
  /** Thigh length */
  thighLength: number;
  /** Shin length */
  shinLength: number;
}

export interface AvatarCustomization {
  /** Body type preset */
  bodyType: BodyType;
  /** Skin tone hex color */
  skinTone: string;
  /** Body proportions */
  proportions: BodyProportions;
  /** Whether to show the avatar */
  visible: boolean;
}

export interface ProportionPreset {
  id: string;
  name: string;
  description: string;
  proportions: BodyProportions;
}

// ════════════════════════════════════════════════════════════════
// AvatarSkeletonBuilder
// ════════════════════════════════════════════════════════════════

export type BoneName =
  | "Hips"
  | "Spine"
  | "Spine1"
  | "Spine2"
  | "Neck"
  | "Head"
  | "LeftShoulder"
  | "LeftArm"
  | "LeftForeArm"
  | "LeftHand"
  | "RightShoulder"
  | "RightArm"
  | "RightForeArm"
  | "RightHand"
  | "LeftUpLeg"
  | "LeftLeg"
  | "LeftFoot"
  | "RightUpLeg"
  | "RightLeg"
  | "RightFoot";

export interface BoneChain {
  /** Root bone of the chain (e.g., shoulder) */
  root: Bone;
  /** Middle bone (e.g., elbow) */
  middle: Bone;
  /** End effector (e.g., hand) */
  effector: Bone;
  /** Total length of the chain */
  totalLength: number;
  /** Length of first segment */
  upperLength: number;
  /** Length of second segment */
  lowerLength: number;
  /** Rest direction of root bone (local space, normalized) */
  rootRestDir: Vector3;
  /** Rest direction of middle bone (local space, normalized) */
  middleRestDir: Vector3;
}

export interface SkeletonState {
  /** Whether the skeleton is loaded and ready */
  isLoaded: boolean;
  /** The root object containing the skeleton */
  root: Object3D | null;
  /** All skinned meshes in the model */
  meshes: SkinnedMesh[];
  /** Map of bone names to bone objects */
  bones: Map<BoneName, Bone>;
  /** Pre-computed arm chains for IK */
  leftArmChain: BoneChain | null;
  rightArmChain: BoneChain | null;
  /** Pre-computed leg chains for foot IK (UpLeg -> Leg -> Foot) */
  leftLegChain: BoneChain | null;
  rightLegChain: BoneChain | null;
  /** Mapped finger bone chains. Null if model lacks finger bones. */
  fingerChains: FingerChains | null;
}

// ════════════════════════════════════════════════════════════════
// CameraChoreographer
// ════════════════════════════════════════════════════════════════

export interface PerformerPositionProvider {
  getPosition(index: number): CameraPosition | null;
}

export type CameraStateChangeCallback = (state: CameraState) => void;

export type KeyframeEventCallback = (keyframe: CameraKeyframe) => void;

// ════════════════════════════════════════════════════════════════
// CollisionDetector
// ════════════════════════════════════════════════════════════════

/** Which body part the collision involves */
export type CollisionZone =
  | "prop-through-head"
  | "prop-through-torso"
  | "prop-through-arm"
  | "prop-through-prop"
  | "arm-through-face"
  | "arms-through-each-other";

/**
 * A prop represented as a line segment between its two endpoints.
 * For a staff, this is tip-to-tip (~1 m). Point-based detection misses
 * the common case where the grip is outside the body but the staff
 * shaft passes straight through it.
 */
export interface PropSegment {
  /** One end of the prop (world space). */
  a: Vector3;
  /** Other end of the prop (world space). */
  b: Vector3;
  /** Radius of the prop for collision purposes (staff thickness). */
  radius: number;
}

/** How bad the violation is */
export type CollisionSeverity = "graze" | "clip" | "penetrate";

/** A single detected collision event */
export interface CollisionEvent {
  zone: CollisionZone;
  severity: CollisionSeverity;
  /** Which beat index this occurred on */
  stepNumber: number;
  /** 0-1 progress within the beat */
  beatProgress: number;
  /** Distance between the two colliding elements (meters). Positive = penetrating. */
  penetrationDepth: number;
  /** Description for the console log */
  description: string;
}

/** Bone positions snapshot needed for collision checks */
export interface BodySnapshot {
  /**
   * Raw head bone (Mixamo `Head`) world position. Note this sits at the
   * base of the skull under the chin, NOT at the visual face center.
   * For head/face collision checks, use `face` instead.
   */
  head: Vector3;
  /**
   * Derived face sphere center: the head bone offset forward + up so the
   * collision sphere sits where the actual face is. Computed by the caller
   * from the avatar's shoulder line so it rotates correctly with the body.
   */
  face: Vector3;
  neck: Vector3;
  spine2: Vector3;
  spine1: Vector3;
  hips: Vector3;
  leftShoulder: Vector3;
  rightShoulder: Vector3;
  leftElbow: Vector3;
  rightElbow: Vector3;
  leftHand: Vector3;
  rightHand: Vector3;
}

// ════════════════════════════════════════════════════════════════
// ContactCurveCache
// ════════════════════════════════════════════════════════════════

/**
 * Per-frame foot contact state for a single animation clip.
 * Values are 0 (airborne) to 1 (fully planted). Intermediate values
 * represent blend ramps during transitions.
 */
export interface ContactCurveData {
  /** Matches the clip name in the GLB */
  clipName: string;
  /** Frames per second the curves are sampled at */
  frameRate: number;
  /** Total frame count (= clip duration x frameRate) */
  frameCount: number;
  /** Per-frame left foot contact (length === frameCount) */
  leftFoot: number[];
  /** Per-frame right foot contact (length === frameCount) */
  rightFoot: number[];
}

export interface ContactSample {
  /** Left foot contact value at the sampled phase, 0-1 */
  leftFoot: number;
  /** Right foot contact value at the sampled phase, 0-1 */
  rightFoot: number;
  /** Whether the queried clip has a registered curve.
   *  Consumers use this to fall back to velocity-based detection. */
  hasCurve: boolean;
}

// ════════════════════════════════════════════════════════════════
// FootPlanter
// ════════════════════════════════════════════════════════════════

export interface FootPlanterInput {
  /** World Y of the ground plane under the avatar */
  groundY: number;
  /** Current locomotion state (affects blending strategy) */
  locomotionState: LocomotionState;
  /** Whether the avatar is currently moving */
  isMoving: boolean;
  /** Name of the currently playing clip (for contact curve lookup).
   *  When undefined, FootPlanter falls back to velocity-based detection. */
  currentClipName?: string;
  /** Phase 0-1 through the current clip (for contact curve sampling).
   *  Only used when currentClipName is set and has a registered curve. */
  currentClipPhase?: number;
}

export interface FootPlanterConfig {
  /** Foot velocity threshold below which the foot is considered "planted" (units/sec).
   *  Default: 0.15 - low enough to catch the stance phase of a walk cycle. */
  contactVelocityThreshold?: number;
  /** How quickly the IK blend weight ramps up when a foot enters contact (seconds).
   *  Default: 0.08 - fast enough to not see the foot drift. */
  lockBlendInTime?: number;
  /** How quickly the IK blend weight ramps down when a foot lifts off (seconds).
   *  Default: 0.15 - slightly slower so the unlock isn't jarring. */
  lockBlendOutTime?: number;
  /** Maximum pelvis height adjustment (scene units). Prevents extreme corrections.
   *  Default: 0.1 */
  maxPelvisAdjust?: number;
  /** Vertical offset from ground for the foot bone target (scene units).
   *  Accounts for the distance between the ankle joint and the sole.
   *  Default: 0.02 */
  footHeightOffset?: number;
}

// ════════════════════════════════════════════════════════════════
// FormationManager
// ════════════════════════════════════════════════════════════════

export interface PerformerFormationState {
  index: number;
  position: Position2D;
  facingAngle: number;
}

export type FormationChangeCallback = (formation: Formation) => void;

export type TransitionUpdateCallback = (
  positions: PerformerFormationState[]
) => void;

// ════════════════════════════════════════════════════════════════
// IKSolver
// ════════════════════════════════════════════════════════════════

export type IKAlgorithm =
  /** Simple 2-bone analytic solver (fast, exact for 2 bones) */
  | "analytic"
  /** Cyclic Coordinate Descent (iterative, any chain length) */
  | "ccd"
  /** Forward And Backward Reaching IK (smooth, natural motion) */
  | "fabrik";

export interface JointConstraints {
  /** Minimum rotation around local X axis (radians) */
  minX?: number;
  /** Maximum rotation around local X axis (radians) */
  maxX?: number;
  /** Minimum rotation around local Y axis (radians) */
  minY?: number;
  /** Maximum rotation around local Y axis (radians) */
  maxY?: number;
  /** Minimum rotation around local Z axis (radians) */
  minZ?: number;
  /** Maximum rotation around local Z axis (radians) */
  maxZ?: number;
  /** Preferred bend direction (for elbows/knees) */
  poleVector?: Vector3;
}

export interface IKTarget {
  /** Target position in world space */
  position: Vector3;
  /** Optional target rotation for the end effector */
  rotation?: Quaternion;
  /** Blend weight (0-1) for this target */
  weight?: number;
  /** Preferred elbow bend direction. If absent, defaults to (0, 0, -1). */
  poleHint?: Vector3;
}

export interface IKSolution {
  /** Whether a valid solution was found */
  success: boolean;
  /** Number of iterations used (for iterative solvers) */
  iterations: number;
  /** Final distance from target */
  error: number;
  /** Computed rotations for each bone in the chain */
  rotations: Quaternion[];
}

export interface HumanoidConstraints {
  leftElbow: JointConstraints;
  rightElbow: JointConstraints;
  leftShoulder: JointConstraints;
  rightShoulder: JointConstraints;
  leftKnee: JointConstraints;
  rightKnee: JointConstraints;
}

// ════════════════════════════════════════════════════════════════
// LegIKSolver
// ════════════════════════════════════════════════════════════════

export interface LegIKInput {
  /** The leg chain: UpLeg -> Leg -> Foot */
  chain: BoneChain;
  /** World-space target position for the foot bone */
  footTarget: Vector3;
  /** Ground normal at the target (for foot rotation alignment).
   *  Usually (0, 1, 0). */
  groundNormal: Vector3;
  /** Forward direction the foot should face (for toe alignment).
   *  Usually the avatar's facing direction. */
  footForward: Vector3;
  /** Sagittal hinge axis in UpLeg local space.
   *  Derived at skeleton-build time from the cross product of the
   *  rest-pose UpLeg direction and the rest-pose Leg direction -
   *  that gives the axis perpendicular to the natural bend plane. */
  kneeHingeAxis: Vector3;
  /** Forward vector biasing the knee bend direction. Prevents the
   *  knee from flipping backward when the target is directly below. */
  poleDirection: Vector3;
  /** Blend weight 0-1 (0 = leave bones untouched, 1 = fully IK pose) */
  weight: number;
}

// ════════════════════════════════════════════════════════════════
// LocomotionAnimator
// ════════════════════════════════════════════════════════════════

export interface LocomotionInput {
  /** Whether the avatar is currently moving */
  isMoving: boolean;
  /** Movement speed in scene units/sec (used to sync animation playback with actual movement) */
  speed: number;
  /** Optional: facing angle for root motion alignment */
  facingAngle?: number;
  /** Movement direction relative to facing: x (-1 left, +1 right), z (-1 back, +1 forward) */
  moveDirection?: { x: number; z: number };
}

export interface AnimationUrls {
  idle: string;
  forward: string;
  backward: string;
  strafeLeft: string;
  strafeRight: string;
  /** Jump ascent clip (optional - needed for jump/fall/land states) */
  jump?: string;
  /** Sustained fall loop (optional) */
  fall?: string;
  /** One-shot landing recovery (optional) */
  land?: string;
  /** Crouch idle loop (optional) */
  crouch?: string;
}

export interface LocomotionConfig {
  /** Base playback speed multiplier (default: 1) */
  baseSpeed?: number;
  /** Blend time when transitioning between states (seconds, default: 0.3) */
  blendTime?: number;
  /**
   * The walk animation's natural speed in scene units/sec.
   * Mixamo walk animations are typically ~1.4 m/s.
   * Animation timeScale = actualSpeed / animationWalkSpeed
   * so feet match actual ground movement. Default: 1.4
   */
  animationWalkSpeed?: number;
  /**
   * Enable root motion: keep Hips position track in animations so
   * RootMotionExtractor can read XZ displacement each frame.
   * When false (default), Hips position is filtered out as before.
   */
  enableRootMotion?: boolean;
  /**
   * Strip leg bone rotation tracks from the idle clip so feet stay
   * perfectly planted. Used for exhibit performers that stand in
   * place during sequence playback - upper body gets idle sway but
   * legs remain in bind pose. Default: false.
   */
  stripLegBones?: boolean;
}

// ════════════════════════════════════════════════════════════════
// Offline3DExporter
// ════════════════════════════════════════════════════════════════

export interface Offline3DExportOptions {
  fps: number;
  /** Target vertical resolution: 720, 1080, 2160, or 4320 */
  resolution: number;
  loopCount: number;
  includeStartPosition: boolean;
  includeEndHold: boolean;
  /**
   * "standard": one render per output frame at native resolution.
   * "cinema": 2x supersampling + 4x temporal motion blur. Roughly 4-8x slower
   * than standard but produces a sharper, smoother result.
   */
  quality?: "standard" | "cinema";
}

export interface Offline3DExportDependencies {
  /** The WebGL canvas to capture frames from */
  webglCanvas: HTMLCanvasElement;
  /** The Three.js PerspectiveCamera (from useThrelte().camera) */
  camera: {
    position: { set(x: number, y: number, z: number): void };
    quaternion: { set(x: number, y: number, z: number, w: number): void };
    fov: number;
    updateProjectionMatrix(): void;
  };
  /** Beats per second for converting animation time to currentStep */
  beatsPerSecond: number;
  /** Total animation duration in seconds (single loop, no start/end hold) */
  totalDurationSeconds: number;
  /** Camera keyframe buffer from pass 1 (or static capture) */
  cameraKeyframes: CameraKeyframeBuffer;
  /**
   * The Three.js WebGLRenderer. In cinema quality mode the exporter
   * temporarily resizes the renderer to 2x target resolution for
   * supersampling antialiasing. Only `getSize`/`setSize` and pixel ratio
   * accessors are used; the renderer is restored before export completes.
   */
  renderer: {
    getSize(target: { x: number; y: number; set(w: number, h: number): unknown }): unknown;
    setSize(w: number, h: number, updateStyle?: boolean): void;
    getPixelRatio(): number;
    setPixelRatio(ratio: number): void;
  };
  /**
   * Runs Threlte's full pipeline synchronously in one call: every useTask
   * callback (puppet loop, IK, effects, render) executes, then the scene
   * is drawn. `timeMs` is a monotonically increasing timestamp used for
   * delta-time calculation inside tasks. This is how the exporter renders
   * at CPU speed without rAF throttling.
   */
  runFrame: (timeMs: number) => void;
  /**
   * Pause Threlte's native rAF loop so manual runFrame calls aren't
   * racing with automatic renders. The loop is resumed after export.
   */
  pauseAutoLoop: () => void;
  /** Restore Threlte's native rAF loop after export completes. */
  resumeAutoLoop: () => void;
  /**
   * Signal that offline export is active. The puppet loop reads
   * exportCurrentStep instead of the live component prop.
   */
  setExporting: (value: boolean) => void;
  /**
   * Set the current animation step for the puppet loop to distribute.
   * The puppet loop reads this value during runFrame and calls
   * goToStep/setProgress on performers - same code path as live playback.
   */
  setExportCurrentStep: (step: number | null) => void;
}

// ════════════════════════════════════════════════════════════════
// RootMotionExtractor
// ════════════════════════════════════════════════════════════════

export interface RootMotionDelta {
  /** Local-space lateral displacement this frame (left/right) */
  x: number;
  /** Local-space forward/backward displacement this frame.
   *  Positive = forward, negative = backward.
   *  Named 'forward' (not 'z') because the raw Hips data from Mixamo
   *  uses Y for forward motion after Blender FBX->GLB conversion. */
  forward: number;
  /** Local-space yaw delta this frame in radians.
   *  Positive = counterclockwise (left turn) when viewed from above.
   *  Zero on first frame and on loop boundaries (clamped).
   *  Extracted from Hips bone rotation around the Mixamo local
   *  vertical axis, which is Z (not Y) after FBX->GLB conversion. */
  yawDelta: number;
}

// ════════════════════════════════════════════════════════════════
// SequenceConverter
// ════════════════════════════════════════════════════════════════

export interface StepMotionConfigs {
  stepNumber: number;
  blue: MotionConfig3D | null;
  red: MotionConfig3D | null;
}

// ════════════════════════════════════════════════════════════════
// TurnAnimator
// ════════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════════
// Viewer3DUndoManager
// ════════════════════════════════════════════════════════════════

export interface PerformerSnapshot {
  id: string;
  position: { x: number; z: number };
  facingAngle: number;
  customBluePlane: Plane;
  customRedPlane: Plane;
  sequenceRef: { ownerId: string; sequenceId: string } | null;
}

export interface ViewerSnapshot {
  performers: PerformerSnapshot[];
  selectedPerformerIndex: number | null;
  activeFormation: FormationPreset | "manual";
  timestamp: number;
}

export type ViewerOperationType = "spawn" | "remove" | "formation" | "spatial";

export interface ViewerUndoEntry {
  id: string;
  type: ViewerOperationType;
  beforeState: ViewerSnapshot;
  afterState?: ViewerSnapshot;
  timestamp: number;
}
