/** Decode the already shipped olive assets for Blender authoring. */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(
  path.join(
    root,
    "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/package.json"
  )
);
const { NodeIO } = await import(
  pathToFileURL(require.resolve("@gltf-transform/core"))
);
const { ALL_EXTENSIONS } = await import(
  pathToFileURL(require.resolve("@gltf-transform/extensions"))
);
const { dequantize } = await import(
  pathToFileURL(require.resolve("@gltf-transform/functions"))
);
const { MeshoptDecoder } = await import(
  pathToFileURL(require.resolve("meshoptimizer"))
);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
await mkdir(path.join(root, ".sunward-source"), { recursive: true });
for (const name of [
  "olive-west-ancient",
  "olive-east-windswept",
  "coast-rocks-05",
  "sand-rocks-small-01",
]) {
  const doc = await io.read(
    path.join(
      root,
      "static/models/celestial/cloudbreak",
      name.startsWith("olive") ? "source" : "rocks",
      name + ".glb"
    )
  );
  await doc.transform(dequantize());
  for (const texture of doc.getRoot().listTextures()) {
    texture.setImage(await sharp(texture.getImage()).png().toBuffer());
    texture.setMimeType("image/png");
  }
  for (const ext of doc.getRoot().listExtensionsUsed())
    if (ext.extensionName === "EXT_meshopt_compression") ext.dispose();
  await mkdir(path.join(root, ".sunward-source", name), { recursive: true });
  await io.write(path.join(root, ".sunward-source", name, "olive.gltf"), doc);
}
