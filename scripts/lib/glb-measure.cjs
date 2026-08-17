/**
 * Shared GLB parsing and world-space measurement for the prop verifiers.
 *
 * Extracted when verify-sword-glb.cjs became the second consumer of what
 * verify-chicken-glb.cjs had grown. Mesh-space accessor bounds report the wrong
 * axis for anything a node transform rotates -- both exporters put the long axis
 * behind a Z-up-to-Y-up rotation -- so every measurement here walks the node
 * hierarchy and transforms real vertices.
 */

const fs = require("fs");

const { Matrix4, Quaternion, Vector3 } = require("three");

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

/**
 * Walk every node, transform every vertex, and report world-space extents plus
 * per-mesh bounds. `meshBounds` is keyed by node name so a verifier can assert
 * where an individual part sits without re-reading the buffer.
 */
function collectScene(document, binary) {
  const minimum = new Vector3(Infinity, Infinity, Infinity);
  const maximum = new Vector3(-Infinity, -Infinity, -Infinity);
  const worldMatrices = new Map();
  const meshBounds = new Map();
  let vertexCount = 0;
  let triangleCount = 0;
  let primitiveCount = 0;

  function visit(nodeIndex, parentMatrix) {
    const node = document.nodes[nodeIndex];
    const worldMatrix = parentMatrix.clone().multiply(nodeMatrix(node));
    worldMatrices.set(nodeIndex, worldMatrix);
    if (node.mesh !== undefined) {
      const mesh = document.meshes[node.mesh];
      const localMinimum = new Vector3(Infinity, Infinity, Infinity);
      const localMaximum = new Vector3(-Infinity, -Infinity, -Infinity);
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
          localMinimum.min(position);
          localMaximum.max(position);
        }

        const indexAccessor = document.accessors[primitive.indices];
        invariant(
          indexAccessor.count % 3 === 0,
          `${mesh.name} indices do not form triangles`
        );
        triangleCount += indexAccessor.count / 3;
      }
      meshBounds.set(node.name, {
        minimum: localMinimum,
        maximum: localMaximum,
      });
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
    meshBounds,
  };
}

/**
 * Evaluate the SHIPPED dist registry rather than the source.
 *
 * The dist bundle uses extensionless imports that Node's ESM resolver rejects,
 * and the package's "exports" map has no deep subpaths, so neither `import` nor
 * `require.resolve` reaches it. Stripping the imports and running the body with
 * a stubbed PropType still tests the real file the app loads.
 */
function loadShippedRegistry(repoRoot) {
  const path = require("path");
  const registryPath = path.join(
    repoRoot,
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

module.exports = {
  collectScene,
  invariant,
  loadShippedRegistry,
  nodeMatrix,
  parseGlb,
  readPositions,
};
