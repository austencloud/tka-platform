import {
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
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
  CLOUDBREAK_LAGOON,
  CLOUDBREAK_LAGOON_LOCAL_OUTLINE,
  CLOUDBREAK_LAYOUT,
  CLOUDBREAK_SKY_SUN,
} from "../../scenes/celestial/cloudbreak-layout";
import { disposeCelestialObjectTree } from "./celestial-disposal";

export interface CelestialCloudbreakAssets {
  shell: Object3D;
}

export interface CelestialCloudbreakOptions {
  groundY: number;
  stageRadius: number;
  stageRadiusGrowth: number;
  worldYOffset: number;
  reflectionResolution: number;
  motionScale?: number;
}

export interface CelestialCloudbreakWorld {
  object: Group;
  reflector: Reflector;
  update(deltaSeconds: number): void;
  pulse(): void;
  setGroundY(groundY: number): void;
  setStageBounds(radius: number, growth: number): void;
  setActive(active: boolean): void;
  dispose(): void;
}

interface WaterfallController {
  object: Group;
  update(deltaSeconds: number): void;
  pulse(): void;
}

function prepareShell(
  source: Object3D,
  options: CelestialCloudbreakOptions
): Object3D {
  const root = source.clone(true);
  root.name = "sunward-authored-gardens";
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.castShadow = !["ground", "mesa", "distant-olive"].includes(
      child.userData.sunwardRole
    );
    child.receiveShadow = true;
    const cloneMaterial = (material: Material) => material.clone();
    child.material = Array.isArray(child.material)
      ? child.material.map(cloneMaterial)
      : cloneMaterial(child.material);
    if (child.userData.sunwardRole === "court") {
      const radius = resolveCircularStageRadius(
        options.stageRadius,
        6.08,
        { x: 0, z: -1 },
        options.stageRadiusGrowth
      );
      child.scale.x *= radius / 6.08;
      child.scale.z *= radius / 6.08;
    }
  });
  return root;
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
  if (bounds && uv && positions) {
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

  object.add(prepareShell(assets.shell, options));

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
      position: [-27, -0.65, -35.7],
      width: 3.2,
      height: 15.2,
      opacity: 0.68,
      speed: 0.76,
    }),
    createWaterfall({
      position: [28, 0.25, -43.9],
      width: 3.9,
      height: 18.4,
      opacity: 0.66,
      speed: 0.68,
    }),
    createWaterfall({
      position: [12, 3.55, -65.9],
      width: 2.4,
      height: 19.8,
      opacity: 0.6,
      speed: 0.61,
    }),
  ];
  object.add(...waterfalls.map(({ object: waterfall }) => waterfall));

  const reflector = createReflector(options);
  let groundY = options.groundY;
  let disposed = false;
  return {
    object,
    reflector,
    update(deltaSeconds) {
      if (disposed) return;
      deltaSeconds *= options.motionScale ?? 1;
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
    setStageBounds(radius, growth) {
      const scale =
        resolveCircularStageRadius(radius, 6.08, { x: 0, z: -1 }, growth) /
        6.08;
      object.traverse((child) => {
        if (child.userData.sunwardRole === "court")
          child.scale.set(scale, 1, scale);
      });
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

/** The panorama and complete Blender-authored garden. */
export const CELESTIAL_AUTHORED_RESOURCE_COUNT = 2;
