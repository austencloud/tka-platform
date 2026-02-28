/**
 * Skel2TKA Pipeline Configuration
 *
 * Centralized configuration for the video-to-TKA notation pipeline.
 * Thresholds, phase definitions, verification criteria, and detection defaults.
 *
 * Usage:
 *   import config from '../config/skel2tka-dev.config.js';
 *   const { PHASES, SANITY_THRESHOLDS } = config;
 */

/**
 * Phase Definitions
 *
 * Each phase has a verification gate that must pass before the next unlocks.
 */
export const PHASES = [
  {
    number: 0,
    name: "Infrastructure & Tooling",
    status: "active",
    gate: "Overlay renders on Phase 1 data, frame scrubber works, sanity checks display",
  },
  {
    number: 1,
    name: "Hand Tracking",
    status: "active",
    gate: "User accepts output for at least one test video via verification panel",
  },
  {
    number: 2,
    name: "Prop Endpoint Detection",
    status: "locked",
    gate: "User confirms endpoint markers match actual staff positions in video",
  },
  {
    number: 3,
    name: "Rotation & Orientation",
    status: "locked",
    gate: "User confirms turn count and CW/CCW direction match their performance",
  },
  {
    number: 4,
    name: "Motion Classification",
    status: "locked",
    gate: "User confirms motion type labels match TKA terminology they intended",
  },
  {
    number: 5,
    name: "Sequence Assembly",
    status: "locked",
    gate: "Side-by-side video playback + generated notation card match",
  },
  {
    number: 6,
    name: "AI Model Training",
    status: "locked",
    gate: "500+ verified training pairs, markerless detection benchmark passes",
  },
];

/**
 * Phase 1 Sanity Check Thresholds
 *
 * Automated pre-verification checks that run before manual review.
 * A check can pass, warn, or fail.
 */
export const SANITY_THRESHOLDS = {
  /** Minimum percentage of frames where both hands must be detected */
  MIN_HAND_DETECTION_RATE: 0.8,

  /** Minimum average confidence across all detected frames */
  MIN_AVG_CONFIDENCE: 0.6,

  /** Maximum distance (in normalized coords) a hand can jump between consecutive frames */
  MAX_TELEPORTATION_DISTANCE: 0.4,

  /** Minimum number of beats to consider analysis valid */
  MIN_BEAT_COUNT: 2,

  /** Minimum beat duration in seconds */
  MIN_BEAT_DURATION_SEC: 0.2,

  /** Maximum beat duration in seconds (catches stuck detection) */
  MAX_BEAT_DURATION_SEC: 10.0,
};

/**
 * Frame Extraction Defaults
 */
export const FRAME_EXTRACTION = {
  /** Default frames per second for extraction */
  DEFAULT_FPS: 15,

  /** Maximum frames to extract (prevents OOM on long videos) */
  MAX_FRAMES: 1000,

  /** Maximum video duration in seconds */
  MAX_VIDEO_DURATION_SEC: 60,
};

/**
 * Verification Verdicts
 *
 * The three actions a user can take at each phase gate.
 */
export const VERDICTS = ["accepted", "corrected", "rejected"];

/**
 * Correction Fields
 *
 * What the user can correct at each phase.
 */
export const CORRECTION_FIELDS = {
  PHASE_1: ["hand_position", "beat_boundary", "position_label"],
  PHASE_2: ["endpoint_position", "thumb_vs_pinky", "staff_angle"],
  PHASE_3: ["turn_count", "direction", "orientation"],
  PHASE_4: ["motion_type", "letter_type"],
  PHASE_5: ["pictograph_data"],
};

/**
 * Grid Locations (reference for compass rose picker)
 */
export const GRID_LOCATIONS = ["n", "ne", "e", "se", "s", "sw", "w", "nw", "c"];

/**
 * Hand Colors
 */
export const HAND_COLORS = {
  BLUE: { fill: "#3b82f6", stroke: "#2563eb", label: "Blue (Left)" },
  RED: { fill: "#ef4444", stroke: "#dc2626", label: "Red (Right)" },
};

/**
 * Confidence Color Scale
 *
 * Maps detection confidence ranges to display colors.
 */
export const CONFIDENCE_COLORS = {
  HIGH: { min: 0.8, color: "#22c55e" },
  MEDIUM: { min: 0.6, color: "#f59e0b" },
  LOW: { min: 0.0, color: "#ef4444" },
};

/**
 * Training Data Configuration
 */
export const TRAINING_DATA = {
  /** IndexedDB database name */
  DB_NAME: "skel2tka-training",

  /** IndexedDB database version */
  DB_VERSION: 1,

  /** Object store names */
  STORES: {
    PAIRS: "training-pairs",
    METADATA: "metadata",
  },

  /** Firebase collection for synced training data */
  FIREBASE_COLLECTION: "skel2tkaTraining",

  /** Minimum pairs before AI training is viable */
  MIN_PAIRS_FOR_TRAINING: 500,
};

/**
 * Overlay Rendering
 */
export const OVERLAY = {
  /** Hand position circle radius in pixels */
  HAND_CIRCLE_RADIUS: 12,

  /** Grid label font size */
  GRID_LABEL_FONT_SIZE: 11,

  /** Crosshair grid line opacity */
  CROSSHAIR_OPACITY: 0.15,

  /** Confidence ring width */
  CONFIDENCE_RING_WIDTH: 3,
};

// Default export for convenience
export default {
  PHASES,
  SANITY_THRESHOLDS,
  FRAME_EXTRACTION,
  VERDICTS,
  CORRECTION_FIELDS,
  GRID_LOCATIONS,
  HAND_COLORS,
  CONFIDENCE_COLORS,
  TRAINING_DATA,
  OVERLAY,
};
