/**
 * Test script for the new standalone renderer
 */
import { writeFileSync } from "fs";
import { getStandaloneRenderer } from "./src/core/standalone-renderer.js";
import { Orientation } from "./src/core/enums.js";

const pictographInput = {
  letter: "A",
  startPosition: "alpha3",
  endPosition: "alpha5",
  blueMotion: {
    motionType: "pro",
    rotationDirection: "cw",
    startLocation: "w",
    endLocation: "n",
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    color: "blue",
  },
  redMotion: {
    motionType: "pro",
    rotationDirection: "cw",
    startLocation: "e",
    endLocation: "s",
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    color: "red",
  },
};

const visibility = {
  darkMode: true,
  size: 800,
  showTKA: true,
  showVTG: true,
  showPositions: true,
  showGrid: true,
  showBlueMotion: true,
  showRedMotion: true,
};

async function main() {
  console.log("Testing new standalone renderer...");
  console.log("Input:", JSON.stringify(pictographInput, null, 2));

  const renderer = getStandaloneRenderer();
  const pngBuffer = await renderer.renderToPng(pictographInput, visibility);

  const outputPath = "C:/Users/Austen/Desktop/pictograph-A-v2.png";
  writeFileSync(outputPath, pngBuffer);
  console.log(`\nSaved to: ${outputPath}`);
  console.log("\nCompare with the old version at pictograph-A.png");
}

main().catch(console.error);
