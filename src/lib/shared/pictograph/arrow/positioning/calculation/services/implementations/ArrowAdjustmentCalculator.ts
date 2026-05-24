/**
 * Arrow Adjustment Calculator - Consolidated Service
 *
 * Consolidated service that combines ArrowAdjustmentCalculator and ArrowAdjustmentLookup
 * to eliminate pure delegation layer. Maintains exact same interface and behavior.
 *
 * CONSOLIDATION BENEFITS:
 * - Removes unnecessary delegation layer
 * - Maintains identical logic and results
 * - Preserves all existing interfaces and test compatibility
 * - Better TypeScript organization
 */

import type { MotionType } from "../../../../../shared/domain/enums/pictograph-enums";
import type { GridLocation } from "../../../../../grid/domain/enums/grid-enums";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { DefaultPlacer } from "../../../placement/services/implementations/DefaultPlacer";
import type { DirectionalTupleProcessor } from "./DirectionalTupleProcessor";
import { deriveGridMode as _deriveGridMode } from "../../../../../grid/services/grid-mode-deriver";
import type { SpecialPlacer } from "../../../placement/services/implementations/SpecialPlacer";
import {
  generateOrientationKey,
  resolveEffectiveOriKey,
  mapToLegacyBucket,
} from "../../../key-generation/services/special-placement-ori-key-generator";
import { generatePlacementKey } from "../../../key-generation/services/arrow-placement-key-generator";
import { generateTurnsTuple } from "../../../key-generation/services/turns-tuple-key-generator";
import { getKeyFromArrow } from "../../../key-generation/services/attribute-key-generator";
import { GridMode } from "../../../../../grid/domain/enums/grid-enums";
import { Point } from "fabric";
import { getPropGeometryRepository } from "../../../prop-geometry/services/prop-geometry-singleton";
import type { PropGeometryKey } from "../../../prop-geometry/domain/PropGeometryAdjustment";
import type {
  PipelineDiagnostics,
  GlobalTierInfo,
  SpecialJsonTierInfo,
} from "../../domain/PipelineDiagnostics";
import { getGlobalAdjustmentRepository } from "../../../global/services/global-adjustment-singleton";

export class ArrowAdjustmentCalculator {
  /**
   * Consolidated service combining lookup and calculation logic.
   * Eliminates the pure delegation layer while maintaining identical behavior.
   */

  constructor(
    private SpecialPlacer: SpecialPlacer,
    private DefaultPlacer: DefaultPlacer,
    private tupleProcessor: DirectionalTupleProcessor
  ) {}

  async calculateAdjustment(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    location: GridLocation,
    arrowColor?: string,
    soloMode?: boolean
  ): Promise<Point> {
    try {
      if (soloMode) {
        const defaultAdjustment = await this.calculateDefaultAdjustment(
          motionData,
          pictographData
        );
        return this.tupleProcessor.processDirectionalTuples(
          defaultAdjustment,
          motionData,
          location
        );
      }
      return await this.calculateAdjustmentResult(
        pictographData,
        motionData,
        letter,
        location,
        arrowColor
      );
    } catch (error) {
      console.error(`Adjustment calculation failed: ${error}`);
      return new Point(0, 0);
    }
  }

  /**
   * Get the base adjustment (before directional tuple transformation).
   * This is useful for the WASD adjustment panel to get the same base value
   * that the rendering pipeline uses.
   */
  async getBaseAdjustmentPublic(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    arrowColor?: string
  ): Promise<Point> {
    try {
      return await this.getBaseAdjustment(
        pictographData,
        motionData,
        letter,
        arrowColor
      );
    } catch (error) {
      console.error(`Base adjustment lookup failed: ${error}`);
      return new Point(0, 0);
    }
  }

