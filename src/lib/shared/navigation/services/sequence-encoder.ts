import { compressForURL, decompressFromURL, compressForQR, decompressFromQR } from "./sequence-codec";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import { createStartPositionData } from "$lib/shared/foundation/domain/factories/createStartPositionData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type {
  MotionColor} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { ArrowPlacementData } from "$lib/shared/pictograph/arrow/positioning/placement/domain/ArrowPlacementData";
import type { PropPlacementData } from "$lib/shared/pictograph/prop/domain/models/PropPlacementData";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { CompressionResult, ShareURLResult, ShareURLMetadata, DeepLinkParseResult, QRSizeEstimate, SequenceRouteIdParseResult, URLPropOptions } from "./types";
import { calculateEndOrientation } from "$lib/shared/render/core/calculations/orientation";

const LOCATION_ENCODE: Record<GridLocation, string> = {
  [GridLocation.NORTH]: "no",
  [GridLocation.EAST]: "ea",
  [GridLocation.SOUTH]: "so",
  [GridLocation.WEST]: "we",
  [GridLocation.NORTHEAST]: "ne",
  [GridLocation.SOUTHEAST]: "se",
  [GridLocation.SOUTHWEST]: "sw",
  [GridLocation.NORTHWEST]: "nw",
  [GridLocation.CENTER]: "c",
};

const LOCATION_DECODE: Record<string, GridLocation> = Object.fromEntries(
  Object.entries(LOCATION_ENCODE).map(([k, v]) => [v, k as GridLocation])
);

const ORIENTATION_ENCODE: Record<Orientation, string> = {
  [Orientation.IN]: "i",
  [Orientation.OUT]: "o",
  [Orientation.CLOCK]: "k",
  [Orientation.COUNTER]: "t",
  [Orientation.CLOCK_IN]: "I",
  [Orientation.CLOCK_OUT]: "O",
  [Orientation.COUNTER_IN]: "N",
  [Orientation.COUNTER_OUT]: "U",
  [Orientation.CENTER_N]: "1",
  [Orientation.CENTER_NE]: "2",
  [Orientation.CENTER_E]: "3",
  [Orientation.CENTER_SE]: "4",
  [Orientation.CENTER_S]: "5",
  [Orientation.CENTER_SW]: "6",
  [Orientation.CENTER_W]: "7",
  [Orientation.CENTER_NW]: "8",
};

const ORIENTATION_DECODE: Record<string, Orientation> = Object.fromEntries(
  Object.entries(ORIENTATION_ENCODE).map(([k, v]) => [v, k as Orientation])
);

const ROTATION_ENCODE: Record<RotationDirection, string> = {
  [RotationDirection.CLOCKWISE]: "c",
  [RotationDirection.COUNTER_CLOCKWISE]: "u",
  [RotationDirection.NO_ROTATION]: "x",
};

const ROTATION_DECODE: Record<string, RotationDirection> = Object.fromEntries(
  Object.entries(ROTATION_ENCODE).map(([k, v]) => [v, k as RotationDirection])
);

const MOTION_TYPE_ENCODE: Record<MotionType, string> = {
  [MotionType.PRO]: "p",
  [MotionType.ANTI]: "a",
  [MotionType.FLOAT]: "l",
  [MotionType.DASH]: "d",
  [MotionType.STATIC]: "s",
};

const MOTION_TYPE_DECODE: Record<string, MotionType> = Object.fromEntries(
  Object.entries(MOTION_TYPE_ENCODE).map(([k, v]) => [v, k as MotionType])
);

