import type { SequenceEntry } from "../../domain/models/sequence-models";
import type {
  ILOOPDetector,
  LOOPDetectionResult,
  ModularPattern,
} from "../contracts/ILOOPDetector";
import type { TransformationIntervals } from "../../domain/models/label-models";
import type { StepComparisonOrchestrator } from "./comparison/StepComparisonOrchestrator";
import type {
  IPolyrhythmicDetector,
  PolyrhythmicLOOPResult,
} from "../contracts/IPolyrhythmicDetector";
import type {
  InternalStepPair,
  ExtractedStep,
} from "../../domain/models/internal-step-models";
import type { ComponentId } from "../../domain/constants/loop-components";
import {
  LOOPComponent,
  type DetectedComponent,
  type LOOPDomain,
} from "$lib/features/create/generate/shared/domain/models/generate-models";
import { loopOrientationDetector } from "./LOOPOrientationDetector";
import { detectUniformPattern } from "./detection";

function componentIdToLOOPComponent(id: ComponentId): LOOPComponent | null {
  switch (id) {
    case "rotated":
      return LOOPComponent.ROTATED;
    case "mirrored":
      return LOOPComponent.MIRRORED;
    case "flipped":
      return LOOPComponent.FLIPPED;
    case "swapped":
      return LOOPComponent.SWAPPED;
    case "inverted":
      return LOOPComponent.INVERTED;
    case "rewound":
      return LOOPComponent.REWOUND;
    default:
      return null;
  }
}

function componentsToDetailed(ids: ComponentId[]): DetectedComponent[] {
  const out: DetectedComponent[] = [];
  for (const id of ids) {
    const component = componentIdToLOOPComponent(id);
    if (component !== null) {
      out.push({ component, domain: "location" });
    }
  }
  return out;
}

function periodFromIntervals(
  intervals: TransformationIntervals,
  isCircular: boolean
): number {
  if (!isCircular) return 1;
  const values = Object.values(intervals).filter(
    (v): v is number => typeof v === "number"
  );
  if (values.length === 0) return 1;
  return Math.max(...values);
}

function mergeComponents(
  locationComponents: DetectedComponent[],
  orientationComponents: DetectedComponent[]
): DetectedComponent[] {
  const byComponent = new Map<LOOPComponent, LOOPDomain>();
  for (const entry of locationComponents) {
    byComponent.set(entry.component, "location");
  }
  for (const entry of orientationComponents) {
    const existing = byComponent.get(entry.component);
    if (existing === "location") {
      byComponent.set(entry.component, "both");
    } else if (!existing) {
      byComponent.set(entry.component, "orientation");
    }
  }
  const out: DetectedComponent[] = [];
  for (const [component, domain] of byComponent) {
    out.push({ component, domain });
  }
  return out;
}

export class LOOPDetector implements ILOOPDetector {
  constructor(
    private comparisonOrchestrator: StepComparisonOrchestrator,
    private analysisService: TransformationAnalyzer,
    private formattingService: CandidateFormatter,
    private polyrhythmicService?: IPolyrhythmicDetector,
    private layeredPathService?: LayeredPathDetector
  ) {}

  isCircular(sequence: SequenceEntry): boolean {
    const steps = sequence.fullMetadata?.sequence?.filter(
      (b) => typeof b.beat === "number" && b.beat >= 1
    );
    if (!steps || steps.length < 2) return false;

    const startPosition = sequence.fullMetadata?.sequence?.find(
      (b) => b.beat === 0
    );
    const lastStep = steps[steps.length - 1];
    if (!startPosition || !lastStep) return false;

    const startPos =
      startPosition.endPos || startPosition.sequenceStartPosition;
    const endPos = lastStep.endPos;
    return startPos === endPos;
  }

  detectLOOP(sequence: SequenceEntry): LOOPDetectionResult {
    const result = this.detectLocationPass(sequence);
    return this.augmentWithOrientation(result, sequence);
  }

