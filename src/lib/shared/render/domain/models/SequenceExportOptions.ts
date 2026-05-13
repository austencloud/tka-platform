import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import type { PropType } from "../../../pictograph/prop/domain/enums/PropType";

export interface SequenceExportOptions {
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
  customName?: string; 

  loopType?: LOOPType; 
  showLoopGlyph?: boolean; 

  showCreatorName?: boolean; 
  showNotes?: boolean; 
  showBirthday?: boolean; 
  customNotesText?: string; 
  /** Left-side label override (e.g. "QS 1:1" for deck cards) */
  leftLabel?: string;

  propTypeOverride?: PropType;

  bluePropTypeOverride?: PropType;
  redPropTypeOverride?: PropType;

  stepScale: number;
  stepSize: number;
  margin: number;

  redVisible: boolean;
  blueVisible: boolean;

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
    /** Render LOOP mandalas in empty cells */
    showMandala?: boolean;
  };

  userName: string;
  exportDate: string;
  notes: string;
  /** Original creation date of the sequence (for birthday display) */
  birthday?: Date;

  columnCount?: number | null;  

  format: "PNG" | "JPEG" | "WebP";
  quality: number; 
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
  birthday?: Date; 
}

export interface LayoutData {
  columns: number;
  rows: number;
  stepSize: number;
  includeStartPosition: boolean;
  additionalHeightTop: number;
  additionalHeightBottom: number;
}

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

export const ITKAImageExportServiceInterface = Symbol.for(
  "ITKAImageExportService"
);
