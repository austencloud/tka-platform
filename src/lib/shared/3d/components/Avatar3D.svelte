<script lang="ts">
  /**
   * Avatar3D Component
   *
   * Production-quality 3D avatar using GLTF rigged models.
   * Uses proper service architecture with IK solving.
   *
   * This component can work in two modes:
   * 1. GLTF mode: Loads a rigged humanoid model (production)
   * 2. Procedural mode: Uses IKFigure3D as fallback
   *
   * IMPORTANT: Each Avatar3D creates its own service instances to support
   * multi-avatar mode. Services are NOT resolved via DI because they need
   * to share the same skeleton instance (animator needs the same skeleton
   * that this component loads the model into).
   */

  import { onMount, onDestroy, untrack } from "svelte";
  import { T, useTask } from "@threlte/core";
  import { Vector3, Quaternion, Euler } from "three";
  import type { IAvatarSkeletonBuilder } from "../services/contracts/IAvatarSkeletonBuilder";
  import type { IIKSolver } from "../services/contracts/IIKSolver";
  import type { IAvatarAnimator } from "../services/contracts/IAvatarAnimator";
  import type { PropState3D } from "../domain/models/PropState3D";
  import { cmToUnits } from "../config/avatar-proportions";
  import {
    LAYER_WORLD,
    LAYER_PLAYER_BODY,
  } from "$lib/shared/3d/layers/layer-constants";
  import {
    getAvatarModelPath,
    type AvatarId,
    DEFAULT_AVATAR_ID,
  } from "../config/avatar-definitions";

  import { userProportionsState } from "../state/user-proportions-state.svelte";
  import IKFigure3D from "./IKFigure3D.svelte";
  import AvatarLoadingIndicator from "./AvatarLoadingIndicator.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  // Direct imports for manual instantiation (ensures shared skeleton instance)
  import { AvatarSkeletonBuilder } from "../services/implementations/AvatarSkeletonBuilder";
  import { IKSolver } from "../services/implementations/IKSolver";
  import { AvatarAnimator } from "../services/implementations/AvatarAnimator";
  import { LocomotionAnimator } from "../services/implementations/LocomotionAnimator";
  import type { ILocomotionAnimator } from "../services/contracts/ILocomotionAnimator";
  import { AnimationStateMachine } from "../services/implementations/AnimationStateMachine";
  import type { IAnimationStateMachine } from "../services/contracts/IAnimationStateMachine";
  import { LocomotionState } from "../services/contracts/IAnimationStateMachine";
  import { RootMotionExtractor } from "../services/implementations/RootMotionExtractor";
  import type { IRootMotionExtractor } from "../services/contracts/IRootMotionExtractor";
  import { FingerAnimator } from "$lib/shared/3d/services/implementations/FingerAnimator";
  import { FootPlanter } from "../services/implementations/FootPlanter";
  import type { IFootPlanter } from "../services/contracts/IFootPlanter";
  import { HingeConstrainedLegIKSolver } from "../services/implementations/HingeConstrainedLegIKSolver";
  import { ContactCurveCache } from "../services/implementations/ContactCurveCache";
  import { ElbowPoleComputer } from "../services/implementations/ElbowPoleComputer";
  import { ClavicleRaiser } from "../services/implementations/ClavicleRaiser";
  import { SpineTwister } from "../services/implementations/SpineTwister";
  import { GripType } from "$lib/shared/3d/domain/models/GripPose";
  import { CollisionDetector } from "../services/implementations/CollisionDetector";
  import type { BodySnapshot, CollisionEvent, PropSegment } from "../services/contracts/ICollisionDetector";

  // Default Z position for avatars
  // Placing avatar at z=0 (same as grid plane) so hands are exactly at prop positions
  // The avatar's body is thin enough that it won't clip through the grid
  const DEFAULT_FIGURE_Z = 0;

  interface Props {
    bluePropState: PropState3D | null;
    redPropState: PropState3D | null;
    visible?: boolean;
    avatarId?: AvatarId;
    useGLTF?: boolean; // Whether to use GLTF model or procedural fallback
    // Multi-avatar support
    id?: string; // Avatar identifier for multi-avatar mode
    /** Full 3D position (replaces positionX for locomotion support) */
    position?: { x: number; y?: number; z: number };
    /** Facing angle in radians for avatar rotation (0 = facing +Z) */
    facingAngle?: number;
    isActive?: boolean; // Whether this avatar is currently selected/active
    // Locomotion animation
    /** Whether the avatar is currently moving (triggers walk animation) */
    isMoving?: boolean;
    /** Movement speed 0-1 for animation playback rate */
    moveSpeed?: number;
    /** Movement direction relative to facing: x (-1 left, +1 right), z (-1 back, +1 forward) */
    moveDirection?: { x: number; z: number };
    /** Enable idle/walk locomotion animation. False for exhibit performers
     *  that should only use IK (no idle animation fighting the pose). */
    enableLocomotion?: boolean;
    /** Whether the avatar is on the ground (from PhysicsProvider) */
    isGrounded?: boolean;
    /** Current vertical velocity for jump/fall state detection */
    verticalVelocity?: number;
    /** Whether the player is crouching (Ctrl held) */
    isCrouching?: boolean;
    /** True on the frame jump input was detected (instant animation trigger) */
    isJumpRequested?: boolean;
    /** Enable root motion: animation drives XZ movement instead of code.
     *  Requires animations downloaded with In Place OFF. */
    enableRootMotion?: boolean;
    /** Called each frame with the world-space XZ delta from root motion.
     *  The parent applies this to physics for collision-aware movement. */
    onRootMotion?: (worldDelta: { x: number; z: number; yawDelta: number }) => void;
    /** PropAnchor group ref for blue hand IK target (from PerformerRig) */
    bluePropAnchorRef?: import("three").Group;
    /** PropAnchor group ref for red hand IK target (from PerformerRig) */
    redPropAnchorRef?: import("three").Group;
    /** Disable spine twist (dual-wheel: wide lateral targets twist the torso/feet) */
    disableSpineTwist?: boolean;
    /** Current beat index for collision detection logging */
    beatIndex?: number;
    /** 0-1 progress within current beat for collision detection logging */
    beatProgress?: number;
    /** Optional callback invoked each frame with the collision detector's events.
     *  Lets parent components surface collision state without duplicating detection. */
    onCollisionEvents?: (events: CollisionEvent[]) => void;
    /** Extra forward pitch (radians) applied to Spine1 before arm IK runs.
     *  Positive values lean the torso forward. Used by the collision lab's
     *  lean-forward stance variant. 0 = no external pitch. */
    spinePitchOffset?: number;
    /** When true, FootPlanter runs after LocomotionAnimator to pin feet
     *  to the ground via hinge-constrained leg IK. Required for the
     *  sequence viewer performer and standing museum NPCs. Leave false
     *  for the museum FPS player, which prefers code-driven responsive
     *  movement and doesn't benefit from contact-phase locking. */
    enableFootPlanting?: boolean;
  }

  let {
    bluePropState,
    redPropState,
    visible = true,
    avatarId = DEFAULT_AVATAR_ID,
    useGLTF = true, // Default to using GLTF model
    // Multi-avatar defaults
    id = "avatar1",
    position = { x: 0, y: 0, z: DEFAULT_FIGURE_Z },
    facingAngle = 0,
    isActive = true,
    // Locomotion animation
    isMoving = false,
    moveSpeed = 1,
    moveDirection = { x: 0, z: 1 },
    enableLocomotion = false,
    isGrounded = true,
    verticalVelocity = 0,
    isCrouching = false,
    isJumpRequested = false,
    enableRootMotion = false,
    onRootMotion,
    bluePropAnchorRef,
    redPropAnchorRef,
    disableSpineTwist = false,
    beatIndex = 0,
    beatProgress = 0,
    onCollisionEvents,
    spinePitchOffset = 0,
    enableFootPlanting = false,
  }: Props = $props();

  // Current locomotion state — tracked so FootPlanter can decide when to
  // fade IK out (airborne states skip foot planting). Updated each frame
  // inside the state machine branch when locomotion is enabled. Defaults
  // to IDLE for avatars without a state machine (exhibit performers).
  let currentLocomotionState: LocomotionState = LocomotionState.IDLE;

  // Services (manually instantiated to ensure shared skeleton instance)
  let skeletonService: IAvatarSkeletonBuilder | null = $state(null);
  let ikSolver: IIKSolver | null = $state(null);
  let animationService: IAvatarAnimator | null = $state(null);
  let locomotionAnimator: ILocomotionAnimator | null = $state(null);
  let stateMachine: IAnimationStateMachine | null = null;
  let rootMotionExtractor: IRootMotionExtractor | null = null;
  let footPlanter: IFootPlanter | null = null;
  let legIKSolver: HingeConstrainedLegIKSolver | null = null;
  let contactCurveCache: ContactCurveCache | null = null;
  let fingerAnimator: FingerAnimator | null = null;

  // Collision detection — logs when props/arms clip through the avatar body
  const collisionDetector = new CollisionDetector();
  const _boneVecs = {
    head: new Vector3(), face: new Vector3(), neck: new Vector3(),
    spine2: new Vector3(), spine1: new Vector3(), hips: new Vector3(),
    leftShoulder: new Vector3(), rightShoulder: new Vector3(),
    leftElbow: new Vector3(), rightElbow: new Vector3(),
    leftHand: new Vector3(), rightHand: new Vector3(),
  };
  // Scratch vectors for deriving the face center from the shoulder line.
  // The Mixamo Head bone is at the base of the skull, so we push the face
  // collision sphere forward (toward the actual face) and up (toward the
  // center of the cranium). Deriving forward from the shoulder line means
  // the offset rotates correctly no matter how the outer rig is yawed.
  const _faceRight = new Vector3();
  const _faceForward = new Vector3();
  const FACE_FORWARD_OFFSET = 0.08; // 8 cm forward from head bone
  const FACE_UP_OFFSET = 0.05;      // 5 cm up from head bone

  /**
   * Base rotation from the staff's local-Y axis to the "horizontal" axis
   * used in computePropRotation. Matches the HORIZONTAL_QUAT used by
   * prop3d-transforms so the segment math agrees with what Staff3D renders.
   * A staff is modeled as a +Y cylinder at rest, rotated 90° around Z
   * (Y → -X) before the prop's worldRotation is applied.
   */
  const STAFF_HORIZONTAL_QUAT = new Quaternion().setFromEuler(
    new Euler(0, 0, Math.PI / 2)
  );
  const _tmpAxis = new Vector3();
  const _tmpFacingQuat = new Quaternion();
  const _blueSegA = new Vector3();
  const _blueSegB = new Vector3();
  const _redSegA = new Vector3();
  const _redSegB = new Vector3();

  const blueSeg: PropSegment = { a: _blueSegA, b: _blueSegB, radius: 0.012 };
  const redSeg: PropSegment = { a: _redSegA, b: _redSegB, radius: 0.012 };

  /**
   * Build a staff segment (tip-to-tip) from a prop's grip center, its
   * rotation state, and the avatar's facing. Writes into the passed
   * Vector3s to avoid per-frame allocation.
   *
   * Composition mirrors prop3d-transforms.computePropRotation:
   *   cylinderLocalY → HORIZONTAL_QUAT → worldRotation → facingRotation
   *
   * The result is the final world direction of the cylinder's +Y axis.
   * Multiplied by halfLength and added/subtracted from the grip gives
   * the two tip positions.
   */
  function buildStaffSegment(
    gripCenter: Vector3,
    worldRotation: Quaternion,
    avatarFacingAngle: number,
    halfLength: number,
    outA: Vector3,
    outB: Vector3
  ): void {
    _tmpAxis.set(0, 1, 0);
    _tmpAxis.applyQuaternion(STAFF_HORIZONTAL_QUAT);
    _tmpAxis.applyQuaternion(worldRotation);
    _tmpFacingQuat.setFromAxisAngle(_unitY, avatarFacingAngle);
    _tmpAxis.applyQuaternion(_tmpFacingQuat);
    _tmpAxis.multiplyScalar(halfLength);
    outA.copy(gripCenter).add(_tmpAxis);
    outB.copy(gripCenter).sub(_tmpAxis);
  }

  const _unitY = new Vector3(0, 1, 0);

  let servicesReady = $state(false);
  let modelLoaded = $state(false);
  let useProceduralFallback = $state(true);
  let currentLoadedAvatarId = $state<string | null>(null);
  let isLoading = $state(false);
  let hasShownFallbackToast = $state(false);

  // Cache the root object to avoid reactivity issues during swap
  let cachedRoot = $state<import("three").Object3D | null>(null);

  // Feet offset from model origin (negative value, updated after setHeight)
  let feetOffset = $state(0);

  // Derived values from user proportions
  // avatarHeight is the target height in scene units (cm * CM_TO_UNITS)
  const avatarHeight = $derived(cmToUnits(userProportionsState.heightCm));
  const defaultGroundY = $derived(userProportionsState.groundY);

  // Calculate group Y position
  // If position.y is provided (e.g., from terrain/physics), use it directly
  // Otherwise, use groundY from user proportions (for flat stage mode)
  // feetOffset adjusts so feet touch the ground (it's negative)
  const baseGroupY = $derived(
    position.y !== undefined && position.y !== 0
      ? position.y - feetOffset  // Use provided Y (terrain mode)
      : defaultGroundY - feetOffset  // Use stage groundY (stage mode)
  );

  // No mesh offset needed — the crouch animation's Hips position track (scaled
  // from cm to m in LocomotionAnimator) handles the body drop directly.
  const groupY = $derived(baseGroupY);

  // Load a GLTF model for a specific avatar
  // Uses hot-swap pattern: keeps old avatar visible until new one is ready
  async function loadAvatar(targetAvatarId: string) {
    if (!skeletonService || isLoading) return;

    // Skip if already loaded
    if (currentLoadedAvatarId === targetAvatarId) return;

    const url = getAvatarModelPath(targetAvatarId);

    isLoading = true;

    try {
      // Load new model (skeleton service handles internal swap)
      await skeletonService.loadModel(url);

      // Scale model to match user's height
      // setHeight() calculates proper scale and stores feet offset
      skeletonService.setHeight(avatarHeight);

      // Get the feet offset for positioning (negative value)
      feetOffset = skeletonService.getFeetOffset();

      // Update cached root AFTER everything is ready
      // This ensures Threlte only sees the swap when the new model is complete
      cachedRoot = skeletonService.getRoot();

      // Enable shadow casting on all meshes in the avatar
      if (cachedRoot) {
        cachedRoot.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
          }
        });
      }

      currentLoadedAvatarId = targetAvatarId;
      modelLoaded = true;
      useProceduralFallback = false;

      // Widen the default stance — rotate upper legs outward so feet
      // are shoulder-width apart instead of the narrow T-pose default.
      // This gives the avatar a more natural standing base and helps
      // cross-body reaches look less strained.
      const skState = skeletonService.getState();
      const leftUpLeg = skState.bones.get("LeftUpLeg");
      const rightUpLeg = skState.bones.get("RightUpLeg");
      if (leftUpLeg && rightUpLeg) {
        const stanceAngle = (8 * Math.PI) / 180; // 8° outward each side
        const leftTilt = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), stanceAngle);
        const rightTilt = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -stanceAngle);
        leftUpLeg.quaternion.multiply(leftTilt);
        rightUpLeg.quaternion.multiply(rightTilt);
        leftUpLeg.updateMatrixWorld(true);
        rightUpLeg.updateMatrixWorld(true);
      }

      // Verify arm chains are ready
      const leftChain = skeletonService.getLeftArmChain();
      const rightChain = skeletonService.getRightArmChain();

      if (!leftChain) {
        console.warn("[Avatar3D] Left arm chain NOT FOUND");
      }

      if (!rightChain) {
        console.warn("[Avatar3D] Right arm chain NOT FOUND");
      }

      // Initialize locomotion animator with the loaded skeleton
      // Only for avatars that walk around (player) — exhibit performers
      // use IK only and don't need idle/walk animations.
      if (enableLocomotion && locomotionAnimator && cachedRoot) {
        // Enable root motion track preservation if configured
        if (enableRootMotion) {
          locomotionAnimator.configure({ enableRootMotion: true });
        }
        locomotionAnimator.initialize(cachedRoot);

        // Initialize root motion extractor with the Hips bone
        if (enableRootMotion && rootMotionExtractor && locomotionAnimator.getHipsBone) {
          const hipsBone = locomotionAnimator.getHipsBone();
          if (hipsBone) {
            rootMotionExtractor.initialize(hipsBone);
          }
        }

        // Load all locomotion animations (idle + 4 directional walks + optional jump/fall/land)
        // Root motion animations (-rm suffix) downloaded with In Place OFF
        // so Hips bone has XZ displacement for animation-driven movement.
        const animBase = "/animations/locomotion-pack/";
        const rmSuffix = enableRootMotion ? "-rm" : "";

        locomotionAnimator
          .loadAnimations({
            idle: `${animBase}idle${rmSuffix}.glb`,
            forward: `${animBase}walk-forward${rmSuffix}.glb`,
            backward: `${animBase}walk-backward${rmSuffix}.glb`,
            strafeLeft: `${animBase}strafe-left${rmSuffix}.glb`,
            strafeRight: `${animBase}strafe-right${rmSuffix}.glb`,
            jump: enableRootMotion ? `${animBase}jump-up-rm.glb` : "/animations/jump-up.glb",
            fall: enableRootMotion ? `${animBase}falling-idle-rm.glb` : "/animations/falling-idle.glb",
            land: enableRootMotion ? `${animBase}falling-to-landing-rm.glb` : "/animations/hard-landing.glb",
            crouch: "/animations/crouch-idle.glb",
          })
          .catch((err) => {
            console.warn(
              "[Avatar3D] Locomotion animations not loaded:",
              err.message
            );
          });
      }

      // Initialize foot planter with leg chains from the loaded skeleton.
      // FootPlanter uses the hinge-constrained leg IK solver (not the generic
      // ikSolver, which is still used by arm IK elsewhere in this file).
      // Gated on enableFootPlanting — off by default so the museum FPS player
      // (which wants responsive code-driven movement) isn't affected.
      if (enableFootPlanting && footPlanter && skeletonService && legIKSolver && contactCurveCache) {
        footPlanter.initialize(skeletonService, legIKSolver, contactCurveCache);
      }

      // Initialize finger animator with mapped finger chains
      if (fingerAnimator) {
        const skeletonState = skeletonService.getState();
        if (skeletonState.fingerChains) {
          fingerAnimator.initialize(skeletonState.fingerChains);
        }
      }
    } catch (err) {
      console.warn(
        "[Avatar3D] Failed to load avatar model, using procedural fallback:",
        err
      );
      useProceduralFallback = true;
      currentLoadedAvatarId = targetAvatarId; // Prevent infinite retry loop

      // Show user-friendly toast (only once per session)
      if (!hasShownFallbackToast) {
        hasShownFallbackToast = true;
        toast.warning("Using simplified avatar (3D model unavailable)");
      }
    } finally {
      isLoading = false;
    }
  }

  // Initialize services on mount
  onMount(async () => {
    // If not using GLTF, just use procedural fallback
    if (!useGLTF) {
      useProceduralFallback = true;
      return;
    }

    try {
      // Create per-avatar service instances manually
      // This ensures the animator uses the SAME skeleton instance we load models into
      // (Using DI would give animator its own skeleton via constructor injection)
      const skeleton = new AvatarSkeletonBuilder();
      const solver = new IKSolver();
      const poleComputer = new ElbowPoleComputer();
      const clavicleRaiser = new ClavicleRaiser();
      const spineTwister = new SpineTwister();
      const animator = new AvatarAnimator(solver, skeleton, poleComputer, clavicleRaiser, spineTwister);
      const locomotion = new LocomotionAnimator();

      skeletonService = skeleton;
      ikSolver = solver;
      animationService = animator;
      locomotionAnimator = locomotion;

      // State machine + foot IK + root motion (only useful with locomotion)
      if (enableLocomotion) {
        stateMachine = new AnimationStateMachine();
        footPlanter = new FootPlanter();
        legIKSolver = new HingeConstrainedLegIKSolver();
        contactCurveCache = new ContactCurveCache();
        if (enableRootMotion) {
          rootMotionExtractor = new RootMotionExtractor();
        }
      }

      const fingers = new FingerAnimator();
      fingerAnimator = fingers;

      servicesReady = true;

      // Debug toggles — A/B comparison from browser console
      (window as any).__togglePoleVectors = () => {
        const enabled = animator.togglePoleVectors();
        console.log(`Pole vectors: ${enabled ? "ON (new)" : "OFF (old — elbows bend backward)"}`);
        return enabled;
      };
      (window as any).__toggleClavicleRaise = () => {
        const enabled = animator.toggleClavicleRaise();
        console.log(`Clavicle raise: ${enabled ? "ON (shoulders elevate)" : "OFF (shoulders static)"}`);
        return enabled;
      };

      (window as any).__toggleSpineTwist = () => {
        const enabled = animator.toggleSpineTwist();
        console.log(`Spine twist: ${enabled ? "ON (torso/head rotate)" : "OFF (spine static)"}`);
        return enabled;
      };

      // Debug: dump shoulder bone positions to diagnose placement issues
      (window as any).__dumpShoulders = () => {
        const s = skeleton.getState();
        if (!s.isLoaded) return "Skeleton not loaded";
        const bones = ["LeftShoulder", "RightShoulder", "LeftArm", "RightArm", "Spine2", "Hips"];
        const data: Record<string, any> = {};
        for (const name of bones) {
          const bone = s.bones.get(name as any);
          if (bone) {
            const wp = new Vector3();
            bone.getWorldPosition(wp);
            const q = bone.quaternion;
            data[name] = {
              worldPos: `(${wp.x.toFixed(3)}, ${wp.y.toFixed(3)}, ${wp.z.toFixed(3)})`,
              localQuat: `(${q.x.toFixed(3)}, ${q.y.toFixed(3)}, ${q.z.toFixed(3)}, ${q.w.toFixed(3)})`,
            };
          }
        }
        const lc = skeleton.getLeftArmChain();
        const rc = skeleton.getRightArmChain();
        if (lc && rc) {
          const lp = new Vector3(); const rp = new Vector3();
          lc.root.getWorldPosition(lp);
          rc.root.getWorldPosition(rp);
          data._shoulderSpan = lp.distanceTo(rp).toFixed(3);
          data._leftArmWorldY = lp.y.toFixed(3);
          data._rightArmWorldY = rp.y.toFixed(3);
        }
        console.table(data);
        return data;
      };

      // Mocap playback: load an FBX animation and play it on the avatar
      let mocapMixer: import("three").AnimationMixer | null = null;
      let mocapPlaying = false;

      (window as any).__playMocap = async (url = "/animations/mocap-test.fbx") => {
        if (!skeletonService) return "Skeleton not loaded";
        const root = skeletonService.getRoot();
        if (!root) return "No root object";

        const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
        const { AnimationMixer, AnimationClip, LoopRepeat } = await import("three");

        // Detect the bone naming prefix used by our avatar's scene graph
        // by searching for a bone containing "Hips"
        let avatarPrefix = "";
        root.traverse((obj: any) => {
          if (obj.isBone && obj.name.includes("Hips") && !avatarPrefix) {
            const idx = obj.name.indexOf("Hips");
            avatarPrefix = obj.name.slice(0, idx);
          }
        });
        console.log(`[Mocap] Avatar bone prefix: "${avatarPrefix}"`);

        // Build a set of all bone names in our avatar for validation
        const avatarBoneNames = new Set<string>();
        root.traverse((obj: any) => {
          if (obj.isBone) avatarBoneNames.add(obj.name);
        });

        console.log("[Mocap] Loading FBX:", url);
        const loader = new FBXLoader();

        return new Promise((resolve, reject) => {
          loader.load(
            url,
            (fbx) => {
              console.log("[Mocap] FBX loaded. Animations:", fbx.animations.length);
              if (fbx.animations.length === 0) {
                resolve("No animations found in FBX");
                return;
              }

              // Detect the FBX bone prefix
              let fbxPrefix = "";
              fbx.traverse((child: any) => {
                if (child.isBone && child.name.includes("Hips") && !fbxPrefix) {
                  const idx = child.name.indexOf("Hips");
                  fbxPrefix = child.name.slice(0, idx);
                }
              });
              console.log(`[Mocap] FBX bone prefix: "${fbxPrefix}"`);

              // Create mixer on the avatar's root
              mocapMixer = new AnimationMixer(root);

              for (const clip of fbx.animations) {
                console.log(`[Mocap] Clip: "${clip.name}" duration=${clip.duration.toFixed(2)}s tracks=${clip.tracks.length}`);

                // Retarget track names: strip FBX prefix, add avatar prefix
                let mapped = 0;
                let skipped = 0;
                const retargetedTracks = clip.tracks.map((track) => {
                  const [boneName, ...rest] = track.name.split(".");
                  const property = rest.join(".");

                  // Strip FBX prefix to get core bone name
                  let coreName = boneName || "";
                  if (fbxPrefix && coreName.startsWith(fbxPrefix)) {
                    coreName = coreName.slice(fbxPrefix.length);
                  }

                  // Build the avatar track name
                  const avatarBoneName = avatarPrefix + coreName;
                  const newTrackName = `${avatarBoneName}.${property}`;

                  if (avatarBoneNames.has(avatarBoneName)) {
                    mapped++;
                  } else {
                    skipped++;
                  }

                  const cloned = track.clone();
                  cloned.name = newTrackName;
                  return cloned;
                });

                console.log(`[Mocap] Retargeted ${mapped} tracks, ${skipped} bones not found in avatar`);

                const retargetedClip = new AnimationClip(
                  clip.name + "_retargeted",
                  clip.duration,
                  retargetedTracks
                );

                const action = mocapMixer.clipAction(retargetedClip);
                action.setLoop(LoopRepeat, Infinity);
                action.play();
              }

              mocapPlaying = true;
              console.log("[Mocap] Playing! Call __stopMocap() to stop.");
              resolve("Mocap playing");
            },
            (progress) => {
              if (progress.total) {
                console.log(`[Mocap] Loading: ${((progress.loaded / progress.total) * 100).toFixed(0)}%`);
              }
            },
            (error) => {
              console.error("[Mocap] Failed to load:", error);
              reject(error);
            }
          );
        });
      };

      (window as any).__stopMocap = () => {
        if (mocapMixer) {
          mocapMixer.stopAllAction();
          mocapMixer = null;
        }
        mocapPlaying = false;
        console.log("[Mocap] Stopped.");
      };

      // Hook mocap mixer into the render loop — updates handled in useTask below
      (window as any).__getMocapMixer = () => mocapMixer;

      // Load initial avatar
      await loadAvatar(avatarId);
    } catch (err) {
      console.error("[Avatar3D] Failed to initialize avatar services:", err);
      useProceduralFallback = true;
    }
  });

  // React to avatarId changes by reloading model
  $effect(() => {
    // Only react after initial mount and services are ready
    if (!servicesReady || !useGLTF || isLoading) return;

    if (avatarId !== currentLoadedAvatarId) {
      loadAvatar(avatarId);
    }
  });

  // React to height changes - update avatar scale
  $effect(() => {
    if (!skeletonService || !modelLoaded || useProceduralFallback) return;

    // Update height when user proportions change
    // setHeight() calculates proper scale and stores feet offset
    skeletonService.setHeight(avatarHeight);

    // Update feetOffset for positioning (use untrack to prevent re-triggering)
    const newFeetOffset = skeletonService.getFeetOffset();
    untrack(() => {
      feetOffset = newFeetOffset;
    });
  });

  // Update animation each frame
  useTask((delta) => {
    // Update mocap mixer if playing (runs independently of IK)
    const mixer = (window as any).__getMocapMixer?.();
    if (mixer) {
      mixer.update(delta);
    }

    if (!servicesReady || !animationService || useProceduralFallback) return;

    // Disable spine twist in dual-wheel mode — wide lateral IK targets
    // twist the torso and shift the feet on the ground.
    if ('setSpineTwistEnabled' in animationService) {
      (animationService as any).setSpineTwistEnabled(!disableSpineTwist);
    }

    // 1. Full-body animation (idle/walk/jump/fall/land with arm swing, hip sway)
    // Only runs for locomotion-enabled avatars (player), not exhibit performers
    if (enableLocomotion && locomotionAnimator) {
      if (stateMachine) {
        // State machine decides what state we're in based on physics signals
        const stateOutput = stateMachine.update({
          hasMovementInput: isMoving,
          horizontalSpeed: moveSpeed,
          verticalVelocity,
          isGrounded,
          isCrouching,
          isJumpRequested,
          moveDirection,
          facingAngle,
        }, delta);

        // Feed state to LocomotionAnimator for clip selection
        locomotionAnimator.setActiveState?.(stateOutput.state);
        locomotionAnimator.setLocomotion({
          isMoving: stateOutput.isMoving,
          speed: stateOutput.animationSpeed,
          facingAngle: stateOutput.facingAngle,
          moveDirection: stateOutput.moveDirection,
        });
        // Track state for FootPlanter (airborne states skip foot planting)
        currentLocomotionState = stateOutput.state;
      } else {
        // Legacy path (no state machine)
        locomotionAnimator.setLocomotion({
          isMoving,
          speed: moveSpeed,
          facingAngle,
          moveDirection,
        });
      }
      locomotionAnimator.update(delta);

      // Root motion: after the mixer writes Hips position from the clip,
      // extract the lateral + forward delta and zero it out so the mesh
      // stays centered. Then rotate by facing angle to get world-space XZ.
      //
      // Coordinate mapping (Mixamo FBX→GLB via Blender):
      //   delta.x = lateral (positive = character's left)
      //   delta.forward = forward/backward (positive = character's forward)
      //
      // World-space mapping (Three.js, Y-up):
      //   worldX = lateral rotated by facing angle
      //   worldZ = forward rotated by facing angle
      //
      // The values are in Mixamo centimeters. Our scene uses ~0.01 scale
      // factor (Mixamo 100cm hip height → ~1.0 scene units), so we need
      // to convert. The model's scale handles the visual, but root motion
      // displacement needs the same conversion.
      if (rootMotionExtractor?.isReady() && onRootMotion) {
        const localDelta = rootMotionExtractor.extract();
        if (localDelta.x !== 0 || localDelta.forward !== 0 || localDelta.yawDelta !== 0) {
          // Convert Mixamo centimeters to scene units.
          // Our avatar is scaled to ~avatarHeight scene units for ~170cm Mixamo model.
          // So 1 Mixamo cm ≈ avatarHeight/170 scene units.
          const cmToScene = avatarHeight / 170;
          const dx = localDelta.x * cmToScene;
          const df = localDelta.forward * cmToScene;

          // Rotate local-space translation delta to world space using facing angle.
          // yawDelta is left in its local radian form — the consumer (PerformerRig)
          // integrates it into rotation.y directly.
          const cos = Math.cos(facingAngle);
          const sin = Math.sin(facingAngle);
          onRootMotion({
            x: dx * cos + df * sin,
            z: -dx * sin + df * cos,
            yawDelta: localDelta.yawDelta,
          });
        }
      }

      // Foot planting IK — pins feet to the ground during contact phases
      // using hinge-constrained leg IK and contact curves for clips that
      // have them. Velocity-threshold detection is used as a fallback for
      // clips without authored curves. Gated on enableFootPlanting so the
      // museum FPS player stays fully code-driven.
      if (enableFootPlanting && footPlanter?.isReady()) {
        footPlanter.update(delta, {
          groundY: 0, // Rig-local ground; PerformerRig handles world offset
          locomotionState: currentLocomotionState,
          isMoving,
          // currentClipName / currentClipPhase omitted in Phase 1 — velocity
          // fallback handles idle + walk. Phase 2 populates these when turn
          // clips play.
        });
      }
    }

    // 2. IK post-process (blends per-arm based on prop presence)
    // IK targets: read world positions from PropAnchor groups in PerformerRig.
    // If refs aren't available (standalone Avatar3D), fall back to prop state positions.
    const blueIKTarget = new Vector3();
    const redIKTarget = new Vector3();

    if (bluePropAnchorRef && bluePropState) {
      bluePropAnchorRef.updateWorldMatrix(true, false);
      bluePropAnchorRef.getWorldPosition(blueIKTarget);
    } else if (bluePropState) {
      blueIKTarget.copy(bluePropState.worldPosition);
    }

    if (redPropAnchorRef && redPropState) {
      redPropAnchorRef.updateWorldMatrix(true, false);
      redPropAnchorRef.getWorldPosition(redIKTarget);
    } else if (redPropState) {
      redIKTarget.copy(redPropState.worldPosition);
    }

    const blueWorldProp = bluePropState
      ? { ...bluePropState, worldPosition: blueIKTarget }
      : null;
    const redWorldProp = redPropState
      ? { ...redPropState, worldPosition: redIKTarget }
      : null;

    animationService.setPropsAndBlend(blueWorldProp, redWorldProp);
    // Push optional external spine pitch (e.g., lean-forward stance variants)
    // before the animator runs IK so the arms solve against the leaned torso.
    animationService.setExternalSpinePitch(spinePitchOffset);
    animationService.update(delta);

    // 2b. Collision detection — run after IK so bones are at final positions
    if (collisionDetector.enabled && skeletonService) {
      const state = skeletonService.getState();
      const bones = state.bones;
      const leftChain = skeletonService.getLeftArmChain();
      const rightChain = skeletonService.getRightArmChain();

      // Snapshot all bone world positions (reuses pre-allocated vectors)
      bones.get("Head")?.getWorldPosition(_boneVecs.head);
      bones.get("Neck")?.getWorldPosition(_boneVecs.neck);
      bones.get("Spine2")?.getWorldPosition(_boneVecs.spine2);
      bones.get("Spine1")?.getWorldPosition(_boneVecs.spine1);
      bones.get("Hips")?.getWorldPosition(_boneVecs.hips);
      bones.get("LeftShoulder")?.getWorldPosition(_boneVecs.leftShoulder);
      bones.get("RightShoulder")?.getWorldPosition(_boneVecs.rightShoulder);
      leftChain?.middle.getWorldPosition(_boneVecs.leftElbow);
      rightChain?.middle.getWorldPosition(_boneVecs.rightElbow);
      leftChain?.effector.getWorldPosition(_boneVecs.leftHand);
      rightChain?.effector.getWorldPosition(_boneVecs.rightHand);

      // Derive the face center from the shoulder line. The character's
      // right direction is (rightShoulder - leftShoulder); crossing that
      // with world-up gives a forward vector that stays correct as the
      // outer rig rotates in yaw. Face = head + 8 cm forward + 5 cm up.
      _faceRight.subVectors(_boneVecs.rightShoulder, _boneVecs.leftShoulder);
      if (_faceRight.lengthSq() > 1e-6) {
        _faceRight.normalize();
        // forward = cross(right, worldUp). With right=(1,0,0) and up=(0,1,0)
        // this gives (0,0,1) — matches the character facing +Z.
        _faceForward.crossVectors(_faceRight, _unitY).normalize();
      } else {
        // Degenerate (shoulders at same point) — fall back to +Z forward.
        _faceForward.set(0, 0, 1);
      }
      _boneVecs.face
        .copy(_boneVecs.head)
        .addScaledVector(_faceForward, FACE_FORWARD_OFFSET);
      _boneVecs.face.y += FACE_UP_OFFSET;

      // Build staff segments (tip-to-tip) for shaft-through-body checks.
      // A staff is a line, not a point — point-based collision would miss
      // the common case where the grip is above the head but the shaft
      // passes through it.
      const halfStaffLength = userProportionsState.staffLength / 2;
      let blueSegOrNull: PropSegment | null = null;
      let redSegOrNull: PropSegment | null = null;

      if (blueWorldProp) {
        buildStaffSegment(
          blueWorldProp.worldPosition,
          bluePropState!.worldRotation,
          facingAngle,
          halfStaffLength,
          _blueSegA,
          _blueSegB
        );
        blueSegOrNull = blueSeg;
      }
      if (redWorldProp) {
        buildStaffSegment(
          redWorldProp.worldPosition,
          redPropState!.worldRotation,
          facingAngle,
          halfStaffLength,
          _redSegA,
          _redSegB
        );
        redSegOrNull = redSeg;
      }

      const events = collisionDetector.detect(
        _boneVecs as BodySnapshot,
        blueSegOrNull,
        redSegOrNull,
        beatIndex,
        beatProgress
      );
      onCollisionEvents?.(events);
    }

    // 3. Finger grips
    if (fingerAnimator?.isReady()) {
      const leftGrip = bluePropState ? GripType.SQUARE : GripType.IDLE;
      const rightGrip = redPropState ? GripType.SQUARE : GripType.IDLE;
      fingerAnimator.setGrips(leftGrip, rightGrip);
      fingerAnimator.update(delta);
    }
  });

  // Note: Visibility is handled via the {#if visible} in the template
  // No need for customizationService - skeleton visibility is controlled by Svelte rendering

  // Assign avatar to appropriate layer for first-person viewmodel system
  // Active player's body goes on LAYER_PLAYER_BODY (hidden in first-person)
  // Other players' bodies stay on LAYER_WORLD (always visible)
  $effect(() => {
    if (!cachedRoot) return;

    const targetLayer = isActive ? LAYER_PLAYER_BODY : LAYER_WORLD;

    // Set layer on root and ALL children (Three.js doesn't inherit layers)
    cachedRoot.traverse((child) => {
      child.layers.set(targetLayer);
    });
  });

  onDestroy(() => {
    // Dispose locomotion animator, state machine, and foot planter
    if (locomotionAnimator) {
      locomotionAnimator.dispose();
    }
    if (stateMachine) {
      stateMachine.dispose();
    }
    if (rootMotionExtractor) {
      rootMotionExtractor.dispose();
    }
    if (footPlanter) {
      footPlanter.dispose();
    }

    // Dispose finger animator
    if (fingerAnimator) {
      fingerAnimator.dispose();
    }

    // Only dispose if we loaded a GLTF model
    if (skeletonService && !useProceduralFallback) {
      skeletonService.dispose();
    }

    collisionDetector.dispose();
  });