const PROP_TYPE_ENCODE: Record<PropType, string> = {
  [PropType.STAFF]: "S",
  [PropType.SIMPLESTAFF]: "s",
  [PropType.BIGSTAFF]: "1",
  [PropType.STAFF2]: "2",
  [PropType.CLUB]: "C",
  [PropType.BIGCLUB]: "c",
  [PropType.FAN]: "F",
  [PropType.BIGFAN]: "f",
  [PropType.TRIAD]: "T",
  [PropType.BIGTRIAD]: "t",
  [PropType.MINIHOOP]: "M",
  [PropType.BIGHOOP]: "H",
  [PropType.BUUGENG]: "B",
  [PropType.BIGBUUGENG]: "b",
  [PropType.FRACTALGENG]: "R",
  [PropType.TRIGENG]: "J",
  [PropType.HAND]: "X",
  [PropType.TRIQUETRA]: "Q",
  [PropType.TRIQUETRA2]: "q",
  [PropType.SWORD]: "W",
  [PropType.CHICKEN]: "K",
  [PropType.BIGCHICKEN]: "k",
  [PropType.GUITAR]: "G",
  [PropType.UKULELE]: "u",
  [PropType.DOUBLESTAR]: "D",
  [PropType.BIGDOUBLESTAR]: "d",
  [PropType.EIGHTRINGS]: "E",
  [PropType.BIGEIGHTRINGS]: "e",
  [PropType.CONTACTBALL]: "A",
  [PropType.BIGCONTACTBALL]: "a",
  [PropType.DOUBLECONTACTBALL]: "V",
  [PropType.BIGDOUBLECONTACTBALL]: "v",
  [PropType.QUIAD]: "I",
  [PropType.TORCH]: "O",
  [PropType.BIGTORCH]: "L",
  [PropType.POI]: "P",
};

const PROP_TYPE_DECODE: Record<string, PropType> = Object.fromEntries(
  Object.entries(PROP_TYPE_ENCODE).map(([k, v]) => [v, k as PropType])
) as Record<string, PropType>;

const INLINE_PREFIX = "s~";

// ============================================================================
// PRIVATE HELPERS
// ============================================================================


function encodeMotion(motion: MotionData | undefined, formatVersion: 1 | 2 | 3 = 3): string {
  if (!motion) return "";

  const startLoc = LOCATION_ENCODE[motion.startLocation];
  const endLoc = LOCATION_ENCODE[motion.endLocation];
  const startOrient = ORIENTATION_ENCODE[motion.startOrientation];
  const endOrient = ORIENTATION_ENCODE[motion.endOrientation];
  const normalizedRotDir =
    motion.rotationDirection === ("no_rotation" as RotationDirection)
      ? RotationDirection.NO_ROTATION
      : motion.rotationDirection;
  const rotation =
    ROTATION_ENCODE[normalizedRotDir] ??
    (motion.motionType === "static" || motion.motionType === "dash"
      ? ROTATION_ENCODE[RotationDirection.NO_ROTATION]
      : undefined);
  const turns = motion.turns === "fl" ? "f" : String(motion.turns);
  const type = MOTION_TYPE_ENCODE[motion.motionType];
  const prop = PROP_TYPE_ENCODE[motion.propType] ?? PROP_TYPE_ENCODE[PropType.STAFF];

  // v2 derives endOrientation on decode; v3 additionally chains startOrientation
  // from the previous beat (carried as a per-sequence seed header), so neither
  // orientation is required to encode in v3.
  const startOrientRequired = formatVersion !== 3;
  const endOrientRequired = formatVersion === 1;
  if (
    !startLoc || !endLoc ||
    (startOrientRequired && !startOrient) ||
    (endOrientRequired && !endOrient) ||
    !rotation || !type || !prop
  ) {
    console.error("❌ URL Encoder: Motion has missing required fields!", {
      hasStartLoc: !!startLoc,
      hasEndLoc: !!endLoc,
      hasStartOrient: !!startOrient,
      hasEndOrient: !!endOrient,
      hasRotation: !!rotation,
      hasType: !!type,
      hasProp: !!prop,
      formatVersion,
      motion: {
        startLocation: motion.startLocation,
        endLocation: motion.endLocation,
        startOrientation: motion.startOrientation,
        endOrientation: motion.endOrientation,
        rotationDirection: motion.rotationDirection,
        motionType: motion.motionType,
        propType: motion.propType,
      },
    });
    return "";
  }

  if (formatVersion === 1)
    return `${startLoc}${endLoc}${startOrient}${endOrient}${rotation}${turns}${type}${prop}`;
  if (formatVersion === 2)
    return `${startLoc}${endLoc}${startOrient}${rotation}${turns}${type}${prop}`;
  return `${startLoc}${endLoc}${rotation}${turns}${type}${prop}`;
}

