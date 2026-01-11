/**
 * Deep Ocean Container - ITI-based dependency injection for deep ocean background services
 *
 * This container manages all deep ocean animation services including:
 * - Physics (bubbles, particles, light rays)
 * - Animators (fish, jellyfish)
 * - Renderers (gradient, bubbles, fish, etc.)
 *
 * Migrated from Inversify's DeepOceanModule.ts
 */

import { createContainer } from "iti";

// Physics services
import { BubblePhysics } from "../../background/deep-ocean/services/implementations/BubblePhysics";
import { ParticleSystem } from "../../background/deep-ocean/services/implementations/ParticleSystem";
import { LightRayCalculator } from "../../background/deep-ocean/services/implementations/LightRayCalculator";

// Animator services
import { FishAnimator } from "../../background/deep-ocean/services/implementations/FishAnimator";
import { JellyfishAnimator } from "../../background/deep-ocean/services/implementations/JellyfishAnimator";

// Fish subsystem services
import { FishFactory } from "../../background/deep-ocean/services/implementations/FishFactory";
import { FishSpineController } from "../../background/deep-ocean/services/implementations/FishSpineController";
import { FishMovementController } from "../../background/deep-ocean/services/implementations/FishMovementController";
import { FishFlockingCalculator } from "../../background/deep-ocean/services/implementations/FishFlockingCalculator";
import { FishVisualUpdater } from "../../background/deep-ocean/services/implementations/FishVisualUpdater";
import { FishPropulsionCalculator } from "../../background/deep-ocean/services/implementations/FishPropulsionCalculator";
import { FishPersonalityGenerator } from "../../background/deep-ocean/services/implementations/FishPersonalityGenerator";
import { FishMoodManager } from "../../background/deep-ocean/services/implementations/FishMoodManager";
import { FishDecisionMaker } from "../../background/deep-ocean/services/implementations/FishDecisionMaker";
import { FishWobbleAnimator } from "../../background/deep-ocean/services/implementations/FishWobbleAnimator";

// Renderer services
import { GradientRenderer } from "../../background/deep-ocean/services/implementations/GradientRenderer";
import { LightRayRenderer } from "../../background/deep-ocean/services/implementations/LightRayRenderer";
import { BubbleRenderer } from "../../background/deep-ocean/services/implementations/BubbleRenderer";
import { ParticleRenderer } from "../../background/deep-ocean/services/implementations/ParticleRenderer";
import { JellyfishRenderer } from "../../background/deep-ocean/services/implementations/JellyfishRenderer";

// Fish rendering services (complex dependency chain)
import { ColorCalculator } from "../../background/deep-ocean/services/implementations/ColorCalculator";
import { FishEffectRenderer } from "../../background/deep-ocean/services/implementations/FishEffectRenderer";
import { FishFaceRenderer } from "../../background/deep-ocean/services/implementations/FishFaceRenderer";
import { FishFinRenderer } from "../../background/deep-ocean/services/implementations/FishFinRenderer";
import { FishBodyRenderer } from "../../background/deep-ocean/services/implementations/FishBodyRenderer";
import { FishPatternRenderer } from "../../background/deep-ocean/services/implementations/FishPatternRenderer";
import { FishRenderer } from "../../background/deep-ocean/services/implementations/FishRenderer";

// Orchestrator
import { DeepOceanBackgroundOrchestrator } from "../../background/deep-ocean/services/DeepOceanBackgroundOrchestrator";

/**
 * Deep Ocean container with all animation services
 *
 * Services are organized in dependency order:
 * 1. Base services with no dependencies
 * 2. Services that depend on layer 1 (ColorCalculator)
 * 3. Services that depend on layers 1-2 (FishPatternRenderer, FishRenderer)
 * 4. Orchestrator that combines everything
 */
