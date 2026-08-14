#!/usr/bin/env node
/** Bake the Forest floor as one causal, world-space ecological atlas. */

import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const MATERIAL_CONTRACT_PATH = resolve("scripts/forest-ground-materials.json");
const PATH_LAYOUT_PATH = resolve("scripts/forest-path-layout.json");
const TREE_LAYOUT_PATH = resolve("scripts/forest-tree-layout.json");
const GROUND_LIFE_LAYOUT_PATH = resolve(
  "scripts/forest-ground-life-layout.json"
);
const STATIC_PROP_LAYOUT_PATH = resolve(
  "scripts/forest-static-prop-layout.json"
);
const COMPOSITION_LAYOUT_PATH = resolve(
  "scripts/forest-composition-revision.json"
);
const OUTPUT = resolve("static/textures/forest-floor/forest-floor-zoned.jpg");
const MASK_OUTPUT = resolve(
  "docs/superpowers/specs/moonlit-firefly-forest/evidence/living-ground/forest-floor-ecology-mask.png"
);
const FAMILY_MASK_OUTPUT = resolve(
  "static/textures/forest-floor/forest-floor-family-mask.png"
);
const PATH_PLAN_OUTPUT = resolve(
  process.env.TEMP ?? ".",
  "tka-forest-evidence/forest_environment_path_plan.png"
);

const [
  materialContract,
  pathLayout,
  treeLayout,
  groundLifeLayout,
  staticPropLayout,
  compositionLayout,
] = await Promise.all(
  [
    MATERIAL_CONTRACT_PATH,
    PATH_LAYOUT_PATH,
    TREE_LAYOUT_PATH,
    GROUND_LIFE_LAYOUT_PATH,
    STATIC_PROP_LAYOUT_PATH,
    COMPOSITION_LAYOUT_PATH,
  ].map(async (path) => JSON.parse(await readFile(path, "utf8")))
);

const SIZE = materialContract.atlasSizePixels;
const MASK_SIZE = 1024;
const WORLD_EXTENT = materialContract.worldExtentMetres;
const FAMILIES = materialContract.sourceFamilies;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / Math.max(edge1 - edge0, 0.00001));
  return amount * amount * (3 - 2 * amount);
}

function mix(first, second, weight) {
  return first + (second - first) * clamp(weight);
}

function fract(value) {
  return value - Math.floor(value);
}

function valueNoise(x, y) {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const blendX = smoothstep(0, 1, fract(x));
  const blendY = smoothstep(0, 1, fract(y));
  const hash = (offsetX, offsetY) =>
    fract(
      Math.sin((cellX + offsetX) * 127.1 + (cellY + offsetY) * 311.7) *
        43758.5453
    );
  return mix(
    mix(hash(0, 0), hash(1, 0), blendX),
    mix(hash(0, 1), hash(1, 1), blendX),
    blendY
  );
}

function ecologicalNoise(x, y) {
  return (
    valueNoise(x * 0.075, y * 0.075) * 0.52 +
    valueNoise(x * 0.19 + 17.3, y * 0.19 - 8.1) * 0.31 +
    valueNoise(x * 0.43 - 4.6, y * 0.43 + 12.7) * 0.17
  );
}

function ellipseMetric(x, y, center, radii, rotationDegrees = 0) {
  const rotation = (rotationDegrees * Math.PI) / 180;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const localX = (x - center[0]) * cosine + (y - center[1]) * sine;
  const localY = -(x - center[0]) * sine + (y - center[1]) * cosine;
  return Math.hypot(localX / radii[0], localY / radii[1]);
}

function ellipseInfluence(x, y, definition, inner = 0.45, outer = 1.18) {
  return (
    1 -
    smoothstep(
      inner,
      outer,
      ellipseMetric(
        x,
        y,
        definition.center,
        definition.radii,
        definition.rotationDegrees ?? 0
      )
    )
  );
}

function harmonicRadius(angle, definition) {
  return definition.harmonics.reduce((radius, harmonic) => {
    const phase = angle * harmonic.frequency + harmonic.phase;
    const wave =
      harmonic.function === "cos" ? Math.cos(phase) : Math.sin(phase);
    return radius + harmonic.amplitude * wave;
  }, definition.baseRadius);
}

function pointSegmentDistance(x, y, first, second) {
  const segmentX = second[0] - first[0];
  const segmentY = second[1] - first[1];
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0) return Math.hypot(x - first[0], y - first[1]);
  const amount = clamp(
    ((x - first[0]) * segmentX + (y - first[1]) * segmentY) / lengthSquared
  );
  return Math.hypot(
    x - (first[0] + segmentX * amount),
    y - (first[1] + segmentY * amount)
  );
}

