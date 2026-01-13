/**
 * Pictograph Container - ITI Implementation
 *
 * Converted from Inversify pictograph.module.ts
 * Contains all pictograph-related services including:
 * - Arrow services (orchestration, positioning, rendering, key generation)
 * - Grid services
 * - Prop services
 * - Coordination services
 * - Query handlers
 *
 * Services are organized in dependency order to ensure proper initialization.
 */

import { createContainer } from "iti";

// ============================================================================
// ARROW ORCHESTRATION SERVICES
// ============================================================================
import { ArrowAdjustmentProcessor } from "../../pictograph/arrow/orchestration/services/implementations/ArrowAdjustmentProcessor";
import { ArrowCoordinateTransformer } from "../../pictograph/arrow/orchestration/services/implementations/ArrowCoordinateTransformer";
import { ArrowDataProcessor } from "../../pictograph/arrow/orchestration/services/implementations/ArrowDataProcessor";
import { ArrowGridCoordinator } from "../../pictograph/arrow/orchestration/services/implementations/ArrowGridCoordinator";
import { ArrowLifecycleManager } from "../../pictograph/arrow/orchestration/services/implementations/ArrowLifecycleManager";
import { ArrowPositioningOrchestrator } from "../../pictograph/arrow/orchestration/services/implementations/ArrowPositioningOrchestrator";
import { ArrowQuadrantCalculator } from "../../pictograph/arrow/orchestration/services/implementations/ArrowQuadrantCalculator";

// ============================================================================
// ARROW CALCULATION SERVICES
// ============================================================================
import { ArrowAdjustmentCalculator } from "../../pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator";
import { ArrowLocationCalculator } from "../../pictograph/arrow/positioning/calculation/services/implementations/ArrowLocationCalculator";
import { ArrowLocator } from "../../pictograph/arrow/positioning/calculation/services/implementations/ArrowLocator";
import { ArrowRotationCalculator } from "../../pictograph/arrow/positioning/calculation/services/implementations/ArrowRotationCalculator";
import { DashLocationCalculator } from "../../pictograph/arrow/positioning/calculation/services/implementations/DashLocationCalculator";
import {
  DirectionalTupleCalculator,
  DirectionalTupleProcessor,
  QuadrantIndexCalculator,
} from "../../pictograph/arrow/positioning/calculation/services/implementations/DirectionalTupleProcessor";
import { HandpathDirectionCalculator } from "../../pictograph/arrow/positioning/calculation/services/implementations/HandpathDirectionCalculator";
import { ScreenSpaceAdjustmentTransformer } from "../../pictograph/arrow/positioning/calculation/services/implementations/ScreenSpaceAdjustmentTransformer";

// ============================================================================
// ARROW KEY GENERATION SERVICES
// ============================================================================
import { ArrowPlacementKeyGenerator } from "../../pictograph/arrow/positioning/key-generation/services/implementations/ArrowPlacementKeyGenerator";
import { AttributeKeyGenerator } from "../../pictograph/arrow/positioning/key-generation/services/implementations/AttributeKeyGenerator";
import { SpecialPlacementOriKeyGenerator } from "../../pictograph/arrow/positioning/key-generation/services/implementations/SpecialPlacementOriKeyGenerator";
import { RotationAngleOverrideKeyGenerator } from "../../pictograph/arrow/positioning/key-generation/services/implementations/RotationAngleOverrideKeyGenerator";
import { TurnsTupleKeyGenerator } from "../../pictograph/arrow/positioning/key-generation/services/implementations/TurnsTupleKeyGenerator";

// ============================================================================
// ARROW PLACEMENT SERVICES
// ============================================================================
import { ArrowPlacer } from "../../pictograph/arrow/positioning/placement/services/implementations/ArrowPlacer";
import { DefaultPlacer } from "../../pictograph/arrow/positioning/placement/services/implementations/DefaultPlacer";
import { SpecialPlacer } from "../../pictograph/arrow/positioning/placement/services/implementations/SpecialPlacer";
import { SpecialPlacementDataProvider } from "../../pictograph/arrow/positioning/placement/services/implementations/SpecialPlacementDataProvider";
import { LetterClassifier } from "../../pictograph/arrow/positioning/placement/services/implementations/LetterClassifier";
import { TurnsTupleGenerator } from "../../pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator";
import { SpecialPlacementLookup } from "../../pictograph/arrow/positioning/placement/services/implementations/SpecialPlacementLookup";
import { RotationOverrideManager } from "../../pictograph/arrow/positioning/placement/services/implementations/RotationOverrideManager";

