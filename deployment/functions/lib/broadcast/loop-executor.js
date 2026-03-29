"use strict";
/**
 * LOOP Executor
 *
 * Transforms partial sequences into complete LOOPs by applying transformations.
 * EXACT PORT of client-side LOOP executor logic.
 *
 * Each LOOP type has specific transformation rules that must be followed
 * precisely to produce valid circular sequences.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeLOOP = executeLOOP;
exports.determineEndPosition = determineEndPosition;
const types_1 = require("./types");
const circular_position_maps_1 = require("./circular-position-maps");
/**
 * Deep clone a beat
 */
function cloneBeat(beat) {
    return JSON.parse(JSON.stringify(beat));
}
/**
 * Validate that the sequence can perform the requested LOOP
 */
function validateSequence(sequence, sliceSize, loopType) {
    if (sequence.length < 2) {
        throw new Error("Sequence must have at least 2 beats (start position + 1 beat)");
    }
    const startPos = sequence[0].startPosition;
    const endPos = sequence[sequence.length - 1].endPosition;
    if (!startPos || !endPos) {
        throw new Error("Sequence beats must have valid start and end positions");
    }
    // For non-rotated LOOPs (mirror, swap, invert), end position should equal start position
    const isRotatedLoop = [
        types_1.LOOPType.ROTATED,
        types_1.LOOPType.ROTATED_SWAPPED,
        types_1.LOOPType.ROTATED_INVERTED,
        types_1.LOOPType.MIRRORED_ROTATED,
        types_1.LOOPType.MIRRORED_INVERTED_ROTATED,
    ].includes(loopType);
    if (isRotatedLoop) {
        const key = `${startPos},${endPos}`;
        const validationSet = sliceSize === types_1.SliceSize.HALVED ? circular_position_maps_1.HALVED_LOOPS : circular_position_maps_1.QUARTERED_LOOPS;
        if (!validationSet.has(key)) {
            throw new Error(`Invalid position pair for ${sliceSize} ${loopType}: ${startPos} → ${endPos}`);
        }
    }
}
/**
 * Calculate how many beats to add based on slice size
 */
function calculateEntriesToAdd(sequenceLength, sliceSize) {
    if (sliceSize === types_1.SliceSize.HALVED) {
        return sequenceLength; // Double the sequence
    }
    return sequenceLength * 3; // Quadruple the sequence
}
/**
 * Get index mapping for retrieving corresponding beats from first section
 */
function getIndexMap(sliceSize, length) {
    const map = {};
    if (sliceSize === types_1.SliceSize.QUARTERED) {
        const quarterLength = Math.floor(length / 4);
        for (let i = quarterLength + 1; i <= length; i++) {
            map[i] = i - quarterLength;
        }
    }
    else {
        const halfLength = Math.floor(length / 2);
        for (let i = halfLength + 1; i <= length; i++) {
            map[i] = i - halfLength;
        }
    }
    return map;
}
/**
 * Transform motion locations based on hand rotation direction
 */
function transformMotionForRotation(matchingMotion, previousMotion) {
    var _a;
    // Get hand rotation direction from the matching beat's motion
    const handRotDir = (0, circular_position_maps_1.getHandRotationDirection)(matchingMotion.startLocation, matchingMotion.endLocation);
    // Get the appropriate location map
    const locationMap = (0, circular_position_maps_1.getLocationMapForHandRotation)(handRotDir);
    // Calculate new end location by rotating the previous motion's end location
    const newEndLocation = (_a = locationMap[previousMotion.endLocation]) !== null && _a !== void 0 ? _a : previousMotion.endLocation;
    return {
        ...matchingMotion,
        startLocation: previousMotion.endLocation,
        endLocation: newEndLocation,
    };
}
/**
 * Apply mirror transformation to a motion
 */