function distanceToPath(x, y, path) {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.points.length - 1; index += 1) {
    distance = Math.min(
      distance,
      pointSegmentDistance(x, y, path.points[index], path.points[index + 1])
    );
  }
  return distance;
}

function pathMasks(x, y, noise) {
  let core = 0;
  let shoulder = 0;
  for (const path of pathLayout.paths) {
    const distance = distanceToPath(x, y, path);
    const brokenEdge = (noise - 0.5) * 0.46;
    core = Math.max(
      core,
      1 -
        smoothstep(path.halfWidth * 0.52, path.halfWidth + brokenEdge, distance)
    );
    shoulder = Math.max(
      shoulder,
      1 -
        smoothstep(
          path.halfWidth + brokenEdge,
          path.halfWidth + path.shoulderWidth + brokenEdge,
          distance
        )
    );
  }
  return { core, shoulder: Math.max(0, shoulder - core * 0.7) };
}

function runtimeEllipseToBlender(definition) {
  return {
    center: [definition.center[0], -definition.center[1]],
    radii: definition.radii,
    rotationDegrees: -definition.rotationDegrees,
  };
}

const habitatPatches = groundLifeLayout.patches;
const grassPatches = staticPropLayout.grassPatches;
const canopyClusters = treeLayout.clusters;
const nearTrees = staticPropLayout.frameTrees;
const staticProps = [
  ...staticPropLayout.vignettes.flatMap((vignette) => vignette.props),
  ...staticPropLayout.zoneProps,
];
const spatialZones = Object.fromEntries(
  compositionLayout.spatialZones.map((zone) => [
    zone.id,
    runtimeEllipseToBlender(zone),
  ])
);
const campShelf = runtimeEllipseToBlender(
  compositionLayout.campRelocation.shelf
);

function maximumPatchInfluence(x, y, definitions, filter = () => true) {
  let influence = 0;
  for (const definition of definitions) {
    if (!filter(definition)) continue;
    influence = Math.max(influence, ellipseInfluence(x, y, definition));
  }
  return influence;
}

function radialContact(x, y, center, radius, noise, directional = 0) {
  const deltaX = x - center[0];
  const deltaY = y - center[1];
  const angle = Math.atan2(deltaY, deltaX);
  const lobe =
    1 +
    0.2 * Math.sin(angle * 3 + directional) +
    0.12 * Math.sin(angle * 7 - directional * 0.6) +
    (noise - 0.5) * 0.18;
  return (
    1 - smoothstep(radius * 0.22, radius * lobe, Math.hypot(deltaX, deltaY))
  );
}