  private augmentWithOrientation(
    result: LOOPDetectionResult,
    sequence: SequenceEntry
  ): LOOPDetectionResult {
    const orientation = loopOrientationDetector.detectOrientationPass(sequence);
    const mergedDetailed = mergeComponents(
      result.componentsDetailed,
      orientation.components
    );
    const period = Math.max(result.period, orientation.period);
    return {
      ...result,
      period,
      componentsDetailed: mergedDetailed,
    };
  }

  private detectLocationPass(sequence: SequenceEntry): LOOPDetectionResult {
    const circular = this.isCircular(sequence);
    const steps = this.comparisonOrchestrator.extractBeats(sequence);

    const rawSequence = (sequence.fullMetadata?.sequence || []) as Record<
      string,
      unknown
    >[];
    const polyrhythmic: PolyrhythmicLOOPResult =
      this.polyrhythmicService?.detectPolyrhythmic(rawSequence) ?? {
        isPolyrhythmic: false,
        polyrhythm: null,
        periods: [],
        motionPeriod: null,
        spatialPeriod: null,
        description: "Polyrhythmic detection not available",
        confidence: 0,
      };
    const layeredPath: LayeredPathResult =
      this.layeredPathService?.detectLayeredPath(rawSequence) ?? {
        isLayeredPath: false,
        blueCycle: null,
        redCycle: null,
        rhythmType: null,
        polyrhythmRatio: null,
        zoneCoverage: null,
        description: "Layered path detection not available",
        confidence: 0,
      };

    if (!circular || steps.length < 2) {
      return this.buildEmptyResult(circular, polyrhythmic, layeredPath);
    }

    if (steps.length % 2 !== 0) {
      return this.buildFreeformResult(polyrhythmic, layeredPath);
    }

    const candidates = detectUniformPattern(steps, this.comparisonOrchestrator);

    const hasRepeated = candidates.some(
      c => c.components.includes("repeated") && !c.components.includes("rewound")
    );
    const effectiveCandidates = hasRepeated
      ? candidates.filter(c => c.components.includes("rewound"))
      : candidates;

    const uniformCandidates = effectiveCandidates.filter(
      c => !c.components.includes("rewound")
    );
    const rewoundCandidate = effectiveCandidates.find(
      c => c.components.includes("rewound")
    );

    if (uniformCandidates.length > 0) {
      const primary = uniformCandidates[0]!;
      const allComponents = [...primary.components];
      if (rewoundCandidate) {
        allComponents.push("rewound");
      }

      let rotationDirection: "cw" | "ccw" | null = null;
      if (steps.length >= 4 && steps.length % 4 === 0) {
        rotationDirection =
          this.comparisonOrchestrator.detectRotationDirection(steps);
      }

      const intervals = primary.transformationIntervals || {};

      const halvedStepPairs =
        this.comparisonOrchestrator.generateHalvedBeatPairs(steps);
      this.analysisService.reprioritizeBeatPairs(halvedStepPairs);
      const halvedGroups =
        this.analysisService.groupStepPairsByPattern(halvedStepPairs);

      let displayPairs = this.formattingService.toPublicStepPairs(halvedStepPairs);
      let displayGroups = halvedGroups;

      if (steps.length >= 4 && steps.length % 4 === 0) {
        const quarteredStepPairs =
          this.comparisonOrchestrator.generateQuarteredBeatPairs(steps);
        this.analysisService.reprioritizeBeatPairs(quarteredStepPairs);
        displayPairs = this.formattingService.toPublicStepPairs(quarteredStepPairs);
        displayGroups =
          this.analysisService.groupStepPairsByPattern(quarteredStepPairs);
      }

      return {
        loopType: primary.loopType,
        components: allComponents,
        transformationIntervals: intervals,
        rotationDirection: primary.rotationDirection || rotationDirection,
        candidateDesignations: candidates,
        stepPairs: displayPairs,
        stepPairGroups: displayGroups,
        isCircular: true,
        isFreeform: false,
        isModular: false,
        layeredPath,
        isLayeredPath: layeredPath.isLayeredPath,
        polyrhythmic,
        isPolyrhythmic: polyrhythmic.isPolyrhythmic,
        isAxisAlternating: false,
        period: periodFromIntervals(intervals, true),
        componentsDetailed: componentsToDetailed(allComponents as ComponentId[]),
      };
    }

    const halvedStepPairs =
      this.comparisonOrchestrator.generateHalvedBeatPairs(steps);
    this.analysisService.reprioritizeBeatPairs(halvedStepPairs);
    const halvedStepPairGroups =
      this.analysisService.groupStepPairsByPattern(halvedStepPairs);

    let rotationDirection: "cw" | "ccw" | null = null;
    if (steps.length >= 4 && steps.length % 4 === 0) {
      rotationDirection =
        this.comparisonOrchestrator.detectRotationDirection(steps);
    }

    if (steps.length >= 4 && steps.length % 4 === 0) {
      const quarteredStepPairs =
        this.comparisonOrchestrator.generateQuarteredBeatPairs(steps);
      this.analysisService.reprioritizeBeatPairs(quarteredStepPairs);

      const qLen = Math.floor(steps.length / 4);
      if (qLen > 0 && this.quarteredMotionsConsistent(steps, qLen)) {
        const modularResult = this.detectModularQuarteredPattern(
          quarteredStepPairs,
          rotationDirection,
          polyrhythmic,
          layeredPath
        );
        if (modularResult) {
          this.enrichWithHalvedPrimitives(modularResult, halvedStepPairs);
          return modularResult;
        }
      }
    }

    return this.buildFallbackResult(
      halvedStepPairs,
      halvedStepPairGroups,
      polyrhythmic,
      layeredPath
    );
  }

