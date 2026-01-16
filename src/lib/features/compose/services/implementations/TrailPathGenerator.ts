/**
 * TrailPathGenerator
 *
 * Mathematically calculates trail points from prop states.
 * No screen capture, no coordinate transformations - pure math.
 *
 * How it works:
 * 1. The orchestrator tells us prop CENTER position and ROTATION at any beat
 * 2. We calculate prop END positions using simple trigonometry:
 *    - end.x = center.x + halfLength * cos(rotation)
 *    - end.y = center.y + halfLength * sin(rotation)
 * 3. We sample at high frequency (e.g., 120 points per beat) for smooth trails
 * 4. Connect all sampled points = smooth trail path
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceAnimationOrchestrator } from "../contracts/ISequenceAnimationOrchestrator";
import type { PropState } from "../../shared/domain/types/PropState";

// Constants matching PixiPropRenderer exactly
const VIEWBOX_SIZE = 950;
const GRID_HALFWAY_POINT_OFFSET = 150;

/**
 * A single point in a trail
 */
export interface TrailPoint {
  x: number;
  y: number;
  beat: number; // Which beat this point was captured at
  timestamp: number; // Normalized time (0 to 1 within the sequence)
}

/**
 * Complete trail data for a sequence
 */
export interface GeneratedTrailData {
  /** Trail points for blue prop's left end */
  blueLeft: TrailPoint[];
  /** Trail points for blue prop's right end */
  blueRight: TrailPoint[];
  /** Trail points for red prop's left end */
  redLeft: TrailPoint[];
  /** Trail points for red prop's right end */
  redRight: TrailPoint[];
  /** Total number of steps in the sequence */
  totalSteps: number;
  /** Samples per beat used for generation */
  samplesPerStep: number;
  /** Canvas size the points are calculated for */
  canvasSize: number;
}

/**
 * Configuration for trail generation
 */
export interface TrailGenerationConfig {
  /** Canvas size in pixels (points will be in this coordinate space) */
  canvasSize: number;
  /** Number of samples per beat (higher = smoother trails, default: 120) */
  samplesPerStep?: number;
  /** Blue prop dimensions */
  bluePropDimensions: { width: number; height: number };
  /** Red prop dimensions */
  redPropDimensions: { width: number; height: number };
}

export class TrailPathGenerator {
  /**
   * Generate complete trail data for a sequence
   *
   * This calculates ALL trail points mathematically, without any rendering.
   * The result can be used for video generation or cached for playback.
   *
   * @param orchestrator - Initialized orchestrator with sequence data
   * @param sequence - The sequence to generate trails for
   * @param config - Generation configuration
   * @returns Complete trail data for the entire sequence
   */
  generateTrailsForSequence(
    orchestrator: ISequenceAnimationOrchestrator,
    sequence: SequenceData,
    config: TrailGenerationConfig
  ): GeneratedTrailData {
    const { canvasSize, bluePropDimensions, redPropDimensions } = config;
    const samplesPerStep = config.samplesPerStep ?? 120;

    const totalSteps = sequence.steps.length ?? 0;
    if (totalSteps === 0) {
      return {
        blueLeft: [],
        blueRight: [],
        redLeft: [],
        redRight: [],
        totalSteps: 0,
        samplesPerStep,
        canvasSize,
      };
    }

    // Initialize orchestrator with sequence
    const initialized = orchestrator.initializeWithDomainData(sequence);
    if (!initialized) {
      console.error("Failed to initialize orchestrator for trail generation");
      return {
        blueLeft: [],
        blueRight: [],
        redLeft: [],
        redRight: [],
        totalSteps,
        samplesPerStep,
        canvasSize,
      };
    }

    // Calculate scale factors
    const gridScaleFactor = canvasSize / VIEWBOX_SIZE;
    const scaledRadius = GRID_HALFWAY_POINT_OFFSET * gridScaleFactor;
    const blueHalfLength = (bluePropDimensions.width / 2) * gridScaleFactor;
    const redHalfLength = (redPropDimensions.width / 2) * gridScaleFactor;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;

    // Initialize trail arrays
    const blueLeft: TrailPoint[] = [];
    const blueRight: TrailPoint[] = [];
    const redLeft: TrailPoint[] = [];
    const redRight: TrailPoint[] = [];

    // Sample through the entire sequence
    const totalSamples = totalSteps * samplesPerStep;

    for (let i = 0; i <= totalSamples; i++) {
      const beat = i / samplesPerStep;
      const timestamp = beat / totalSteps; // Normalized 0-1

      // Get prop states at this beat position
      orchestrator.calculateState(beat);
      const blueState = orchestrator.getBluePropState();
      const redState = orchestrator.getRedPropState();

      // Calculate blue prop center and endpoints
      const blueCenter = this.calculatePropCenter(
        blueState,
        centerX,
        centerY,
        scaledRadius
      );
      const blueEnds = this.calculatePropEndpoints(
        blueCenter.x,
        blueCenter.y,
        blueState.staffRotationAngle,
        blueHalfLength
      );

      // Calculate red prop center and endpoints
      const redCenter = this.calculatePropCenter(
        redState,
        centerX,
        centerY,
        scaledRadius
      );
      const redEnds = this.calculatePropEndpoints(
        redCenter.x,
        redCenter.y,
        redState.staffRotationAngle,
        redHalfLength
      );

      // Add points to trails
      blueLeft.push({
        x: blueEnds.left.x,
        y: blueEnds.left.y,
        beat,
        timestamp,
      });
      blueRight.push({
        x: blueEnds.right.x,
        y: blueEnds.right.y,
        beat,
        timestamp,
      });
      redLeft.push({ x: redEnds.left.x, y: redEnds.left.y, beat, timestamp });
      redRight.push({
        x: redEnds.right.x,
        y: redEnds.right.y,
        beat,
        timestamp,
      });
    }

    return {
      blueLeft,
      blueRight,
      redLeft,
      redRight,
      totalSteps,
      samplesPerStep,
      canvasSize,
    };
  }

