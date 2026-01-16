/**
 * Output SVG to file for debugging transforms
 */
import { writeFileSync } from "fs";
import { getStandaloneRenderer } from "./src/core/standalone-renderer.js";
import { Orientation } from "./src/core/enums.js";

// Correct Q pictograph data from MCP tool
const pictographInput = {
  letter: "Q",
  startPosition: "gamma11",
  endPosition: "gamma5",
  blueMotion: {
    motionType: "anti",
    rotationDirection: "cw",
    startLocation: "s",
    endLocation: "e",
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    color: "blue",
    turns: 1,
  },
  redMotion: {
    motionType: "anti",
    rotationDirection: "ccw",
    startLocation: "e",
    endLocation: "s",
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    color: "red",
    turns: 1,
  },
};

async function main() {
  const renderer = getStandaloneRenderer();
  const svg = await renderer.renderToSvg(pictographInput, {
    darkMode: true,
    showTKA: true,
    showVTG: true,
    showElemental: true,
    showPositions: true,
    showGrid: true,
    showBlueMotion: true,
    showRedMotion: true,
  });

  writeFileSync("C:/Users/Austen/Desktop/pictograph-Q.svg", svg);
  console.log("SVG saved to: C:/Users/Austen/Desktop/pictograph-Q.svg");

  // Also save PNG for easier viewing
  const pngBuffer = await renderer.renderToPng(pictographInput, {
    darkMode: true,
    showTKA: true,
    showVTG: true,
    showElemental: true,
    showPositions: true,
    showGrid: true,
    showBlueMotion: true,
    showRedMotion: true,
    size: 500,
  });
  writeFileSync("C:/Users/Austen/Desktop/pictograph-Q.png", pngBuffer);
  console.log("PNG saved to: C:/Users/Austen/Desktop/pictograph-Q.png");

  // Print all transforms to see props and arrows
  const lines = svg.split("\n");
  for (const line of lines) {
    if (line.includes("transform") && line.includes("translate(")) {
      console.log("\n" + line.trim().substring(0, 300));
    }
  }
}

main().catch(console.error);