  private buildFallbackResult(
    halvedStepPairs: InternalStepPair[],
    halvedStepPairGroups: Record<string, number[]>,
    polyrhythmic: PolyrhythmicLOOPResult,
    layeredPath: LayeredPathResult
  ): LOOPDetectionResult {
    const patternGroups = Object.keys(halvedStepPairGroups);
    const hasUnknown = patternGroups.some((p) => p === "UNKNOWN");
    const recognizedPatterns = patternGroups.filter((p) => p !== "UNKNOWN");

    const isModular = !hasUnknown && recognizedPatterns.length > 1;
    const isFreeform = hasUnknown || recognizedPatterns.length === 0;

    const axisAlternating = isModular
      ? this.analysisService.detectAxisAlternatingPattern(
          halvedStepPairs,
          halvedStepPairGroups
        )
      : null;

    return {
      loopType: null,
      components: [],
      transformationIntervals: {},
      rotationDirection: null,
      candidateDesignations: [],
      stepPairs: this.formattingService.toPublicStepPairs(halvedStepPairs),
      stepPairGroups: halvedStepPairGroups,
      isCircular: true,
      isFreeform,
      isModular,
      layeredPath,
      isLayeredPath: layeredPath.isLayeredPath,
      polyrhythmic,
      isPolyrhythmic: polyrhythmic.isPolyrhythmic,
      isAxisAlternating: axisAlternating !== null,
      axisAlternatingPattern: axisAlternating
        ? {
            isAxisAlternating: true,
            transformationFamily: axisAlternating.transformationFamily,
            metaPatternType: axisAlternating.metaPatternType,
            patternSequence: axisAlternating.patternSequence,
            description: axisAlternating.description,
          }
        : undefined,
      period: 1,
      componentsDetailed: [],
    };
  }

  private buildEmptyResult(
    isCircular: boolean,
    polyrhythmic: PolyrhythmicLOOPResult,
    layeredPath: LayeredPathResult
  ): LOOPDetectionResult {
    return {
      loopType: null,
      components: [],
      transformationIntervals: {},
      rotationDirection: null,
      candidateDesignations: [],
      stepPairs: [],
      stepPairGroups: {},
      isCircular,
      isFreeform: false,
      isModular: false,
      layeredPath,
      isLayeredPath: layeredPath.isLayeredPath,
      polyrhythmic,
      isPolyrhythmic: polyrhythmic.isPolyrhythmic,
      isAxisAlternating: false,
      period: 1,
      componentsDetailed: [],
    };
  }