// ============================================================================
// ARROW RENDERING SERVICES
// ============================================================================
import { ArrowPathResolver } from "../../pictograph/arrow/rendering/services/implementations/ArrowPathResolver";
import { ArrowRenderer } from "../../pictograph/arrow/rendering/services/implementations/ArrowRenderer";
import { ArrowSvgColorTransformer } from "../../pictograph/arrow/rendering/services/implementations/ArrowSvgColorTransformer";
import { ArrowSvgLoader } from "../../pictograph/arrow/rendering/services/implementations/ArrowSvgLoader";
import { ArrowSvgParser } from "../../pictograph/arrow/rendering/services/implementations/ArrowSvgParser";

// ============================================================================
// GRID SERVICES
// ============================================================================
import { GridModeDeriver } from "../../pictograph/grid/services/implementations/GridModeDeriver";
import { GridPositionDeriver } from "../../pictograph/grid/services/implementations/GridPositionDeriver";
import { GridRenderer } from "../../pictograph/grid/services/implementations/GridRenderer";

// ============================================================================
// PROP SERVICES
// ============================================================================
import { BetaDetector } from "../../pictograph/prop/services/implementations/BetaDetector";
import { OrientationCalculator } from "../../pictograph/prop/services/implementations/OrientationCalculator";
import { PropPlacer } from "../../pictograph/prop/services/implementations/PropPlacer";
import { PropSvgLoader } from "../../pictograph/prop/services/implementations/PropSvgLoader";

// ============================================================================
// SHARED/COORDINATION SERVICES
// ============================================================================
import { CSVPictographParser } from "../../pictograph/shared/services/implementations/CSVPictographParser";
import { MotionQueryHandler } from "../../pictograph/shared/services/implementations/MotionQueryHandler";
import { PictographCoordinator } from "../../pictograph/shared/services/implementations/PictographCoordinator";
import { PictographPreparer } from "../../pictograph/shared/services/implementations/PictographPreparer";
import { StartPositionDeriver } from "../../pictograph/shared/services/implementations/StartPositionDeriver";
import { SvgPreloader } from "../../pictograph/shared/services/implementations/SvgPreloader";
import { LetterQueryHandler } from "../../pictograph/tka-glyph/services/implementations/LetterQueryHandler";

// ============================================================================
// EXTERNAL DEPENDENCIES (from other containers)
// ============================================================================
import { dataContainer } from "./data-container";

// ============================================================================
// SVG CONFIG (from foundation)
// ============================================================================
import type { ISvgConfig } from "../../pictograph/shared/domain/models/svg-models";

// Create SVG config constant (matching legacy values)
const SVG_CONFIG: ISvgConfig = {
  SVG_SIZE: 950,
  CENTER_X: 475,
  CENTER_Y: 475,
};

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================
// Services marked as singleton in Inversify need to be instantiated once at module level

// Arrow SVG Loader - singleton for cache persistence
const arrowSvgLoader = new ArrowSvgLoader(
  new ArrowPathResolver(),
  new ArrowSvgParser(),
  new ArrowSvgColorTransformer()
);

// Prop SVG Loader - singleton for cache persistence
const propSvgLoader = new PropSvgLoader();

// SVG Preloader - singleton for cache persistence
const svgPreloader = new SvgPreloader();

// Rotation Override Manager - singleton for localStorage state
// (will be initialized in layer that has its dependencies)
let rotationOverrideManager: RotationOverrideManager;

// ============================================================================
// CONTAINER DEFINITION (inside else block)
// ============================================================================

