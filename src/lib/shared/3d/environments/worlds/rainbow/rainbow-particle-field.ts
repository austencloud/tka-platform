import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Blending,
} from "three";
import type {
  ParticleRangeFalloff,
  ParticleType,
} from "../../domain/models/environment-models";

export type RainbowParticleShape =
  | "circle"
  | "diamond"
  | "petal"
  | "star"
  | "glow"
  | "snowflake"
  | "leaf";

export interface RainbowParticleFieldOptions {
  type: ParticleType;
  count: number;
  area: { width: number; height: number; depth: number };
  speed: number;
  colors: readonly string[];
  sizeRange: readonly [number, number];
  spin: boolean;
  opacity?: number;
  shape?: RainbowParticleShape;
  motionScale?: number;
  emissionShape?: "box" | "ellipse";
  buoyant?: boolean;
  rangeFalloff?: ParticleRangeFalloff;
  random?: () => number;
}

export interface RainbowParticleField {
  points: Points<BufferGeometry, ShaderMaterial>;
  update(deltaSeconds: number): void;
  dispose(): void;
}

interface Particle {
  position: Vector3;
  velocity: Vector3;
  rotation: number;
  rotationSpeed: number;
  size: number;
  colorIndex: number;
  swayPhase: number;
  swaySpeed: number;
  pulsePhase: number;
  pulseSpeed: number;
  baseSize: number;
  aspect: number;
}

interface ParticleBehavior {
  gravity: number;
  swayAmount: number;
  blending: Blending;
  shape: RainbowParticleShape;
  pulses: boolean;
}

const PARTICLE_BEHAVIORS: Readonly<Record<ParticleType, ParticleBehavior>> = {
  leaves: {
    gravity: 0.1,
    swayAmount: 0.2,
    blending: NormalBlending,
    shape: "leaf",
    pulses: false,
  },
  snow: {
    gravity: 0.075,
    swayAmount: 0.18,
    blending: AdditiveBlending,
    shape: "snowflake",
    pulses: false,
  },
  petals: {
    gravity: 0.06,
    swayAmount: 0.25,
    blending: NormalBlending,
    shape: "petal",
    pulses: false,
  },
  embers: {
    gravity: -0.125,
    swayAmount: 0.075,
    blending: AdditiveBlending,
    shape: "circle",
    pulses: false,
  },
  stars: {
    gravity: 0.025,
    swayAmount: 0.05,
    blending: AdditiveBlending,
    shape: "star",
    pulses: false,
  },
  bubbles: {
    gravity: -0.1,
    swayAmount: 0.125,
    blending: AdditiveBlending,
    shape: "circle",
    pulses: false,
  },
  fireflies: {
    gravity: 0,
    swayAmount: 0.15,
    blending: AdditiveBlending,
    shape: "glow",
    pulses: true,
  },
  dust: {
    gravity: 0.01,
    swayAmount: 0.3,
    blending: AdditiveBlending,
    shape: "circle",
    pulses: false,
  },
  smoke: {
    gravity: -0.04,
    swayAmount: 0.2,
    blending: AdditiveBlending,
    shape: "circle",
    pulses: false,
  },
  steam: {
    gravity: -0.18,
    swayAmount: 0.45,
    blending: AdditiveBlending,
    shape: "circle",
    pulses: false,
  },
};

