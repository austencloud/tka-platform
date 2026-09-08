import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  ShapeGeometry,
  type MeshPhysicalMaterial,
  type Texture,
} from "three";

import { createOrganicPondShape } from "../../primitives/organic-pond-shape";
import { AUTUMN_MOON_DIRECTION } from "../../scenes/autumn/runtime/lighting/autumn-moon";
import { AUTUMN_POND_LAYOUT } from "../../scenes/autumn/runtime/water/autumn-pond-layout";
import {
  createAutumnPondNormalMap,
  createAutumnPondSurfaceMaterial,
} from "../../scenes/autumn/runtime/water/autumn-pond-surface-material";

export interface AutumnPond {
  object: Group;
  update(deltaSeconds: number): void;
  setGroundY(groundY: number): void;
  setMotionScale(scale: number): void;
  setActive(active: boolean): void;
  dispose(): void;
}

const GLINT_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLINT_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float across = 1.0 - smoothstep(0.0, 0.20, abs(p.x));
    float along = 1.0 - smoothstep(0.0, 0.44, abs(p.y));
    across *= across * across;
    along *= along * along;
    float bands = 0.78 + 0.22 * sin(p.y * 21.0 + uTime * 1.1);
    float alpha = across * along * bands * uStrength;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function configureWaterNormal(texture: Texture, repeat: number): void {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
}

/** Exact renderer-neutral form of AutumnPond. */
export function createAutumnPond(options: {
  groundY: number;
  motionScale?: number;
  position?: readonly [number, number, number];
  radiusX?: number;
  radiusZ?: number;
  seed?: number;
  waterLevelOffset?: number;
}): AutumnPond {
  const position = options.position ?? [
    AUTUMN_POND_LAYOUT.centerX,
    options.groundY,
    AUTUMN_POND_LAYOUT.centerZ,
  ];
  const radiusX = options.radiusX ?? AUTUMN_POND_LAYOUT.radiusX;
  const radiusZ = options.radiusZ ?? AUTUMN_POND_LAYOUT.radiusZ;
  const seed = options.seed ?? AUTUMN_POND_LAYOUT.seed;
  const waterLevelOffset =
    options.waterLevelOffset ?? AUTUMN_POND_LAYOUT.waterLevelOffset;
  const root = new Group();
  root.name = "autumn-pond";

  const surfaceGeometry = new ShapeGeometry(
    createOrganicPondShape({ radiusX, radiusZ, seed }),
    48
  );
  const bodyNormal = createAutumnPondNormalMap({ seed: seed + 11 });
  const coatNormal = createAutumnPondNormalMap({ seed: seed + 37 });
  configureWaterNormal(bodyNormal, 3.6);
  configureWaterNormal(coatNormal, 5.2);
  coatNormal.center.set(0.5, 0.5);
  coatNormal.rotation = 0.42;
  const surfaceMaterial: MeshPhysicalMaterial = createAutumnPondSurfaceMaterial(
    bodyNormal,
    coatNormal
  );
  const surface = new Mesh(surfaceGeometry, surfaceMaterial);
  surface.name = "autumn-pond-surface";
  surface.rotation.x = -Math.PI / 2;
  surface.renderOrder = 80;

  const glintGeometry = new PlaneGeometry(radiusX * 0.34, radiusZ * 1.15);
  const glintMaterial = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color("#cddcff") },
      uStrength: { value: 0.055 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: GLINT_VERTEX_SHADER,
    fragmentShader: GLINT_FRAGMENT_SHADER,
  });
  const glint = new Mesh(glintGeometry, glintMaterial);
  glint.name = "autumn-pond-moon-glint";
  glint.rotation.x = -Math.PI / 2;
  glint.rotation.z = Math.atan2(
    AUTUMN_MOON_DIRECTION[0],
    AUTUMN_MOON_DIRECTION[2]
  );
  glint.renderOrder = 81;
  root.add(surface, glint);

  let groundY = options.groundY;
  let motionScale = Math.max(0, options.motionScale ?? 1);
  let elapsed = 0;
  let disposed = false;
  function place(): void {
    const pondY = (position[1] ?? groundY) + waterLevelOffset;
    root.position.set(position[0], pondY, position[2]);
    glint.position.y = 0.012;
  }
  place();

  return {
    object: root,
    update(deltaSeconds) {
      if (disposed || !root.visible) return;
      const scaled = deltaSeconds * motionScale;
      bodyNormal.offset.x = (bodyNormal.offset.x + scaled * 0.0045) % 1;
      bodyNormal.offset.y = (bodyNormal.offset.y + scaled * 0.0022) % 1;
      coatNormal.offset.x = (coatNormal.offset.x - scaled * 0.0031 + 1) % 1;
      coatNormal.offset.y = (coatNormal.offset.y + scaled * 0.0048) % 1;
      elapsed += scaled;
      glintMaterial.uniforms.uTime!.value = elapsed;
    },
    setGroundY(nextGroundY) {
      if (disposed || nextGroundY === groundY) return;
      const delta = nextGroundY - groundY;
      groundY = nextGroundY;
      root.position.y += delta;
    },
    setMotionScale(scale) {
      motionScale = Number.isFinite(scale) ? Math.max(0, scale) : 1;
    },
    setActive(active) {
      root.visible = active;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      surfaceGeometry.dispose();
      surfaceMaterial.dispose();
      bodyNormal.dispose();
      coatNormal.dispose();
      glintGeometry.dispose();
      glintMaterial.dispose();
      root.clear();
    },
  };
}
