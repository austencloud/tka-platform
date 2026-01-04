import { ContainerModule, type ContainerModuleLoadOptions } from "inversify";
import { CreateModuleOrchestrator } from "../../../features/create/shared/services/implementations/CreateModuleOrchestrator";
import { ConstructCoordinator } from "../../../features/create/shared/services/implementations/ConstructCoordinator";
import { SequenceIndexer } from "../../../features/create/shared/services/implementations/SequenceIndexer";
import { SequencePersister } from "../../../features/create/shared/services/implementations/SequencePersister";
import { Workbench } from "../../../features/create/shared/workspace-panel/shared/services/implementations/Workbench";
import { SequenceExporter } from "../../../features/create/shared/services/implementations/SequenceExporter";
import { SequenceAnalyzer } from "../../../features/create/shared/services/implementations/SequenceAnalyzer";
import { CreateModuleHandlers } from "../../../features/create/shared/services/implementations/CreateModuleHandlers";
import { CreateModuleLayoutManager } from "../../../features/create/shared/layout/services/CreateModuleLayoutManager";
import { SequenceStatsCalculator } from "../../../features/create/shared/services/implementations/SequenceStatsCalculator";
import { SequenceTransformer } from "../../../features/create/shared/services/implementations/sequence-transforms/SequenceTransformer";
import { SequenceValidator } from "../../../features/create/shared/services/implementations/SequenceValidator";
import { UndoManager } from "../../../features/create/shared/services/implementations/UndoManager";
import { BeatOperator } from "../../../features/create/shared/services/implementations/BeatOperator";
import { PropClickHandler } from "../../../features/create/shared/services/implementations/PropClickHandler";
import { ChiralityToggler } from "../../../features/create/shared/services/implementations/ChiralityToggler";
import { KeyboardArrowAdjuster } from "../../../features/create/shared/services/implementations/KeyboardArrowAdjuster";
import { CreateModuleInitializer } from "../../../features/create/shared/services/implementations/CreateModuleInitializer";
import { NavigationSyncer } from "../../../features/create/shared/services/implementations/NavigationSyncer";
import { ResponsiveLayoutManager } from "../../../features/create/shared/services/implementations/ResponsiveLayoutManager";
import { CreateModuleEffectCoordinator } from "../../../features/create/shared/services/implementations/CreateModuleEffectCoordinator";
import { DeepLinkSequenceHandler } from "../../../features/create/shared/services/implementations/DeepLinkSequenceHandler";

import { AspectLayoutPlanner } from "../../../features/create/construct/option-picker/services/implementations/AspectLayoutPlanner";
import { FilterPersister } from "../../../features/create/construct/option-picker/services/FilterPersister";
import { OptionGridFitCalculator } from "../../../features/create/construct/option-picker/services/implementations/OptionGridFitCalculator.ts";
import { LayoutDetector } from "../../../features/create/construct/option-picker/services/implementations/LayoutDetector";
import { TurnController } from "../../../features/create/edit/services/TurnController";

