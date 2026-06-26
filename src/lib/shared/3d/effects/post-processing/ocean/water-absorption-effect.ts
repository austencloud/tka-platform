import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Uniform, Vector3 } from "three";

const fragmentShader = /* glsl */ `
uniform vec3 absorptionCoeff;
uniform vec3 scatterColor;
uniform float maxDepth;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // readDepth() returns the RAW, non-linear perspective depth — it sits at
  // ~0.95-0.999 for nearly everything past the near plane. The old
  // 'depth * maxDepth' treated that as linear distance, so almost every pixel
  // got max-distance absorption and the whole frame (foreground included) was
  // crushed to the blue scatter colour instead of grading by depth.
  // getViewZ()/cameraNear/cameraFar are provided by the EffectPass shader;
  // -viewZ is the true distance from the camera in world units. Clamp to
  // maxDepth so the far field saturates predictably rather than at cameraFar.
  float rawDepth = readDepth(uv);
  float linearDepth = min(-getViewZ(rawDepth), maxDepth);

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
