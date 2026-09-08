import {
  ExtrudeGeometry,
  LatheGeometry,
  type BufferGeometry,
  type Shape,
  Vector2,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface ProfileStop {
  readonly at: number;
  readonly radius: number;
}

export interface RoundedCylinderOptions {
  readonly length: number;
  readonly radius: number;
  readonly radiusEnd?: number;
  readonly fillet: number;
  readonly radialSegments?: number;
  readonly filletSegments?: number;
}

export function revolvedProfile(
  stops: readonly ProfileStop[],
  radialSegments = 24
): BufferGeometry {
  const profile: Vector2[] = [];
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) throw new Error("A revolved prop profile needs stops");

  if (first.radius > 0) profile.push(new Vector2(0, first.at));
  for (const stop of stops) profile.push(new Vector2(stop.radius, stop.at));
  if (last.radius > 0) profile.push(new Vector2(0, last.at));

  return new LatheGeometry(profile, radialSegments);
}

export function roundedCylinder({
  length,
  radius,
  radiusEnd,
  fillet,
  radialSegments = 20,
  filletSegments = 4,
}: RoundedCylinderOptions): BufferGeometry {
  const near = radius;
  const far = radiusEnd ?? radius;
  const half = length / 2;
  const corner = Math.min(fillet, near, far, half);
  const profile: Vector2[] = [new Vector2(0, -half)];

  for (let index = 0; index <= filletSegments; index += 1) {
    const angle = -Math.PI / 2 + (Math.PI / 2) * (index / filletSegments);
    profile.push(
      new Vector2(
        near - corner + corner * Math.cos(angle),
        -half + corner + corner * Math.sin(angle)
      )
    );
  }

  for (let index = 0; index <= filletSegments; index += 1) {
    const angle = (Math.PI / 2) * (index / filletSegments);
    profile.push(
      new Vector2(
        far - corner + corner * Math.cos(angle),
        half - corner + corner * Math.sin(angle)
      )
    );
  }

  profile.push(new Vector2(0, half));
  const geometry = new LatheGeometry(profile, radialSegments);
  geometry.computeVertexNormals();
  return geometry;
}

const STRAIGHT_FRACTION = 0.16;
const BEVEL_FRACTION = 0.42;

export function bullnosePlate(
  shape: Shape | Shape[],
  depth: number,
  maxInset: number,
  curveSegments = 14
): BufferGeometry {
  const bevel = depth * BEVEL_FRACTION;
  const extruded = new ExtrudeGeometry(shape, {
    depth: depth * STRAIGHT_FRACTION,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: Math.min(bevel, maxInset),
    bevelOffset: 0,
    bevelSegments: 5,
    curveSegments,
  });
  extruded.translate(0, 0, -(depth * STRAIGHT_FRACTION) / 2);
  extruded.deleteAttribute("normal");
  extruded.deleteAttribute("uv");
  const welded = mergeVertices(extruded);
  welded.computeVertexNormals();
  extruded.dispose();
  return welded;
}
