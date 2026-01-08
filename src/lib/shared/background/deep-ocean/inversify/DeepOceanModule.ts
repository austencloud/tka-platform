import type { ContainerModuleLoadOptions } from "inversify";
import { ContainerModule } from "inversify";
import { TYPES } from "../../../inversify/types";

// Contracts
import type { IBubblePhysics } from "../services/contracts/IBubblePhysics";
import type { IParticleSystem } from "../services/contracts/IParticleSystem";
import type { ILightRayCalculator } from "../services/contracts/ILightRayCalculator";
import type { IFishAnimator } from "../services/contracts/IFishAnimator";
import type { IJellyfishAnimator } from "../services/contracts/IJellyfishAnimator";
import type { IGradientRenderer } from "../services/contracts/IGradientRenderer";
import type { ILightRayRenderer } from "../services/contracts/ILightRayRenderer";
import type { IBubbleRenderer } from "../services/contracts/IBubbleRenderer";
import type { IParticleRenderer } from "../services/contracts/IParticleRenderer";
import type { IFishRenderer } from "../services/contracts/IFishRenderer";
import type { IJellyfishRenderer } from "../services/contracts/IJellyfishRenderer";

// Implementations
import { BubblePhysics } from "../services/implementations/BubblePhysics";
import { ParticleSystem } from "../services/implementations/ParticleSystem";
import { LightRayCalculator } from "../services/implementations/LightRayCalculator";
import { FishAnimator } from "../services/implementations/FishAnimator";
import { JellyfishAnimator } from "../services/implementations/JellyfishAnimator";
import { GradientRenderer } from "../services/implementations/GradientRenderer";
import { LightRayRenderer } from "../services/implementations/LightRayRenderer";
import { BubbleRenderer } from "../services/implementations/BubbleRenderer";
import { ParticleRenderer } from "../services/implementations/ParticleRenderer";
import { FishRenderer } from "../services/implementations/FishRenderer";
import { JellyfishRenderer } from "../services/implementations/JellyfishRenderer";

/**
 * Deep Ocean Background Services Module
 *
 * Focused, single-responsibility services for the deep ocean background.
 * Each service handles one specific concern (physics, animation, or rendering).
 *
 * Fish are now fully procedural (no sprites needed).
 */
export const deepOceanBackgroundModule = new ContainerModule(
  async (options: ContainerModuleLoadOptions) => {
    const { bind, isBound } = options;

    // === PHYSICS SERVICES ===
    if (!isBound(TYPES.IBubblePhysics)) {
      bind<IBubblePhysics>(TYPES.IBubblePhysics)
        .to(BubblePhysics)
        .inSingletonScope();
    }
    if (!isBound(TYPES.IParticleSystem)) {
      bind<IParticleSystem>(TYPES.IParticleSystem)
        .to(ParticleSystem)
        .inSingletonScope();
    }
    if (!isBound(TYPES.ILightRayCalculator)) {
      bind<ILightRayCalculator>(TYPES.ILightRayCalculator)
        .to(LightRayCalculator)
        .inSingletonScope();
    }

    // === ANIMATOR SERVICES ===
    if (!isBound(TYPES.IFishAnimator)) {
      bind<IFishAnimator>(TYPES.IFishAnimator)
        .to(FishAnimator)
        .inSingletonScope();
    }
    if (!isBound(TYPES.IJellyfishAnimator)) {
      bind<IJellyfishAnimator>(TYPES.IJellyfishAnimator)
        .to(JellyfishAnimator)
        .inSingletonScope();
    }

    // === RENDERER SERVICES ===
    if (!isBound(TYPES.IGradientRenderer)) {
      bind<IGradientRenderer>(TYPES.IGradientRenderer)
        .to(GradientRenderer)
        .inSingletonScope();
    }
    if (!isBound(TYPES.ILightRayRenderer)) {
      bind<ILightRayRenderer>(TYPES.ILightRayRenderer)
        .to(LightRayRenderer)
        .inSingletonScope();
    }
    if (!isBound(TYPES.IBubbleRenderer)) {
      bind<IBubbleRenderer>(TYPES.IBubbleRenderer)
        .to(BubbleRenderer)
        .inSingletonScope();
    }
    if (!isBound(TYPES.IParticleRenderer)) {
      bind<IParticleRenderer>(TYPES.IParticleRenderer)
        .to(ParticleRenderer)
        .inSingletonScope();
    }
    if (!isBound(TYPES.IFishRenderer)) {
      bind<IFishRenderer>(TYPES.IFishRenderer)
        .to(FishRenderer)
        .inSingletonScope();
    }
    if (!isBound(TYPES.IJellyfishRenderer)) {
      bind<IJellyfishRenderer>(TYPES.IJellyfishRenderer)
        .to(JellyfishRenderer)
        .inSingletonScope();
    }
  }
);