import { TYPES } from "../types";
import { ReversalChecker } from "../../../features/create/construct/option-picker/services/implementations/ReversalChecker";
import { StartPositionManager } from "../../../features/create/construct/start-position-picker/services/implementations/StartPositionManager";
import { LOOPEndPositionSelector } from "../../../features/create/generate/circular/services/implementations/LOOPEndPositionSelector";
import { LOOPExecutorSelector } from "../../../features/create/generate/circular/services/implementations/LOOPExecutorSelector";
import { MirroredInvertedLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/MirroredInvertedLOOPExecutor";
import { MirroredRotatedLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/MirroredRotatedLOOPExecutor";
import { MirroredRotatedInvertedLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/MirroredRotatedInvertedLOOPExecutor";
import { MirroredRotatedInvertedSwappedLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/MirroredRotatedInvertedSwappedLOOPExecutor";
import { MirroredSwappedLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/MirroredSwappedLOOPExecutor";
import { MirroredSwappedInvertedLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/MirroredSwappedInvertedLOOPExecutor";
import { PartialSequenceGenerator } from "../../../features/create/generate/circular/services/implementations/PartialSequenceGenerator";
import { RotatedEndPositionSelector } from "../../../features/create/generate/circular/services/implementations/RotatedEndPositionSelector";
import { RotatedInvertedLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/RotatedInvertedLOOPExecutor";
import { RotatedSwappedLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/RotatedSwappedLOOPExecutor";
import { StrictInvertedLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/StrictInvertedLOOPExecutor";
import { StrictMirroredLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/StrictMirroredLOOPExecutor";
import { StrictRotatedLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/StrictRotatedLOOPExecutor";
import { StrictSwappedLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/StrictSwappedLOOPExecutor";
import { SwappedInvertedLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/SwappedInvertedLOOPExecutor";
import { RewoundLOOPExecutor } from "../../../features/create/generate/circular/services/implementations/RewoundLOOPExecutor";
import { BeatConverter } from "../../../features/create/generate/shared/services/implementations/BeatConverter";
import { BeatGenerationOrchestrator } from "../../../features/create/generate/shared/services/implementations/BeatGenerationOrchestrator";
import { LOOPParameterProvider } from "../../../features/create/generate/shared/services/implementations/LOOPParameterProvider";
import { LOOPTypeResolver } from "../../../features/create/generate/shared/services/implementations/LOOPTypeResolver";
import { LOOPDetector } from "../../../features/create/generate/circular/services/implementations/LOOPDetector";
import { OrientationCycleDetector } from "../../../features/create/generate/circular/services/implementations/OrientationCycleDetector";
import { CardConfigurator } from "../../../features/create/generate/shared/services/implementations/CardConfigurator";
import { GenerationOrchestrator } from "../../../features/create/generate/shared/services/implementations/GenerationOrchestrator";
import { PictographFilter } from "../../../features/create/generate/shared/services/implementations/PictographFilter";
import { TypographyScaler } from "../../../features/create/generate/shared/services/implementations/TypographyScaler";
import { SequenceMetadataManager } from "../../../features/create/generate/shared/services/implementations/SequenceMetadataManager";
import { StartPositionSelector } from "../../../features/create/generate/shared/services/implementations/StartPositionSelector";
import { TurnManager } from "../../../features/create/generate/shared/services/implementations/TurnManager";
import { TurnAllocator } from "../../../features/create/generate/shared/services/implementations/TurnAllocator";
import { OptionFilter } from "../../../features/create/construct/option-picker/services/implementations/OptionFilter";
import { PositionAnalyzer } from "../../../features/create/construct/option-picker/services/implementations/PositionAnalyzer";
import { OptionSorter } from "../../../features/create/construct/option-picker/services/implementations/OptionSorter";
import { OptionOrganizer } from "../../../features/create/construct/option-picker/services/implementations/OptionOrganizer";
import { OptionLoader } from "../../../features/create/construct/option-picker/services/implementations/OptionLoader";
import { OptionTransitionCoordinator } from "../../../features/create/construct/option-picker/services/implementations/OptionTransitionCoordinator";
import { SectionTitleFormatter } from "../../../features/create/construct/option-picker/services/implementations/SectionTitleFormatter";
import { SequenceExtender } from "../../../features/create/shared/services/implementations/SequenceExtender";
import { LOOPValidator } from "../../../features/create/shared/services/implementations/LOOPValidator";
import { OrientationAlignmentCalculator } from "../../../features/create/shared/services/implementations/OrientationAlignmentCalculator";
import { BridgeFinder } from "../../../features/create/shared/services/implementations/BridgeFinder";
import { PanelPersister } from "../../../features/create/shared/services/implementations/PanelPersister.svelte.ts";
import { SubDrawerStatePersister } from "../../../features/create/shared/services/implementations/SubDrawerStatePersister";
import { SequenceTransferHandler } from "../../../features/create/shared/services/implementations/SequenceTransferHandler";
import { FirstBeatAnalyzer } from "../../../features/create/shared/services/implementations/FirstBeatAnalyzer";
import { SequenceJsonExporter } from "../../../features/create/shared/services/implementations/SequenceJsonExporter";
import { LetterTransitionGraph } from "../../../features/create/spell/services/implementations/LetterTransitionGraph";
import { WordSequenceGenerator } from "../../../features/create/spell/services/implementations/WordSequenceGenerator";
import { VariationExplorer } from "../../../features/create/spell/services/implementations/VariationExplorer";
import { VariationDeduplicator } from "../../../features/create/spell/services/implementations/VariationDeduplicator";
import { VariationScorer } from "../../../features/create/spell/services/implementations/VariationScorer";
import { SpellServiceLoader } from "../../../features/create/spell/services/implementations/SpellServiceLoader";
import { SpellGenerationOrchestrator } from "../../../features/create/spell/services/implementations/SpellGenerationOrchestrator";
import { VariationExplorationOrchestrator } from "../../../features/create/spell/services/implementations/VariationExplorationOrchestrator";
import { LOOPSelectionCoordinator } from "../../../features/create/spell/services/implementations/LOOPSelectionCoordinator";
import { RotationDirectionPatternManager } from "../../../features/create/shared/services/implementations/RotationDirectionPatternManager";
import { TurnPatternManager } from "../../../features/create/shared/services/implementations/TurnPatternManager";

export const createModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    // === Create Module ServiceS ===
    options.bind(TYPES.ICreateModuleOrchestrator).to(CreateModuleOrchestrator);
    options.bind(TYPES.ICreateModuleHandlers).to(CreateModuleHandlers);
    options
      .bind(TYPES.ICreateModuleLayoutManager)
      .to(CreateModuleLayoutManager);
    options.bind(TYPES.ICreateModuleInitializer).to(CreateModuleInitializer);
    options
      .bind(TYPES.ICreateModuleEffectCoordinator)
      .to(CreateModuleEffectCoordinator);
    options.bind(TYPES.IDeepLinkSequenceHandler).to(DeepLinkSequenceHandler);
    options
      .bind(TYPES.IResponsiveLayoutManager)
      .to(ResponsiveLayoutManager)
      .inSingletonScope();
    options.bind(TYPES.INavigationSyncer).to(NavigationSyncer);
    options.bind(TYPES.IBeatOperator).to(BeatOperator);
    options.bind(TYPES.IKeyboardArrowAdjuster).to(KeyboardArrowAdjuster);
    options.bind(TYPES.IUndoManager).to(UndoManager);
    options.bind(TYPES.IBuildConstructTabCoordinator).to(ConstructCoordinator);
    options.bind(TYPES.ITurnController).to(TurnController);
    options.bind(TYPES.IPropClickHandler).to(PropClickHandler);
    options.bind(TYPES.IChiralityToggler).to(ChiralityToggler);

    // === OPTION PICKER SERVICES ===
    options.bind(TYPES.IOptionPickerFilterPersister).to(FilterPersister);
    options.bind(TYPES.IReversalChecker).to(ReversalChecker);
    options.bind(TYPES.IPositionAnalyzer).to(PositionAnalyzer);
    options.bind(TYPES.IOptionSorter).to(OptionSorter);
    options.bind(TYPES.IOptionFilter).to(OptionFilter);
    options.bind(TYPES.IOptionOrganizerService).to(OptionOrganizer);
    options.bind(TYPES.IOptionLoader).to(OptionLoader);
    options.bind(TYPES.ILayoutDetector).to(LayoutDetector);
    options
      .bind(TYPES.IOptionTransitionCoordinator)
      .to(OptionTransitionCoordinator);
    options.bind(TYPES.ISectionTitleFormatter).to(SectionTitleFormatter);
    options.bind(TYPES.IGridFitCalculator).to(OptionGridFitCalculator);
    options.bind(TYPES.IAspectLayoutPlanner).to(AspectLayoutPlanner);

    // === START POSITION SERVICES ===
    options
      .bind(TYPES.IStartPositionManager)
      .to(StartPositionManager)
      .inSingletonScope();

    // === GENERATION SERVICES === (restored active services 2025-10-25)
    options.bind(TYPES.IBeatConverter).to(BeatConverter);
    options.bind(TYPES.IPictographFilter).to(PictographFilter);
    options.bind(TYPES.ITurnManager).to(TurnManager);

    // NEW: Consolidated LOOP Parameter Provider (consolidates 4 services)
    options.bind(TYPES.ILOOPParameterProvider).to(LOOPParameterProvider);

    options.bind(TYPES.ISequenceMetadataManager).to(SequenceMetadataManager);

    // New Focused Generation Services (composable, single-responsibility)
    options.bind(TYPES.IStartPositionSelector).to(StartPositionSelector);
    options.bind(TYPES.ITurnAllocationCalculator).to(TurnAllocator);
    options
      .bind(TYPES.IBeatGenerationOrchestrator)
      .to(BeatGenerationOrchestrator);
    options.bind(TYPES.IPartialSequenceGenerator).to(PartialSequenceGenerator);

    // Circular Generation (LOOP) Services
    options
      .bind(TYPES.IRotatedEndPositionSelector)
      .to(RotatedEndPositionSelector);
    options.bind(TYPES.ILOOPEndPositionSelector).to(LOOPEndPositionSelector);
    options
      .bind(TYPES.IStrictRotatedLOOPExecutor)
      .to(StrictRotatedLOOPExecutor);
    options
      .bind(TYPES.IStrictMirroredLOOPExecutor)
      .to(StrictMirroredLOOPExecutor);
    options
      .bind(TYPES.IStrictSwappedLOOPExecutor)
      .to(StrictSwappedLOOPExecutor);
    options
      .bind(TYPES.IStrictInvertedLOOPExecutor)
      .to(StrictInvertedLOOPExecutor);
    options
      .bind(TYPES.IMirroredSwappedLOOPExecutor)
      .to(MirroredSwappedLOOPExecutor);
    options
      .bind(TYPES.ISwappedInvertedLOOPExecutor)
      .to(SwappedInvertedLOOPExecutor);
    options
      .bind(TYPES.IMirroredInvertedLOOPExecutor)
      .to(MirroredInvertedLOOPExecutor);
    options
      .bind(TYPES.IRotatedSwappedLOOPExecutor)
      .to(RotatedSwappedLOOPExecutor);
    options
      .bind(TYPES.IRotatedInvertedLOOPExecutor)
      .to(RotatedInvertedLOOPExecutor);
    options
      .bind(TYPES.IMirroredRotatedLOOPExecutor)
      .to(MirroredRotatedLOOPExecutor);
    options
      .bind(TYPES.IMirroredRotatedInvertedLOOPExecutor)
      .to(MirroredRotatedInvertedLOOPExecutor);
    options
      .bind(TYPES.IMirroredSwappedInvertedLOOPExecutor)
      .to(MirroredSwappedInvertedLOOPExecutor);
    options
      .bind(TYPES.IMirroredRotatedInvertedSwappedLOOPExecutor)
      .to(MirroredRotatedInvertedSwappedLOOPExecutor);
    options.bind(TYPES.ILOOPExecutorSelector).to(LOOPExecutorSelector);
    options.bind(TYPES.IRewoundLOOPExecutor).to(RewoundLOOPExecutor);

    // Generation UI Services (SRP Refactoring - Dec 2024)
    options.bind(TYPES.IResponsiveTypographer).to(TypographyScaler);
    options.bind(TYPES.ICardConfigurator).to(CardConfigurator);
    options.bind(TYPES.ILOOPTypeResolver).to(LOOPTypeResolver);
    options.bind(TYPES.ILOOPDetector).to(LOOPDetector);
    options.bind(TYPES.IOrientationCycleDetector).to(OrientationCycleDetector);

    // Generation Orchestration Services (SRP Refactoring - Dec 2024)
    options.bind(TYPES.IGenerationOrchestrator).to(GenerationOrchestrator);

    // === BEAT GRID SERVICES ===
    // Note: BeatFallbackRenderer moved to render module

    // === WORKBENCH SERVICES ===
    options.bind(TYPES.IWorkbench).to(Workbench);

    // === SEQUENCE SERVICES ===
    // NOTE: IReversalDetector, ISequenceDomainManager, ISequenceImporter
    // moved to dataModule (Tier 1) - required by ISequenceRepository
    options.bind(TYPES.ISequenceAnalyzer).to(SequenceAnalyzer);

    // Focused sequence services (refactored from monolithic SequenceStateService)
    options.bind(TYPES.ISequenceValidator).to(SequenceValidator);
    options.bind(TYPES.ISequenceStatsCalculator).to(SequenceStatsCalculator);
    options.bind(TYPES.ISequenceTransformer).to(SequenceTransformer);

    options.bind(TYPES.ISequenceExporter).to(SequenceExporter);
    // NOTE: ISequenceRepository, ISequenceImporter moved to dataModule (Tier 1)
    options.bind(TYPES.ISequencePersister).to(SequencePersister);
    options.bind(TYPES.ISequenceIndexer).to(SequenceIndexer);

    // === SEQUENCE EXTENSION SERVICES ===
    options.bind(TYPES.ISequenceExtender).to(SequenceExtender);
    options.bind(TYPES.ILOOPValidator).to(LOOPValidator);
    options
      .bind(TYPES.IOrientationAlignmentCalculator)
      .to(OrientationAlignmentCalculator);
    options.bind(TYPES.IBridgeFinder).to(BridgeFinder);

    // === PANEL MANAGEMENT ===
    options.bind(TYPES.IPanelPersister).to(PanelPersister);
    options.bind(TYPES.ISubDrawerStatePersister).to(SubDrawerStatePersister);
    options.bind(TYPES.ISequenceTransferHandler).to(SequenceTransferHandler);
    options.bind(TYPES.IFirstBeatAnalyzer).to(FirstBeatAnalyzer);
    options.bind(TYPES.ISequenceJsonExporter).to(SequenceJsonExporter);

    // === PATTERN MANAGEMENT ===
    options
      .bind(TYPES.IRotationDirectionPatternManager)
      .to(RotationDirectionPatternManager);
    options.bind(TYPES.ITurnPatternManager).to(TurnPatternManager);

    // === SPELL TAB SERVICES === (Word-to-Sequence)
    options
      .bind(TYPES.ILetterTransitionGraph)
      .to(LetterTransitionGraph)
      .inSingletonScope();
    options.bind(TYPES.IWordSequenceGenerator).to(WordSequenceGenerator);
    options.bind(TYPES.IVariationExplorer).to(VariationExplorer);
    options.bind(TYPES.IVariationDeduplicator).to(VariationDeduplicator);
    options.bind(TYPES.IVariationScorer).to(VariationScorer);
    options.bind(TYPES.ISpellServiceLoader).to(SpellServiceLoader);
    options
      .bind(TYPES.ISpellGenerationOrchestrator)
      .to(SpellGenerationOrchestrator);
    options
      .bind(TYPES.IVariationExplorationOrchestrator)
      .to(VariationExplorationOrchestrator);
    options.bind(TYPES.ILOOPSelectionCoordinator).to(LOOPSelectionCoordinator);

    // === LAYOUT SERVICES ===
    // Note: PrintablePageLayoutService handled in word-card module
  }
);
