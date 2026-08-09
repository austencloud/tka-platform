#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PerspectiveCamera, Vector3 } from "three";

const root = process.cwd();
const sourcePath = path.resolve(root, "scripts/seraphic-vault-phase2-layout.json");
const outputPath = path.resolve(
  root,
  "docs/superpowers/specs/seraphic-vault/seraphic-vault-gate2-coordinate-manifest.json"
);

const sourceBuffer = await readFile(sourcePath);
const source = JSON.parse(sourceBuffer.toString("utf8"));
await mkdir(path.dirname(outputPath), { recursive: true });

const targetOverrides = {
  "eroded-halo": {
    desktop: [-0.52, -0.08],
    portrait: [-0.36, -0.28],
    landscapePhone: [-0.77, -0.08],
  },
  "cloud-crown": {
    desktop: [0.52, 0.42],
    portrait: [0.36, 0.48],
    landscapePhone: [0.77, 0.42],
  },
};

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function createCamera(preset) {
  const camera = new PerspectiveCamera(
    preset.fovDegrees,
    preset.aspect,
    0.1,
    250
  );
  camera.position.fromArray(preset.position);
  camera.lookAt(new Vector3(...preset.target));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function solveWorldPoint(camera, ndc, worldZ) {
  const near = new Vector3(ndc[0], ndc[1], -1).unproject(camera);
  const far = new Vector3(ndc[0], ndc[1], 1).unproject(camera);
  const direction = far.sub(near).normalize();
  const distance = (worldZ - near.z) / direction.z;
  return near.addScaledVector(direction, distance).toArray();
}

function project(camera, point) {
  return new Vector3(...point).project(camera);
}

function projectedWidth(camera, position, width) {
  const [x, y, z] = position;
  const left = project(camera, [x - width / 2, y, z]);
  const right = project(camera, [x + width / 2, y, z]);
  return right.x - left.x;
}

const cameras = Object.fromEntries(
  Object.entries(source.cameraPresets).map(([name, preset]) => [name, createCamera(preset)])
);

const platforms = source.distantPlatforms.map((platform) => {
  const depth = platform.position[2];
  const targetNdc = {
    ...platform.targetNdc,
    ...(targetOverrides[platform.id] ?? {}),
  };
  const positions = Object.fromEntries(
    Object.entries(targetNdc).map(([presetName, ndc]) => [
      presetName,
      solveWorldPoint(cameras[presetName], ndc, depth).map((value) => round(value, 4)),
    ])
  );
  const width = source.mainStage.visualWidth * platform.worldScale;
  return {
    id: platform.id,
    name: platform.name,
    silhouette: platform.silhouette,
    targetNdc,
    positions,
    dimensions: {
      width: round(width),
      solidSilhouetteWidth: round(
        platform.id === "eroded-halo" ? width * 0.64 : width
      ),
      depth: round(width * 0.48),
      thickness: round(Math.max(0.28, width * 0.09)),
      cloudCollarRadius: platform.cloudCollarRadius,
    },
    worldScale: platform.worldScale,
    targetScreenWidthRatio: platform.targetScreenWidthRatio,
    atmosphericOpacity: platform.atmosphericOpacity,
    blueShift: platform.blueShift,
    detailTier: platform.detailTier,
  };
});

const shellRadius = Math.max(
  Math.abs(source.mainStage.bounds.min[0]),
  Math.abs(source.mainStage.bounds.max[0]),
  Math.abs(source.mainStage.bounds.min[2]),
  Math.abs(source.mainStage.bounds.max[2])
);

const projectionChecks = [];
const shellChecks = [];
const registeredViews = {};
for (const [presetName, camera] of Object.entries(cameras)) {
  const mainProjectedWidth = projectedWidth(
    camera,
    [0, source.mainStage.surfaceY, 0],
    source.mainStage.visualWidth
  );
  registeredViews[presetName] = {
    camera: source.cameraPresets[presetName],
    platforms: [],
  };

  for (const platform of platforms) {
    const position = platform.positions[presetName];
    const projected = project(camera, position);
    const ndcWidth = projectedWidth(camera, position, platform.dimensions.width);
    const solidNdcWidth = projectedWidth(
      camera,
      position,
      platform.dimensions.solidSilhouetteWidth
    );
    const ndcHeight = ndcWidth * 0.38;
    const target = platform.targetNdc[presetName];
    const projectionError = Math.hypot(projected.x - target[0], projected.y - target[1]);
    const centerDistance = Math.hypot(position[0], position[2]);
    const minimumClearance = shellRadius + platform.dimensions.width / 2 + 2;

    projectionChecks.push({
      preset: presetName,
      platform: platform.id,
      passed: projectionError <= 0.0005,
      projectionError: round(projectionError, 6),
    });
    shellChecks.push({
      preset: presetName,
      platform: platform.id,
      passed: centerDistance > minimumClearance,
      clearanceMetres: round(centerDistance - minimumClearance, 3),
    });
    registeredViews[presetName].platforms.push({
      id: platform.id,
      projectedCenter: [round(projected.x), round(projected.y)],
      ndcBounds: [
        round(projected.x - ndcWidth / 2),
        round(projected.x + ndcWidth / 2),
        round(projected.y - ndcHeight / 2),
        round(projected.y + ndcHeight / 2),
      ],
      solidNdcBounds: [
        round(projected.x - solidNdcWidth / 2),
        round(projected.x + solidNdcWidth / 2),
        round(projected.y - (solidNdcWidth * 0.38) / 2),
        round(projected.y + (solidNdcWidth * 0.38) / 2),
      ],
      screenWidthRatio: round(ndcWidth / mainProjectedWidth),
    });
  }
}

const heroBandChecks = Object.entries(registeredViews).flatMap(
  ([presetName, view]) =>
    view.platforms.map((platform) => ({
      preset: presetName,
      platform: platform.id,
      passed:
        platform.solidNdcBounds[1] <= source.protectedHeroBand.ndcMinX ||
        platform.solidNdcBounds[0] >= source.protectedHeroBand.ndcMaxX,
      solidNdcBounds: platform.solidNdcBounds,
    }))
);

const checks = [
  {
    name: "projection-parity",
    passed: projectionChecks.every((check) => check.passed),
    evidence: projectionChecks,
  },
  {
    name: "collision",
    passed: shellChecks.every((check) => check.passed),
    evidence: shellChecks,
  },
  {
    name: "protected-hero-band",
    passed: heroBandChecks.every((check) => check.passed),
    evidence: heroBandChecks,
  },
];

const failedChecks = checks.filter((check) => !check.passed);
if (failedChecks.length > 0) {
  throw new Error(`Gate 2 coordinate checks failed: ${failedChecks.map((check) => check.name).join(", ")}`);
}

const manifest = {
  schemaVersion: 1,
  sceneId: source.sceneId,
  gateId: "playable-graybox",
  generatedAt: new Date().toISOString(),
  source: {
    path: path.relative(root, sourcePath).replaceAll("\\", "/"),
    sha256: sha256(sourceBuffer),
    approvedGate: 1,
    approvalTrackerItem: "EiR6GvhtzW1A3OEaZ9Zi",
  },
  units: source.units,
  coordinateSystem: source.coordinateSystem,
  blenderAxisMapping: {
    runtimeXYZToBlenderXYZ: ["-x", "z", "y"],
    note: "Runtime depth becomes Blender Y and runtime height becomes Blender Z. Runtime X is negated to preserve screen-left/right through Blender's camera handedness.",
  },
  responsivePolicy: "One approved silhouette family with registered transforms per viewport; no platform enters the protected hero band.",
  cameraPresets: source.cameraPresets,
  mainStage: source.mainStage,
  protectedHeroBand: source.protectedHeroBand,
  desktopFeatherExclusionZones: source.desktopFeatherExclusionZones,
  platforms,
  registeredViews,
  checks,
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(
  `${JSON.stringify({ outputPath, checks: checks.map(({ name, passed }) => ({ name, passed })) }, null, 2)}\n`
);
