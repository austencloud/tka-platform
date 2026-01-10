/**
 * Sequence Encoder Service Implementation
 *
 * Handles encoding and decoding of sequences for URL sharing.
 * Compresses sequence data into ultra-compact URL-safe strings.
 *
 * Format: startPosition|beat1|beat2|beat3|...
 * Each motion: startLoc(2)+endLoc(2)+startOrient(1)+endOrient(1)+rotDir(1)+turns(1+)+type(1)+propType(1)
 *
 * IMPORTANT: The first part is the START POSITION (where the user begins),
 * NOT a beat! Beats are numbered 1, 2, 3, ... The start position is beat 0
 * internally but should not be counted when reporting "total beats".
 *
 * With LZString compression, URLs can be 60-70% smaller for longer sequences.
 *
 * Domain: Navigation - Sequence URL Encoding
 */

import LZString from "lz-string";

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
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
  DeepLinkParseResult,
} from "../contracts/ISequenceEncoder";

// ============================================================================
// Character Code Mappings
// ============================================================================

const LOCATION_ENCODE: Record<GridLocation, string> = {
  [GridLocation.NORTH]: "no",
  [GridLocation.EAST]: "ea",
  [GridLocation.SOUTH]: "so",
  [GridLocation.WEST]: "we",
  [GridLocation.NORTHEAST]: "ne",
  [GridLocation.SOUTHEAST]: "se",
  [GridLocation.SOUTHWEST]: "sw",
  [GridLocation.NORTHWEST]: "nw",
};

const LOCATION_DECODE: Record<string, GridLocation> = Object.fromEntries(
  Object.entries(LOCATION_ENCODE).map(([k, v]) => [v, k as GridLocation])
);

const ORIENTATION_ENCODE: Record<Orientation, string> = {
  [Orientation.IN]: "i",
  [Orientation.OUT]: "o",
  [Orientation.CLOCK]: "k",
  [Orientation.COUNTER]: "t",
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
  // Staff family
  [PropType.STAFF]: "S",
  [PropType.SIMPLESTAFF]: "s",
  [PropType.BIGSTAFF]: "1",
  [PropType.STAFF2]: "2",
  // Club family
  [PropType.CLUB]: "C",
  [PropType.BIGCLUB]: "c",
  // Fan family
  [PropType.FAN]: "F",
  [PropType.BIGFAN]: "f",
  // Triad family
  [PropType.TRIAD]: "T",
  [PropType.BIGTRIAD]: "t",
  // Hoop family
  [PropType.MINIHOOP]: "M",
  [PropType.BIGHOOP]: "H",
  // Buugeng family
  [PropType.BUUGENG]: "B",
  [PropType.BIGBUUGENG]: "b",
  [PropType.FRACTALGENG]: "R",
  // Hand
  [PropType.HAND]: "X",
  // Triquetra family
  [PropType.TRIQUETRA]: "Q",
  [PropType.TRIQUETRA2]: "q",
  // Sword
  [PropType.SWORD]: "W",
  // Chicken family
  [PropType.CHICKEN]: "K",
  [PropType.BIGCHICKEN]: "k",
  // Guitar family
  [PropType.GUITAR]: "G",
  [PropType.UKULELE]: "u",
  // Doublestar family
  [PropType.DOUBLESTAR]: "D",
  [PropType.BIGDOUBLESTAR]: "d",
  // Eightrings family
  [PropType.EIGHTRINGS]: "E",
  [PropType.BIGEIGHTRINGS]: "e",
  // Quiad
  [PropType.QUIAD]: "U",
};

const PROP_TYPE_DECODE: Record<string, PropType> = Object.fromEntries(
  Object.entries(PROP_TYPE_ENCODE).map(([k, v]) => [v, k as PropType])
) as Record<string, PropType>;

