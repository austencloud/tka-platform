/**
 * Extract animation from FBX and save as a minimal GLB.
 * Usage: node scripts/convert-fbx.mjs <input.fbx> <output.glb>
 *
 * Instead of fighting GLTFExporter in Node, we:
 * 1. Parse the FBX to get the AnimationClip
 * 2. Build a minimal glTF JSON + binary buffer manually
 * 3. Pack as GLB (binary glTF container)
 */

// Stub browser globals for FBXLoader
class StubImage {
  addEventListener(e, cb) { if (e === "load") setTimeout(cb, 0); }
  removeEventListener() {}
  set src(_) {}
  get width() { return 1; }
  get height() { return 1; }
}
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.Image = StubImage;
globalThis.document = {
  createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {}, getContext() { return null; } }),
  createElement: (tag) => {
    if (tag === "canvas") return { getContext() { return { drawImage() {}, getImageData() { return { data: new Uint8Array(4) }; } }; }, width: 1, height: 1, toDataURL() { return ""; } };
    if (tag === "img") return new StubImage();
    return { style: {} };
  },
};
globalThis.Blob = globalThis.Blob || class Blob { constructor(p) { this._p = p; } };
const OrigURL = globalThis.URL;
if (!OrigURL.createObjectURL) OrigURL.createObjectURL = () => "blob:stub";
if (!OrigURL.revokeObjectURL) OrigURL.revokeObjectURL = () => {};
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
globalThis.FileReader = class FileReader {
  readAsArrayBuffer() { setTimeout(() => { this.result = new ArrayBuffer(0); if (this.onload) this.onload(); }, 0); }
  addEventListener(e, cb) { if (e === "load") this.onload = cb; }
};

import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { readFileSync, writeFileSync } from "fs";

const fbxPath = process.argv[2];
const outPath = process.argv[3];

if (!fbxPath || !outPath) {
  console.error("Usage: node scripts/convert-fbx.mjs <input.fbx> <output.glb>");
  process.exit(1);
}

// Parse FBX
const buffer = readFileSync(fbxPath);
const loader = new FBXLoader();
const fbx = loader.parse(buffer.buffer, "");

const clip = fbx.animations.find(c => c.tracks.length > 0);
if (!clip) { console.error("No animation tracks found!"); process.exit(1); }

console.log(`Animation: "${clip.name}" duration=${clip.duration.toFixed(2)}s tracks=${clip.tracks.length}`);

// Build minimal glTF with animation data
// We need: nodes (one per bone), an animation, and accessor/bufferView/buffer for keyframe data

// Collect all unique bone names from tracks
const boneNames = [...new Set(clip.tracks.map(t => t.name.split(".")[0]))];
const nodeIndex = {};
boneNames.forEach((name, i) => { nodeIndex[name] = i; });

const nodes = boneNames.map(name => ({ name }));

// Build binary buffer: all keyframe data packed sequentially
const bufferParts = [];
let byteOffset = 0;
const accessors = [];
const bufferViews = [];

function addAccessor(data, type, componentType) {
  const float32 = new Float32Array(data);
  const bytes = new Uint8Array(float32.buffer);

  bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: bytes.byteLength,
  });

  const elemSize = type === "VEC4" ? 4 : type === "VEC3" ? 3 : 1;
  const count = float32.length / elemSize;

  // Compute min/max
  const min = new Array(elemSize).fill(Infinity);
  const max = new Array(elemSize).fill(-Infinity);
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < elemSize; j++) {
      const v = float32[i * elemSize + j];
      if (v < min[j]) min[j] = v;
      if (v > max[j]) max[j] = v;
    }
  }

  accessors.push({
    bufferView: bufferViews.length - 1,
    componentType: componentType || 5126, // FLOAT
    count,
    type,
    min: elemSize === 1 ? [min[0]] : min,
    max: elemSize === 1 ? [max[0]] : max,
  });

  bufferParts.push(bytes);
  byteOffset += bytes.byteLength;

  // Pad to 4-byte alignment
  const padding = (4 - (bytes.byteLength % 4)) % 4;
  if (padding > 0) {
    bufferParts.push(new Uint8Array(padding));
    byteOffset += padding;
  }

  return accessors.length - 1;
}