  async calculateAdjustmentResult(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    location: GridLocation,
    arrowColor?: string
  ): Promise<Point> {
    /**
     * Calculate arrow position adjustment with proper error handling.
     * IDENTICAL logic to original ArrowAdjustmentCalculator.
     */
    try {
      // STEP 1: Look up base adjustment (special → default)
      const baseAdjustment = await this.getBaseAdjustment(
        pictographData,
        motionData,
        letter,
        arrowColor
      );

      // STEP 2: Process directional tuples for ALL motion types
      // JSON values are reference adjustments for a specific location (e.g., North)
      // They must be rotated via directional tuple matrices for each quadrant
      // This applies to ALL arrow types: PRO/ANTI/FLOAT/STATIC/DASH
      const finalAdjustment = this.tupleProcessor.processDirectionalTuples(
        baseAdjustment,
        motionData,
        location
      );

      return new Point(finalAdjustment.x, finalAdjustment.y);
    } catch (error) {
      console.error(
        `Adjustment calculation failed for letter ${letter}: ${error}`
      );
      throw new Error(`Arrow adjustment calculation failed: ${error}`);
    }
  }

  /**
   * Probe all 4 tiers of the arrow positioning pipeline without short-circuiting.
   *
   * Unlike getBaseAdjustment (which returns on first match), this method checks
   * every tier independently and records the result at each one. This lets the
   * WASD adjustment panel show the full pipeline state - which tier is active,
   * what value each tier holds, and what the final rotated adjustment comes out to.
   *
   * Tier priority (mirrors getBaseAdjustment):
   *   global > specialJson > propGeometry > default
   */
  async getDiagnostics(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    location: GridLocation,
    arrowColor?: string
  ): Promise<PipelineDiagnostics> {
    const diagnostics: PipelineDiagnostics = {
      activeTier: "default",
      global: null,
      specialJson: null,
      propGeometry: null,
      default: null,
      baseAdjustment: { x: 0, y: 0 },
      finalAdjustment: { x: 0, y: 0 },
    };

    // --- Tier 1: Global (Firestore override) ---
    // Requires a letter to build a meaningful key. Same constraint as special placement.
    if (letter) {
      try {
        const repo = getGlobalAdjustmentRepository();
        if (repo?.isInitialized) {
          const arrowKey = arrowColor || motionData.color || "blue";
          const thisPropType = motionData.propType?.toLowerCase() || "staff";
          const otherColor = arrowKey === "blue" ? "red" : "blue";
          const otherMotion = pictographData.motions?.[otherColor];
          const otherPropType = otherMotion?.propType?.toLowerCase() || "staff";

          const rawOriKey = generateOrientationKey(
            motionData,
            pictographData
          );
          const oriKey = resolveEffectiveOriKey(
            rawOriKey,
            pictographData
          );
          const gridMode =
            motionData.gridMode ||
            (pictographData.motions.blue && pictographData.motions.red
              ? _deriveGridMode(
                  pictographData.motions.blue,
                  pictographData.motions.red
                )
              : "diamond");

          // The global key's turnsTuple must match the format SpecialPlacer uses when
          // writing global overrides. We recover that string by asking the SpecialPlacer
          // for the JSON-only result (which exposes its own turnsTupleKey). If that
          // returns null (no JSON data for this letter), we fall back to the raw
          // number-array joined form from turnsTupleService - it still lets the repo
          // attempt the lookup with a consistent key.
          let turnsTupleString: string;
          try {
            const [, , attrKey] = this.generateLookupKeys(
              pictographData,
              motionData
            );
            const jsonResult =
              await this.SpecialPlacer.getSpecialJsonAdjustmentOnly(
                motionData,
                pictographData,
                arrowColor,
                attrKey
              );
            turnsTupleString = jsonResult?.turnsTupleKey
              ? String(jsonResult.turnsTupleKey)
              : generateTurnsTuple(pictographData).join(",");
          } catch {
            turnsTupleString = generateTurnsTuple(pictographData).join(",");
          }

          const legacyOriKey = mapToLegacyBucket(oriKey);
          const baseKey = {
            gridMode,
            oriKey,
            letter: pictographData.letter || "",
            turnsTuple: turnsTupleString,
            arrowKey,
          };

          const cascadingResult = repo.getAdjustmentCascading(
            baseKey,
            thisPropType,
            otherPropType,
            legacyOriKey
          );
          if (cascadingResult) {
            const globalInfo: GlobalTierInfo = {
              value: {
                x: cascadingResult.adjustment.x,
                y: cascadingResult.adjustment.y,
              },
              layer: cascadingResult.layer,
            };
            diagnostics.global = globalInfo;
          }
        }
      } catch (error) {
        console.warn("[getDiagnostics] Global tier probe failed:", error);
      }
    }

    // --- Tier 2: Special JSON (static per-letter files) ---
    if (letter) {
      try {
        const [, , attrKey] = this.generateLookupKeys(
          pictographData,
          motionData
        );
        const jsonResult =
          await this.SpecialPlacer.getSpecialJsonAdjustmentOnly(
            motionData,
            pictographData,
            arrowColor,
            attrKey
          );
        if (jsonResult) {
          const specialJsonInfo: SpecialJsonTierInfo = {
            value: { x: jsonResult.adjustment.x, y: jsonResult.adjustment.y },
            filePath: jsonResult.filePath,
            turnsTupleKey: String(jsonResult.turnsTupleKey),
          };
          diagnostics.specialJson = specialJsonInfo;
        }
      } catch (error) {
        console.warn("[getDiagnostics] Special JSON tier probe failed:", error);
      }
    }

    // --- Tier 3: Prop Geometry (letter-free, prop-aware) ---
    try {
      const propGeoResult = this.lookupPropGeometryAdjustment(
        pictographData,
        motionData,
        arrowColor
      );
      if (propGeoResult) {
        diagnostics.propGeometry = {
          value: { x: propGeoResult.x, y: propGeoResult.y },
        };
      }
    } catch (error) {
      console.warn("[getDiagnostics] Prop geometry tier probe failed:", error);
    }

    // --- Tier 4: Default (motion-type only) ---
    try {
      const defaultResult = await this.calculateDefaultAdjustment(
        motionData,
        pictographData
      );
      diagnostics.default = {
        value: { x: defaultResult.x, y: defaultResult.y },
      };
    } catch (error) {
      console.warn("[getDiagnostics] Default tier probe failed:", error);
    }

    // --- Determine active tier (same priority as getBaseAdjustment) ---
    let basePoint: Point;
    if (diagnostics.global) {
      diagnostics.activeTier = "global";
      basePoint = new Point(
        diagnostics.global.value.x,
        diagnostics.global.value.y
      );
    } else if (diagnostics.specialJson) {
      diagnostics.activeTier = "special-json";
      basePoint = new Point(
        diagnostics.specialJson.value.x,
        diagnostics.specialJson.value.y
      );
    } else if (diagnostics.propGeometry) {
      diagnostics.activeTier = "prop-geometry";
      basePoint = new Point(
        diagnostics.propGeometry.value.x,
        diagnostics.propGeometry.value.y
      );
    } else if (diagnostics.default) {
      diagnostics.activeTier = "default";
      basePoint = new Point(
        diagnostics.default.value.x,
        diagnostics.default.value.y
      );
    } else {
      // Nothing found anywhere - use zero point so the panel can still render
      basePoint = new Point(0, 0);
    }

    diagnostics.baseAdjustment = { x: basePoint.x, y: basePoint.y };

    // --- Apply directional tuple rotation to produce finalAdjustment ---
    try {
      const finalPoint = this.tupleProcessor.processDirectionalTuples(
        basePoint,
        motionData,
        location
      );
      diagnostics.finalAdjustment = { x: finalPoint.x, y: finalPoint.y };
    } catch (error) {
      console.warn(
        "[getDiagnostics] Directional tuple processing failed:",
        error
      );
      diagnostics.finalAdjustment = { x: basePoint.x, y: basePoint.y };
    }

    return diagnostics;
  }

