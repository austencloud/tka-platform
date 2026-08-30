import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createLavaRiverStripGeometry,
  LAVA_RIVER_BANK_MARGIN_FRACTION,
  LAVA_RIVER_BANK_PLUNGE,
} from "$lib/shared/3d/environments/scenes/ember/lava-river-geometry";
import { createDefaultEmberConfig } from "$lib/shared/3d/environments/domain/models/scene-configs/ember-scene-config";
import volcanicWorldR7 from "$lib/shared/3d/environments/domain/models/scene-configs/ember-volcanic-world-r7.json";

const RIVER_COMPONENT = resolve(
  "src/lib/shared/3d/environments/scenes/ember/LavaRivers.svelte"
);

function bakedChannel() {
  const channel = createDefaultEmberConfig().lavaRivers?.channels[0];
  if (!channel) throw new Error("Ember ships one baked lava channel");
  return channel;
}

function buildStrip(overrides: Record<string, unknown> = {}) {
  return createLavaRiverStripGeometry({
    channel: bakedChannel(),
    poolPosition: { x: 0, z: 0 },
    groundY: 0,
    width: volcanicWorldR7.lavaRiver.width,
    longitudinalSegments: 48,
    lateralSegments: 14,
    ...overrides,
  });
}

describe("lava river strip geometry", () => {
  it("parameterises U by arc length, not by curve parameter", () => {
    const { geometry, channelLength } = buildStrip();
    const uv = geometry.getAttribute("uv");
    const position = geometry.getAttribute("position");
    const rowWidth = 15;
    const rows = 48;

    expect(uv.getX(0)).toBe(0);
    expect(uv.getX(rows * rowWidth)).toBeCloseTo(1, 6);

    let previous = -1;
    let travelled = 0;
    let maxParameterGap = 0;
    for (let row = 0; row <= rows; row += 1) {
      const centre = row * rowWidth + 7;
      const u = uv.getX(centre);
      expect(u).toBeGreaterThanOrEqual(previous);
      previous = u;

      if (row > 0) {
        const previousCentre = (row - 1) * rowWidth + 7;
        travelled += Math.hypot(
          position.getX(centre) - position.getX(previousCentre),
          position.getY(centre) - position.getY(previousCentre),
          position.getZ(centre) - position.getZ(previousCentre)
        );
      }
      // Arc length measured on the emitted centreline, so the shader's world
      // frequency is exact rather than approximately right.
      expect(u * channelLength).toBeCloseTo(travelled, 3);
      maxParameterGap = Math.max(maxParameterGap, Math.abs(u - row / rows));
    }

    // The baked control points are spaced 8 to 31 metres apart. If U were the
    // curve parameter again, this would collapse to zero and the crust pattern
    // would stretch four-fold across the reach.
    expect(maxParameterGap).toBeGreaterThan(0.02);
  });

  it("reserves a margin the shader can terminate inside", () => {
    const { geometry } = buildStrip();
    const cross = geometry.getAttribute("aCross");
    const span = 1 + LAVA_RIVER_BANK_MARGIN_FRACTION;

    let extreme = 0;
    for (let index = 0; index < cross.count; index += 1) {
      extreme = Math.max(extreme, Math.abs(cross.getX(index)));
    }
    expect(extreme).toBeCloseTo(span, 6);

    const source = readFileSync(RIVER_COMPONENT, "utf8");
    expect(source).toContain("if (bank > cut) discard;");
    const cut = source.match(
      /cut = 1\.0 \+ uMarginFraction\s*\*\s*\(([\d.]+) \+ ([\d.]+)/
    );
    expect(cut).not.toBeNull();
    const ceiling = Number(cut![1]) + Number(cut![2]);
    // Strictly under one: the ragged shore always lands inside the reserved
    // margin, so the strip's straight polygon edge is never the silhouette.
    expect(ceiling).toBeLessThan(1);
  });

  it("keeps the cross-river field off the vertex lattice", () => {
    const source = readFileSync(RIVER_COMPONENT, "utf8");
    // The lateral noise domain used to run at nine cells across a nine-column
    // strip, which showed up as rectangular bites along the shore.
    expect(source).not.toMatch(/vUv\.y\s*\*/);
    expect(source).toContain("attribute float aCross;");
    expect(source).toContain("attribute float aFlow;");
  });

  it("drops the reserved margin below the channel floor", () => {
    const { geometry } = buildStrip();
    const position = geometry.getAttribute("position");
    const cross = geometry.getAttribute("aCross");
    const rowWidth = 15;
    const row = 30 * rowWidth;

    const centre = position.getY(row + 7);
    let nominalEdge = 0;
    let outerEdge = position.getY(row);
    for (let column = 0; column <= 14; column += 1) {
      if (Math.abs(Math.abs(cross.getX(row + column)) - 1) < 0.08) {
        nominalEdge = position.getY(row + column);
      }
    }

    expect(nominalEdge).toBeLessThan(centre);
    expect(centre - nominalEdge).toBeLessThan(0.1);
    expect(nominalEdge - outerEdge).toBeGreaterThan(LAVA_RIVER_BANK_PLUNGE * 0.5);
  });

  it("still opens from a point source and spaces its bank lights", () => {
    const { geometry, lightPositions } = buildStrip({
      lateralSegments: 4,
      longitudinalSegments: 20,
      lightCount: 5,
    });
    const position = geometry.getAttribute("position");
    const source = Array.from({ length: 5 }, (_, index) =>
      [
        position.getX(index),
        position.getY(index),
        position.getZ(index),
      ].join(",")
    );
    expect(new Set(source).size).toBe(1);
    expect(lightPositions).toHaveLength(5);
    for (let index = 1; index < lightPositions.length; index += 1) {
      expect(
        lightPositions[index]!.distanceTo(lightPositions[index - 1]!)
      ).toBeGreaterThan(1);
    }
  });
});
