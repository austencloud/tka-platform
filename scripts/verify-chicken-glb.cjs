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

// --- In-world sizes -----------------------------------------------------------
//
// The GLB is authored ~0.778m long with the grip through the torso. What the
// player actually sees is that model after the registry's scale, flip, and grip
// offset, and those numbers encode two product decisions (2026-08-17): a small
// chicken is the size of a club or torch and is held by the head, a big chicken
// is the size of a staff and is held through the middle.
//
// Both were previously implicit, which is how the shipped bird ended up 30.6in
// -- a length inherited from the procedural placeholder it replaced. Gate them.
//
// The dist bundle uses extensionless imports that Node's ESM resolver rejects,
// so the module is evaluated here with a stubbed PropType rather than imported.
// This still tests the real shipped file instead of a re-parse of the source.
function loadShippedRegistry() {
  // The package's "exports" map has no deep subpaths, so require.resolve on the
  // dist file is refused. Reach it by path, the way sourceConstant does.
  const registryPath = path.join(
    __dirname,
    "..",
    "node_modules",
    "@austencloud",
    "scene-3d",
    "dist",
    "lib",
    "components",
    "props",
    "prop-model-registry.js"
  );
  const source = fs
    .readFileSync(registryPath, "utf8")
    .replace(/^import\s+\{[^}]*\}\s+from\s+["'][^"']*["'];?$/gm, "")
    .replace(/^export\s+/gm, "");
  const PropType = new Proxy({}, { get: (_target, key) => key });
  const factory = new Function(
    "PropType",
    `${source}\nreturn { PROP_MODEL_REGISTRY, resolvePropModel, BIG_VARIANT_MAP };`
  );
  return factory(PropType);
}

const { PROP_MODEL_REGISTRY, resolvePropModel, BIG_VARIANT_MAP } =
  loadShippedRegistry();

/** Read a named numeric constant out of a sibling source file. */
function sourceConstant(relativePath, name, pattern) {
  const text = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "node_modules",
      "@austencloud",
      "scene-3d",
      "src",
      relativePath
    ),
    "utf8"
  );
  const match = pattern.exec(text);
  invariant(match, `Could not read ${name} from ${relativePath}`);
  return Number(match[1]);
}

// The two sizes chicken is defined against. Cross-checked from source rather
// than imported, so the registry stays free of extra module coupling but a
// change to either family still trips this gate.
const clubLength = sourceConstant(
  "lib/components/props/club-profile.ts",
  "CLUB_LENGTH_M",
  /CLUB_LENGTH_M\s*=\s*([\d.]+)/
);
const staffInches = sourceConstant(
  "lib/config/user-proportions.ts",
  "staffLengthCm",
  /staffLengthCm:\s*inchesToCm\((\d+)\)/
);
const staffLength = (staffInches * 2.54) / 100;

const authoredLength = stats.dimensions.y;
const authoredHeadTipY = stats.maximum.y;
/** chicken.svg puts the hand 5.9% of the length in from the head tip. */
const neckGripFraction = 0.059;

const close = (actual, expected, tolerance, label) =>
  invariant(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected.toFixed(4)}, got ${actual.toFixed(4)}`
  );

const small = resolvePropModel("CHICKEN");
const big = resolvePropModel("BIGCHICKEN");
invariant(small, "CHICKEN has no registry entry");
invariant(big, "BIGCHICKEN has no registry entry");

// Big chicken must not ride the flat 1.4 multiplier: its grip differs from the
// small bird's, and a scale multiplier cannot express a different grip.
invariant(
  BIG_VARIANT_MAP.BIGCHICKEN === undefined,
  "BIGCHICKEN is back in BIG_VARIANT_MAP; a flat multiplier loses its center grip"
);
invariant(
  PROP_MODEL_REGISTRY.BIGCHICKEN !== undefined,
  "BIGCHICKEN needs its own registry entry"
);

close(
  authoredLength * small.scale,
  clubLength,
  0.005,
  "Small chicken length should match a club"
);
close(
  authoredLength * big.scale,
  staffLength,
  0.005,
  `Big chicken length should match a ${staffInches}" staff`
);

// Small chicken is flipped and hung from the head, so only a neck's width of it
// sits below the hand and the body trails outward.
invariant(
  small.entry.flipLongAxis === true,
  "Small chicken must be flipped, or the body extends inward through the arm"
);
const smallHeadTipY =
  -authoredHeadTipY * small.scale + small.entry.gripOffsetY;
close(
  smallHeadTipY,
  -neckGripFraction * clubLength,
  0.002,
  "Small chicken head tip should sit a neck's width below the hand"
);
const smallFeetTipY = -stats.minimum.y * small.scale + small.entry.gripOffsetY;
close(
  smallFeetTipY - smallHeadTipY,
  clubLength,
  0.005,
  "Small chicken total extent"
);

// Big chicken keeps the authored center grip, so both ends stay live.
invariant(
  !big.entry.flipLongAxis,
  "Big chicken is gripped through the middle and must not be flipped"
);
const bigLow = stats.minimum.y * big.scale + big.entry.gripOffsetY;
const bigHigh = stats.maximum.y * big.scale + big.entry.gripOffsetY;
invariant(
  Math.abs(Math.abs(bigLow) - Math.abs(bigHigh)) < 0.05 * staffLength,
  `Big chicken grip is not near its middle: ${bigLow.toFixed(3)} .. ${bigHigh.toFixed(3)}`
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
  `  small chicken: ${(authoredLength * small.scale).toFixed(4)} m` +
    ` (club ${clubLength}), head tip ${smallHeadTipY.toFixed(4)},` +
    ` reach ${smallFeetTipY.toFixed(4)}, flipped`
);
console.log(
  `  big chicken:   ${(authoredLength * big.scale).toFixed(4)} m` +
    ` (${staffInches}" staff ${staffLength.toFixed(4)}),` +
    ` tips ${bigLow.toFixed(4)} .. ${bigHigh.toFixed(4)}`
);
