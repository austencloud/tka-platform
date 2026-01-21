/**
 * Build Container - ITI-based Dependency Injection
 *
 * Provides all services for the Create module including:
 * - Create module orchestration (14 services)
 * - Option picker (12 services)
 * - Start position (1 service)
 * - Generation pipeline (41 services including 14 LOOP executors)
 * - Sequence management (10 services)
 * - Extension (6 services)
 * - Spell/Pattern (10 services)
 *
 * Uses ITI (Isomorphic TypeScript Injection) for lightweight DI without decorators.
 */

import { createContainer } from "iti";

// === Create Module Services ===
import { CreateModuleOrchestrator } from "$lib/features/create/shared/services/implementations/CreateModuleOrchestrator";
import { CreateModuleHandlers } from "$lib/features/create/shared/services/implementations/CreateModuleHandlers";
import { CreateModuleLayoutManager } from "$lib/features/create/shared/layout/services/CreateModuleLayoutManager";
import { CreateModuleInitializer } from "$lib/features/create/shared/services/implementations/CreateModuleInitializer";
import { CreateModuleEffectCoordinator } from "$lib/features/create/shared/services/implementations/CreateModuleEffectCoordinator";
import { DeepLinkSequenceHandler } from "$lib/features/create/shared/services/implementations/DeepLinkSequenceHandler";
import { ResponsiveLayoutManager } from "$lib/features/create/shared/services/implementations/ResponsiveLayoutManager";
import { NavigationSyncer } from "$lib/features/create/shared/services/implementations/NavigationSyncer";
import { StepOperator } from "$lib/features/create/shared/services/implementations/StepOperator";
import { KeyboardArrowAdjuster } from "$lib/features/create/shared/services/implementations/KeyboardArrowAdjuster";
import { ArrowAdjustmentOrchestrator } from "$lib/features/create/shared/services/implementations/ArrowAdjustmentOrchestrator";
import { UndoManager } from "$lib/features/create/shared/services/implementations/UndoManager";
import { ConstructCoordinator } from "$lib/features/create/shared/services/implementations/ConstructCoordinator";
import { TurnController } from "$lib/features/create/edit/services/TurnController";
import { Workbench } from "$lib/features/create/shared/workspace-panel/shared/services/implementations/Workbench";

// === Option Picker Services ===
import { FilterPersister } from "$lib/features/create/construct/option-picker/services/FilterPersister";
import { ReversalChecker } from "$lib/features/create/construct/option-picker/services/implementations/ReversalChecker";
import { PositionAnalyzer } from "$lib/features/create/construct/option-picker/services/implementations/PositionAnalyzer";
import { OptionSorter } from "$lib/features/create/construct/option-picker/services/implementations/OptionSorter";
import { OptionFilter } from "$lib/features/create/construct/option-picker/services/implementations/OptionFilter";
import { OptionOrganizer } from "$lib/features/create/construct/option-picker/services/implementations/OptionOrganizer";
import { OptionLoader } from "$lib/features/create/construct/option-picker/services/implementations/OptionLoader";
import { LayoutDetector } from "$lib/features/create/construct/option-picker/services/implementations/LayoutDetector";
import { OptionTransitionCoordinator } from "$lib/features/create/construct/option-picker/services/implementations/OptionTransitionCoordinator";
import { SectionTitleFormatter } from "$lib/features/create/construct/option-picker/services/implementations/SectionTitleFormatter";
import { OptionGridFitCalculator } from "$lib/features/create/construct/option-picker/services/implementations/OptionGridFitCalculator";
import { AspectLayoutPlanner } from "$lib/features/create/construct/option-picker/services/implementations/AspectLayoutPlanner";

// === Start Position Services ===
import { StartPositionManager } from "$lib/features/create/construct/start-position-picker/services/implementations/StartPositionManager";

