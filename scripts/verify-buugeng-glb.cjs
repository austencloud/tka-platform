const fs = require("fs");
const path = require("path");

async function main() {
  const THREE = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");

  const glbPath = path.join(__dirname, "..", "static", "models", "props", "buugeng.glb");
  const stat = fs.statSync(glbPath);
  console.log(`File: ${glbPath}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`Modified: ${stat.mtime.toISOString()}`);

  const buffer = fs.readFileSync(glbPath);

  // Parse GLB header
  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);
  const totalLen = buffer.readUInt32LE(8);
  console.log(`\nGLB: magic=0x${magic.toString(16)}, version=${version}, totalLen=${totalLen}`);

  // Parse JSON chunk
  const jsonLen = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  const jsonStr = buffer.slice(20, 20 + jsonLen).toString("utf8").trim();
  const gltf = JSON.parse(jsonStr);
  console.log(`JSON chunk: ${jsonLen} bytes`);

  // Parse BIN chunk
  const binOffset = 20 + jsonLen;
  const binLen = buffer.readUInt32LE(binOffset);
  const binType = buffer.readUInt32LE(binOffset + 4);
  const binData = buffer.slice(binOffset + 8, binOffset + 8 + binLen);
  console.log(`BIN chunk: ${binLen} bytes`);

  // Read position accessor
  const posAccessor = gltf.accessors[0];
  const posView = gltf.bufferViews[posAccessor.bufferView];
  const posData = new Float32Array(binData.buffer, binData.byteOffset + posView.byteOffset, posView.byteLength / 4);
  const vertexCount = posAccessor.count;

  console.log(`\nVertices: ${vertexCount}`);
  console.log(`Position min: [${posAccessor.min.map(v => v.toFixed(3)).join(", ")}]`);
  console.log(`Position max: [${posAccessor.max.map(v => v.toFixed(3)).join(", ")}]`);

  // After conversion: X=width, Y=height (was Z), Z=depth (was Y, thin)
  // Check for gaps in Y (the long axis after rotation)
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < vertexCount; i++) {
    const x = posData[i * 3];
    const y = posData[i * 3 + 1];
    const z = posData[i * 3 + 2];
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }

  console.log(`\nActual vertex bounds:`);
  console.log(`X: ${minX.toFixed(4)} to ${maxX.toFixed(4)} (span: ${(maxX-minX).toFixed(4)})`);
  console.log(`Y: ${minY.toFixed(4)} to ${maxY.toFixed(4)} (span: ${(maxY-minY).toFixed(4)})`);
  console.log(`Z: ${minZ.toFixed(4)} to ${maxZ.toFixed(4)} (span: ${(maxZ-minZ).toFixed(4)})`);

  // Check for vertex density around Y=0 (the join point after rotation)
  // After rotation: original Z -> -Y, so junction at original Z=0 -> Y=0
  const yBuckets = {};
  for (let i = 0; i < vertexCount; i++) {
    const y = posData[i * 3 + 1];
    const bucket = Math.round(y * 50) / 50; // 0.02 resolution
    yBuckets[bucket] = (yBuckets[bucket] || 0) + 1;
  }

  const midY = (minY + maxY) / 2;
  console.log(`\nVertex density around midpoint (Y=${midY.toFixed(3)}):`);
  const sortedBuckets = Object.keys(yBuckets).map(Number).sort((a, b) => a - b);
  const nearMid = sortedBuckets.filter(y => Math.abs(y - midY) < 0.05);
  if (nearMid.length === 0) {
    console.log("  NO VERTICES near midpoint! Gap still exists.");
    // Find the gap
    let maxGap = 0, gapStart = 0, gapEnd = 0;
    for (let i = 1; i < sortedBuckets.length; i++) {
      const gap = sortedBuckets[i] - sortedBuckets[i-1];
      if (gap > maxGap) {
        maxGap = gap;
        gapStart = sortedBuckets[i-1];
        gapEnd = sortedBuckets[i];
      }
    }
    console.log(`  Largest gap: Y=${gapStart.toFixed(4)} to Y=${gapEnd.toFixed(4)} (${maxGap.toFixed(4)} units)`);
  } else {
    for (const y of nearMid) {
      console.log(`  Y=${y.toFixed(4)}: ${yBuckets[y]} vertices`);
    }
    console.log("  Parts appear CONNECTED at midpoint.");
  }
}

main().catch(console.error);