export class SequenceEncoder implements ISequenceEncoder {
  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Encode a sequence into compact URL string format
   * Format: "startPosition|beat1|beat2|beat3..."
   */
  encode(sequence: SequenceData): string {
    let startPositionBeat: BeatData | StartPositionData;
    let actualBeats: readonly BeatData[];

    if (sequence.startPosition) {
      startPositionBeat = sequence.startPosition;
      actualBeats = sequence.beats;
    } else if (sequence.startingPositionBeat) {
      startPositionBeat = sequence.startingPositionBeat;
      actualBeats = sequence.beats;
    } else {
      const beat0 = sequence.beats.find((b) => b.beatNumber === 0);
      if (beat0) {
        startPositionBeat = beat0;
        actualBeats = sequence.beats.filter((b) => b.beatNumber !== 0);
      } else {
        startPositionBeat = {
          beatNumber: 0,
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
        actualBeats = sequence.beats;
      }
    }

    const encodedStartPosition = this.encodeBeat(startPositionBeat);
    const encodedBeats = actualBeats.map((beat) => this.encodeBeat(beat));

    return `${encodedStartPosition}|${encodedBeats.join("|")}`;
  }

  /**
   * Decode a compact URL string into SequenceData
   * Handles both legacy and current formats
   */
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

    let beats: BeatData[];

    if (isLegacyFormat) {
      const startBeat = parseInt(firstPart, 10);
      if (isNaN(startBeat)) {
        throw new Error("Invalid start beat number");
      }

      const beatEncodings = parts.slice(1).filter((e) => e && e.length > 0);
      if (beatEncodings.length === 0) {
        throw new Error("No beat data found in sequence");
      }

      const startPositionBeat: BeatData = {
        beatNumber: 0,
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

      const sequenceBeats = beatEncodings.map((encoding, index) =>
        this.decodeBeat(encoding, startBeat + index)
      );

      beats = [startPositionBeat, ...sequenceBeats];
    } else {
      const startPositionEncoding = parts[0]!;
      const startingPositionBeat = this.decodeBeat(startPositionEncoding, 0);

      // Convert BeatData to StartPositionData using the factory function
      const startPosition = createStartPositionData({
        id: startingPositionBeat.id || crypto.randomUUID(),
        letter: startingPositionBeat.letter,
        gridPosition: startingPositionBeat.startPosition,
        startPosition: startingPositionBeat.startPosition,
        endPosition: startingPositionBeat.endPosition,
        motions: startingPositionBeat.motions,
      });

      const beatEncodings = parts.slice(1).filter((e) => e && e.length > 0);

      beats = beatEncodings.map((encoding, index) =>
        this.decodeBeat(encoding, index + 1)
      );

      return {
        id: crypto.randomUUID(),
        name: "Shared Sequence",
        word: "",
        beats,
        startingPositionBeat: startPosition,
        startPosition,
        thumbnails: [],
        isFavorite: false,
        isCircular: false,
        tags: [],
        metadata: {},
        sequenceLength: beats.length,
      };
    }

    return {
      id: crypto.randomUUID(),
      name: "Shared Sequence",
      word: "",
      beats,
      thumbnails: [],
      isFavorite: false,
      isCircular: false,
      tags: [],
      metadata: {},
      sequenceLength: beats.length,
    };
  }

  /**
   * Encode sequence with optional LZString compression
   * Uses compression only if it results in shorter output
   */
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

  /**
   * Decode sequence, handling both compressed and uncompressed formats
   */
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

  /**
   * Generate a shareable URL for a sequence in a specific module
   */
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

  /**
   * Parse a deep link URL and extract module + sequence data
   */
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

  /**
   * Estimate URL length for a sequence
   */
  estimateURLLength(
    sequence: SequenceData,
    module: string,
    compress = true
  ): number {
    const result = this.generateShareURL(sequence, module, { compress });
    return result.length;
  }

  /**
   * Generate a standalone viewer URL for a sequence
   * Uses /sequence/{encodedSequence} format
   */
  generateViewerURL(
    sequence: SequenceData,
    options: { compress?: boolean } = { compress: true }
  ): ShareURLResult {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

    if (options.compress) {
      const { encoded, compressed, originalLength, finalLength } =
        this.encodeWithCompression(sequence);
      const url = `${baseUrl}/sequence/${encodeURIComponent(encoded)}`;
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
    const url = `${baseUrl}/sequence/${encodeURIComponent(encoded)}`;

    return {
      url,
      length: url.length,
      compressed: false,
      savings: 0,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private encodeMotion(motion: MotionData | undefined): string {
    if (!motion) return "";

    const startLoc = LOCATION_ENCODE[motion.startLocation];
    const endLoc = LOCATION_ENCODE[motion.endLocation];
    const startOrient = ORIENTATION_ENCODE[motion.startOrientation];
    const endOrient = ORIENTATION_ENCODE[motion.endOrientation];
    const rotation = ROTATION_ENCODE[motion.rotationDirection];
    const turns = motion.turns === "fl" ? "f" : String(motion.turns);
    const type = MOTION_TYPE_ENCODE[motion.motionType];
    const prop = PROP_TYPE_ENCODE[motion.propType];

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

  private encodeBeat(beat: BeatData | StartPositionData): string {
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
    const turns = turnsCode === "f" ? ("fl" as const) : parseInt(turnsCode, 10);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      color: motionColor as any,
      isVisible: true,
      propType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gridMode: gridMode as any,
      arrowLocation: startLocation,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      arrowPlacementData: {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      propPlacementData: {} as any,
    };
  }

  private decodeBeat(encoded: string, beatNumber: number): BeatData {
    const parts = encoded.split(":");

    // Need exactly 2 parts (blue:red), but either can be empty for no motion
    if (parts.length !== 2) {
      throw new Error(`Invalid beat encoding: ${encoded}`);
    }

    const blueEncoded = parts[0]!;
    const redEncoded = parts[1]!;

    return {
      beatNumber,
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
    const cardinalLocations = [
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
    ];

    const intercardinalLocations = [
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
}
