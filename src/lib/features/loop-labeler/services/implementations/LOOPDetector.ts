import type { SequenceEntry } from "../../domain/models/sequence-models";
import type {
  ILOOPDetector,
  LOOPDetectionResult,
  CompoundPattern,
  ModularPattern,
} from "../contracts/ILOOPDetector";
import type { TransformationIntervals } from "../../domain/models/label-models";
import type { IStepComparisonOrchestrator } from "../contracts/IStepComparisonOrchestrator";
import type { ITransformationAnalyzer } from "../contracts/ITransformationAnalyzer";
import type { ICandidateFormatter } from "../contracts/ICandidateFormatter";
import type {
  IPolyrhythmicDetector,
  PolyrhythmicLOOPResult,
} from "../contracts/IPolyrhythmicDetector";
import type {
  ILayeredPathDetector,
  LayeredPathResult,
} from "../contracts/ILayeredPathDetector";
import type {
  InternalStepPair,
  CandidateInfo,
  ExtractedStep,
} from "../../domain/models/internal-step-models";
import type { ComponentId } from "../../domain/constants/loop-components";
import {
  LOOPComponent,
  type DetectedComponent,
  type LOOPDomain,
} from "$lib/features/create/generate/shared/domain/models/generate-models";
import { loopOrientationDetector } from "./LOOPOrientationDetector";

/**
 * Map a legacy ComponentId string to the LOOPComponent enum, or null when the
 * id (e.g., "modular", "repeated") has no enum equivalent. Phase 3 replaces
 * this with a domain-aware detector; Phase 1 uses it only to populate the
 * new `componentsDetailed` field conservatively.
 */
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

/**
 * Combine location and orientation domain component arrays.
 *
 * Merge semantics: when the same LOOPComponent appears in both domains, the
 * result has `domain: "both"`. Otherwise each component keeps its originating
 * domain. Reserved primitives from either side flow through unchanged -
 * consumer resolvers strip them via RESERVED_ORIENTATION_PRIMITIVES.
 */
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

/**
 * Service for detecting Linked Orbital Offset Patterns (LOOPs) in sequences.
 * Orchestrates the detection process using specialized services.
 */
export class LOOPDetector implements ILOOPDetector {
  constructor(
    private comparisonOrchestrator: IStepComparisonOrchestrator,
    private analysisService: ITransformationAnalyzer,
    private formattingService: ICandidateFormatter,
    private polyrhythmicService?: IPolyrhythmicDetector,
    private layeredPathService?: ILayeredPathDetector
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

  /**
   * Augment a location-only detection result with the orientation pass.
   *
   * Runs the orientation detector, merges components, lifts `period` to
   * max(location, orientation). Called as a post-pass so every existing
   * builder return path gets orientation-aware without being rewritten.
   */
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

    // Run polyrhythmic detection (legacy)
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

    // Run layered path detection (new parent category)
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

    // Non-circular or too short
    if (!circular || steps.length < 2) {
      return this.buildEmptyResult(circular, polyrhythmic, layeredPath);
    }

    // Must have even number of steps
    if (steps.length % 2 !== 0) {
      return this.buildFreeformResult(polyrhythmic, layeredPath);
    }

    // Generate halved beat pairs (always needed)
    const halvedStepPairs =
      this.comparisonOrchestrator.generateHalvedBeatPairs(steps);
    this.analysisService.reprioritizeBeatPairs(halvedStepPairs);
    const halvedStepPairGroups =
      this.analysisService.groupStepPairsByPattern(halvedStepPairs);

    // Detect rotation direction for quartered sequences
    let rotationDirection: "cw" | "ccw" | null = null;
    if (steps.length >= 4 && steps.length % 4 === 0) {
      rotationDirection =
        this.comparisonOrchestrator.detectRotationDirection(steps);
    }

    // Try quartered detection first (90° rotations)
    if (steps.length >= 4 && steps.length % 4 === 0) {
      const quarteredResult = this.detectQuarteredPattern(
        steps,
        halvedStepPairs,
        rotationDirection,
        polyrhythmic,
        layeredPath
      );
      if (quarteredResult) {
        return quarteredResult;
      }
    }

    // Try halved detection (180° transformations)
    const halvedResult = this.detectHalvedPattern(
      halvedStepPairs,
      halvedStepPairGroups,
      rotationDirection,
      polyrhythmic,
      layeredPath
    );
    if (halvedResult) {
      return halvedResult;
    }

    // Fallback: modular or freeform
    return this.buildFallbackResult(
      halvedStepPairs,
      halvedStepPairGroups,
      polyrhythmic,
      layeredPath
    );
  }

