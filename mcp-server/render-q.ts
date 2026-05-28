import { getStandaloneRenderer } from "./src/core/standalone-renderer.js";
import { Orientation } from "./src/core/enums.js";
import { writeFileSync } from "fs";

const input = {
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
  console.log("Starting render...");
  const renderer = getStandaloneRenderer();
  console.log("Got renderer");
  const base64 = await renderer.renderToBase64(input, {
    darkMode: true,
    showTKA: true,
    showTND: true,
    showPositions: true,
    showGrid: true,
    showBlueMotion: true,
    showRedMotion: true,
    size: 500,
  });
  console.log("Got base64, length:", base64.length);
  writeFileSync("C:/Users/Austen/Desktop/pictograph-Q.png", Buffer.from(base64, "base64"));
  console.log("Done! Saved to C:/Users/Austen/Desktop/pictograph-Q.png");
}

main().catch(e => console.error("Error:", e));
