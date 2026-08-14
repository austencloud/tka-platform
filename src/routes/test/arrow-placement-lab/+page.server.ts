import { readFile } from "node:fs/promises";
import path from "node:path";

import type { PageServerLoad } from "./$types";
import {
  buildPlacementCatalog,
  type PlacementMap,
  type PlacementMotionName,
} from "../arrow-placement-fixture";

const MOTION_TYPES: PlacementMotionName[] = [
  "pro",
  "anti",
  "dash",
  "static",
  "float",
];

export const load: PageServerLoad = async () => {
  const mapEntries = await Promise.all(
    MOTION_TYPES.map(async (motionType) => [
      motionType,
      await readPlacementMap(motionType),
    ])
  );
  const maps = Object.fromEntries(mapEntries) as Record<
    PlacementMotionName,
    PlacementMap
  >;
  const catalog = buildPlacementCatalog(maps);
  const placementKeyCount = catalog.reduce(
    (total, motion) => total + motion.keys.length,
    0
  );
  const authoredContextCount = catalog.reduce(
    (total, motion) =>
      total +
      motion.keys.reduce(
        (keyTotal, key) =>
          keyTotal +
          key.turns.reduce(
            (turnTotal, turn) => turnTotal + turn.rotationDirections.length,
            0
          ),
        0
      ),
    0
  );

  return { catalog, placementKeyCount, authoredContextCount };
};

async function readPlacementMap(
  motionType: PlacementMotionName
): Promise<PlacementMap> {
  const filePath = path.resolve(
    process.cwd(),
    "static",
    "data",
    "arrow_placement",
    "default",
    `default_${motionType}_placements.json`
  );
  return JSON.parse(await readFile(filePath, "utf8")) as PlacementMap;
}
