/**
 * Database models for Train module persistence
 * These interfaces define the shape of data stored in IndexedDB
 */

import type { DetectionSource } from "$lib/shared/train/domain/detection-frame";
import type { PerformanceGrade, TimingGrade } from "$lib/shared/train/domain/performance-data";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/**
 * Stored performance record in database
 */
export interface StoredPerformance {
  id: string;
  sequenceId: string;
  sequenceName: string;
  performedAt: Date;
  detectionMethod: DetectionSource;
  bpm: number;

  // Stored as JSON for simplicity
  beatResultsJson: string;

  // Score data (denormalized for queries)
  score: {
    percentage: number;
    grade: PerformanceGrade;
    perfectHits: number;
    goodHits: number;
    misses: number;
    maxCombo: number;
    xpEarned: number;
  };

  // Optional metadata
  metadata?: {
    sessionDuration?: number; // Duration in milliseconds
  };

  // Optional video reference (stored in separate blob storage)
  videoStorageKey?: string;
}

/**
 * Stored beat result for detailed analysis
 */
export interface StoredBeatResult {
  stepNumber: number;
  expected: { blue: GridLocation; red: GridLocation };
  detected: { blue: GridLocation | null; red: GridLocation | null };
  timing: TimingGrade;
  timingDeltaMs: number;
  positionCorrect: { blue: boolean; red: boolean };
}

/**
 * Color calibration profile for color marker detection
 */
export interface StoredCalibrationProfile {
  id: string;
  name: string;
  createdAt: Date;
  isDefault: boolean;

  // HSV ranges for each marker color
  colorRanges: {
    endA: HSVRange;
    endB: HSVRange;
  };

  // Calibration metadata
  lightingConditions?: "bright" | "dim" | "mixed";
  cameraMirrored: boolean;
}

/**
 * HSV color range for color detection
 */
export interface HSVRange {
  hMin: number;
  hMax: number;
  sMin: number;
  sMax: number;
  vMin: number;
  vMax: number;
}