  /**
   * Get trail points up to a specific beat (for rendering partial trails)
   *
   * @param trailData - Pre-generated trail data
   * @param currentStep - Current beat position (can be fractional)
   * @param maxTrailLength - Maximum number of points to return (for trail fade effect)
   */
  getTrailPointsAtBeat(
    trailData: GeneratedTrailData,
    currentStep: number,
    maxTrailLength?: number
  ): {
    blueLeft: TrailPoint[];
    blueRight: TrailPoint[];
    redLeft: TrailPoint[];
    redRight: TrailPoint[];
  } {
    // Calculate the sample index for the current beat
    const sampleIndex = Math.floor(currentStep * trailData.samplesPerStep);

    // Get all points up to current beat
    const endIndex = Math.min(sampleIndex + 1, trailData.blueLeft.length);
    const startIndex = maxTrailLength
      ? Math.max(0, endIndex - maxTrailLength)
      : 0;

    return {
      blueLeft: trailData.blueLeft.slice(startIndex, endIndex),
      blueRight: trailData.blueRight.slice(startIndex, endIndex),
      redLeft: trailData.redLeft.slice(startIndex, endIndex),
      redRight: trailData.redRight.slice(startIndex, endIndex),
    };
  }

  /**
   * Calculate prop center position from PropState
   *
   * The prop center moves on a circle around the canvas center.
   * centerPathAngle tells us WHERE on that circle.
   */
  private calculatePropCenter(
    propState: PropState,
    canvasCenterX: number,
    canvasCenterY: number,
    radius: number
  ): { x: number; y: number } {
    // Check for dash motion (explicit x,y coordinates)
    if (propState.x !== undefined && propState.y !== undefined) {
      return {
        x: canvasCenterX + propState.x * radius,
        y: canvasCenterY + propState.y * radius,
      };
    }

    // Regular motion: position on circular path
    return {
      x: canvasCenterX + Math.cos(propState.centerPathAngle) * radius,
      y: canvasCenterY + Math.sin(propState.centerPathAngle) * radius,
    };
  }

  /**
   * Calculate prop endpoint positions
   *
   * Given the center of the prop and its rotation, calculate where
   * the left and right ends are located.
   *
   * Visual:
   *   [LEFT]--------●--------[RIGHT]
   *                 ↑
   *            center point
   *
   * The rotation angle determines which direction the prop is pointing.
   */
  private calculatePropEndpoints(
    centerX: number,
    centerY: number,
    rotationAngle: number,
    halfLength: number
  ): { left: { x: number; y: number }; right: { x: number; y: number } } {
    // Calculate offset from center to each end
    const offsetX = Math.cos(rotationAngle) * halfLength;
    const offsetY = Math.sin(rotationAngle) * halfLength;

    return {
      left: {
        x: centerX - offsetX,
        y: centerY - offsetY,
      },
      right: {
        x: centerX + offsetX,
        y: centerY + offsetY,
      },
    };
  }
}

// Singleton instance
let generatorInstance: TrailPathGenerator | null = null;

export function getTrailPathGenerator(): TrailPathGenerator {
  if (!generatorInstance) {
    generatorInstance = new TrailPathGenerator();
  }
  return generatorInstance;
}
