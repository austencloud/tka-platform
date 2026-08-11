import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultWinterConfig } from "$lib/shared/3d/environments/domain/models/scene-configs/winter-scene-config";

interface WinterSettlementLayout {
  stage: { center: [number, number]; radius: number; height: number };
  ramp: {
    inner: [number, number];
    outer: [number, number];
    width: number;
    topHeight: number;
  };
  lodge: {
    center: [number, number];
    footprint: [number, number];
    ridgeHeight: number;
    targetPadElevation: number;
    frontFaces: [number, number];
  };
  hearth: {
    center: [number, number];
    clearedRadius: number;
    seatRadius: number;
    seatCount: number;
    seatAnglesDegrees: number[];
    targetPadElevation: number;
  };
  pond: {
    center: [number, number];
    radiusX: number;
    radiusZ: number;
    surfaceElevation: number;
  };
  paths: Array<{
    id: string;
    width: number;
    points: [number, number][];
    targetElevations: [number, number];
  }>;
  requirements: {
    minimumStageToHearthMetres: number;
    minimumStageToLodgeMetres: number;
    minimumHearthToLodgeMetres: number;
    minimumPondToStageMetres: number;
    minimumRouteWidthMetres: number;
    maximumRampGrade: number;
    maximumRouteGrade: number;
    seatCount: number;
  };
}

interface WinterCompositionPlan {
  status: "approved";
  approval: {
    gate: number;
    museumTrackerItem: string;
    visualComprehensionConfirmed: boolean;
  };
  proposedArrangement: {
    stage: { center: [number, number]; radius: number; deckHeight: number };
    lodge: {
      center: [number, number];
      footprint: [number, number];
      targetPadElevation: number;
    };
    hearth: {
      center: [number, number];
      clearedRadius: number;
      targetPadElevation: number;
    };
    pond: {
      center: [number, number];
      radiusX: number;
      radiusZ: number;
      surfaceElevation: number;
    };
    heroCamera: {
      position: [number, number, number];
      target: [number, number, number];
      fovDegrees: number;
    };
  };
}

interface WinterLodgeProduction {
  asset: {
    source: string;
    targetDimensions: [number, number, number];
    burialDepth: number;
    yawCorrectionDegrees: number;
    integratedWoodBay?: boolean;
  };
  chimney: {
    local: [number, number, number];
    smokeArea: [number, number, number];
    smokeCount: number;
    smokeColors: string[];
    smokeSizeRange: [number, number];
    smokeSpeed: number;
    smokeOpacity: number;
  };
  windows: Array<{ id: string }>;
  windowLight: {
    local: [number, number, number];
    color: string;
    intensity: number;
    distance: number;
    decay: number;
  };
  woodpile: { rows: number; columns: number };
  requirements: {
    windowCount: number;
    minimumWoodpileLogs: number;
    referenceAvatarHeightMetres: number;
    sourceDoorToRidgeRatio: number;
    minimumDoorHeightMetres: number;
  };
}

interface WinterHearthProduction {
  chair: {
    source: string;
    targetDimensions: [number, number, number];
    burialDepth: number;
    scaleMultipliers: number[];
    yawJitterDegrees: number[];
  };
  fireBed: {
    runtimeFlameGroundOffset: number;
    stoneRingRadius: number;
    stoneCount: number;
    stoneDimensions: [number, number, number];
    fuelLogCount: number;
    emberCount: number;
  };
  clearances: {
    minimumSeatToStoneMetres: number;
    minimumRouteOpeningDegrees: number;
    minimumChairBurialMetres: number;
  };
  requirements: {
    chairCount: number;
    minimumChairDimensions: [number, number, number];
    minimumStoneCount: number;
    minimumFuelLogCount: number;
    minimumEmberCount: number;
  };
}

