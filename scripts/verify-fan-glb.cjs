const fs = require("fs");
const path = require("path");
const { Matrix4, Quaternion, Vector3 } = require("three");

const glbPath = path.join(
  __dirname,
  "..",
  "static",
  "models",
  "props",
  "fan.glb"
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
  const nodeParent = new Map();
  const meshNodes = [];
  const meshBounds = new Map();
  let vertexCount = 0;
  let triangleCount = 0;
  let primitiveCount = 0;

  function visit(nodeIndex, parentMatrix, parentIndex = null) {
    const node = document.nodes[nodeIndex];
    const worldMatrix = parentMatrix.clone().multiply(nodeMatrix(node));
    nodeParent.set(nodeIndex, parentIndex);
    if (node.mesh !== undefined) {
      meshNodes.push(nodeIndex);
      const nodeMinimum = new Vector3(Infinity, Infinity, Infinity);
      const nodeMaximum = new Vector3(-Infinity, -Infinity, -Infinity);
      const mesh = document.meshes[node.mesh];
      for (const primitive of mesh.primitives) {
        primitiveCount += 1;
        invariant(
          primitive.indices !== undefined,
          `${mesh.name ?? node.name} is unindexed triangle soup`
        );
        invariant(
          primitive.attributes.NORMAL !== undefined,
          `${mesh.name ?? node.name} has no normals`
        );
        invariant(
          primitive.attributes.TEXCOORD_0 !== undefined,
          `${mesh.name ?? node.name} has no UVs`
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
          nodeMinimum.min(position);
          nodeMaximum.max(position);
        }
        const indices = document.accessors[primitive.indices];
        invariant(
          indices.count % 3 === 0,
          `${mesh.name ?? node.name} indices do not form triangles`
        );
        triangleCount += indices.count / 3;
      }
      meshBounds.set(nodeIndex, { minimum: nodeMinimum, maximum: nodeMaximum });
    }
    for (const child of node.children ?? []) {
      visit(child, worldMatrix, nodeIndex);
    }
  }

  const scene = document.scenes[document.scene ?? 0];
  for (const rootNode of scene.nodes ?? []) {
    visit(rootNode, new Matrix4());
  }
  return {
    minimum,
    maximum,
    dimensions: maximum.clone().sub(minimum),
    nodeParent,
    meshNodes,
    meshBounds,
    vertexCount,
    triangleCount,
    primitiveCount,
  };
}

function isDescendant(nodeIndex, ancestorIndex, nodeParent) {
  let current = nodeParent.get(nodeIndex);
  while (current !== null && current !== undefined) {
    if (current === ancestorIndex) return true;
    current = nodeParent.get(current);
  }
  return false;
}

function descendantDimensions(ancestorIndex, stats) {
  const minimum = new Vector3(Infinity, Infinity, Infinity);
  const maximum = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const [nodeIndex, bounds] of stats.meshBounds) {
    if (!isDescendant(nodeIndex, ancestorIndex, stats.nodeParent)) continue;
    minimum.min(bounds.minimum);
    maximum.max(bounds.maximum);
  }
  return maximum.sub(minimum);
}

invariant(fs.existsSync(glbPath), "fan.glb is missing");
const { bytes, document, binary } = parseGlb(glbPath);
const stats = collectScene(document, binary);
const nodes = document.nodes ?? [];
const nodeIndexByName = new Map(nodes.map((node, index) => [node.name, index]));
const materialNames = new Set(
  (document.materials ?? []).map((material) => material.name)
);
const materialByName = new Map(
  (document.materials ?? []).map((material) => [material.name, material])
);

