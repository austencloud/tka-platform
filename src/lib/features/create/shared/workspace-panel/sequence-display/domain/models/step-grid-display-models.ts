/**
 * Beat Grid Display Models
 *
 * Domain models for beat grid display animations and transitions.
 * These handle how beats appear/disappear in the Create module grid,
 * NOT playback animations in the Animator tab.
 */

/**
 * Responsive grid layout configuration
 */
export interface GridLayout {
  /** Number of rows in the grid */
  rows: number;
  /** Number of columns for beats (excludes start position column) */
  columns: number;
  /** Total columns including start position */
  totalColumns: number;
  /** Size of each grid cell in pixels */
  cellSize: number;
  /** Maximum columns allowed for current viewport */
  maxColumns: number;
}

/**
 * Animation mode for sequence display
 */
export type AnimationMode = "sequential" | "all-at-once";

/**
 * State of display animations
 */
export interface DisplayAnimationState {
  /** Index of newly added beat (for single beat animation) */
  newlyAddedBeatIndex: number | null;
  /** Whether all beats should animate simultaneously */
  shouldAnimateAllBeats: boolean;
  /** Whether start position should animate */
  shouldAnimateStartPosition: boolean;
  /** Current animation mode */
  isSequentialMode: boolean;
  /** Set of beat indices that should currently animate */
  beatsToAnimate: Set<number>;
  /** Flag indicating animation preparation (beats rendered invisible) */
  isPreparingFullAnimation: boolean;
  /** Flag for sequential mode waiting state (beats hidden until their turn) */
  isWaitingForSequentialAnimation: boolean;
  /** Flag for fade-out animation before sequence generation */
  isClearingForGeneration: boolean;
}

/**
 * Event detail for beat letter animation
 */
export interface BeatLetterAnimatedEvent {
  beatIndex: number;
  letter: string;
  totalBeats: number;
}

/**
 * Event detail for sequence animation preparation
 */
export interface PrepareSequenceAnimationEvent {
  isSequential: boolean;
  beatCount: number;
}

/**
 * Event detail for sequential animation completion
 */
export interface SequentialAnimationCompleteEvent {
  totalBeats: number;
}

/**
 * Scroll behavior configuration
 */
export interface ScrollConfig {
  /** Whether vertical scrollbar is present */
  hasVerticalScrollbar: boolean;
  /** Whether to auto-scroll on beat addition */
  autoScrollEnabled: boolean;
}

/**
 * Grid sizing constraints
 */
export interface GridSizingConstraints {
  /** Minimum cell size in pixels */
  minCellSize: number;
  /** Maximum cell size in pixels */
  maxCellSize: number;
  /** Container width padding percentage (0-1) */
  widthPaddingRatio: number;
  /** Container height padding percentage (0-1) */
  heightPaddingRatio: number;
  /** Row count threshold for height-based sizing */
  heightSizingRowThreshold: number;
}

/**
 * Default grid sizing constraints
 */
export const DEFAULT_GRID_SIZING: GridSizingConstraints = {
  minCellSize: 50,
  maxCellSize: 200,
  widthPaddingRatio: 0.9,
  heightPaddingRatio: 0.9,
  heightSizingRowThreshold: 4,
};

/**
 * Animation timing configuration
 */
export interface AnimationTiming {
  /** Delay between sequential beat animations (ms) */
  sequentialDelay: number;
  /** Duration of beat entrance animation (ms) */
  entranceDuration: number;
  /** Duration of beat exit animation (ms) */
  exitDuration: number;
  /** Duration of clear sequence fade-out (ms) */
  clearDuration: number;
  /** Cleanup delay after animation completes (ms) */
  cleanupDelay: number;
}

/**
 * Default animation timing values
 */
export const DEFAULT_ANIMATION_TIMING: AnimationTiming = {
  sequentialDelay: 60,
  entranceDuration: 400,
  exitDuration: 500,
  clearDuration: 300,
  cleanupDelay: 600,
};
