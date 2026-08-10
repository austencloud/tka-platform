#!/usr/bin/env node
/** Verify the Olive Cloudbreak production asset contract. */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const integrated = process.argv.includes("--integrated");
const assetStem = integrated
  ? "seraphic-vault-integrated-sanctuaries"
  : "olive-cloudbreak-production-slice";
const optimizedPath = resolve(`static/models/celestial/${assetStem}.glb`);
const rawPath = resolve(`static/models/celestial/${assetStem}_raw.glb`);
const maximumBytes = 8 * 1024 * 1024;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readGlb(path) {
  const buffer = readFileSync(path);
  invariant(buffer.length >= 20, `${path} is too short for a GLB header`);
  invariant(buffer.readUInt32LE(0) === 0x46546c67, `${path} has invalid magic`);
  invariant(buffer.readUInt32LE(4) === 2, `${path} must use glTF 2.0`);
  invariant(
    buffer.readUInt32LE(8) === buffer.length,
    `${path} has an invalid declared length`
  );
  const jsonLength = buffer.readUInt32LE(12);
  return {
    buffer,
    json: JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8")),
  };
}

const optimized = readGlb(optimizedPath);
const raw = readGlb(rawPath);
const extensions = new Set(optimized.json.extensionsUsed ?? []);
const semanticNodes = (raw.json.nodes ?? []).filter((node) =>
  integrated
    ? node.extras?.tka_platform
    : node.extras?.tka_scene === "seraphic-vault" &&
      node.extras?.tka_revision === "olive-cloudbreak-gate4-r1"
);
const roles = Object.groupBy(
  semanticNodes,
  (node) => node.extras?.tka_role ?? "unknown"
);
const platformCounts = Object.groupBy(
  semanticNodes,
  (node) => node.extras?.tka_platform ?? "unknown"
);
const lightCount =
  optimized.json.extensions?.KHR_lights_punctual?.lights?.length ?? 0;

invariant(
  optimized.buffer.length <= maximumBytes,
  `Production slice exceeds ${maximumBytes} bytes: ${optimized.buffer.length}`
);
invariant(
  optimized.json.scenes?.length === 1,
  "Production slice must contain one scene"
);
invariant(
  (optimized.json.cameras?.length ?? 0) === 0,
  "Production slice contains a camera"
);
invariant(lightCount === 0, "Production slice contains a light");
invariant(
  extensions.has("EXT_meshopt_compression"),
  "Production slice lost meshopt compression"
);
invariant(
  extensions.has("KHR_texture_basisu"),
  "Production slice textures are not KTX2 encoded"
);
if (integrated) {
  for (const platformId of [
    "broken-vigil",
    "twin-choir",
    "eroded-halo",
    "cloud-crown",
  ]) {
    invariant(
      (platformCounts[platformId]?.length ?? 0) > 0,
      `Integrated sanctuary asset is missing ${platformId}`
    );
  }
  invariant(
    (roles["responsive-platform-root"]?.length ?? 0) === 4,
    "Integrated sanctuary asset must contain four responsive roots"
  );
  invariant(
    (roles["distant-sanctuary-deck"]?.length ?? 0) === 4,
    "Integrated sanctuary asset must contain four decks"
  );
  invariant(
    (roles["distant-sanctuary-feather-spire"]?.length ?? 0) === 2,
    "Twin Choir must contain two Meshy feather spires"
  );
  invariant(
    (roles["distant-sanctuary-eroded-ring"]?.length ?? 0) === 2,
    "Eroded Halo must contain two eroded ring segments"
  );
  invariant(
    (roles["distant-sanctuary-cloud-crown"]?.length ?? 0) === 5,
    "Cloud Crown must contain five crown points"
  );
  invariant(
    (roles["distant-sanctuary-cloud-collar"]?.length ?? 0) >= 30,
    "Integrated sanctuary field needs cloud collars around every platform"
  );
} else {
  invariant(
    (roles["cloudbreak-landmass"]?.length ?? 0) === 1,
    "Olive Cloudbreak must contain one continuous landmass"
  );
  invariant(
    (roles["cloudbreak-performance-terrace"]?.length ?? 0) === 1,
    "Olive Cloudbreak must contain one dry performance terrace"
  );
  invariant(
    (roles["cloudbreak-lagoon-water"]?.length ?? 0) === 1,
    "Olive Cloudbreak must contain exactly one lagoon"
  );
  invariant(
    (roles["cloudbreak-lagoon-rim"]?.length ?? 0) === 1,
    "Olive Cloudbreak must contain one natural lagoon rim"
  );
  invariant(
    (roles["cloudbreak-distant-mesa"]?.length ?? 0) === 4,
    "Olive Cloudbreak must contain four distant mesas"
  );
  invariant(
    (roles["cloudbreak-distant-mesa-cap"]?.length ?? 0) === 4,
    "Every distant mesa must have a limestone cap"
  );
  invariant(
    (roles["cloudbreak-waterfall"]?.length ?? 0) === 4,
    "Olive Cloudbreak must contain the lagoon overflow and three distant falls"
  );
  invariant(
    (roles["cloudbreak-olive-canopy"]?.length ?? 0) === 3,
    "Olive Cloudbreak must contain two foreground olives and one distant olive"
  );
  invariant(
    (roles["cloudbreak-surface-stone"]?.length ?? 0) === 1,
    "Olive Cloudbreak must contain one authored surface-stone field"
  );
  invariant(
    (roles["cloudbreak-weathered-surface"]?.length ?? 0) === 1,
    "Olive Cloudbreak must contain one weathered limestone surface"
  );
  invariant(
    (roles["broken-feather-arc"]?.length ?? 0) === 0 &&
      (roles["distant-sanctuary-deck"]?.length ?? 0) === 0,
    "Superseded feather-sanctuary roles remain in Olive Cloudbreak"
  );
}

const digest = createHash("sha256").update(optimized.buffer).digest("hex");
console.log(
  JSON.stringify(
    {
      asset: assetStem,
      optimizedPath,
      bytes: optimized.buffer.length,
      sha256: digest,
      scenes: optimized.json.scenes.length,
      nodes: optimized.json.nodes?.length ?? 0,
      meshes: optimized.json.meshes?.length ?? 0,
      materials: optimized.json.materials?.length ?? 0,
      textures: optimized.json.textures?.length ?? 0,
      extensions: [...extensions],
      semanticRoles: Object.fromEntries(
        Object.entries(roles).map(([role, nodes]) => [role, nodes.length])
      ),
      platforms: Object.fromEntries(
        Object.entries(platformCounts).map(([platformId, nodes]) => [
          platformId,
          nodes.length,
        ])
      ),
    },
    null,
    2
  )
);
