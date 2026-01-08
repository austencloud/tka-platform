/**
 * Animation 3D DI Module
 *
 * Registers all 3D animation services with the inversify container.
 * Uses safe binding to prevent duplicate bindings during HMR.
 */

import type { ContainerModuleLoadOptions } from "inversify";
import { ContainerModule } from "inversify";
import { ANIMATION_3D_TYPES } from "./animation-3d.types";
import { createSafeBinder } from "../../inversify/hmr/safeBind";

// Implementations
import { AngleMathCalculator } from "../services/implementations/AngleMathCalculator";
import { OrientationMapper } from "../services/implementations/OrientationMapper";
import { MotionCalculator } from "../services/implementations/MotionCalculator";
import { PlaneCoordinateMapper } from "../services/implementations/PlaneCoordinateMapper";
import { PropStateInterpolator } from "../services/implementations/PropStateInterpolator";
import { SequenceConverter } from "../services/implementations/SequenceConverter";
import { Animation3DPersister } from "../services/implementations/Animation3DPersister";

// Avatar system (production-quality rigged model support)
import { AvatarSkeletonBuilder } from "../services/implementations/AvatarSkeletonBuilder";
import { IKSolver } from "../services/implementations/IKSolver";
import { AvatarCustomizer } from "../services/implementations/AvatarCustomizer";
import { AvatarAnimator } from "../services/implementations/AvatarAnimator";

// Duet system
import { DuetPersister } from "../services/implementations/DuetPersister";

// Locomotion animation
import { LegAnimator } from "../services/implementations/LegAnimator";

export const animation3DModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    // Use safe binder to prevent duplicate bindings during HMR
    const bind = createSafeBinder(options);

    // Core math services (no dependencies)
    bind(ANIMATION_3D_TYPES.IAngleMathCalculator)
      .to(AngleMathCalculator)
      .inSingletonScope();

    bind(ANIMATION_3D_TYPES.IOrientationMapper)
      .to(OrientationMapper)
      .inSingletonScope();

    // Motion calculator (depends on angle math + orientation)
    bind(ANIMATION_3D_TYPES.IMotionCalculator3D)
      .to(MotionCalculator)
      .inSingletonScope();

    // Coordinate mapping
    bind(ANIMATION_3D_TYPES.IPlaneCoordinateMapper)
      .to(PlaneCoordinateMapper)
      .inSingletonScope();

    // Prop state interpolation (depends on angle math, orientation, motion calculator)
    bind(ANIMATION_3D_TYPES.IPropStateInterpolator)
      .to(PropStateInterpolator)
      .inSingletonScope();

    // Sequence conversion
    bind(ANIMATION_3D_TYPES.ISequenceConverter)
      .to(SequenceConverter)
      .inSingletonScope();

    // Persistence
    bind(ANIMATION_3D_TYPES.IAnimation3DPersister)
      .to(Animation3DPersister)
      .inSingletonScope();

    // ═══════════════════════════════════════════════════════════════════════════
    // AVATAR SYSTEM (Production-quality rigged model support)
    // ═══════════════════════════════════════════════════════════════════════════
    // These are TRANSIENT (not singleton) because each Avatar3D needs its own
    // independent skeleton, IK solver, animator, and customizer instance.
    // This enables dual/multi-avatar mode where avatars don't share state.

    // Skeleton management (GLTF loading, bone access)
    bind(ANIMATION_3D_TYPES.IAvatarSkeletonBuilder)
      .to(AvatarSkeletonBuilder)
      .inTransientScope();

    // IK solver (analytic, CCD, FABRIK algorithms)
    bind(ANIMATION_3D_TYPES.IIKSolver).to(IKSolver).inTransientScope();

    // Customization (body type, skin tone, proportions)
    bind(ANIMATION_3D_TYPES.IAvatarCustomizer)
      .to(AvatarCustomizer)
      .inTransientScope();

    // Animation (pose blending, transitions)
    bind(ANIMATION_3D_TYPES.IAvatarAnimator)
      .to(AvatarAnimator)
      .inTransientScope();

    // ═══════════════════════════════════════════════════════════════════════════
    // DUET SYSTEM (Dual-avatar coordinated performance)
    // ═══════════════════════════════════════════════════════════════════════════

    // Duet persistence (localStorage, sequence resolution)
    bind(ANIMATION_3D_TYPES.IDuetPersister)
      .to(DuetPersister)
      .inSingletonScope();

    // ═══════════════════════════════════════════════════════════════════════════
    // LOCOMOTION ANIMATION
    // ═══════════════════════════════════════════════════════════════════════════
    // Transient scope - each avatar needs its own leg animator

    bind(ANIMATION_3D_TYPES.ILegAnimator)
      .to(LegAnimator)
      .inTransientScope();
  }
);
