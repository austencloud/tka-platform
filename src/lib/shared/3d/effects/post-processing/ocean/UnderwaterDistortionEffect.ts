import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Uniform } from "three";

const fragmentShader = /* glsl */ `
uniform float strength;
uniform float frequency;
uniform float speed;
uniform float maxDepth;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // UV-based depth approximation — avoids reading the depth buffer which
  // causes a framebuffer feedback loop on even-numbered EffectPasses.
  float depthFactor = smoothstep(0.0, 0.7, 1.0 - uv.y);

  // Animated 2D noise for organic underwater ripple
  float t = time * speed;
  float nx = sin(uv.y * frequency + t * 0.7) * cos(uv.x * frequency * 0.8 + t * 0.3);
  float ny = cos(uv.x * frequency + t * 0.5) * sin(uv.y * frequency * 1.2 - t * 0.6);

  // Second octave for organic feel
  nx += sin(uv.y * frequency * 2.3 + t * 1.1) * 0.5;
  ny += cos(uv.x * frequency * 1.9 - t * 0.9) * 0.5;

  vec2 offset = vec2(nx, ny) * strength * depthFactor;

  // Clamp to prevent sampling outside viewport
  vec2 distortedUv = clamp(uv + offset, vec2(0.0), vec2(1.0));

  outputColor = texture(inputBuffer, distortedUv);
}
`;

export interface UnderwaterDistortionOptions {
  blendFunction?: BlendFunction;
  strength?: number;
  frequency?: number;
  speed?: number;
  maxDepth?: number;
}

export class UnderwaterDistortionEffect extends Effect {
  constructor({
    blendFunction = BlendFunction.NORMAL,
    strength = 0.003,
    frequency = 12.0,
    speed = 0.8,
    maxDepth = 100.0,
  }: UnderwaterDistortionOptions = {}) {
    super("UnderwaterDistortionEffect", fragmentShader, {
      blendFunction,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ["strength", new Uniform(strength)],
        ["frequency", new Uniform(frequency)],
        ["speed", new Uniform(speed)],
        ["maxDepth", new Uniform(maxDepth)],
      ]),
    });
  }

  get strength(): number {
    return this.uniforms.get("strength")!.value as number;
  }

  set strength(v: number) {
    this.uniforms.get("strength")!.value = v;
  }

  get frequency(): number {
    return this.uniforms.get("frequency")!.value as number;
  }

  set frequency(v: number) {
    this.uniforms.get("frequency")!.value = v;
  }

  get speed(): number {
    return this.uniforms.get("speed")!.value as number;
  }

  set speed(v: number) {
    this.uniforms.get("speed")!.value = v;
  }
}
