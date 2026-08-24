const fs = require("fs");
const path = require("path");

const { Matrix4, Quaternion, Vector3 } = require("three");

const instrumentArgument = process.argv.indexOf("--instrument");
const instrument =
  instrumentArgument >= 0 ? process.argv[instrumentArgument + 1] : "guitar";
if (!new Set(["guitar", "ukulele"]).has(instrument)) {
  throw new Error(`Unknown instrument: ${instrument}`);
}

const isUkulele = instrument === "ukulele";
const displayName = isUkulele ? "Ukulele" : "Guitar";
const prefix = `TKA_${displayName}`;
const stringGroup = isUkulele ? "FourStrings" : "SixStrings";

const glbPath = path.join(
  __dirname,
  "..",
  "static",
  "models",
  "props",
  `${instrument}.glb`
);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseGlb(filePath) {
  const bytes = fs.readFileSync(filePath);
  invariant(bytes.length >= 20, "GLB is too short");
  invariant(bytes.readUInt32LE(0) === 0x46546c67, "GLB magic is invalid");
  invariant(bytes.readUInt32LE(4) === 2, "GLB must use glTF 2.0");
  invariant(
    bytes.readUInt32LE(8) === bytes.length,
    "GLB length header is invalid"
  );

  let offset = 12;
  let document = null;
  let binary = null;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const payload = bytes.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 0x4e4f534a) {
      document = JSON.parse(payload.toString("utf8").trim());
    } else if (chunkType === 0x004e4942) {
      binary = payload;
    }
    offset += 8 + chunkLength;
  }
  invariant(document, "GLB JSON chunk is missing");
  invariant(binary, "GLB binary chunk is missing");
  return { bytes, document, binary };
}

function nodeMatrix(node) {
  if (node.matrix) return new Matrix4().fromArray(node.matrix);
  return new Matrix4().compose(
    new Vector3().fromArray(node.translation ?? [0, 0, 0]),
    new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
    new Vector3().fromArray(node.scale ?? [1, 1, 1])
  );
}

function readPositions(document, binary, accessorIndex) {
  const accessor = document.accessors[accessorIndex];
  const view = document.bufferViews[accessor.bufferView];
  invariant(
    accessor.componentType === 5126,
    "POSITION data must use FLOAT components"
  );
  invariant(accessor.type === "VEC3", "POSITION data must use VEC3 values");
  const stride = view.byteStride ?? 12;
  const baseOffset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const positions = [];
  for (let index = 0; index < accessor.count; index += 1) {
    const offset = baseOffset + index * stride;
    positions.push(
      new Vector3(
        binary.readFloatLE(offset),
        binary.readFloatLE(offset + 4),
        binary.readFloatLE(offset + 8)
      )
    );
  }
  return positions;
}

function collectScene(document, binary) {
  const minimum = new Vector3(Infinity, Infinity, Infinity);
  const maximum = new Vector3(-Infinity, -Infinity, -Infinity);
  const worldMatrices = new Map();
  const positionsByNode = new Map();
  let vertexCount = 0;
  let triangleCount = 0;
  let primitiveCount = 0;

  function visit(nodeIndex, parentMatrix) {
    const node = document.nodes[nodeIndex];
    const worldMatrix = parentMatrix.clone().multiply(nodeMatrix(node));
    worldMatrices.set(nodeIndex, worldMatrix);
    if (node.mesh !== undefined) {
      const mesh = document.meshes[node.mesh];
      const nodePositions = [];
      for (const primitive of mesh.primitives) {
        primitiveCount += 1;
        invariant(
          primitive.indices !== undefined,
          `${mesh.name} is unindexed triangle soup`
        );
        invariant(
          primitive.attributes.NORMAL !== undefined,
          `${mesh.name} has no normals`
        );
        invariant(
          primitive.attributes.TEXCOORD_0 !== undefined,
          `${mesh.name} has no UVs`
        );
        const positions = readPositions(
          document,
          binary,
          primitive.attributes.POSITION
        );
        vertexCount += positions.length;
        for (const position of positions) {
          position.applyMatrix4(worldMatrix);
          nodePositions.push(position.clone());
          minimum.min(position);
          maximum.max(position);
        }
        const indices = document.accessors[primitive.indices];
        invariant(
          indices.count % 3 === 0,
          `${mesh.name} indices do not form triangles`
        );
        triangleCount += indices.count / 3;
      }
      positionsByNode.set(nodeIndex, nodePositions);
    }
    for (const child of node.children ?? []) visit(child, worldMatrix);
  }

  const scene = document.scenes[document.scene ?? 0];
  for (const rootNode of scene.nodes ?? []) visit(rootNode, new Matrix4());
  return {
    minimum,
    maximum,
    dimensions: maximum.clone().sub(minimum),
    vertexCount,
    triangleCount,
    primitiveCount,
    worldMatrices,
    positionsByNode,
  };
}

