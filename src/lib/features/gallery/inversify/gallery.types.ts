/**
 * Gallery Module DI Type Symbols
 */

export const GALLERY_TYPES = {
  /** Layout generation */
  IGalleryLayoutGenerator: Symbol.for("IGalleryLayoutGenerator"),

  /** Room geometry generation (walls from room shapes) */
  RoomGeometryGenerator: Symbol.for("RoomGeometryGenerator"),

  /** Collision world building */
  CollisionWorldBuilder: Symbol.for("CollisionWorldBuilder"),

  /** Collision resolution for player movement */
  CollisionResolver: Symbol.for("CollisionResolver"),

  /** Exhibit loading */
  IExhibitLoader: Symbol.for("IExhibitLoader"),

  /** Gallery configuration persistence */
  IGalleryPersister: Symbol.for("IGalleryPersister"),

  // =========================================================================
  // Multiplayer
  // =========================================================================

  /** Session management (create/join/leave sessions) */
  IGallerySessionManager: Symbol.for("IGallerySessionManager"),

  /** Real-time position synchronization */
  IGalleryPositionSyncer: Symbol.for("IGalleryPositionSyncer"),
} as const;
