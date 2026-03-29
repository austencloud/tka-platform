"use strict";
/**
 * Sequence Generator
 *
 * Generates partial sequences that can be transformed into LOOPs.
 * Port of client-side generation logic with proper position/location handling.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLOOPSequence = generateLOOPSequence;
exports.calculateDuration = calculateDuration;
const types_1 = require("./types");
const loop_executor_1 = require("./loop-executor");
const circular_position_maps_1 = require("./circular-position-maps");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Cache for pictograph data
let pictographCache = null;
/**
 * Load pictograph data from JSON file.
 */
function loadPictographData() {
    if (pictographCache) {
        return pictographCache;
    }
    const dataPath = path.join(__dirname, "../data/pictographs.json");
    const content = fs.readFileSync(dataPath, "utf-8");
    pictographCache = JSON.parse(content);
    return pictographCache;
}
/**
 * Get all pictographs for a grid mode.
 */
function getPictographs(gridMode = "diamond") {
    const data = loadPictographData();
    return data.gridModes[gridMode] || data.gridModes.diamond;
}
/**
 * Filter pictographs by start position (continuity filter).
 */
function filterByStartPosition(pictographs, startPosition) {
    const normalizedStart = startPosition.toLowerCase();
    return pictographs.filter((p) => { var _a; return ((_a = p.startPosition) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === normalizedStart; });
}
/**
 * Filter pictographs by end position.
 */
function filterByEndPosition(pictographs, endPosition) {
    const normalizedEnd = endPosition.toLowerCase();
    return pictographs.filter((p) => { var _a; return ((_a = p.endPosition) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === normalizedEnd; });
}
/**
 * Filter out Type 6 static pictographs (where start === end position).
 * This ensures more interesting sequences with actual movement.
 */
function filterOutType6(pictographs) {
    return pictographs.filter((p) => {
        if (!p.startPosition || !p.endPosition)
            return true;
        return p.startPosition.toLowerCase() !== p.endPosition.toLowerCase();
    });
}
/**
 * Select a random item from an array.
 */
function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}
/**
 * Get all alpha positions.
 */
function getAlphaPositions() {
    return Object.values(circular_position_maps_1.GridPosition).filter((p) => p.startsWith("alpha"));
}
/**
 * Get valid start positions for a LOOP type and slice size.
 * Only returns positions that have valid rotation targets.
 */
function getValidStartPositions(loopType, sliceSize) {
    const isRotatedLoop = [
        types_1.LOOPType.ROTATED,
        types_1.LOOPType.ROTATED_SWAPPED,
        types_1.LOOPType.ROTATED_INVERTED,
        types_1.LOOPType.MIRRORED_ROTATED,
        types_1.LOOPType.MIRRORED_INVERTED_ROTATED,
    ].includes(loopType);
    if (!isRotatedLoop) {
        // Non-rotated LOOPs can start anywhere
        return getAlphaPositions();
    }
    // For rotated LOOPs, only return positions that have valid rotation pairs
    const validationSet = sliceSize === types_1.SliceSize.HALVED ? circular_position_maps_1.HALVED_LOOPS : circular_position_maps_1.QUARTERED_LOOPS;
    const validStarts = new Set();
    for (const pair of validationSet) {
        const [start] = pair.split(",");
        if (start && start.startsWith("alpha")) {
            validStarts.add(start);
        }
    }
    return Array.from(validStarts);
}
/**
 * Create a Type 6 static start position beat.
 * This matches the client-side StartPositionManager logic.
 */
function createStartPositionBeat(startPosition) {
    const locations = (0, circular_position_maps_1.getLocationsFromPosition)(startPosition);
    if (!locations) {
        throw new Error(`Invalid start position: ${startPosition}`);
    }
    const [blueLocation, redLocation] = locations;
    // Determine letter based on position prefix
    let letter;
    const posLower = startPosition.toLowerCase();
    if (posLower.startsWith("alpha")) {
        letter = "α"; // Greek alpha
    }
    else if (posLower.startsWith("beta")) {
        letter = "β"; // Greek beta
    }
    else {
        letter = "Γ"; // Greek gamma
    }
    // Create Type 6 static motions (both hands stay in place)
    const blueMotion = {
        motionType: "static",
        rotationDirection: "no_rotation",
        startLocation: blueLocation,
        endLocation: blueLocation,
    };
    const redMotion = {
        motionType: "static",
        rotationDirection: "no_rotation",
        startLocation: redLocation,
        endLocation: redLocation,
    };
    return {
        id: `start-${startPosition}-${Date.now()}`,
        letter,
        startPosition,
        endPosition: startPosition,
        timing: "together",
        direction: undefined,
        beatNumber: 0,
        blue: blueMotion,
        red: redMotion,
    };
}
/**
 * Convert a pictograph to a beat.
 */
function pictographToBeat(pictograph, beatNumber) {
    return {
        id: `beat-${beatNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        letter: pictograph.letter,
        startPosition: pictograph.startPosition,
        endPosition: pictograph.endPosition,
        timing: pictograph.timing,
        direction: pictograph.direction,
        beatNumber,
        blue: {
            motionType: pictograph.blue.motionType,
            rotationDirection: pictograph.blue.rotationDirection,
            startLocation: pictograph.blue.startLocation,
            endLocation: pictograph.blue.endLocation,
        },
        red: {
            motionType: pictograph.red.motionType,
            rotationDirection: pictograph.red.rotationDirection,
            startLocation: pictograph.red.startLocation,
            endLocation: pictograph.red.endLocation,
        },
    };
}
/**
 * Generate a partial sequence ending at a specific position.
 * Matches client-side PartialSequenceGenerator logic.
 */
function generatePartialSequence(startPosition, endPosition, length, gridMode = "diamond") {
    const allPictographs = getPictographs(gridMode);
    // Start with the Type 6 static start beat (beat 0)
    const startBeat = createStartPositionBeat(startPosition);
    const sequence = [startBeat];
    let currentPosition = startPosition;
    // Generate intermediate beats (length - 1 of them)
    // The last beat must end at endPosition
    const intermediateCount = Math.max(0, length - 1);
    for (let i = 0; i < intermediateCount; i++) {
        // Get candidates that start at current position
        let candidates = filterByStartPosition(allPictographs, currentPosition);
        // Filter out Type 6 (static) for more interesting sequences
        const nonType6 = filterOutType6(candidates);
        if (nonType6.length > 0) {
            candidates = nonType6;
        }
        // On the last intermediate beat, avoid landing on endPosition
        // This prevents needing a Type 6 static move for the final beat
        if (i === intermediateCount - 1 && candidates.length > 1) {
            const avoiding = candidates.filter((c) => { var _a; return ((_a = c.endPosition) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== endPosition.toLowerCase(); });
            if (avoiding.length > 0) {
                candidates = avoiding;
            }
        }
        if (candidates.length === 0) {
            // Fallback: use any pictograph starting at current position
            candidates = filterByStartPosition(allPictographs, currentPosition);
            if (candidates.length === 0) {
                throw new Error(`No valid moves from position ${currentPosition}`);
            }
        }
        const selected = randomChoice(candidates);
        sequence.push(pictographToBeat(selected, sequence.length));
        currentPosition = selected.endPosition;
    }
    // Final beat: must end at required endPosition
    const lastBeat = sequence[sequence.length - 1];
    if (!lastBeat) {
        throw new Error("No beats in sequence");
    }
    let finalCandidates = filterByStartPosition(allPictographs, lastBeat.endPosition);
    finalCandidates = filterByEndPosition(finalCandidates, endPosition);
    // Prefer non-Type6 for final beat too
    const nonType6Final = filterOutType6(finalCandidates);
    if (nonType6Final.length > 0) {
        finalCandidates = nonType6Final;
    }
    if (finalCandidates.length === 0) {
        // If we can't find a move, try any move that ends at the right position
        finalCandidates = filterByEndPosition(allPictographs, endPosition);
        if (finalCandidates.length === 0) {
            throw new Error(`No valid move to required end position ${endPosition} from ${lastBeat.endPosition}`);
        }
    }
    const finalPictograph = randomChoice(finalCandidates);
    sequence.push(pictographToBeat(finalPictograph, sequence.length));
    return sequence;
}
/**
 * Calculate the word (letter sequence) from beats.
 */
function calculateWord(beats) {
    // Skip beat 0 (start position) and concatenate letters
    return beats
        .filter((b) => b.beatNumber > 0)
        .map((b) => b.letter)
        .join("");
}
/**
 * LOOP types to cycle through, ordered from simple to complex.
 */
const LOOP_TYPE_ROTATION = [
    types_1.LOOPType.ROTATED,
    types_1.LOOPType.MIRRORED,
    types_1.LOOPType.SWAPPED,
    types_1.LOOPType.INVERTED,
    types_1.LOOPType.ROTATED_SWAPPED,
    types_1.LOOPType.MIRRORED_SWAPPED,
    types_1.LOOPType.ROTATED_INVERTED,
    types_1.LOOPType.MIRRORED_INVERTED,
    types_1.LOOPType.MIRRORED_ROTATED,
    types_1.LOOPType.SWAPPED_INVERTED,
    types_1.LOOPType.MIRRORED_INVERTED_ROTATED,
];
/**
 * Calculate word length for a LOOP type and slice size.
 * Matches client-side WordLengthCalculator logic.
 */
function calculateWordLength(loopType, sliceSize, targetLength = 16) {
    // Special case for compound types that apply multiple transformations
    const isDoubleCompound = [
        types_1.LOOPType.MIRRORED_ROTATED,
        types_1.LOOPType.MIRRORED_INVERTED_ROTATED,
    ].includes(loopType);
    if (isDoubleCompound) {
        // These apply rotation AND mirroring, so multiply both
        return sliceSize === types_1.SliceSize.HALVED
            ? Math.floor(targetLength / 4) // rotation ×2, mirror ×2
            : Math.floor(targetLength / 8); // rotation ×4, mirror ×2
    }
    // Standard LOOP types
    return sliceSize === types_1.SliceSize.HALVED
        ? Math.floor(targetLength / 2)
        : Math.floor(targetLength / 4);
}
/**
 * Generate a complete LOOP sequence.
 */
function generateLOOPSequence(loopTypeIndex, gridMode = "diamond") {
    const MAX_RETRIES = 5;
    let lastError = null;
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
        try {
            // Get LOOP type from rotation
            const loopType = LOOP_TYPE_ROTATION[loopTypeIndex % LOOP_TYPE_ROTATION.length];
            const nextIndex = (loopTypeIndex + 1) % LOOP_TYPE_ROTATION.length;
            // Randomly choose slice size (70% quartered, 30% halved)
            const sliceSize = Math.random() < 0.7 ? types_1.SliceSize.QUARTERED : types_1.SliceSize.HALVED;
            // Get valid start positions for this LOOP type
            const validStarts = getValidStartPositions(loopType, sliceSize);
            if (validStarts.length === 0) {
                throw new Error(`No valid start positions for ${loopType} ${sliceSize}`);
            }
            const startPosition = randomChoice(validStarts);
            // Determine required end position for the partial sequence
            const endPosition = (0, loop_executor_1.determineEndPosition)(loopType, startPosition, sliceSize);
            // Calculate word length
            const wordLength = calculateWordLength(loopType, sliceSize, 16);
            // Generate partial sequence
            const partialBeats = generatePartialSequence(startPosition, endPosition, wordLength, gridMode);
            // Execute LOOP to get complete sequence
            const completeBeats = (0, loop_executor_1.executeLOOP)(partialBeats, loopType, sliceSize);
            // Calculate word
            const word = calculateWord(completeBeats);
            const sequence = {
                id: `loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                word,
                beats: completeBeats,
                startPosition,
                gridMode,
                isCircular: true,
                loopType,
                sliceSize,
                totalBeats: completeBeats.length - 1, // Exclude start position from count
            };
            return { sequence, nextLoopTypeIndex: nextIndex };
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`Generation attempt ${retry + 1} failed: ${lastError.message}`);
            // Try next LOOP type on failure
            loopTypeIndex = (loopTypeIndex + 1) % LOOP_TYPE_ROTATION.length;
        }
    }
    throw lastError !== null && lastError !== void 0 ? lastError : new Error("Failed to generate sequence after max retries");
}
/**
 * Calculate sequence duration in milliseconds.
 */
function calculateDuration(beatCount, beatsPerMinute = 60) {
    const msPerBeat = 60000 / beatsPerMinute;
    return beatCount * msPerBeat;
}
//# sourceMappingURL=sequence-generator.js.map