function applyMirrorToMotion(motion) {
    var _a, _b;
    const mirrored = {
        ...motion,
        startLocation: (_a = circular_position_maps_1.LOCATION_MAP_MIRROR[motion.startLocation]) !== null && _a !== void 0 ? _a : motion.startLocation,
        endLocation: (_b = circular_position_maps_1.LOCATION_MAP_MIRROR[motion.endLocation]) !== null && _b !== void 0 ? _b : motion.endLocation,
    };
    // Swap rotation directions for mirror
    if (mirrored.rotationDirection === "cw") {
        mirrored.rotationDirection = "ccw";
    }
    else if (mirrored.rotationDirection === "ccw") {
        mirrored.rotationDirection = "cw";
    }
    return mirrored;
}
/**
 * Apply swap transformation (swap blue and red)
 */
function applySwapToBeat(beat) {
    const swapped = cloneBeat(beat);
    const tempBlue = { ...beat.blue };
    swapped.blue = { ...beat.red };
    swapped.red = tempBlue;
    return swapped;
}
/**
 * Apply invert transformation (pro <-> anti, reverse rotation)
 */
function applyInvertToMotion(motion) {
    const inverted = { ...motion };
    // Invert motion types
    if (inverted.motionType === "pro") {
        inverted.motionType = "anti";
    }
    else if (inverted.motionType === "anti") {
        inverted.motionType = "pro";
    }
    // Reverse rotation directions
    if (inverted.rotationDirection === "cw") {
        inverted.rotationDirection = "ccw";
    }
    else if (inverted.rotationDirection === "ccw") {
        inverted.rotationDirection = "cw";
    }
    return inverted;
}
/**
 * Calculate new end position from transformed locations
 */
function calculateEndPosition(blueEndLoc, redEndLoc) {
    return (0, circular_position_maps_1.getGridPositionFromLocations)(blueEndLoc, redEndLoc);
}
// ============================================================================
// LOOP Type Executors
// ============================================================================
/**
 * Execute Strict Rotated LOOP
 * Each subsequent section is rotated 90° (quartered) or 180° (halved)
 */
function executeStrictRotated(sequence, sliceSize) {
    const startPosition = sequence.shift();
    const sequenceLength = sequence.length;
    const entriesToAdd = calculateEntriesToAdd(sequenceLength, sliceSize);
    const finalLength = sequenceLength + entriesToAdd;
    const indexMap = getIndexMap(sliceSize, finalLength);
    let lastBeat = sequence[sequence.length - 1];
    let nextBeatNumber = lastBeat.beatNumber + 1;
    for (let i = 0; i < entriesToAdd; i++) {
        const matchingBeatNumber = indexMap[nextBeatNumber];
        if (matchingBeatNumber === undefined)
            continue;
        const matchingBeat = sequence[matchingBeatNumber - 1];
        if (!matchingBeat)
            continue;
        // Transform motions based on hand rotation
        const newBlue = transformMotionForRotation(matchingBeat.blue, lastBeat.blue);
        const newRed = transformMotionForRotation(matchingBeat.red, lastBeat.red);
        // Calculate new end position
        const newEndPosition = calculateEndPosition(newBlue.endLocation, newRed.endLocation);
        const newBeat = {
            ...matchingBeat,
            id: `beat-${nextBeatNumber}-${Date.now()}`,
            beatNumber: nextBeatNumber,
            startPosition: lastBeat.endPosition,
            endPosition: newEndPosition !== null && newEndPosition !== void 0 ? newEndPosition : lastBeat.endPosition,
            blue: newBlue,
            red: newRed,
        };
        sequence.push(newBeat);
        lastBeat = newBeat;
        nextBeatNumber++;
    }
    sequence.unshift(startPosition);
    return sequence;
}
/**
 * Execute Strict Mirrored LOOP
 * Second half is horizontally mirrored
 */
