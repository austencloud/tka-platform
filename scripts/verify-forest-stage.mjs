#!/usr/bin/env node
/** Verify the Forest-owned Gate 10 stage artifact and spatial contract. */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const glbPath = resolve("static/models/forest/forest-stage.glb");
const layoutPath = resolve("scripts/forest-stage-layout.json");
const layoutBytes = readFileSync(layoutPath);
const layout = JSON.parse(layoutBytes.toString("utf8"));
const layoutSha256 = createHash("sha256").update(layoutBytes).digest("hex");
const metricsPath = join(
  tmpdir(),
  "tka-forest-evidence",
  "forest_stage_metrics.json"
);
const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));

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
  (node) => node.extras?.tka_export_layer === "forest-stage"
);
const roleCounts = authoredNodes.reduce((counts, node) => {
  const role = node.extras?.tka_role;
  counts[role] = (counts[role] ?? 0) + 1;
  return counts;
}, {});
const expectedRoles = {
  "stage-deck": 1,
  "stage-plinth": 1,
  "stage-ground-contact": 1 + layout.rootButtresses.length,
  "stage-approach": layout.approachSteps.length,
  "stage-deck-ecology": layout.mossPatches.length,
  "stage-direction-cue": 5,
};

invariant(
  bytes <= layout.rules.maximumAssetBytes,
  `Forest stage exceeds ${layout.rules.maximumAssetBytes} bytes: ${bytes}`
);
invariant(gltf.scenes?.length === 1, "Forest stage must contain one scene");
invariant(
  (gltf.cameras?.length ?? 0) === 0,
  "QA cameras leaked into the stage GLB"
);
invariant(
  (gltf.extensions?.KHR_lights_punctual?.lights?.length ?? 0) === 0,
  "QA lights leaked into the stage GLB"
);
invariant(
  extensions.has("EXT_meshopt_compression"),
  "Forest stage lost meshopt compression"
);
invariant(
  extensions.has("EXT_texture_webp"),
  "Forest stage textures are not WebP encoded"
);
invariant(
  authoredNodes.length ===
    Object.values(expectedRoles).reduce((total, count) => total + count, 0),
  `Unexpected Forest stage node count: ${authoredNodes.length}`
);

for (const [role, count] of Object.entries(expectedRoles)) {
  invariant(
    (roleCounts[role] ?? 0) === count,
    `Expected ${count} ${role} nodes, found ${roleCounts[role] ?? 0}`
  );
}
for (const node of authoredNodes) {
  invariant(Number.isInteger(node.mesh), `${node.name} lost its mesh`);
  invariant(
    Number(node.extras.tka_stage_layout_version) === layout.version,
    `${node.name} has the wrong layout version`
  );
  invariant(
    node.extras.tka_stage_layout_sha256 === layoutSha256,
    `${node.name} was not built from the current stage layout`
  );
}

const dimensions = layout.baseDimensions;
invariant(
  Number(metrics.deckWidthMetres) >= layout.rules.minimumDeckWidthMetres,
  "Forest stage deck became too narrow"
);
invariant(
  Number(metrics.deckDepthMetres) >= layout.rules.minimumDeckDepthMetres,
  "Forest stage deck became too shallow"
);
invariant(
  Math.abs(
    Number(metrics.deckTopHeightMetres) - dimensions.deckTopHeightMetres
  ) <= layout.rules.deckTopHeightToleranceMetres,
  "Forest stage no longer meets the canonical performer surface"
);
invariant(
  Number(metrics.maximumContactRadiusMetres) <=
    layout.rules.maximumContactRadiusMetres,
  "Forest stage contact apron escaped its Gate 10 envelope"
);
invariant(
  Number(metrics.minimumCampfireEdgeDistanceMetres) >=
    layout.rules.minimumCampfireEdgeDistanceMetres,
  "Forest stage entered the approved campfire separation distance"
);
invariant(
  Number(metrics.minimumContactCoreRadiusMetres) >=
    layout.rules.performanceCoreClearRadiusMetres,
  "Forest stage roots entered the central performance core"
);

console.log(
  JSON.stringify(
    {
      glbPath,
      bytes,
      layoutVersion: layout.version,
      layoutSha256,
      authoredNodes: authoredNodes.length,
      roleCounts,
      dimensions: {
        widthMetres: metrics.deckWidthMetres,
        depthMetres: metrics.deckDepthMetres,
        deckTopHeightMetres: metrics.deckTopHeightMetres,
        deckAreaSquareMetres: metrics.deckAreaSquareMetres,
      },
      margins: {
        maximumContactRadiusMetres: metrics.maximumContactRadiusMetres,
        minimumCampfireEdgeDistanceMetres:
          metrics.minimumCampfireEdgeDistanceMetres,
        minimumContactCoreRadiusMetres: metrics.minimumContactCoreRadiusMetres,
      },
      extensions: [...extensions],
    },
    null,
    2
  )
);
