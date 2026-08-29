#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const OUTPUT_DIRECTORY = resolve(
  "static/models/flow-fest-sim/ecology/distance-lod"
);
const MANIFEST_PATH = resolve(OUTPUT_DIRECTORY, "manifest.json");
const GLTF_TRANSFORM = resolve("node_modules/@gltf-transform/cli/bin/cli.js");

const SOURCES = [
  "island-tree-01-flow-lod-512.glb",
  "island-tree-02-flow-lod-512.glb",
  "island-tree-03-flow-lod-512.glb",
  "tree-small-02-flow-lod-512.glb",
];

const TIERS = [
  { id: "mid", ratio: 0.2, error: 0.1 },
  { id: "far", ratio: 0.1, error: 0.15 },
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function triangleCount(document) {
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      triangles +=
        (primitive.getIndices()?.getCount() ??
          primitive.getAttribute("POSITION")?.getCount() ??
          0) / 3;
    }
  }
  return Math.round(triangles);
}

function runSimplify(input, output, tier) {
  execFileSync(
    process.execPath,
    [
      GLTF_TRANSFORM,
      "simplify",
      input,
      output,
      "--ratio",
      String(tier.ratio),
      "--error",
      String(tier.error),
      "--lock-border",
      "false",
    ],
    { stdio: "inherit" }
  );
}

async function main() {
  if (!existsSync(GLTF_TRANSFORM)) {
    throw new Error(`glTF Transform CLI is unavailable: ${GLTF_TRANSFORM}`);
  }
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

  const requireFromCli = createRequire(
    realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
  );
  const [{ NodeIO }, { ALL_EXTENSIONS }, { prune }] = await Promise.all([
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/functions"))),
  ]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const manifest = {
    schemaVersion: 1,
    purpose:
      "Geometry-only distance tiers for Flow Fest trees. Runtime reuses the accepted near-tree materials and textures.",
    tiers: Object.fromEntries(
      TIERS.map((tier) => [tier.id, { ratio: tier.ratio, error: tier.error }])
    ),
    assets: [],
  };

  for (const sourceName of SOURCES) {
    const source = resolve("static/models/flow-fest-sim/ecology", sourceName);
    if (!existsSync(source)) throw new Error(`Missing source tree: ${source}`);
    const sourceDocument = await io.read(source);
    const sourceTriangles = triangleCount(sourceDocument);
    const sourceId = sourceName.replace("-flow-lod-512.glb", "");

    for (const tier of TIERS) {
      const temporary = resolve(
        OUTPUT_DIRECTORY,
        `_${sourceId}-${tier.id}-textured.glb`
      );
      const output = resolve(OUTPUT_DIRECTORY, `${sourceId}-${tier.id}.glb`);
      if (existsSync(temporary)) rmSync(temporary);

      try {
        runSimplify(source, temporary, tier);
        const document = await io.read(temporary);
        const root = document.getRoot();
        const placeholders = new Map();
        for (const mesh of root.listMeshes()) {
          for (const primitive of mesh.listPrimitives()) {
            const sourceMaterial = primitive.getMaterial();
            const materialName = sourceMaterial?.getName() || "tree-material";
            let placeholder = placeholders.get(materialName);
            if (!placeholder) {
              placeholder = document
                .createMaterial(materialName)
                .setExtras({ tka_source_material_name: materialName });
              placeholders.set(materialName, placeholder);
            }
            primitive.setMaterial(placeholder);
          }
        }
        await document.transform(prune());
        await io.write(output, document);
        manifest.assets.push({
          source: basename(source),
          sourceSha256: sha256(source),
          sourceTriangles,
          tier: tier.id,
          output: basename(output),
          outputSha256: sha256(output),
          outputBytes: statSync(output).size,
          outputTriangles: triangleCount(document),
        });
      } finally {
        if (existsSync(temporary)) rmSync(temporary);
      }
    }
  }

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${manifest.assets.length} tree LOD assets.`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
}

await main();