const { bytes, document, binary } = parseGlb(glbPath);
const stats = collectScene(document, binary);
const nodes = document.nodes ?? [];
const nodeIndexByName = new Map(nodes.map((node, index) => [node.name, index]));
const materialNames = new Set(
  (document.materials ?? []).map((material) => material.name)
);
const expectedMaterials = new Set([
  `${prefix}_Recolor`,
  `${prefix}_Fretboard`,
  `${prefix}_Binding`,
  `${prefix}_Metal`,
  `${prefix}_SoundHole`,
]);
const requiredNodes = [
  prefix,
  "TKA_Hand_Pivot",
  `${prefix}_BodyShell`,
  `${prefix}_Soundboard`,
  `${prefix}_FrontBinding`,
  `${prefix}_Back`,
  `${prefix}_NeckGrip`,
  `${prefix}_Fretboard`,
  `${prefix}_Headstock`,
  `${prefix}_SoundHole`,
  `${prefix}_SoundHoleInnerLip`,
  `${prefix}_Bridge`,
  `${prefix}_BridgePins`,
  `${prefix}_Pickguard`,
  `${prefix}_Frets`,
  `${prefix}_${stringGroup}`,
  `${prefix}_TuningMachines`,
];

invariant(
  bytes.length <= 1_250_000,
  `${displayName} exceeds 1.25 MB: ${bytes.length}`
);
invariant(
  document.scenes?.length === 1,
  `${displayName} must contain exactly one scene`
);
invariant(
  (document.cameras?.length ?? 0) === 0,
  "QA camera leaked into the GLB"
);
invariant(
  !(document.extensionsUsed ?? []).includes("KHR_lights_punctual"),
  "QA lights leaked into the GLB"
);
for (const nodeName of requiredNodes) {
  invariant(
    nodeIndexByName.has(nodeName),
    `Required node is missing: ${nodeName}`
  );
}

function namedPositions(nodeName) {
  const nodeIndex = nodeIndexByName.get(nodeName);
  const positions = stats.positionsByNode.get(nodeIndex) ?? [];
  invariant(positions.length > 0, `${nodeName} has no mesh positions`);
  return positions;
}

function spanFor(nodeName, axis) {
  const values = namedPositions(nodeName).map((position) => position[axis]);
  return Math.max(...values) - Math.min(...values);
}

function frontAtEnd(nodeName, end) {
  const positions = namedPositions(nodeName);
  const ys = positions.map((position) => position.y);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  const band = (maximumY - minimumY) * 0.14;
  const selected = positions.filter((position) =>
    end === "low"
      ? position.y <= minimumY + band
      : position.y >= maximumY - band
  );
  return Math.max(...selected.map((position) => position.z));
}

const bodyDepth = spanFor(`${prefix}_BodyShell`, "z");
const neckDepth = spanFor(`${prefix}_NeckGrip`, "z");
const headstockFrontAtNut = frontAtEnd(`${prefix}_Headstock`, "low");
const headstockFrontAtTip = frontAtEnd(`${prefix}_Headstock`, "high");
const headstockDrop = headstockFrontAtNut - headstockFrontAtTip;

