import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  type BufferGeometry,
  type MeshStandardMaterialParameters,
} from "three";

import { CANONICAL_PERFORMER_ANCHOR_Y } from "../../domain/stage-coordinate-frame";

export interface BlossomStageOptions {
  width: number;
  depth: number;
  groundY: number;
  showDirectionCues: boolean;
}

export interface BlossomStage {
  object: Group;
  setGroundY(groundY: number): void;
  dispose(): void;
}

const PLANK_THICKNESS = 0.055;
const PLANK_WIDTH = 0.34;
const PLANK_GAP = 0.012;
const LEG_THICKNESS = 0.14;
const LEG_INSET = 0.22;
const SKIRT_HEIGHT = 0.11;
const SKIRT_THICKNESS = 0.05;
const STRIP_HEIGHT = 0.035;
const STRIP_WIDTH = 0.05;
const TORCH_HEIGHT = 1.4;
const TORCH_POST_RADIUS = 0.04;
const STAIR_WIDTH = 0.8;
const STAIR_DEPTH = 0.22;
const STEP_COUNT = 3;
const PLANK_COLORS = [
  "#6a4a2b",
  "#5a3f24",
  "#755132",
  "#4f3720",
  "#664329",
  "#7a5737",
] as const;

/** Exact imperative form of the standard Stage3D used by Blossom. */
export function createBlossomStage(options: BlossomStageOptions): BlossomStage {
  const root = new Group();
  root.name = "blossom-performance-stage";
  root.position.y = options.groundY;
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<MeshStandardMaterial>();
  const halfWidth = options.width / 2;
  const halfDepth = options.depth / 2;
  const deckTop = CANONICAL_PERFORMER_ANCHOR_Y;

  function addMesh(
    name: string,
    geometry: BufferGeometry,
    materialOptions: MeshStandardMaterialParameters,
    position: readonly [number, number, number],
    rotationX = 0,
    castShadow = false,
    receiveShadow = false
  ): Mesh {
    const material = new MeshStandardMaterial(materialOptions);
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.x = rotationX;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    geometries.add(geometry);
    materials.add(material);
    root.add(mesh);
    return mesh;
  }

  const legCenterY =
    deckTop - PLANK_THICKNESS - CANONICAL_PERFORMER_ANCHOR_Y / 2 + 0.02;
  const legOffsets: ReadonlyArray<readonly [number, number]> = [
    [halfWidth - LEG_INSET, halfDepth - LEG_INSET],
    [-(halfWidth - LEG_INSET), halfDepth - LEG_INSET],
    [halfWidth - LEG_INSET, -(halfDepth - LEG_INSET)],
    [-(halfWidth - LEG_INSET), -(halfDepth - LEG_INSET)],
  ];
  for (const [index, [x, z]] of legOffsets.entries()) {
    addMesh(
      `blossom-stage-leg-${index}`,
      new BoxGeometry(
        LEG_THICKNESS,
        CANONICAL_PERFORMER_ANCHOR_Y,
        LEG_THICKNESS
      ),
      { color: "#3d2a18", roughness: 0.92, metalness: 0.02 },
      [x, legCenterY, z],
      0,
      true
    );
  }

  const skirtCenterY = deckTop - PLANK_THICKNESS - SKIRT_HEIGHT / 2;
  const skirtInset = LEG_THICKNESS * 0.3;
  const skirtMaterial = { color: "#3d2a18", roughness: 0.9 };
  addMesh(
    "blossom-stage-skirt-front",
    new BoxGeometry(
      options.width - skirtInset * 2,
      SKIRT_HEIGHT,
      SKIRT_THICKNESS
    ),
    skirtMaterial,
    [0, skirtCenterY, halfDepth - skirtInset]
  );
  addMesh(
    "blossom-stage-skirt-back",
    new BoxGeometry(
      options.width - skirtInset * 2,
      SKIRT_HEIGHT,
      SKIRT_THICKNESS
    ),
    skirtMaterial,
    [0, skirtCenterY, -(halfDepth - skirtInset)]
  );
  addMesh(
    "blossom-stage-skirt-right",
    new BoxGeometry(
      SKIRT_THICKNESS,
      SKIRT_HEIGHT,
      options.depth - skirtInset * 2
    ),
    skirtMaterial,
    [halfWidth - skirtInset, skirtCenterY, 0]
  );
  addMesh(
    "blossom-stage-skirt-left",
    new BoxGeometry(
      SKIRT_THICKNESS,
      SKIRT_HEIGHT,
      options.depth - skirtInset * 2
    ),
    skirtMaterial,
    [-(halfWidth - skirtInset), skirtCenterY, 0]
  );

  const stride = PLANK_WIDTH + PLANK_GAP;
  const plankCount = Math.max(1, Math.round(options.depth / stride));
  const totalSpan = plankCount * PLANK_WIDTH + (plankCount - 1) * PLANK_GAP;
  const plankStart = -totalSpan / 2 + PLANK_WIDTH / 2;
  const plankGeometry = new BoxGeometry(
    options.width,
    PLANK_THICKNESS,
    PLANK_WIDTH
  );
  const plankMaterial = new MeshStandardMaterial({
    roughness: 0.88,
    metalness: 0.03,
  });
  const planks = new InstancedMesh(plankGeometry, plankMaterial, plankCount);
  planks.name = "blossom-stage-planks";
  planks.castShadow = true;
  planks.receiveShadow = true;
  const plankMatrix = new Matrix4();
  const plankColor = new Color();
  for (let index = 0; index < plankCount; index += 1) {
    planks.setMatrixAt(
      index,
      plankMatrix.makeTranslation(
        0,
        deckTop - PLANK_THICKNESS / 2,
        plankStart + index * stride
      )
    );
    planks.setColorAt(
      index,
      plankColor.set(PLANK_COLORS[index % PLANK_COLORS.length])
    );
  }
  planks.computeBoundingSphere();
  geometries.add(plankGeometry);
  materials.add(plankMaterial);
  root.add(planks);

  if (options.showDirectionCues) {
    const cueY = deckTop + STRIP_HEIGHT / 2;
    addMesh(
      "blossom-stage-cue-downstage",
      new BoxGeometry(options.width * 0.94, STRIP_HEIGHT, STRIP_WIDTH),
      {
        color: "#ffb347",
        emissive: "#ffb347",
        emissiveIntensity: 1.4,
        toneMapped: false,
      },
      [0, cueY, halfDepth - 0.01]
    );
    addMesh(
      "blossom-stage-cue-upstage",
      new BoxGeometry(options.width * 0.94, STRIP_HEIGHT, STRIP_WIDTH),
      {
        color: "#3d5a80",
        emissive: "#3d5a80",
        emissiveIntensity: 0.45,
        toneMapped: false,
      },
      [0, cueY, -(halfDepth - 0.01)]
    );
    addMesh(
      "blossom-stage-cue-right",
      new BoxGeometry(STRIP_WIDTH, STRIP_HEIGHT, options.depth * 0.94),
      {
        color: "#f87171",
        emissive: "#f87171",
        emissiveIntensity: 0.75,
        toneMapped: false,
      },
      [halfWidth - 0.01, cueY, 0]
    );
    addMesh(
      "blossom-stage-cue-left",
      new BoxGeometry(STRIP_WIDTH, STRIP_HEIGHT, options.depth * 0.94),
      {
        color: "#4ade80",
        emissive: "#4ade80",
        emissiveIntensity: 0.75,
        toneMapped: false,
      },
      [-(halfWidth - 0.01), cueY, 0]
    );

    const markerY = deckTop + 0.003;
    addMesh(
      "blossom-stage-downstage-marker",
      new CircleGeometry(0.55, 3, -Math.PI / 2),
      {
        color: "#ffb347",
        emissive: "#ffb347",
        emissiveIntensity: 1,
        toneMapped: false,
      },
      [0, markerY, halfDepth * 0.35],
      -Math.PI / 2
    );
    for (const [name, x, z, color, intensity] of [
      ["upstage", 0, -(halfDepth - 0.38), "#3d5a80", 0.6],
      ["right", halfWidth - 0.38, 0, "#f87171", 0.8],
      ["left", -(halfWidth - 0.38), 0, "#4ade80", 0.8],
    ] as const) {
      addMesh(
        `blossom-stage-${name}-marker`,
        new CircleGeometry(0.14, 24),
        {
          color,
          emissive: color,
          emissiveIntensity: intensity,
          toneMapped: false,
        },
        [x, markerY, z],
        -Math.PI / 2
      );
    }
  }

  for (const [index, x] of [halfWidth, -halfWidth].entries()) {
    addMesh(
      `blossom-stage-torch-post-${index}`,
      new CylinderGeometry(
        TORCH_POST_RADIUS,
        TORCH_POST_RADIUS * 1.3,
        TORCH_HEIGHT,
        8
      ),
      { color: "#3d2a18", roughness: 0.9 },
      [x, deckTop + TORCH_HEIGHT / 2, halfDepth]
    );
    addMesh(
      `blossom-stage-torch-holder-${index}`,
      new CylinderGeometry(0.08, 0.06, 0.1, 8),
      { color: "#2a1a0c", roughness: 0.85, metalness: 0.15 },
      [x, deckTop + TORCH_HEIGHT - 0.05, halfDepth]
    );
    addMesh(
      `blossom-stage-torch-flame-${index}`,
      new SphereGeometry(0.1, 8, 6),
      {
        color: "#ff8822",
        emissive: "#ff6600",
        emissiveIntensity: 2.5,
        toneMapped: false,
      },
      [x, deckTop + TORCH_HEIGHT + 0.08, halfDepth]
    );
    const light = new PointLight("#ff7722", 15, 8, 1.5);
    light.name = `blossom-stage-torch-light-${index}`;
    light.position.set(x, deckTop + TORCH_HEIGHT + 0.15, halfDepth);
    root.add(light);
  }

  const stepHeight = deckTop / STEP_COUNT;
  for (let index = 0; index < STEP_COUNT; index += 1) {
    const topOfStep = deckTop - index * stepHeight;
    addMesh(
      `blossom-stage-stair-${index}`,
      new BoxGeometry(STAIR_WIDTH, stepHeight, STAIR_DEPTH),
      {
        color: PLANK_COLORS[(index + 2) % PLANK_COLORS.length],
        roughness: 0.88,
        metalness: 0.03,
      },
      [
        0,
        topOfStep - stepHeight / 2,
        -(halfDepth + STAIR_DEPTH * (index + 0.5)),
      ],
      0,
      true,
      true
    );
  }

  return {
    object: root,
    setGroundY(groundY) {
      root.position.y = groundY;
    },
    dispose() {
      planks.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      root.clear();
    },
  };
}
