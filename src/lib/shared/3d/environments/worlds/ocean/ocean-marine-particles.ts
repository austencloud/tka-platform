import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import fragmentShader from "../../scenes/ocean/shaders/atmosphere/particle.frag?raw";
import vertexShader from "../../scenes/ocean/shaders/atmosphere/particle.vert?raw";

const AREA_WIDTH = 30;
const AREA_HEIGHT = 10;
const AREA_DEPTH = 30;
const CURRENT_DIRECTION: [number, number, number] = [0.02, -0.003, 0.01];

export interface OceanMarineParticlesOptions {
  count?: number;
  groundY?: number;
  random?: () => number;
}

export interface OceanMarineParticlesWorld {
  object: Points<BufferGeometry, ShaderMaterial>;
  update(deltaSeconds: number): void;
  setGroundY(groundY: number): void;
  dispose(): void;
}

export function createOceanMarineParticles(
  options: OceanMarineParticlesOptions = {}
): OceanMarineParticlesWorld {
  const count = options.count ?? 4000;
  const random = options.random ?? Math.random;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (random() - 0.5) * AREA_WIDTH;
    positions[index * 3 + 1] = Math.pow(random(), 2.5) * AREA_HEIGHT;
    positions[index * 3 + 2] = (random() - 0.5) * AREA_DEPTH;
    phases[index] = random() * 6.2832;
    sizes[index] = 0.015 + random() * 0.045;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aPhase", new Float32BufferAttribute(phases, 1));
  geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCurrentDir: { value: new Vector3(...CURRENT_DIRECTION) },
      uAreaWidth: { value: AREA_WIDTH },
      uAreaHeight: { value: AREA_HEIGHT },
      uAreaDepth: { value: AREA_DEPTH },
    },
    vertexShader,
    fragmentShader,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    transparent: true,
  });

  const object = new Points(geometry, material);
  object.name = "ocean-marine-particles";
  object.position.y = options.groundY ?? 0;
  object.frustumCulled = false;

  return {
    object,
    update(deltaSeconds) {
      material.uniforms.uTime!.value += deltaSeconds;
    },
    setGroundY(groundY) {
      object.position.y = groundY;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
