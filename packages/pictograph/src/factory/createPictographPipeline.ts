/**
 * createPictographPipeline - Factory function for wiring all pictograph services
 *
 * Creates a fully-wired pictograph preparation pipeline from a PictographConfig.
 * Same pattern as createAnimationPipeline() in @tka/animation-renderer.
 *
 * Usage:
 *   const pipeline = createPictographPipeline(config);
 *   const prepared = await pipeline.preparer.prepareSingle(stepData);
 *
 * For scribe (full pipeline with arrow adjustment):
 *   const pipeline = createPictographPipeline(config, {
 *     adjustmentCalculator: myArrowAdjustmentCalculator,
 *   });
 *
 * For landing (simplified, uses zero-adjustment default):
 *   const pipeline = createPictographPipeline(config);
 */

import type { PictographConfig } from "../config/PictographConfig";
import { DEFAULT_PICTOGRAPH_CONFIG } from "../config/PictographConfig";
import type { IArrowAdjustmentCalculator } from "../services/arrow/positioning/contracts/IArrowAdjustmentCalculator";
import type { IPictographPreparer } from "../services/shared/contracts/IPictographPreparer";
import type { ISvgPreloader } from "../services/shared/contracts/ISvgPreloader";

// Tier 1 services
import { GridModeDeriver } from "../services/grid/implementations/GridModeDeriver";
import { GridPositionDeriver } from "../services/grid/implementations/GridPositionDeriver";
import { ArrowPathResolver } from "../services/arrow/rendering/implementations/ArrowPathResolver";
import { ArrowSvgParser } from "../services/arrow/rendering/implementations/ArrowSvgParser";
import { ArrowSvgColorTransformer } from "../services/arrow/rendering/implementations/ArrowSvgColorTransformer";
import { ArrowLocationCalculator } from "../services/arrow/positioning/implementations/ArrowLocationCalculator";
import { ArrowRotationCalculator } from "../services/arrow/positioning/implementations/ArrowRotationCalculator";
import { DashLocationCalculator } from "../services/arrow/positioning/implementations/DashLocationCalculator";
import { HandpathDirectionCalculator } from "../services/arrow/positioning/implementations/HandpathDirectionCalculator";
import { SvgPreloader } from "../services/shared/implementations/SvgPreloader";
import { BetaDetector } from "../services/prop/implementations/BetaDetector";

// Tier 2/3 services
import { ArrowSvgLoader } from "../services/arrow/rendering/implementations/ArrowSvgLoader";
import { PropSvgLoader } from "../services/prop/implementations/PropSvgLoader";
import { PropPlacer } from "../services/prop/implementations/PropPlacer";
import { ArrowGridCoordinator } from "../services/arrow/orchestration/implementations/ArrowGridCoordinator";
import { ArrowDataProcessor } from "../services/arrow/orchestration/implementations/ArrowDataProcessor";
import { ArrowPositioningOrchestrator } from "../services/arrow/orchestration/implementations/ArrowPositioningOrchestrator";
import { ArrowLifecycleManager } from "../services/arrow/orchestration/implementations/ArrowLifecycleManager";
import { PictographPreparer } from "../services/shared/implementations/PictographPreparer";

// Default no-op adjustment calculator (returns {0,0} for all lookups)
import { Point } from "../domain/Point";

class NoOpAdjustmentCalculator implements IArrowAdjustmentCalculator {
  async calculateAdjustment(): Promise<Point> {
    return new Point(0, 0);
  }
  async getBaseAdjustmentPublic(): Promise<Point> {
    return new Point(0, 0);
  }
}

export interface PictographPipelineOptions {
  /** Custom arrow adjustment calculator (scribe injects its full implementation) */
  adjustmentCalculator?: IArrowAdjustmentCalculator;
}

export interface PictographPipeline {
  preparer: IPictographPreparer;
  config: PictographConfig;
  preloader: ISvgPreloader;
}

export function createPictographPipeline(
  config: PictographConfig = DEFAULT_PICTOGRAPH_CONFIG,
  options?: PictographPipelineOptions
): PictographPipeline {
  // Tier 1: Leaf services
  const gridModeDeriver = new GridModeDeriver();
  const gridPositionDeriver = new GridPositionDeriver();
  const betaDetector = new BetaDetector(gridPositionDeriver);
  const preloader = new SvgPreloader(config.assetBasePath);

  // Arrow rendering chain
  const pathResolver = new ArrowPathResolver();
  const svgParser = new ArrowSvgParser();
  const colorTransformer = new ArrowSvgColorTransformer();
  const arrowSvgLoader = new ArrowSvgLoader(
    pathResolver,
    svgParser,
    colorTransformer,
    config
  );

  // Arrow positioning chain
  const dashLocationCalculator = new DashLocationCalculator();
  const handpathDirectionCalculator = new HandpathDirectionCalculator();
  const arrowLocationCalculator = new ArrowLocationCalculator(
    dashLocationCalculator
  );
  const arrowRotationCalculator = new ArrowRotationCalculator(
    undefined,
    undefined,
    handpathDirectionCalculator
  );

  // Arrow orchestration
  const gridCoordinator = new ArrowGridCoordinator();
  const dataProcessor = new ArrowDataProcessor(gridCoordinator);
  const adjustmentCalculator =
    options?.adjustmentCalculator ?? new NoOpAdjustmentCalculator();
  const positioningOrchestrator = new ArrowPositioningOrchestrator(
    arrowLocationCalculator,
    arrowRotationCalculator,
    adjustmentCalculator,
    gridCoordinator,
    dataProcessor
  );

  // Lifecycle manager
  const arrowLifecycleManager = new ArrowLifecycleManager(
    arrowSvgLoader,
    positioningOrchestrator
  );

  // Prop services
  const propSvgLoader = new PropSvgLoader(config);
  const propPlacer = new PropPlacer(gridModeDeriver, betaDetector, config);

  // Top-level orchestrator
  const preparer = new PictographPreparer(
    arrowLifecycleManager,
    propSvgLoader,
    propPlacer,
    gridModeDeriver,
    config
  );

  return {
    preparer,
    config,
    preloader,
  };
}
