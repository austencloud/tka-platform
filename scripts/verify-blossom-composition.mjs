#!/usr/bin/env node
/** Verify the active amphitheatre export; visual acceptance belongs to Austen. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const evidence = resolve(
  root,
  "docs/superpowers/specs/blossom-amphitheatre/evidence"
);
const [buffer, plan, manifest, geometry] = await Promise.all([
  readFile(resolve(root, "static/models/blossom/blossom_environment.glb")),
  readFile(
    resolve(root, "static/models/blossom/amphitheatre-plan.json"),
    "utf8"
  ).then(JSON.parse),
  readFile(
    resolve(root, "static/models/blossom/amphitheatre-manifest.json"),
    "utf8"
  ).then(JSON.parse),
  readFile(resolve(evidence, "geometry-validation.json"), "utf8").then(
    JSON.parse
  ),
]);
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
invariant(
  buffer.toString("utf8", 0, 4) === "glTF",
  "Asset must be binary glTF"
);
const doc = JSON.parse(
  buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString("utf8")
);
const nodes = new Map(doc.nodes.map((node) => [node.name, node]));
for (const name of [
  "Amphitheatre_Terrain",
  "River_Water",
  "Amphitheatre_Terraces",
  "Amphitheatre_Arrival",
  "Stage_Planks",
  "Amphitheatre_Stage_Foundation",
  "Amphitheatre_Shore_Stones",
  "Amphitheatre_Lantern_Frames",
  "Amphitheatre_Lantern_Washi",
  "Amphitheatre_Understory",
  "Amphitheatre_Fallen_Petals",
  "Amphitheatre_Entry_Portal",
])
  invariant(nodes.has(name), `Missing authored geometry: ${name}`);
for (const role of ["bark", "petals"])
  invariant(
    doc.nodes.some((node) => node.extras?.blossomRole === role),
    `Missing tree role: ${role}`
  );
// glTF-Transform removes extras on GPU instance nodes. Their shared mesh names
// remain stable; these meshes intentionally do not cast the near shadow map.
for (const part of ["Wood", "Blossoms"])
  invariant(
    doc.nodes.filter(
      (node) =>
        node.extensions?.EXT_mesh_gpu_instancing &&
        doc.meshes[node.mesh].name.startsWith(`Companion_Cherry_${part}_30`)
    ).length === 3,
    `Expected three instanced grove ${part} templates`
  );
for (const extension of [
  "EXT_mesh_gpu_instancing",
  "EXT_meshopt_compression",
  "EXT_texture_webp",
])
  invariant(
    doc.extensionsUsed.includes(extension),
    `Missing delivery optimization: ${extension}`
  );
invariant(
  geometry.valid && geometry.failures.length === 0,
  "Blender clearance audit failed"
);
invariant(
  Math.abs(geometry.deckTop - plan.stage.deckTop) < 0.001,
  "Stage anchor drift"
);
invariant(
  manifest.heroTrees === 1 && manifest.companionTrees === plan.trees.length - 1,
  "Tree manifest drift"
);
invariant(
  plan.circulation.paths.length === 2,
  "Expected public and service approaches"
);
invariant(plan.water.outline.length >= 64, "Pond boundary is underspecified");
invariant(
  plan.water.outline.every(
    ([x, depth]) => Math.abs(x) <= 27.001 && depth >= 5.59
  ),
  "Pond intrudes on the performance court"
);
invariant(buffer.length < 32 * 1024 * 1024, "Export exceeds 32 MiB");
const triangles = doc.nodes.reduce((sum, node) => {
  if (node.mesh === undefined || node.extras?.blossomRole === "stage-proxy")
    return sum;
  const attributes = node.extensions?.EXT_mesh_gpu_instancing?.attributes;
  const instances = attributes
    ? doc.accessors[Object.values(attributes)[0]].count
    : 1;
  return (
    sum +
    instances *
      doc.meshes[node.mesh].primitives.reduce(
        (count, primitive) =>
          count +
          doc.accessors[primitive.indices ?? primitive.attributes.POSITION]
            .count /
            3,
        0
      )
  );
}, 0);
invariant(triangles < 4_200_000, "Authored geometry exceeds 4.2M triangles");
const report = {
  planId: plan.planId,
  status: "technical-checks-passed",
  visualAcceptance: plan.approvalGate.visualAcceptance,
  checkedAt: new Date().toISOString(),
  asset: "static/models/blossom/blossom_environment.glb",
  assetSha256: createHash("sha256").update(buffer).digest("hex"),
  assetSizeMiB: +(buffer.length / 1024 / 1024).toFixed(2),
  renderedTriangles: triangles,
  trees: plan.trees.length,
  lanterns: plan.lanterns.length,
  geometry,
  extensions: doc.extensionsUsed,
  limitations: [
    "Clearance is a sampled vertex check, not collision certification.",
    "48 audience places is a design target; seating capacity has not been validated.",
    "Runtime frame rate must be measured separately.",
  ],
};
await writeFile(
  resolve(evidence, "technical-validation.json"),
  JSON.stringify(report, null, 2) + "\n"
);
console.log(JSON.stringify(report, null, 2));
