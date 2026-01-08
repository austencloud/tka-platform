import { ContainerModule, type ContainerModuleLoadOptions } from "inversify";
import { createHMRSafeBinder } from "../hmr/safeBind";
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
import { ExtensionFlowCoordinator } from "../../../features/create/shared/services/implementations/ExtensionFlowCoordinator";
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
    // Use HMR-safe binder to prevent duplicate bindings during hot reload
    const bind = createHMRSafeBinder(options);

    // === Create Module ServiceS ===
    bind(TYPES.ICreateModuleOrchestrator).to(CreateModuleOrchestrator);
    bind(TYPES.ICreateModuleHandlers).to(CreateModuleHandlers);
    bind(TYPES.ICreateModuleLayoutManager).to(CreateModuleLayoutManager);
    bind(TYPES.ICreateModuleInitializer).to(CreateModuleInitializer);
    bind(TYPES.ICreateModuleEffectCoordinator).to(CreateModuleEffectCoordinator);
    bind(TYPES.IDeepLinkSequenceHandler).to(DeepLinkSequenceHandler);
    bind(TYPES.IResponsiveLayoutManager)
      .to(ResponsiveLayoutManager)
      .inSingletonScope();
    bind(TYPES.INavigationSyncer).to(NavigationSyncer);
    bind(TYPES.IBeatOperator).to(BeatOperator);
    bind(TYPES.IKeyboardArrowAdjuster).to(KeyboardArrowAdjuster);
    bind(TYPES.IUndoManager).to(UndoManager);
    bind(TYPES.IBuildConstructTabCoordinator).to(ConstructCoordinator);
    bind(TYPES.ITurnController).to(TurnController);

    // === OPTION PICKER SERVICES ===
    bind(TYPES.IOptionPickerFilterPersister).to(FilterPersister);
    bind(TYPES.IReversalChecker).to(ReversalChecker);
    bind(TYPES.IPositionAnalyzer).to(PositionAnalyzer);
    bind(TYPES.IOptionSorter).to(OptionSorter);
    bind(TYPES.IOptionFilter).to(OptionFilter);
    bind(TYPES.IOptionOrganizerService).to(OptionOrganizer);
    bind(TYPES.IOptionLoader).to(OptionLoader);
    bind(TYPES.ILayoutDetector).to(LayoutDetector);
    bind(TYPES.IOptionTransitionCoordinator).to(OptionTransitionCoordinator);
    bind(TYPES.ISectionTitleFormatter).to(SectionTitleFormatter);
    bind(TYPES.IGridFitCalculator).to(OptionGridFitCalculator);
    bind(TYPES.IAspectLayoutPlanner).to(AspectLayoutPlanner);

    // === START POSITION SERVICES ===
    bind(TYPES.IStartPositionManager).to(StartPositionManager).inSingletonScope();

    // === GENERATION SERVICES === (restored active services 2025-10-25)
    bind(TYPES.IBeatConverter).to(BeatConverter);
    bind(TYPES.IPictographFilter).to(PictographFilter);
    bind(TYPES.ITurnManager).to(TurnManager);

    // NEW: Consolidated LOOP Parameter Provider (consolidates 4 services)
    bind(TYPES.ILOOPParameterProvider).to(LOOPParameterProvider);

    bind(TYPES.ISequenceMetadataManager).to(SequenceMetadataManager);

    // New Focused Generation Services (composable, single-responsibility)
    bind(TYPES.IStartPositionSelector).to(StartPositionSelector);
    bind(TYPES.ITurnAllocationCalculator).to(TurnAllocator);
    bind(TYPES.IBeatGenerationOrchestrator).to(BeatGenerationOrchestrator);
    bind(TYPES.IPartialSequenceGenerator).to(PartialSequenceGenerator);

    // Circular Generation (LOOP) Services
    bind(TYPES.IRotatedEndPositionSelector).to(RotatedEndPositionSelector);
    bind(TYPES.ILOOPEndPositionSelector).to(LOOPEndPositionSelector);
    bind(TYPES.IStrictRotatedLOOPExecutor).to(StrictRotatedLOOPExecutor);
    bind(TYPES.IStrictMirroredLOOPExecutor).to(StrictMirroredLOOPExecutor);
    bind(TYPES.IStrictSwappedLOOPExecutor).to(StrictSwappedLOOPExecutor);
    bind(TYPES.IStrictInvertedLOOPExecutor).to(StrictInvertedLOOPExecutor);
    bind(TYPES.IMirroredSwappedLOOPExecutor).to(MirroredSwappedLOOPExecutor);
    bind(TYPES.ISwappedInvertedLOOPExecutor).to(SwappedInvertedLOOPExecutor);
    bind(TYPES.IMirroredInvertedLOOPExecutor).to(MirroredInvertedLOOPExecutor);
    bind(TYPES.IRotatedSwappedLOOPExecutor).to(RotatedSwappedLOOPExecutor);
    bind(TYPES.IRotatedInvertedLOOPExecutor).to(RotatedInvertedLOOPExecutor);
    bind(TYPES.IMirroredRotatedLOOPExecutor).to(MirroredRotatedLOOPExecutor);
    bind(TYPES.IMirroredRotatedInvertedLOOPExecutor).to(MirroredRotatedInvertedLOOPExecutor);
    bind(TYPES.IMirroredSwappedInvertedLOOPExecutor).to(MirroredSwappedInvertedLOOPExecutor);
    bind(TYPES.IMirroredRotatedInvertedSwappedLOOPExecutor).to(MirroredRotatedInvertedSwappedLOOPExecutor);
    bind(TYPES.ILOOPExecutorSelector).to(LOOPExecutorSelector);
    bind(TYPES.IRewoundLOOPExecutor).to(RewoundLOOPExecutor);

    // Generation UI Services (SRP Refactoring - Dec 2024)
    bind(TYPES.IResponsiveTypographer).to(TypographyScaler);
    bind(TYPES.ICardConfigurator).to(CardConfigurator);
    bind(TYPES.ILOOPTypeResolver).to(LOOPTypeResolver);
    bind(TYPES.ILOOPDetector).to(LOOPDetector);
    bind(TYPES.IOrientationCycleDetector).to(OrientationCycleDetector);

    // Generation Orchestration Services (SRP Refactoring - Dec 2024)
    bind(TYPES.IGenerationOrchestrator).to(GenerationOrchestrator);

    // === BEAT GRID SERVICES ===
    // Note: BeatFallbackRenderer moved to render module

    // === WORKBENCH SERVICES ===
    bind(TYPES.IWorkbench).to(Workbench);

    // === SEQUENCE SERVICES ===
    // NOTE: IReversalDetector, ISequenceDomainManager, ISequenceImporter
    // moved to dataModule (Tier 1) - required by ISequenceRepository
    bind(TYPES.ISequenceAnalyzer).to(SequenceAnalyzer);

    // Focused sequence services (refactored from monolithic SequenceStateService)
    bind(TYPES.ISequenceValidator).to(SequenceValidator);
    bind(TYPES.ISequenceStatsCalculator).to(SequenceStatsCalculator);
    bind(TYPES.ISequenceTransformer).to(SequenceTransformer);

    bind(TYPES.ISequenceExporter).to(SequenceExporter);
    // NOTE: ISequenceRepository, ISequenceImporter moved to dataModule (Tier 1)
    bind(TYPES.ISequencePersister).to(SequencePersister);
    bind(TYPES.ISequenceIndexer).to(SequenceIndexer);

    // === SEQUENCE EXTENSION SERVICES ===
    bind(TYPES.ISequenceExtender).to(SequenceExtender);
    bind(TYPES.ILOOPValidator).to(LOOPValidator);
    bind(TYPES.IOrientationAlignmentCalculator).to(OrientationAlignmentCalculator);
    bind(TYPES.IBridgeFinder).to(BridgeFinder);

    // === PANEL MANAGEMENT ===
    bind(TYPES.IPanelPersister).to(PanelPersister);
    bind(TYPES.ISubDrawerStatePersister).to(SubDrawerStatePersister);
    bind(TYPES.ISequenceTransferHandler).to(SequenceTransferHandler);
    bind(TYPES.IFirstBeatAnalyzer).to(FirstBeatAnalyzer);
    bind(TYPES.ISequenceJsonExporter).to(SequenceJsonExporter);
    bind(TYPES.IExtensionFlowCoordinator).to(ExtensionFlowCoordinator);

    // === PATTERN MANAGEMENT ===
    bind(TYPES.IRotationDirectionPatternManager).to(RotationDirectionPatternManager);
    bind(TYPES.ITurnPatternManager).to(TurnPatternManager);

    // === SPELL TAB SERVICES === (Word-to-Sequence)
    bind(TYPES.ILetterTransitionGraph).to(LetterTransitionGraph).inSingletonScope();
    bind(TYPES.IWordSequenceGenerator).to(WordSequenceGenerator);
    bind(TYPES.IVariationExplorer).to(VariationExplorer);
    bind(TYPES.IVariationDeduplicator).to(VariationDeduplicator);
    bind(TYPES.IVariationScorer).to(VariationScorer);
    bind(TYPES.ISpellServiceLoader).to(SpellServiceLoader);
    bind(TYPES.ISpellGenerationOrchestrator).to(SpellGenerationOrchestrator);
    bind(TYPES.IVariationExplorationOrchestrator).to(VariationExplorationOrchestrator);
    bind(TYPES.ILOOPSelectionCoordinator).to(LOOPSelectionCoordinator);

    // === LAYOUT SERVICES ===
    // Note: PrintablePageLayoutService handled in word-card module
  }
);