const requiredNodes = [
  "TKA_Fan",
  "Fan_Fire",
  "Fan_Day",
  "Fan_Cover",
  "Fan_Fire_GripRing",
  "Fan_Fire_GripShell",
  "Fan_Fire_GripBridge_3",
  "Fan_Fire_LeftRail",
  "Fan_Fire_RightRail",
  "Fan_Fire_WickHorizon",
  "Fan_Fire_UpperLeftStar",
  "Fan_Fire_UpperRightStar",
  "Fan_Day_DoodleGripPlate",
  "Fan_Cover_SolidFace",
  "Fan_Cover_StripedFace",
];
for (const name of requiredNodes) {
  invariant(nodeIndexByName.has(name), `Required node is missing: ${name}`);
}
for (const obsoleteName of [
  "Fan_Fire_LowerCourse",
  "Fan_Fire_UpperCourse",
  "Fan_Fire_LeftDiagonal",
  "Fan_Fire_RightDiagonal",
]) {
  invariant(
    !nodeIndexByName.has(obsoleteName),
    `Obsolete rounded webbing remains: ${obsoleteName}`
  );
}
const dayPlate = nodes[nodeIndexByName.get("Fan_Day_DoodleGripPlate")];
const fireGroup = nodes[nodeIndexByName.get("Fan_Fire")];
invariant(
  fireGroup.extras?.tka_build ===
    "Forged Creations five-wick DoodleGrip fire fan",
  "Fire fan is not identified as the five-wick DoodleGrip build"
);
invariant(
  fireGroup.extras?.tka_reference_lower_fan_excluded === true,
  "Fire fan geometry was not built from the isolated upper-fan cutout"
);
invariant(
  fireGroup.extras?.tka_grip_shell_geometry === "constant-radius circle",
  "Fire fan grip shell is not a constant-radius circular arc"
);
invariant(
  JSON.stringify(fireGroup.extras?.tka_reference_bbox_px) ===
    JSON.stringify([32, 26, 272, 181]),
  "Fire fan reference crop no longer excludes the paired lower fan"
);
invariant(
  JSON.stringify(fireGroup.extras?.tka_reference_pivot_px) ===
    JSON.stringify([152, 154]),
  "Fire fan reference pivot moved away from the isolated spinning ring"
);
invariant(
  Math.abs(fireGroup.extras?.tka_spinning_ring_id_m - 0.0381) < 1e-6,
  "Fire fan spinning ring is no longer the 1.5-inch option"
);
invariant(
  Math.abs(fireGroup.extras?.tka_wick_length_m - 0.0381) < 1e-6,
  "Fire fan no longer uses 1.5-inch rolled wicks"
);
invariant(
  Math.abs(fireGroup.extras?.tka_outer_spine_diameter_m - 0.0047625) < 1e-7,
  "Fire fan curved outside spines are no longer 3/16-inch stock"
);
invariant(
  Math.abs(fireGroup.extras?.tka_inner_spine_diameter_m - 0.003175) < 1e-7,
  "Fire fan inside spines are no longer 1/8-inch stock"
);
invariant(
  dayPlate.extras?.tka_trace_contours === 18,
  "Day fan is not the 18-contour product-image trace"
);
invariant(
  dayPlate.extras?.tka_trace_holes === 17,
  "Day fan no longer preserves all 17 reference cutouts"
);
invariant(
  dayPlate.extras?.tka_trace_points >= 250,
  "Day fan trace was simplified past the reference detail target"
);
invariant(
  Math.abs(dayPlate.extras?.tka_ring_diameter_m - 0.044) < 1e-6,
  "Day fan no longer uses the selected 1.75-inch / 44mm ring"
);
invariant(
  Math.abs(dayPlate.extras?.tka_finished_ring_control_diameter_m - 0.044) < 1e-6,
  "Finished Day fan grip control boundary is no longer 44mm"
);
invariant(
  dayPlate.extras?.tka_minimum_web_m >= 0.007,
  `Day fan web clearance is too thin: ${dayPlate.extras?.tka_minimum_web_m}m`
);
invariant(
  dayPlate.extras?.tka_symmetry ===
    "bilateral average of eight left/right cutout pairs",
  "Day fan is missing its bilateral camera-skew correction"
);
invariant(
  dayPlate.extras?.tka_official_dimensions_source ===
    "https://flowtoys.com/products/doodlegrip-practice-fans",
  "Day fan no longer records the manufacturer dimensions source"
);
invariant(
  !nodes.some((node) => /^Fan_Fire_Web_\d+$/.test(node.name ?? "")),
  "Detached first-pass fire webbing is still present"
);
invariant(
  !nodes.some((node) => /^Fan_Fire_ControlLoop_/.test(node.name ?? "")),
  "Incorrect three-ring Fire handle is still present"
);
invariant(
  !nodeIndexByName.has("Fan_Fire_Spine_1") &&
    !nodeIndexByName.has("Fan_Fire_Spine_5"),
  "Outside Fire spines are duplicated instead of using the curved rails"
);
for (let index = 1; index <= 5; index += 1) {
  invariant(
    nodeIndexByName.has(`Fan_Fire_Wick_${index}`),
    `Fire fan wick ${index} is missing`
  );
}

const requiredMaterials = [
  "TKA_Fan_Fire_Steel",
  "TKA_Fan_Wick",
  "TKA_Fan_Wick_Wrap",
  "TKA_Fan_Day_Frame",
  "TKA_Fan_Cover_Solid_Recolor",
  "TKA_Fan_Cover_Stripe_Dark",
  "TKA_Fan_Cover_Stripe_Light",
  "TKA_Fan_Cover_Seam",
];
for (const name of requiredMaterials) {
  invariant(materialNames.has(name), `Required material is missing: ${name}`);
}
const dayMaterial = materialByName.get("TKA_Fan_Day_Frame");
invariant(
  dayMaterial.pbrMetallicRoughness?.metallicFactor === 0,
  "Day fan HDPE must remain nonmetallic"
);
invariant(
  dayMaterial.pbrMetallicRoughness?.roughnessFactor >= 0.68,
  "Day fan HDPE is too glossy"
);
const fireMaterial = materialByName.get("TKA_Fan_Fire_Steel");
invariant(
  fireMaterial.pbrMetallicRoughness?.metallicFactor >= 0.7,
  "Fire fan frame no longer reads as steel"
);
invariant(
  fireMaterial.pbrMetallicRoughness?.roughnessFactor >= 0.44,
  "Fire fan frame is glossier than an oil-rubbed finish"
);

