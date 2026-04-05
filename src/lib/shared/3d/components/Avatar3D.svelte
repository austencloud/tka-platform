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
  import { Vector3, Quaternion } from "three";
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
  import { WALL_OFFSET } from "../domain/constants/performer-positions";
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
  import { RootMotionExtractor } from "../services/implementations/RootMotionExtractor";
  import type { IRootMotionExtractor } from "../services/contracts/IRootMotionExtractor";
  import { FingerAnimator } from "$lib/shared/3d/services/implementations/FingerAnimator";
  import { FootPlanter } from "../services/implementations/FootPlanter";
  import type { IFootPlanter } from "../services/contracts/IFootPlanter";
  import { ElbowPoleComputer } from "../services/implementations/ElbowPoleComputer";
  import { ClavicleRaiser } from "../services/implementations/ClavicleRaiser";
  import { SpineTwister } from "../services/implementations/SpineTwister";
  import { GripType } from "$lib/shared/3d/domain/models/GripPose";

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
    onRootMotion?: (worldDelta: { x: number; z: number }) => void;
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
  }: Props = $props();

  // Services (manually instantiated to ensure shared skeleton instance)
  let skeletonService: IAvatarSkeletonBuilder | null = $state(null);
  let ikSolver: IIKSolver | null = $state(null);
  let animationService: IAvatarAnimator | null = $state(null);
  let locomotionAnimator: ILocomotionAnimator | null = $state(null);
  let stateMachine: IAnimationStateMachine | null = null;
  let rootMotionExtractor: IRootMotionExtractor | null = null;
  let footPlanter: IFootPlanter | null = null;
  let fingerAnimator: FingerAnimator | null = null;

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

      // Initialize foot planter with leg chains from the loaded skeleton
      if (enableLocomotion && footPlanter && skeletonService && ikSolver) {
        footPlanter.initialize(skeletonService, ikSolver);
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
        if (localDelta.x !== 0 || localDelta.forward !== 0) {
          // Convert Mixamo centimeters to scene units.
          // Our avatar is scaled to ~avatarHeight scene units for ~170cm Mixamo model.
          // So 1 Mixamo cm ≈ avatarHeight/170 scene units.
          const cmToScene = avatarHeight / 170;
          const dx = localDelta.x * cmToScene;
          const df = localDelta.forward * cmToScene;

          // Rotate local-space delta to world space using facing angle
          const cos = Math.cos(facingAngle);
          const sin = Math.sin(facingAngle);
          onRootMotion({
            x: dx * cos + df * sin,
            z: -dx * sin + df * cos,
          });
        }
      }

      // Foot IK disabled — the two-bone IK solver was designed for arms (wide
      // range of motion) and produces unnatural results on legs (knees splaying,
      // feet rotating). Production foot IK requires hinge-constrained knee solver,
      // foot rotation alignment, and authored animation contact curves — none of
      // which exist in Three.js or Mixamo. Speed-matched walk animation with
      // IDLE_EXCLUDE_BONES is the stable baseline.
      // FootPlanter kept in codebase for future work with a proper leg IK solver.
    }

    // 2. IK post-process (blends per-arm based on prop presence)
    const cos = Math.cos(facingAngle);
    const sin = Math.sin(facingAngle);
    const gridOffset = -WALL_OFFSET;

    // Use the model root's actual world position for IK target computation.
    // This accounts for parent group transforms (e.g. museum performer stations
    // wrap the avatar in a positioned T.Group at worldX/worldZ). Using the
    // `position` prop alone would miss those parent offsets, causing IK targets
    // to be in the wrong world-space location → T-pose.
    const rootWorld = new Vector3();
    if (cachedRoot) {
      cachedRoot.getWorldPosition(rootWorld);
      // rootWorld X/Z include all parent transforms — correct for world space.
      // For Y, use position.y (grid center / shoulder height) which is the
      // reference height the prop system orbits around.
      rootWorld.y = position.y ?? 0;
    } else {
      rootWorld.set(position.x, position.y ?? 0, position.z);
    }

    function toWorldPosition(local: { x: number; y: number; z: number }, skipFacing?: boolean): Vector3 {
      const localX = local.x;
      const localZ = local.z + (skipFacing ? 0 : gridOffset);

      if (skipFacing) {
        // Dual wheel mode: positions are already in world space.
        // Just add the avatar root offset, no facing rotation or gridOffset.
        return new Vector3(
          localX + rootWorld.x,
          local.y + rootWorld.y,
          localZ + rootWorld.z
        );
      }

      const rotatedX = localX * cos + localZ * sin;
      const rotatedZ = -localX * sin + localZ * cos;
      return new Vector3(
        rotatedX + rootWorld.x,
        local.y + rootWorld.y,
        rotatedZ + rootWorld.z
      );
    }

    const blueWorldProp = bluePropState
      ? { ...bluePropState, worldPosition: toWorldPosition(bluePropState.worldPosition, bluePropState.skipFacingTransform) }
      : null;
    const redWorldProp = redPropState
      ? { ...redPropState, worldPosition: toWorldPosition(redPropState.worldPosition, redPropState.skipFacingTransform) }
      : null;

    animationService.setPropsAndBlend(blueWorldProp, redWorldProp);
    animationService.update(delta);

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