const pictographContainer = createContainer()
  // === Layer 1: Leaf services with no dependencies ===
  .add({
    // Grid services (leaf)
    gridModeDeriver: () => new GridModeDeriver(),
    gridPositionDeriver: () => new GridPositionDeriver(),

    // Prop services (leaf)
    orientationCalculator: () => new OrientationCalculator(),
    propSvgLoader: () => propSvgLoader,

    // Arrow calculation services (leaf)
    // Note: arrowRotationCalculator moved to Layer 4 (needs specialPlacer, handpathDirectionCalculator)
    dashLocationCalculator: () => new DashLocationCalculator(),
    handpathDirectionCalculator: () => new HandpathDirectionCalculator(),
    // Note: QuadrantIndexCalculator needs arrowQuadrantCalculator, moved to layer 2

    // Arrow key generation services (leaf)
    specialPlacementOriKeyGenerator: () => new SpecialPlacementOriKeyGenerator(),
    turnsTupleKeyGenerator: () => new TurnsTupleKeyGenerator(),
    rotationAngleOverrideKeyGenerator: () => new RotationAngleOverrideKeyGenerator(),

    // Arrow rendering services (leaf)
    arrowPathResolver: () => new ArrowPathResolver(),
    arrowSvgParser: () => new ArrowSvgParser(),
    arrowSvgColorTransformer: () => new ArrowSvgColorTransformer(),

    // Arrow placement services (leaf)
    arrowPlacer: () => new ArrowPlacer(),
    letterClassifier: () => new LetterClassifier(),
    turnsTupleGenerator: () => new TurnsTupleGenerator(),
    specialPlacementDataProvider: () => new SpecialPlacementDataProvider(),
    defaultPlacer: () => new DefaultPlacer(),

    // Arrow orchestration services (leaf)
    arrowQuadrantCalculator: () => new ArrowQuadrantCalculator(),
    arrowCoordinateTransformer: () => new ArrowCoordinateTransformer(),
    // Note: ArrowDataProcessor needs arrowGridCoordinator, moved to later layer

    // SVG services (singleton)
    svgPreloader: () => svgPreloader,

    // SVG Config (constant)
    svgConfig: () => SVG_CONFIG,
  })

  // === Layer 2: Services depending on Layer 1 ===
  .add((deps) => ({
    // Grid renderer depends on svgConfig
    gridRenderer: () => new GridRenderer(deps.svgConfig),

    // Beta detector depends on gridPositionDeriver
    betaDetector: () => new BetaDetector(deps.gridPositionDeriver),

    // Start position deriver depends on gridPositionDeriver
    startPositionDeriver: () => new StartPositionDeriver(deps.gridPositionDeriver),

    // Arrow SVG Loader - singleton with dependencies
    arrowSvgLoader: () => arrowSvgLoader,

    // Directional tuple calculator (no constructor dependencies)
    directionalTupleCalculator: () => new DirectionalTupleCalculator(),

    // Special placement lookup depends on letterClassifier
    specialPlacementLookup: () => new SpecialPlacementLookup(deps.letterClassifier),

    // Attribute key generator (no constructor dependencies)
    attributeKeyGenerator: () => new AttributeKeyGenerator(),

    // Arrow location calculator depends on dashLocationCalculator only
    arrowLocationCalculator: () =>
      new ArrowLocationCalculator(deps.dashLocationCalculator),

    // QuadrantIndexCalculator depends on arrowQuadrantCalculator
    quadrantIndexCalculator: () =>
      new QuadrantIndexCalculator(deps.arrowQuadrantCalculator),
  }))

  // === Layer 3: Services depending on Layers 1-2 ===
  .add((deps) => ({
    // Prop placer depends on gridModeDeriver and betaDetector
    propPlacer: () => new PropPlacer(deps.gridModeDeriver, deps.betaDetector),

    // CSV pictograph parser depends on external enumMapper and orientationCalculator
    csvPictographParser: () =>
      new CSVPictographParser(
        dataContainer.items.enumMapper,
        deps.orientationCalculator
      ),

    // Directional tuple processor depends on directionalTupleCalculator and quadrantIndexCalculator
    directionalTupleProcessor: () =>
      new DirectionalTupleProcessor(
        deps.directionalTupleCalculator,
        deps.quadrantIndexCalculator
      ),

    // Screen space adjustment transformer - converts WASD input to reference values
    // Uses directionalTupleCalculator (Layer 2) and arrowQuadrantCalculator (Layer 1)
    screenSpaceAdjustmentTransformer: () =>
      new ScreenSpaceAdjustmentTransformer(
        deps.directionalTupleCalculator,
        deps.arrowQuadrantCalculator
      ),

    // Arrow locator (no constructor dependencies)
    arrowLocator: () => new ArrowLocator(),

    // Arrow placement key generator (no constructor dependencies)
    arrowPlacementKeyGenerator: () => new ArrowPlacementKeyGenerator(),

    // Arrow grid coordinator (no constructor dependencies)
    arrowGridCoordinator: () => new ArrowGridCoordinator(),

    // Arrow renderer depends on pathResolver, svgParser, colorTransformer, svgLoader
    arrowRenderer: () =>
      new ArrowRenderer(
        deps.arrowPathResolver,
        deps.arrowSvgParser,
        deps.arrowSvgColorTransformer,
        deps.arrowSvgLoader
      ),

    // Special placer depends on specialPlacementDataProvider, turnsTupleGenerator, specialPlacementLookup, gridModeDeriver
    specialPlacer: () =>
      new SpecialPlacer(
        deps.specialPlacementDataProvider,
        deps.turnsTupleGenerator,
        deps.specialPlacementLookup,
        deps.gridModeDeriver
      ),
  }))

  // === Layer 4: Services depending on Layers 1-3 ===
  .add((deps) => ({
    // ArrowRotationCalculator needs specialPlacer (Layer 3), rotationAngleOverrideKeyGenerator (Layer 1), handpathDirectionCalculator (Layer 1)
    arrowRotationCalculator: () =>
      new ArrowRotationCalculator(
        deps.specialPlacer,
        deps.rotationAngleOverrideKeyGenerator,
        deps.handpathDirectionCalculator
      ),

    // Rotation override manager depends on turnsTupleGenerator, rotationAngleOverrideKeyGenerator, gridModeDeriver
    rotationOverrideManager: () => {
      if (!rotationOverrideManager) {
        rotationOverrideManager = new RotationOverrideManager(
          deps.turnsTupleGenerator,
          deps.rotationAngleOverrideKeyGenerator,
          deps.gridModeDeriver
        );
      }
      return rotationOverrideManager;
    },

    // ArrowDataProcessor depends on arrowGridCoordinator
    arrowDataProcessor: () => new ArrowDataProcessor(deps.arrowGridCoordinator),

    // Arrow adjustment processor depends on arrowQuadrantCalculator
    arrowAdjustmentProcessor: () =>
      new ArrowAdjustmentProcessor(deps.arrowQuadrantCalculator),

    // Arrow adjustment calculator depends on many services
    arrowAdjustmentCalculator: () =>
      new ArrowAdjustmentCalculator(
        deps.gridModeDeriver,
        deps.specialPlacer,
        deps.defaultPlacer,
        deps.specialPlacementOriKeyGenerator,
        deps.arrowPlacementKeyGenerator,
        deps.turnsTupleKeyGenerator,
        deps.attributeKeyGenerator,
        deps.directionalTupleProcessor
      ),
  }))

  // === Layer 5: Services depending on Layers 1-4 ===
  .add((deps) => ({
    // Arrow positioning orchestrator depends on 5 services:
    // locationCalculator, rotationCalculator, adjustmentCalculator, coordinateSystem, dataProcessor
    arrowPositioningOrchestrator: () =>
      new ArrowPositioningOrchestrator(
        deps.arrowLocationCalculator,
        deps.arrowRotationCalculator,
        deps.arrowAdjustmentCalculator,
        deps.arrowGridCoordinator,
        deps.arrowDataProcessor
      ),
  }))

  // === Layer 6: High-level orchestration services ===
  .add((deps) => ({
    // Arrow lifecycle manager depends on svgLoader and positioningOrchestrator (2 args)
    arrowLifecycleManager: () =>
      new ArrowLifecycleManager(
        deps.arrowSvgLoader,
        deps.arrowPositioningOrchestrator
      ),
  }))

  // === Layer 7: Top-level coordination services ===
  .add((deps) => ({
    // Pictograph coordinator depends on arrowLifecycleManager
    pictographCoordinator: () =>
      new PictographCoordinator(deps.arrowLifecycleManager),

    // Pictograph preparer depends on arrowLifecycleManager, propSvgLoader, propPlacer, gridModeDeriver
    pictographPreparer: () =>
      new PictographPreparer(
        deps.arrowLifecycleManager,
        deps.propSvgLoader,
        deps.propPlacer,
        deps.gridModeDeriver
      ),

    // Motion query handler depends on external csvLoader, csvParser, csvPictographParser, orientationCalculator
    motionQueryHandler: () =>
      new MotionQueryHandler(
        dataContainer.items.csvLoader,
        dataContainer.items.csvParser,
        deps.csvPictographParser,
        deps.orientationCalculator
      ),

    // Letter query handler depends on external csvLoader, csvParser, csvPictographParser
    // Note: letterMappingRepo is optional and injected separately when available
    letterQueryHandler: () =>
      new LetterQueryHandler(
        dataContainer.items.csvLoader,
        dataContainer.items.csvParser,
        deps.csvPictographParser
      ),
  }));

// Export the container (browser path)
export { pictographContainer };

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PictographContainerType = typeof pictographContainer;
