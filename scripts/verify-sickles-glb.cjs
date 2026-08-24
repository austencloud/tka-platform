const fs = require("fs");
const path = require("path");

const { Matrix4, Quaternion, Vector3 } = require("three");

const glbPath = path.join(
  __dirname,
  "..",
  "static",
  "models",
  "props",
  "sickles.glb"
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
    if (chunkType === 0x4e4f534a)
      document = JSON.parse(payload.toString("utf8").trim());
    if (chunkType === 0x004e4942) binary = payload;
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
  let vertexCount = 0;
  let triangleCount = 0;
  let primitiveCount = 0;

  function visit(nodeIndex, parentMatrix) {
    const node = document.nodes[nodeIndex];
    const worldMatrix = parentMatrix.clone().multiply(nodeMatrix(node));
    worldMatrices.set(nodeIndex, worldMatrix);
    if (node.mesh !== undefined) {
      for (const primitive of document.meshes[node.mesh].primitives) {
        primitiveCount += 1;
        invariant(
          primitive.indices !== undefined,
          `${node.name} is unindexed triangle soup`
        );
        invariant(
          primitive.attributes.NORMAL !== undefined,
          `${node.name} has no normals`
        );
        invariant(
          primitive.attributes.TEXCOORD_0 !== undefined,
          `${node.name} has no UVs`
        );
        const positions = readPositions(
          document,
          binary,
          primitive.attributes.POSITION
        );
        vertexCount += positions.length;
        for (const position of positions) {
          position.applyMatrix4(worldMatrix);
          minimum.min(position);
          maximum.max(position);
        }
        const indices = document.accessors[primitive.indices];
        invariant(
          indices.count % 3 === 0,
          `${node.name} indices do not form triangles`
        );
        triangleCount += indices.count / 3;
      }
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
  "TKA_Sickles_Recolor",
  "TKA_Sickles_Blade_Silver",
  "TKA_Sickles_Chrome",
  "TKA_Sickles_Grip",
  "TKA_Sickles_Grip_Ridge",
]);
const requiredNodes = [
  "TKA_Sickles",
  "TKA_Hand_Pivot",
  "TKA_Sickles_KineticAxis",
  "TKA_Sickles_Blade",
  "TKA_Sickles_Grip",
  "TKA_Sickles_UpperShell_Recolor",
  "TKA_Sickles_LowerShell_Recolor",
  "TKA_Sickles_BladeSpine_Recolor_Front",
  "TKA_Sickles_BladeSpine_Recolor_Back",
  "TKA_Sickles_YinYangBridge_Front",
  "TKA_Sickles_YinYangBridge_Back",
  "TKA_Sickles_BladePivotBolt",
];

invariant(bytes.length <= 900_000, `Sickles exceeds 900 KB: ${bytes.length}`);
invariant(
  document.scenes?.length === 1,
  "Sickles must contain exactly one scene"
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
  stats.vertexCount <= 20_000,
  `Too many vertices: ${stats.vertexCount}`
);
invariant(
  stats.triangleCount <= 30_000,
  `Too many triangles: ${stats.triangleCount}`
);
invariant(
  stats.dimensions.x >= 0.25 && stats.dimensions.x <= 0.27,
  `Unexpected aligned Sickles width: ${stats.dimensions.x.toFixed(6)}`
);
invariant(
  stats.dimensions.y >= 0.33 && stats.dimensions.y <= 0.35,
  `Unexpected aligned Sickles height: ${stats.dimensions.y.toFixed(6)}`
);
invariant(
  stats.dimensions.z >= 0.029 && stats.dimensions.z <= 0.032,
  `Unexpected Sickles depth: ${stats.dimensions.z.toFixed(6)}`
);

const rootNode = nodes[nodeIndexByName.get("TKA_Sickles")];
invariant(
  rootNode.extras?.tka_prop_type === "sickles",
  "Root prop metadata is missing"
);
invariant(
  rootNode.extras?.grip_origin === "lower wrapped handle at runtime 0,0,0",
  "Root grip metadata is missing"
);
invariant(
  Math.abs(rootNode.extras?.physical_grip_z_m - -0.125) <= 0.000001,
  "Physical lower-handle grip metadata is missing"
);
invariant(
  rootNode.extras?.local_primary_axis === "+Y",
  "Root axis metadata is missing"
);
invariant(
  rootNode.extras?.recolor_material === "TKA_Sickles_Recolor",
  "Root recolor metadata is missing"
);
invariant(
  rootNode.extras?.tka_recolor_mode === "palette-main",
  "Sickles must opt into the exact shared prop palette"
);
invariant(
  rootNode.extras?.published_dimensions_m === "0.36 x 0.19 x 0.04",
  "Published size metadata is missing"
);

const pivotMatrix = stats.worldMatrices.get(
  nodeIndexByName.get("TKA_Hand_Pivot")
);
const pivotPosition = new Vector3().setFromMatrixPosition(pivotMatrix);
invariant(
  pivotPosition.length() <= 0.00001,
  `Hand pivot moved from origin: ${pivotPosition.toArray()}`
);

const axisNode = nodes[nodeIndexByName.get("TKA_Sickles_KineticAxis")];
invariant(
  Math.abs(axisNode.extras?.tracked_tip_reach_m - Math.hypot(0.19, 0.198)) <=
    0.000001,
  "Tracked blade-apex reach metadata drifted"
);
invariant(
  axisNode.extras?.alignment === "blade apex to runtime +Y",
  "Kinetic-axis alignment metadata is missing"
);

console.log(`Sickles GLB verified: ${path.relative(process.cwd(), glbPath)}`);
console.log(`  size: ${bytes.length} bytes`);
console.log(
  `  meshes: ${document.meshes?.length ?? 0}, primitives: ${stats.primitiveCount}`
);
console.log(
  `  vertices: ${stats.vertexCount}, triangles: ${stats.triangleCount}`
);
console.log(
  `  bounds: ${stats.dimensions.x.toFixed(6)} x ${stats.dimensions.y.toFixed(6)} x ${stats.dimensions.z.toFixed(6)} m`
);
console.log(
  `  hand pivot: ${pivotPosition
    .toArray()
    .map((value) => value.toFixed(6))
    .join(", ")}`
);