  private buildFreeformResult(
    polyrhythmic: PolyrhythmicLOOPResult,
    layeredPath: LayeredPathResult
  ): LOOPDetectionResult {
    return {
      loopType: null,
      components: [],
      transformationIntervals: {},
      rotationDirection: null,
      candidateDesignations: [],
      stepPairs: [],
      stepPairGroups: {},
      isCircular: true,
      isFreeform: true,
      isModular: false,
      layeredPath,
      isLayeredPath: layeredPath.isLayeredPath,
      polyrhythmic,
      isPolyrhythmic: polyrhythmic.isPolyrhythmic,
      isAxisAlternating: false,
      period: 1,
      componentsDetailed: [],
    };
  }

  private detectModularQuarteredPattern(
    quarteredStepPairs: InternalStepPair[],
    rotationDirection: "cw" | "ccw" | null,
    polyrhythmic: PolyrhythmicLOOPResult,
    layeredPath: LayeredPathResult
  ): LOOPDetectionResult | null {
    const unknownCount = quarteredStepPairs.filter((pair) => {
      const primary = pair.detectedTransformations[0]?.toUpperCase() || "";
      return primary === "UNKNOWN" || primary === "";
    }).length;

    const unknownRate = unknownCount / quarteredStepPairs.length;
    if (unknownRate >= 0.5) {
      return null;
    }

    const detectedPrimaries = quarteredStepPairs.map(
      (pair) => pair.detectedTransformations[0]?.toUpperCase() || "UNKNOWN"
    );
    const uniqueDetected = new Set(detectedPrimaries);
    if (uniqueDetected.size === 1 && !uniqueDetected.has("UNKNOWN")) {
      return null;
    }

    const modularAnalysis = this.analysisService.detectModularPattern(
      quarteredStepPairs,
      4
    );

    if (!modularAnalysis?.isModular) {
      return null;
    }

    const modularPattern: ModularPattern = {
      isModular: true,
      baseTransformation: modularAnalysis.baseTransformation,
      swapRhythm: modularAnalysis.swapRhythm,
      swappedPositions: modularAnalysis.swappedPositions,
      description: modularAnalysis.description,
    };

    const components: ComponentId[] = [];
    if (modularAnalysis.baseTransformation) {
      const baseComponents = this.formattingService.deriveComponentsFromPattern(
        modularAnalysis.baseTransformation
      );
      components.push(...baseComponents);
    }
    if (
      modularAnalysis.swappedPositions.length > 0 &&
      !components.includes("swapped")
    ) {
      components.push("swapped");
    }
    if (
      modularAnalysis.columnBehaviors.some((c) => c.isInverted) &&
      !components.includes("inverted")
    ) {
      components.push("inverted");
    }
    if (
      modularAnalysis.columnBehaviors.some((c) => c.isMirrored) &&
      !components.includes("mirrored")
    ) {
      components.push("mirrored");
    }
    if (
      modularAnalysis.columnBehaviors.some((c) => c.isFlipped) &&
      !components.includes("flipped")
    ) {
      components.push("flipped");
    }

    const intervals: TransformationIntervals = {};
    if (components.includes("rotated")) intervals.rotation = 4;
    if (components.includes("swapped")) {
      intervals.swap = 4;
    }
    if (components.includes("inverted")) intervals.invert = 4;
    if (components.includes("mirrored")) intervals.mirror = 4;
    if (components.includes("flipped")) intervals.flip = 4;

    const rotDir =
      rotationDirection === "ccw"
        ? "_ccw"
        : rotationDirection === "cw"
          ? "_cw"
          : "";
    const loopType =
      modularAnalysis.swapRhythm !== "uniform"
        ? `modular_rotated_90${rotDir}_swap_${modularAnalysis.swapRhythm}`
        : `modular_rotated_90${rotDir}`;

    const binarySwapPattern = modularAnalysis.columnBehaviors
      .map((c) => (c.isSwapped ? "1" : "0"))
      .join("");

    const candidateLabel =
      modularAnalysis.swappedPositions.length > 0
        ? `MODULAR: Rotated 90° ${rotationDirection?.toUpperCase() || ""} + SWAPPED (${binarySwapPattern})`
        : `MODULAR: Rotated 90° ${rotationDirection?.toUpperCase() || ""}`;

    const quarteredGroups =
      this.analysisService.groupStepPairsByPattern(quarteredStepPairs);

    return {
      loopType,
      components,
      transformationIntervals: intervals,
      rotationDirection,
      candidateDesignations: [
        {
          components,
          loopType,
          transformationIntervals: intervals,
          label: candidateLabel,
          description: modularAnalysis.description,
          rotationDirection,
          confirmed: false,
          denied: false,
        },
      ],
      stepPairs: this.formattingService.toPublicStepPairs(quarteredStepPairs),
      stepPairGroups: quarteredGroups,
      isCircular: true,
      isFreeform: false,
      isModular: true,
      layeredPath,
      isLayeredPath: layeredPath.isLayeredPath,
      polyrhythmic,
      isPolyrhythmic: polyrhythmic.isPolyrhythmic,
      isAxisAlternating: false,
      modularPattern,
      period: periodFromIntervals(intervals, true),
      componentsDetailed: componentsToDetailed(components),
    };
  }