  // === PRIVATE METHODS - Consolidated from ArrowAdjustmentLookup ===

  private async getBaseAdjustment(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    arrowColor?: string
  ): Promise<Point> {
    /**
     * Get base adjustment using streamlined lookup logic.
     * IDENTICAL to ArrowAdjustmentLookup.getBaseAdjustment()
     */
    if (!motionData) {
      throw new Error("Missing motion data for adjustment lookup");
    }

    try {
      // Special placement lookup requires a letter for key generation.
      // Some beats (e.g., the starting position) have no letter assigned,
      // so we skip special placement and go straight to prop geometry / default.
      if (letter) {
        // Generate required keys for special placement lookup
        const [, , attrKey] = this.generateLookupKeys(pictographData, motionData);

        try {
          const specialAdjustment = await this.lookupSpecialPlacement(
            motionData,
            pictographData,
            arrowColor,
            attrKey
          );

          if (specialAdjustment) {
            return specialAdjustment;
          }
        } catch (error) {
          console.warn(`Error in special placement lookup for ${letter}:`, error);
        }
      }

      // Prop geometry tier: letter-free, prop-aware adjustments.
      // When a prop's physical shape (triad arms, fan spread) extends into
      // the arrow's default position, this tier provides a better default
      // than the motion-type-only default placement.
      const propGeometryAdjustment = this.lookupPropGeometryAdjustment(
        pictographData,
        motionData,
        arrowColor
      );
      if (propGeometryAdjustment) {
        return propGeometryAdjustment;
      }

      // Fall back to default calculation
      const defaultAdjustment = await this.calculateDefaultAdjustment(
        motionData,
        pictographData
      );
      return defaultAdjustment;
    } catch (error) {
      console.error("Error in base adjustment lookup:", error);
      throw new Error(`Arrow adjustment lookup failed: ${error}`);
    }
  }