// Build animation channels and samplers
const channels = [];
const samplers = [];

for (const track of clip.tracks) {
  const [boneName, property] = track.name.split(".");
  const targetNode = nodeIndex[boneName];
  if (targetNode === undefined) continue;

  // Map Three.js property names to glTF target paths
  let targetPath;
  let accessorType;
  if (property === "quaternion") {
    targetPath = "rotation";
    accessorType = "VEC4";
  } else if (property === "position") {
    targetPath = "translation";
    accessorType = "VEC3";
  } else if (property === "scale") {
    targetPath = "scale";
    accessorType = "VEC3";
  } else {
    continue; // Skip unknown properties
  }

  // Add time accessor
  const times = Array.from(track.times);
  const timeAccessorIdx = addAccessor(times, "SCALAR");

  // Add value accessor
  const values = Array.from(track.values);
  const valueAccessorIdx = addAccessor(values, accessorType);

  samplers.push({
    input: timeAccessorIdx,
    output: valueAccessorIdx,
    interpolation: "LINEAR",
  });

  channels.push({
    sampler: samplers.length - 1,
    target: {
      node: targetNode,
      path: targetPath,
    },
  });
}

// Concatenate all buffer parts
const totalByteLength = bufferParts.reduce((sum, p) => sum + p.byteLength, 0);
const binaryBuffer = new Uint8Array(totalByteLength);
let offset = 0;
for (const part of bufferParts) {
  binaryBuffer.set(part, offset);
  offset += part.byteLength;
}

// Build glTF JSON
const gltf = {
  asset: { version: "2.0", generator: "tka-fbx-converter" },
  scene: 0,
  scenes: [{ nodes: boneNames.map((_, i) => i) }],
  nodes,
  animations: [{
    name: clip.name,
    channels,
    samplers,
  }],
  accessors,
  bufferViews,
  buffers: [{ byteLength: totalByteLength }],
};

const jsonString = JSON.stringify(gltf);
const jsonBuffer = new TextEncoder().encode(jsonString);

// Pad JSON to 4-byte alignment
const jsonPadding = (4 - (jsonBuffer.byteLength % 4)) % 4;
const paddedJsonLength = jsonBuffer.byteLength + jsonPadding;

// Pad binary to 4-byte alignment
const binPadding = (4 - (binaryBuffer.byteLength % 4)) % 4;
const paddedBinLength = binaryBuffer.byteLength + binPadding;

// GLB header: magic + version + length
// Chunk 0: JSON
// Chunk 1: BIN
const headerSize = 12;
const jsonChunkHeaderSize = 8;
const binChunkHeaderSize = 8;
const totalSize = headerSize + jsonChunkHeaderSize + paddedJsonLength + binChunkHeaderSize + paddedBinLength;

const glb = new ArrayBuffer(totalSize);
const view = new DataView(glb);

// GLB header
view.setUint32(0, 0x46546C67, true); // magic: "glTF"
view.setUint32(4, 2, true);          // version: 2
view.setUint32(8, totalSize, true);   // total length

// JSON chunk
let pos = 12;
view.setUint32(pos, paddedJsonLength, true); pos += 4;
view.setUint32(pos, 0x4E4F534A, true); pos += 4; // type: "JSON"
new Uint8Array(glb, pos, jsonBuffer.byteLength).set(jsonBuffer);
// Pad with spaces (0x20)
for (let i = jsonBuffer.byteLength; i < paddedJsonLength; i++) {
  new Uint8Array(glb)[pos + i] = 0x20;
}
pos += paddedJsonLength;

// BIN chunk
view.setUint32(pos, paddedBinLength, true); pos += 4;
view.setUint32(pos, 0x004E4942, true); pos += 4; // type: "BIN\0"
new Uint8Array(glb, pos, binaryBuffer.byteLength).set(binaryBuffer);
pos += paddedBinLength;

writeFileSync(outPath, Buffer.from(glb));
console.log(`Written ${(totalSize / 1024).toFixed(1)}KB to ${outPath}`);
console.log(`  ${nodes.length} bones, ${channels.length} channels, ${samplers.length} samplers`);