function encodeBeat(beat: StepData | StartPositionData, formatVersion: 1 | 2 | 3 = 3): string {
  const motions = beat.motions ?? { blue: undefined, red: undefined };
  const blueMotion = encodeMotion(motions.blue, formatVersion);
  const redMotion = encodeMotion(motions.red, formatVersion);
  return `${blueMotion}:${redMotion}`;
}

function decodeMotion(
  encoded: string,
  color: "blue" | "red",
  formatVersion: 1 | 2 | 3 = 3,
  chainStartOrientation?: Orientation
): MotionData | undefined {
  const minLen = formatVersion === 1 ? 10 : formatVersion === 2 ? 9 : 8;
  if (!encoded || encoded.length < minLen) return undefined;

  let pos = 0;

  const startLocCode = encoded.slice(pos, pos + 2);
  pos += 2;

  const endLocCode = encoded.slice(pos, pos + 2);
  pos += 2;

  // v1/v2 store startOrientation positionally; v3 chains it from the previous
  // beat (passed in). v1 also stores endOrientation; v2/v3 derive it.
  const startOrientCode = formatVersion === 3 ? undefined : encoded[pos++];
  const endOrientCode = formatVersion === 1 ? encoded[pos++] : undefined;
  const rotationCode = encoded[pos++];

  let turnsCode = "";
  while (
    pos < encoded.length &&
    encoded[pos] &&
    !MOTION_TYPE_DECODE[encoded[pos]!]
  ) {
    turnsCode += encoded[pos++];
  }

  const typeCode = encoded[pos++];
  const propCode = encoded[pos];

  const startLocation = LOCATION_DECODE[startLocCode];
  const endLocation = LOCATION_DECODE[endLocCode];
  const startOrientation =
    formatVersion === 3
      ? (chainStartOrientation as Orientation)
      : ORIENTATION_DECODE[startOrientCode!];
  const rotationDirection = ROTATION_DECODE[rotationCode!];
  const turns = turnsCode === "f" ? ("fl" as const) : parseFloat(turnsCode);
  const motionType = MOTION_TYPE_DECODE[typeCode!];
  const propType = PROP_TYPE_DECODE[propCode!];

  const endOrientation =
    formatVersion === 1
      ? ORIENTATION_DECODE[endOrientCode!]
      : (calculateEndOrientation({
          motionType: motionType as unknown as string,
          turns,
          rotationDirection: rotationDirection as unknown as string,
          startLocation: startLocation as unknown as string,
          endLocation: endLocation as unknown as string,
          startOrientation: startOrientation as unknown as string,
        }) as Orientation);

  if (
    !startLocation ||
    !endLocation ||
    !startOrientation ||
    !endOrientation ||
    !rotationDirection ||
    !motionType ||
    !propType
  ) {
    throw new Error(`Invalid motion encoding: ${encoded}`);
  }

  const MotionColorLocal = { BLUE: "blue" as const, RED: "red" as const };
  const motionColor = color === "blue" ? MotionColorLocal.BLUE : MotionColorLocal.RED;
  const gridMode = inferGridModeFromMotion(startLocation, endLocation);

  return {
    motionType,
    rotationDirection,
    startLocation,
    endLocation,
    turns,
    startOrientation,
    endOrientation,
    color: motionColor as unknown as MotionColor,
    isVisible: true,
    propType,
    gridMode: gridMode as unknown as GridMode,
    arrowLocation: startLocation,
    arrowPlacementData: {} as unknown as ArrowPlacementData,
    propPlacementData: {} as unknown as PropPlacementData,
  };
}

