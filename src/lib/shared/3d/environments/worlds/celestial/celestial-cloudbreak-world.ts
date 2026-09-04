import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  Shape,
  ShapeGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type Material,
  type Object3D,
} from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

import { resolveCircularStageRadius } from "../../domain/performer-stage-bounds";
import {
  REFLECTIVE_POOL_DEFAULTS,
  ReflectivePoolShader,
} from "../../primitives/reflective-pool-shader";
import {
  CLOUDBREAK_RUNTIME_ASSETS,
  type CloudbreakRenderableAsset,
} from "../../scenes/celestial/cloudbreak-assets";
import {
  CLOUDBREAK_LAGOON,
  CLOUDBREAK_LAGOON_LOCAL_OUTLINE,
  CLOUDBREAK_LAYOUT,
  CLOUDBREAK_SKY_SUN,
} from "../../scenes/celestial/cloudbreak-layout";
import { disposeCelestialObjectTree } from "./celestial-disposal";

export interface CelestialCloudbreakAssets {
  shell: Object3D;
  placements: ReadonlyMap<string, Object3D>;
}

export interface CelestialCloudbreakOptions {
  groundY: number;
  stageRadius: number;
  stageRadiusGrowth: number;
  worldYOffset: number;
  reflectionResolution: number;
}

export interface CelestialCloudbreakWorld {
  object: Group;
  reflector: Reflector;
  update(deltaSeconds: number): void;
  pulse(): void;
  setGroundY(groundY: number): void;
  setActive(active: boolean): void;
  dispose(): void;
}

interface Placement {
  asset: CloudbreakRenderableAsset;
  position: readonly [number, number, number];
  rotationY: number;
  scaleMultiplier?: number;
}

interface WaterfallController {
  object: Group;
  update(deltaSeconds: number): void;
  pulse(): void;
}

const RUNTIME_PLACEMENTS: readonly Placement[] = [
  {
    asset: CLOUDBREAK_RUNTIME_ASSETS[0],
    position: [-9.2, 0.02, -0.5],
    rotationY: -0.28,
  },
  {
    asset: CLOUDBREAK_RUNTIME_ASSETS[1],
    position: [8.2, 0.02, 1.6],
    rotationY: 0.42,
  },
  {
    asset: CLOUDBREAK_RUNTIME_ASSETS[2],
    position: [10.5, 0.02, 5.25],
    rotationY: -0.74,
    scaleMultiplier: 0.92,
  },
  {
    asset: CLOUDBREAK_RUNTIME_ASSETS[3],
    position: [11.35, 0.02, -5.25],
    rotationY: 0.38,
    scaleMultiplier: 0.82,
  },
];

function applyShellVisibility(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const role = String(child.userData.tka_role ?? "");
    const element = String(child.userData.tka_element ?? "");
    const distantOlive = element === "high-olive-distant-tree";
    const placeholderForegroundOlive =
      (role === "cloudbreak-olive-trunk" ||
        role === "cloudbreak-olive-canopy") &&
      !distantOlive;

    child.visible = !(
      placeholderForegroundOlive ||
      role === "cloudbreak-root-stone" ||
      role === "cloudbreak-surface-stone" ||
      role === "cloudbreak-performance-terrace" ||
      role === "cloudbreak-lagoon-rim" ||
      role === "cloudbreak-lagoon-water" ||
      role === "cloudbreak-waterfall"
    );
  });
}

function gradeShellMaterial(
  source: Material,
  role: string,
  element: string
): Material {
  const material = source.clone();
  if (!(material instanceof MeshStandardMaterial)) return material;

  material.metalness = 0;
  material.envMapIntensity = 0.36;
  material.emissive.set("#000000");
  material.emissiveIntensity = 0;
  if (role === "cloudbreak-weathered-surface") {
    material.color.set("#c8b184");
    material.roughness = 0.96;
    material.normalScale.set(0.62, 0.62);
  } else if (role === "cloudbreak-landmass") {
    material.color.set("#a77d56");
    material.roughness = 0.9;
  } else if (role === "cloudbreak-landmass-strata") {
    material.color.set("#79563e");
    material.roughness = 0.97;
  } else if (role === "cloudbreak-distant-mesa") {
    const mesaColors: Record<string, string> = {
      "left-fall": "#9a704e",
      "right-fall": "#a77e59",
      "high-olive": "#b28e69",
      "far-right-shelf": "#bea17f",
    };
    material.color.set(mesaColors[element] ?? "#a77e59");
    material.roughness = 0.92;
  } else if (role === "cloudbreak-distant-mesa-cap") {
    material.color.set("#d8bd88");
    material.roughness = 0.88;
  } else {
    material.roughness = Math.max(0.84, material.roughness);
  }
  material.needsUpdate = true;
  return material;
}