const layout = JSON.parse(
  readFileSync(resolve("scripts/winter-settlement-layout.json"), "utf8")
) as WinterSettlementLayout;
const composition = JSON.parse(
  readFileSync(resolve("scripts/winter-composition-gate1-r2.json"), "utf8")
) as WinterCompositionPlan;
const lodgeProduction = JSON.parse(
  readFileSync(resolve("scripts/winter-lodge-production.json"), "utf8")
) as WinterLodgeProduction;
const hearthProduction = JSON.parse(
  readFileSync(resolve("scripts/winter-hearth-production.json"), "utf8")
) as WinterHearthProduction;

/**
 * Assert that a production manifest points at a well-formed authored source.
 *
 * These `*_raw.glb` files are Blender authoring INPUTS, and `.gitignore:374`
 * (`static/models/**\/*_raw.glb`) excludes every one of them from the repo on
 * purpose — nothing under `static/models/winter/settlement/` is tracked. So an
 * `existsSync` assertion here passed on an author's machine and could never
 * pass in CI, which is what it did: it red-lit `main` and, because
 * `Deploy Pages (gated)` only fires on a green `Web App CI`, stranded every
 * unrelated commit behind it.
 *
 * Checking the declared path instead still catches what this assertion was
 * really guarding — a typo or a rename in the manifest — without depending on
 * a binary that is intentionally absent. If the shipped, optimized GLB ever
 * gets committed, assert on THAT path; do not reinstate a check against the
 * raw source.
 */
function expectAuthoredSource(source: string): void {
  // Candidate revisions live in subdirectories (e.g. `meshy7-candidates/`), so
  // allow nested segments rather than pinning one flat directory.
  expect(source).toMatch(
    /^static\/models\/winter\/settlement\/(?:[a-z0-9-]+\/)*[a-z0-9-]+_raw\.glb$/
  );
}

function localToRuntime(
  local: [number, number, number]
): [number, number, number] {
  const [centerX, centerZ] = layout.lodge.center;
  const directionX = layout.lodge.frontFaces[0] - centerX;
  const directionBlenderY = -layout.lodge.frontFaces[1] + centerZ;
  const yaw =
    Math.atan2(directionX, -directionBlenderY) +
    (lodgeProduction.asset.yawCorrectionDegrees * Math.PI) / 180;
  const worldX = centerX + local[0] * Math.cos(yaw) - local[1] * Math.sin(yaw);
  const worldBlenderY =
    -centerZ + local[0] * Math.sin(yaw) + local[1] * Math.cos(yaw);
  return [worldX, -worldBlenderY, local[2]];
}