  private detectQuarteredPattern(
    steps: ReturnType<IStepComparisonOrchestrator["extractBeats"]>,
    halvedStepPairs: InternalStepPair[],
    rotationDirection: "cw" | "ccw" | null,
    polyrhythmic: PolyrhythmicLOOPResult,
    layeredPath: LayeredPathResult
  ): LOOPDetectionResult | null {
    const quarteredStepPairs =
      this.comparisonOrchestrator.generateQuarteredBeatPairs(steps);
    this.analysisService.reprioritizeBeatPairs(quarteredStepPairs);
    const allQuarteredCommon =
      this.analysisService.findAllCommonTransformations(quarteredStepPairs);

    // Extract all components found at quartered level (rotation, mirror,
    // swap, flip, invert, etc.) instead of filtering to rotation-only.
    const quarteredComponents: ComponentId[] = [];
    let hasRotation90 = false;

    for (const t of allQuarteredCommon) {
      if (
        t.includes("rotated_90") ||
        t.includes("90_ccw") ||
        t.includes("90_cw")
      ) {
        hasRotation90 = true;
      }
      const derived = this.formattingService.deriveComponentsFromPattern(t);
      for (const c of derived) {
        if (!quarteredComponents.includes(c)) quarteredComponents.push(c);
      }
    }

    // Guard: rotation-specific motion consistency check.
    // If 90° rotation detected but motions differ between quartered pairs,
    // drop rotation from quartered components (false positive). Example:
    // EΨDΨDΨEΨ has 90° position rotation between beats (1,3) but beat 1
    // is anti and beat 3 is pro — the motions change, so the rotation
    // component is spurious. Other components found at quartered level survive.
    if (hasRotation90) {
      const quarterLength = Math.floor(steps.length / 4);
      if (
        quarterLength > 0 &&
        !this.quarteredMotionsConsistent(steps, quarterLength)
      ) {
        const rotIdx = quarteredComponents.indexOf("rotated");
        if (rotIdx >= 0) quarteredComponents.splice(rotIdx, 1);
        hasRotation90 = false;
      }
    }

    // Check for compound patterns if no quartered components found
    let compoundPattern: CompoundPattern | undefined;
    const halvedOnlyTransformations: string[] = [];
    // Keep the raw rotation patterns for compound detection / candidate building
    const rotation90Patterns = allQuarteredCommon.filter(
      (t) =>
        t.includes("rotated_90") || t.includes("90_ccw") || t.includes("90_cw")
    );

    if (quarteredComponents.length === 0) {
      const compoundResult = this.detectCompoundPattern(
        quarteredStepPairs,
        halvedStepPairs,
        rotationDirection
      );
      if (compoundResult) {
        // Compound detection found rotation patterns — fold them in
        for (const t of compoundResult.rotation90Patterns) {
          const derived =
            this.formattingService.deriveComponentsFromPattern(t);
          for (const c of derived) {
            if (!quarteredComponents.includes(c)) quarteredComponents.push(c);
          }
        }
        if (compoundResult.rotation90Patterns.length > 0) {
          hasRotation90 = true;
        }
        compoundPattern = compoundResult.compoundPattern;
        halvedOnlyTransformations.push(
          ...compoundResult.halvedOnlyTransformations
        );
      }
    }

    // Try modular detection if no uniform pattern found — but only if
    // motions are consistent across quarters (the same guard that rejects
    // false-positive uniform quartered also applies to modular quartered).
    if (quarteredComponents.length === 0) {
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
      return null;
    }

    // Build candidates
    const allCandidates = compoundPattern
      ? this.buildCompoundCandidates(
          compoundPattern,
          halvedOnlyTransformations,
          rotationDirection
        )
      : this.formattingService.buildCandidateDesignations(
          allQuarteredCommon,
          4,
          rotationDirection
        );

    // Use quarteredComponents directly — already extracted from all
    // quartered-common patterns above (not just the primary pattern).
    const derivedComponents = [...quarteredComponents];

    // Add halved-only components for compound patterns
    if (compoundPattern) {
      halvedOnlyTransformations.forEach((c) => {
        if (!derivedComponents.includes(c as ComponentId)) {
          derivedComponents.push(c as ComponentId);
        }
      });
    }

    if (derivedComponents.length === 0) {
      return null;
    }

    // Derive rotation direction from the first rotation pattern (if any),
    // falling back to the caller-supplied direction.
    const firstRotationPattern = allQuarteredCommon.find(
      (t) =>
        t.includes("rotated_90") || t.includes("90_ccw") || t.includes("90_cw")
    );
    const derivedDirection =
      (firstRotationPattern
        ? this.formattingService.extractRotationDirection(firstRotationPattern)
        : null) || rotationDirection;
    const derivedIntervals = this.buildQuarteredIntervals(
      derivedComponents,
      compoundPattern?.halvedTransformations
    );

    // Build loopType — append _90 suffix only when rotation is present
    // (the _90 indicates period-4 rotation; non-rotation quartered
    // components like swap/mirror don't need it).
    const loopType = compoundPattern
      ? this.buildCompoundLoopType(
          derivedDirection,
          compoundPattern.halvedTransformations
        )
      : derivedComponents.sort().join("_") + (hasRotation90 ? "_90" : "");

    // Combine beat pairs for compound patterns
    const combinedBeatPairs = compoundPattern
      ? [
          ...this.formattingService.toPublicStepPairs(quarteredStepPairs),
          ...this.formattingService.toPublicStepPairs(halvedStepPairs),
        ]
      : this.formattingService.toPublicStepPairs(quarteredStepPairs);

    const combinedGroups = compoundPattern
      ? {
          ...this.analysisService.groupStepPairsByPattern(quarteredStepPairs),
          "HALVED (180°)": halvedStepPairs.map((p) => p.keyStep),
        }
      : this.analysisService.groupStepPairsByPattern(quarteredStepPairs);

    const quarteredResult: LOOPDetectionResult = {
      loopType,
      components: derivedComponents,
      transformationIntervals: derivedIntervals,
      rotationDirection: derivedDirection,
      candidateDesignations: allCandidates.map((c) =>
        this.formattingService.toCandidateDesignation(c)
      ),
      stepPairs: combinedBeatPairs,
      stepPairGroups: combinedGroups,
      isCircular: true,
      isFreeform: false,
      isModular: false,
      layeredPath,
      isLayeredPath: layeredPath.isLayeredPath,
      polyrhythmic,
      isPolyrhythmic: polyrhythmic.isPolyrhythmic,
      compoundPattern,
      isAxisAlternating: false,
      period: periodFromIntervals(derivedIntervals, true),
      componentsDetailed: componentsToDetailed(derivedComponents),
    };
    // Enrich with halved-level primitives not captured by quartered analysis
    this.enrichWithHalvedPrimitives(quarteredResult, halvedStepPairs);
    return quarteredResult;
  }

