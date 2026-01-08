/**
 * Core Service Type Identifiers
 *
 * Fundamental services for sequence management, persistence, and settings.
 */

export const CoreTypes = {
  // Sequence Services
  IWordDeriver: Symbol.for("IWordDeriver"),
  ISequenceRepository: Symbol.for("ISequenceRepository"),
  ISequenceDomainManager: Symbol.for("ISequenceDomainManager"),
  ISequenceAnalyzer: Symbol.for("ISequenceAnalyzer"),
  ISequenceValidator: Symbol.for("ISequenceValidator"),
  ISequenceStatsCalculator: Symbol.for("ISequenceStatsCalculator"),
  ISequenceTransformer: Symbol.for("ISequenceTransformer"),
  ISequenceImportService: Symbol.for("ISequenceImportService"),
  ISequenceImporter: Symbol.for("ISequenceImporter"),
  ISequenceExporter: Symbol.for("ISequenceExporter"),
  ISequenceIndexer: Symbol.for("ISequenceIndexer"),
  ISequencePersister: Symbol.for("ISequencePersister"),

  // Persistence Services
  IPersistenceService: Symbol.for("IPersistenceService"),
  IPersistenceInitializationService: Symbol.for(
    "IPersistenceInitializationService"
  ),

  // Settings Services
  ISettingsState: Symbol.for("ISettingsState"),
  ISettingsPersister: Symbol.for("ISettingsPersister"),

  // Onboarding Services
  IOnboardingPersister: Symbol.for("IOnboardingPersister"),

  // Device & Resource
  IDeviceDetector: Symbol.for("IDeviceDetector"),
  IGeoLocationProvider: Symbol.for("IGeoLocationProvider"),
  IResourceTracker: Symbol.for("IResourceTracker"),
  IPanelManagementService: Symbol.for("IPanelManagementService"),

  // Application
  IApplicationInitializer: Symbol.for("IApplicationInitializer"),
  IComponentManager: Symbol.for("IComponentManager"),
  IDataTransformer: Symbol.for("IDataTransformer"),
  IPictographCoordinator: Symbol.for("IPictographCoordinator"),
  IAnimator: Symbol.for("IAnimator"),
  IHapticFeedback: Symbol.for("IHapticFeedback"),
  IRippleEffect: Symbol.for("IRippleEffect"),

  // State
  IAppState: Symbol.for("IAppState"),
  IAppStateInitializer: Symbol.for("IAppStateInitializer"),
  IApplicationStateService: Symbol.for("IApplicationStateService"),
  IMainTabState: Symbol.for("IMainTabState"),
  IPerformanceMetricsState: Symbol.for("IPerformanceMetricsState"),

  // Dashboard
  IFollowingFeedProvider: Symbol.for("IFollowingFeedProvider"),

  // Library Services
  ITagManager: Symbol.for("ITagManager"),

  // Utility
  IBetaDetector: Symbol.for("IBetaDetector"),
  IErrorHandler: Symbol.for("IErrorHandler"),
  IEnumMapper: Symbol.for("IEnumMapper"),
  ICSVParser: Symbol.for("ICSVParser"),
  ICSVLoader: Symbol.for("ICsvLoader"),
  IValidationService: Symbol.for("IValidationService"),
} as const;