const VERTEX_SHADER = /* glsl */ `
  attribute float size;
  attribute float rotation;
  attribute float colorIndex;
  attribute float aspect;

  uniform float uSubPixelFade;
  uniform vec2 uFadeRange;
  uniform vec2 uTintRange;

  varying float vRotation;
  varying float vColorIndex;
  varying float vAspect;
  varying float vRangeAlpha;
  varying float vRangeTint;

  void main() {
    vRotation = rotation;
    vColorIndex = colorIndex;
    vAspect = aspect;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float projected = size * (1000.0 / -mvPosition.z);
    gl_PointSize = projected;

    float subPixel = mix(1.0, clamp(projected, 0.0, 1.0), uSubPixelFade);
    float dist = -mvPosition.z;
    float fade = uFadeRange.y > uFadeRange.x
      ? 1.0 - smoothstep(uFadeRange.x, uFadeRange.y, dist)
      : 1.0;
    vRangeAlpha = subPixel * fade;
    vRangeTint = uTintRange.y > uTintRange.x
      ? smoothstep(uTintRange.x, uTintRange.y, dist)
      : 0.0;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColors[4];
  uniform float uShape;
  uniform float uOpacity;
  uniform vec3 uTintColor;

  varying float vRotation;
  varying float vColorIndex;
  varying float vAspect;
  varying float vRangeAlpha;
  varying float vRangeTint;

  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float c = cos(vRotation);
    float s = sin(vRotation);
    vec2 rotated = vec2(
      center.x * c - center.y * s,
      center.x * s + center.y * c
    );

    float dist = length(rotated);
    float alpha = 0.0;
    float shade = 1.0;

    if (uShape < 0.5) {
      alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    } else if (uShape < 1.5) {
      float diamond = abs(rotated.x) + abs(rotated.y);
      alpha = 1.0 - smoothstep(0.35, 0.5, diamond);
    } else if (uShape < 2.5) {
      float petal = dist + 0.3 * abs(rotated.x);
      alpha = 1.0 - smoothstep(0.3, 0.45, petal);
    } else if (uShape < 3.5) {
      float angle = atan(rotated.y, rotated.x);
      float star = dist * (1.0 + 0.3 * sin(angle * 5.0));
      alpha = 1.0 - smoothstep(0.25, 0.4, star);
    } else if (uShape < 4.5) {
      float core = 1.0 - smoothstep(0.0, 0.15, dist);
      float halo = (1.0 - smoothstep(0.1, 0.5, dist)) * 0.6;
      alpha = core + halo;
    } else if (uShape < 5.5) {
      float variant = floor(vColorIndex);
      float angle = atan(rotated.y, rotated.x);
      float shapeAlpha = 0.0;
      if (variant < 0.5) {
        float arms = cos(angle * 6.0);
        float detail = cos(angle * 12.0);
        float armMask = dist + (1.0 - arms) * 0.14 + (1.0 - detail) * 0.03;
        shapeAlpha = 1.0 - smoothstep(0.22, 0.42, armMask);
      } else if (variant < 1.5) {
        float arms = cos(angle * 8.0);
        float armMask = dist + (1.0 - arms) * 0.09;
        shapeAlpha = 1.0 - smoothstep(0.20, 0.36, armMask);
      } else if (variant < 2.5) {
        float spikes = max(0.0, cos(angle * 4.0) - 0.3);
        shapeAlpha = spikes * (1.0 - smoothstep(0.0, 0.32, dist)) * 1.2;
      } else {
        shapeAlpha = (1.0 - smoothstep(0.15, 0.38, dist)) * 0.65;
      }
      float core = 1.0 - smoothstep(0.0, 0.10, dist);
      alpha = min(shapeAlpha + core * 0.35, 1.0);
    } else {
      vec2 p = vec2(rotated.x / max(vAspect, 0.20), rotated.y);
      float along = clamp(p.y + 0.5, 0.0, 1.0);
      float blade = clamp((along - 0.14) / 0.86, 0.0, 1.0);
      float halfWidth = 0.30 * sin(pow(blade, 0.58) * 3.14159265);
      halfWidth *= 0.88 + 0.12 * cos(blade * 17.0);
      float aa = 0.018;
      float body =
        (1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(p.x))) *
        step(0.14, along);
      float stem =
        (1.0 - smoothstep(0.012, 0.028, abs(p.x))) *
        step(0.02, along) *
        (1.0 - step(0.18, along));
      alpha = clamp(body + stem, 0.0, 1.0);
      shade =
        mix(0.60, 1.14, smoothstep(0.0, 0.055, abs(p.x))) *
        mix(0.84, 1.08, blade);
    }

    if (alpha < 0.01) discard;
    int idx = int(floor(vColorIndex));
    vec3 color = uColors[min(idx, 3)] * shade;
    color = mix(color, uTintColor, vRangeTint);
    gl_FragColor = vec4(color, alpha * uOpacity * vRangeAlpha);
  }
`;

function shapeIndex(shape: RainbowParticleShape): number {
  return [
    "circle",
    "diamond",
    "petal",
    "star",
    "glow",
    "snowflake",
    "leaf",
  ].indexOf(shape);
}

function uniformColors(colors: readonly string[]): Color[] {
  const values = colors.slice(0, 4).map((color) => new Color(color));
  while (values.length < 4) values.push(values[0] ?? new Color("#ffffff"));
  return values;
}

