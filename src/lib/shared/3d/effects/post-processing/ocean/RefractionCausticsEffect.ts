import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Uniform, Vector3 } from "three";

const fragmentShader = /* glsl */ `
uniform float causticsScale;
uniform float causticsSpeed;
uniform float causticsIntensity;
uniform float chromaticSpread;
uniform vec3 lightDir;

// Voronoi-based caustic pattern with temporal animation
vec2 hash22(vec2 p) {
  return fract(sin(vec2(
    dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3))
  )) * 43758.5453);
}

float voronoiCaustic(vec2 p, float t) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float md = 8.0;
  float md2 = 8.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 n = vec2(float(x), float(y));
      vec2 o = hash22(i + n);
      o = 0.5 + 0.5 * sin(t + 6.2831 * o);
      vec2 r = n + o - f;
      float d = dot(r, r);
      if (d < md) {
        md2 = md;
        md = d;
      } else if (d < md2) {
        md2 = d;
      }
    }
  }

  // Edge detection between Voronoi cells creates caustic lines
  return smoothstep(0.0, 0.05, md2 - md);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float depth = readDepth(uv);
  float linearDepth = depth * 50.0;

  // Caustics strongest near surfaces (shallow depth), fade at distance
  float depthFade = exp(-linearDepth * 0.08);

  // Project UVs along light direction for caustic coordinates
  vec2 causticsUv = uv * causticsScale;
  float t = time * causticsSpeed;

  // Chromatic aberration: sample caustics at slightly offset scales per channel
  float causticR = voronoiCaustic(causticsUv * (1.0 - chromaticSpread), t);
  float causticG = voronoiCaustic(causticsUv, t * 1.05);
  float causticB = voronoiCaustic(causticsUv * (1.0 + chromaticSpread), t * 0.95);

  // Second octave for richer pattern
  float caustic2R = voronoiCaustic(causticsUv * 1.8 - chromaticSpread * 0.5, t * 0.7);
  float caustic2G = voronoiCaustic(causticsUv * 1.8, t * 0.75);
  float caustic2B = voronoiCaustic(causticsUv * 1.8 + chromaticSpread * 0.5, t * 0.65);

  vec3 caustics = vec3(
    min(causticR, caustic2R),
    min(causticG, caustic2G),
    min(causticB, caustic2B)
  );

  // Boost and shape the caustic pattern
  caustics = pow(caustics, vec3(0.5)) * causticsIntensity;

  vec3 result = inputColor.rgb + caustics * depthFade;
  outputColor = vec4(result, inputColor.a);
}
`;

export interface RefractionCausticsOptions {
  blendFunction?: BlendFunction;
  scale?: number;
  speed?: number;
  intensity?: number;
  chromaticSpread?: number;
  lightDirection?: Vector3;
}

export class RefractionCausticsEffect extends Effect {
  constructor({
    blendFunction = BlendFunction.NORMAL,
    scale = 8.0,
    speed = 0.4,
    intensity = 0.15,
    chromaticSpread = 0.04,
    lightDirection = new Vector3(0.3, -1.0, 0.2),
  }: RefractionCausticsOptions = {}) {
    super("RefractionCausticsEffect", fragmentShader, {
      blendFunction,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ["causticsScale", new Uniform(scale)],
        ["causticsSpeed", new Uniform(speed)],
        ["causticsIntensity", new Uniform(intensity)],
        ["chromaticSpread", new Uniform(chromaticSpread)],
        ["lightDir", new Uniform(lightDirection.clone().normalize())],
      ]),
    });
  }

  get causticsIntensity(): number {
    return this.uniforms.get("causticsIntensity")!.value as number;
  }

  set causticsIntensity(v: number) {
    this.uniforms.get("causticsIntensity")!.value = v;
  }

  get causticsScale(): number {
    return this.uniforms.get("causticsScale")!.value as number;
  }

  set causticsScale(v: number) {
    this.uniforms.get("causticsScale")!.value = v;
  }

  get causticsSpeed(): number {
    return this.uniforms.get("causticsSpeed")!.value as number;
  }

  set causticsSpeed(v: number) {
    this.uniforms.get("causticsSpeed")!.value = v;
  }
}
