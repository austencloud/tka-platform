import LZString from "lz-string";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "../../../../features/create/shared/domain/models/StartPositionData";
import { createStartPositionData } from "../../../../features/create/shared/domain/factories/createStartPositionData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type {
  ISequenceEncoder,
  CompressionResult,
  ShareURLResult,
  ShareURLMetadata,
  DeepLinkParseResult,
  QRSizeEstimate,
  SequenceRouteIdParseResult,
  URLPropOptions,
} from "../contracts/ISequenceEncoder";

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

export class SequenceEncoder implements ISequenceEncoder {
  encode(sequence: SequenceData): string {
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

    const encodedStartPosition = this.encodeBeat(startPositionStep);
    const encodedSteps = actualSteps.map((step) => this.encodeBeat(step));
    return `${encodedStartPosition}|${encodedSteps.join("|")}`;
  }

  decode(encoded: string): SequenceData {
    if (!encoded) {
      throw new Error("Cannot decode empty sequence");
    }

    const parts = encoded.split("|");
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
        this.decodeBeat(encoding, startStep + index)
      );

      steps = [startPositionStep, ...sequenceSteps];
    } else {
      const startPositionEncoding = parts[0]!;
      const startingPosition = this.decodeBeat(startPositionEncoding, 0);

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
        this.decodeBeat(encoding, index + 1)
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

  encodeWithCompression(sequence: SequenceData): CompressionResult {
    const rawEncoded = this.encode(sequence);
    const compressed = this.compressString(rawEncoded);

    if (compressed.length < rawEncoded.length) {
      return {
        encoded: `z:${compressed}`,
        compressed: true,
        originalLength: rawEncoded.length,
        finalLength: compressed.length + 2,
      };
    }

    return {
      encoded: rawEncoded,
      compressed: false,
      originalLength: rawEncoded.length,
      finalLength: rawEncoded.length,
    };
  }

  decodeWithCompression(encoded: string): SequenceData {
    if (encoded.startsWith("z:")) {
      const compressed = encoded.slice(2);
      const decompressed = this.decompressString(compressed);
      if (!decompressed) {
        throw new Error("Failed to decompress sequence data");
      }
      return this.decode(decompressed);
    }

    return this.decode(encoded);
  }

  generateShareURL(
    sequence: SequenceData,
    module: string,
    options: { compress?: boolean } = { compress: true }
  ): ShareURLResult {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

    if (options.compress) {
      const { encoded, compressed, originalLength, finalLength } =
        this.encodeWithCompression(sequence);
      const url = `${baseUrl}/?open=${module}:${encoded}`;
      const savings = compressed
        ? Math.round(((originalLength - finalLength) / originalLength) * 100)
        : 0;

      return {
        url,
        length: url.length,
        compressed,
        savings,
      };
    }

    const encoded = this.encode(sequence);
    const url = `${baseUrl}/?open=${module}:${encoded}`;

    return {
      url,
      length: url.length,
      compressed: false,
      savings: 0,
    };
  }

  parseDeepLink(url: string): DeepLinkParseResult | null {
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

      const sequence = this.decodeWithCompression(encoded);
      return { module, sequence };
    } catch (error) {
      console.error("Failed to parse deep link:", error);
      return null;
    }
  }

  estimateURLLength(
    sequence: SequenceData,
    module: string,
    compress = true
  ): number {
    const result = this.generateShareURL(sequence, module, { compress });
    return result.length;
  }

  generateViewerURL(
    sequence: SequenceData,
    options: { compress?: boolean; metadata?: ShareURLMetadata } = { compress: true }
  ): ShareURLResult {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const metadataQuery = this.buildMetadataQuery(options.metadata);

    if (options.compress) {
      const { encoded, compressed, originalLength, finalLength } =
        this.encodeWithCompression(sequence);
      const url = `${baseUrl}/sequence/${encodeURIComponent(encoded)}${metadataQuery}`;
      const savings = compressed
        ? Math.round(((originalLength - finalLength) / originalLength) * 100)
        : 0;

      return {
        url,
        length: url.length,
        compressed,
        savings,
      };
    }

    const encoded = this.encode(sequence);
    const url = `${baseUrl}/sequence/${encodeURIComponent(encoded)}${metadataQuery}`;

    return {
      url,
      length: url.length,
      compressed: false,
      savings: 0,
    };
  }

  generateSequenceRoutePath(sequence: SequenceData): string {
    const { encoded } = this.encodeWithCompression(sequence);
    return `/sequence/${encodeURIComponent(encoded)}`;
  }

  parseSequenceRouteId(id: string): SequenceRouteIdParseResult {
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

  private static readonly INLINE_PREFIX = "s~";

  async encodeForQR(sequence: SequenceData): Promise<string> {
    const flatEncoded = this.encode(sequence);
    const { encoded: compressedFlat } = this.encodeWithCompression(sequence);

    try {
      const { CompositionalEncoder } = await import(
        "$lib/shared/qr/services/implementations/CompositionalEncoder"
      );
      const encoder = new CompositionalEncoder(
        { encode: (s) => this.encode(s) },
        { decode: (s) => this.decode(s) },
        { compressString: (s) => this.compressString(s) }
      );
      const recipe = await encoder.tryEncode(flatEncoded, sequence);
      if (recipe) {
        return `${SequenceEncoder.INLINE_PREFIX}${recipe}`;
      }
    } catch (err) {
      console.warn("[QR] Compositional encoding error:", err);
    }

    return `${SequenceEncoder.INLINE_PREFIX}${compressedFlat}`;
  }

  isInlineEncoded(code: string): boolean {
    return code.startsWith(SequenceEncoder.INLINE_PREFIX);
  }

  async decodeFromQR(encoded: string): Promise<SequenceData> {
    const data = encoded.startsWith(SequenceEncoder.INLINE_PREFIX)
      ? encoded.slice(SequenceEncoder.INLINE_PREFIX.length)
      : encoded;

    if (data.startsWith("r:")) {
      const { CompositionalDecoder } = await import(
        "$lib/shared/qr/services/implementations/CompositionalDecoder"
      );
      const decoder = new CompositionalDecoder(
        { encode: (s) => this.encode(s) },
        { decode: (s) => this.decode(s) },
        { decompressString: (s) => this.decompressString(s) }
      );
      const flatEncoded = await decoder.decode(data);
      return this.decode(flatEncoded);
    }

    return this.decodeWithCompression(data);
  }

  async estimateOfflineQRSize(sequence: SequenceData): Promise<QRSizeEstimate> {
    const encoded = await this.encodeForQR(sequence);
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

  private buildMetadataQuery(metadata?: ShareURLMetadata): string {
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

  parsePropsFromURL(searchParams: URLSearchParams): URLPropOptions {
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

  private encodeMotion(motion: MotionData | undefined): string {
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

    if (
      !startLoc ||
      !endLoc ||
      !startOrient ||
      !endOrient ||
      !rotation ||
      !type ||
      !prop
    ) {
      console.error("❌ URL Encoder: Motion has missing required fields!", {
        hasStartLoc: !!startLoc,
        hasEndLoc: !!endLoc,
        hasStartOrient: !!startOrient,
        hasEndOrient: !!endOrient,
        hasRotation: !!rotation,
        hasType: !!type,
        hasProp: !!prop,
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

    return `${startLoc}${endLoc}${startOrient}${endOrient}${rotation}${turns}${type}${prop}`;
  }

  private encodeBeat(beat: StepData | StartPositionData): string {
    const motions = beat.motions ?? { blue: undefined, red: undefined };
    const blueMotion = this.encodeMotion(motions.blue);
    const redMotion = this.encodeMotion(motions.red);
    return `${blueMotion}:${redMotion}`;
  }

  private decodeMotion(
    encoded: string,
    color: "blue" | "red"
  ): MotionData | undefined {
    if (!encoded || encoded.length < 10) return undefined;

    let pos = 0;

    const startLocCode = encoded.slice(pos, pos + 2);
    pos += 2;

    const endLocCode = encoded.slice(pos, pos + 2);
    pos += 2;

    const startOrientCode = encoded[pos++];
    const endOrientCode = encoded[pos++];
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
    const startOrientation = ORIENTATION_DECODE[startOrientCode!];
    const endOrientation = ORIENTATION_DECODE[endOrientCode!];
    const rotationDirection = ROTATION_DECODE[rotationCode!];
    const turns = turnsCode === "f" ? ("fl" as const) : parseFloat(turnsCode);
    const motionType = MOTION_TYPE_DECODE[typeCode!];
    const propType = PROP_TYPE_DECODE[propCode!];

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

    const MotionColor = { BLUE: "blue" as const, RED: "red" as const };
    const motionColor = color === "blue" ? MotionColor.BLUE : MotionColor.RED;
    const gridMode = this.inferGridModeFromMotion(startLocation, endLocation);

    return {
      motionType,
      rotationDirection,
      startLocation,
      endLocation,
      turns,
      startOrientation,
      endOrientation,
      color: motionColor as any,
      isVisible: true,
      propType,
      gridMode: gridMode as any,
      arrowLocation: startLocation,
      arrowPlacementData: {} as any,
      propPlacementData: {} as any,
    };
  }

  private decodeBeat(encoded: string, stepNumber: number): StepData {
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
        blue: this.decodeMotion(blueEncoded, "blue"),
        red: this.decodeMotion(redEncoded, "red"),
      },
      id: crypto.randomUUID(),
      letter: null,
      startPosition: null,
      endPosition: null,
    };
  }

  private inferGridModeFromMotion(
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

  private compressString(str: string): string {
    return LZString.compressToEncodedURIComponent(str);
  }

  private decompressString(compressed: string): string | null {
    return LZString.decompressFromEncodedURIComponent(compressed);
  }

  verifyRoundTrip(
    encoded: string
  ): { ok: true; decoded: SequenceData } | { ok: false; reason: string } {
    let decoded: SequenceData;
    try {
      decoded = this.decodeWithCompression(encoded);
    } catch (err) {
      return { ok: false, reason: `decode threw: ${(err as Error).message}` };
    }

    let reencoded: string;
    try {
      ({ encoded: reencoded } = this.encodeWithCompression(decoded));
    } catch (err) {
      return { ok: false, reason: `re-encode threw: ${(err as Error).message}` };
    }

    let redecoded: SequenceData;
    try {
      redecoded = this.decodeWithCompression(reencoded);
    } catch (err) {
      return { ok: false, reason: `re-decode threw: ${(err as Error).message}` };
    }

    const mismatch = this.findMotionMismatch(decoded, redecoded);
    if (mismatch) return { ok: false, reason: mismatch };

    return { ok: true, decoded };
  }

  private findMotionMismatch(a: SequenceData, b: SequenceData): string | null {
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
}

export const sequenceEncoder = new SequenceEncoder();