  private generateLookupKeys(
    pictographData: PictographData,
    motionData: MotionData
  ): [string, string, string] {
    /**Generate all required keys for special placement lookup.*/
    try {
      const oriKey = generateOrientationKey(
        motionData,
        pictographData
      );
      const turnsTuple =
        generateTurnsTuple(pictographData);

      const color = motionData.color;
      const tempArrow = {
        id: "temp",
        arrowLocation: null,
        positionX: 0,
        positionY: 0,
        rotationAngle: 0,
        coordinates: { x: 0, y: 0 },
        svgCenter: { x: 0, y: 0 },
        svgMirrored: false,
        isVisible: true,
        isSelected: false,
      };

      const attrKey = getKeyFromArrow(
        tempArrow,
        pictographData,
        color
      );

      return [oriKey, turnsTuple.join(","), attrKey];
    } catch (error) {
      console.error("Failed to generate lookup keys:", error);
      throw new Error(`Key generation failed: ${error}`);
    }
  }

  private async lookupSpecialPlacement(
    motionData: MotionData,
    pictographData: PictographData,
    arrowColor?: string,
    attributeKey?: string
  ): Promise<Point | null> {
    /**
     * Look up special placement using exact legacy logic.
     * IDENTICAL to ArrowAdjustmentLookup.lookupSpecialPlacement()
     */
    try {
      const adjustment = await this.SpecialPlacer.getSpecialAdjustment(
        motionData,
        pictographData,
        arrowColor,
        attributeKey
      );

      if (adjustment) {
        return new Point(adjustment.x, adjustment.y);
      }

      return null;
    } catch (error) {
      console.error("Error in special placement lookup:", error);
      return null;
    }
  }