for (const groupName of ["Fan_Fire", "Fan_Day", "Fan_Cover"]) {
  const groupIndex = nodeIndexByName.get(groupName);
  const meshCount = stats.meshNodes.filter((nodeIndex) =>
    isDescendant(nodeIndex, groupIndex, stats.nodeParent)
  ).length;
  const minimumMeshCount = groupName === "Fan_Day" ? 1 : 2;
  invariant(meshCount >= minimumMeshCount, `${groupName} has no usable mesh layer`);
}
const dayDimensions = descendantDimensions(
  nodeIndexByName.get("Fan_Day"),
  stats
);
const fireDimensions = descendantDimensions(
  nodeIndexByName.get("Fan_Fire"),
  stats
);
invariant(
  Math.abs(dayDimensions.x - 0.51) <= 0.0002,
  `Traced Day fan width drifted: ${dayDimensions.x.toFixed(4)}m`
);
invariant(
  Math.abs(dayDimensions.y - 0.35) <= 0.0002,
  `Traced Day fan height drifted: ${dayDimensions.y.toFixed(4)}m`
);
invariant(
  Math.abs(dayDimensions.z - 0.0095) <= 0.0002,
  `Traced Day fan stock thickness drifted: ${dayDimensions.z.toFixed(4)}m`
);
invariant(
  Math.abs(fireDimensions.x - 0.4826) <= 0.00001,
  `DoodleGrip Fire width drifted: ${fireDimensions.x.toFixed(6)}m`
);
invariant(
  Math.abs(fireDimensions.y - 0.3302) <= 0.00001,
  `DoodleGrip Fire height drifted: ${fireDimensions.y.toFixed(6)}m`
);

const root = nodes[nodeIndexByName.get("TKA_Fan")];
const rootTranslation = new Vector3().fromArray(root.translation ?? [0, 0, 0]);
invariant(
  rootTranslation.length() < 1e-6,
  `Hand pivot moved away from the origin: ${rootTranslation.toArray()}`
);

invariant(bytes.length >= 40_000, `fan.glb is suspiciously small: ${bytes.length}`);
invariant(bytes.length <= 2_000_000, `fan.glb is too large: ${bytes.length}`);
invariant(stats.triangleCount >= 2_000, "Fan detail collapsed below the art target");
invariant(stats.triangleCount <= 80_000, "Fan exceeds the mobile triangle budget");
console.log(
  `FAN_DIMENSIONS_M=${stats.dimensions.x.toFixed(4)},${stats.dimensions.y.toFixed(4)},${stats.dimensions.z.toFixed(4)}`
);
invariant(
  stats.dimensions.x >= 0.50 && stats.dimensions.x <= 0.54,
  `Fan width is outside the 20-inch class: ${stats.dimensions.x.toFixed(4)}m`
);
invariant(
  stats.dimensions.y >= 0.34 && stats.dimensions.y <= 0.41,
  `Fan height is outside the 13.75-inch class: ${stats.dimensions.y.toFixed(4)}m`
);
invariant(
  stats.dimensions.z >= 0.018 && stats.dimensions.z <= 0.035,
  `Fan depth is implausible: ${stats.dimensions.z.toFixed(4)}m`
);

console.log(`FAN_GLB=${glbPath}`);
console.log(`FAN_BYTES=${bytes.length}`);
console.log(`FAN_NODES=${nodes.length}`);
console.log(`FAN_MATERIALS=${materialNames.size}`);
console.log(`FAN_VERTICES=${stats.vertexCount}`);
console.log(`FAN_TRIANGLES=${stats.triangleCount}`);
console.log(
  `FAN_DAY_DIMENSIONS_M=${dayDimensions.x.toFixed(4)},${dayDimensions.y.toFixed(4)},${dayDimensions.z.toFixed(4)}`
);
console.log(
  `FAN_FIRE_DIMENSIONS_M=${fireDimensions.x.toFixed(6)},${fireDimensions.y.toFixed(6)},${fireDimensions.z.toFixed(6)}`
);
console.log("FAN_VARIANTS=fire,day-black,day-white,bare,covered-solid,covered-striped");
