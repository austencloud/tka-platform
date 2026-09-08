/**
 * Lossless meshopt packing after blender-export-rainbow.py.
 * Keep float positions intact: the fabric shader uses authored metre coordinates.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const requireFromCli = createRequire(
  path.join(
    root,
    "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/package.json"
  )
);
const { NodeIO } = await import(
  pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))
);
const { ALL_EXTENSIONS, EXTMeshoptCompression } = await import(
  pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))
);
const { reorder } = await import(
  pathToFileURL(requireFromCli.resolve("@gltf-transform/functions"))
);
const { MeshoptEncoder, MeshoptDecoder } = await import(
  pathToFileURL(requireFromCli.resolve("meshoptimizer"))
);
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
const output = path.join(root, "static/models/rainbow/spectrum-commons.glb");
const document = await io.read(output);
await document.transform(reorder({ encoder: MeshoptEncoder, target: "size" }));
document
  .createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({
    method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
  });
const bytes = await io.writeBinary(document);
await writeFile(output, bytes);
const manifestPath = path.join(
  root,
  "static/models/rainbow/spectrum-commons-manifest.json"
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.bytes = bytes.length;
manifest.compression = "EXT_meshopt_compression; float positions preserved";
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