function prepareShell(source: Object3D): {
  root: Group;
  limestone: MeshStandardMaterial | null;
} {
  const root = source.clone(true) as Group;
  let limestone: MeshStandardMaterial | null = null;
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const role = String(child.userData.tka_role ?? "");
    const element = String(child.userData.tka_element ?? "");
    child.material = Array.isArray(child.material)
      ? child.material.map((material) =>
          gradeShellMaterial(material, role, element)
        )
      : gradeShellMaterial(child.material, role, element);
    if (!limestone && role === "cloudbreak-landmass") {
      const candidate = Array.isArray(child.material)
        ? child.material.find(
            (material) => material instanceof MeshStandardMaterial
          )
        : child.material;
      if (candidate instanceof MeshStandardMaterial) limestone = candidate;
    }
    child.receiveShadow = role !== "cloudbreak-waterfall";
    child.castShadow =
      role !== "cloudbreak-waterfall" &&
      role !== "cloudbreak-weathered-surface";
  });
  applyShellVisibility(root);
  return { root, limestone };
}

function clonePlacementMaterial(
  source: Material,
  asset: CloudbreakRenderableAsset,
  stoneMaterial: MeshStandardMaterial | null
): Material {
  if (asset.materialGrade === "limestone" && stoneMaterial) {
    const clone = stoneMaterial.clone();
    clone.metalness = 0;
    clone.roughness = Math.max(0.84, clone.roughness);
    clone.envMapIntensity = 0.48;
    clone.needsUpdate = true;
    return clone;
  }

  const clone = source.clone();
  if (!(clone instanceof MeshStandardMaterial)) return clone;
  clone.metalness = 0;
  clone.envMapIntensity = 0.48;
  if (asset.materialGrade === "olive") {
    clone.color.lerp(new Color("#929b72"), 0.16);
    clone.roughness = Math.max(0.76, clone.roughness);
  } else {
    clone.map = null;
    clone.emissiveMap = null;
    clone.vertexColors = false;
    clone.color.set("#cdb58d");
    clone.emissive.set("#7d684e");
    clone.emissiveIntensity = 0.018;
    clone.roughness = Math.max(0.8, clone.roughness);
  }
  clone.needsUpdate = true;
  return clone;
}

function preparePlacement(
  source: Object3D,
  placement: Placement,
  limestone: MeshStandardMaterial | null
): Group {
  const prepared = source.clone(true) as Group;
  prepared.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.material = Array.isArray(child.material)
      ? child.material.map((material) =>
          clonePlacementMaterial(material, placement.asset, limestone)
        )
      : clonePlacementMaterial(child.material, placement.asset, limestone);
  });

  prepared.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(prepared, true);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const normalizingScale =
    placement.asset.targetHeight / Math.max(size.y, 0.001);
  prepared.position.set(-center.x, -bounds.min.y, -center.z);
  prepared.scale.setScalar(normalizingScale * (placement.scaleMultiplier ?? 1));

  const group = new Group();
  group.name = `cloudbreak-placement:${placement.asset.id}`;
  group.position.set(...placement.position);
  group.rotation.y = placement.rotationY;
  group.add(prepared);
  return group;
}

