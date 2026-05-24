const fs = require("fs");
const path = require("path");

async function main() {
  const THREE = await import("three");
  const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");

  const inputDir = path.join(__dirname, "..", "static", "models", "props", "buugeng-raw");
  const loader = new STLLoader();

  function loadSTL(filePath) {
    const buffer = fs.readFileSync(filePath);
    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    return loader.parse(ab);
  }

  function analyzeGeometry(geom, name) {
    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    const size = new THREE.Vector3();
    bb.getSize(size);
    const center = new THREE.Vector3();
    bb.getCenter(center);

    console.log(`\n=== ${name} ===`);
    console.log(`Vertices: ${geom.attributes.position.count}`);
    console.log(`BBox min: (${bb.min.x.toFixed(2)}, ${bb.min.y.toFixed(2)}, ${bb.min.z.toFixed(2)})`);
    console.log(`BBox max: (${bb.max.x.toFixed(2)}, ${bb.max.y.toFixed(2)}, ${bb.max.z.toFixed(2)})`);
    console.log(`Size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
    console.log(`Center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);

    const pos = geom.attributes.position.array;
    const vertCount = geom.attributes.position.count;

    const ySlices = {};
    for (let i = 0; i < vertCount; i++) {
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      const yBucket = Math.round(y / 5) * 5;
      if (!ySlices[yBucket]) ySlices[yBucket] = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, count: 0 };
      const s = ySlices[yBucket];
      s.minX = Math.min(s.minX, x);
      s.maxX = Math.max(s.maxX, x);
      s.minZ = Math.min(s.minZ, z);
      s.maxZ = Math.max(s.maxZ, z);
      s.count++;
    }

    console.log("\nY-slice cross sections (every 5 units):");
    const sortedKeys = Object.keys(ySlices).map(Number).sort((a, b) => a - b);
    for (const y of sortedKeys) {
      const s = ySlices[y];
      const xSpan = (s.maxX - s.minX).toFixed(1);
      const zSpan = (s.maxZ - s.minZ).toFixed(1);
      console.log(`  Y=${y}: X span=${xSpan} (${s.minX.toFixed(1)}..${s.maxX.toFixed(1)}), Z span=${zSpan} (${s.minZ.toFixed(1)}..${s.maxZ.toFixed(1)}), verts=${s.count}`);
    }
  }

  const geomA = loadSTL(path.join(inputDir, "Part_A.stl"));
  const geomB = loadSTL(path.join(inputDir, "Part_B.stl"));

  analyzeGeometry(geomA, "Part_A");
  analyzeGeometry(geomB, "Part_B");

  console.log("\n=== Overlap Analysis ===");
  geomA.computeBoundingBox();
  geomB.computeBoundingBox();

  const overlapX = Math.min(geomA.boundingBox.max.x, geomB.boundingBox.max.x) - Math.max(geomA.boundingBox.min.x, geomB.boundingBox.min.x);
  const overlapY = Math.min(geomA.boundingBox.max.y, geomB.boundingBox.max.y) - Math.max(geomA.boundingBox.min.y, geomB.boundingBox.min.y);
  const overlapZ = Math.min(geomA.boundingBox.max.z, geomB.boundingBox.max.z) - Math.max(geomA.boundingBox.min.z, geomB.boundingBox.min.z);
  console.log(`Overlap X: ${overlapX.toFixed(2)}`);
  console.log(`Overlap Y: ${overlapY.toFixed(2)}`);
  console.log(`Overlap Z: ${overlapZ.toFixed(2)}`);
}

main().catch(console.error);
