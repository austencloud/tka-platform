/**
 * Gallery Module DI Type Symbols
 */

export const GALLERY_TYPES = {
  /** Layout generation */
  IGalleryLayoutGenerator: Symbol.for("IGalleryLayoutGenerator"),

  /** Exhibit loading */
  IExhibitLoader: Symbol.for("IExhibitLoader"),

  /** Gallery configuration persistence */
  IGalleryPersister: Symbol.for("IGalleryPersister"),
} as const;
