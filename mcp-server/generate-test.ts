/**
 * Quick test to generate and save a pictograph
 */
import { writeFileSync } from "fs";
import { getStandalonePictographRenderer } from "./StandalonePictographRenderer.js";

const pictographInput = {
  letter: "A",
  startPosition: "alpha3",
  endPosition: "alpha5",
  blueMotion: {
    motionType: "pro",
    rotationDirection: "cw",
    startLocation: "w",
    endLocation: "n",
    color: "blue",
  },
  redMotion: {
    motionType: "pro",
    rotationDirection: "cw",
    startLocation: "e",
    endLocation: "s",
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
  console.log("Generating pictograph A...");
  const renderer = getStandalonePictographRenderer();
  const pngBuffer = await renderer.renderToPng(pictographInput, visibility);

  const outputPath = "C:/Users/Austen/Desktop/pictograph-A.png";
  writeFileSync(outputPath, pngBuffer);
  console.log(`Saved to: ${outputPath}`);
}

main().catch(console.error);