function ecologicalWeights(x, y) {
  const radius = Math.hypot(x, y);
  const noise = ecologicalNoise(x, y);
  const clearingEdge = harmonicRadius(
    Math.atan2(y, x),
    pathLayout.clearingEdge
  );
  const insideClearing =
    1 - smoothstep(clearingEdge - 5.5, clearingEdge + 2.5, radius);
  const paths = pathMasks(x, y, noise);

  const grassPatch = maximumPatchInfluence(x, y, grassPatches);
  const canopy = maximumPatchInfluence(x, y, canopyClusters, (cluster) =>
    Object.values(cluster.counts).some((count) => count > 0)
  );
  const dampHabitat = maximumPatchInfluence(
    x,
    y,
    habitatPatches,
    (patch) => patch.habitatId === "damp-willow-hollow"
  );
  const litterHabitat = maximumPatchInfluence(
    x,
    y,
    habitatPatches,
    (patch) =>
      patch.habitatId === "beech-shade-fern-colony" ||
      patch.habitatId === "fallen-log-decomposition" ||
      patch.habitatId === "root-crossing-litter-drift"
  );
  const pathShoulderHabitat = maximumPatchInfluence(
    x,
    y,
    habitatPatches,
    (patch) => patch.habitatId === "sparse-path-shoulder"
  );

  const audienceMeadow = ellipseInfluence(
    x,
    y,
    spatialZones["audience-meadow"],
    0.1,
    1.16
  );
  const dampHollow = ellipseInfluence(
    x,
    y,
    spatialZones["damp-hollow"],
    0.1,
    1.18
  );
  const campTraffic = ellipseInfluence(x, y, campShelf, 0.2, 1.06);
  const campScreens = Math.max(
    ellipseInfluence(x, y, spatialZones["camp-threshold-north"]),
    ellipseInfluence(x, y, spatialZones["camp-threshold-south"])
  );

  let rootContact = 0;
  nearTrees.forEach((tree, index) => {
    rootContact = Math.max(
      rootContact,
      radialContact(
        x,
        y,
        tree.position,
        materialContract.rules.nearTreeContactRadiusMetres * tree.scale,
        noise,
        index * 1.73
      )
    );
  });

  let propContact = 0;
  staticProps.forEach((prop, index) => {
    propContact = Math.max(
      propContact,
      radialContact(
        x,
        y,
        prop.position,
        Math.max(0.7, (prop.targetLongestMetres ?? 1) * 0.52),
        noise,
        index * 0.91
      )
    );
  });

  const stageContact = radialContact(
    x,
    y,
    [0, 0],
    materialContract.rules.stageContactRadiusMetres,
    noise,
    2.4
  );
  const stageCore =
    1 -
    smoothstep(
      materialContract.rules.performanceCoreRadiusMetres * 0.68,
      materialContract.rules.performanceCoreRadiusMetres,
      radius
    );

  const sunBreaks = clamp(
    0.44 + (noise - 0.5) * 0.9 + Math.sin(x * 0.08 - y * 0.05) * 0.12
  );
  const summerSlope = clamp(
    0.92 +
      sunBreaks * 0.12 +
      grassPatch * 0.12 -
      canopy * 0.025 -
      paths.core * 0.96
  );
  const openMeadow = clamp(
    insideClearing *
      (materialContract.rules.minimumOpenMeadowWeight + sunBreaks * 0.26) +
      (1 - insideClearing) * summerSlope
  );
  let meadow = clamp(
    openMeadow +
      grassPatch * 0.18 +
      audienceMeadow * 0.2 -
      stageCore * 0.18 -
      paths.core * 0.95 -
      rootContact * 0.08 -
      campTraffic * 0.62
  );
  let litter = clamp(
    canopy * (0.035 + (1 - sunBreaks) * 0.055) +
      litterHabitat * 0.1 +
      rootContact * 0.18 +
      campScreens * 0.06 -
      paths.core * 0.78 -
      insideClearing * audienceMeadow * 0.22
  );
  let damp = clamp(
    dampHabitat * 0.88 +
      dampHollow * 0.82 +
      campScreens * 0.14 +
      paths.core * (0.28 + noise * 0.18) -
      stageCore * 0.8
  );

  const maintained = clamp(
    paths.core * 0.92 +
      campTraffic * 0.46 +
      stageCore * 0.24 +
      pathShoulderHabitat * paths.shoulder * 0.24
  );
  meadow *= 1 - maintained * 0.34;
  litter *= 1 - maintained * 0.48;
  damp = Math.max(damp, paths.core * 0.2);

  const distantQuiet = smoothstep(112 + noise * 8, 154 + noise * 12, radius);
  const neutral = clamp(
    0.035 +
      maintained * 0.7 +
      paths.shoulder * 0.26 +
      distantQuiet * 0.055 +
      (1 - insideClearing) * (0.015 + canopy * 0.025)
  );
  const total = Math.max(neutral + meadow + litter + damp, 0.001);
  const contact = clamp(
    Math.max(rootContact * 0.82, propContact * 0.7, stageContact * 0.5) *
      (0.72 + noise * 0.28)
  );

  return {
    neutral: neutral / total,
    meadow: meadow / total,
    litter: litter / total,
    damp: damp / total,
    contact,
    path: paths.core,
  };
}

async function loadTiledFamily(family) {
  const repeatPixels = Math.max(
    32,
    Math.round((SIZE * family.repeatMetres) / (WORLD_EXTENT * 2))
  );
  const { data, info } = await sharp(resolve(family.diffuse))
    .resize(repeatPixels, repeatPixels, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const grade = family.colorGrade;
  if (grade) {
    const tint = grade.tint ?? [128, 128, 128];
    const tintStrength = grade.tintStrength ?? 0;
    const saturation = grade.saturation ?? 1;
    const brightness = grade.brightness ?? 1;
    for (let index = 0; index < data.length; index += info.channels) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      const graded = [red, green, blue].map((value, channel) => {
        const saturated = luminance + (value - luminance) * saturation;
        const tinted = mix(saturated, tint[channel], tintStrength);
        return Math.round(clamp(tinted * brightness, 0, 255));
      });
      data[index] = graded[0];
      data[index + 1] = graded[1];
      data[index + 2] = graded[2];
    }
  }
  return { data, info, repeatMetres: family.repeatMetres };
}

