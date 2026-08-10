#!/usr/bin/env node
/** Verify the approved Forest composition revision against production placement. */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const compositionPath = resolve("scripts/forest-composition-revision.json");
const campsitePath = resolve("scripts/forest-campsite-layout.json");
const pathLayoutPath = resolve("scripts/forest-path-layout.json");
const nearFramePath = resolve("scripts/forest-static-prop-layout.json");
const treeLayoutPath = resolve("scripts/forest-tree-layout.json");
const reportPath = resolve(
  "docs/superpowers/specs/moonlit-firefly-forest/forest-composition-revision-verification.json"
);

function readJson(path) {
  const bytes = readFileSync(path);
  return {
    data: JSON.parse(bytes.toString("utf8")),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function add([x, z], [offsetX, offsetZ]) {
  return [x + offsetX, z + offsetZ];
}

function distance([x1, z1], [x2, z2] = [0, 0]) {
  return Math.hypot(x1 - x2, z1 - z2);
}

function almostEqual(a, b, epsilon = 1e-6) {
  return Math.abs(a - b) <= epsilon;
}

function runtimePoint([x, y]) {
  return [x, -y];
}

function pointInsideRotatedEllipse(point, ellipse, padding = 0) {
  const angle = (-ellipse.rotationDegrees * Math.PI) / 180;
  const offsetX = point[0] - ellipse.center[0];
  const offsetZ = point[1] - ellipse.center[1];
  const localX = offsetX * Math.cos(angle) - offsetZ * Math.sin(angle);
  const localZ = offsetX * Math.sin(angle) + offsetZ * Math.cos(angle);
  const radiusX = ellipse.radii[0] - padding;
  const radiusZ = ellipse.radii[1] - padding;
  return (localX / radiusX) ** 2 + (localZ / radiusZ) ** 2 <= 1;
}

const { data: composition, sha256: compositionSha256 } =
  readJson(compositionPath);
const { data: campsite, sha256: campsiteSha256 } = readJson(campsitePath);
const { data: paths, sha256: pathsSha256 } = readJson(pathLayoutPath);
const { data: nearFrame, sha256: nearFrameSha256 } = readJson(nearFramePath);
const { data: trees, sha256: treesSha256 } = readJson(treeLayoutPath);

invariant(
  composition.status === "approved",
  "The revision must retain Austen's approval"
);
invariant(
  composition.sourceGate === "Forest Gate 10.1 measured composition revision",
  "The revision is attached to the wrong review gate"
);

const translation = composition.campRelocation.translation;
const currentFire = composition.campRelocation.previousFirePosition;
const proposedFire = campsite.fire.position;
invariant(
  distance(add(currentFire, translation), proposedFire) <= 0.001,
  "The implemented fire does not match the approved rigid translation"
);
const currentStageToFireMetres = distance(currentFire);
const proposedStageToFireMetres = distance(proposedFire);
const [minimumStageDistance, maximumStageDistance] =
  composition.campRelocation.targetStageToFireRangeMetres;

invariant(
  proposedStageToFireMetres >= minimumStageDistance &&
    proposedStageToFireMetres <= maximumStageDistance,
  `Proposed stage-to-fire distance ${proposedStageToFireMetres.toFixed(3)} m is outside the authored range`
);
invariant(
  proposedStageToFireMetres > currentStageToFireMetres + 15,
  "The revision does not materially separate the camp from the stage"
);

const campSpur = paths.paths.find((path) => path.id === "camp-spur");
invariant(campSpur, "The authored camp spur is missing");
const implementedSpur = campSpur.points.map(runtimePoint);
const approvedSpur = composition.campRelocation.spurExtension;
invariant(
  approvedSpur.every(
    (point, index) =>
      distance(point, implementedSpur.at(index - approvedSpur.length)) <= 0.001
  ),
  "The production camp spur drifted from the approved extension"
);
invariant(
  distance(implementedSpur.at(-1), proposedFire) <= 0.001,
  "The production spur does not end at the relocated campfire"
);

const translatedTents = campsite.tents.map((tent) => ({
  id: tent.id,
  position: tent.position,
  padRadius: Math.hypot(...tent.padFootprint) / 2,
  preservedFireDistance: distance(
    composition.campRelocation.approvedRelativeTentOffsets[tent.id]
  ),
}));
for (const tent of translatedTents) {
  invariant(
    pointInsideRotatedEllipse(
      tent.position,
      composition.campRelocation.shelf,
      tent.padRadius
    ),
    `${tent.id} does not fit inside the proposed durable camp shelf`
  );
  invariant(
    almostEqual(
      tent.preservedFireDistance,
      distance(tent.position, proposedFire)
    ),
    `${tent.id} changed its approved tent-to-fire relationship`
  );
  invariant(
    distance(
      [tent.position[0] - proposedFire[0], tent.position[1] - proposedFire[1]],
      composition.campRelocation.approvedRelativeTentOffsets[tent.id]
    ) <= 0.001,
    `${tent.id} no longer preserves its approved relative offset`
  );
}

const maximumApproachGrade = composition.verticalSection.samples
  .slice(1)
  .filter((sample) => sample[0] <= 43)
  .reduce((maximum, sample, index) => {
    const prior = composition.verticalSection.samples[index];
    const grade =
      (Math.abs(sample[1] - prior[1]) / Math.abs(sample[0] - prior[0])) * 100;
    return Math.max(maximum, grade);
  }, 0);
invariant(
  maximumApproachGrade <=
    composition.campRelocation.shelf.maximumApproachGradePercent,
  `Camp approach grade ${maximumApproachGrade.toFixed(2)}% exceeds the proposal`
);

const habitatZones = composition.spatialZones.filter(
  (zone) => zone.kind === "habitat"
);
for (const zone of habitatZones) {
  const conservativeRadius = Math.max(...zone.radii);
  invariant(
    distance(zone.center) - conservativeRadius >=
      composition.stage.performanceKeepClearRadiusMetres,
    `${zone.label} enters the performance keep-clear zone`
  );
}

const campOpening = trees.openings.find(
  (opening) => opening.id === "east-camp-pocket"
);
invariant(campOpening, "The relocated camp has no production tree exclusion");
invariant(
  distance(
    runtimePoint(campOpening.center),
    composition.campRelocation.shelf.center
  ) <= 0.001,
  "The production tree exclusion is not centered on the approved camp shelf"
);
invariant(
  campOpening.radii[0] >= composition.campRelocation.shelf.radii[0] + 3 &&
    campOpening.radii[1] >= composition.campRelocation.shelf.radii[1] + 2,
  "The production tree exclusion does not protect the full campsite"
);

const requiredHabitatZoneIds = new Set(nearFrame.rules.requiredHabitatZoneIds);
const authoredHabitatZoneIds = new Set(
  nearFrame.zoneProps.map((prop) => prop.habitatZoneId)
);
invariant(
  [...requiredHabitatZoneIds].every((id) => authoredHabitatZoneIds.has(id)),
  "A required camp threshold is missing its distinct static habitat anchor"
);
for (const prop of nearFrame.zoneProps) {
  const zone = habitatZones.find(
    (candidate) => candidate.id === prop.habitatZoneId
  );
  invariant(zone, `${prop.id} references an unknown habitat zone`);
  invariant(
    pointInsideRotatedEllipse(runtimePoint(prop.position), zone),
    `${prop.id} left its approved habitat zone`
  );
}
invariant(
  nearFrame.grassPatches.some(
    (patch) => patch.id === "damp-hollow-sedge-field"
  ) &&
    nearFrame.mushroomColonies.some(
      (colony) => colony.id === "damp-hollow-amanitas"
    ),
  "The damp hollow is missing its authored grass or mushroom ecology"
);

const frameTreeClearances = nearFrame.frameTrees.map((tree) => ({
  id: tree.id,
  distanceMetres: distance(runtimePoint(tree.position), proposedFire),
}));
const minimumFrameTreeClearance = Math.min(
  ...frameTreeClearances.map((tree) => tree.distanceMetres)
);
invariant(
  minimumFrameTreeClearance >= campsite.fire.clearedFuelRadius + 10,
  "The proposed fire pocket crowds an approved frame tree"
);

const routeStops = composition.route.map((stop) => stop.stop);
invariant(
  JSON.stringify(routeStops) === JSON.stringify([1, 2, 3, 4, 5, 6]),
  "The visitor route must retain six ordered stops"
);
invariant(
  composition.sightlines.map((sightline) => sightline.priority).join(",") ===
    "1,2,3",
  "The focal hierarchy must remain stage, camp, then forest depth"
);

const report = {
  sceneId: "forest-firefly",
  gateId: "playable-spatial-pass",
  status: "implemented",
  generatedAt: new Date().toISOString(),
  sourceDigests: {
    compositionSha256,
    campsiteSha256,
    pathsSha256,
    nearFrameSha256,
    treesSha256,
  },
  metrics: {
    currentStageToFireMetres: Number(currentStageToFireMetres.toFixed(3)),
    proposedStageToFireMetres: Number(proposedStageToFireMetres.toFixed(3)),
    separationIncreaseMetres: Number(
      (proposedStageToFireMetres - currentStageToFireMetres).toFixed(3)
    ),
    proposedFire,
    translatedTentPositions: translatedTents.map(({ id, position }) => ({
      id,
      position,
    })),
    maximumApproachGradePercent: Number(maximumApproachGrade.toFixed(3)),
    minimumFrameTreeClearanceMetres: Number(
      minimumFrameTreeClearance.toFixed(3)
    ),
    habitatZoneCount: habitatZones.length,
    routeStops: routeStops.length,
    sightlinePriorities: composition.sightlines.map(
      (sightline) => sightline.priority
    ),
  },
  checks: [
    "production camp spur matches the approved extension",
    "production spur ends at the relocated fire pocket",
    "approved campsite relationships survive the rigid translation",
    "all tent pads fit inside the durable camp shelf",
    "camp approach stays within the authored five-percent grade",
    "habitat screens stay outside the performance core",
    "approved frame trees stay clear of the relocated fire pocket",
    "production trees exclude the full east camp shelf",
    "both camp thresholds have distinct habitat anchors",
    "the damp hollow has grass and mushroom ecology",
    "route and focal priorities remain ordered",
  ],
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, ...report.metrics }, null, 2));
