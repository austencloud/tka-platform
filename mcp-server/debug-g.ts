/**
 * Debug script for letter G - tests orientation calculation
 *
 * PRO motion with 1 turn starting at "in" should flip to "out"
 * The renderer should auto-calculate this via preprocessInput()
 */
import { writeFileSync } from "fs";
import { getStandaloneRenderer } from "./src/core/standalone-renderer.js";
import { calculateOrientations } from "./src/core/orientation-calculator.js";

// NOTE: We intentionally omit endOrientation - the renderer should calculate it
const pictographG = {
  letter: "G",
  startPosition: "beta3",
  endPosition: "beta5",
  blueMotion: {
    motionType: "pro",
    rotationDirection: "cw",
    startLocation: "e",
    endLocation: "s",
    startOrientation: "in",
    // endOrientation NOT provided - should be calculated as "out"
    color: "blue" as const,
    turns: 1,
  },
  redMotion: {
    motionType: "pro",
    rotationDirection: "cw",
    startLocation: "e",
    endLocation: "s",
    startOrientation: "in",
    // endOrientation NOT provided - should be calculated as "out"
    color: "red" as const,
    turns: 1,
  },
};

async function main() {
  console.log("=== Debugging Letter G - Orientation Calculation ===\n");

  // Test orientation calculation directly
  console.log("Testing orientation calculator directly:");
  const blueOrientations = calculateOrientations({
    motionType: "pro",
    turns: 1,
    rotationDirection: "cw",
    startLocation: "e",
    endLocation: "s",
    startOrientation: "in",
  });
  console.log("  Blue PRO 1-turn: start=in -> end=" + blueOrientations.endOrientation);
  console.log("  Expected: out (PRO odd turns flip IN↔OUT)");

  const redOrientations = calculateOrientations({
    motionType: "pro",
    turns: 1,
    rotationDirection: "cw",
    startLocation: "e",
    endLocation: "s",
    startOrientation: "in",
  });
  console.log("  Red PRO 1-turn: start=in -> end=" + redOrientations.endOrientation);

  console.log("\nRendering pictograph (orientations calculated by renderer)...");

  const renderer = getStandaloneRenderer();
  const pngBuffer = await renderer.renderToPng(pictographG, {
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

  writeFileSync("C:/Users/Austen/Desktop/pictograph-G-debug.png", pngBuffer);
  console.log("\nSaved to: C:/Users/Austen/Desktop/pictograph-G-debug.png");
}

main().catch(console.error);