function sampleFamily(family, x, y, channel) {
  const warpedX =
    x + 0.74 * Math.sin(y * 0.031) + 0.29 * Math.cos((x + y) * 0.057);
  const warpedY =
    y + 0.68 * Math.cos(x * 0.029) - 0.27 * Math.sin((x - y) * 0.061);
  const sourceX = Math.min(
    family.info.width - 1,
    Math.floor(fract(warpedX / family.repeatMetres) * family.info.width)
  );
  const sourceY = Math.min(
    family.info.height - 1,
    Math.floor((1 - fract(warpedY / family.repeatMetres)) * family.info.height)
  );
  return family.data[
    (sourceY * family.info.width + sourceX) * family.info.channels + channel
  ];
}

const familyTiles = Object.fromEntries(
  await Promise.all(
    Object.entries(FAMILIES).map(async ([id, family]) => [
      id,
      await loadTiledFamily(family),
    ])
  )
);

const familyMask = Buffer.allocUnsafe(MASK_SIZE * MASK_SIZE * 3);
const responseMask = Buffer.allocUnsafe(MASK_SIZE * MASK_SIZE * 3);
for (let pixelY = 0; pixelY < MASK_SIZE; pixelY += 1) {
  const worldY = WORLD_EXTENT - (pixelY / (MASK_SIZE - 1)) * WORLD_EXTENT * 2;
  for (let pixelX = 0; pixelX < MASK_SIZE; pixelX += 1) {
    const worldX =
      -WORLD_EXTENT + (pixelX / (MASK_SIZE - 1)) * WORLD_EXTENT * 2;
    const weights = ecologicalWeights(worldX, worldY);
    const familyIndex = (pixelY * MASK_SIZE + pixelX) * 3;
    const responseIndex = (pixelY * MASK_SIZE + pixelX) * 3;
    familyMask[familyIndex] = Math.round(weights.neutral * 255);
    familyMask[familyIndex + 1] = Math.round(weights.meadow * 255);
    familyMask[familyIndex + 2] = Math.round(weights.litter * 255);
    responseMask[responseIndex] = Math.round(weights.damp * 255);
    responseMask[responseIndex + 1] = Math.round(weights.contact * 255);
    responseMask[responseIndex + 2] = Math.round(weights.path * 255);
  }
}

const expandedFamilyMask = await sharp(familyMask, {
  raw: { width: MASK_SIZE, height: MASK_SIZE, channels: 3 },
})
  .resize(SIZE, SIZE, { kernel: sharp.kernel.cubic })
  .raw()
  .toBuffer();
const expandedResponseMask = await sharp(responseMask, {
  raw: { width: MASK_SIZE, height: MASK_SIZE, channels: 3 },
})
  .resize(SIZE, SIZE, { kernel: sharp.kernel.cubic })
  .raw()
  .toBuffer();
const output = Buffer.allocUnsafe(SIZE * SIZE * 3);

for (let pixelY = 0; pixelY < SIZE; pixelY += 1) {
  const worldY = WORLD_EXTENT - (pixelY / (SIZE - 1)) * WORLD_EXTENT * 2;
  for (let pixelX = 0; pixelX < SIZE; pixelX += 1) {
    const worldX = -WORLD_EXTENT + (pixelX / (SIZE - 1)) * WORLD_EXTENT * 2;
    const familyMaskIndex = (pixelY * SIZE + pixelX) * 3;
    const responseMaskIndex = (pixelY * SIZE + pixelX) * 3;
    const weights = [
      expandedFamilyMask[familyMaskIndex] / 255,
      expandedFamilyMask[familyMaskIndex + 1] / 255,
      expandedFamilyMask[familyMaskIndex + 2] / 255,
      expandedResponseMask[responseMaskIndex] / 255,
    ];
    const weightTotal = Math.max(
      weights.reduce((total, value) => total + value, 0),
      0.001
    );
    const contact = expandedResponseMask[responseMaskIndex + 1] / 255;
    const path = expandedResponseMask[responseMaskIndex + 2] / 255;
    const macro = ecologicalNoise(worldX * 0.76, worldY * 0.76);
    const outputIndex = (pixelY * SIZE + pixelX) * 3;

    for (let channel = 0; channel < 3; channel += 1) {
      const familyValues = [
        sampleFamily(familyTiles.neutral, worldX, worldY, channel),
        sampleFamily(familyTiles.meadow, worldX, worldY, channel),
        sampleFamily(familyTiles.litter, worldX, worldY, channel),
        sampleFamily(familyTiles.damp, worldX, worldY, channel),
      ];
      let value =
        familyValues.reduce(
          (total, familyValue, index) => total + familyValue * weights[index],
          0
        ) / weightTotal;
      const macroDrift = 0.94 + macro * 0.12;
      value *= macroDrift;
      value *=
        1 - contact * materialContract.rules.maximumBakedContactDarkening;
      if (path > 0) {
        const pathGrade = channel === 0 ? 0.91 : channel === 1 ? 0.82 : 0.72;
        value *= mix(1, pathGrade, path * 0.42);
      }
      output[outputIndex + channel] = Math.round(clamp(value, 0, 255));
    }
  }
}

