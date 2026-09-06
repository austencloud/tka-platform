/**
 * Pack the authored Celestial citadel with instancing, WebP textures and meshopt.
 * Float positions retain the measured court and shore contacts.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createHash } from "node:crypto";

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
const { reorder, instance, dedup, prune, textureCompress } = await import(
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
const output = path.join(root, "static/models/celestial/sky-citadel.glb");
const document = await io.read(output);
await document.transform(
  textureCompress({
    encoder: sharp,
    targetFormat: "webp",
    resize: [1024, 1024],
  }),
  dedup(),
  instance({ min: 2 }),
  prune(),
  reorder({ encoder: MeshoptEncoder, target: "size" })
);
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
  "static/models/celestial/sky-citadel-manifest.json"
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.bytes = bytes.length;
manifest.compression = "EXT_meshopt_compression; float positions preserved";
manifest.textureFormat = "WebP, maximum 1024 square";
manifest.sha256 = createHash("sha256").update(bytes).digest("hex");
manifest.meshes = document.getRoot().listMeshes().length;
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