</script>

{#if visible}
  <!-- Loading indicator while avatar model loads -->
  {#if isLoading}
    <AvatarLoadingIndicator {position} />
  {/if}

  {#if useProceduralFallback}
    <!-- Procedural fallback (used when GLTF loading fails) -->
    <T.Group
      name={`PERFORMER_${id}`}
      position={[position.x, position.y ?? 0, position.z]}
      rotation.y={facingAngle}
    >
      <!-- worldPosition is already local grid coordinates, no offset needed -->
      <IKFigure3D {bluePropState} {redPropState} />
    </T.Group>
  {:else if modelLoaded && cachedRoot}
    <!-- GLTF model (production mode) -->
    <!--
      Position the avatar:
      - X, Z: from position object (supports locomotion)
      - Y: groupY (uses position.y if provided, else defaultGroundY)
      - rotation.y: facingAngle (avatar faces movement direction)

      groupY calculation:
      - If position.y is provided (terrain/physics mode): position.y - feetOffset
      - Else (flat stage mode): defaultGroundY - feetOffset
      - feetOffset is negative (feet are below model origin)
      - This positions feet at the correct ground level

      Using cachedRoot instead of skeletonService.getRoot() ensures
      the template only updates AFTER a new model is fully loaded,
      preventing visual glitches during avatar swap.
    -->
    <T.Group
      name={`PERFORMER_${id}`}
      position={[position.x, groupY, position.z]}
      rotation.y={facingAngle}
    >
      <T is={cachedRoot} />
    </T.Group>
  {/if}
{/if}
