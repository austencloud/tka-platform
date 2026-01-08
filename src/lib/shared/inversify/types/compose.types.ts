/**
 * Compose Module DI Type Symbols
 *
 * Type symbols for timeline and compose feature services.
 */

export const ComposeTypes = {
  // Timeline Services
  ITimelinePlayer: Symbol.for("ITimelinePlayer"),
  ITimelineSnapper: Symbol.for("ITimelineSnapper"),
  ITimelineUndoManager: Symbol.for("ITimelineUndoManager"),
} as const;