await Promise.all([
  mkdir(dirname(OUTPUT), { recursive: true }),
  mkdir(dirname(MASK_OUTPUT), { recursive: true }),
]);
await sharp(output, { raw: { width: SIZE, height: SIZE, channels: 3 } })
  .jpeg({ quality: 91, chromaSubsampling: "4:4:4", mozjpeg: true })
  .toFile(OUTPUT);
await sharp(familyMask, {
  raw: { width: MASK_SIZE, height: MASK_SIZE, channels: 3 },
})
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(FAMILY_MASK_OUTPUT);

const previewMask = Buffer.allocUnsafe(MASK_SIZE * MASK_SIZE * 3);
for (let index = 0; index < MASK_SIZE * MASK_SIZE; index += 1) {
  const familyInput = index * 3;
  const responseInput = index * 3;
  const outputIndex = index * 3;
  previewMask[outputIndex] = clamp(
    responseMask[responseInput] + responseMask[responseInput + 2] * 0.62,
    0,
    255
  );
  previewMask[outputIndex + 1] = clamp(
    familyMask[familyInput + 1] + familyMask[familyInput + 2] * 0.36,
    0,
    255
  );
  previewMask[outputIndex + 2] = clamp(
    familyMask[familyInput + 2] + responseMask[responseInput + 1] * 0.45,
    0,
    255
  );
}
await sharp(previewMask, {
  raw: { width: MASK_SIZE, height: MASK_SIZE, channels: 3 },
})
  .png()
  .toFile(MASK_OUTPUT);

function planPoint([x, y]) {
  const scale = 2.05;
  return [520 + x * scale, 400 - y * scale];
}

function polyline(points) {
  return points
    .map((point) =>
      planPoint(point)
        .map((value) => value.toFixed(1))
        .join(",")
    )
    .join(" ");
}

const boundaryPoints = Array.from({ length: 193 }, (_, index) => {
  const angle = (index / 192) * Math.PI * 2;
  const radius = harmonicRadius(angle, pathLayout.worldBoundary);
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
});
const pathMarkup = pathLayout.paths
  .map((path) => {
    const points = polyline(path.points);
    const shoulderWidth = (path.halfWidth + path.shoulderWidth) * 4.1;
    const coreWidth = path.halfWidth * 4.1;
    return `<polyline points="${points}" fill="none" stroke="#5f513c" stroke-opacity="0.42" stroke-width="${shoulderWidth}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${points}" fill="none" stroke="#766047" stroke-width="${coreWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  })
  .join("");
const clearingRadius = pathLayout.clearingRadius * 2.05;
const pathPlanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
  <rect width="1280" height="800" fill="#07140f"/>
  <text x="50" y="52" fill="#f5e8cf" font-family="system-ui, sans-serif" font-size="28" font-weight="700">Forest living-ground contract</text>
  <text x="50" y="80" fill="#9fb9aa" font-family="system-ui, sans-serif" font-size="16">Authored paths, clearing, habitats, canopy shade, root contact, and durable camp shelf</text>
  <polygon points="${polyline(boundaryPoints)}" fill="#183b27" stroke="#5d846b" stroke-width="3"/>
  <circle cx="520" cy="400" r="${clearingRadius}" fill="#537247" fill-opacity="0.66" stroke="#9cb985" stroke-width="2" stroke-dasharray="7 7"/>
  ${pathMarkup}
</svg>`;
await mkdir(dirname(PATH_PLAN_OUTPUT), { recursive: true });
await sharp(Buffer.from(pathPlanSvg)).png().toFile(PATH_PLAN_OUTPUT);

console.log(
  JSON.stringify(
    {
      output: OUTPUT,
      ecologyMask: MASK_OUTPUT,
      familyMask: FAMILY_MASK_OUTPUT,
      pathPlan: PATH_PLAN_OUTPUT,
      size: SIZE,
      maskSize: MASK_SIZE,
      worldExtent: WORLD_EXTENT,
      sourceFamilies: Object.keys(FAMILIES),
      contracts: {
        materials: materialContract.version,
        paths: pathLayout.version,
        trees: treeLayout.version,
        groundLife: groundLifeLayout.version,
        staticProps: staticPropLayout.version,
        composition: compositionLayout.version,
      },
    },
    null,
    2
  )
);
