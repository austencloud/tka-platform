import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFlowFestRuntimeContract } from "../../src/routes/test/flow-fest-graybox/flow-fest-runtime-contract";
import {
  createFlowFestCampPlan,
  FLOW_FEST_LOWER_CAMPGROUND_LOOP,
  FLOW_FEST_LOWER_CAMPGROUND_LOOP_NAIP_PIXELS,
  flowFestNaipPixelToWorld,
} from "../../src/routes/test/flow-fest-sim/flow-fest-camp-plan";
import { buildFlowFestGroundFamilyMask } from "../../src/routes/test/flow-fest-sim/flow-fest-ground-surface";
import type { FlowFestForestEcologyLayout } from "../../src/routes/test/flow-fest-sim/flow-fest-forest-ecology";

const contract = parseFlowFestRuntimeContract(
  JSON.parse(
    readFileSync(
      "static/data/flow-fest-sim/gate2-runtime-contract.json",
      "utf8"
    )
  )
);
const plan = createFlowFestCampPlan(contract, "lower-tent");
const bounds = { minX: -512, maxX: 512, minZ: -512, maxZ: 512 };
const ecology: FlowFestForestEcologyLayout = {
  trees: [],
  grass: [],
  groundLife: [
    {
      x: 170,
      y: 0,
      z: -88,
      rotation: 0,
      scale: 1,
      species: "damp-sedge-tussock",
    },
  ],
  audit: {
    treeRouteIntrusions: 0,
    grassRouteIntrusions: 0,
    groundLifeRouteIntrusions: 0,
    sourceTreeFamilies: 0,
    sourceTreeSpecies: 0,
    measuredCanopyPlacements: 0,
    infillTreePlacements: 0,
    grassPlacements: 0,
    groundLifePlacements: 1,
  },
};

describe("Flow Fest registered ground surface", () => {
  it("promotes the visible lower road loop into the shared camp plan", () => {
    const loop = plan.internalDrives.find(
      (drive) => drive.id === "lower-campground-loop"
    );

    expect(loop).toBeDefined();
    expect(loop?.evidence).toBe("public-orthophoto");
    expect(loop?.points).toEqual(FLOW_FEST_LOWER_CAMPGROUND_LOOP);
    expect(loop?.points[0]).toEqual(loop?.points.at(-1));
    expect(loopLength(loop?.points ?? [])).toBeGreaterThan(340);
    expect(loopLength(loop?.points ?? [])).toBeLessThan(360);
    expect(flowFestNaipPixelToWorld({ x: 1666.3, y: 806.4 })).toEqual({
      x: 321.1,
      z: -108.8,
    });
    expect(FLOW_FEST_LOWER_CAMPGROUND_LOOP_NAIP_PIXELS).toHaveLength(36);
    expect(FLOW_FEST_LOWER_CAMPGROUND_LOOP_NAIP_PIXELS[15]).toEqual({
      x: 1528,
      y: 663.8,
    });
  });

  it("registers Forest ground families to the same world frame as roads", () => {
    const mask = buildFlowFestGroundFamilyMask(plan, ecology, bounds, 256);
    const loopPoint = FLOW_FEST_LOWER_CAMPGROUND_LOOP[7]!;
    const lowerMeadow = { x: 270, z: -130 };
    const woodland = { x: 185, z: -111 };
    const damp = { x: 170, z: -88 };

    expect(mask.data).toHaveLength(256 * 256 * 4);
    expect(mask.maskOrigin).toEqual({ x: -512, y: -512 });
    expect(mask.maskSize).toEqual({ x: 1024, y: 1024 });
    expect(dominantFamily(mask, loopPoint)).toBe("packed");
    expect(dominantFamily(mask, lowerMeadow)).toBe("meadow");
    expect(dominantFamily(mask, woodland)).toBe("litter");
    expect(dominantFamily(mask, damp)).toBe("damp");
    expect(mask.audit.lowerLoopPaintedPixels).toBeGreaterThan(80);
    expect(mask.audit.sourceRouteCount).toBe(7);
  });
});

function loopLength(points: ReadonlyArray<{ x: number; z: number }>): number {
  return points.reduce((length, point, index) => {
    const previous = points[index - 1];
    return previous
      ? length + Math.hypot(point.x - previous.x, point.z - previous.z)
      : length;
  }, 0);
}

function dominantFamily(
  mask: ReturnType<typeof buildFlowFestGroundFamilyMask>,
  point: { x: number; z: number }
): "packed" | "meadow" | "litter" | "damp" {
  const pixelX = Math.max(
    0,
    Math.min(
      mask.width - 1,
      Math.floor(
        ((point.x - bounds.minX) / (bounds.maxX - bounds.minX)) * mask.width
      )
    )
  );
  const pixelY = Math.max(
    0,
    Math.min(
      mask.height - 1,
      Math.floor(
        ((bounds.maxZ - point.z) / (bounds.maxZ - bounds.minZ)) * mask.height
      )
    )
  );
  const offset = (pixelY * mask.width + pixelX) * 4;
  const right = mask.data[offset]!;
  const green = mask.data[offset + 1]!;
  const left = mask.data[offset + 2]!;
  const fourth = Math.max(0, 255 - right - green - left);
  const weights = [right, green, left, fourth];
  const names = ["packed", "meadow", "litter", "damp"] as const;
  let winner = 0;
  for (let index = 1; index < weights.length; index += 1) {
    if (weights[index]! > weights[winner]!) winner = index;
  }
  return names[winner]!;
}