function executeStrictMirrored(sequence, sliceSize) {
    var _a, _b;
    const startPosition = sequence.shift();
    const sequenceLength = sequence.length;
    const entriesToAdd = calculateEntriesToAdd(sequenceLength, sliceSize);
    let lastBeat = sequence[sequence.length - 1];
    let nextBeatNumber = lastBeat.beatNumber + 1;
    // For mirrored, we iterate through the original sequence in reverse
    for (let i = sequenceLength - 1; i >= 0; i--) {
        const matchingBeat = sequence[i];
        if (!matchingBeat)
            continue;
        // Apply mirror transformation
        const newBlue = applyMirrorToMotion(matchingBeat.blue);
        const newRed = applyMirrorToMotion(matchingBeat.red);
        // Update locations to chain from previous beat
        newBlue.startLocation = lastBeat.blue.endLocation;
        newRed.startLocation = lastBeat.red.endLocation;
        // For mirror, the end location is the mirrored version of the start location
        newBlue.endLocation = (_a = circular_position_maps_1.LOCATION_MAP_MIRROR[matchingBeat.blue.startLocation]) !== null && _a !== void 0 ? _a : matchingBeat.blue.startLocation;
        newRed.endLocation = (_b = circular_position_maps_1.LOCATION_MAP_MIRROR[matchingBeat.red.startLocation]) !== null && _b !== void 0 ? _b : matchingBeat.red.startLocation;
        const newEndPosition = calculateEndPosition(newBlue.endLocation, newRed.endLocation);
        const newBeat = {
            ...matchingBeat,
            id: `beat-${nextBeatNumber}-${Date.now()}`,
            beatNumber: nextBeatNumber,
            startPosition: lastBeat.endPosition,
            endPosition: newEndPosition !== null && newEndPosition !== void 0 ? newEndPosition : startPosition.startPosition,
            blue: newBlue,
            red: newRed,
        };
        sequence.push(newBeat);
        lastBeat = newBeat;
        nextBeatNumber++;
        if (sequence.length >= sequenceLength + entriesToAdd)
            break;
    }
    sequence.unshift(startPosition);
    return sequence;
}
/**
 * Execute Strict Swapped LOOP
 * Second half has blue and red swapped
 */
function executeStrictSwapped(sequence, sliceSize) {
    const startPosition = sequence.shift();
    const sequenceLength = sequence.length;
    const entriesToAdd = calculateEntriesToAdd(sequenceLength, sliceSize);
    let lastBeat = sequence[sequence.length - 1];
    let nextBeatNumber = lastBeat.beatNumber + 1;
    for (let i = 0; i < Math.min(entriesToAdd, sequenceLength); i++) {
        const matchingBeat = sequence[i];
        if (!matchingBeat)
            continue;
        // Swap blue and red
        const swappedBeat = applySwapToBeat(matchingBeat);
        // Chain from previous beat
        swappedBeat.blue.startLocation = lastBeat.blue.endLocation;
        swappedBeat.red.startLocation = lastBeat.red.endLocation;
        const newEndPosition = calculateEndPosition(swappedBeat.blue.endLocation, swappedBeat.red.endLocation);
        const newBeat = {
            ...swappedBeat,
            id: `beat-${nextBeatNumber}-${Date.now()}`,
            beatNumber: nextBeatNumber,
            startPosition: lastBeat.endPosition,
            endPosition: newEndPosition !== null && newEndPosition !== void 0 ? newEndPosition : lastBeat.endPosition,
        };
        sequence.push(newBeat);
        lastBeat = newBeat;
        nextBeatNumber++;
    }
    sequence.unshift(startPosition);
    return sequence;
}
/**
 * Execute Strict Inverted LOOP
 * Second half has pro/anti inverted and rotation reversed
 */
function executeStrictInverted(sequence, sliceSize) {
    const startPosition = sequence.shift();
    const sequenceLength = sequence.length;
    const entriesToAdd = calculateEntriesToAdd(sequenceLength, sliceSize);
    let lastBeat = sequence[sequence.length - 1];
    let nextBeatNumber = lastBeat.beatNumber + 1;
    for (let i = 0; i < Math.min(entriesToAdd, sequenceLength); i++) {
        const matchingBeat = sequence[i];
        if (!matchingBeat)
            continue;
        // Apply invert transformation
        const newBlue = applyInvertToMotion(matchingBeat.blue);
        const newRed = applyInvertToMotion(matchingBeat.red);
        // Chain from previous beat
        newBlue.startLocation = lastBeat.blue.endLocation;
        newRed.startLocation = lastBeat.red.endLocation;
        const newEndPosition = calculateEndPosition(newBlue.endLocation, newRed.endLocation);
        const newBeat = {
            ...matchingBeat,
            id: `beat-${nextBeatNumber}-${Date.now()}`,
            beatNumber: nextBeatNumber,
            startPosition: lastBeat.endPosition,
            endPosition: newEndPosition !== null && newEndPosition !== void 0 ? newEndPosition : lastBeat.endPosition,
            blue: newBlue,
            red: newRed,
        };
        sequence.push(newBeat);
        lastBeat = newBeat;
        nextBeatNumber++;
    }
    sequence.unshift(startPosition);
    return sequence;
}
/**
 * Execute compound LOOP types by combining transformations
 */
