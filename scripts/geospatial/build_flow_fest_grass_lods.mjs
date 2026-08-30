#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE = resolve(
  "static/models/flow-fest-sim/ecology/forest-grass-prototypes.glb"
);
const OUTPUT_DIRECTORY = resolve(
  "static/models/flow-fest-sim/ecology/distance-lod/grass"
);
const MANIFEST_PATH = resolve(OUTPUT_DIRECTORY, "manifest.json");
const GLTF_TRANSFORM = resolve("node_modules/@gltf-transform/cli/bin/cli.js");

const TIERS = [
  { id: "mid", ratio: 0.35, error: 0.02 },
  { id: "far", ratio: 0.15, error: 0.04 },
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

function runSimplify(output, tier) {
  execFileSync(
    process.execPath,
    [
      GLTF_TRANSFORM,
      "simplify",
      SOURCE,
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
  if (!existsSync(SOURCE)) throw new Error(`Missing source grass: ${SOURCE}`);
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

  const requireFromCli = createRequire(
    realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
  );
  const [{ NodeIO }, { ALL_EXTENSIONS }, { MeshoptDecoder }, draco3d] =
    await Promise.all([
      import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
      import(
        pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))
      ),
      import(pathToFileURL(requireFromCli.resolve("meshoptimizer"))),
      import(pathToFileURL(requireFromCli.resolve("draco3dgltf"))),
    ]);
  await MeshoptDecoder.ready;
  const dracoDecoder = await draco3d.createDecoderModule();
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "meshopt.decoder": MeshoptDecoder,
      "draco3d.decoder": dracoDecoder,
    });
  const sourceDocument = await io.read(SOURCE);
  const sourceTriangles = triangleCount(sourceDocument);
  const manifest = {
    schemaVersion: 1,
    purpose:
      "Distance geometry tiers for Flow Fest grass. Each tier retains the accepted Forest grass material, palette textures, and UVs.",
    source: basename(SOURCE),
    sourceSha256: sha256(SOURCE),
    sourceTriangles,
    tiers: [],
  };

  for (const tier of TIERS) {
    const output = resolve(
      OUTPUT_DIRECTORY,
      `forest-grass-prototypes-${tier.id}.glb`
    );
    runSimplify(output, tier);
    const document = await io.read(output);
    manifest.tiers.push({
      id: tier.id,
      ratio: tier.ratio,
      error: tier.error,
      output: basename(output),
      outputSha256: sha256(output),
      outputBytes: statSync(output).size,
      outputTriangles: triangleCount(document),
    });
  }

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${manifest.tiers.length} grass LOD assets.`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
}

await main();