invariant(
  neckDepth >= (isUkulele ? 0.014 : 0.02) &&
    neckDepth <= (isUkulele ? 0.022 : 0.031),
  `Neck depth is outside the ${displayName} profile: ${neckDepth.toFixed(4)}`
);
invariant(
  neckDepth / bodyDepth <= 0.39,
  `Neck is slab-like at ${(neckDepth / bodyDepth).toFixed(3)} of body depth`
);
invariant(
  headstockDrop >= (isUkulele ? 0.009 : 0.014) &&
    headstockDrop <= (isUkulele ? 0.019 : 0.027),
  `Headstock must break backward behind the nut, got ${headstockDrop.toFixed(4)} m of drop`
);
for (const materialName of expectedMaterials) {
  invariant(
    materialNames.has(materialName),
    `Required material is missing: ${materialName}`
  );
}
invariant(
  materialNames.size === expectedMaterials.size,
  `Unexpected material set: ${[...materialNames].join(", ")}`
);
invariant(
  stats.vertexCount <= 26_000,
  `Too many vertices: ${stats.vertexCount}`
);
invariant(
  stats.triangleCount <= 38_000,
  `Too many triangles: ${stats.triangleCount}`
);
invariant(
  stats.dimensions.y >= (isUkulele ? 0.525 : 0.79) &&
    stats.dimensions.y <= (isUkulele ? 0.535 : 0.82),
  `Unexpected ${instrument} length: ${stats.dimensions.y.toFixed(4)}`
);
invariant(
  stats.dimensions.x >= (isUkulele ? 0.16 : 0.3) &&
    stats.dimensions.x <= (isUkulele ? 0.18 : 0.33),
  `Unexpected ${instrument} width: ${stats.dimensions.x.toFixed(4)}`
);
invariant(
  stats.dimensions.z >= (isUkulele ? 0.05 : 0.075) &&
    stats.dimensions.z <= (isUkulele ? 0.08 : 0.115),
  `Unexpected ${instrument} depth: ${stats.dimensions.z.toFixed(4)}`
);
invariant(
  stats.minimum.y < (isUkulele ? -0.35 : -0.42),
  "Body does not reach the authored negative-Y end"
);
invariant(
  stats.maximum.y > (isUkulele ? 0.014 : 0.36),
  "Headstock does not reach the authored positive-Y end"
);

const rootNode = nodes[nodeIndexByName.get(prefix)];
invariant(
  rootNode.extras?.tka_prop_type === instrument,
  "Root prop metadata is missing"
);
invariant(
  rootNode.extras?.grip_origin === "0,0,0",
  "Root grip metadata is missing"
);
invariant(
  rootNode.extras?.local_long_axis === "+Y",
  "Root axis metadata is missing"
);
invariant(
  rootNode.extras?.recolor_material === `${prefix}_Recolor`,
  "Root recolor metadata is missing"
);
if (isUkulele) {
  invariant(
    Math.abs(rootNode.extras?.authored_length_m - 0.530225) <= 0.000001,
    "Ukulele authored-length metadata is missing"
  );
  invariant(
    Math.abs(rootNode.extras?.tracked_tip_y - 0.015) <= 0.000001,
    "Ukulele tracked-tip metadata is missing"
  );
  invariant(
    rootNode.extras?.grip_site === "headstock tip",
    "Ukulele headstock-grip metadata is missing"
  );
  invariant(
    Math.abs(stats.maximum.y - 0.015) <= 0.0001,
    `Ukulele hand must sit at the headstock tip, got ${stats.maximum.y.toFixed(4)} m above it`
  );
}

const pivotIndex = nodeIndexByName.get("TKA_Hand_Pivot");
const pivotPosition = new Vector3().setFromMatrixPosition(
  stats.worldMatrices.get(pivotIndex)
);
invariant(
  pivotPosition.length() <= 0.00001,
  `Hand pivot drifted: ${pivotPosition.toArray()}`
);

console.log(`Verified ${glbPath}`);
console.log(`  bytes: ${bytes.length}`);
console.log(`  meshes: ${document.meshes.length}`);
console.log(`  primitives: ${stats.primitiveCount}`);
console.log(`  vertices: ${stats.vertexCount}`);
console.log(`  triangles: ${stats.triangleCount}`);
console.log(`  materials: ${[...materialNames].join(", ")}`);
console.log(
  `  bounds: ${stats.dimensions.x.toFixed(4)} x ${stats.dimensions.y.toFixed(4)} x ${stats.dimensions.z.toFixed(4)} m`
);
console.log(
  `  hand pivot: ${pivotPosition
    .toArray()
    .map((value) => value.toFixed(5))
    .join(", ")}`
);
console.log(
  `  side geometry: ${(neckDepth * 1000).toFixed(1)}mm neck / ${(bodyDepth * 1000).toFixed(1)}mm body, ${(headstockDrop * 1000).toFixed(1)}mm headstock drop`
);
