/**
 * TKA Image Export Core Domain Types
 *
 * Core domain models for the TKA image export system.
 * Contains the main configuration types and fundamental data structures.
 */

import type { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
import type { PropType } from "../../../pictograph/prop/domain/enums/PropType";

// ============================================================================
// EXPORT OPTIONS AND CONFIGURATION
// ============================================================================

export interface SequenceExportOptions {
  // Core export settings (match desktop defaults)
  includeStartPosition: boolean;
  /** "row" = start position as top row, "column" = start position as left column */
  startPositionLayout?: "row" | "column";
  addStepNumbers: boolean;
  addReversalSymbols: boolean;
  /** @deprecated Footer visibility is now derived from individual flags (showCreatorName, showNotes, showBirthday) */
  addUserInfo?: boolean;
  addWord: boolean;
  combinedGrids: boolean;
  addDifficultyLevel: boolean;
  customName?: string; // Optional custom name for header (overrides word when provided)

  // LOOP glyph settings
  loopType?: LOOPType; // LOOP type to display as glyph badge in header
  showLoopGlyph?: boolean; // Whether to show the LOOP glyph (defaults to true if loopType is set)

  // Granular footer controls - footer renders if any of these are true
  showCreatorName?: boolean; // Bottom-left: creator name
  showNotes?: boolean; // Bottom-center: notes text
  showBirthday?: boolean; // Bottom-right: birthday date
  customNotesText?: string; // Custom text for center notes (default: "The Kinetic Alphabet")
  /** Left-side label override (e.g. "QS 1:1" for deck cards) */
  leftLabel?: string;
  /** Pre-loaded elemental icon image to draw in footer before the left label */
  elementIcon?: CanvasImageSource;

  // Prop type override (optional)
  // If provided, overrides the prop type for all steps in the sequence
  // Used for batch re-rendering sequences with different prop types
  propTypeOverride?: PropType;

  // Per-color prop type overrides for cat-dog mode (optional)
  // When provided, overrides props for specific colors independently
  bluePropTypeOverride?: PropType;
  redPropTypeOverride?: PropType;

  // Scaling and sizing
  stepScale: number;
  stepSize: number;
  margin: number;

  // Visibility settings (prop colors)
  redVisible: boolean;
  blueVisible: boolean;

  // Pictograph visibility overrides (optional)
  // When provided, these override the global visibility settings
  // Useful for batch exports with specific visibility requirements
  visibilityOverrides?: {
    showTKA?: boolean;
    showVTG?: boolean;
    showElemental?: boolean;
    showPositions?: boolean;
    showReversals?: boolean;
    showNonRadialPoints?: boolean;
    showTurnNumbers?: boolean;
    /** Dark Mode - dark background, inverted grid, white text/outlines */
    darkMode?: boolean;
    /** Print Mode - pure white background for professional printing (overrides darkMode) */
    printMode?: boolean;
    /** Show/hide grid background */
    showGrid?: boolean;
    /** Hand point visibility: "all" | "active" | "none" */
    handPointVisibility?: "all" | "active" | "none";
    /** Blue prop type override (for cache key consistency) */
    bluePropType?: PropType;
    /** Red prop type override (for cache key consistency) */
    redPropType?: PropType;
    /** Render QR code in empty cell (if available) */
    showQRCode?: boolean;
    /** Render as hand path visualization (HAND props, float arrows, no TKA) */
    handPathMode?: boolean;
  };

  // User information
  userName: string;
  exportDate: string;
  notes: string;
  /** Original creation date of the sequence (for birthday display) */
  birthday?: Date;

  // Layout override
  columnCount?: number | null;  // Override auto-calculated column count (null/undefined = auto)

  // Output format
  format: "PNG" | "JPEG" | "WebP";
  quality: number; // 0-1 for JPEG
  scale: number;
  width?: number;
  height?: number;
  backgroundColor?: string;

  /** Use 5:7 playing card layout (composeCardImage) for physical card export.
   *  Different from printMode (white background). cardMode = card aspect ratio. */
  cardMode?: boolean;

  /** Render at fixed playing card dimensions with consistent header/footer sizing.
   *  contentWidth/contentHeight = the content area inside the bleed (e.g. 750×1050 poker). */
  deckCard?: {
    contentWidth: number;
    contentHeight: number;
  };
}

export interface StepRenderOptions {
  addStepNumbers: boolean;
  redVisible: boolean;
  blueVisible: boolean;
  combinedGrids: boolean;
  stepScale: number;
}

export interface TextRenderOptions {
  margin: number;
  stepScale: number;
  additionalHeightTop?: number;
  additionalHeightBottom?: number;
}

export interface CompositionOptions extends SequenceExportOptions {
  layout: [number, number]; // [columns, rows]
  additionalHeightTop: number;
  additionalHeightBottom: number;
}

export interface UserExportInfo {
  userName: string;
  notes: string;
  exportDate: string;
  birthday?: Date; // Original creation date of the sequence
}

export interface LayoutData {
  columns: number;
  rows: number;
  stepSize: number;
  includeStartPosition: boolean;
  additionalHeightTop: number;
  additionalHeightBottom: number;
}

// ============================================================================
// EXPORT PROGRESS AND RESULTS
// ============================================================================

export interface ExportProgress {
  stage: "validation" | "rendering" | "composition" | "share" | "complete";
  progress: number; // 0-100
  message: string;
  currentStep?: number;
  totalSteps?: number;
}

export interface ExportError extends Error {
  stage: string;
  details?: unknown;
}

export interface MemoryEstimate {
  estimatedMB: number;
  safe: boolean;
}

export interface SequenceExportResult {
  success: boolean;
  blob?: Blob;
  filename: string;
  error?: ExportError;
  metadata: {
    format: string;
    size: number;
    dimensions: { width: number; height: number };
    stepCount: number;
    processingTime: number;
  };
}

// ============================================================================
// RENDERING CONFIGURATION
// ============================================================================

export interface SequenceRenderQualitySettings {
  antialiasing: boolean;
  smoothScaling: boolean;
  highResolution: boolean;
  textQuality: "low" | "medium" | "high";
}

export interface LayoutConstraints {
  maxColumns: number;
  maxRows: number;
  minBeatSize: number;
  maxBeatSize: number;
  aspectRatio?: number;
}

// ============================================================================
// SERVICE INTERFACE SYMBOLS
// ============================================================================

export const ITKAImageExportServiceInterface = Symbol.for(
  "ITKAImageExportService"
);
