/**
 * Orientation Propagator Implementation
 *
 * Handles propagation of prop orientations through a sequence.
 * Includes orientation calculation based on motion parameters.
 */
const CLOCKWISE_PAIRS = [
    ["s", "w"], ["w", "n"], ["n", "e"], ["e", "s"],
    ["ne", "se"], ["se", "sw"], ["sw", "nw"], ["nw", "ne"],
];
const COUNTER_CLOCKWISE_PAIRS = [
    ["w", "s"], ["n", "w"], ["e", "n"], ["s", "e"],
    ["ne", "nw"], ["nw", "sw"], ["sw", "se"], ["se", "ne"],
];
const DASH_PAIRS = [
    ["s", "n"], ["w", "e"], ["n", "s"], ["e", "w"],
    ["ne", "sw"], ["se", "nw"], ["sw", "ne"], ["nw", "se"],
];
const STATIC_PAIRS = [
    ["n", "n"], ["e", "e"], ["s", "s"], ["w", "w"],
    ["ne", "ne"], ["se", "se"], ["sw", "sw"], ["nw", "nw"],
];
// Build handpath map
const handpathMap = new Map();
CLOCKWISE_PAIRS.forEach(([start, end]) => {
    handpathMap.set(`${start}_${end}`, "cw");
});
COUNTER_CLOCKWISE_PAIRS.forEach(([start, end]) => {
    handpathMap.set(`${start}_${end}`, "ccw");
});
DASH_PAIRS.forEach(([start, end]) => {
    handpathMap.set(`${start}_${end}`, "dash");
});
STATIC_PAIRS.forEach(([start, end]) => {
    handpathMap.set(`${start}_${end}`, "static");
});
function getHandpathDirection(startLocation, endLocation) {
    const key = `${startLocation.toLowerCase()}_${endLocation.toLowerCase()}`;
    return handpathMap.get(key) || "static";
}
// ============================================================================
// ORIENTATION SWITCHING
// ============================================================================
function switchOrientation(ori) {
    const switchMap = {
        in: "out",
        out: "in",
        clock: "counter",
        counter: "clock",
    };
    return switchMap[ori] || ori;
}
// ============================================================================
// WHOLE TURN ORIENTATION
// ============================================================================
function calculateWholeTurnOrientation(motionType, turns, startOrientation) {
    const type = motionType.toLowerCase();
    const isEvenTurns = turns % 2 === 0;
    if (type === "pro" || type === "static") {
        return isEvenTurns ? startOrientation : switchOrientation(startOrientation);
    }
    else if (type === "anti" || type === "dash") {
        return isEvenTurns ? switchOrientation(startOrientation) : startOrientation;
    }
    return startOrientation;
}
// ============================================================================
// HALF TURN ORIENTATION
// ============================================================================
function calculateHalfTurnOrientation(motionType, turns, startOrientation, rotationDirection) {
    const type = motionType.toLowerCase();
    const rotDir = rotationDirection.toLowerCase();
    const isCW = rotDir === "cw" || rotDir === "clockwise";
    const isFirstHalf = turns % 2 === 0.5; // 0.5, 2.5 vs 1.5, 3.5
    // ANTI/DASH orientation map
    if (type === "anti" || type === "dash") {
        if (startOrientation === "in") {
            return isCW
                ? (isFirstHalf ? "clock" : "counter")
                : (isFirstHalf ? "counter" : "clock");
        }
        else if (startOrientation === "out") {
            return isCW
                ? (isFirstHalf ? "counter" : "clock")
                : (isFirstHalf ? "clock" : "counter");
        }
        else if (startOrientation === "clock") {
            return isCW
                ? (isFirstHalf ? "out" : "in")
                : (isFirstHalf ? "in" : "out");
        }
        else if (startOrientation === "counter") {
            return isCW
                ? (isFirstHalf ? "in" : "out")
                : (isFirstHalf ? "out" : "in");
        }
    }
    // PRO/STATIC orientation map
    if (type === "pro" || type === "static") {
        if (startOrientation === "in") {
            return isCW
                ? (isFirstHalf ? "counter" : "clock")
                : (isFirstHalf ? "clock" : "counter");
        }
        else if (startOrientation === "out") {
            return isCW
                ? (isFirstHalf ? "clock" : "counter")
                : (isFirstHalf ? "counter" : "clock");
        }
        else if (startOrientation === "clock") {
            return isCW
                ? (isFirstHalf ? "in" : "out")
                : (isFirstHalf ? "out" : "in");
        }
        else if (startOrientation === "counter") {
            return isCW
                ? (isFirstHalf ? "out" : "in")
                : (isFirstHalf ? "in" : "out");
        }
    }
    return startOrientation;
}
// ============================================================================
// FLOAT ORIENTATION
// ============================================================================
function calculateFloatOrientation(startOrientation, handpathDirection) {
    const floatMap = {
        "in_cw": "clock",
        "in_ccw": "counter",
        "out_cw": "counter",
        "out_ccw": "clock",
        "clock_cw": "out",
        "clock_ccw": "in",
        "counter_cw": "in",
        "counter_ccw": "out",
    };
    const key = `${startOrientation}_${handpathDirection}`;
    return floatMap[key] || startOrientation;
}
// ============================================================================
// ORIENTATION CALCULATOR
// ============================================================================
/**
 * Calculate end orientation from motion data.
 */
