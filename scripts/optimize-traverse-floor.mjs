/**
 * Compress the trench floor GLB.
 *
 * Separate from optimize-ocean-glb.mjs for one reason: that pipeline runs
 * `--simplify true`, and simplification is wrong for a height field. Run
 * through it, the floor came back 28,458 triangles -> 2,845. Every dune crest
 * meshoptimizer collapsed is a hole the visitor can see the ridge walls
 * through, and the collider grid — which reads the analytic field, not the
 * mesh — would no longer match the ground being drawn.
 *
 * So: weld and quantize and meshopt-compress, and keep every triangle. The
 * floor is one untextured sheet; at ~28k triangles it costs less than a single
 * coral in the gallery beside it.
 *
 * Usage: node scripts/optimize-traverse-floor.mjs [inputGlb] [outputGlb]
 */

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { statSync } from "node:fs";
import path from "node:path";

const req = createRequire(
  path.resolve(
    "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/package.json"
  )
);

const { NodeIO } = await import(pathToFileURL(req.resolve("@gltf-transform/core")));
const { ALL_EXTENSIONS, EXTMeshoptCompression } = await import(
  pathToFileURL(req.resolve("@gltf-transform/extensions"))
);
const { dedup, weld, quantize, prune } = await import(
  pathToFileURL(req.resolve("@gltf-transform/functions"))
);
const MeshoptEncoder = (
  await import(pathToFileURL(req.resolve("meshoptimizer")))
).MeshoptEncoder;

const input =
  process.argv[2] ?? "static/models/water-traverse/trench-floor_raw.glb";
const output =
  process.argv[3] ?? "static/models/water-traverse/trench-floor.glb";

await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });

const document = await io.read(input);

await document.transform(
  dedup(),
  // Tolerance 0 only merges vertices that are already identical — the grid's
  // shared edges. Anything looser starts moving the surface.
  weld({ tolerance: 0 }),
  // 14 bits over a 138 m x 84 m sheet is ~1 cm. Below what anyone can see at
  // 18 m depth, and the single biggest size win on an untextured mesh.
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8 }),
  prune()
);

document
  .createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

await io.write(output, document);

const before = statSync(input).size / 1024;
const after = statSync(output).size / 1024;
const mesh = document.getRoot().listMeshes()[0];
const primitive = mesh?.listPrimitives()[0];
const triangles = primitive ? primitive.getIndices().getCount() / 3 : 0;

console.log(`wrote ${output}`);
console.log(
  `  ${before.toFixed(0)} KB -> ${after.toFixed(0)} KB, ` +
    `${triangles.toLocaleString()} triangles kept`
);
