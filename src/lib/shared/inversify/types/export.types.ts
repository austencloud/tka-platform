/**
 * Export Service Type Identifiers
 *
 * Services for exporting sequences as images, videos, and other formats.
 */

export const ExportTypes = {
  // Core Export
  IExportService: Symbol.for("IExportService"),
  ISharer: Symbol.for("ISharer"),
  IShareHubExportOrchestrator: Symbol.for("IShareHubExportOrchestrator"),
  IInstagramLinker: Symbol.for("IInstagramLinker"),
  IMediaBundler: Symbol.for("IMediaBundler"),
  IFileExportService: Symbol.for("IFileExportService"),

  // Video Export
  IFirebaseVideoUploader: Symbol.for("IFirebaseVideoUploader"),
  IRecordingPersister: Symbol.for("IRecordingPersister"),
  ICollaborativeVideoManager: Symbol.for("ICollaborativeVideoManager"),
  IVideoExporter: Symbol.for("IVideoExporter"),
  IVideoExportOrchestrator: Symbol.for("IVideoExportOrchestrator"),
  ICompositeVideoRenderer: Symbol.for("ICompositeVideoRenderer"),

  // Image Export
  IPageImageExportService: Symbol.for("IPageImageExportService"),
  IPageFactoryService: Symbol.for("IPageFactoryService"),
  IPrintablePageLayoutService: Symbol.for("IPrintablePageLayoutService"),
  ITKAImageExportService: Symbol.for("ITKAImageExportService"),
  ICanvasManager: Symbol.for("ICanvasManager"),
  IImageComposer: Symbol.for("IImageComposer"),
  ILayoutCalculator: Symbol.for("ILayoutCalculator"),
  IDimensionCalculator: Symbol.for("IDimensionCalculator"),
  IFilenameGenerator: Symbol.for("IFilenameGenerator"),
  IImagePreviewGenerator: Symbol.for("IImagePreviewGenerator"),

  // Word Card Export
  IWordCardExportIntegrationService: Symbol.for(
    "IWordCardExportIntegrationService"
  ),
  IWordCardExportOrchestrator: Symbol.for("IWordCardExportOrchestrator"),
  IWordCardImageGenerator: Symbol.for("IWordCardImageGenerator"),
  IWordCardImageConverter: Symbol.for("IWordCardImageConverter"),
  IWordCardBatchProcessor: Symbol.for("IWordCardBatchProcessor"),
  IWordCardExportProgressTracker: Symbol.for("IWordCardExportProgressTracker"),
  IWordCardCache: Symbol.for("IWordCardCache"),
  IWordCardSVGComposer: Symbol.for("IWordCardSVGComposer"),
  IWordCardMetadataOverlay: Symbol.for("IWordCardMetadataOverlay"),

  // Format Conversion
  IImageFormatConverter: Symbol.for("IImageFormatConverter"),
  ISVGToCanvasConverter: Symbol.for("ISVGToCanvasConverter"),

  // Config
  IExportConfigManager: Symbol.for("IExportConfigManager"),
  IExportOptionsValidator: Symbol.for("IExportOptionsValidator"),
  IExportMemoryCalculator: Symbol.for("IExportMemoryCalculator"),
} as const;
