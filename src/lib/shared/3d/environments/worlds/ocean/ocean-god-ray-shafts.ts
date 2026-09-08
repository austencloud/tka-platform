import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";
import { OCEAN_WATER_DEPTH_METERS } from "../../domain/models/ocean-water-depth";
import fragmentShader from "../../scenes/ocean/shaders/atmosphere/god-ray.frag?raw";
import vertexShader from "../../scenes/ocean/shaders/atmosphere/god-ray.vert?raw";
import {
  HERO_TARGET_XZ,
  LEAN,
  LEAN_AXIS,
  SHAFT_HEIGHT,
  shaftCentreForTarget,
} from "../../scenes/ocean/runtime/atmosphere/god-ray-axis";

const COUNT = 14;
const INTENSITY = 0.42;
const WIDTH = 3.5;
const HEIGHT = SHAFT_HEIGHT;
const SPEED = 0.3;
const HERO_WIDTH_SCALE = 1.5;
const HERO_OPACITY = 1;
const SUPPORT_RADIUS_MIN = 7.5;
const SUPPORT_RADIUS_MAX = 15;
const SUPPORT_OPACITY_MIN = 0.1;
const SUPPORT_OPACITY_MAX = 0.2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface OceanGodRayShaftsOptions {
  groundY: number;
  worldYOffset?: number;
  enabled?: boolean;
}

export interface OceanGodRayShaftsWorld {
  object: InstancedMesh<PlaneGeometry, ShaderMaterial>;
  update(deltaSeconds: number): void;
  setGroundY(groundY: number, worldYOffset?: number): void;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

export function createOceanGodRayShafts(
  options: OceanGodRayShaftsOptions
): OceanGodRayShaftsWorld {
  const material = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColorTop: { value: new Color("#ffffdd") },
      uColorBottom: { value: new Color("#bcd6e6") },
      uIntensity: { value: options.enabled === false ? 0 : INTENSITY },
      uHeight: { value: HEIGHT },
      uGroundY: {
        value: options.groundY + (options.worldYOffset ?? 0),
      },
    },
    vertexShader,
    fragmentShader,
  });
  const geometry = new PlaneGeometry(WIDTH, HEIGHT);
  const object = new InstancedMesh(geometry, material, COUNT);
  object.name = "ocean-god-ray-shafts";
  object.frustumCulled = false;

  const opacities = new Float32Array(COUNT);
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const spin = new Quaternion();
  const lean = new Quaternion();
  const scale = new Vector3(1, 1, 1);
  const position = new Vector3();
  const euler = new Euler();

  function writeMatrices(groundY: number): void {
    const random = seededRandom(777);
    for (let index = 0; index < COUNT; index += 1) {
      const hero = index === 0;
      let rotationY: number;
      let widthScale: number;
      let leanJitter: number;

      if (hero) {
        rotationY = 0;
        widthScale = HERO_WIDTH_SCALE;
        leanJitter = 0;
        position.copy(
          shaftCentreForTarget(groundY, HERO_TARGET_XZ.x, HERO_TARGET_XZ.z)
        );
        opacities[index] = HERO_OPACITY;
      } else {
        const t = (index - 1) / (COUNT - 2);
        const angle = (index - 1) * GOLDEN_ANGLE;
        const radius =
          SUPPORT_RADIUS_MIN +
          t * (SUPPORT_RADIUS_MAX - SUPPORT_RADIUS_MIN) +
          (random() - 0.5) * 2.5;
        rotationY = random() * Math.PI * 2;
        widthScale = 0.5 + random() * 0.8;
        leanJitter = (random() - 0.5) * 0.08;
        opacities[index] =
          SUPPORT_OPACITY_MIN +
          random() * (SUPPORT_OPACITY_MAX - SUPPORT_OPACITY_MIN);
        position.set(
          Math.cos(angle) * radius,
          groundY + OCEAN_WATER_DEPTH_METERS - HEIGHT * 0.5,
          Math.sin(angle) * radius
        );
      }

      euler.set(0, rotationY, 0);
      spin.setFromEuler(euler);
      lean.setFromAxisAngle(LEAN_AXIS, LEAN + leanJitter);
      quaternion.copy(lean).multiply(spin);
      scale.set(widthScale, 1, 1);
      matrix.compose(position, quaternion, scale);
      object.setMatrixAt(index, matrix);
    }
    object.instanceMatrix.needsUpdate = true;
  }

  writeMatrices(options.groundY);
  geometry.setAttribute(
    "aOpacityMult",
    new InstancedBufferAttribute(opacities, 1)
  );

  return {
    object,
    update(deltaSeconds) {
      material.uniforms.uTime!.value += deltaSeconds * SPEED * 5;
    },
    setGroundY(groundY, worldYOffset = 0) {
      writeMatrices(groundY);
      material.uniforms.uGroundY!.value = groundY + worldYOffset;
    },
    setEnabled(enabled) {
      material.uniforms.uIntensity!.value = enabled ? INTENSITY : 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