export function createRainbowParticleField(
  options: RainbowParticleFieldOptions
): RainbowParticleField {
  const behavior = PARTICLE_BEHAVIORS[options.type];
  const random = options.random ?? Math.random;
  const motionScale = Math.max(0, options.motionScale ?? 1);
  const emissionShape = options.emissionShape ?? "box";
  const buoyant = options.buoyant ?? false;
  const particles: Particle[] = [];
  const velocity = new Vector3();

  function spawnParticle(): Particle {
    let x: number;
    let z: number;
    if (emissionShape === "ellipse") {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random());
      x = Math.cos(angle) * radius * options.area.width * 0.5;
      z = Math.sin(angle) * radius * options.area.depth * 0.5;
    } else {
      x = (random() - 0.5) * options.area.width;
      z = (random() - 0.5) * options.area.depth;
    }

    const firefly = options.type === "fireflies";
    const y = firefly
      ? (random() - 0.5) * options.area.height * 0.8
      : buoyant
        ? -options.area.height * 0.4 - random() * 0.25
        : options.area.height * 0.4 + random() * 0.25;
    const vx = firefly ? (random() - 0.5) * 0.025 : (random() - 0.5) * 0.05;
    const vy = firefly
      ? (random() - 0.5) * 0.015
      : buoyant
        ? options.speed * (0.5 + random() * 0.5)
        : -options.speed *
          (0.5 + random() * 0.5) *
          (options.type === "embers" ? -1 : 1);
    const vz = firefly ? (random() - 0.5) * 0.025 : (random() - 0.5) * 0.05;
    const baseSize =
      options.sizeRange[0] +
      random() * (options.sizeRange[1] - options.sizeRange[0]);

    return {
      position: new Vector3(x, y, z),
      velocity: new Vector3(vx, vy, vz),
      rotation: random() * Math.PI * 2,
      rotationSpeed: options.spin ? (random() - 0.5) * 3 : 0,
      size: baseSize,
      baseSize,
      colorIndex: Math.floor(random() * options.colors.length),
      swayPhase: random() * Math.PI * 2,
      swaySpeed: firefly ? 0.15 + random() * 0.25 : 1 + random() * 2,
      pulsePhase: random() * Math.PI * 2,
      pulseSpeed: firefly ? 0.2 + random() * 0.4 : 0.5 + random() * 1.5,
      aspect: 0.42 + random() * 0.55,
    };
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(new Float32Array(options.count * 3), 3)
  );
  geometry.setAttribute(
    "size",
    new Float32BufferAttribute(new Float32Array(options.count), 1)
  );
  geometry.setAttribute(
    "rotation",
    new Float32BufferAttribute(new Float32Array(options.count), 1)
  );
  geometry.setAttribute(
    "colorIndex",
    new Float32BufferAttribute(new Float32Array(options.count), 1)
  );
  geometry.setAttribute(
    "aspect",
    new Float32BufferAttribute(new Float32Array(options.count), 1)
  );

  const range = options.rangeFalloff;
  const material = new ShaderMaterial({
    uniforms: {
      uColors: { value: uniformColors(options.colors) },
      uShape: { value: shapeIndex(options.shape ?? behavior.shape) },
      uOpacity: { value: options.opacity ?? 1 },
      uSubPixelFade: { value: range?.subPixel ? 1 : 0 },
      uFadeRange: {
        value: new Vector2(range?.fade?.[0] ?? 0, range?.fade?.[1] ?? 0),
      },
      uTintRange: {
        value: new Vector2(range?.tint?.start ?? 0, range?.tint?.end ?? 0),
      },
      uTintColor: { value: new Color(range?.tint?.color ?? "#ffffff") },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    blending: behavior.blending,
    depthWrite: false,
    transparent: true,
  });

  for (let index = 0; index < options.count; index += 1) {
    const particle = spawnParticle();
    particle.position.y = (random() - 0.5) * options.area.height;
    particles.push(particle);
  }

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  let localTime = 0;

  function writeFrame(deltaSeconds: number): void {
    const delta = deltaSeconds * motionScale;
    localTime += delta;
    const firefly = options.type === "fireflies";
    const position = geometry.getAttribute(
      "position"
    ) as Float32BufferAttribute;
    const size = geometry.getAttribute("size") as Float32BufferAttribute;
    const rotation = geometry.getAttribute(
      "rotation"
    ) as Float32BufferAttribute;
    const color = geometry.getAttribute("colorIndex") as Float32BufferAttribute;
    const aspect = geometry.getAttribute("aspect") as Float32BufferAttribute;

    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index]!;
      if (behavior.gravity !== 0) {
        if (buoyant) {
          particle.velocity.y += Math.abs(behavior.gravity) * delta;
        } else {
          particle.velocity.y -=
            behavior.gravity * delta * (options.type === "embers" ? -1 : 1);
        }
      }

      const sway =
        Math.sin(localTime * particle.swaySpeed + particle.swayPhase) *
        behavior.swayAmount *
        delta;
      particle.position.x += sway;
      if (firefly) {
        particle.position.z +=
          Math.cos(localTime * particle.swaySpeed * 0.7 + particle.swayPhase) *
          behavior.swayAmount *
          delta *
          0.5;
      }
      particle.position.add(
        velocity.copy(particle.velocity).multiplyScalar(delta)
      );
      particle.rotation += particle.rotationSpeed * delta;

      if (firefly && behavior.pulses) {
        const pulse = Math.sin(
          localTime * particle.pulseSpeed + particle.pulsePhase
        );
        if (pulse > 0.5) {
          const raw = (pulse - 0.5) / 0.5;
          particle.size = particle.baseSize * raw * raw * (3 - 2 * raw);
        } else {
          particle.size = 0;
        }
      }

      if (
        particle.position.y < -options.area.height / 2 ||
        particle.position.y > options.area.height / 2 + 0.5 ||
        Math.abs(particle.position.x) > options.area.width / 2 ||
        Math.abs(particle.position.z) > options.area.depth / 2
      ) {
        const replacement = spawnParticle();
        Object.assign(particle, replacement);
        particle.position.copy(replacement.position);
        particle.velocity.copy(replacement.velocity);
      }

      position.setXYZ(
        index,
        particle.position.x,
        particle.position.y,
        particle.position.z
      );
      size.setX(index, particle.size);
      rotation.setX(index, particle.rotation);
      color.setX(index, particle.colorIndex);
      aspect.setX(index, particle.aspect);
    }

    position.needsUpdate = true;
    size.needsUpdate = true;
    rotation.needsUpdate = true;
    color.needsUpdate = true;
    aspect.needsUpdate = true;
  }

  writeFrame(0);

  return {
    points,
    update: writeFrame,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
