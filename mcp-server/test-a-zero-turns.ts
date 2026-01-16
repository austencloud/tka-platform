/**
 * Test letter A with 0 turns vs 1 turn
 */
import { writeFileSync } from "fs";
import { getStandaloneRenderer } from "./src/core/standalone-renderer.js";

const pictographA_0turns = {
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
    color: "blue" as const,
    turns: 0,
  },
  redMotion: {
    motionType: "pro",
    rotationDirection: "cw",
    startLocation: "e",
    endLocation: "s",
    startOrientation: "in",
    color: "red" as const,
    turns: 0,
  },
};

const pictographA_1turn = {
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
    color: "blue" as const,
    turns: 1,
  },
  redMotion: {
    motionType: "pro",
    rotationDirection: "cw",
    startLocation: "e",
    endLocation: "s",
    startOrientation: "in",
    color: "red" as const,
    turns: 1,
  },
};

async function main() {
  const renderer = getStandaloneRenderer();

  // Render with 0 turns
  console.log("Rendering A with 0 turns...");
  const png0 = await renderer.renderToPng(pictographA_0turns, {
    darkMode: true,
    showTKA: true,
    showVTG: true,
    showElemental: true,
    showPositions: true,
    showGrid: true,
    showBlueMotion: true,
    showRedMotion: true,
    size: 600,
  });
  writeFileSync("C:/Users/Austen/Desktop/A-0-turns.png", png0);

  // Render with 1 turn
  console.log("Rendering A with 1 turn...");
  const png1 = await renderer.renderToPng(pictographA_1turn, {
    darkMode: true,
    showTKA: true,
    showVTG: true,
    showElemental: true,
    showPositions: true,
    showGrid: true,
    showBlueMotion: true,
    showRedMotion: true,
    size: 600,
  });
  writeFileSync("C:/Users/Austen/Desktop/A-1-turn.png", png1);

  console.log("Done! Compare A-0-turns.png vs A-1-turn.png");
}

main().catch(console.error);
