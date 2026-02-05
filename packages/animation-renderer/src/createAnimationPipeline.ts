/**
 * Factory function to create a complete animation rendering pipeline.
 *
 * Wires together all computation, rendering, and orchestration services
 * with constructor injection. Consuming apps call this once instead of
 * manually constructing each service.
 */

import { AngleCalculator } from "./computation/AngleCalculator";
import { MotionCalculator } from "./computation/MotionCalculator";
import { EndpointCalculator } from "./computation/EndpointCalculator";
import { PropInterpolator } from "./computation/PropInterpolator";
import { StepCalculator } from "./computation/StepCalculator";
import { AnimationStateManager } from "./computation/AnimationStateManager";
import { AnimationLoop } from "./computation/AnimationLoop";
import { Canvas2DAnimationRenderer } from "./rendering/Canvas2DAnimationRenderer";
import { SVGGenerator } from "./rendering/SVGGenerator";
import type { SVGGeneratorConfig } from "./rendering/SVGGenerator";
import {
  SequenceAnimationOrchestrator,
  type OrchestratorConfig,
} from "./orchestration/SequenceAnimationOrchestrator";

export interface AnimationPipelineConfig {
  /** Base path for static assets (prop SVGs, grid SVGs). Default: "" */
  assetBasePath?: string;
  /** Function to get current dark mode state. Default: () => true */
  getDarkMode?: () => boolean;
  /** Default blue prop type. Default: "staff" */
  defaultBluePropType?: string;
  /** Default red prop type. Default: "staff" */
  defaultRedPropType?: string;
}

export interface AnimationPipeline {
  renderer: Canvas2DAnimationRenderer;
  orchestrator: SequenceAnimationOrchestrator;
  animationLoop: AnimationLoop;
  svgGenerator: SVGGenerator;
  stateManager: AnimationStateManager;
}

/**
 * Create a complete animation rendering pipeline.
 *
 * Usage:
 * ```ts
 * const pipeline = createAnimationPipeline({
 *   assetBasePath: "",
 *   getDarkMode: () => true,
 *   defaultBluePropType: "staff",
 *   defaultRedPropType: "staff",
 * });
 *
 * // Initialize the canvas
 * await pipeline.renderer.initialize(containerElement, 500);
 * await pipeline.renderer.loadPropTextures("staff");
 * await pipeline.renderer.loadGridTexture("diamond");
 *
 * // Load a sequence
 * pipeline.orchestrator.initializeWithDomainData(sequenceData);
 *
 * // Start the animation loop
 * pipeline.animationLoop.start((deltaTime) => {
 *   // advance time, calculate state, render...
 * }, 1.0);
 * ```
 */
export function createAnimationPipeline(
  config: AnimationPipelineConfig = {}
): AnimationPipeline {
  // Computation layer
  const angleCalculator = new AngleCalculator();
  const motionCalculator = new MotionCalculator();
  const endpointCalculator = new EndpointCalculator(
    angleCalculator,
    motionCalculator
  );
  const propInterpolator = new PropInterpolator(angleCalculator, endpointCalculator);
  const stepCalculator = new StepCalculator();
  const stateManager = new AnimationStateManager();

  // Rendering layer
  const svgGeneratorConfig: SVGGeneratorConfig = {
    assetBasePath: config.assetBasePath ?? "",
    getDarkMode: config.getDarkMode ?? (() => true),
  };
  const svgGenerator = new SVGGenerator(svgGeneratorConfig);
  const renderer = new Canvas2DAnimationRenderer(svgGenerator);

  // Orchestration layer
  const orchestratorConfig: OrchestratorConfig = {
    defaultBluePropType: config.defaultBluePropType ?? "staff",
    defaultRedPropType: config.defaultRedPropType ?? "staff",
  };
  const orchestrator = new SequenceAnimationOrchestrator(
    stateManager,
    stepCalculator,
    propInterpolator,
    orchestratorConfig
  );

  // Animation loop
  const animationLoop = new AnimationLoop();

  return {
    renderer,
    orchestrator,
    animationLoop,
    svgGenerator,
    stateManager,
  };
}