  private quarteredMotionsConsistent(
    steps: ExtractedStep[],
    quarterLength: number
  ): boolean {
    for (let offset = 0; offset < quarterLength; offset++) {
      let firstInverted: boolean | null = null;
      for (let q = 0; q < 4; q++) {
        const i = q * quarterLength + offset;
        const j = ((q + 1) % 4) * quarterLength + offset;
        const s1 = steps[i];
        const s2 = steps[j];
        if (!s1 || !s2) continue;
        const inverted =
          s1.blue.motionType !== s2.blue.motionType ||
          s1.red.motionType !== s2.red.motionType;
        if (firstInverted === null) {
          firstInverted = inverted;
        } else if (inverted !== firstInverted) {
          return false;
        }
      }
    }
    return true;
  }

  private enrichWithHalvedPrimitives(
    result: LOOPDetectionResult,
    halvedStepPairs: InternalStepPair[]
  ): void {
    if (halvedStepPairs.length === 0) return;

    const halvedPrimitives = ["inverted", "mirrored", "flipped", "swapped"] as const;
    for (const primitive of halvedPrimitives) {
      if (result.components.includes(primitive as ComponentId)) continue;
      const allHave = halvedStepPairs.every((pair) =>
        pair.rawTransformations.some((t) => t.includes(primitive))
      );
      if (allHave) {
        result.components.push(primitive as ComponentId);
        result.componentsDetailed.push({
          component: componentIdToLOOPComponent(primitive as ComponentId)!,
          domain: "location",
        });
        if (result.transformationIntervals) {
          if (primitive === "inverted") result.transformationIntervals.invert = 2;
          if (primitive === "mirrored") result.transformationIntervals.mirror = 2;
          if (primitive === "flipped") result.transformationIntervals.flip = 2;
          if (primitive === "swapped") result.transformationIntervals.swap = 2;
        }
      }
    }
  }
}

import { stepComparisonOrchestrator } from "./comparison/StepComparisonOrchestrator";
import { transformationAnalyzer } from "./TransformationAnalyzer";
import { candidateFormatter } from "./CandidateFormatter";
import { polyrhythmicDetector } from "./PolyrhythmicDetector";
import { layeredPathDetector } from "./LayeredPathDetector";
import type { LayeredPathResult } from "../contracts/types";
import type { TransformationAnalyzer } from "./TransformationAnalyzer";
import type { CandidateFormatter } from "./CandidateFormatter";
import type { LayeredPathDetector } from "./LayeredPathDetector";

export const loopDetector = new LOOPDetector(
  stepComparisonOrchestrator,
  transformationAnalyzer,
  candidateFormatter,
  polyrhythmicDetector,
  layeredPathDetector
);
