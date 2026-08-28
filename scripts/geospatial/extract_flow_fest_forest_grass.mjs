#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const input = resolve("static/models/forest/forest-near-frame.glb");
const output = resolve(
  "static/models/flow-fest-sim/ecology/forest-grass-prototypes.glb"
);
const sourceOutput = `${output}.source.glb`;
const prototypeNames = [
  "ForestEcosystemMesh_summer-sward_carpet_base-tuft-01",
  "ForestEcosystemMesh_woodland-grass_carpet_shade-tuft-01",
];

const requireFromCli = createRequire(
  realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
);
const [
  { NodeIO },
  { ALL_EXTENSIONS },
  { prune },
  { MeshoptDecoder },
  draco3d,
] = await Promise.all([
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/functions"))),
  import(pathToFileURL(requireFromCli.resolve("meshoptimizer"))),
  import(pathToFileURL(requireFromCli.resolve("draco3dgltf"))),
]);

await MeshoptDecoder.ready;
const [dracoDecoder, dracoEncoder] = await Promise.all([
  draco3d.createDecoderModule(),
  draco3d.createEncoderModule(),
]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "draco3d.decoder": dracoDecoder,
    "draco3d.encoder": dracoEncoder,
  });

const document = await io.read(input);
const root = document.getRoot();
const selected = new Map(
  root
    .listMeshes()
    .filter((mesh) => prototypeNames.includes(mesh.getName()))
    .map((mesh) => [mesh.getName(), mesh])
);
for (const name of prototypeNames) {
  if (!selected.has(name)) throw new Error(`Missing Forest prototype: ${name}`);
}

for (const scene of root.listScenes()) scene.dispose();
for (const node of root.listNodes()) node.dispose();
const scene = document.createScene("Flow Fest Forest Grass Prototypes");
for (const name of prototypeNames) {
  scene.addChild(document.createNode(name).setMesh(selected.get(name)));
}
for (const mesh of root.listMeshes()) {
  if (!selected.has(mesh.getName())) mesh.dispose();
}

await document.transform(prune());
await mkdir(dirname(output), { recursive: true });
await io.write(sourceOutput, document);
const gltfTransform = resolve("node_modules/@gltf-transform/cli/bin/cli.js");
try {
  execFileSync(
    process.execPath,
    [
      gltfTransform,
      "optimize",
      sourceOutput,
      output,
      "--compress",
      "draco",
      "--texture-compress",
      "webp",
      "--texture-size",
      "256",
      "--simplify",
      "false",
      "--instance",
      "false",
      "--flatten",
      "false",
      "--join",
      "false",
    ],
    { stdio: "inherit" }
  );
} finally {
  await rm(sourceOutput, { force: true });
}

const bytes = (await stat(output)).size;
const meshes = document.getRoot().listMeshes();
const triangles = meshes.reduce(
  (total, mesh) =>
    total +
    mesh.listPrimitives().reduce(
      (meshTotal, primitive) =>
        meshTotal +
        (primitive.getIndices()?.getCount() ??
          primitive.getAttribute("POSITION")?.getCount() ??
          0) /
          3,
      0
    ),
  0
);
console.log(
  JSON.stringify(
    {
      input,
      output,
      bytes,
      meshes: meshes.map((mesh) => mesh.getName()),
      triangles,
    },
    null,
    2
  )
);
