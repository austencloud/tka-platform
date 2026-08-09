import type {
  MuseumGrid,
  MuseumTerrainProgram,
} from "../domain/museum-grid-types";
import type { Point2 } from "./drowned-gallery-terrain";
import type {
  EarthRootObservatoryPlan,
  EarthRootObservatoryRoutePoint,
} from "./earth-root-observatory-plan";

interface RouteProjection {
  distance: number;
  elevation: number;
}

function projectToSegment(
  point: Point2,
  from: EarthRootObservatoryRoutePoint,
  to: EarthRootObservatoryRoutePoint
): RouteProjection {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const amount =
    lengthSquared < 1e-12
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared
          )
        );
  const x = from.x + dx * amount;
  const z = from.z + dz * amount;
  return {
    distance: Math.hypot(point.x - x, point.z - z),
    elevation: from.elevation + (to.elevation - from.elevation) * amount,
  };
}

export function nearestEarthRootObservatoryRouteProjection(
  plan: EarthRootObservatoryPlan,
  point: Point2
): RouteProjection {
  return plan.walkPath.slice(1).reduce<RouteProjection>(
    (nearest, to, index) => {
      const candidate = projectToSegment(point, plan.walkPath[index]!, to);
      return candidate.distance < nearest.distance ? candidate : nearest;
    },
    { distance: Number.POSITIVE_INFINITY, elevation: 0 }
  );
}

export function createEarthRootObservatoryGrayboxTerrain(
  plan: EarthRootObservatoryPlan
): MuseumTerrainProgram {
  return {
    waterlineY: -100,
    elevationAt(worldX, worldZ) {
      return nearestEarthRootObservatoryRouteProjection(plan, {
        x: worldX,
        z: worldZ,
      }).elevation;
    },
    blockedAt(worldX, worldZ) {
      const point = { x: worldX, z: worldZ };
      const insideRoom =
        worldX >= plan.room.minX &&
        worldX <= plan.room.maxX &&
        worldZ >= plan.room.minZ &&
        worldZ <= plan.room.maxZ;
      if (!insideRoom) return true;

      const route = nearestEarthRootObservatoryRouteProjection(plan, point);
      if (route.distance <= plan.routeWidth / 2) return false;

      return (
        Math.hypot(
          worldX - plan.recognitionZone.centre.x,
          worldZ - plan.recognitionZone.centre.z
        ) > plan.recognitionZone.radius
      );
    },
  };
}

/**
 * Review-only physics grid for the approved observatory route.
 *
 * The compiled cave still contains the superseded Earth exhibit stations and
 * furniture. The Blender graybox owns this room during Gate 2, so this clone
 * removes those stale colliders and clears only the authored route corridor.
 * Everything outside the route remains blocked by the terrain program.
 */
export function createEarthRootObservatoryGrayboxReviewGrid(
  source: MuseumGrid,
  plan: EarthRootObservatoryPlan
): MuseumGrid {
  const terrain = createEarthRootObservatoryGrayboxTerrain(plan);
  const tiles = new Map(source.tiles);

  for (const [key, tile] of tiles) {
    const [tileXText, tileYText] = key.split(",");
    const worldX = Number(tileXText) * source.tileScale;
    const worldZ = Number(tileYText) * source.tileScale;
    if (!terrain.blockedAt(worldX, worldZ)) {
      tiles.set(key, { ...tile, type: "floor", material: "dirt" });
    }
  }

  const isInsideRoom = (tileX: number, tileY: number) => {
    const worldX = tileX * source.tileScale;
    const worldZ = tileY * source.tileScale;
    return (
      worldX >= plan.room.minX &&
      worldX <= plan.room.maxX &&
      worldZ >= plan.room.minZ &&
      worldZ <= plan.room.maxZ
    );
  };

  return {
    ...source,
    tiles,
    performers: source.performers.filter(
      (performer) => !isInsideRoom(performer.tileX, performer.tileY)
    ),
    furniture: source.furniture.filter(
      (item) => !isInsideRoom(item.tileX, item.tileY)
    ),
    terrain,
  };
}