function decodeBeat(encoded: string, stepNumber: number, formatVersion: 1 | 2 | 3 = 2): StepData {
  const parts = encoded.split(":");

  if (parts.length !== 2) {
    throw new Error(`Invalid beat encoding: ${encoded}`);
  }

  const blueEncoded = parts[0]!;
  const redEncoded = parts[1]!;

  return {
    stepNumber,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: !blueEncoded && !redEncoded,
    motions: {
      blue: decodeMotion(blueEncoded, "blue", formatVersion),
      red: decodeMotion(redEncoded, "red", formatVersion),
    },
    id: crypto.randomUUID(),
    letter: null,
    startPosition: null,
    endPosition: null,
  };
}

function inferGridModeFromMotion(
  startLocation: GridLocation,
  endLocation: GridLocation
): "diamond" | "box" {
  const cardinalLocations: GridLocation[] = [
    GridLocation.NORTH,
    GridLocation.EAST,
    GridLocation.SOUTH,
    GridLocation.WEST,
  ];

  const intercardinalLocations: GridLocation[] = [
    GridLocation.NORTHEAST,
    GridLocation.SOUTHEAST,
    GridLocation.SOUTHWEST,
    GridLocation.NORTHWEST,
  ];

  if (
    cardinalLocations.includes(startLocation) &&
    cardinalLocations.includes(endLocation)
  ) {
    return "diamond";
  }

  if (
    intercardinalLocations.includes(startLocation) &&
    intercardinalLocations.includes(endLocation)
  ) {
    return "box";
  }

  return "diamond";
}

