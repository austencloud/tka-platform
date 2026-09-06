import { Color, PlaneGeometry, Vector2, type ShaderMaterial } from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { ReflectivePoolShader } from "../../primitives/reflective-pool-shader";

/** The shared water optics reflect the actual pavilion, including its moving sails. */
export function createRainbowLake(resolution: number): Reflector {
  const lake = new Reflector(new PlaneGeometry(560, 480), {
    textureWidth: resolution,
    textureHeight: resolution,
    clipBias: 0.003,
    color: 0xa5b8cb,
    shader: ReflectivePoolShader,
    multisample: 0,
  });
  lake.name = "rainbow-lake";
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(0, -0.19, -70);
  const uniforms = (lake.material as ShaderMaterial).uniforms;
  const values = {
    uDeepColor: new Color("#071821"),
    uShallowColor: new Color("#102c32"),
    uSize: new Vector2(560, 480),
    uSunColor: new Color("#000000"),
    uRippleScale: 0.8,
    uRippleStrength: 0.05,
    uFoamOpacity: 0,
    uShorelineCount: 0,
    uWaveAmplitude: new Vector2(0.2, 0.2),
  };
  for (const [key, value] of Object.entries(values)) {
    if (uniforms[key]) uniforms[key].value = value;
  }
  return lake;
}