export const deepOceanContainer = createContainer()
  // === Layer 1: Base services with no dependencies ===
  .add({
    // Physics services
    bubblePhysics: () => new BubblePhysics(),
    particleSystem: () => new ParticleSystem(),
    lightRayCalculator: () => new LightRayCalculator(),

    // Fish propulsion (calculates thrust from tail physics)
    fishPropulsionCalculator: () => new FishPropulsionCalculator(),

    // Fish personality (generates unique traits per fish)
    fishPersonalityGenerator: () => new FishPersonalityGenerator(),

    // Fish mood (manages emotional state transitions)
    fishMoodManager: () => new FishMoodManager(),

    // Fish decision making (personality-influenced behavior decisions)
    fishDecisionMaker: () => new FishDecisionMaker(),

    // Fish wobble animations (expressive visual animations)
    fishWobbleAnimator: () => new FishWobbleAnimator(),

    fishFlockingCalculator: () => new FishFlockingCalculator(),
    fishVisualUpdater: () => new FishVisualUpdater(),

    // Other animators
    jellyfishAnimator: () => new JellyfishAnimator(),

    // Simple renderer services
    gradientRenderer: () => new GradientRenderer(),
    lightRayRenderer: () => new LightRayRenderer(),
    bubbleRenderer: () => new BubbleRenderer(),
    particleRenderer: () => new ParticleRenderer(),
    jellyfishRenderer: () => new JellyfishRenderer(),

    // Base fish utility
    colorCalculator: () => new ColorCalculator(),
  })

  // === Layer 1.25: Services that depend on other fish services ===
  .add((deps) => ({
    fishSpineController: () => new FishSpineController(deps.fishPropulsionCalculator),
    fishFactory: () => new FishFactory(deps.fishPersonalityGenerator),
    fishMovementController: () => new FishMovementController(deps.fishDecisionMaker),
  }))

  // === Layer 1.5: FishAnimator depends on fish subsystem services ===
  .add((deps) => ({
    fishAnimator: () =>
      new FishAnimator(
        deps.fishFactory,
        deps.fishSpineController,
        deps.fishMovementController,
        deps.fishFlockingCalculator,
        deps.fishVisualUpdater,
        deps.fishMoodManager,
        deps.fishWobbleAnimator
      ),
  }))

  // === Layer 2: Fish renderers that depend on ColorCalculator ===
  .add((deps) => ({
    fishEffectRenderer: () => new FishEffectRenderer(deps.colorCalculator),
    fishFaceRenderer: () => new FishFaceRenderer(deps.colorCalculator),
    fishFinRenderer: () => new FishFinRenderer(deps.colorCalculator),
    fishBodyRenderer: () => new FishBodyRenderer(deps.colorCalculator),
  }))

  // === Layer 3: FishPatternRenderer depends on multiple Layer 2 services ===
  .add((deps) => ({
    fishPatternRenderer: () =>
      new FishPatternRenderer(
        deps.colorCalculator,
        deps.fishEffectRenderer,
        deps.fishFinRenderer,
        deps.fishFaceRenderer,
        deps.fishBodyRenderer
      ),
  }))

  // === Layer 4: FishRenderer depends on Layer 2 and 3 ===
  .add((deps) => ({
    fishRenderer: () =>
      new FishRenderer(
        deps.fishEffectRenderer,
        deps.fishFaceRenderer,
        deps.fishFinRenderer,
        deps.fishPatternRenderer,
        deps.fishBodyRenderer
      ),
  }))

  // === Layer 5: DeepOceanBackgroundOrchestrator (combines everything) ===
  .add((deps) => ({
    deepOceanBackgroundSystem: () =>
      new DeepOceanBackgroundOrchestrator(
        // Physics services
        deps.bubblePhysics,
        deps.particleSystem,
        deps.lightRayCalculator,
        // Animator services
        deps.fishAnimator,
        deps.jellyfishAnimator,
        // Renderer services
        deps.gradientRenderer,
        deps.lightRayRenderer,
        deps.bubbleRenderer,
        deps.particleRenderer,
        deps.fishRenderer,
        deps.jellyfishRenderer
      ),
  }));

export type DeepOceanContainerType = typeof deepOceanContainer;