function buildMetadataQuery(metadata?: ShareURLMetadata): string {
  if (!metadata) return "";

  const params = new URLSearchParams();

  if (metadata.word) params.set("word", metadata.word);
  if (metadata.creator) params.set("creator", metadata.creator);
  if (metadata.notes) params.set("notes", metadata.notes);
  if (metadata.bpm !== undefined) params.set("bpm", String(metadata.bpm));
  if (metadata.darkMode !== undefined) params.set("dark", metadata.darkMode ? "1" : "0");
  if (metadata.difficulty) params.set("difficulty", metadata.difficulty);
  if (metadata.birthday) params.set("birthday", metadata.birthday);

  if (metadata.bluePropType && metadata.bluePropType !== PropType.STAFF) {
    const encoded = PROP_TYPE_ENCODE[metadata.bluePropType as PropType];
    if (encoded) params.set("bp", encoded);
  }
  if (metadata.redPropType && metadata.redPropType !== PropType.STAFF) {
    const encoded = PROP_TYPE_ENCODE[metadata.redPropType as PropType];
    if (encoded) params.set("rp", encoded);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

function findMotionMismatch(a: SequenceData, b: SequenceData): string | null {
  if (a.steps.length !== b.steps.length) {
    return `step count ${a.steps.length} vs ${b.steps.length}`;
  }
  const fields: (keyof MotionData)[] = [
    "motionType",
    "rotationDirection",
    "startLocation",
    "endLocation",
    "startOrientation",
    "endOrientation",
    "turns",
    "handPath",
    "prefloatMotionType",
    "prefloatRotationDirection",
    "skewSteps",
    "skewDir",
  ];
  for (let i = 0; i < a.steps.length; i++) {
    for (const color of ["blue", "red"] as const) {
      const ma = a.steps[i]?.motions?.[color];
      const mb = b.steps[i]?.motions?.[color];
      if (!ma || !mb) return `step ${i + 1} ${color} motion missing`;
      for (const f of fields) {
        if (ma[f] !== mb[f]) {
          return `step ${i + 1} ${color}.${f}: ${String(ma[f])} vs ${String(mb[f])}`;
        }
      }
    }
  }
  return null;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function encodeSequence(sequence: SequenceData): string {
  let startPositionStep: StepData | StartPositionData;
  let actualSteps: readonly StepData[];

  if (sequence.startPosition) {
    startPositionStep = sequence.startPosition;
    actualSteps = sequence.steps;
  } else if (sequence.startingPosition) {
    startPositionStep = sequence.startingPosition;
    actualSteps = sequence.steps;
  } else {
    const step0 = sequence.steps.find((b) => b.stepNumber === 0);
    if (step0) {
      startPositionStep = step0;
      actualSteps = sequence.steps.filter((b) => b.stepNumber !== 0);
    } else {
      startPositionStep = {
        stepNumber: 0,
        motions: { blue: undefined, red: undefined },
        duration: 1,
        blueReversal: false,
        redReversal: false,
        isBlank: true,
        id: crypto.randomUUID(),
        letter: null,
        startPosition: null,
        endPosition: null,
      };
      actualSteps = sequence.steps;
    }
  }

  // v3 carries the start-orientation seed (blue,red) in a 2-char header and
  // chains every motion's startOrientation from the previous beat on decode.
  const spMotions = startPositionStep.motions ?? { blue: undefined, red: undefined };
  const blueSeed = ORIENTATION_ENCODE[spMotions.blue?.startOrientation as Orientation] ?? "i";
  const redSeed = ORIENTATION_ENCODE[spMotions.red?.startOrientation as Orientation] ?? "i";
  const encodedStartPosition = encodeBeat(startPositionStep, 3);
  const encodedSteps = actualSteps.map((step) => encodeBeat(step, 3));
  return `v3|${blueSeed}${redSeed}|${encodedStartPosition}|${encodedSteps.join("|")}`;
}

/**
 * Decode a v3 flat string. Format: `v3|<blueSeed><redSeed>|<startPos>|<beat>...`
 * where each motion is 6-field (no stored orientation). startOrientation is
 * chained from the seed through each beat; endOrientation is derived per motion.
 */
function decodeSequenceV3(body: string): SequenceData {
  const parts = body.split("|");
  const seed = parts[0] ?? "ii";
  let blueOri = (ORIENTATION_DECODE[seed[0] ?? "i"] ?? Orientation.IN) as Orientation;
  let redOri = (ORIENTATION_DECODE[seed[1] ?? "i"] ?? Orientation.IN) as Orientation;

  const beatEncodings = parts.slice(1);
  if (beatEncodings.length === 0) {
    throw new Error("Invalid v3 sequence encoding - no beats");
  }

  const decodeChained = (enc: string, stepNumber: number): StepData => {
    const segs = enc.split(":");
    const blueEnc = segs[0] ?? "";
    const redEnc = segs[1] ?? "";
    const blue = decodeMotion(blueEnc, "blue", 3, blueOri);
    const red = decodeMotion(redEnc, "red", 3, redOri);
    if (blue) blueOri = blue.endOrientation;
    if (red) redOri = red.endOrientation;
    return {
      stepNumber,
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: !blueEnc && !redEnc,
      motions: { blue, red },
      id: crypto.randomUUID(),
      letter: null,
      startPosition: null,
      endPosition: null,
    };
  };

  const startBeat = decodeChained(beatEncodings[0]!, 0);
  const startPosition = createStartPositionData({
    id: startBeat.id || crypto.randomUUID(),
    letter: startBeat.letter,
    gridPosition: startBeat.startPosition,
    startPosition: startBeat.startPosition,
    endPosition: startBeat.endPosition,
    motions: startBeat.motions,
  });

  const steps = beatEncodings
    .slice(1)
    .filter((e) => e && e.length > 0)
    .map((enc, index) => decodeChained(enc, index + 1));

  return {
    id: crypto.randomUUID(),
    name: "Shared Sequence",
    word: "",
    steps,
    startingPosition: startPosition,
    startPosition,
    thumbnails: [],
    isFavorite: false,
    isCircular: false,
    tags: [],
    metadata: {},
    sequenceLength: steps.length,
  };
}

export function decodeSequence(encoded: string): SequenceData {
  if (!encoded) {
    throw new Error("Cannot decode empty sequence");
  }

  // v3 strings carry "v3|" (seed header + chained startOrientation); v2 carry
  // "v2|" (per-motion startOrientation, derived endOrientation); everything else
  // is legacy v1 (both orientations stored positionally).
  let formatVersion: 1 | 2 | 3 = 1;
  let body = encoded;
  if (encoded.startsWith("v3|")) {
    formatVersion = 3;
    body = encoded.slice(3);
  } else if (encoded.startsWith("v2|")) {
    formatVersion = 2;
    body = encoded.slice(3);
  }

  // v3 needs a sequential chaining pass; handle it in a dedicated path.
  if (formatVersion === 3) {
    return decodeSequenceV3(body);
  }

  const parts = body.split("|");
  if (parts.length < 1) {
    throw new Error("Invalid sequence encoding - missing data");
  }

  const firstPart = parts[0];
  if (!firstPart) {
    throw new Error("Invalid sequence encoding - empty first part");
  }
  const isLegacyFormat = /^\d+$/.test(firstPart);

  let steps: StepData[];

  if (isLegacyFormat) {
    const startStep = parseInt(firstPart, 10);
    if (isNaN(startStep)) {
      throw new Error("Invalid start beat number");
    }

    const beatEncodings = parts.slice(1).filter((e) => e && e.length > 0);
    if (beatEncodings.length === 0) {
      throw new Error("No step data found in sequence");
    }

    const startPositionStep: StepData = {
      stepNumber: 0,
      motions: { blue: undefined, red: undefined },
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: true,
      id: crypto.randomUUID(),
      letter: null,
      startPosition: null,
      endPosition: null,
    };

    const sequenceSteps = beatEncodings.map((encoding, index) =>
      decodeBeat(encoding, startStep + index, formatVersion)
    );

    steps = [startPositionStep, ...sequenceSteps];
  } else {
    const startPositionEncoding = parts[0]!;
    const startingPosition = decodeBeat(startPositionEncoding, 0, formatVersion);

    const startPosition = createStartPositionData({
      id: startingPosition.id || crypto.randomUUID(),
      letter: startingPosition.letter,
      gridPosition: startingPosition.startPosition,
      startPosition: startingPosition.startPosition,
      endPosition: startingPosition.endPosition,
      motions: startingPosition.motions,
    });

    const beatEncodings = parts.slice(1).filter((e) => e && e.length > 0);

    steps = beatEncodings.map((encoding, index) =>
      decodeBeat(encoding, index + 1, formatVersion)
    );

    return {
      id: crypto.randomUUID(),
      name: "Shared Sequence",
      word: "",
      steps,
      startingPosition: startPosition,
      startPosition,
      thumbnails: [],
      isFavorite: false,
      isCircular: false,
      tags: [],
      metadata: {},
      sequenceLength: steps.length,
    };
  }

  return {
    id: crypto.randomUUID(),
    name: "Shared Sequence",
    word: "",
    steps,
    thumbnails: [],
    isFavorite: false,
    isCircular: false,
    tags: [],
    metadata: {},
    sequenceLength: steps.length,
  };
}

export function encodeSequenceWithCompression(sequence: SequenceData): CompressionResult {
  const rawEncoded = encodeSequence(sequence);
  const compressed = compressForURL(rawEncoded);
  const isCompressed = compressed.startsWith("d1:");

  return {
    encoded: compressed,
    compressed: isCompressed,
    originalLength: rawEncoded.length,
    finalLength: compressed.length,
  };
}

export function decodeSequenceWithCompression(encoded: string): SequenceData {
  if (encoded.startsWith("d1:") || encoded.startsWith("raw:")) {
    return decodeSequence(decompressFromURL(encoded));
  }

  return decodeSequence(encoded);
}

export function generateShareURL(
  sequence: SequenceData,
  module: string,
  options: { compress?: boolean } = { compress: true }
): ShareURLResult {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  if (options.compress) {
    const { encoded, compressed, originalLength, finalLength } =
      encodeSequenceWithCompression(sequence);
    const url = `${baseUrl}/?open=${module}:${encoded}`;
    const savings = compressed
      ? Math.round(((originalLength - finalLength) / originalLength) * 100)
      : 0;

    return { url, length: url.length, compressed, savings };
  }

  const encoded = encodeSequence(sequence);
  const url = `${baseUrl}/?open=${module}:${encoded}`;

  return { url, length: url.length, compressed: false, savings: 0 };
}

export function parseDeepLink(url: string): DeepLinkParseResult | null {
  try {
    const params = new URLSearchParams(
      url.includes("?") ? url.split("?")[1] : url
    );
    const openParam = params.get("open");

    if (!openParam) return null;

    const colonIndex = openParam.indexOf(":");
    if (colonIndex === -1) return null;

    const module = openParam.slice(0, colonIndex);
    const encoded = openParam.slice(colonIndex + 1);

    if (!module || !encoded) return null;

    const sequence = decodeSequenceWithCompression(encoded);
    return { module, sequence };
  } catch (error) {
    console.error("Failed to parse deep link:", error);
    return null;
  }
}

export function estimateURLLength(
  sequence: SequenceData,
  module: string,
  compress = true
): number {
  const result = generateShareURL(sequence, module, { compress });
  return result.length;
}

export function generateViewerURL(
  sequence: SequenceData,
  options: { compress?: boolean; metadata?: ShareURLMetadata } = { compress: true }
): ShareURLResult {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const metadataQuery = buildMetadataQuery(options.metadata);

  if (options.compress) {
    const { encoded, compressed, originalLength, finalLength } =
      encodeSequenceWithCompression(sequence);
    const url = `${baseUrl}/sequence/${encodeURIComponent(encoded)}${metadataQuery}`;
    const savings = compressed
      ? Math.round(((originalLength - finalLength) / originalLength) * 100)
      : 0;

    return { url, length: url.length, compressed, savings };
  }

  const encoded = encodeSequence(sequence);
  const url = `${baseUrl}/sequence/${encodeURIComponent(encoded)}${metadataQuery}`;

  return { url, length: url.length, compressed: false, savings: 0 };
}

export function generateSequenceRoutePath(sequence: SequenceData): string {
  const { encoded } = encodeSequenceWithCompression(sequence);
  return `/sequence/${encodeURIComponent(encoded)}`;
}

export function parseSequenceRouteId(id: string): SequenceRouteIdParseResult {
  if (!id) {
    return { encoded: null, legacyId: null };
  }

  const decoded = decodeURIComponent(id);

  if (decoded.startsWith("z:")) {
    return { encoded: decoded, legacyId: null };
  }

  if (decoded.includes("|")) {
    return { encoded: decoded, legacyId: null };
  }

  return { encoded: null, legacyId: id };
}

export async function encodeSequenceForQR(sequence: SequenceData): Promise<string> {
  const flatEncoded = encodeSequence(sequence);

  try {
    const { CompositionalEncoder } = await import(
      "$lib/shared/qr/services/compositional-encoder"
    );
    const encoder = new CompositionalEncoder(
      { encode: (s) => encodeSequence(s) },
      { decode: (s) => decodeSequence(s) },
      { compressString: (s) => compressForQR(s) }
    );
    const recipe = await encoder.tryEncode(flatEncoded, sequence);
    if (recipe) {
      return `${INLINE_PREFIX}${recipe}`;
    }
  } catch (err) {
    console.warn("[QR] Compositional encoding error:", err);
  }

  const compressed = compressForQR(flatEncoded);
  return `${INLINE_PREFIX}${compressed}`;
}

export function isInlineEncoded(code: string): boolean {
  return code.startsWith(INLINE_PREFIX);
}

export async function decodeSequenceFromQR(encoded: string): Promise<SequenceData> {
  const data = encoded.startsWith(INLINE_PREFIX)
    ? encoded.slice(INLINE_PREFIX.length)
    : encoded;

  if (data.startsWith("r1:")) {
    const { CompositionalDecoder } = await import(
      "$lib/shared/qr/services/compositional-decoder"
    );
    const decoder = new CompositionalDecoder(
      { encode: (s) => encodeSequence(s) },
      { decode: (s) => decodeSequence(s) },
      { decompressString: (s) => decompressFromQR(s) }
    );
    const flatEncoded = await decoder.decode(data);
    return decodeSequence(flatEncoded);
  }

  if (data.startsWith("q1:") || data.startsWith("raw:")) {
    return decodeSequence(decompressFromQR(data));
  }

  return decodeSequenceWithCompression(data);
}

export async function estimateOfflineQRSize(sequence: SequenceData): Promise<QRSizeEstimate> {
  const encoded = await encodeSequenceForQR(sequence);
  const length = encoded.length;

  const VERSION_CAPACITIES = [
    { version: 5, capacity: 224, comfortable: true },
    { version: 10, capacity: 395, comfortable: true },
    { version: 15, capacity: 589, comfortable: false },
    { version: 20, capacity: 858, comfortable: false },
    { version: 25, capacity: 1182, comfortable: false },
  ];

  let recommendedVersion = 40;
  let comfortable = false;

  for (const { version, capacity, comfortable: isComfortable } of VERSION_CAPACITIES) {
    if (length <= capacity) {
      recommendedVersion = version;
      comfortable = isComfortable;
      break;
    }
  }

  const result: QRSizeEstimate = {
    encodedLength: length,
    recommendedVersion,
    offlineRecommended: comfortable,
  };

  if (recommendedVersion > 15) {
    result.warning = `Sequence produces a dense QR code (${length} chars). ` +
      `Consider using online mode for better scanning reliability.`;
    result.offlineRecommended = false;
  } else if (recommendedVersion > 10) {
    result.warning = `Sequence is moderately large (${length} chars). ` +
      `QR code will require good lighting and a steady hand to scan.`;
  }

  return result;
}

export function encodePropForURL(propType: PropType): string {
  return PROP_TYPE_ENCODE[propType] ?? PROP_TYPE_ENCODE[PropType.STAFF];
}

export function parsePropsFromURL(searchParams: URLSearchParams): URLPropOptions {
  const result: URLPropOptions = {};

  const bp = searchParams.get("bp");
  if (bp && PROP_TYPE_DECODE[bp]) {
    result.bluePropType = PROP_TYPE_DECODE[bp];
  }

  const rp = searchParams.get("rp");
  if (rp && PROP_TYPE_DECODE[rp]) {
    result.redPropType = PROP_TYPE_DECODE[rp];
  }

  return result;
}

export function verifySequenceRoundTrip(
  encoded: string
): { ok: true; decoded: SequenceData } | { ok: false; reason: string } {
  let decoded: SequenceData;
  try {
    decoded = decodeSequenceWithCompression(encoded);
  } catch (err) {
    return { ok: false, reason: `decode threw: ${(err as Error).message}` };
  }

  let reencoded: string;
  try {
    ({ encoded: reencoded } = encodeSequenceWithCompression(decoded));
  } catch (err) {
    return { ok: false, reason: `re-encode threw: ${(err as Error).message}` };
  }

  let redecoded: SequenceData;
  try {
    redecoded = decodeSequenceWithCompression(reencoded);
  } catch (err) {
    return { ok: false, reason: `re-decode threw: ${(err as Error).message}` };
  }

  const mismatch = findMotionMismatch(decoded, redecoded);
  if (mismatch) return { ok: false, reason: mismatch };

  return { ok: true, decoded };
}

/**
 * Re-encode a flat sequence string at a target format version. Used by the
 * compositional decoder to recompute a recipe hash in the SAME version the
 * original recipe was hashed in (old r1: recipes hashed on v1, new on v2).
 */
export function reencodeFlat(encoded: string, targetVersion: 1 | 2 | 3): string {
  const seq = decodeSequence(encoded);
  // encodeSequence emits v3 (current format).
  if (targetVersion === 3) return encodeSequence(seq);

  // v1/v2: re-emit start position + steps at the target version. The decoded
  // sequence has all orientations populated, so the older fuller formats encode
  // byte-identically to how they were originally produced.
  const startBeat = seq.startPosition ?? seq.startingPosition;
  const start = startBeat ? encodeBeat(startBeat, targetVersion) : ":";
  const steps = seq.steps
    .filter((s) => s.stepNumber !== 0)
    .map((s) => encodeBeat(s, targetVersion));
  const flat = `${start}|${steps.join("|")}`;
  return targetVersion === 2 ? `v2|${flat}` : flat;
}

/** Test-only handles for unit tests. Not part of the public API. */
export const __test__ = { encodeMotion, decodeMotion, encodeBeat };