function createPathGeometry(widthMultiplier = 1): ShapeGeometry {
  const approach = CLOUDBREAK_LAYOUT.approach;
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  for (let index = 0; index <= 18; index += 1) {
    const progress = index / 18;
    const z = 2.1 + progress * 41.5;
    const centre = Math.sin(progress * Math.PI * 2.15) * 0.34;
    const halfWidth =
      (approach.wornBandWidth / 2) *
      widthMultiplier *
      (0.91 + Math.sin(index * 1.71) * 0.045);
    left.push([centre - halfWidth, -z]);
    right.push([centre + halfWidth, -z]);
  }
  const shape = new Shape();
  shape.moveTo(left[0]![0], left[0]![1]);
  for (const [x, z] of left.slice(1)) shape.lineTo(x, z);
  for (const [x, z] of right.reverse()) shape.lineTo(x, z);
  shape.closePath();
  const geometry = new ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function addMesh(
  root: Object3D,
  geometry: BufferGeometry,
  material: Material,
  position: readonly [number, number, number],
  options: {
    rotation?: readonly [number, number, number];
    castShadow?: boolean;
    receiveShadow?: boolean;
  } = {}
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(...position);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  mesh.castShadow = options.castShadow ?? false;
  mesh.receiveShadow = options.receiveShadow ?? false;
  root.add(mesh);
  return mesh;
}

function createSpatialStudy(
  stageRadius: number,
  stageRadiusGrowth: number
): Group {
  const root = new Group();
  root.name = "cloudbreak-spatial-study";
  const threshold = CLOUDBREAK_LAYOUT.rearThreshold;
  const approach = CLOUDBREAK_LAYOUT.approach;
  const pillarWidth = (threshold.outerWidth - threshold.openingWidth) / 2;
  const innerPierWidth = pillarWidth * 0.48;
  const innerPierX = threshold.openingWidth / 2 + innerPierWidth / 2;
  const lintelHeight = threshold.outerHeight - threshold.openingHeight;
  const thresholdZ = threshold.centerXZ[1];
  const terraceCenter = CLOUDBREAK_LAYOUT.performanceTerrace.centerXZ;
  const terraceSurfaceRadius = resolveCircularStageRadius(
    stageRadius,
    6.08,
    { x: terraceCenter[0], z: terraceCenter[1] },
    stageRadiusGrowth
  );

  const limestone = new MeshStandardMaterial({
    color: "#c9ad82",
    roughness: 0.92,
    metalness: 0,
  });
  const limestoneLight = new MeshStandardMaterial({
    color: "#ddc49a",
    roughness: 0.9,
    metalness: 0,
  });
  const pathWear = new MeshStandardMaterial({
    color: "#76583d",
    roughness: 0.98,
    metalness: 0,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: DoubleSide,
  });
  const pathCore = new MeshStandardMaterial({
    color: "#c59a5e",
    roughness: 0.96,
    metalness: 0,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    side: DoubleSide,
  });
  const passageShadow = new MeshStandardMaterial({
    color: "#40372f",
    roughness: 1,
    metalness: 0,
  });
  const scaleFigure = new MeshStandardMaterial({
    color: "#493d31",
    roughness: 0.88,
    metalness: 0,
  });
  const stageSurface = new MeshStandardMaterial({
    color: "#e0bf7d",
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.24,
  });
  const stageEdge = new MeshStandardMaterial({
    color: "#896347",
    roughness: 0.98,
    metalness: 0,
  });
  const stageWear = new MeshStandardMaterial({
    color: "#96704c",
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    side: DoubleSide,
  });

  addMesh(
    root,
    new BoxGeometry(threshold.outerWidth + 17, 1.2, threshold.depth + 9),
    limestone,
    [0, -0.58, thresholdZ + 2],
    { receiveShadow: true }
  );
  addMesh(
    root,
    new CylinderGeometry(
      terraceSurfaceRadius + 0.1,
      terraceSurfaceRadius + 0.4,
      0.22,
      64
    ),
    stageEdge,
    [terraceCenter[0], 0.11, terraceCenter[1]],
    { castShadow: true, receiveShadow: true }
  );
  addMesh(
    root,
    new CircleGeometry(terraceSurfaceRadius, 64),
    stageSurface,
    [terraceCenter[0], 0.225, terraceCenter[1]],
    { rotation: [-Math.PI / 2, 0, 0], receiveShadow: true }
  );
  addMesh(
    root,
    new RingGeometry(
      terraceSurfaceRadius - 0.63,
      terraceSurfaceRadius - 0.12,
      64
    ),
    stageWear,
    [terraceCenter[0], 0.232, terraceCenter[1]],
    { rotation: [-Math.PI / 2, 0, 0], receiveShadow: true }
  );
  addMesh(
    root,
    createPathGeometry(),
    pathWear,
    [0, approach.surfaceY + 0.035, 0],
    { receiveShadow: true }
  );
  addMesh(
    root,
    createPathGeometry(0.48),
    pathCore,
    [0, approach.surfaceY + 0.043, 0],
    { receiveShadow: true }
  );
  addMesh(
    root,
    new BoxGeometry(
      threshold.openingWidth * 1.025,
      threshold.openingHeight * 1.025,
      1.2
    ),
    passageShadow,
    [0, threshold.openingHeight / 2, thresholdZ + threshold.depth * 0.62],
    { receiveShadow: true }
  );
  addMesh(
    root,
    new BoxGeometry(threshold.openingWidth, 0.6, threshold.depth * 0.72),
    passageShadow,
    [0, threshold.openingHeight + 0.12, thresholdZ + threshold.depth * 0.28],
    { receiveShadow: true }
  );
  for (const side of [-1, 1] as const) {
    addMesh(
      root,
      new BoxGeometry(
        innerPierWidth,
        threshold.openingHeight * 1.14,
        threshold.depth
      ),
      side < 0 ? limestone : limestoneLight,
      [side * innerPierX, threshold.openingHeight * 0.57, thresholdZ],
      {
        rotation: [0, side * 0.025, side * -0.018],
        castShadow: true,
        receiveShadow: true,
      }
    );
  }
  addMesh(
    root,
    new BoxGeometry(
      threshold.openingWidth * 1.12,
      lintelHeight * 0.72,
      threshold.depth * 1.03
    ),
    limestoneLight,
    [
      -threshold.openingWidth * 0.54,
      threshold.openingHeight + lintelHeight * 0.48,
      thresholdZ - 0.12,
    ],
    {
      rotation: [0, -0.018, 0.028],
      castShadow: true,
      receiveShadow: true,
    }
  );
  addMesh(
    root,
    new BoxGeometry(
      threshold.openingWidth * 1.08,
      lintelHeight * 0.68,
      threshold.depth
    ),
    limestone,
    [
      threshold.openingWidth * 0.56,
      threshold.openingHeight + lintelHeight * 0.51,
      thresholdZ + 0.08,
    ],
    {
      rotation: [0, 0.02, -0.035],
      castShadow: true,
      receiveShadow: true,
    }
  );

  const shoulderBlocks = [
    [-14.8, 5.8, 50.7, 8.7, 11.6, 15.5, -0.035],
    [15.2, 5.3, 51.1, 8.9, 10.6, 15.1, 0.04],
    [-25.5, 7.2, 49.5, 10.5, 14.4, 18.5, 0.08],
    [25.8, 6.6, 50.2, 11, 13.2, 17.2, -0.07],
    [-18.8, 15.5, 54.5, 9.2, 21.5, 9.5, -0.05],
    [19.3, 14.3, 55.1, 8.7, 19.4, 10.2, 0.06],
  ] as const;
  for (const block of shoulderBlocks) {
    addMesh(
      root,
      new BoxGeometry(block[3], block[4], block[5]),
      limestone,
      [block[0], block[1], block[2]],
      {
        rotation: [0, block[6], 0],
        castShadow: true,
        receiveShadow: true,
      }
    );
  }

  const figure = new Group();
  figure.position.set(-3.1, 0.01, 38.5);
  addMesh(
    figure,
    new CylinderGeometry(0.17, 0.23, 1.44, 12),
    scaleFigure,
    [0, 0.72, 0],
    { castShadow: true }
  );
  addMesh(figure, new SphereGeometry(0.17, 16, 12), scaleFigure, [0, 1.58, 0], {
    castShadow: true,
  });
  root.add(figure);
  return root;
}

function createLagoonEdge(): Group {
  const root = new Group();
  root.name = "cloudbreak-lagoon-edge";
  const outline = CLOUDBREAK_LAGOON.outline;
  const minX = Math.min(...outline.map(([x]) => x));
  const maxX = Math.max(...outline.map(([x]) => x));
  const minZ = Math.min(...outline.map(([, z]) => z));
  const maxZ = Math.max(...outline.map(([, z]) => z));
  const center: [number, number] = [(minX + maxX) / 2, (minZ + maxZ) / 2];
  const localOutline = outline.map(
    ([x, z]) => [x - center[0], z - center[1]] as [number, number]
  );
  const ring = (outerScale: number, innerScale: number): BufferGeometry => {
    const positions: number[] = [];
    const indices: number[] = [];
    for (const [x, z] of localOutline) {
      positions.push(x * outerScale, 0, z * outerScale);
    }
    for (const [x, z] of localOutline) {
      positions.push(x * innerScale, 0, z * innerScale);
    }
    for (let index = 0; index < localOutline.length; index += 1) {
      const next = (index + 1) % localOutline.length;
      const inner = index + localOutline.length;
      const innerNext = next + localOutline.length;
      indices.push(index, next, innerNext, index, innerNext, inner);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  };
  const weathered = new MeshStandardMaterial({
    color: "#8f7759",
    roughness: 0.88,
    metalness: 0,
    side: DoubleSide,
  });
  const wet = new MeshStandardMaterial({
    color: "#526d68",
    roughness: 0.46,
    metalness: 0,
    envMapIntensity: 0.32,
    side: DoubleSide,
  });
  root.position.set(center[0], 0, center[1]);
  addMesh(
    root,
    ring(1.16, 1.01),
    weathered,
    [0, CLOUDBREAK_LAYOUT.lagoon.surfaceY + 0.035 - 0.075, 0],
    { receiveShadow: true }
  );
  addMesh(
    root,
    ring(1.045, 0.978),
    wet,
    [0, CLOUDBREAK_LAYOUT.lagoon.surfaceY + 0.035 - 0.028, 0],
    { receiveShadow: true }
  );
  return root;
}

function createWaterfall(options: {
  position: readonly [number, number, number];
  width: number;
  height: number;
  rotationY?: number;
  crestDepth?: number;
  opacity?: number;
  speed?: number;
}): WaterfallController {
  const root = new Group();
  root.name = "cloudbreak-waterfall";
  root.position.set(...options.position);
  root.rotation.y = options.rotationY ?? 0;
  const opacity = options.opacity ?? 0.78;
  const speed = options.speed ?? 1;
  const crestDepth = options.crestDepth ?? 0;
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 displaced = position;
        displaced.x += sin(uv.y * 21.0 - uTime * 1.7) * 0.035;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      void main() {
        float falling = vUv.y * 9.0 + uTime * 2.15;
        float broadFlow = noise(vec2(vUv.x * 5.5, falling));
        float fineFlow = noise(vec2(vUv.x * 19.0, falling * 2.4));
        float strands = smoothstep(0.38, 0.86, broadFlow * 0.7 + fineFlow * 0.5);
        float edge = smoothstep(0.0, 0.13, vUv.x) * smoothstep(0.0, 0.13, 1.0 - vUv.x);
        float crown = smoothstep(0.0, 0.06, 1.0 - vUv.y);
        float baseMist = smoothstep(0.83, 1.0, vUv.y) * (0.55 + fineFlow * 0.45);
        float alpha = (0.19 + strands * 0.62 + baseMist * 0.28) * edge * crown * uOpacity;
        vec3 water = mix(vec3(0.43, 0.74, 0.82), vec3(0.96, 0.99, 1.0), strands + baseMist * 0.5);
        gl_FragColor = vec4(water, alpha);
      }
    `,
  });
  const lipMaterial = new MeshBasicMaterial({
    color: "#e7fbff",
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    side: DoubleSide,
  });
  const mistMaterial = new MeshBasicMaterial({
    color: "#e9f8fb",
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const front = addMesh(
    root,
    new PlaneGeometry(options.width, options.height, 10, 40),
    material,
    [0, 0, 0]
  );
  front.renderOrder = 3;
  const rear = addMesh(
    root,
    new PlaneGeometry(options.width * 0.9, options.height * 0.98, 8, 36),
    material,
    [0, 0, -0.09],
    { rotation: [0, 0.12, 0] }
  );
  rear.renderOrder = 3;
  if (crestDepth > 0) {
    const crest = addMesh(
      root,
      new PlaneGeometry(options.width * 0.94, crestDepth, 10, 12),
      material,
      [0, options.height / 2 + 0.018, crestDepth * 0.5],
      { rotation: [-Math.PI / 2, 0, 0] }
    );
    crest.renderOrder = 3;
    const lip = addMesh(
      root,
      new PlaneGeometry(options.width * 1.04, 0.44),
      lipMaterial,
      [0, options.height / 2 + 0.035, 0.18],
      { rotation: [-Math.PI / 2, 0, 0] }
    );
    lip.renderOrder = 4;
  }
  const mist = addMesh(root, new SphereGeometry(1, 24, 12), mistMaterial, [
    0,
    -options.height / 2 + 0.28,
    0.12,
  ]);
  mist.scale.set(options.width * 0.62, 0.34, 0.7);
  mist.renderOrder = 4;
  let pulseEnergy = 0;
  return {
    object: root,
    update(deltaSeconds) {
      material.uniforms.uTime!.value += Math.min(deltaSeconds, 1 / 20) * speed;
      pulseEnergy = Math.max(0, pulseEnergy - deltaSeconds * 0.7);
      material.uniforms.uOpacity!.value = opacity * (1 + pulseEnergy * 0.08);
    },
    pulse() {
      pulseEnergy = 1;
    },
  };
}

function createReflector(options: CelestialCloudbreakOptions): Reflector {
  const shape = new Shape();
  const [first, ...rest] = CLOUDBREAK_LAGOON_LOCAL_OUTLINE;
  shape.moveTo(first![0], first![1]);
  for (const [x, y] of rest) shape.lineTo(x, y);
  shape.closePath();
  const geometry = new ShapeGeometry(shape);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (bounds && uv) {
    const spanX = Math.max(bounds.max.x - bounds.min.x, 0.001);
    const spanY = Math.max(bounds.max.y - bounds.min.y, 0.001);
    for (let index = 0; index < positions.count; index += 1) {
      uv.setXY(
        index,
        (positions.getX(index) - bounds.min.x) / spanX,
        (positions.getY(index) - bounds.min.y) / spanY
      );
    }
    uv.needsUpdate = true;
  }
  const defaults = REFLECTIVE_POOL_DEFAULTS;
  const shoreline = CLOUDBREAK_LAGOON_LOCAL_OUTLINE;
  const shorelineStarts = Array.from({ length: 32 }, (_, index) => {
    const point = shoreline[index % shoreline.length]!;
    return new Vector2(point[0], point[1]);
  });
  const shorelineEnds = Array.from({ length: 32 }, (_, index) => {
    const point = shoreline[(index + 1) % shoreline.length]!;
    return new Vector2(point[0], point[1]);
  });
  const reflector = new Reflector(geometry, {
    clipBias: 0.003,
    textureWidth: options.reflectionResolution,
    textureHeight: options.reflectionResolution,
    color: 0xc1d5d6,
    shader: ReflectivePoolShader,
  });
  const material = reflector.material as ShaderMaterial;
  const uniforms: Record<string, unknown> = {
    uDeepColor: new Color("#286572"),
    uShallowColor: new Color("#6eb0a4"),
    uSize: new Vector2(CLOUDBREAK_LAGOON.size[0], CLOUDBREAK_LAGOON.size[1]),
    uSunDirection: new Vector3(...CLOUDBREAK_SKY_SUN.direction).normalize(),
    uSunColor: defaults.sunColor.clone(),
    uRippleScale: 0.44,
    uRippleStrength: 0.075,
    uFoamWidth: 0.34,
    uFoamOpacity: 0.32,
    uShoreFade: 1.45,
    uWaveAmplitude: new Vector2(
      defaults.waveAmplitudeStart,
      defaults.waveAmplitudeEnd
    ),
    uShorelineCount: shoreline.length,
    uShorelineStarts: shorelineStarts,
    uShorelineEnds: shorelineEnds,
    uTime: 0,
  };
  for (const [key, value] of Object.entries(uniforms)) {
    if (material.uniforms[key]) material.uniforms[key]!.value = value;
  }
  reflector.name = "cloudbreak-reflective-lagoon";
  reflector.position.set(
    CLOUDBREAK_LAGOON.center[0],
    options.groundY +
      options.worldYOffset +
      CLOUDBREAK_LAYOUT.lagoon.surfaceY +
      0.035,
    CLOUDBREAK_LAGOON.center[1]
  );
  reflector.rotation.x = -Math.PI / 2;
  return reflector;
}

export function createCelestialCloudbreakWorld(
  options: CelestialCloudbreakOptions,
  assets: CelestialCloudbreakAssets
): CelestialCloudbreakWorld {
  const object = new Group();
  object.name = "celestial-cloudbreak-world";
  object.position.y = options.groundY + options.worldYOffset;

  const { root: shell, limestone } = prepareShell(assets.shell);
  const shellMirror = new Group();
  shellMirror.name = "cloudbreak-shell-mirror";
  shellMirror.scale.set(-1, 1, -1);
  shellMirror.add(shell);
  object.add(shellMirror);
  object.add(
    createSpatialStudy(options.stageRadius, options.stageRadiusGrowth),
    createLagoonEdge()
  );

  const waterfalls = [
    createWaterfall({
      position: [
        CLOUDBREAK_LAYOUT.lagoon.overflowXZ[0],
        -4.35,
        CLOUDBREAK_LAYOUT.lagoon.overflowXZ[1],
      ],
      width: 3.4,
      height: 9.2,
      rotationY: -1.2,
      crestDepth: 2.1,
      opacity: 1,
      speed: 1.08,
    }),
    createWaterfall({
      position: [-24, -1.1, -38.5],
      width: 3.2,
      height: 15.2,
      opacity: 0.68,
      speed: 0.76,
    }),
    createWaterfall({
      position: [25, -0.1, -45],
      width: 3.9,
      height: 18.4,
      opacity: 0.66,
      speed: 0.68,
    }),
    createWaterfall({
      position: [14, 2.9, -64.5],
      width: 2.4,
      height: 19.8,
      opacity: 0.6,
      speed: 0.61,
    }),
  ];
  object.add(...waterfalls.map(({ object: waterfall }) => waterfall));

  for (const placement of RUNTIME_PLACEMENTS) {
    const source = assets.placements.get(placement.asset.id);
    if (!source) {
      throw new Error(`Missing loaded Cloudbreak asset: ${placement.asset.id}`);
    }
    object.add(preparePlacement(source, placement, limestone));
  }

  const reflector = createReflector(options);
  let groundY = options.groundY;
  let disposed = false;
  return {
    object,
    reflector,
    update(deltaSeconds) {
      if (disposed) return;
      for (const waterfall of waterfalls) waterfall.update(deltaSeconds);
      const time = (reflector.material as ShaderMaterial).uniforms.uTime;
      if (time) time.value += deltaSeconds * 0.34;
    },
    pulse() {
      if (disposed) return;
      for (const waterfall of waterfalls) waterfall.pulse();
    },
    setGroundY(nextGroundY) {
      groundY = nextGroundY;
      object.position.y = groundY + options.worldYOffset;
      reflector.position.y =
        groundY +
        options.worldYOffset +
        CLOUDBREAK_LAYOUT.lagoon.surfaceY +
        0.035;
    },
    setActive(active) {
      object.visible = active;
      reflector.visible = active;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeCelestialObjectTree(object);
      reflector.getRenderTarget().dispose();
      (reflector.material as ShaderMaterial).dispose();
      (reflector.geometry as BufferGeometry).dispose();
    },
  };
}

/** The six exact runtime resources: panorama, shell, two olives, two rocks. */
export const CELESTIAL_AUTHORED_RESOURCE_COUNT = 6;