  /**
   * Look up a prop geometry adjustment for the current scenario.
   *
   * Derives the key dimensions from the pictograph and motion data:
   * - gridMode, propType, otherPropType, positionType
   * - endOrientation of both hands, motionType, turns, arrowColor
   *
   * Returns null if no prop geometry adjustment is registered for
   * this scenario, letting the pipeline fall through to the default.
   */
  private lookupPropGeometryAdjustment(
    pictographData: PictographData,
    motionData: MotionData,
    arrowColor?: string
  ): Point | null {
    const repo = getPropGeometryRepository();
    if (!repo?.isInitialized) return null;

    // Need both motions to determine the full scenario
    const blueMotion = pictographData.motions.blue;
    const redMotion = pictographData.motions.red;
    if (!blueMotion || !redMotion) return null;

    // Derive grid mode
    const gridMode =
      motionData.gridMode ||
      _deriveGridMode(blueMotion, redMotion);

    // Derive position type from endPosition (e.g., "beta7" → "beta")
    const endPosition = pictographData.endPosition;
    if (!endPosition) return null;
    const positionType = endPosition.replace(/\d+$/, "");

    // Determine which motion is "ours" and which is "other"
    const color = arrowColor || motionData.color || "blue";
    const isBlue = color === "blue";
    const thisMotion = isBlue ? blueMotion : redMotion;
    const otherMotion = isBlue ? redMotion : blueMotion;

    const propGeometryKey: PropGeometryKey = {
      gridMode,
      propType: thisMotion.propType?.toLowerCase() || "staff",
      otherPropType: otherMotion.propType?.toLowerCase() || "staff",
      positionType,
      endOrientation: thisMotion.endOrientation?.toLowerCase() || "in",
      otherEndOrientation: otherMotion.endOrientation?.toLowerCase() || "in",
      motionType: motionData.motionType?.toLowerCase() || "static",
      turns: String(motionData.turns ?? 0),
      arrowColor: color,
    };

    const result = repo.getAdjustmentCascading(propGeometryKey);
    if (result) {
      return result.adjustment;
    }

    return null;
  }

  private async calculateDefaultAdjustment(
    motionData: MotionData,
    pictographData: PictographData
  ): Promise<Point> {
    /**
     * Calculate default adjustment - IDENTICAL to ArrowAdjustmentLookup.
     */
    try {
      // Use gridMode from motion data if available, otherwise derive from locations
      const gridMode =
        motionData.gridMode ||
        (pictographData.motions.blue && pictographData.motions.red
          ? _deriveGridMode(
              pictographData.motions.blue,
              pictographData.motions.red
            )
          : GridMode.DIAMOND);

      const keys = await this.DefaultPlacer.getAvailablePlacementKeys(
        motionData.motionType as MotionType,
        gridMode as GridMode
      );
      const defaultPlacements: Record<string, unknown> = Object.fromEntries(
        (keys || []).map((k: string) => [k, true])
      );

      const availableKeys = Object.keys(defaultPlacements || []);

      const placementKey = generatePlacementKey(
        motionData,
        pictographData,
        availableKeys
      );

      const adjustmentPoint = await this.DefaultPlacer.getDefaultAdjustment(
        placementKey,
        motionData.turns || 0,
        motionData.motionType as MotionType,
        gridMode as GridMode
      );

      return new Point(adjustmentPoint.x, adjustmentPoint.y);
    } catch (error) {
      console.error("Error calculating default adjustment:", error);
      throw new Error(`Default adjustment calculation failed: ${error}`);
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of arrowAdjustmentCalculator to avoid DI container rebuilds.
// ============================================================================

import { specialPlacer } from "../../../placement/services/implementations/SpecialPlacer";
import { defaultPlacer } from "../../../placement/services/implementations/DefaultPlacer";
import { directionalTupleProcessor } from "./DirectionalTupleProcessor";

export const arrowAdjustmentCalculator = new ArrowAdjustmentCalculator(
  specialPlacer,
  defaultPlacer,
  directionalTupleProcessor
);
