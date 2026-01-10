import type { IBeatComparisonOrchestrator } from "../../contracts/IBeatComparisonOrchestrator";
import type { IRotationComparer } from "../../contracts/IRotationComparer";
import type { IReflectionComparer } from "../../contracts/IReflectionComparer";
import type { ISwapInvertComparer } from "../../contracts/ISwapInvertComparer";
import type { ICandidateFormatter } from "../../contracts/ICandidateFormatter";
import type {
  ExtractedBeat,
  InternalBeatPair,
} from "../../../domain/models/internal-beat-models";
import type { SequenceEntry } from "../../../domain/models/sequence-models";
import {
  ROTATE_90_CCW,
  ROTATE_90_CW,
} from "../../../domain/constants/transformation-maps";

/**
 * Orchestrator that combines comparison services and manages beat pair generation.
 */
export class BeatComparisonOrchestrator implements IBeatComparisonOrchestrator {
  constructor(
    private rotationService: IRotationComparer,
    private reflectionService: IReflectionComparer,
    private swapInvertService: ISwapInvertComparer,
    private formattingService: ICandidateFormatter
  ) {}

  extractBeats(sequence: SequenceEntry): ExtractedBeat[] {
    const raw = sequence.fullMetadata?.sequence;
    if (!raw) return [];

    return raw
      .filter(
        (b): b is typeof b & { beat: number } =>
          typeof b.beat === "number" && b.beat >= 1
      )
      .map((b) => ({
        beatNumber: b.beat,
        letter: b.letter || "",
        startPos: b.startPos || "",
        endPos: b.endPos || "",
        blue: {
          startLoc: b.blueAttributes?.startLoc?.toLowerCase() || "",
          endLoc: b.blueAttributes?.endLoc?.toLowerCase() || "",
          motionType: b.blueAttributes?.motionType?.toLowerCase() || "",
          propRotDir: b.blueAttributes?.propRotDir?.toLowerCase() || "",
        },
        red: {
          startLoc: b.redAttributes?.startLoc?.toLowerCase() || "",
          endLoc: b.redAttributes?.endLoc?.toLowerCase() || "",
          motionType: b.redAttributes?.motionType?.toLowerCase() || "",
          propRotDir: b.redAttributes?.propRotDir?.toLowerCase() || "",
        },
      }));
  }

  compareBeatPair(beat1: ExtractedBeat, beat2: ExtractedBeat): string[] {
    const b1Blue = beat1.blue;
    const b1Red = beat1.red;
    const b2Blue = beat2.blue;
    const b2Red = beat2.red;

    if (
      !b1Blue?.startLoc ||
      !b2Blue?.startLoc ||
      !b1Red?.startLoc ||
      !b2Red?.startLoc
    ) {
      return [];
    }

    const allTransformations: string[] = [];

    // Check for repeated (identity)
    const repeated = this.swapInvertService.checkRepeated(
      b1Blue,
      b1Red,
      b2Blue,
      b2Red
    );
    allTransformations.push(...repeated.transformations);

    // Check rotations
    const rotations = this.rotationService.checkRotations(
      b1Blue,
      b1Red,
      b2Blue,
      b2Red
    );
    allTransformations.push(...rotations.transformations);

    // Check reflections
    const reflections = this.reflectionService.checkReflections(
      b1Blue,
      b1Red,
      b2Blue,
      b2Red
    );
    allTransformations.push(...reflections.transformations);

    // Check swap/invert
    const swapInvert = this.swapInvertService.checkSwapInvert(
      b1Blue,
      b1Red,
      b2Blue,
      b2Red
    );
    allTransformations.push(...swapInvert.transformations);

    return allTransformations;
  }

  generateHalvedBeatPairs(beats: ExtractedBeat[]): InternalBeatPair[] {
    if (beats.length < 2 || beats.length % 2 !== 0) return [];

    const halfLength = beats.length / 2;
    const beatPairs: InternalBeatPair[] = [];

    for (let i = 0; i < halfLength; i++) {
      const beat1 = beats[i]!;
      const beat2 = beats[halfLength + i]!;
      const rawTransformations = this.compareBeatPair(beat1, beat2);
      const { primary, all } =
        this.formattingService.formatBeatPairTransformations(
          rawTransformations
        );

      beatPairs.push({
        keyBeat: beat1.beatNumber,
        correspondingBeat: beat2.beatNumber,
        rawTransformations,
        detectedTransformations: primary.length > 0 ? primary : ["UNKNOWN"],
        allValidTransformations: all.length > 0 ? all : ["UNKNOWN"],
      });
    }

    return beatPairs;
  }

  generateQuarteredBeatPairs(beats: ExtractedBeat[]): InternalBeatPair[] {
    if (beats.length < 4 || beats.length % 4 !== 0) return [];

    const quarterLength = beats.length / 4;
    const beatPairs: InternalBeatPair[] = [];

    // Loop through ALL beats to include wrap-around
    for (let i = 0; i < beats.length; i++) {
      const beat1 = beats[i]!;
      const beat2 = beats[(i + quarterLength) % beats.length]!;
      const rawTransformations = this.compareBeatPair(beat1, beat2);
      const { primary, all } =
        this.formattingService.formatBeatPairTransformations(
          rawTransformations
        );

      beatPairs.push({
        keyBeat: beat1.beatNumber,
        correspondingBeat: beat2.beatNumber,
        rawTransformations,
        detectedTransformations: primary.length > 0 ? primary : ["UNKNOWN"],
        allValidTransformations: all.length > 0 ? all : ["UNKNOWN"],
      });
    }

    return beatPairs;
  }

  detectRotationDirection(beats: ExtractedBeat[]): "cw" | "ccw" | null {
    if (beats.length < 4 || beats.length % 4 !== 0) return null;

    const quarterLength = beats.length / 4;
    const b0 = beats[0];
    const b1 = beats[quarterLength];
    const b2 = beats[quarterLength * 2];
    const b3 = beats[quarterLength * 3];

    if (!b0 || !b1 || !b2 || !b3) return null;

    const quarterBeats = [b0, b1, b2, b3];
    const blueStartLocs = quarterBeats.map((b) => b.blue?.startLoc);

    let ccwMatches = 0;
    let cwMatches = 0;

    for (let i = 0; i < 4; i++) {
      const current = blueStartLocs[i];
      const next = blueStartLocs[(i + 1) % 4];
      if (!current || !next) continue;

      if (ROTATE_90_CCW[current] === next) ccwMatches++;
      if (ROTATE_90_CW[current] === next) cwMatches++;
    }

    if (ccwMatches > cwMatches && ccwMatches >= 2) return "ccw";
    if (cwMatches > ccwMatches && cwMatches >= 2) return "cw";

    return null;
  }
}
