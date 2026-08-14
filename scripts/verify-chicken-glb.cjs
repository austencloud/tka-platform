const fs = require("fs");
const path = require("path");

const { Matrix4, Quaternion, Vector3 } = require("three");

const glbPath = path.join(
  __dirname,
  "..",
  "static",
  "models",
  "props",
  "chicken.glb"
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
  let vertexCount = 0;
  let triangleCount = 0;
  let primitiveCount = 0;

  function visit(nodeIndex, parentMatrix) {
    const node = document.nodes[nodeIndex];
    const worldMatrix = parentMatrix.clone().multiply(nodeMatrix(node));
    worldMatrices.set(nodeIndex, worldMatrix);
    if (node.mesh !== undefined) {
      const mesh = document.meshes[node.mesh];
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
          minimum.min(position);
          maximum.max(position);
        }

        const indexAccessor = document.accessors[primitive.indices];
        invariant(
          indexAccessor.count % 3 === 0,
          `${mesh.name} indices do not form triangles`
        );
        triangleCount += indexAccessor.count / 3;
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
  (document.materials ?? []).map((item) => item.name)
);
const expectedMaterials = new Set([
  "TKA_Body_Recolor",
  "TKA_Chicken_Red",
  "TKA_Chicken_Beak",
  "TKA_Chicken_Mouth",
]);
const requiredNodes = [
  "TKA_Chicken",
  "TKA_Hand_Pivot",
  "TKA_Chicken_MoldedBody",
  "TKA_Chicken_TailSpur",
  "TKA_Chicken_Beak_Upper",
  "TKA_Chicken_Beak_Lower",
  "TKA_Chicken_MouthInterior",
  "TKA_Chicken_Comb_Base",
  "TKA_Chicken_Wattle_Left",
  "TKA_Chicken_Wattle_Right",
  "TKA_Chicken_RedEye_Left",
  "TKA_Chicken_RedEye_Right",
  "TKA_Chicken_EmbossedWing_Left",
  "TKA_Chicken_EmbossedWing_Right",
  "TKA_Chicken_LimpFoot_Left",
  "TKA_Chicken_LimpFoot_Right",
];

invariant(bytes.length <= 1_000_000, `Chicken exceeds 1 MB: ${bytes.length}`);
invariant(
  document.scenes?.length === 1,
  "Chicken must contain exactly one scene"
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
const bodyMaterial = (document.materials ?? []).find(
  (material) => material.name === "TKA_Body_Recolor"
);
invariant(bodyMaterial, "Recolorable molded-latex material is missing");
invariant(
  Number.isInteger(bodyMaterial.normalTexture?.index),
  "Molded-latex normal texture is missing"
);
invariant(
  (document.images?.length ?? 0) >= 1,
  "Molded-latex surface image is not embedded"
);
invariant(
  stats.vertexCount <= 30_000,
  `Too many vertices: ${stats.vertexCount}`
);
invariant(
  stats.triangleCount <= 45_000,
  `Too many triangles: ${stats.triangleCount}`
);
invariant(
  stats.dimensions.y >= 0.76 && stats.dimensions.y <= 0.82,
  `Local Y length must be about 0.80m, got ${stats.dimensions.y.toFixed(4)}`
);
invariant(
  stats.dimensions.x >= 0.15 && stats.dimensions.x <= 0.21,
  `Unexpected chicken width: ${stats.dimensions.x.toFixed(4)}`
);
invariant(
  stats.dimensions.z >= 0.18 && stats.dimensions.z <= 0.24,
  `Unexpected chicken depth: ${stats.dimensions.z.toFixed(4)}`
);
invariant(
  stats.minimum.y < -0.38,
  "Feet do not reach the authored negative-Y end"
);
invariant(
  stats.maximum.y > 0.38,
  "Head does not reach the authored positive-Y end"
);

const rootNode = nodes[nodeIndexByName.get("TKA_Chicken")];
invariant(
  rootNode.extras?.tka_prop_type === "chicken",
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
