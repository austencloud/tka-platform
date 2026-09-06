/** Generate Celestial's editable tree family with EZ-Tree; Blender owns placement. */
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const library = path.join(root, "node_modules/@dgreenheck/ez-tree");
const output = path.join(root, "blender/celestial/ez-tree-assets");
await mkdir(output, { recursive: true });
// EZ-Tree eagerly loads browser textures. Its raw geometry is used here; Blender
// loads the original atlas files, so no browser texture decoding is required.
const element = () => ({
  addEventListener() {},
  removeEventListener() {},
  set src(value) {},
});
globalThis.document = { createElementNS: element, createElement: element };
const { Tree } = await import("@dgreenheck/ez-tree");
const base = JSON.parse(
  await readFile(path.join(library, "src/lib/presets/ash_medium.json"), "utf8")
);
const variants = [];
for (const [id, seed, lean] of [
  ["courtyard", 36330, 0.025],
  ["windswept", 42671, 0.065],
  ["garden", 85123, -0.025],
]) {
  const options = structuredClone(base);
  options.seed = seed;
  options.branch.sections = { 0: 24, 1: 16, 2: 10, 3: 6 };
  options.branch.segments = { 0: 20, 1: 12, 2: 8, 3: 5 };
  options.branch.children = { 0: 8, 1: 6, 2: 4 };
  options.branch.gnarliness = { 0: 0.025, 1: 0.15, 2: 0.19, 3: 0.06 };
  options.branch.start[1] = 0.32;
  options.branch.force.direction = { x: lean, y: 1, z: 0.012 };
  options.branch.force.strength = 0.014;
  options.leaves.count = 14;
  options.leaves.size = 2.15;
  options.leaves.sizeVariance = 0.48;
  const tree = new Tree();
  tree.loadFromJson(options);
  const height = Math.max(
    ...tree.branches.verts.filter((_, i) => i % 3 === 1),
    ...tree.leaves.verts.filter((_, i) => i % 3 === 1)
  );
  const raw = (part) => ({
    verts: part.verts,
    indices: part.indices,
    uvs: part.uvs,
    normals: part.normals,
  });
  const data = {
    id,
    generator: "@dgreenheck/ez-tree@1.1.0",
    height,
    options,
    wood: raw(tree.branches),
    leaves: raw(tree.leaves),
  };
  await writeFile(path.join(output, `${id}.json`), JSON.stringify(data));
  variants.push({
    id,
    seed,
    sourceHeight: height,
    woodTriangles: tree.branches.indices.length / 3,
    leafTriangles: tree.leaves.indices.length / 3,
  });
}
for (const map of ["color", "normal", "roughness", "ao"]) {
  await copyFile(
    path.join(library, `src/lib/assets/bark/oak_${map}_1k.jpg`),
    path.join(output, `oak_${map}_1k.jpg`)
  );
}
await copyFile(
  path.join(library, "src/lib/assets/leaves/ash_color.png"),
  path.join(output, "ash_color.png")
);
await copyFile(
  path.join(library, "LICENSE"),
  path.join(root, "static/models/celestial/EZ-TREE-LICENSE.txt")
);
await writeFile(
  path.join(output, "family.json"),
  JSON.stringify(
    {
      generator: "@dgreenheck/ez-tree@1.1.0",
      textureResolution: 1024,
      variants,
    },
    null,
    2
  ) + "\n"
);
console.log(JSON.stringify(variants, null, 2));
