import { AvatarSkeletonBuilder } from "./AvatarSkeletonBuilder";
import { IKSolver } from "./IKSolver";
import { AvatarAnimator } from "./AvatarAnimator";
import { LocomotionAnimator } from "./LocomotionAnimator";
import { AnimationStateMachine } from "./AnimationStateMachine";
import { RootMotionExtractor } from "./RootMotionExtractor";
import { FootPlanter } from "./FootPlanter";
import { HingeConstrainedLegIKSolver } from "./HingeConstrainedLegIKSolver";
import { ContactCurveCache } from "./ContactCurveCache";
import { ElbowPoleComputer } from "./ElbowPoleComputer";
import { ClavicleRaiser } from "./ClavicleRaiser";
import { SpineTwister } from "./SpineTwister";
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
  legIKSolver: HingeConstrainedLegIKSolver | null;
  contactCurveCache: ContactCurveCache | null;
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
  const poleComputer = new ElbowPoleComputer();
  const clavicleRaiser = new ClavicleRaiser();
  const spineTwister = new SpineTwister();
  const animator = new AvatarAnimator(
    ikSolver,
    skeleton,
    poleComputer,
    clavicleRaiser,
    spineTwister,
  );
  const locomotion = new LocomotionAnimator();
  const fingers = new FingerAnimator();

  if (enableFootPlanting) {
    animator.setSkipHipsTwist(true);
  }

  const stateMachine = enableLocomotion ? new AnimationStateMachine() : null;
  const footPlanter = enableLocomotion ? new FootPlanter() : null;
  const legIKSolver = enableLocomotion
    ? new HingeConstrainedLegIKSolver()
    : null;
  const contactCurveCache = enableLocomotion ? new ContactCurveCache() : null;
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
    legIKSolver,
    contactCurveCache,
    turnAnimator,
    rootMotionExtractor,
  };
}
