const fs = require("fs");
const path = require("path");

async function main() {
  const glbPath = path.join(__dirname, "..", "static", "models", "props", "buugeng.glb");
  const buffer = fs.readFileSync(glbPath);

  const jsonLen = buffer.readUInt32LE(12);
  const jsonStr = buffer.slice(20, 20 + jsonLen).toString("utf8").trim();
  const gltf = JSON.parse(jsonStr);

  const binOffset = 20 + jsonLen;
  const binData = buffer.slice(binOffset + 8);

  const posView = gltf.bufferViews[0];
  const posData = new Float32Array(binData.buffer, binData.byteOffset + posView.byteOffset, posView.byteLength / 4);
  const vertexCount = gltf.accessors[0].count;

  // Sample the shape: for each Y slice, find the X centroid
  const slices = {};
  for (let i = 0; i < vertexCount; i++) {
    const x = posData[i * 3];
    const y = posData[i * 3 + 1];
    const bucket = Math.round(y * 40) / 40; // 0.025 resolution
    if (!slices[bucket]) slices[bucket] = { sumX: 0, count: 0, minX: Infinity, maxX: -Infinity };
    slices[bucket].sumX += x;
    slices[bucket].count++;
    slices[bucket].minX = Math.min(slices[bucket].minX, x);
    slices[bucket].maxX = Math.max(slices[bucket].maxX, x);
  }

  const sortedY = Object.keys(slices).map(Number).sort((a, b) => a - b);

  console.log("ASCII top-down view of buugeng shape (X vs Y):");
  console.log("Y value | X range                              | centroid");
  console.log("--------|---------------------------------------|--------");

  const WIDTH = 40;
  for (const y of sortedY) {
    const s = slices[y];
    const avgX = s.sumX / s.count;

    // Map X from [-0.45, 0.45] to [0, WIDTH]
    const toCol = (x) => Math.round(((x + 0.45) / 0.9) * WIDTH);
    const minCol = Math.max(0, toCol(s.minX));
    const maxCol = Math.min(WIDTH, toCol(s.maxX));
    const avgCol = toCol(avgX);

    let row = Array(WIDTH + 1).fill(" ");
    for (let c = minCol; c <= maxCol; c++) row[c] = "█";
    row[avgCol] = "●";

    console.log(`${y.toFixed(3).padStart(7)} | ${row.join("")} | ${avgX.toFixed(3)}`);
  }

  // Check for gaps - any Y values with 0 vertices?
  console.log("\n=== Gap check ===");
  for (let i = 1; i < sortedY.length; i++) {
    const gap = sortedY[i] - sortedY[i - 1];
    if (gap > 0.03) {
      console.log(`GAP: Y=${sortedY[i-1].toFixed(3)} to Y=${sortedY[i].toFixed(3)} (${gap.toFixed(3)} units)`);
    }
  }
  if (sortedY.length > 0) {
    let maxGap = 0;
    for (let i = 1; i < sortedY.length; i++) {
      maxGap = Math.max(maxGap, sortedY[i] - sortedY[i-1]);
    }
    console.log(`Max gap between slices: ${maxGap.toFixed(4)} units`);
    console.log(`Total Y slices: ${sortedY.length}`);
  }
}

main().catch(console.error);
