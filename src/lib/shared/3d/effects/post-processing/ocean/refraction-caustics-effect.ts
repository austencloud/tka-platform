import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Matrix4, Uniform, Vector3, type Camera } from "three";

// World-space refraction caustics.
//
// Caustics are reconstructed from the depth buffer into WORLD space and sampled
// in world XZ (projected along the sun's `lightDir`). That anchors the pattern
// to the seabed/world surfaces, so it no longer swims across geometry as the
// camera orbits — the classic "fake screen-space caustics" tell. The Voronoi
// F1/F2 chromatic math and the depth-based falloff are preserved.
//
// The EffectMaterial prelude (postprocessing v6) gives us inside `mainImage`:
//   readDepth(uv) -> orthographic-normalized depth [0,1]
//   getViewZ(depth) -> view-space Z (negative, perspective)
//   cameraNear / cameraFar / vUv / time
// It does NOT expose projectionMatrixInverse or the camera world matrix to a
// wrapped Effect, so we add those as our own uniforms and feed them per-frame
// from the main camera (captured via the `mainCamera` setter the EffectPass
// drives, refreshed in `update`).
const fragmentShader = /* glsl */ `
uniform float causticsScale;
uniform float causticsSpeed;
uniform float causticsIntensity;
uniform float chromaticSpread;
uniform vec3 lightDir;
uniform mat4 invProjection;
uniform mat4 cameraMatrixWorld;

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

// Reconstruct the world-space position of the surface under this pixel.
vec3 reconstructWorldPos(vec2 uv, float depth) {
  // Screen uv + non-linear depth -> clip space.
  vec4 clip = vec4(vec3(uv, depth) * 2.0 - 1.0, 1.0);
  // Clip -> view (perspective divide via the projection inverse).
  vec4 view = invProjection * clip;
  view /= view.w;
  // View -> world.
  return (cameraMatrixWorld * view).xyz;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float depth = readDepth(uv);
  float linearDepth = depth * 50.0;

  // Caustics strongest near surfaces (shallow depth), fade at distance
  float depthFade = exp(-linearDepth * 0.08);

  // World position of the lit surface beneath this pixel.
  vec3 worldPos = reconstructWorldPos(uv, depth);

  // Project the world point along the sun direction onto a horizontal plane so
  // the caustic coordinate is the seabed footprint of the light shaft. This is
  // what stops the pattern from sliding with the camera. lightDir points DOWN
  // (negative Y); guard the divide so a near-horizontal sun can't blow up.
  float ly = min(lightDir.y, -0.05);
  vec3 projected = worldPos - lightDir * (worldPos.y / ly);

  // Sample in world XZ. Scale tuned so the previous on-screen density holds.
  vec2 causticsUv = projected.xz * (causticsScale * 0.12);
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
  private _camera: Camera | null = null;

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
        ["invProjection", new Uniform(new Matrix4())],
        ["cameraMatrixWorld", new Uniform(new Matrix4())],
      ]),
    });
  }

  // The EffectPass drives this setter every frame with the composer's main
  // camera (ScenePostProcessing calls composer.setMainCamera). We capture it so
  // `update` can pull fresh matrices for world-space reconstruction.
  override set mainCamera(camera: Camera) {
    this._camera = camera;
  }

  // Runs once per frame before the pass renders. Refresh the projection inverse
  // and camera world matrix so the depth->world reconstruction tracks the
  // current view.
  override update(): void {
    const camera = this._camera;
    if (!camera) return;
    (this.uniforms.get("invProjection")!.value as Matrix4).copy(
      camera.projectionMatrixInverse,
    );
    (this.uniforms.get("cameraMatrixWorld")!.value as Matrix4).copy(
      camera.matrixWorld,
    );
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
