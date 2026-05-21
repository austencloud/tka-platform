import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Uniform, Vector3 } from "three";

const fragmentShader = /* glsl */ `
uniform vec3 absorptionCoeff;
uniform vec3 scatterColor;
uniform float maxDepth;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float depth = readDepth(uv);
  float linearDepth = depth * maxDepth;

  // Beer-Lambert per-channel absorption — red dies first
  vec3 transmittance = exp(-absorptionCoeff * linearDepth);

  // In-scattering: water column glows faintly toward scatter color
  vec3 inScatter = scatterColor * (1.0 - transmittance);

  vec3 absorbed = inputColor.rgb * transmittance + inScatter;
  outputColor = vec4(absorbed, inputColor.a);
}
`;

export interface WaterAbsorptionOptions {
  blendFunction?: BlendFunction;
  absorptionR?: number;
  absorptionG?: number;
  absorptionB?: number;
  scatterColor?: Vector3;
  maxDepth?: number;
}

export class WaterAbsorptionEffect extends Effect {
  constructor({
    blendFunction = BlendFunction.NORMAL,
    absorptionR = 0.45,
    absorptionG = 0.07,
    absorptionB = 0.02,
    scatterColor = new Vector3(0.0, 0.05, 0.1),
    maxDepth = 50.0,
  }: WaterAbsorptionOptions = {}) {
    super("WaterAbsorptionEffect", fragmentShader, {
      blendFunction,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ["absorptionCoeff", new Uniform(new Vector3(absorptionR, absorptionG, absorptionB))],
        ["scatterColor", new Uniform(scatterColor.clone())],
        ["maxDepth", new Uniform(maxDepth)],
      ]),
    });
  }

  get absorptionCoeff(): Vector3 {
    return this.uniforms.get("absorptionCoeff")!.value as Vector3;
  }

  set absorptionCoeff(v: Vector3) {
    (this.uniforms.get("absorptionCoeff")!.value as Vector3).copy(v);
  }

  get maxDepth(): number {
    return this.uniforms.get("maxDepth")!.value as number;
  }

  set maxDepth(v: number) {
    this.uniforms.get("maxDepth")!.value = v;
  }

  get scatterColor(): Vector3 {
    return this.uniforms.get("scatterColor")!.value as Vector3;
  }

  set scatterColor(v: Vector3) {
    (this.uniforms.get("scatterColor")!.value as Vector3).copy(v);
  }
}