// === Generation Services ===
import { StepConverter } from "$lib/features/create/generate/shared/services/implementations/StepConverter";
import { PictographFilter } from "$lib/features/create/generate/shared/services/implementations/PictographFilter";
import { TurnManager } from "$lib/features/create/generate/shared/services/implementations/TurnManager";
import { LOOPParameterProvider } from "$lib/features/create/generate/shared/services/implementations/LOOPParameterProvider";
import { SequenceMetadataManager } from "$lib/features/create/generate/shared/services/implementations/SequenceMetadataManager";
import { StartPositionSelector } from "$lib/features/create/generate/shared/services/implementations/StartPositionSelector";
import { TurnAllocator } from "$lib/features/create/generate/shared/services/implementations/TurnAllocator";
import { StepGenerationOrchestrator } from "$lib/features/create/generate/shared/services/implementations/StepGenerationOrchestrator";
import { PartialSequenceGenerator } from "$lib/features/create/generate/circular/services/implementations/PartialSequenceGenerator";
import { RotatedEndPositionSelector } from "$lib/features/create/generate/circular/services/implementations/RotatedEndPositionSelector";
import { LOOPEndPositionSelector } from "$lib/features/create/generate/circular/services/implementations/LOOPEndPositionSelector";
import { TypographyScaler } from "$lib/features/create/generate/shared/services/implementations/TypographyScaler";
import { CardConfigurator } from "$lib/features/create/generate/shared/services/implementations/CardConfigurator";
import { LOOPTypeResolver } from "$lib/features/create/generate/shared/services/implementations/LOOPTypeResolver";
import { LOOPDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";
import { OrientationCycleDetector } from "$lib/features/create/generate/circular/services/implementations/OrientationCycleDetector";
import { GenerationOrchestrator } from "$lib/features/create/generate/shared/services/implementations/GenerationOrchestrator";

// === LOOP Executors (14 variations) ===
import { StrictRotatedLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/StrictRotatedLOOPExecutor";
import { StrictMirroredLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/StrictMirroredLOOPExecutor";
import { StrictSwappedLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/StrictSwappedLOOPExecutor";
import { StrictInvertedLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/StrictInvertedLOOPExecutor";
import { MirroredSwappedLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/MirroredSwappedLOOPExecutor";
import { SwappedInvertedLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/SwappedInvertedLOOPExecutor";
import { MirroredInvertedLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/MirroredInvertedLOOPExecutor";
import { RotatedSwappedLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/RotatedSwappedLOOPExecutor";
import { RotatedInvertedLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/RotatedInvertedLOOPExecutor";
import { MirroredRotatedLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/MirroredRotatedLOOPExecutor";
import { MirroredRotatedInvertedLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/MirroredRotatedInvertedLOOPExecutor";
import { MirroredSwappedInvertedLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/MirroredSwappedInvertedLOOPExecutor";
import { MirroredRotatedInvertedSwappedLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/MirroredRotatedInvertedSwappedLOOPExecutor";
import { RewoundLOOPExecutor } from "$lib/features/create/generate/circular/services/implementations/RewoundLOOPExecutor";
import { LOOPExecutorSelector } from "$lib/features/create/generate/circular/services/implementations/LOOPExecutorSelector";

// === Sequence Services ===
import { SequenceAnalyzer } from "$lib/features/create/shared/services/implementations/SequenceAnalyzer";
import { SequenceValidator } from "$lib/features/create/shared/services/implementations/SequenceValidator";
import { SequenceStatsCalculator } from "$lib/features/create/shared/services/implementations/SequenceStatsCalculator";
import { SequenceTransformer } from "$lib/features/create/shared/services/implementations/sequence-transforms/SequenceTransformer";
import { SequenceExporter } from "$lib/features/create/shared/services/implementations/SequenceExporter";
import { SequencePersister } from "$lib/features/create/shared/services/implementations/SequencePersister";
import { SequenceIndexer } from "$lib/features/create/shared/services/implementations/SequenceIndexer";

// === Sequence Extension Services ===
import { SequenceExtender } from "$lib/features/create/shared/services/implementations/SequenceExtender";
import { LOOPValidator } from "$lib/features/create/shared/services/implementations/LOOPValidator";
import { OrientationAlignmentCalculator } from "$lib/features/create/shared/services/implementations/OrientationAlignmentCalculator";
import { BridgeFinder } from "$lib/features/create/shared/services/implementations/BridgeFinder";

// === Panel Management ===
import { PanelPersister } from "$lib/features/create/shared/services/implementations/PanelPersister.svelte";
import { SubDrawerStatePersister } from "$lib/features/create/shared/services/implementations/SubDrawerStatePersister";
import { SequenceTransferHandler } from "$lib/features/create/shared/services/implementations/SequenceTransferHandler";
import { FirstStepAnalyzer } from "$lib/features/create/shared/services/implementations/FirstStepAnalyzer";
import { SequenceJsonExporter } from "$lib/features/create/shared/services/implementations/SequenceJsonExporter";
import { ExtensionFlowCoordinator } from "$lib/features/create/shared/services/implementations/ExtensionFlowCoordinator";

// === Pattern Management ===
import { RotationDirectionPatternManager } from "$lib/features/create/shared/services/implementations/RotationDirectionPatternManager";
import { TurnPatternManager } from "$lib/features/create/shared/services/implementations/TurnPatternManager";
import { DurationPatternManager } from "$lib/features/create/shared/services/implementations/DurationPatternManager";

// === Equivalence Detection ===
import { WordCyclicEquivalenceDetector } from "$lib/features/create/shared/services/implementations/WordCyclicEquivalenceDetector";

// === Spell Tab Services ===
import { LetterTransitionGraph } from "$lib/features/create/spell/services/implementations/LetterTransitionGraph";
import { WordSequenceGenerator } from "$lib/features/create/spell/services/implementations/WordSequenceGenerator";
import { SpellServiceLoader } from "$lib/features/create/spell/services/implementations/SpellServiceLoader";
import { VariationExplorationOrchestrator } from "$lib/features/create/spell/services/implementations/VariationExplorationOrchestrator";
import { StartPositionValidator } from "$lib/features/create/spell/services/implementations/StartPositionValidator";
import { OrientationContinuityValidator } from "$lib/features/create/spell/services/implementations/OrientationContinuityValidator";
import { LetterTypeClassifier } from "$lib/features/create/spell/services/implementations/LetterTypeClassifier";
import { VariationConstraintBuilder } from "$lib/features/create/spell/services/implementations/VariationConstraintBuilder";
import { RandomSequenceGenerator } from "$lib/features/create/spell/services/implementations/RandomSequenceGenerator";

// === Type Imports for Dependencies from Other Containers ===
import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
import type { IViewportManager } from "$lib/shared/device/services/contracts/IViewportManager";
import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { IGridModeDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridModeDeriver";
import type { IDeepLinker } from "$lib/shared/navigation/services/contracts/IDeepLinker";
import type { ILetterDeriver } from "$lib/shared/navigation/services/contracts/ILetterDeriver";
import type { IPositionDeriver } from "$lib/shared/navigation/services/contracts/IPositionDeriver";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { IBetaDetector } from "$lib/shared/pictograph/prop/services/contracts/IBetaDetector";
import type { ISequenceRepository } from "$lib/features/create/shared/services/contracts/ISequenceRepository";
import type { ISharer } from "$lib/shared/share/services/contracts/ISharer";
import type { IPersistenceService } from "$lib/shared/persistence/services/contracts/IPersistenceService";
import type { IArrowPositioningOrchestrator } from "$lib/shared/pictograph/arrow/positioning/services/contracts/IArrowPositioningOrchestrator";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { IReversalDetector } from "$lib/features/create/shared/services/contracts/IReversalDetector";
import type { IScreenSpaceAdjustmentTransformer } from "$lib/shared/pictograph/arrow/positioning/calculation/services/contracts/IScreenSpaceAdjustmentTransformer";
import type { IArrowAdjustmentCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/contracts/IArrowAdjustmentCalculator";
import type { IArrowLocationCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/contracts/IArrowLocationCalculator";
import type { IPictographPreparer } from "$lib/shared/pictograph/shared/services/contracts/IPictographPreparer";
import type { ITurnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";

/**
 * External dependencies that must be provided when creating the container.
 * These come from other containers (core, data, pictograph, etc.)
 */
export interface BuildContainerDependencies {
  // Device services
  deviceDetector: IDeviceDetector;
  viewportManager: IViewportManager;

  // Grid/Position services
  gridPositionDeriver: IGridPositionDeriver;
  gridModeDeriver: IGridModeDeriver | null;

  // Data services
  motionQueryHandler: IMotionQueryHandler;
  sequenceRepository: ISequenceRepository;
  persistenceService: IPersistenceService;
  reversalDetector: IReversalDetector;

  // Navigation services
  deepLinker: IDeepLinker | null;
  letterDeriver: ILetterDeriver | null;
  positionDeriver: IPositionDeriver | null;

  // Pictograph services
  orientationCalculator: IOrientationCalculator;
  betaDetector: IBetaDetector;
  arrowPositioningOrchestrator: IArrowPositioningOrchestrator;
  letterQueryHandler: ILetterQueryHandler;

  // Arrow adjustment services (for ArrowAdjustmentOrchestrator)
  screenSpaceAdjustmentTransformer: IScreenSpaceAdjustmentTransformer;
  arrowAdjustmentCalculator: IArrowAdjustmentCalculator;
  arrowLocationCalculator: IArrowLocationCalculator;
  pictographPreparer: IPictographPreparer;
  turnsTupleGenerator: ITurnsTupleGenerator;

  // Share service
  sharer: ISharer;
}

/**
 * Singleton instance cache for services that should be shared
 */
let responsiveLayoutManagerInstance: ResponsiveLayoutManager | null = null;
let startPositionManagerInstance: StartPositionManager | null = null;
let letterTransitionGraphInstance: LetterTransitionGraph | null = null;

/**
 * Create the build container with all dependencies
 */
export function createBuildContainer(deps: BuildContainerDependencies) {
  return (
    createContainer()
      // === Layer 1: No-dependency services ===
      .add({
        // Simple services with no DI dependencies
        createModuleOrchestrator: () => new CreateModuleOrchestrator(),
        createModuleEffectCoordinator: () => new CreateModuleEffectCoordinator(),
        navigationSyncer: () => new NavigationSyncer(),
        keyboardArrowAdjuster: () => new KeyboardArrowAdjuster(),
        undoManager: () => new UndoManager(),
        constructCoordinator: () => new ConstructCoordinator(),
        turnController: () => new TurnController(),

        // Option picker - no deps
        filterPersister: () => new FilterPersister(),
        reversalChecker: () => new ReversalChecker(),
        optionOrganizer: () => new OptionOrganizer(),
        optionTransitionCoordinator: () => new OptionTransitionCoordinator(),
        sectionTitleFormatter: () => new SectionTitleFormatter(),
        optionGridFitCalculator: () => new OptionGridFitCalculator(),
        aspectLayoutPlanner: () => new AspectLayoutPlanner(),

        // Generation - no deps
        stepConverter: () => new StepConverter(),
        pictographFilter: () => new PictographFilter(),
        turnManager: () => new TurnManager(),
        typographyScaler: () => new TypographyScaler(),
        cardConfigurator: () => new CardConfigurator(),

        // Sequence - no deps
        sequenceValidator: () => new SequenceValidator(),
        sequenceStatsCalculator: () => new SequenceStatsCalculator(),

        // Panel - no deps
        panelPersister: () => new PanelPersister(),
        subDrawerStatePersister: () => new SubDrawerStatePersister(),
        firstStepAnalyzer: () => new FirstStepAnalyzer(),

        // Pattern - no deps
        rotationDirectionPatternManager: () =>
          new RotationDirectionPatternManager(),
        turnPatternManager: () => new TurnPatternManager(),
        durationPatternManager: () => new DurationPatternManager(),

        // Equivalence detection - no deps
        wordCyclicEquivalenceDetector: () => new WordCyclicEquivalenceDetector(),

        // Generation - no deps (moved from Layer 4)
        loopTypeResolver: () => new LOOPTypeResolver(),
        rotatedEndPositionSelector: () => new RotatedEndPositionSelector(),
        orientationCycleDetector: () => new OrientationCycleDetector(),
      })

      // === Layer 2: Services with external deps only ===
      .add((ctx) => ({
        // Create module layout - needs device services
        createModuleLayoutManager: () =>
          new CreateModuleLayoutManager(deps.deviceDetector, deps.viewportManager),

        // Arrow adjustment orchestrator - needs keyboardArrowAdjuster (Layer 1) + external deps
        arrowAdjustmentOrchestrator: () =>
          new ArrowAdjustmentOrchestrator(
            ctx.keyboardArrowAdjuster,
            deps.screenSpaceAdjustmentTransformer,
            deps.arrowAdjustmentCalculator,
            deps.arrowLocationCalculator,
            deps.pictographPreparer,
            deps.gridModeDeriver!,
            deps.turnsTupleGenerator
          ),

        responsiveLayoutManager: () => {
          if (!responsiveLayoutManagerInstance) {
            responsiveLayoutManagerInstance = new ResponsiveLayoutManager(
              deps.deviceDetector,
              deps.viewportManager
            );
          }
          return responsiveLayoutManagerInstance;
        },

        // Deep link handler - needs navigation services
        deepLinkSequenceHandler: () =>
          new DeepLinkSequenceHandler(
            deps.deepLinker,
            deps.letterDeriver,
            deps.positionDeriver
          ),

        // Step operator - needs grid services
        stepOperator: () =>
          new StepOperator(deps.motionQueryHandler, deps.gridModeDeriver),

        // Option picker - needs grid services
        positionAnalyzer: () => new PositionAnalyzer(deps.gridPositionDeriver),

        // Layout detector - needs device detector
        layoutDetector: () => new LayoutDetector(deps.deviceDetector),

        // Start position manager (singleton)
        startPositionManager: () => {
          if (!startPositionManagerInstance) {
            startPositionManagerInstance = new StartPositionManager(
              deps.gridPositionDeriver
            );
          }
          return startPositionManagerInstance;
        },

        // Sequence analyzer - needs beta detector
        sequenceAnalyzer: () => new SequenceAnalyzer(deps.betaDetector),

        // LOOP executors - basic ones with no internal LOOP deps
        strictRotatedLOOPExecutor: () =>
          new StrictRotatedLOOPExecutor(
            deps.orientationCalculator,
            deps.gridPositionDeriver
          ),
        strictMirroredLOOPExecutor: () =>
          new StrictMirroredLOOPExecutor(deps.orientationCalculator),
        strictSwappedLOOPExecutor: () =>
          new StrictSwappedLOOPExecutor(
            deps.orientationCalculator,
            deps.gridPositionDeriver
          ),
        strictInvertedLOOPExecutor: () =>
          new StrictInvertedLOOPExecutor(deps.orientationCalculator),
        mirroredSwappedLOOPExecutor: () =>
          new MirroredSwappedLOOPExecutor(deps.orientationCalculator),
        swappedInvertedLOOPExecutor: () =>
          new SwappedInvertedLOOPExecutor(deps.orientationCalculator),
        rotatedSwappedLOOPExecutor: () =>
          new RotatedSwappedLOOPExecutor(
            deps.orientationCalculator,
            deps.gridPositionDeriver
          ),
        rewoundLOOPExecutor: () => new RewoundLOOPExecutor(),

        // Spell - letter transition graph (singleton) - no constructor deps
        letterTransitionGraph: () => {
          if (!letterTransitionGraphInstance) {
            letterTransitionGraphInstance = new LetterTransitionGraph();
          }
          return letterTransitionGraphInstance;
        },

        // LOOP executors needing only external deps - moved from Layer 3.5 due to references
        mirroredInvertedLOOPExecutor: () =>
          new MirroredInvertedLOOPExecutor(
            deps.orientationCalculator,
            null as any // loopParameterProvider will be provided later - temp fix
          ),
        rotatedInvertedLOOPExecutor: () =>
          new RotatedInvertedLOOPExecutor(
            deps.orientationCalculator,
            deps.gridPositionDeriver,
            null as any // loopParameterProvider will be provided later - temp fix
          ),
        mirroredSwappedInvertedLOOPExecutor: () =>
          new MirroredSwappedInvertedLOOPExecutor(
            deps.orientationCalculator,
            null as any // loopParameterProvider will be provided later - temp fix
          ),
      }))

      // === Layer 3: Services with Layer 1/2 deps ===
      .add((ctx) => ({
        // Option sorter - needs reversal checker and position analyzer
        optionSorter: () =>
          new OptionSorter(ctx.reversalChecker, ctx.positionAnalyzer),

        // Option filter - needs reversal checker and position analyzer
        optionFilter: () =>
          new OptionFilter(ctx.reversalChecker, ctx.positionAnalyzer),

        // Option loader - needs position analyzer
        optionLoader: () =>
          new OptionLoader(
            deps.gridPositionDeriver,
            deps.motionQueryHandler,
            ctx.positionAnalyzer
          ),

        // LOOP parameter provider - needs pictograph filter
        loopParameterProvider: () =>
          new LOOPParameterProvider(ctx.pictographFilter),

        // Create module handlers - needs orchestrator and beat operator
        createModuleHandlers: () =>
          new CreateModuleHandlers(ctx.createModuleOrchestrator, ctx.stepOperator),
      }))

      // === Layer 3.5: LOOP executors that compose other LOOP executors ===
      .add((ctx) => ({
        // These compose other LOOP executors
        mirroredRotatedLOOPExecutor: () =>
          new MirroredRotatedLOOPExecutor(
            ctx.strictRotatedLOOPExecutor,
            ctx.strictMirroredLOOPExecutor
          ),
        mirroredRotatedInvertedLOOPExecutor: () =>
          new MirroredRotatedInvertedLOOPExecutor(
            ctx.strictRotatedLOOPExecutor,
            ctx.mirroredInvertedLOOPExecutor
          ),
        mirroredRotatedInvertedSwappedLOOPExecutor: () =>
          new MirroredRotatedInvertedSwappedLOOPExecutor(
            ctx.strictRotatedLOOPExecutor,
            ctx.mirroredSwappedInvertedLOOPExecutor
          ),
      }))

      // === Layer 3.6: LOOP executor selector - needs all LOOP executors ===
      .add((ctx) => ({
        loopExecutorSelector: () =>
          new LOOPExecutorSelector(
            ctx.strictRotatedLOOPExecutor,
            ctx.strictMirroredLOOPExecutor,
            ctx.strictSwappedLOOPExecutor,
            ctx.strictInvertedLOOPExecutor,
            ctx.mirroredSwappedLOOPExecutor,
            ctx.swappedInvertedLOOPExecutor,
            ctx.mirroredInvertedLOOPExecutor,
            ctx.rotatedSwappedLOOPExecutor,
            ctx.rotatedInvertedLOOPExecutor,
            ctx.mirroredRotatedLOOPExecutor,
            ctx.mirroredRotatedInvertedLOOPExecutor,
            ctx.mirroredSwappedInvertedLOOPExecutor,
            ctx.mirroredRotatedInvertedSwappedLOOPExecutor,
            ctx.rewoundLOOPExecutor
          ),
      }))

      // === Layer 4: Higher-level services ===
      .add((ctx) => ({
        // Workbench - needs ISequenceRepository and IPersistenceService
        workbench: () =>
          new Workbench(
            deps.sequenceRepository,
            deps.persistenceService
          ),

        // Sequence services that need other sequence services
        sequenceTransformer: () =>
          new SequenceTransformer(
            deps.motionQueryHandler,
            deps.orientationCalculator,
            deps.reversalDetector,
            deps.gridPositionDeriver
          ),
        sequenceExporter: () => new SequenceExporter(),
        sequencePersister: () =>
          new SequencePersister(deps.persistenceService),
        sequenceIndexer: () => new SequenceIndexer(),

        // Sequence extension services - need many dependencies
        loopValidator: () => new LOOPValidator(ctx.loopExecutorSelector),
        orientationAlignmentCalculator: () => new OrientationAlignmentCalculator(),

        // Transfer and export
        sequenceTransferHandler: () => new SequenceTransferHandler(),
        sequenceJsonExporter: () => new SequenceJsonExporter(),

        // Generation services
        sequenceMetadataManager: () => new SequenceMetadataManager(),
        turnAllocator: () => new TurnAllocator(ctx.loopParameterProvider),
        loopEndPositionSelector: () =>
          new LOOPEndPositionSelector(ctx.rotatedEndPositionSelector),
      }))

      // === Layer 4.5: Services needing Layer 4 services ===
      .add((ctx) => ({
        // BridgeFinder needs loopValidator and other services
        bridgeFinder: () =>
          new BridgeFinder(
            deps.letterQueryHandler,
            ctx.positionAnalyzer,
            ctx.loopValidator,
            ctx.sequenceAnalyzer,
            ctx.orientationAlignmentCalculator
          ),

        // SequenceExtender needs many dependencies
        sequenceExtender: () =>
          new SequenceExtender(
            ctx.loopExecutorSelector,
            deps.reversalDetector,
            deps.letterQueryHandler,
            ctx.stepConverter,
            deps.orientationCalculator,
            ctx.loopValidator,
            ctx.sequenceAnalyzer,
            null as any // IBridgeFinder - circular ref, must resolve later
          ),

        // LOOPDetector needs loopabilityChecker and loopTypeResolver
        loopDetector: () =>
          new LOOPDetector(
            null as any, // ISequenceLoopabilityChecker - temp fix
            ctx.loopTypeResolver
          ),

        // StartPositionSelector needs multiple dependencies
        startPositionSelector: () =>
          new StartPositionSelector(
            deps.letterQueryHandler,
            ctx.pictographFilter,
            ctx.stepConverter,
            deps.arrowPositioningOrchestrator
          ),

        // StepGenerationOrchestrator needs multiple dependencies
        stepGenerationOrchestrator: () =>
          new StepGenerationOrchestrator(
            deps.letterQueryHandler,
            ctx.pictographFilter,
            ctx.stepConverter,
            ctx.turnManager,
            deps.orientationCalculator,
            deps.arrowPositioningOrchestrator
          ),

        // PartialSequenceGenerator needs multiple dependencies
        partialSequenceGenerator: () =>
          new PartialSequenceGenerator(
            deps.letterQueryHandler,
            ctx.pictographFilter,
            ctx.stepConverter,
            ctx.turnManager,
            ctx.sequenceMetadataManager,
            deps.gridPositionDeriver,
            deps.orientationCalculator,
            deps.arrowPositioningOrchestrator,
            ctx.loopParameterProvider
          ),

      }))
      // Layer for GenerationOrchestrator (depends on previous layer)
      .add((ctx) => ({
        // GenerationOrchestrator needs multiple dependencies from previous layer
        generationOrchestrator: () =>
          new GenerationOrchestrator(
            ctx.startPositionSelector,
            ctx.loopParameterProvider,
            ctx.turnAllocator,
            ctx.stepGenerationOrchestrator,
            ctx.sequenceMetadataManager,
            deps.reversalDetector,
            ctx.partialSequenceGenerator,
            ctx.loopEndPositionSelector,
            ctx.loopExecutorSelector
          ),

        // Spell services - Layer 4.5a: Validators (no same-layer deps)
        letterTypeClassifier: () => new LetterTypeClassifier(),
        orientationContinuityValidator: () =>
          new OrientationContinuityValidator(),
        startPositionValidator: () =>
          new StartPositionValidator(
            ctx.letterTransitionGraph,
            deps.letterQueryHandler
          ),
        variationConstraintBuilder: () =>
          new VariationConstraintBuilder(ctx.letterTypeClassifier),
        spellServiceLoader: () => new SpellServiceLoader(),
      }))

      // Layer 4.5b: Spell generation services (need validators from Layer 4.5a)
      .add((ctx) => ({
        wordSequenceGenerator: () =>
          new WordSequenceGenerator(
            ctx.letterTransitionGraph,
            deps.letterQueryHandler,
            ctx.stepConverter,
            deps.orientationCalculator,
            ctx.sequenceExtender,
            ctx.startPositionValidator,
            ctx.orientationContinuityValidator
          ),
      }))

      // === Layer 4.6: Services needing Layer 4.5 validators and spellServiceLoader ===
      .add((ctx) => ({
        // Random sequence generator needs validators from Layer 4.5
        randomSequenceGenerator: () =>
          new RandomSequenceGenerator(
            deps.letterQueryHandler,
            ctx.startPositionValidator,
            ctx.orientationContinuityValidator,
            deps.orientationCalculator,
            ctx.sequenceExtender,
            ctx.stepConverter
          ),
        variationExplorationOrchestrator: () =>
          new VariationExplorationOrchestrator(ctx.spellServiceLoader),
        // ExtensionFlowCoordinator needs sequenceExtender
        extensionFlowCoordinator: () =>
          new ExtensionFlowCoordinator(ctx.sequenceExtender),
      }))

      // === Layer 5: Top-level orchestrators ===
      .add((ctx) => ({
        // Create module initializer - needs many services
        createModuleInitializer: () =>
          new CreateModuleInitializer(
            deps.sequenceRepository,
            ctx.sequencePersister,
            ctx.startPositionManager,
            ctx.createModuleOrchestrator,
            ctx.responsiveLayoutManager,
            ctx.navigationSyncer,
            ctx.stepOperator,
            ctx.deepLinkSequenceHandler,
            deps.deepLinker!,
            ctx.createModuleHandlers,
            ctx.createModuleEffectCoordinator,
            deps.sharer,
            ctx.panelPersister,
            ctx.sequenceStatsCalculator,
            ctx.sequenceTransformer,
            ctx.sequenceValidator
          ),
      }))
  );
}

/**
 * Type for the build container
 */
export type BuildContainer = ReturnType<typeof createBuildContainer>;

/**
 * Reset singleton instances (useful for testing)
 */
export function resetBuildContainerSingletons(): void {
  responsiveLayoutManagerInstance = null;
  startPositionManagerInstance = null;
  letterTransitionGraphInstance = null;
}
