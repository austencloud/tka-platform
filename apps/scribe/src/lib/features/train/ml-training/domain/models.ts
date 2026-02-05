/**
 * ML Training Pipeline Domain Models
 *
 * These models support the custom prop detection training workflow:
 * 1. Data Capture - Recording frames from webcam
 * 2. Labeling - Annotating props with bounding boxes and orientation
 * 3. Training - Export to COCO format for MediaPipe Model Maker
 * 4. Inference - Running trained models in browser
 */

/**
 * Prop types supported by the training system.
 * Starting with CLUB because it's asymmetric (easier orientation detection).
 */
export type PropType = "club" | "staff" | "fan" | "hoop" | "buugeng";

/**
 * 8-way cardinal directions for prop head orientation.
 * This is PHYSICAL direction (relative to image coordinates),
 * NOT grid-relative orientation.
 */
export type HeadDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

/**
 * Which hand is holding the prop.
 * Left hand = blue, Right hand = red (TKA convention).
 */
export type PropHand = "left" | "right";

/**
 * Status of a captured frame in the labeling workflow.
 */
export type FrameStatus = "unlabeled" | "labeled" | "verified" | "skipped";

/**
 * A capture session represents a continuous recording of frames.
 */
export interface CaptureSession {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  frameCount: number;
  fps: number;
  resolution: { width: number; height: number };
  propType: PropType;
  notes?: string;
  /** Number of frames that have been labeled */
  labeledCount: number;
  /** Number of frames verified as correct */
  verifiedCount: number;
}

/**
 * A single captured frame within a session.
 */
export interface CapturedFrame {
  id: string;
  sessionId: string;
  frameNumber: number;
  /** Milliseconds from session start */
  timestamp: number;
  /** Blob URL or IndexedDB key for the image data */
  imageKey: string;
  status: FrameStatus;
  /** When this frame was labeled (if applicable) */
  labeledAt?: Date;
}

/**
 * Bounding box in normalized coordinates (0-1).
 * Origin is top-left of image.
 */
export interface BoundingBox {
  x: number; // Left edge (0-1)
  y: number; // Top edge (0-1)
  width: number; // Box width (0-1)
  height: number; // Box height (0-1)
}

/**
 * A point in normalized image coordinates.
 */
export interface Point {
  x: number; // 0-1
  y: number; // 0-1
}

/**
 * Annotation for a single prop in a frame.
 * Each frame can have 0, 1, or 2 prop annotations (one per hand).
 */
export interface PropAnnotation {
  id: string;
  frameId: string;
  /** Bounding box around the entire prop */
  boundingBox: BoundingBox;
  /** Type of prop */
  propType: PropType;
  /** Which hand is holding this prop */
  hand: PropHand;
  /** Direction the prop head is pointing (physical, not grid-relative) */
  headDirection: HeadDirection;
  /**
   * For asymmetric props like club: keypoint for the weighted end.
   * Null for symmetric props like staff.
   */
  headPosition?: Point;
  /**
   * For asymmetric props: keypoint for the handle end.
   * Null for symmetric props.
   */
  knobPosition?: Point;
  /** Confidence score if pre-labeled by model (0-1) */
  confidence?: number;
  /** Whether this annotation has been human-verified */
  verified: boolean;
}

/**
 * A complete labeled frame with all its annotations.
 */
export interface LabeledFrame {
  frame: CapturedFrame;
  annotations: PropAnnotation[];
}

/**
 * Statistics for a training dataset.
 */
export interface DatasetStats {
  totalFrames: number;
  labeledFrames: number;
  verifiedFrames: number;
  annotationsByHand: { left: number; right: number };
  annotationsByDirection: Record<HeadDirection, number>;
  annotationsByPropType: Partial<Record<PropType, number>>;
}

/**
 * A training dataset composed of multiple capture sessions.
 */
export interface TrainingDataset {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  sessionIds: string[];
  stats: DatasetStats;
  /** Train/validation split ratio (e.g., 0.8 = 80% train) */
  trainSplit: number;
  /** URL/path to exported COCO JSON (if exported) */
  cocoExportPath?: string;
}

/**
 * A trained model version.
 */
export interface TrainedModel {
  id: string;
  name: string;
  version: string;
  datasetId: string;
  modelType: "prop-detector" | "orientation-classifier";
  trainedAt: Date;
  /** Training metrics */
  metrics: {
    mAP?: number; // For object detection
    accuracy?: number; // For classification
    loss?: number;
    epochs: number;
  };
  /** Path to .tflite model file */
  modelPath: string;
  /** Whether this is the active/deployed model */
  isActive: boolean;
}

/**
 * COCO format for export (subset of full spec).
 * Used for MediaPipe Model Maker training.
 */
export interface COCODataset {
  images: COCOImage[];
  annotations: COCOAnnotation[];
  categories: COCOCategory[];
}

export interface COCOImage {
  id: number;
  file_name: string;
  width: number;
  height: number;
}

export interface COCOAnnotation {
  id: number;
  image_id: number;
  category_id: number;
  /** [x, y, width, height] in absolute pixels */
  bbox: [number, number, number, number];
  area: number;
  iscrowd: 0 | 1;
  /** Custom extension: head direction for orientation */
  head_direction?: HeadDirection;
  /** Custom extension: which hand */
  hand?: PropHand;
}

export interface COCOCategory {
  id: number;
  name: string;
  supercategory?: string;
}