  private detectCompoundPattern(
    quarteredStepPairs: InternalStepPair[],
    halvedStepPairs: InternalStepPair[],
    rotationDirection: "cw" | "ccw" | null
  ): {
    rotation90Patterns: string[];
    compoundPattern: CompoundPattern;
    halvedOnlyTransformations: string[];
  } | null {
    // Check if ALL quartered pairs have some form of 90° rotation
    const pairsWithRotation = quarteredStepPairs.filter((pair) =>
      pair.rawTransformations.some(
        (t) =>
          t.includes("rotated_90") ||
          t.includes("90_ccw") ||
          t.includes("90_cw")
      )
    );

    if (pairsWithRotation.length !== quarteredStepPairs.length) {
      return null;
    }

    // CRITICAL: Check if ALL pairs have the SAME primary transformation
    // If different pairs have different patterns (e.g., some swapped, some not),
    // this is NOT a compound pattern - it's a MODULAR pattern
    const primaryPatterns = quarteredStepPairs.map(
      (pair) => pair.detectedTransformations[0] || ""
    );
    const uniquePrimaries = [...new Set(primaryPatterns)];

    // If we have more than 2 distinct patterns among quartered pairs, it's modular, not compound
    // (Allow 2 for cases where some pairs are ambiguous between base and inverted)
    if (uniquePrimaries.length > 2) {
      return null;
    }

    // Check if the patterns differ by swap status - if so, it's modular
    const hasSwappedPairs = primaryPatterns.some((p) =>
      p.toLowerCase().includes("swapped")
    );
    const hasNonSwappedPairs = primaryPatterns.some(
      (p) =>
        p.toLowerCase().includes("rotated") &&
        !p.toLowerCase().includes("swapped")
    );

    if (hasSwappedPairs && hasNonSwappedPairs) {
      // Different swap status among quartered pairs = MODULAR, not compound
      return null;
    }

    // Check if halved pairs have swap
    const halvedHasSwap =
      halvedStepPairs.length > 0 &&
      halvedStepPairs.every((pair) =>
        pair.rawTransformations.some((t) => t.includes("swapped"))
      );

    if (!halvedHasSwap) {
      return null;
    }

    // Extract rotation patterns
    const anyPair = quarteredStepPairs[0];
    if (!anyPair) return null;

    const rotationTransforms = anyPair.rawTransformations.filter(
      (t) =>
        t.includes("rotated_90") || t.includes("90_ccw") || t.includes("90_cw")
    );

    const rotation90Patterns = [
      ...new Set(
        rotationTransforms.map((t) =>
          t.replace(/_swapped$/, "").replace(/_swapped_inverted$/, "_inverted")
        )
      ),
    ];

    // Detect ALL halved-level components, not just swapped. A compound
    // pattern can layer swapped + inverted + mirrored + flipped at 180°
    // on top of a 90° rotation.
    const halvedOnlyTransformations = ["swapped"];
    const halvedPrimitives = ["inverted", "mirrored", "flipped"] as const;
    for (const primitive of halvedPrimitives) {
      const allHave = halvedStepPairs.every((pair) =>
        pair.rawTransformations.some((t) => t.includes(primitive))
      );
      if (allHave) {
        halvedOnlyTransformations.push(primitive);
      }
    }

    const rotationDesc =
      rotationDirection === "ccw"
        ? "90° CCW Rotated"
        : rotationDirection === "cw"
          ? "90° CW Rotated"
          : "90° Rotated";
    const halvedDesc = halvedOnlyTransformations
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
      .join(" + ");

    const compoundPattern: CompoundPattern = {
      isCompound: true,
      quarteredTransformations: ["rotated"],
      halvedTransformations: halvedOnlyTransformations,
      description: `${rotationDesc} + ${halvedDesc} (180°)`,
    };

    return { rotation90Patterns, compoundPattern, halvedOnlyTransformations };
  }

