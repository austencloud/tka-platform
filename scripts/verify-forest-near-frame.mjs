#!/usr/bin/env node
/** Verify the removable close-frame layer for the Moonlit Firefly Forest. */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const glbPath = resolve("static/models/forest/forest-near-frame.glb");
const layoutPath = resolve("scripts/forest-static-prop-layout.json");
const layoutBytes = readFileSync(layoutPath);
const layout = JSON.parse(layoutBytes.toString("utf8"));
const layoutSha256 = createHash("sha256").update(layoutBytes).digest("hex");
const metricsPath = join(
  tmpdir(),
  "tka-forest-evidence",
  "forest_near_frame_metrics.json"
);
const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));
const maximumBytes = 6 * 1024 * 1024;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readGlbJson(path) {
  const buffer = readFileSync(path);
  invariant(buffer.length >= 20, "GLB is too short to contain a valid header");
  invariant(buffer.readUInt32LE(0) === 0x46546c67, "GLB magic is invalid");
  invariant(buffer.readUInt32LE(4) === 2, "GLB must use glTF 2.0");
  invariant(
    buffer.readUInt32LE(8) === buffer.length,
    "GLB header length is invalid"
  );
  const jsonLength = buffer.readUInt32LE(12);
  return {
    bytes: buffer.length,
    json: JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8")),
  };
}

const { bytes, json: gltf } = readGlbJson(glbPath);
const extensions = new Set(gltf.extensionsUsed ?? []);
const authoredNodes = (gltf.nodes ?? []).filter(
  (node) => node.extras?.tka_export_layer === "near-frame"
);
const treeNodes = authoredNodes.filter(
  (node) => node.extras?.tka_role === "near-frame-tree"
);
const propNodes = authoredNodes.filter(
  (node) => node.extras?.tka_role === "near-frame-static-prop"
);
const expectedTrees = layout.frameTrees;
const expectedProps = layout.vignettes.flatMap((vignette) =>
  vignette.props.map((prop) => ({ ...prop, vignetteId: vignette.id }))
);
const expectedTreeIds = new Set(expectedTrees.map((tree) => tree.id));
const expectedPropIds = new Set(expectedProps.map((prop) => prop.id));
const expectedVignetteIds = new Set(layout.vignettes.map(({ id }) => id));
const sourceMeshById = new Map();

invariant(bytes <= maximumBytes, `GLB exceeds ${maximumBytes} bytes: ${bytes}`);
invariant(gltf.scenes?.length === 1, "GLB must contain exactly one scene");
invariant((gltf.cameras?.length ?? 0) === 0, "QA cameras leaked into the GLB");
invariant(
  (gltf.extensions?.KHR_lights_punctual?.lights?.length ?? 0) === 0,
  "QA lights leaked into the GLB"
);
invariant(
  extensions.has("EXT_meshopt_compression"),
  "Near-frame GLB lost meshopt compression"
);
invariant(
  extensions.has("EXT_texture_webp"),
  "Near-frame GLB textures are not WebP encoded"
);
invariant(
  authoredNodes.length === expectedTrees.length + expectedProps.length,
  `Expected ${expectedTrees.length + expectedProps.length} authored nodes, found ${authoredNodes.length}`
);
invariant(
  treeNodes.length === expectedTrees.length,
  `Expected ${expectedTrees.length} frame trees, found ${treeNodes.length}`
);
invariant(
  propNodes.length === expectedProps.length,
  `Expected ${expectedProps.length} static props, found ${propNodes.length}`
);

for (const node of authoredNodes) {
  const extras = node.extras;
  invariant(
    Number(extras.tka_static_prop_layout_version) === layout.version,
    `${node.name} has the wrong layout version`
  );
  invariant(
    extras.tka_static_prop_layout_sha256 === layoutSha256,
    `${node.name} was not built from the current layout`
  );
  invariant(Number.isInteger(node.mesh), `${node.name} lost its mesh`);
}

for (const node of treeNodes) {
  invariant(
    expectedTreeIds.has(node.extras.tka_frame_tree_id),
    `Unexpected frame tree: ${node.extras.tka_frame_tree_id}`
  );
}
for (const node of propNodes) {
  const extras = node.extras;
  invariant(
    expectedPropIds.has(extras.tka_static_prop_id),
    `Unexpected static prop: ${extras.tka_static_prop_id}`
  );
  invariant(
    expectedVignetteIds.has(extras.tka_static_prop_vignette),
    `Unexpected vignette: ${extras.tka_static_prop_vignette}`
  );
  const priorMesh = sourceMeshById.get(extras.tka_static_prop_source);
  if (priorMesh != null) {
    invariant(
      priorMesh === node.mesh,
      `Repeated source ${extras.tka_static_prop_source} lost mesh reuse`
    );
  } else {
    sourceMeshById.set(extras.tka_static_prop_source, node.mesh);
  }
}

invariant(
  Number(metrics.frameTreeCount) === expectedTrees.length,
  "Builder metrics do not match the frame-tree contract"
);
invariant(
  Number(metrics.propCount) === expectedProps.length,
  "Builder metrics do not match the static-prop contract"
);
invariant(
  Number(metrics.minimumPathShoulderMarginMetres) >=
    layout.rules.minimumPathShoulderMarginMetres,
  "Static props entered a protected path shoulder"
);
invariant(
  Number(metrics.minimumCampfireCenterDistanceMetres) >=
    layout.rules.minimumCampfireCenterDistanceMetres,
  "Static props entered the campfire safety pocket"
);
invariant(
  Number(metrics.maximumPropAnchorDistanceMetres) <=
    layout.rules.maximumPropDistanceFromAnchorMetres,
  "A static prop became detached from its vignette anchor"
);

console.log(
  JSON.stringify(
    {
      glbPath,
      bytes,
      layoutVersion: layout.version,
      layoutSha256,
      frameTrees: treeNodes.map((node) => node.extras.tka_frame_tree_id),
      staticProps: propNodes.map((node) => node.extras.tka_static_prop_id),
      vignettes: [...expectedVignetteIds],
      sharedSourceMeshes: Object.fromEntries(sourceMeshById),
      margins: {
        pathShoulderMetres: metrics.minimumPathShoulderMarginMetres,
        campfireCenterMetres: metrics.minimumCampfireCenterDistanceMetres,
        maximumAnchorDistanceMetres: metrics.maximumPropAnchorDistanceMetres,
      },
      extensions: [...extensions],
    },
    null,
    2
  )
);
