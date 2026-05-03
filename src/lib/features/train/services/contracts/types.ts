// --- From CameraManager ---
export interface CameraConfig {
  facingMode: "user" | "environment";
  width: number;
  height: number;
  frameRate: number;
}

// --- From HandAssigner ---
/**
 * Interface for assigning detected hands to blue/red slots
 * Handles both two-hand and single-hand scenarios using spatial proximity
 */

import type { DetectedPosition } from "../../domain/models/DetectionFrame";

export interface DetectedHandData {
  /** The processed position data */
  position: DetectedPosition;
  /** Raw wrist X coordinate (for position-based sorting) */
  wristX: number;
  /** Whether anatomical analysis indicates user's left hand */
  isUserLeftHand: boolean;
  /** Confidence in the handedness determination */
  confidence: number;
}

export interface HandAssignmentResult {
  /** Position assigned to blue slot (user's left hand) */
  blue: DetectedPosition | null;
  /** Position assigned to red slot (user's right hand) */
  red: DetectedPosition | null;
}

// --- From HandednessAnalyzer ---
/**
 * Interface for analyzing hand anatomical features to determine left vs right hand
 * This uses anatomical features (thumb position, palm orientation) rather than
 * relying solely on MediaPipe's handedness classification
 */



export type PalmOrientation = "facing" | "away" | "unknown";
export type AnatomicalHandedness = "left" | "right" | null;

export interface HandednessAnalysisResult {
  /** Anatomically detected handedness (null if unable to determine) */
  anatomicalHandedness: AnatomicalHandedness;
  /** Palm orientation relative to camera */
  palmOrientation: PalmOrientation;
  /** Confidence in the anatomical detection (0-1) */
  confidence: number;
}

// --- From HandLandmarker ---
/**
 * Interface for MediaPipe HandLandmarker wrapper
 * Handles initialization and raw landmark detection from MediaPipe
 */

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandednessResult {
  categoryName: string;
  score: number;
}

export interface HandLandmarkerResult {
  landmarks: HandLandmark[][];
  handedness: HandednessResult[][];
}

// --- From HandStateAnalyzer ---
/**
 * Interface for analyzing hand state (open, closed, partial)
 * Determines finger extension based on landmark positions
 */

import type { HandState } from "../../domain/models/DetectionFrame";

export interface HandStateAnalysisResult {
  /** The detected hand state */
  state: HandState;
  /** Number of extended fingers (0-4, not counting thumb) */
  extendedFingerCount: number;
}

// --- From HandTrackingStabilizer ---
/**
 * Interface for temporal smoothing and hand persistence
 * Reduces jitter and maintains hand identity across frames
 */

export interface HandHistory {
  positions: Array<{ x: number; y: number; timestamp: number }>;
  assignedHand: "left" | "right";
  confidenceFrames: number;
}

export interface SmoothedPosition {
  x: number;
  y: number;
}

export interface StabilizerConfig {
  /** Number of frames to keep in history for smoothing */
  smoothingWindow: number;
  /** Number of frames to persist a hand after it disappears */
  persistenceFrames: number;
  /** Minimum distance to switch handedness assignment (normalized 0-1) */
  handednessSwitchThreshold: number;
}

// --- From OrientationTracker ---
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { DetectionFrame } from "../../domain/models/DetectionFrame";

export interface OrientationState {
  blueOrientation: Orientation | null;
  redOrientation: Orientation | null;
  isLocked: boolean;
  confidence: number;
}

// --- From PerformanceHistoryTracker ---
/**
 * PerformanceHistoryTracker - Performance History Interface
 *
 * Manages storage and retrieval of training session history.
 */

import type { StoredPerformance } from "../../domain/models/TrainDatabaseModels";
import type { PerformanceScore } from "../../domain/models/PerformanceData";

export interface PersonalBest {
  sequenceId: string;
  sequenceName: string;
  bestScore: PerformanceScore;
  bestAccuracy: number;
  bestGrade: string;
  bestCombo: number;
  performanceId: string;
  achievedAt: Date;
}

export interface StatsOverview {
  totalSessions: number;
  totalPracticeTime: number; // milliseconds
  averageAccuracy: number;
  maxCombo: number;
}

// --- From PerformanceRecorder ---
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PerformanceData } from "../../domain/models/PerformanceData";

export interface RecordingConfig {
  bpm: number;
  recordVideo: boolean;
}

// --- From PerformanceScorer ---
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type {
  StepResult,
  PerformanceGrade,
} from "../../domain/models/PerformanceData";

export interface ExpectedStepPosition {
  stepNumber: number;
  blue: GridLocation;
  red: GridLocation;
  timestamp: number;
}

// --- From MediaPipeDetector ---
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface DetectionCapabilities {
  supportsRealtime: boolean;
  supportsPostRecording: boolean;
  requiresCalibration: boolean;
}

export interface DetectionOptions {
  /** Whether the video feed is mirrored (default: true for front-facing camera) */
  mirrored?: boolean;
  /** Grid mode for position detection (BOX = cardinal only, DIAMOND = intercardinal only) */
  gridMode?: GridMode;
}

// --- From SessionCompletionProcessor ---
/**
 * SessionCompletionProcessor
 *
 * Handles all post-session processing including:
 * - XP calculation and awarding
 * - Performance history persistence
 * - Achievement tracking
 * - Challenge progression
 */

import type { PracticeMode } from "../../domain/enums/TrainEnums";

/**
 * Input parameters for session completion processing
 */
export interface SessionCompletionParams {
  // Session metrics
  totalSteps: number;
  totalHits: number;
  totalMisses: number;
  maxCombo: number;
  currentScore: number;
  bpm: number;

  // Session context
  practiceMode: PracticeMode;
  sequenceId?: string;
  sequenceName?: string;
  sessionDuration: number; // milliseconds

  // Optional active challenge
  activeChallengeId?: string;
}

/**
 * XP breakdown returned after session processing
 */
export interface XPBreakdown {
  baseXP: number;
  accuracyBonus: number;
  comboBonus: number;
  totalXP: number;
}

/**
 * Challenge progress info returned after session processing
 */
export interface ChallengeProgressResult {
  challenge: {
    id: string;
    title: string;
    requirement: { target: number };
    xpReward: number;
  };
  currentProgress: number;
  isComplete: boolean;
  xpAwarded?: number;
}

/**
 * Result returned from session completion processing
 */
export interface SessionCompletionResult {
  xpBreakdown: XPBreakdown;
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  accuracy: number;
  challengeProgress?: ChallengeProgressResult;
}
