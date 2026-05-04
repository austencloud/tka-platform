import { AvatarSkeletonBuilder } from "./AvatarSkeletonBuilder";
import { IKSolver } from "./IKSolver";
import { AvatarAnimator } from "./AvatarAnimator";
import { LocomotionAnimator } from "./LocomotionAnimator";
import { AnimationStateMachine } from "./AnimationStateMachine";
import { RootMotionExtractor } from "./RootMotionExtractor";
import { FootPlanter } from "./FootPlanter";
import {
  createContactCurveCache,
  type ContactCurveCacheState,
} from "../contact-curve-cache";
// HingeConstrainedLegIKSolver is now solveLegIK — used directly by FootPlanter
// ElbowPoleComputer, ClavicleRaiser, SpineTwister are now module-level functions used directly by AvatarAnimator
import { ClipBasedTurnAnimator } from "./ClipBasedTurnAnimator";
import { FingerAnimator } from "./FingerAnimator";

/**
 * Avatar services are instantiated per-avatar (not via DI) because the
 * animator needs to share the same skeleton instance that the component
 * loads GLTF models into. Constructor-injected services would each build
 * their own skeleton and diverge.
 */
export interface AvatarServices {
  skeleton: AvatarSkeletonBuilder;
  ikSolver: IKSolver;
  animator: AvatarAnimator;
  locomotion: LocomotionAnimator;
  fingers: FingerAnimator;
  stateMachine: AnimationStateMachine | null;
  footPlanter: FootPlanter | null;
  contactCurveCache: ContactCurveCacheState | null;
  turnAnimator: ClipBasedTurnAnimator | null;
  rootMotionExtractor: RootMotionExtractor | null;
}

export interface AvatarServicesOptions {
  /** Enable state machine + foot IK + turn clips (player / exhibit performer). */
  enableLocomotion: boolean;
  /** Enable root motion extraction (requires enableLocomotion). */
  enableRootMotion: boolean;
  /** Planted-feet mode: skip Hips counter-rotation so spine twist doesn't
   *  cascade yaw into the leg chain. */
  enableFootPlanting: boolean;
}

export function createAvatarServices(
  options: AvatarServicesOptions,
): AvatarServices {
  const { enableLocomotion, enableRootMotion, enableFootPlanting } = options;

  const skeleton = new AvatarSkeletonBuilder();
  const ikSolver = new IKSolver();
  const animator = new AvatarAnimator(ikSolver, skeleton);
  const locomotion = new LocomotionAnimator();
  const fingers = new FingerAnimator();

  if (enableFootPlanting) {
    animator.setSkipHipsTwist(true);
  }

  const stateMachine = enableLocomotion ? new AnimationStateMachine() : null;
  const footPlanter = enableLocomotion ? new FootPlanter() : null;
  const contactCurveCache = enableLocomotion ? createContactCurveCache() : null;
  const turnAnimator = enableLocomotion ? new ClipBasedTurnAnimator() : null;
  const rootMotionExtractor =
    enableLocomotion && enableRootMotion ? new RootMotionExtractor() : null;

  return {
    skeleton,
    ikSolver,
    animator,
    locomotion,
    fingers,
    stateMachine,
    footPlanter,
    contactCurveCache,
    turnAnimator,
    rootMotionExtractor,
  };
}
