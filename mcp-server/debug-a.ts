/**
 * Debug script for letter A placement
 */
import { writeFileSync } from "fs";
import { getStandaloneRenderer } from "./src/core/standalone-renderer.js";
import { calculateArrowAdjustment, calculateOriKey } from "./src/core/arrow-adjustment.js";
import { calculateArrowPlacement } from "./src/core/arrow-placement.js";
import { GridMode, GridLocation } from "./src/core/enums.js";

const pictographA = {
  letter: "A",
  startPosition: "alpha3",
  endPosition: "alpha5",
  gridMode: "diamond",
  blueMotion: {
    motionType: "pro",
    rotationDirection: "cw",
    startLocation: "w",
    endLocation: "n",
    startOrientation: "in",
    endOrientation: "in",
    color: "blue" as const,
    turns: 1,
  },
  redMotion: {
    motionType: "pro",
    rotationDirection: "cw",
    startLocation: "e",
    endLocation: "s",
    startOrientation: "in",
    endOrientation: "in",
    color: "red" as const,
    turns: 1,
  },
};

async function main() {
  console.log("=== Debugging Letter A Placement ===\n");

  // Calculate ori key
  const oriKey = calculateOriKey(
    pictographA.blueMotion.endOrientation,
    pictographA.redMotion.endOrientation
  );
  console.log("Ori Key:", oriKey);

  // Calculate base arrow placements (correct parameter order!)
  console.log("\n--- Blue Arrow ---");
  const bluePlacement = calculateArrowPlacement(
    pictographA.blueMotion.motionType,
    pictographA.blueMotion.startLocation,
    pictographA.blueMotion.endLocation,
    pictographA.blueMotion.rotationDirection,
    GridMode.DIAMOND
  );
  console.log("Base placement:", bluePlacement);

  // Calculate adjustment
  const blueAdjustment = calculateArrowAdjustment(
    {
      letter: pictographA.letter,
      blueMotion: pictographA.blueMotion,
      redMotion: pictographA.redMotion,
      gridMode: GridMode.DIAMOND,
    },
    pictographA.blueMotion,
    bluePlacement.location
  );
  console.log("Adjustment:", blueAdjustment);
  console.log("Final position:", {
    x: bluePlacement.x + blueAdjustment[0],
    y: bluePlacement.y + blueAdjustment[1],
  });

  console.log("\n--- Red Arrow ---");
  const redPlacement = calculateArrowPlacement(
    pictographA.redMotion.motionType,
    pictographA.redMotion.startLocation,
    pictographA.redMotion.endLocation,
    pictographA.redMotion.rotationDirection,
    GridMode.DIAMOND
  );
  console.log("Base placement:", redPlacement);

  const redAdjustment = calculateArrowAdjustment(
    {
      letter: pictographA.letter,
      blueMotion: pictographA.blueMotion,
      redMotion: pictographA.redMotion,
      gridMode: GridMode.DIAMOND,
    },
    pictographA.redMotion,
    redPlacement.location
  );
  console.log("Adjustment:", redAdjustment);
  console.log("Final position:", {
    x: redPlacement.x + redAdjustment[0],
    y: redPlacement.y + redAdjustment[1],
  });

  // Render the pictograph
  console.log("\n--- Rendering ---");
  const renderer = getStandaloneRenderer();
  const pngBuffer = await renderer.renderToPng(pictographA, {
    darkMode: true,
    showTKA: true,
    showVTG: true,
    showElemental: true,
    showPositions: true,
    showGrid: true,
    showNonRadialPoints: true,
    showBlueMotion: true,
    showRedMotion: true,
    size: 600,
  });

  writeFileSync("C:/Users/Austen/Desktop/pictograph-A-debug.png", pngBuffer);
  console.log("\nSaved to: C:/Users/Austen/Desktop/pictograph-A-debug.png");
}

main().catch(console.error);
