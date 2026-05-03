import type { TransformResult } from "../contracts/types";
import type {
  Point,
  MandalaElement,
  TransformedElement,
} from "../../domain/models/mandala-element";
import type { MandalaConfig } from "../../domain/models/mandala-config";
import type { SymmetryFold } from "../../domain/enums/mandala-enums";
import { CANVAS_CENTER } from "../../domain/constants/symmetry-constants";

/**
 * Core symmetry transformation engine for the mandala generator.
 * Handles all geometric transformations: rotation, mirroring, and combined kaleidoscope effects.
 */
export class MandalaTransformer {
  /**
   * Convert degrees to radians.
   */
  private degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Normalize angle to 0-360 range.
   */
  private normalizeAngle(degrees: number): number {
    const normalized = degrees % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  /**
   * Rotate a point around a center by a given angle.
   */
  rotatePoint(point: Point, angleDegrees: number, center: Point): Point {
    const radians = this.degreesToRadians(angleDegrees);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    // Translate point to origin (relative to center)
    const dx = point.x - center.x;
    const dy = point.y - center.y;

    // Apply rotation matrix
    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;

    // Translate back
    return {
      x: rotatedX + center.x,
      y: rotatedY + center.y,
    };
  }

  /**
   * Mirror a point across an axis passing through center at given angle.
   * axisAngle: 0 = vertical axis (left-right mirror)
   * axisAngle: 90 = horizontal axis (top-bottom mirror)
   */
  mirrorPoint(point: Point, axisAngle: number, center: Point): Point {
    // Translate to origin
    const dx = point.x - center.x;
    const dy = point.y - center.y;

    // Convert axis angle to radians
    const axisRad = this.degreesToRadians(axisAngle);

    // Mirror formula: reflected = 2 * (point · axis) * axis - point
    // Using rotation matrix approach for reflection across arbitrary axis
    const cos2 = Math.cos(2 * axisRad);
    const sin2 = Math.sin(2 * axisRad);

    // Reflection matrix:
    // [cos(2θ)  sin(2θ)]
    // [sin(2θ) -cos(2θ)]
    const mirroredX = dx * cos2 + dy * sin2;
    const mirroredY = dx * sin2 - dy * cos2;

    return {
      x: mirroredX + center.x,
      y: mirroredY + center.y,
    };
  }

  /**
   * Apply n-fold rotational symmetry to an element.
   */
  applyRotationalSymmetry(
    element: MandalaElement,
    foldCount: SymmetryFold,
    center: Point
  ): TransformResult[] {
    const results: TransformResult[] = [];
    const angleStep = 360 / foldCount;

    for (let i = 0; i < foldCount; i++) {
      const rotationAngle = i * angleStep;
      const rotatedPosition = this.rotatePoint(
        element.position,
        rotationAngle,
        center
      );

      results.push({
        position: rotatedPosition,
        rotation: this.normalizeAngle(element.rotation + rotationAngle),
        scale: element.scale,
        isMirrored: false,
        foldIndex: i,
      });
    }

    return results;
  }

  /**
   * Apply mirror reflection to an element.
   */
  applyMirror(
    element: MandalaElement,
    axisAngle: number,
    center: Point
  ): TransformResult {
    const mirroredPosition = this.mirrorPoint(
      element.position,
      axisAngle,
      center
    );

    // Mirror the element's rotation as well
    // Reflection inverts the rotation direction relative to the axis
    const mirroredRotation = this.normalizeAngle(
      2 * axisAngle - element.rotation
    );

    return {
      position: mirroredPosition,
      rotation: mirroredRotation,
      scale: element.scale,
      isMirrored: true,
      foldIndex: 0,
    };
  }

  /**
   * Generate full kaleidoscope pattern with rotation and optional mirror symmetry.
   */
  generateKaleidoscopePattern(
    element: MandalaElement,
    config: MandalaConfig
  ): TransformedElement[] {
    const center = CANVAS_CENTER;
    const results: TransformedElement[] = [];

    // First, apply rotational symmetry to get all rotated copies
    const rotatedCopies = this.applyRotationalSymmetry(
      element,
      config.foldCount,
      center
    );

    for (const rotated of rotatedCopies) {
      // Add the rotated copy
      results.push({
        sourceId: element.id,
        position: rotated.position,
        rotation: rotated.rotation,
        scale: rotated.scale,
        isMirrored: false,
        foldIndex: rotated.foldIndex,
        svgContent: element.svgContent,
      });

      // If mirror is enabled, add mirrored versions
      if (config.enableMirror && config.mirrorAxis !== "none") {
        const mirrorAngles = this.getMirrorAngles(
          config.mirrorAxis,
          config.foldCount
        );

        for (const mirrorAngle of mirrorAngles) {
          // Create a temporary element at the rotated position
          const tempElement: MandalaElement = {
            ...element,
            position: rotated.position,
            rotation: rotated.rotation,
          };

          const mirrored = this.applyMirror(tempElement, mirrorAngle, center);

          results.push({
            sourceId: element.id,
            position: mirrored.position,
            rotation: mirrored.rotation,
            scale: mirrored.scale,
            isMirrored: true,
            foldIndex: rotated.foldIndex,
            svgContent: element.svgContent,
          });
        }
      }
    }

    return results;
  }

  /**
   * Get mirror axis angles based on configuration.
   */
  private getMirrorAngles(
    mirrorAxis: string,
    _foldCount: SymmetryFold
  ): number[] {
    switch (mirrorAxis) {
      case "vertical":
        // Mirror across vertical axis (angle = 90)
        return [90];
      case "horizontal":
        // Mirror across horizontal axis (angle = 0)
        return [0];
      case "both":
        // Mirror across both axes
        return [0, 90];
      default:
        return [];
    }
  }

  /**
   * Transform all source elements according to configuration.
   */
  transformAllElements(
    elements: MandalaElement[],
    config: MandalaConfig
  ): TransformedElement[] {
    const allTransformed: TransformedElement[] = [];

    for (const element of elements) {
      const transformed = this.generateKaleidoscopePattern(element, config);
      allTransformed.push(...transformed);
    }

    return allTransformed;
  }
}