export function calculateEndOrientation(motionType, turns = 0, rotationDirection = "cw", startLocation, endLocation, startOrientation = "in") {
    const type = motionType?.toLowerCase() || "static";
    // Normalize rotation direction
    const rotDir = rotationDirection?.toLowerCase() || "cw";
    const effectiveRotDir = (rotDir === "norotation" || rotDir === "none") ? "cw" : rotDir;
    // FLOAT motion: use handpath-based calculation
    if (type === "float" || turns === "fl") {
        const handpath = getHandpathDirection(startLocation, endLocation);
        return calculateFloatOrientation(startOrientation, handpath);
    }
    // Ensure turns is a number for further calculations
    const turnsNum = typeof turns === "number" ? turns : 0;
    // Whole turns (0, 1, 2, 3)
    if (turnsNum === 0 || turnsNum === 1 || turnsNum === 2 || turnsNum === 3) {
        return calculateWholeTurnOrientation(type, turnsNum, startOrientation);
    }
    // Half turns (0.5, 1.5, 2.5, 3.5)
    return calculateHalfTurnOrientation(type, turnsNum, startOrientation, effectiveRotDir);
}
// ============================================================================
// ORIENTATION CALCULATOR SERVICE
// ============================================================================
/**
 * Standalone orientation calculator service.
 */
export class OrientationCalculator {
    calculateEndOrientation(motionType, turns, rotationDirection, startLocation, endLocation, startOrientation) {
        return calculateEndOrientation(motionType, turns, rotationDirection, startLocation, endLocation, startOrientation);
    }
}
// ============================================================================
// ORIENTATION PROPAGATOR
// ============================================================================
/**
 * Propagates orientations through a sequence.
 */
export class OrientationPropagator {
    calculator;
    constructor(calculator) {
        this.calculator = calculator;
    }
    propagateForColor(steps, color, initialOrientation) {
        const updatedSteps = [...steps];
        let previousEndOrientation = initialOrientation;
        // Start from step 1 (skip the start position at step 0)
        for (let i = 1; i < updatedSteps.length; i++) {
            const step = updatedSteps[i];
            if (!step)
                continue;
            const motion = color === "blue" ? step.blueMotion : step.redMotion;
            if (!motion)
                continue;
            // Calculate new end orientation based on this beat's motion
            const newEndOrientation = this.calculator.calculateEndOrientation(motion.motionType, motion.turns ?? 0, motion.rotationDirection || "cw", motion.startLocation, motion.endLocation, previousEndOrientation);
            // Update this step with correct orientations
            const updatedMotion = {
                ...motion,
                startOrientation: previousEndOrientation,
                endOrientation: newEndOrientation,
            };
            updatedSteps[i] = {
                ...step,
                blueMotion: color === "blue" ? updatedMotion : step.blueMotion,
                redMotion: color === "red" ? updatedMotion : step.redMotion,
            };
            previousEndOrientation = newEndOrientation;
        }
        return updatedSteps;
    }
    recalculateAll(result) {
        if (!result.isValid || result.steps.length === 0) {
            return result;
        }
        // Get the start position (step 0)
        const startPosition = result.steps[0];
        if (!startPosition) {
            return result;
        }
        let updatedSteps = [...result.steps];
        // Recalculate orientations for blue prop
        const blueStartOrientation = (startPosition.blueMotion.endOrientation || "in");
        updatedSteps = this.propagateForColor(updatedSteps, "blue", blueStartOrientation);
        // Recalculate orientations for red prop
        const redStartOrientation = (startPosition.redMotion.endOrientation || "in");
        updatedSteps = this.propagateForColor(updatedSteps, "red", redStartOrientation);
        return {
            ...result,
            steps: updatedSteps,
        };
    }
}
