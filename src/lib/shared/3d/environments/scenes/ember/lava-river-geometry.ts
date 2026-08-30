import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Vector3,
} from "three";
import type { LavaRiverChannelConfig } from "../../domain/models/scene-configs";

/**
 * Strip width added beyond the molten channel on each side, as a fraction of
 * the channel half-width. The shader terminates the surface on a noise contour
 * somewhere inside this margin, so the straight polygon edge never becomes the
 * silhouette the viewer reads as the shore.
 */
export const LAVA_RIVER_BANK_MARGIN_FRACTION = 0.22;

/**
 * Metres the outer margin descends below the channel floor. The carved bed in
 * the world GLB rises at the shore, so a margin that stays level rides up the
 * bank; descending tucks it under the levee instead.
 */
export const LAVA_RIVER_BANK_PLUNGE = 0.26;

/** Metres the channel floor dishes from the centreline to its nominal edge. */
export const LAVA_RIVER_CHANNEL_DISH = 0.05;

interface LavaRiverGeometryOptions {
  channel: LavaRiverChannelConfig;
  poolPosition: { x: number; z: number };
  groundY: number;
  width: number;
  bankMarginFraction?: number;
  bankPlunge?: number;
  channelDish?: number;
  lightCount?: number;
  longitudinalSegments?: number;
  lateralSegments?: number;
}

export interface LavaRiverGeometryResult {
  geometry: BufferGeometry;
  lightPositions: Vector3[];
  /** Centreline arc length in world units. */
  channelLength: number;
}

function resolveControlPoints({
  channel,
  poolPosition,
  groundY,
}: Pick<
  LavaRiverGeometryOptions,
  "channel" | "poolPosition" | "groundY"
>): Vector3[] {
  if (channel.points && channel.points.length >= 2) {
    return channel.points.map(
      ([x, z, height]) => new Vector3(x, groundY + height, z)
    );
  }

  const angle = channel.angle ?? 0;
  const length = channel.length ?? 1;
  const curvature = channel.curvature ?? 0;
  const sideX = -Math.sin(angle);
  const sideZ = Math.cos(angle);
  return [
    new Vector3(poolPosition.x, groundY + 0.03, poolPosition.z),
    new Vector3(
      poolPosition.x + Math.cos(angle) * length * 0.5 + sideX * curvature,
      groundY + 0.03,
      poolPosition.z + Math.sin(angle) * length * 0.5 + sideZ * curvature
    ),
    new Vector3(
      poolPosition.x + Math.cos(angle) * length,
      groundY + 0.03,
      poolPosition.z + Math.sin(angle) * length
    ),
  ];
}

interface CentrelineRow {
  center: Vector3;
  side: Vector3;
  halfWidth: number;
  sourceTaper: number;
  arcLength: number;
}

export function createLavaRiverStripGeometry({
  channel,
  poolPosition,
  groundY,
  width,
  bankMarginFraction = LAVA_RIVER_BANK_MARGIN_FRACTION,
  bankPlunge = LAVA_RIVER_BANK_PLUNGE,
  channelDish = LAVA_RIVER_CHANNEL_DISH,
  lightCount = 3,
  longitudinalSegments = 112,
  lateralSegments = 14,
}: LavaRiverGeometryOptions): LavaRiverGeometryResult {
  const controlPoints = resolveControlPoints({
    channel,
    poolPosition,
    groundY,
  });
  const curve = new CatmullRomCurve3(controlPoints, false, "centripetal", 0.5);
  const widthScale = channel.widthScale;
  const sourceTaperFraction = channel.sourceTaperFraction ?? 0;
  const marginFraction = Math.max(0, bankMarginFraction);
  const strippedSpan = 1 + marginFraction;

  const rows: CentrelineRow[] = [];
  let arcLength = 0;
  for (let row = 0; row <= longitudinalSegments; row += 1) {
    const t = row / longitudinalSegments;
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new Vector3(-tangent.z, 0, tangent.x).normalize();
    const taperProgress =
      sourceTaperFraction > 0 ? Math.min(1, t / sourceTaperFraction) : 1;
    const sourceTaper = taperProgress * taperProgress * (3 - 2 * taperProgress);
    const channelWidth =
      width *
      widthScale *
      (0.9 + Math.sin(t * Math.PI) * 0.1 + Math.sin(t * 17.3 + 0.7) * 0.025) *
      sourceTaper;

    const previous = rows.at(-1);
    if (previous) arcLength += previous.center.distanceTo(center);
    rows.push({
      center,
      side,
      halfWidth: channelWidth * 0.5,
      sourceTaper,
      arcLength,
    });
  }

  const channelLength = arcLength || 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const crossValues: number[] = [];
  const flowValues: number[] = [];
  const indices: number[] = [];

  for (const row of rows) {
    for (let column = 0; column <= lateralSegments; column += 1) {
      const lateralT = column / lateralSegments;
      // ±1 lands on the nominal channel edge, ±(1 + margin) on the polygon edge.
      const cross = (lateralT * 2 - 1) * strippedSpan;
      const magnitude = Math.abs(cross);
      const dish = Math.min(1, magnitude) ** 2 * channelDish;
      const marginProgress =
        marginFraction > 0
          ? Math.max(0, magnitude - 1) / marginFraction
          : 0;
      const plunge = marginProgress ** 1.4 * bankPlunge;

      const position = row.center
        .clone()
        .addScaledVector(row.side, cross * row.halfWidth);
      position.y -= (dish + plunge) * row.sourceTaper;

      positions.push(position.x, position.y, position.z);
      // U is normalised arc length, not curve parameter: the control points are
      // spaced 8 to 31 metres apart, so a parameter-space U stretched the crust
      // pattern four-fold across the reach and left long stretches featureless.
      uvs.push(row.arcLength / channelLength, lateralT);
      crossValues.push(cross);
      flowValues.push(row.arcLength);
    }
  }

  const rowWidth = lateralSegments + 1;
  for (let row = 0; row < longitudinalSegments; row += 1) {
    for (let column = 0; column < lateralSegments; column += 1) {
      const a = row * rowWidth + column;
      const b = a + 1;
      const c = a + rowWidth;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aCross", new Float32BufferAttribute(crossValues, 1));
  geometry.setAttribute("aFlow", new Float32BufferAttribute(flowValues, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const resolvedLightCount = Math.max(1, Math.round(lightCount));
  const lightPositions = Array.from({ length: resolvedLightCount }, (_, index) =>
    curve.getPoint(
      resolvedLightCount === 1
        ? 0.5
        : 0.12 + (index / (resolvedLightCount - 1)) * 0.78
    )
  );
  return { geometry, lightPositions, channelLength };
}
