import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Vector3,
} from "three";
import type { LavaRiverChannelConfig } from "../../domain/models/scene-configs";

interface LavaRiverGeometryOptions {
  channel: LavaRiverChannelConfig;
  poolPosition: { x: number; z: number };
  groundY: number;
  width: number;
  longitudinalSegments?: number;
  lateralSegments?: number;
}

export interface LavaRiverGeometryResult {
  geometry: BufferGeometry;
  lightPositions: Vector3[];
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

export function createLavaRiverStripGeometry({
  channel,
  poolPosition,
  groundY,
  width,
  longitudinalSegments = 112,
  lateralSegments = 8,
}: LavaRiverGeometryOptions): LavaRiverGeometryResult {
  const controlPoints = resolveControlPoints({
    channel,
    poolPosition,
    groundY,
  });
  const curve = new CatmullRomCurve3(controlPoints, false, "centripetal", 0.5);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const widthScale = channel.widthScale;

  for (let row = 0; row <= longitudinalSegments; row += 1) {
    const t = row / longitudinalSegments;
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new Vector3(-tangent.z, 0, tangent.x).normalize();
    const irregularWidth =
      width *
      widthScale *
      (0.9 + Math.sin(t * Math.PI) * 0.1 + Math.sin(t * 17.3 + 0.7) * 0.025);

    for (let column = 0; column <= lateralSegments; column += 1) {
      const lateralT = column / lateralSegments;
      const crossRiver = lateralT * 2 - 1;
      const edgeDrop = Math.pow(Math.abs(crossRiver), 1.8) * 0.07;
      const position = center
        .clone()
        .addScaledVector(side, crossRiver * irregularWidth * 0.5);
      position.y -= edgeDrop;
      positions.push(position.x, position.y, position.z);
      uvs.push(t, lateralT);
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
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const lightPositions = [0.12, 0.52, 0.9].map((t) => curve.getPoint(t));
  return { geometry, lightPositions };
}
