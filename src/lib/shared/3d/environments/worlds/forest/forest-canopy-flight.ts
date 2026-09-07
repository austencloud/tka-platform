import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Shape,
  ShapeGeometry,
  type Camera,
} from "three";

interface BatFlight {
  group: Group;
  mesh: Mesh;
  centerX: number;
  height: number;
  depth: number;
  span: number;
  duration: number;
  phase: number;
  wingSpeed: number;
}

export interface ForestCanopyFlight {
  object: Group;
  update(deltaSeconds: number, camera: Camera, groundY: number): void;
  dispose(): void;
}

/** Exact renderer-neutral owner of Forest's four authored canopy bats. */
export function createForestCanopyFlight(motionScale = 1): ForestCanopyFlight {
  const root = new Group();
  root.name = "forest-canopy-flight";
  const shape = new Shape();
  shape.moveTo(0, 0.2);
  shape.lineTo(0.07, 0.12);
  shape.lineTo(0.14, 0.08);
  shape.lineTo(0.34, 0.2);
  shape.lineTo(0.66, 0.05);
  shape.lineTo(0.48, -0.02);
  shape.lineTo(0.57, -0.16);
  shape.lineTo(0.31, -0.09);
  shape.lineTo(0.11, -0.24);
  shape.lineTo(0, -0.13);
  shape.lineTo(-0.11, -0.24);
  shape.lineTo(-0.31, -0.09);
  shape.lineTo(-0.57, -0.16);
  shape.lineTo(-0.48, -0.02);
  shape.lineTo(-0.66, 0.05);
  shape.lineTo(-0.34, 0.2);
  shape.lineTo(-0.14, 0.08);
  shape.lineTo(-0.07, 0.12);
  shape.closePath();
  const geometry = new ShapeGeometry(shape, 1);
  const material = new MeshBasicMaterial({
    color: "#354158",
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  const flightSpecs: ReadonlyArray<
    readonly [number, number, number, number, number, number, number]
  > = [
    [-5, 15.5, -25, 54, 26, 0.08, 5.2],
    [14, 19, -42, 62, 31, 0.46, 4.6],
    [-18, 12.5, -53, 48, 23, 0.71, 5.8],
    [25, 22, -68, 70, 36, 0.29, 4.2],
  ];
  const flights: BatFlight[] = flightSpecs.map(
    ([centerX, height, depth, span, duration, phase, wingSpeed], index) => {
      const group = new Group();
      const mesh = new Mesh(geometry, material);
      const scale = 0.48 + index * 0.07;
      mesh.scale.set(scale, scale, scale);
      group.add(mesh);
      root.add(group);
      return {
        group,
        mesh,
        centerX,
        height,
        depth,
        span,
        duration,
        phase,
        wingSpeed,
      };
    }
  );
  let elapsed = 0;
  let disposed = false;

  return {
    object: root,
    update(deltaSeconds, camera, groundY) {
      if (disposed) return;
      elapsed += deltaSeconds * motionScale;
      for (const flight of flights) {
        const progress = (elapsed / flight.duration + flight.phase) % 1;
        const arc = progress * Math.PI * 2;
        flight.group.position.set(
          flight.centerX + (progress - 0.5) * flight.span,
          groundY + flight.height + Math.sin(arc * 1.7) * 1.25,
          flight.depth + Math.sin(arc) * 4.5
        );
        flight.group.lookAt(camera.position);
        flight.mesh.scale.y =
          flight.mesh.scale.x *
          (0.62 + 0.38 * Math.abs(Math.sin(elapsed * flight.wingSpeed + arc)));
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      material.dispose();
      root.clear();
    },
  };
}
