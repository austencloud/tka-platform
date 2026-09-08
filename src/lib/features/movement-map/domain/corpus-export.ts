/**
 * Turns the annotation corpus into a file that survives this codebase.
 *
 * The export carries the vocabulary alongside the annotations. A file of raw
 * value ids ("belowShoulder", "ulnar") is unreadable to anything that does not
 * already have this repository, and the whole point of the corpus is to feed a
 * training or validation system later - possibly one that is not this app. With
 * the dimension list embedded, the file explains its own terms.
 *
 * The Level 1 space travels with it too, so a consumer can tell the difference
 * between "this movement was observed and nothing notable happened" and "this
 * movement was never looked at". That distinction is invisible in a bare list of
 * annotations and it is exactly what a validation run against motion-capture
 * data needs to know.
 */

import {
  ALL_DIMENSIONS,
  describeValue,
  type AnatomyDimension,
} from "./anatomy-vocabulary";
import {
  describeSignature,
  type AnatomyReading,
  type MovementAnnotation,
} from "./movement-annotation";
import type { LevelOneSpace } from "./level-one-space";
import type { CoverageReport } from "./annotation-coverage";

export const CORPUS_FORMAT_VERSION = 1;

export interface CorpusExport {
  readonly format: "tka-movement-map";
  readonly version: number;
  readonly exportedAt: string;
  readonly level: 1;
  readonly vocabulary: readonly AnatomyDimension[];
  readonly space: {
    readonly total: number;
    readonly movements: readonly {
      readonly key: string;
      readonly description: string;
      readonly letters: readonly string[];
      readonly status: string;
      readonly observedPhases: readonly string[];
    }[];
  };
  readonly summary: {
    readonly annotations: number;
    readonly mapped: number;
    readonly partial: number;
    readonly unseen: number;
  };
  readonly annotations: readonly ExportedAnnotation[];
}

/**
 * An annotation with its readings spelled out. The ids stay for machine use and
 * the labels sit beside them so a human opening the file can read it directly.
 */
export interface ExportedAnnotation extends MovementAnnotation {
  readonly readable: {
    readonly left: Record<string, string>;
    readonly right: Record<string, string>;
    readonly body: Record<string, string>;
    readonly leftMovement: string | null;
    readonly rightMovement: string | null;
  };
}

function readableReading(reading: AnatomyReading): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [dimensionId, valueId] of Object.entries(reading)) {
    out[dimensionId] = describeValue(dimensionId, valueId);
  }
  return out;
}

export function buildCorpusExport(
  annotations: readonly MovementAnnotation[],
  space: LevelOneSpace,
  coverage: CoverageReport
): CorpusExport {
  return {
    format: "tka-movement-map",
    version: CORPUS_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    level: 1,
    vocabulary: ALL_DIMENSIONS,
    space: {
      total: space.movements.length,
      movements: space.movements.map((movement) => {
        const entry = coverage.byKey.get(movement.key);
        return {
          key: movement.key,
          description: describeSignature(movement.signature),
          letters: movement.letters,
          status: entry?.status ?? "unseen",
          observedPhases: [...(entry?.anchors ?? [])].sort(),
        };
      }),
    },
    summary: {
      annotations: annotations.length,
      mapped: coverage.mapped,
      partial: coverage.partial,
      unseen: coverage.unseen,
    },
    annotations: annotations.map((annotation) => ({
      ...annotation,
      readable: {
        left: readableReading(annotation.left),
        right: readableReading(annotation.right),
        body: readableReading(annotation.body),
        leftMovement: annotation.leftSignature
          ? describeSignature(annotation.leftSignature)
          : null,
        rightMovement: annotation.rightSignature
          ? describeSignature(annotation.rightSignature)
          : null,
      },
    })),
  };
}

export function corpusFilename(): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `tka-movement-map-level1-${stamp}.json`;
}

/**
 * Reads a previously exported file back. Only the annotations are taken: the
 * vocabulary and space in the file describe the export's moment, while the
 * running app should use its own current ones.
 */
export function parseCorpusImport(text: string): MovementAnnotation[] {
  const parsed: unknown = JSON.parse(text);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as CorpusExport).annotations)
  ) {
    throw new Error("That file is not a movement map export.");
  }

  return (parsed as CorpusExport).annotations.map((annotation) => {
    const { readable: _readable, ...rest } = annotation as ExportedAnnotation;
    return rest as MovementAnnotation;
  });
}
