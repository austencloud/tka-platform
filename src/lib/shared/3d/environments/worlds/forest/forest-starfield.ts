import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
} from "three";
import type { StarfieldConfig } from "../../domain/models/scene-configs";

export interface ForestStarfield {
  object: Points<BufferGeometry, ShaderMaterial>;
  update(deltaSeconds: number): void;
  dispose(): void;
}

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aBrightness;
  uniform float uTime;
  uniform float uTwinkleSpeed;
  uniform float uIntensity;
  varying float vBrightness;
  varying float vTwinkle;

  void main() {
    vBrightness = aBrightness * uIntensity;
    vTwinkle = 0.6 + 0.4 * sin(uTime * uTwinkleSpeed + aPhase);
    mat4 rotationalView = mat4(mat3(viewMatrix));
    vec4 mvPos = rotationalView * vec4(position, 1.0);
    gl_PointSize = aSize * vTwinkle * (600.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  const vec3 CORE_COLOR = vec3(1.0, 0.97, 0.90);
  const vec3 HALO_COLOR = vec3(0.75, 0.85, 1.0);
  varying float vBrightness;
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    float core = 1.0 - smoothstep(0.0, 0.15, dist);
    float halo = 1.0 - smoothstep(0.1, 0.5, dist);
    halo = pow(halo, 2.5);
    if (halo < 0.01) discard;
    vec3 color = mix(HALO_COLOR, CORE_COLOR, core);
    float alpha = (core + halo * 0.6) * vBrightness * vTwinkle;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

/** Exact renderer-neutral extraction of Forest's production star field. */
export function createForestStarfield(
  config: StarfieldConfig,
  motionScale = 1,
  random: () => number = Math.random
): ForestStarfield {
  const count = config.count;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const brightnesses = new Float32Array(count);
  const magnitudeFalloff = config.magnitudeFalloff ?? 3;
  const brightnessFloor = config.brightnessFloor ?? 0.3;
  const horizonSpread = config.horizonSpread ?? 0.6;
  const intensity = config.intensity ?? 1;

  for (let index = 0; index < count; index += 1) {
    const theta = random() * Math.PI * 2;
    if (config.elevationRangeDegrees) {
      const [minimum, maximum] = config.elevationRangeDegrees;
      const elevation =
        ((minimum + random() * (maximum - minimum)) * Math.PI) / 180;
      const horizontalRadius = config.radius * Math.cos(elevation);
      positions[index * 3] = horizontalRadius * Math.cos(theta);
      positions[index * 3 + 1] = config.radius * Math.sin(elevation);
      positions[index * 3 + 2] = horizontalRadius * Math.sin(theta);
    } else {
      const phi = Math.acos(2 * random() - 1) * horizonSpread;
      const sinPhi = Math.sin(phi);
      positions[index * 3] = config.radius * sinPhi * Math.cos(theta);
      positions[index * 3 + 1] = config.radius * Math.cos(phi);
      positions[index * 3 + 2] = config.radius * sinPhi * Math.sin(theta);
    }
    const magnitude = random() ** magnitudeFalloff;
    sizes[index] =
      config.sizeRange[0] +
      magnitude * (config.sizeRange[1] - config.sizeRange[0]);
    brightnesses[index] = brightnessFloor + magnitude * (1 - brightnessFloor);
    phases[index] = random() * Math.PI * 2;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new Float32BufferAttribute(phases, 1));
  geometry.setAttribute(
    "aBrightness",
    new Float32BufferAttribute(brightnesses, 1)
  );
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTwinkleSpeed: { value: config.twinkleSpeed },
      uIntensity: { value: intensity },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const object = new Points(geometry, material);
  object.name = "forest-starfield";
  object.frustumCulled = false;
  object.visible = config.enabled;
  let elapsed = 0;
  let disposed = false;

  return {
    object,
    update(deltaSeconds) {
      if (disposed || !config.enabled) return;
      elapsed += deltaSeconds * motionScale;
      material.uniforms.uTime!.value = elapsed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      material.dispose();
    },
  };
}