function executeCompoundLoop(sequence, sliceSize, loopType) {
    const startPosition = sequence.shift();
    const sequenceLength = sequence.length;
    const entriesToAdd = calculateEntriesToAdd(sequenceLength, sliceSize);
    const finalLength = sequenceLength + entriesToAdd;
    const indexMap = getIndexMap(sliceSize, finalLength);
    let lastBeat = sequence[sequence.length - 1];
    let nextBeatNumber = lastBeat.beatNumber + 1;
    for (let i = 0; i < entriesToAdd; i++) {
        const matchingBeatNumber = indexMap[nextBeatNumber];
        const matchingBeatIndex = matchingBeatNumber !== undefined ? matchingBeatNumber - 1 : i % sequenceLength;
        const matchingBeat = sequence[matchingBeatIndex];
        if (!matchingBeat)
            continue;
        let newBlue = { ...matchingBeat.blue };
        let newRed = { ...matchingBeat.red };
        // Apply transformations based on LOOP type
        switch (loopType) {
            case types_1.LOOPType.ROTATED_SWAPPED:
                // Rotation then swap
                newBlue = transformMotionForRotation(matchingBeat.blue, lastBeat.blue);
                newRed = transformMotionForRotation(matchingBeat.red, lastBeat.red);
                const tempRS = newBlue;
                newBlue = newRed;
                newRed = tempRS;
                break;
            case types_1.LOOPType.MIRRORED_SWAPPED:
                // Mirror then swap
                newBlue = applyMirrorToMotion(matchingBeat.blue);
                newRed = applyMirrorToMotion(matchingBeat.red);
                const tempMS = newBlue;
                newBlue = newRed;
                newRed = tempMS;
                break;
            case types_1.LOOPType.ROTATED_INVERTED:
                // Rotation then invert
                newBlue = transformMotionForRotation(matchingBeat.blue, lastBeat.blue);
                newRed = transformMotionForRotation(matchingBeat.red, lastBeat.red);
                newBlue = applyInvertToMotion(newBlue);
                newRed = applyInvertToMotion(newRed);
                break;
            case types_1.LOOPType.MIRRORED_INVERTED:
                // Mirror then invert
                newBlue = applyMirrorToMotion(matchingBeat.blue);
                newRed = applyMirrorToMotion(matchingBeat.red);
                newBlue = applyInvertToMotion(newBlue);
                newRed = applyInvertToMotion(newRed);
                break;
            case types_1.LOOPType.MIRRORED_ROTATED:
                // Mirror then rotation
                newBlue = applyMirrorToMotion(matchingBeat.blue);
                newRed = applyMirrorToMotion(matchingBeat.red);
                newBlue = transformMotionForRotation(newBlue, lastBeat.blue);
                newRed = transformMotionForRotation(newRed, lastBeat.red);
                break;
            case types_1.LOOPType.SWAPPED_INVERTED:
                // Swap then invert
                const tempSI = matchingBeat.blue;
                newBlue = applyInvertToMotion(matchingBeat.red);
                newRed = applyInvertToMotion(tempSI);
                break;
            case types_1.LOOPType.MIRRORED_INVERTED_ROTATED:
                // Mirror, then invert, then rotation
                newBlue = applyMirrorToMotion(matchingBeat.blue);
                newRed = applyMirrorToMotion(matchingBeat.red);
                newBlue = applyInvertToMotion(newBlue);
                newRed = applyInvertToMotion(newRed);
                newBlue = transformMotionForRotation(newBlue, lastBeat.blue);
                newRed = transformMotionForRotation(newRed, lastBeat.red);
                break;
            default:
                // Fallback to rotation
                newBlue = transformMotionForRotation(matchingBeat.blue, lastBeat.blue);
                newRed = transformMotionForRotation(matchingBeat.red, lastBeat.red);
        }
        // Ensure chaining from previous beat
        newBlue.startLocation = lastBeat.blue.endLocation;
        newRed.startLocation = lastBeat.red.endLocation;
        const newEndPosition = calculateEndPosition(newBlue.endLocation, newRed.endLocation);
        const newBeat = {
            ...matchingBeat,
            id: `beat-${nextBeatNumber}-${Date.now()}`,
            beatNumber: nextBeatNumber,
            startPosition: lastBeat.endPosition,
            endPosition: newEndPosition !== null && newEndPosition !== void 0 ? newEndPosition : lastBeat.endPosition,
            blue: newBlue,
            red: newRed,
        };
        sequence.push(newBeat);
        lastBeat = newBeat;
        nextBeatNumber++;
    }
    sequence.unshift(startPosition);
    return sequence;
}
/**
 * Execute LOOP transformation on a partial sequence
 */
