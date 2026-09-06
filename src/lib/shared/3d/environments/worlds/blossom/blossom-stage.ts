import {
  CircleGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  type BufferGeometry,
} from "three";
import { CANONICAL_PERFORMER_ANCHOR_Y } from "../../domain/stage-coordinate-frame";

export interface BlossomStageOptions {
  width: number;
  depth: number;
  groundY: number;
  showDirectionCues: boolean;
  surfaceMaterial?: MeshStandardMaterial;
}
export interface BlossomStage {
  object: Group;
  setGroundY(groundY: number): void;
  dispose(): void;
}

function roundedRectangle(width: number, depth: number, radius: number): Shape {
  const shape = new Shape();
  const x = width / 2;
  const y = depth / 2;
  shape.moveTo(-x + radius, -y);
  shape.lineTo(x - radius, -y);
  shape.quadraticCurveTo(x, -y, x, -y + radius);
  shape.lineTo(x, y - radius);
  shape.quadraticCurveTo(x, y, x - radius, y);
  shape.lineTo(-x + radius, y);
  shape.quadraticCurveTo(-x, y, -x, y - radius);
  shape.lineTo(-x, -y + radius);
  shape.quadraticCurveTo(-x, -y, -x + radius, -y);
  return shape;
}

/** A level slate court sharing the authored garden's surface material. */
export function createBlossomStage(options: BlossomStageOptions): BlossomStage {
  const root = new Group();
  root.name = "blossom-performance-stage";
  root.position.y = options.groundY;
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<MeshStandardMaterial>();
  const deckTop = CANONICAL_PERFORMER_ANCHOR_Y;
  const radius = Math.min(1.2, options.width / 4, options.depth / 4);
  const surface =
    options.surfaceMaterial?.clone() ??
    new MeshStandardMaterial({ color: "#343e48", roughness: 0.87 });
  surface.name = "Blossom slate court";
  surface.roughness = 0.87;
  surface.vertexColors = false;
  // The runtime court has no authored color attribute; stale bound vertex
  // colors can otherwise darken the borrowed glTF material.
  materials.add(surface);
  const geometry = new ExtrudeGeometry(
    roundedRectangle(options.width, options.depth, radius),
    {
      depth: 0.2,
      bevelEnabled: false,
      curveSegments: 16,
    }
  );
  // The apron uses metres / 2.2 for UVs; matching that scale avoids a material seam.
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, uv.getX(i) / 2.2, uv.getY(i) / 2.2);
  geometries.add(geometry);
  const court = new Mesh(geometry, surface);
  court.name = "blossom-stage-slate";
  court.rotation.x = -Math.PI / 2;
  court.position.y = deckTop - 0.2;
  court.receiveShadow = true;
  court.castShadow = true;
  root.add(court);

  const outline = roundedRectangle(
    options.width - 0.24,
    options.depth - 0.24,
    radius
  );
  const hole = roundedRectangle(
    options.width - 0.3,
    options.depth - 0.3,
    radius - 0.03
  );
  outline.holes.push(new Path(hole.getPoints(16).reverse()));
  const inlayGeometry = new ExtrudeGeometry(outline, {
    depth: 0.004,
    bevelEnabled: false,
    curveSegments: 16,
  });
  const bronze = new MeshStandardMaterial({
    color: "#746048",
    metalness: 0.5,
    roughness: 0.6,
  });
  geometries.add(inlayGeometry);
  materials.add(bronze);
  const inlay = new Mesh(inlayGeometry, bronze);
  inlay.name = "blossom-stage-bronze-inlay";
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.y = deckTop + 0.001;
  root.add(inlay);

  if (options.showDirectionCues) {
    for (const [name, x, z, color, sides] of [
      ["downstage", 0, options.depth / 2 - 0.45, "#ad926a", 3],
      ["upstage", 0, -options.depth / 2 + 0.45, "#66808d", 24],
      ["right", options.width / 2 - 0.45, 0, "#986b70", 24],
      ["left", -options.width / 2 + 0.45, 0, "#6c8976", 24],
    ] as const) {
      const markerGeometry = new CircleGeometry(
        name === "downstage" ? 0.15 : 0.07,
        sides
      );
      const material = new MeshStandardMaterial({
        color,
        roughness: 0.7,
        metalness: 0.3,
      });
      geometries.add(markerGeometry);
      materials.add(material);
      const marker = new Mesh(markerGeometry, material);
      marker.name = `blossom-stage-${name}-marker`;
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(x, deckTop + 0.006, z);
      root.add(marker);
    }
  }
  return {
    object: root,
    setGroundY(groundY) {
      root.position.y = groundY;
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      root.clear();
    },
  };
}
