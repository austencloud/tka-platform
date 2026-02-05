/**
 * PictographDataDebugger - Comprehensive debugging for pictograph data flow
 *
 * This service helps trace data from CSV → PictographData → PropPlacementData to identify
 * where data corruption or missing information occurs.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { betaDetector as betaDetectorDirect } from "$lib/shared/pictograph/prop/services/implementations/BetaDetector";
import { gridModeDeriver as gridModeDeriverDirect } from "$lib/shared/pictograph/grid/services/implementations/GridModeDeriver";

export interface DataFlowTrace {
  step: string;
  timestamp: number;
  data: unknown;
  errors?: string[];
  warnings?: string[];
}

export interface PictographDebugInfo {
  letter: string;
  gridMode: string;
  endsWithBeta: boolean;
  hasValidMotionData: boolean;
  hasValidPropPlacementData: boolean;
  propLocations: Record<string, string>;
  motionEndLocations: Record<string, string>;
  dataFlowTrace: DataFlowTrace[];
  csvRowData?: Record<string, string>;
}

export class PictographDataDebugger {
  private traces: Map<string, DataFlowTrace[]> = new Map();
  private debugEnabled = true;

  /**
   * Enable or disable debugging
   */
  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  /**
   * Start a new data flow trace
   */
  startTrace(identifier: string): void {
    if (!this.debugEnabled) return;
    this.traces.set(identifier, []);
  }

  /**
   * Add a step to the trace
   */
  addTraceStep(
    identifier: string,
    step: string,
    data: unknown,
    errors?: string[],
    warnings?: string[]
  ): void {
    if (!this.debugEnabled) return;

    const trace = this.traces.get(identifier) || [];
    trace.push({
      step,
      timestamp: Date.now(),
      data: this.sanitizeDataForLogging(data),
      // Only include errors and warnings if defined
      ...(errors !== undefined && { errors }),
      ...(warnings !== undefined && { warnings }),
    });
    this.traces.set(identifier, trace);
  }

  /**
   * Get complete debug info for a pictograph
   */
  async getPictographDebugInfo(
    pictographData: PictographData,
    csvRow?: Record<string, string>
  ): Promise<PictographDebugInfo> {
    const identifier = `${pictographData.letter}_${Date.now()}`;

    // Analyze the pictograph data using the new beta detection
    const endsWithBetaPosition = betaDetectorDirect.endsWithBeta(pictographData);
    const hasValidMotionData = this.validateMotionData(pictographData);
    const hasValidPropPlacementData =
      this.validatePropPlacementData(pictographData);

    // Extract location information
    const propLocations: Record<string, string> = {};
    const motionEndLocations: Record<string, string> = {};

    if (pictographData.motions) {
      Object.entries(pictographData.motions).forEach(([color, motionData]) => {
        if (motionData) {
          propLocations[color] = motionData.endLocation || "unknown";
        }
      });
    }

    if (pictographData.motions) {
      Object.entries(pictographData.motions).forEach(([color, motion]) => {
        if (motion) {
          motionEndLocations[color] = motion.endLocation || "unknown";
        }
      });
    }

    // Compute gridMode from motion data
    const gridMode =
      pictographData.motions.blue && pictographData.motions.red
        ? gridModeDeriverDirect.deriveGridMode(
            pictographData.motions.blue,
            pictographData.motions.red
          )
        : "unknown";

    const debugInfo: PictographDebugInfo = {
      letter: pictographData.letter || "unknown",
      gridMode: gridMode.toString(),
      endsWithBeta: endsWithBetaPosition,
      hasValidMotionData,
      hasValidPropPlacementData,
      propLocations,
      motionEndLocations,
      dataFlowTrace: this.traces.get(identifier) || [],
      csvRowData: csvRow ?? {},
    };

    this.logDebugInfo(debugInfo);
    return debugInfo;
  }

  /**
   * Validate motion data completeness
   */
  private validateMotionData(pictographData: PictographData): boolean {
    if (!pictographData.motions) return false;

    return Object.values(pictographData.motions).every(
      (motion) =>
        motion.startLocation &&
        motion.endLocation &&
        motion.motionType !== undefined &&
        motion.rotationDirection !== undefined
    );
  }

  /**
   * Validate prop data completeness
   */
  private validatePropPlacementData(pictographData: PictographData): boolean {
    if (!pictographData.motions) return false;

    return Object.values(pictographData.motions).every(
      (motion) => motion.propType && motion.endLocation && motion.color
    );
  }

  /**
   * Log comprehensive debug information
   */
  private logDebugInfo(debugInfo: PictographDebugInfo): void {
    if (!this.debugEnabled) return;

    console.group(`Pictograph Debug: ${debugInfo.letter}`);

    if (debugInfo.dataFlowTrace.length > 0) {
      debugInfo.dataFlowTrace.forEach((trace, index) => {
        if (trace.warnings?.length) {
          console.warn(
            `Step ${index + 1}: ${trace.step} - Warnings:`,
            trace.warnings
          );
        }
        if (trace.errors?.length) {
          console.error(
            `Step ${index + 1}: ${trace.step} - Errors:`,
            trace.errors
          );
        }
      });
    }

    console.groupEnd();
  }

  /**
   * Sanitize data for logging to prevent circular references
   */
  private sanitizeDataForLogging(data: unknown): unknown {
    if (data === null || data === undefined) return data;

    if (typeof data === "object") {
      if (Array.isArray(data)) {
        return data.map((item) => this.sanitizeDataForLogging(item));
      }

      const sanitized: Record<string, unknown> = {};
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === "function") {
          sanitized[key] = "[Function]";
        } else if (typeof value === "object" && value !== null) {
          // Limit depth to prevent circular references
          sanitized[key] = JSON.parse(JSON.stringify(value, null, 2));
        } else {
          sanitized[key] = value;
        }
      });
      return sanitized;
    }

    return data;
  }

  /**
   * Clear all traces (useful for cleanup)
   */
  clearTraces(): void {
    this.traces.clear();
  }

  /**
   * Export debug data as JSON for external analysis
   */
  exportDebugData(): string {
    const allTraces: Record<string, DataFlowTrace[]> = {};
    this.traces.forEach((trace, identifier) => {
      allTraces[identifier] = trace;
    });

    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        traces: allTraces,
      },
      null,
      2
    );
  }
}

// Singleton instance for global debugging
export const pictographDataDebugger = new PictographDataDebugger();