describe("Winter Keeper's Hollow settlement layout", () => {
  it("derives every retreat-triangle landmark from the approved Gate 1 plan", () => {
    const approved = composition.proposedArrangement;

    expect(composition.status).toBe("approved");
    expect(composition.approval).toMatchObject({
      gate: 1,
      visualComprehensionConfirmed: true,
    });
    expect(layout.stage).toMatchObject({
      center: approved.stage.center,
      radius: approved.stage.radius,
      height: approved.stage.deckHeight,
    });
    expect(layout.lodge).toMatchObject({
      center: approved.lodge.center,
      footprint: approved.lodge.footprint,
      targetPadElevation: approved.lodge.targetPadElevation,
    });
    expect(layout.hearth).toMatchObject({
      center: approved.hearth.center,
      clearedRadius: approved.hearth.clearedRadius,
      targetPadElevation: approved.hearth.targetPadElevation,
    });
    expect(layout.pond).toMatchObject({
      center: approved.pond.center,
      radiusX: approved.pond.radiusX,
      radiusZ: approved.pond.radiusZ,
      surfaceElevation: approved.pond.surfaceElevation,
    });
  });

  it("keeps the runtime fire at the authored hearth coordinate", () => {
    const config = createDefaultWinterConfig();

    expect(config.campfire?.position).toEqual({
      x: layout.hearth.center[0],
      z: layout.hearth.center[1],
    });
    expect(config.cabin.position).toEqual({
      x: layout.lodge.center[0],
      z: layout.lodge.center[1],
    });
    expect(config.pond?.position).toEqual({
      x: layout.pond.center[0],
      z: layout.pond.center[1],
    });
  });

  it("preserves the measured social and access clearances", () => {
    const stageToHearth = Math.hypot(
      layout.hearth.center[0] - layout.stage.center[0],
      layout.hearth.center[1] - layout.stage.center[1]
    );
    const hearthToLodge = Math.hypot(
      layout.hearth.center[0] - layout.lodge.center[0],
      layout.hearth.center[1] - layout.lodge.center[1]
    );
    const stageToLodge = Math.hypot(
      layout.lodge.center[0] - layout.stage.center[0],
      layout.lodge.center[1] - layout.stage.center[1]
    );
    const stageToPond = Math.hypot(
      layout.pond.center[0] - layout.stage.center[0],
      layout.pond.center[1] - layout.stage.center[1]
    );
    const rampRun = Math.hypot(
      layout.ramp.inner[0] - layout.ramp.outer[0],
      layout.ramp.inner[1] - layout.ramp.outer[1]
    );

    expect(stageToHearth).toBeGreaterThanOrEqual(
      layout.requirements.minimumStageToHearthMetres
    );
    expect(hearthToLodge).toBeGreaterThanOrEqual(
      layout.requirements.minimumHearthToLodgeMetres
    );
    expect(stageToLodge).toBeGreaterThanOrEqual(
      layout.requirements.minimumStageToLodgeMetres
    );
    expect(stageToPond).toBeGreaterThanOrEqual(
      layout.requirements.minimumPondToStageMetres
    );
    expect(layout.ramp.topHeight / rampRun).toBeLessThanOrEqual(
      layout.requirements.maximumRampGrade
    );
    expect(Math.hypot(...layout.ramp.inner)).toBeLessThanOrEqual(
      layout.stage.radius + 0.05
    );
    expect(Math.hypot(...layout.ramp.outer)).toBeGreaterThan(
      layout.stage.radius
    );
    expect(
      layout.paths.every(
        (path) => path.width >= layout.requirements.minimumRouteWidthMetres
      )
    ).toBe(true);
  });

  it("authors one complete five-seat social arc", () => {
    expect(layout.hearth.seatCount).toBe(layout.requirements.seatCount);
    expect(layout.hearth.seatAnglesDegrees).toHaveLength(
      layout.requirements.seatCount
    );
    expect(new Set(layout.hearth.seatAnglesDegrees).size).toBe(
      layout.requirements.seatCount
    );
    expect(layout.hearth.clearedRadius).toBeGreaterThanOrEqual(3.05);
  });

  it("keeps the production hearth grounded, open, and safely spaced", () => {
    const config = createDefaultWinterConfig();
    const sortedAngles = [...layout.hearth.seatAnglesDegrees].sort(
      (a, b) => a - b
    );
    const gaps = sortedAngles
      .slice(0, -1)
      .map((angle, index) => sortedAngles[index + 1] - angle);
    gaps.push(sortedAngles[0] + 360 - sortedAngles.at(-1)!);
    const maximumChairDepth =
      hearthProduction.chair.targetDimensions[1] *
      Math.max(...hearthProduction.chair.scaleMultipliers);
    const seatToStoneClearance =
      layout.hearth.seatRadius -
      maximumChairDepth / 2 -
      hearthProduction.fireBed.stoneRingRadius -
      hearthProduction.fireBed.stoneDimensions[0] / 2;

    expectAuthoredSource(hearthProduction.chair.source);
    expect(hearthProduction.chair.scaleMultipliers).toHaveLength(
      hearthProduction.requirements.chairCount
    );
    expect(hearthProduction.chair.yawJitterDegrees).toHaveLength(
      hearthProduction.requirements.chairCount
    );
    expect(hearthProduction.chair.burialDepth).toBeGreaterThanOrEqual(
      hearthProduction.clearances.minimumChairBurialMetres
    );
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(
      hearthProduction.clearances.minimumRouteOpeningDegrees
    );
    expect(seatToStoneClearance).toBeGreaterThanOrEqual(
      hearthProduction.clearances.minimumSeatToStoneMetres
    );
    expect(hearthProduction.fireBed.stoneCount).toBeGreaterThanOrEqual(
      hearthProduction.requirements.minimumStoneCount
    );
    expect(hearthProduction.fireBed.fuelLogCount).toBeGreaterThanOrEqual(
      hearthProduction.requirements.minimumFuelLogCount
    );
    expect(hearthProduction.fireBed.emberCount).toBeGreaterThanOrEqual(
      hearthProduction.requirements.minimumEmberCount
    );
    expect(config.campfire?.groundOffset).toBe(
      hearthProduction.fireBed.runtimeFlameGroundOffset
    );
    expect(
      hearthProduction.chair.targetDimensions.every(
        (dimension, index) =>
          dimension >=
          hearthProduction.requirements.minimumChairDimensions[index]
      )
    ).toBe(true);
  });

  it("fits the production lodge to the approved settlement envelope", () => {
    expect(lodgeProduction.asset.targetDimensions).toEqual([
      ...layout.lodge.footprint,
      layout.lodge.ridgeHeight,
    ]);
    expectAuthoredSource(lodgeProduction.asset.source);
    expect(lodgeProduction.windows).toHaveLength(
      lodgeProduction.requirements.windowCount
    );
    expect(
      lodgeProduction.woodpile.rows * lodgeProduction.woodpile.columns
    ).toBeGreaterThanOrEqual(lodgeProduction.requirements.minimumWoodpileLogs);
    expect(lodgeProduction.asset.integratedWoodBay).toBe(true);
    expect(lodgeProduction.requirements.minimumWoodpileLogs).toBe(0);
    expect(
      lodgeProduction.asset.targetDimensions[2] *
        lodgeProduction.requirements.sourceDoorToRidgeRatio
    ).toBeGreaterThanOrEqual(
      lodgeProduction.requirements.minimumDoorHeightMetres
    );
    expect(lodgeProduction.requirements.referenceAvatarHeightMetres).toBe(1.8);
  });

  it("keeps lodge smoke and warm light on their measured Blender anchors", () => {
    const config = createDefaultWinterConfig();
    const [chimneyX, chimneyZ, chimneyLocalHeight] = localToRuntime(
      lodgeProduction.chimney.local
    );
    const [windowX, windowZ, windowLocalHeight] = localToRuntime(
      lodgeProduction.windowLight.local
    );
    const expectedPadHeight =
      config.cabin.smoke.heightOffset -
      chimneyLocalHeight +
      lodgeProduction.asset.burialDepth;

    expect(config.cabin.enabled).toBe(true);
    expect(config.cabin.smoke.position.x).toBeCloseTo(chimneyX, 5);
    expect(config.cabin.smoke.position.z).toBeCloseTo(chimneyZ, 5);
    expect(config.cabin.smoke.area).toEqual({
      width: lodgeProduction.chimney.smokeArea[0],
      height: lodgeProduction.chimney.smokeArea[1],
      depth: lodgeProduction.chimney.smokeArea[2],
    });
    expect(config.cabin.smoke.count).toBe(lodgeProduction.chimney.smokeCount);
    expect(config.cabin.smoke.colors).toEqual(
      lodgeProduction.chimney.smokeColors
    );
    expect(config.cabin.smoke.sizeRange).toEqual(
      lodgeProduction.chimney.smokeSizeRange
    );
    expect(config.cabin.smoke.speed).toBe(lodgeProduction.chimney.smokeSpeed);
    expect(config.cabin.smoke.opacity).toBe(
      lodgeProduction.chimney.smokeOpacity
    );
    expect(config.cabin.windowLight.position.x).toBeCloseTo(windowX, 5);
    expect(config.cabin.windowLight.position.z).toBeCloseTo(windowZ, 5);
    expect(config.cabin.windowLight.heightOffset).toBeCloseTo(
      expectedPadHeight - lodgeProduction.asset.burialDepth + windowLocalHeight,
      5
    );
    expect(config.cabin.windowLight).toMatchObject({
      color: lodgeProduction.windowLight.color,
      intensity: lodgeProduction.windowLight.intensity,
      distance: lodgeProduction.windowLight.distance,
      decay: lodgeProduction.windowLight.decay,
    });
  });
});
