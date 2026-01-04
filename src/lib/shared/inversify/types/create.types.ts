/**
 * Create Module Service Type Identifiers
 *
 * Services for sequence creation, option picking, and workbench functionality.
 */

export const CreateTypes = {
  // Create Module Core
  ICreateModuleOrchestrator: Symbol.for("ICreateModuleOrchestrator"),
  ICreateModuleHandlers: Symbol.for("ICreateModuleHandlers"),
  ICreateModuleInitializer: Symbol.for("ICreateModuleInitializer"),
  ICreateModuleEffectCoordinator: Symbol.for("ICreateModuleEffectCoordinator"),
  IDeepLinkSequenceHandler: Symbol.for("IDeepLinkSequenceHandler"),
  ICreateModuleLayoutManager: Symbol.for("ICreateModuleLayoutManager"),
  IResponsiveLayoutManager: Symbol.for("IResponsiveLayoutManager"),
  INavigationSyncer: Symbol.for("INavigationSyncer"),
  IBeatOperator: Symbol.for("IBeatOperator"),
  IKeyboardArrowAdjuster: Symbol.for("IKeyboardArrowAdjuster"),
  IUndoManager: Symbol.for("IUndoManager"),
  ITurnController: Symbol.for("ITurnController"),

  // Write Tab
  IActManager: Symbol.for("IActManager"),
  IMusicPlayer: Symbol.for("IMusicPlayer"),

  // Option Picker
  IOptionPickerFilterPersister: Symbol.for("IOptionPickerFilterPersister"),
  IReversalChecker: Symbol.for("IReversalChecker"),
  IPositionAnalyzer: Symbol.for("IPositionAnalyzer"),
  IOptionSorter: Symbol.for("IOptionSorter"),
  IOptionFilter: Symbol.for("IOptionFilter"),
  IOptionOrganizerService: Symbol.for("IOptionOrganizerService"),
  IOptionLoader: Symbol.for("IOptionLoader"),
  ILayoutDetector: Symbol.for("ILayoutDetector"),
  IOptionTransitionCoordinator: Symbol.for("IOptionTransitionCoordinator"),
  ISectionTitleFormatter: Symbol.for("ISectionTitleFormatter"),
  IPictographPreparer: Symbol.for("IPictographPreparer"),
  IGridFitCalculator: Symbol.for("IGridFitCalculator"),
  IAspectLayoutPlanner: Symbol.for("IAspectLayoutPlanner"),

  // Workbench
  IWorkbench: Symbol.for("IWorkbench"),
  IBuildConstructTabCoordinator: Symbol.for("IBuildConstructTabCoordinator"),
  IStartPositionManager: Symbol.for("IStartPositionManager"),

  // Sequence Extension
  ISequenceExtender: Symbol.for("ISequenceExtender"),
  ILOOPValidator: Symbol.for("ILOOPValidator"),
  IOrientationAlignmentCalculator: Symbol.for(
    "IOrientationAlignmentCalculator"
  ),
  IBridgeFinder: Symbol.for("IBridgeFinder"),

  // Panel Management
  IPanelPersister: Symbol.for("IPanelPersister"),
  ISubDrawerStatePersister: Symbol.for("ISubDrawerStatePersister"),
  ISequenceTransferHandler: Symbol.for("ISequenceTransferHandler"),
  IFirstBeatAnalyzer: Symbol.for("IFirstBeatAnalyzer"),
  ISequenceJsonExporter: Symbol.for("ISequenceJsonExporter"),

  // Pattern Management
  IRotationDirectionPatternManager: Symbol.for(
    "IRotationDirectionPatternManager"
  ),
  ITurnPatternManager: Symbol.for("ITurnPatternManager"),

  // Spell Tab (Word-to-Sequence)
  ILetterTransitionGraph: Symbol.for("ILetterTransitionGraph"),
  IWordSequenceGenerator: Symbol.for("IWordSequenceGenerator"),
  IVariationExplorer: Symbol.for("IVariationExplorer"),
  IVariationDeduplicator: Symbol.for("IVariationDeduplicator"),
  IVariationScorer: Symbol.for("IVariationScorer"),
  ISpellServiceLoader: Symbol.for("ISpellServiceLoader"),
  ISpellGenerationOrchestrator: Symbol.for("ISpellGenerationOrchestrator"),
  IVariationExplorationOrchestrator: Symbol.for(
    "IVariationExplorationOrchestrator"
  ),
  ILOOPSelectionCoordinator: Symbol.for("ILOOPSelectionCoordinator"),
} as const;