  private detectHalvedPattern(
    halvedStepPairs: InternalStepPair[],
    halvedStepPairGroups: Record<string, number[]>,
    rotationDirection: "cw" | "ccw" | null,
    polyrhythmic: PolyrhythmicLOOPResult,
    layeredPath: LayeredPathResult
  ): LOOPDetectionResult | null {
    const allHalvedCommon =
      this.analysisService.findAllCommonTransformations(halvedStepPairs);

    if (allHalvedCommon.length === 0) {
      return null;
    }

    const candidateInfos = this.formattingService.buildCandidateDesignations(
      allHalvedCommon,
      2,
      rotationDirection
    );
    const commonTransformation = allHalvedCommon[0]!;
    const derivedComponents =
      this.formattingService.deriveComponentsFromPattern(commonTransformation);

    if (derivedComponents.length === 0) {
      return null;
    }

    const derivedIntervals: TransformationIntervals = {};
    if (derivedComponents.includes("inverted")) derivedIntervals.invert = 2;
    if (derivedComponents.includes("rotated")) derivedIntervals.rotation = 2;
    if (derivedComponents.includes("swapped")) derivedIntervals.swap = 2;
    if (derivedComponents.includes("mirrored")) derivedIntervals.mirror = 2;
    if (derivedComponents.includes("flipped")) derivedIntervals.flip = 2;

    return {
      loopType: derivedComponents.sort().join("_"),
      components: derivedComponents,
      transformationIntervals: derivedIntervals,
      rotationDirection,
      candidateDesignations: candidateInfos.map((c) =>
        this.formattingService.toCandidateDesignation(c)
      ),
      stepPairs: this.formattingService.toPublicStepPairs(halvedStepPairs),
      stepPairGroups: halvedStepPairGroups,
      isCircular: true,
      isFreeform: false,
      isModular: false,
      layeredPath,
      isLayeredPath: layeredPath.isLayeredPath,
      polyrhythmic,
      isPolyrhythmic: polyrhythmic.isPolyrhythmic,
      isAxisAlternating: false,
      period: periodFromIntervals(derivedIntervals, true),
      componentsDetailed: componentsToDetailed(derivedComponents),
    };
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

    // Check for axis-alternating pattern when modular
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

  private buildCompoundCandidates(
    compoundPattern: CompoundPattern,
    halvedOnlyTransformations: string[],
    rotationDirection: "cw" | "ccw" | null
  ): CandidateInfo[] {
    const compoundIntervals: TransformationIntervals = {
      rotation: 4,
    };
    if (halvedOnlyTransformations.includes("swapped"))
      compoundIntervals.swap = 2;
    if (halvedOnlyTransformations.includes("inverted"))
      compoundIntervals.invert = 2;

    const rotDir =
      rotationDirection === "ccw"
        ? "_ccw"
        : rotationDirection === "cw"
          ? "_cw"
          : "";
    const halvedPart = halvedOnlyTransformations
      .map((t) => `${t}_180`)
      .join("_");
    const loopTypeLabel = `rotated_90${rotDir}_${halvedPart}`.toUpperCase();

    return [
      {
        transformation: "compound",
        description: compoundPattern.description,
        components: [
          ...compoundPattern.quarteredTransformations,
          ...halvedOnlyTransformations,
        ] as ComponentId[],
        intervals: compoundIntervals,
        rotationDirection,
        label: loopTypeLabel,
      },
    ];
  }

  private buildQuarteredIntervals(
    components: ComponentId[],
    halvedTransformations?: string[]
  ): TransformationIntervals {
    const intervals: TransformationIntervals = {};
    if (components.includes("rotated")) intervals.rotation = 4;

    if (halvedTransformations?.includes("swapped")) {
      intervals.swap = 2;
    } else if (components.includes("swapped")) {
      intervals.swap = 4;
    }

    if (halvedTransformations?.includes("inverted")) {
      intervals.invert = 2;
    } else if (components.includes("inverted")) {
      intervals.invert = 4;
    }

    if (components.includes("mirrored")) intervals.mirror = 4;
    return intervals;
  }

  private buildCompoundLoopType(
    direction: "cw" | "ccw" | null,
    halvedTransformations: string[]
  ): string {
    const rotDir =
      direction === "ccw" ? "_ccw" : direction === "cw" ? "_cw" : "";
    const halvedPart = halvedTransformations.map((t) => `${t}_180`).join("_");
    return `rotated_90${rotDir}_${halvedPart}`;
  }

  private detectModularQuarteredPattern(
    quarteredStepPairs: InternalStepPair[],
    rotationDirection: "cw" | "ccw" | null,
    polyrhythmic: PolyrhythmicLOOPResult,
    layeredPath: LayeredPathResult
  ): LOOPDetectionResult | null {
    // Check for high UNKNOWN rate - if too many beat pairs are unknown, this isn't modular
    const unknownCount = quarteredStepPairs.filter((pair) => {
      const primary = pair.detectedTransformations[0]?.toUpperCase() || "";
      return primary === "UNKNOWN" || primary === "";
    }).length;

    const unknownRate = unknownCount / quarteredStepPairs.length;
    if (unknownRate >= 0.5) {
      // 50% or more UNKNOWN = not a modular pattern, let fallback handle as freeform
      return null;
    }

    // Check if all beat pairs have the SAME detected transformation
    // If so, this is UNIFORM, not modular - let halved detection handle it
    const detectedPrimaries = quarteredStepPairs.map(
      (pair) => pair.detectedTransformations[0]?.toUpperCase() || "UNKNOWN"
    );
    const uniqueDetected = new Set(detectedPrimaries);
    if (uniqueDetected.size === 1 && !uniqueDetected.has("UNKNOWN")) {
      // All beat pairs have the same transformation - this is uniform, not modular
      return null;
    }

    // Use 4 columns for quartered patterns (positions 1,2,3,4 within each quarter)
    const modularAnalysis = this.analysisService.detectModularPattern(
      quarteredStepPairs,
      4
    );

    if (!modularAnalysis?.isModular) {
      return null;
    }

    // Build modular pattern description
    const modularPattern: ModularPattern = {
      isModular: true,
      baseTransformation: modularAnalysis.baseTransformation,
      swapRhythm: modularAnalysis.swapRhythm,
      swappedPositions: modularAnalysis.swappedPositions,
      description: modularAnalysis.description,
    };

    // Derive components from the base transformation and swap info
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

    // Build intervals - base is quartered, swap is also quartered for modular patterns
    const intervals: TransformationIntervals = {};
    if (components.includes("rotated")) intervals.rotation = 4;
    if (components.includes("swapped")) {
      intervals.swap = 4;
    }

    // Build loopType
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

    // Build candidate designation with binary swap pattern
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

  /**
   * Check halved step pairs for 180°-level primitives (inverted, mirrored,
   * flipped) and add them to an existing detection result. This handles
   * compound patterns where a quartered rotation has additional transformations
   * at the halved level that the quartered-only analysis missed.
   */
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

    const halvedPrimitives = ["inverted", "mirrored", "flipped"] as const;
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
        }
      }
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================

import { stepComparisonOrchestrator } from "./comparison/StepComparisonOrchestrator";
import { transformationAnalyzer } from "./TransformationAnalyzer";
import { candidateFormatter } from "./CandidateFormatter";
import { polyrhythmicDetector } from "./PolyrhythmicDetector";
import { layeredPathDetector } from "./LayeredPathDetector";

export const loopDetector = new LOOPDetector(
  stepComparisonOrchestrator,
  transformationAnalyzer,
  candidateFormatter,
  polyrhythmicDetector,
  layeredPathDetector
);
