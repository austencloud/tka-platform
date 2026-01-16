/**
 * Debug script to check placement calculations
 */
import { calculatePropPlacement } from "./src/core/prop-placement.js";
import { calculateArrowPlacement } from "./src/core/arrow-placement.js";
import { GridLocation, GridMode, MotionType, Orientation } from "./src/core/enums.js";

console.log("=== PROP PLACEMENT DEBUG ===\n");

// Blue motion: W→N, orientation IN
const blueProp = calculatePropPlacement(
  GridLocation.NORTH,  // end location
  Orientation.IN,      // orientation
  GridMode.DIAMOND
);
console.log("Blue prop (end=N, ori=IN, diamond):", blueProp);
console.log("  Expected: rotation=90 (pointing down/south)");

// Red motion: E→S, orientation IN
const redProp = calculatePropPlacement(
  GridLocation.SOUTH,  // end location
  Orientation.IN,      // orientation
  GridMode.DIAMOND
);
console.log("Red prop (end=S, ori=IN, diamond):", redProp);
console.log("  Expected: rotation=270 (pointing up/north)");

console.log("\n=== ARROW PLACEMENT DEBUG ===\n");

// Blue arrow: pro cw from W→N
const blueArrow = calculateArrowPlacement(
  MotionType.PRO,
  GridLocation.WEST,   // start
  GridLocation.NORTH,  // end
  "cw",
  GridMode.DIAMOND
);
console.log("Blue arrow (pro cw W→N):", blueArrow);
console.log("  Expected: location=NW, rotation from proClockwiseMap[NW]=270");

// Red arrow: pro cw from E→S
const redArrow = calculateArrowPlacement(
  MotionType.PRO,
  GridLocation.EAST,   // start
  GridLocation.SOUTH,  // end
  "cw",
  GridMode.DIAMOND
);
console.log("Red arrow (pro cw E→S):", redArrow);
console.log("  Expected: location=SE, rotation from proClockwiseMap[SE]=90");
