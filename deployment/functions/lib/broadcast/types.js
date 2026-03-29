"use strict";
/**
 * Broadcast Types
 *
 * TypeScript types for the live broadcast system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridPosition = exports.RotationDirection = exports.MotionType = exports.SliceSize = exports.LOOPType = void 0;
/**
 * LOOP types supported by the broadcast system.
 * Matches client-side LOOPType enum values.
 */
exports.LOOPType = {
    ROTATED: "ROTATED",
    MIRRORED: "MIRRORED",
    SWAPPED: "SWAPPED",
    INVERTED: "INVERTED",
    ROTATED_SWAPPED: "ROTATED_SWAPPED",
    MIRRORED_SWAPPED: "MIRRORED_SWAPPED",
    ROTATED_INVERTED: "ROTATED_INVERTED",
    MIRRORED_INVERTED: "MIRRORED_INVERTED",
    MIRRORED_ROTATED: "MIRRORED_ROTATED",
    SWAPPED_INVERTED: "SWAPPED_INVERTED",
    MIRRORED_INVERTED_ROTATED: "MIRRORED_INVERTED_ROTATED",
};
/**
 * Slice sizes for LOOP generation.
 */
exports.SliceSize = {
    HALVED: "HALVED",
    QUARTERED: "QUARTERED",
};
/**
 * Motion types for props.
 */
exports.MotionType = {
    PRO: "pro",
    ANTI: "anti",
    STATIC: "static",
    DASH: "dash",
};
/**
 * Rotation directions.
 */
exports.RotationDirection = {
    CW: "cw",
    CCW: "ccw",
    NO_ROT: "no_rot",
};
/**
 * Grid positions (simplified for broadcast).
 */
exports.GridPosition = {
    ALPHA1: "alpha1",
    ALPHA2: "alpha2",
    ALPHA3: "alpha3",
    ALPHA4: "alpha4",
    ALPHA5: "alpha5",
    ALPHA6: "alpha6",
    ALPHA7: "alpha7",
    ALPHA8: "alpha8",
    BETA1: "beta1",
    BETA2: "beta2",
    BETA3: "beta3",
    BETA4: "beta4",
    BETA5: "beta5",
    BETA6: "beta6",
    BETA7: "beta7",
    BETA8: "beta8",
    GAMMA1: "gamma1",
    GAMMA2: "gamma2",
    GAMMA3: "gamma3",
    GAMMA4: "gamma4",
    GAMMA5: "gamma5",
    GAMMA6: "gamma6",
    GAMMA7: "gamma7",
    GAMMA8: "gamma8",
};
//# sourceMappingURL=types.js.map