function executeLOOP(partialBeats, loopType, sliceSize) {
    // Clone the beats to avoid mutation
    const sequence = partialBeats.map(cloneBeat);
    // Validate sequence
    validateSequence(sequence, sliceSize, loopType);
    // Execute appropriate LOOP type
    switch (loopType) {
        case types_1.LOOPType.ROTATED:
            return executeStrictRotated(sequence, sliceSize);
        case types_1.LOOPType.MIRRORED:
            return executeStrictMirrored(sequence, sliceSize);
        case types_1.LOOPType.SWAPPED:
            return executeStrictSwapped(sequence, sliceSize);
        case types_1.LOOPType.INVERTED:
            return executeStrictInverted(sequence, sliceSize);
        case types_1.LOOPType.ROTATED_SWAPPED:
        case types_1.LOOPType.MIRRORED_SWAPPED:
        case types_1.LOOPType.ROTATED_INVERTED:
        case types_1.LOOPType.MIRRORED_INVERTED:
        case types_1.LOOPType.MIRRORED_ROTATED:
        case types_1.LOOPType.SWAPPED_INVERTED:
        case types_1.LOOPType.MIRRORED_INVERTED_ROTATED:
            return executeCompoundLoop(sequence, sliceSize, loopType);
        default:
            // Fallback to strict rotated
            console.warn(`Unknown LOOP type: ${loopType}, using ROTATED`);
            return executeStrictRotated(sequence, sliceSize);
    }
}
/**
 * Determine the required end position for a partial sequence
 * based on LOOP type and slice size
 */
function determineEndPosition(loopType, startPosition, sliceSize) {
    var _a, _b;
    // For rotated LOOPs, end position is rotated from start
    const isRotatedLoop = [
        types_1.LOOPType.ROTATED,
        types_1.LOOPType.ROTATED_SWAPPED,
        types_1.LOOPType.ROTATED_INVERTED,
        types_1.LOOPType.MIRRORED_ROTATED,
        types_1.LOOPType.MIRRORED_INVERTED_ROTATED,
    ].includes(loopType);
    if (isRotatedLoop) {
        if (sliceSize === types_1.SliceSize.HALVED) {
            return (_a = circular_position_maps_1.HALF_POSITION_MAP[startPosition]) !== null && _a !== void 0 ? _a : startPosition;
        }
        else {
            // For quartered, use clockwise quarter rotation
            return (_b = circular_position_maps_1.QUARTER_POSITION_MAP_CW[startPosition]) !== null && _b !== void 0 ? _b : startPosition;
        }
    }
    // For non-rotated LOOPs, end position equals start position
    return startPosition;
}
//# sourceMappingURL=loop-executor.js.map