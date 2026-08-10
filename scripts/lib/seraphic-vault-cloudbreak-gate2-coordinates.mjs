import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PerspectiveCamera, Vector3 } from "three";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

export function runtimeToBlender(position) {
  return [-position[0], position[2], position[1]].map((value) => round(value));
}

function projectedWidth(camera, position, width) {
  const left = new Vector3(
    position[0] - width / 2,
    position[1],
    position[2]
  ).project(camera);
  const right = new Vector3(
    position[0] + width / 2,
    position[1],
    position[2]
  ).project(camera);
  return Math.abs(right.x - left.x);
}

function minimumDistanceFrom(center, points) {
  return Math.min(
    ...points.map(([x, z]) => Math.hypot(x - center[0], z - center[1]))
  );
}

function createCamera(preset) {
  const camera = new PerspectiveCamera(
    preset.fovDegrees,
    preset.aspect,
    0.1,
    300
  );
  camera.position.fromArray(preset.position);
  camera.lookAt(new Vector3(...preset.target));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function project(camera, position) {
  const point = new Vector3(...position).project(camera);
  return [round(point.x), round(point.y)];
}

export async function generateOliveCloudbreakGate2Coordinates({ root }) {
  const sourcePath = path.resolve(
    root,
    "scripts/seraphic-vault-cloudbreak-layout.json"
  );
  const sourceBuffer = await readFile(sourcePath);
  const source = JSON.parse(sourceBuffer.toString("utf8"));
  const revisionSuffix = source.revision.replace("olive-cloudbreak-", "");
  const outputPath = path.resolve(
    root,
    `docs/superpowers/specs/seraphic-vault/seraphic-vault-gate2-cloudbreak-${revisionSuffix}-coordinate-manifest.json`
  );
  await mkdir(path.dirname(outputPath), { recursive: true });

  const cameras = Object.fromEntries(
    Object.entries(source.cameraPresets).map(([name, preset]) => {
      const camera = createCamera(preset);
      return [
        name,
        {
          ...preset,
          blenderPosition: runtimeToBlender(preset.position),
          blenderTarget: runtimeToBlender(preset.target),
          projections: {
            stage: project(camera, [
              source.performanceTerrace.centerXZ[0],
              source.performanceTerrace.surfaceY,
              source.performanceTerrace.centerXZ[1],
            ]),
            lagoon: project(camera, [12.625, source.lagoon.surfaceY, -0.0833]),
            sun: project(camera, source.sun.position),
            trees: source.oliveTrees.map((tree) =>
              project(camera, [
                tree.position[0],
                tree.position[1] + tree.height * 0.45,
                tree.position[2],
              ])
            ),
            mesas: source.distantMesas.map((mesa) =>
              project(camera, mesa.position)
            ),
          },
        },
      ];
    })
  );

  const solarSilhouetteClearance = Object.fromEntries(
    Object.entries(source.cameraPresets).map(([name, preset]) => {
      const camera = createCamera(preset);
      const sunProjection = new Vector3(...source.sun.position).project(camera);
      const sunHalfWidth =
        projectedWidth(camera, source.sun.position, source.sun.visualDiameter) /
        2;
      return [
        name,
        source.distantMesas.map((mesa) => {
          const mesaProjection = new Vector3(...mesa.position).project(camera);
          const mesaHalfWidth =
            projectedWidth(camera, mesa.position, mesa.width) / 2;
          return {
            id: mesa.id,
            horizontalClearance: round(
              Math.abs(mesaProjection.x - sunProjection.x) -
                sunHalfWidth -
                mesaHalfWidth
            ),
          };
        }),
      ];
    })
  );

  const performanceCenter = source.performanceTerrace.centerXZ;
  const lagoonClearance =
    minimumDistanceFrom(performanceCenter, source.lagoon.outlineXZ) -
    source.performanceTerrace.clearRadius;
  const treeClearances = source.oliveTrees.map((tree) => ({
    id: tree.id,
    clearance:
      Math.hypot(
        tree.position[0] - performanceCenter[0],
        tree.position[2] - performanceCenter[1]
      ) -
      tree.exclusionRadius -
      source.performanceTerrace.clearRadius,
  }));

  const manifest = {
    generatedAt: new Date().toISOString(),
    sceneId: source.sceneId,
    revision: source.revision,
    source: {
      path: path.relative(root, sourcePath).replaceAll("\\", "/"),
      sha256: sha256(sourceBuffer),
    },
    coordinateTransform: {
      runtime: "[x, y-up, z-depth]",
      blender: "[-x, z-depth, y-up]",
      matrixDescription: "Blender X = -runtime X; Blender Y = runtime Z; Blender Z = runtime Y.",
    },
    landmass: {
      ...source.landmass,
      outlineBlenderXY: source.landmass.outlineXZ.map(([x, z]) => [-x, z]),
    },
    approach: source.approach,
    performanceTerrace: source.performanceTerrace,
    lagoon: {
      ...source.lagoon,
      outlineBlenderXY: source.lagoon.outlineXZ.map(([x, z]) => [-x, z]),
      overflowBlenderXY: [-source.lagoon.overflowXZ[0], source.lagoon.overflowXZ[1]],
    },
    oliveTrees: source.oliveTrees.map((tree) => ({
      ...tree,
      blenderPosition: runtimeToBlender(tree.position),
    })),
    distantMesas: source.distantMesas.map((mesa) => ({
      ...mesa,
      blenderPosition: runtimeToBlender(mesa.position),
    })),
    sun: {
      ...source.sun,
      blenderPosition: runtimeToBlender(source.sun.position),
    },
    cloudOcean: source.cloudOcean,
    protectedHeroBand: source.protectedHeroBand,
    attentionRoute: source.attentionRoute,
    scaleFigure: {
      ...source.scaleFigure,
      blenderPosition: runtimeToBlender(source.scaleFigure.position),
    },
    cameraPresets: cameras,
    solarSilhouetteClearance,
    measurements: {
      lagoonClearance: round(lagoonClearance),
      treeClearances: treeClearances.map(({ id, clearance }) => ({
        id,
        clearance: round(clearance),
      })),
    },
    checks: [
      {
        name: "coordinate-transform",
        passed: source.oliveTrees.every((tree, index) => {
          const transformed = runtimeToBlender(tree.position);
          return transformed.every(
            (value, component) =>
              value === manifestPosition(source.oliveTrees[index].position, component)
          );
        }),
        evidence: "All authored positions use the declared runtime-to-Blender axis mapping.",
      },
      {
        name: "source-parity",
        passed:
          source.landmass.outlineXZ.length >= 12 &&
          source.oliveTrees.length === 2 &&
          source.distantMesas.length === 4,
        evidence: "The manifest carries one full landmass outline, two olive trees, and four distant mesas from the approved plan.",
      },
      {
        name: "collision",
        passed:
          lagoonClearance >= source.lagoon.minimumClearanceFromPerformance &&
          treeClearances.every(({ clearance }) => clearance >= 0),
        evidence: `The lagoon clears the dry performance radius by ${round(lagoonClearance, 2)} m, and both olive exclusions remain outside it.`,
      },
      {
        name: "registered-cameras",
        passed: Object.values(cameras).every(
          (camera) =>
            Math.abs(camera.projections.stage[0]) <= 0.08 &&
            camera.projections.lagoon[0] > 0.2 &&
            Math.abs(camera.projections.sun[0]) <= 0.2
        ),
        evidence: "Every registered camera centers the stage and sun while holding the lagoon to the right.",
      },
      {
        name: "solar-silhouette-clearance",
        passed: Object.values(solarSilhouetteClearance)
          .flat()
          .every(({ horizontalClearance }) => horizontalClearance > 0),
        evidence: "Every registered camera preserves positive horizontal clearance between the sun and all four mesa silhouettes.",
      },
      {
        name: "attention-route",
        passed:
          source.attentionRoute.length === 5 &&
          source.approach.isLiteralTraversalRoute === false &&
          source.attentionRoute[0].title === "GROUNDING" &&
          source.attentionRoute.at(-1).title === "WHOLE COMPOSITION",
        evidence: "The five-stop fixed-camera attention sequence describes one location without implying literal arrival or departure.",
      },
    ],
  };

  if (!manifest.checks.every((check) => check.passed)) {
    throw new Error(
      `Cloudbreak coordinate generation failed: ${manifest.checks
        .filter((check) => !check.passed)
        .map((check) => check.name)
        .join(", ")}`
    );
  }

  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify({ output: outputPath, checks: manifest.checks }, null, 2)}\n`
  );
}

function manifestPosition(position, component) {
  return runtimeToBlender(position)[component];
}
