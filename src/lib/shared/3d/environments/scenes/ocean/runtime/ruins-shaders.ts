import {
  Color,
  DoubleSide,
  MeshStandardMaterial,
  Vector2,
  type WebGLProgramParametersWithUniforms,
} from "three";

// The procedural weathered-limestone look for the ruins dais, injected into a
// MeshStandardMaterial through onBeforeCompile rather than authored as a raw
// ShaderMaterial.
//
// That distinction is the whole point. The dais previously ran three hand-
// written ShaderMaterials that ended in `gl_FragColor = vec4(stone, 1.0)`:
// no lights, no fog, no tone mapping, no output colour conversion. It was the
// only surface in the scene that did not participate in the lighting pass the
// Fathom gates spent two rounds tuning, so it read as a flat cut-out pasted in
// front of the water -- "the stage looks remarkably washed out". A slab that
// ignores the key spot has no form, and one that ignores fog never recedes.
//
// Patching a standard material keeps every procedural detail (fbm stone,
// moss gradient, voronoi crack network, the breathing bioluminescence) while
// the renderer supplies the parts a shader should never re-derive by hand.
// Mirrors patchCausticsMaterial in atmosphere/seabed-caustics.ts, including
// chaining any prior onBeforeCompile, so the deck can wear caustics too.

export interface RuinsShaderConfig {
  stoneColor: string;
  runeGlowColor: string;
  glowIntensity: number;
  mossIntensity: number;
}

interface DaisUniforms {
  uDaisTime: { value: number };
  uStoneColor: { value: Color };
  uMossIntensity: { value: number };
  uBioGlowColor: { value: Color };
  uGlowIntensity: { value: number };
  uDaisSize: { value: Vector2 };
}

// Helpers are prefixed because they land in the same translation unit as
// three's own chunks and any other patch on the material.
const DAIS_NOISE = /* glsl */ `
  float daisHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  vec2 daisHash2(vec2 p) {
    return fract(sin(vec2(
      dot(p, vec2(127.1, 311.7)),
      dot(p, vec2(269.5, 183.3))
    )) * 43758.5453);
  }
  float daisNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(daisHash(i), daisHash(i + vec2(1.0, 0.0)), f.x),
      mix(daisHash(i + vec2(0.0, 1.0)), daisHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float daisFbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * daisNoise(p);
      p = p * 2.0 + vec2(100.0);
      a *= 0.5;
    }
    return v;
  }
  // xy = the two nearest cell distances (their difference is the joint), and
  // z = a per-cell random. The z is what makes the deck read as fitted plates
  // rather than one poured slab: every cell can take its own value.
  vec3 daisVoronoi3(vec2 p) {
    vec2 ci = floor(p); vec2 cf = fract(p);
    float f1 = 8.0, f2 = 8.0; vec2 nearest = ci;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = daisHash2(ci + g);
      o = 0.5 + 0.4 * sin(6.2831 * o + 2.0);
      vec2 r = g + o - cf;
      float dd = dot(r, r);
      if (dd < f1) { f2 = f1; f1 = dd; nearest = ci + g; }
      else if (dd < f2) { f2 = dd; }
    }
    return vec3(sqrt(f1), sqrt(f2), daisHash(nearest + 0.5));
  }
`;

const DAIS_PARS = /* glsl */ `
  uniform float uDaisTime;
  uniform vec3 uStoneColor;
  uniform float uMossIntensity;
  uniform vec3 uBioGlowColor;
  uniform float uGlowIntensity;
  uniform vec2 uDaisSize;
  varying vec3 vDaisPos;
${DAIS_NOISE}
`;

// How much variation the stone carries. The previous pass added a flat
// vec3(0.06, 0.07, 0.08) on top of a ~0.8 base colour -- a 2% swing, which is
// nothing. Measured on the rendered frame the whole deck sat at (160,165,162)
// with no discernible structure inside the voronoi cells, so a lit slab still
// read as a white card pasted over the sand. These are multipliers instead of
// offsets, so the variation scales with the stone colour rather than washing
// out as the base gets brighter.
//
// The amplitudes are wider than they look because the deck sits high on the
// tone curve, where ACES compresses hard. Measured on the deck: a plate range
// of 0.80..1.18 moved adjacent plates only 6 sRGB levels apart, and a 0.25..1.75
// range -- a 7x albedo swing -- moved them 28. Roughly 18 levels of albedo buy
// one level on screen up here, so subtle-looking numbers render as nothing.
const PLATE_MIN = "0.58", PLATE_MAX = "1.42"; // per-cell value: fitted plates
const MOTTLE_MIN = "0.78", MOTTLE_MAX = "1.18"; // staining and grain

// Vertical faces: weathered stone, moss creeping up from the base, and the same
// plate/joint structure as the deck so the slab reads as one material seen from
// two angles. Object space rather than UV -- a MeshStandardMaterial only
// declares the uv attribute when a map is bound, and the dais has none.
const BODY_ALBEDO = /* glsl */ `
  {
    vec2 p = vec2(vDaisPos.x + vDaisPos.z, vDaisPos.y * 6.0);

    vec3 v = daisVoronoi3(p * 2.0);
    float plate = mix(${PLATE_MIN}, ${PLATE_MAX}, v.z);
    float mottle = mix(${MOTTLE_MIN}, ${MOTTLE_MAX},
      daisFbm(p * 1.5 + 5.0) * 0.65 + daisFbm(p * 7.0 + 11.0) * 0.35);
    vec3 stone = uStoneColor * plate * mottle;

    float joint = 1.0 - smoothstep(0.0, 0.06, v.y - v.x);
    stone = mix(stone, uStoneColor * 0.36, joint * 0.8);

    float mossGrad = smoothstep(-0.2, 0.3, vDaisPos.y / 0.5);
    float mossNoise = daisFbm(p * 1.0 + vec2(uDaisTime * 0.003, 0.0));
    float mossMask = mossGrad * smoothstep(0.35, 0.6, mossNoise);
    stone = mix(stone, vec3(0.05, 0.11, 0.07), mossMask * 0.5 * uMossIntensity);

    diffuseColor.rgb = stone;
  }
`;

// Deck: the same stone read as fitted plates, algae in the joints and at the
// rim where water sits, and the crack network that carries the bioluminescence.
// Albedo only here -- the glow is emissive (below), and it lands in the joints
// this darkens, so a glowing seam reads as a recess with light in it.
const TOP_ALBEDO = /* glsl */ `
  {
    vec2 c = vDaisPos.xy / uDaisSize;

    vec3 v = daisVoronoi3(c * 5.0);
    float plate = mix(${PLATE_MIN}, ${PLATE_MAX}, v.z);
    float mottle = mix(${MOTTLE_MIN}, ${MOTTLE_MAX},
      daisFbm(c * 3.0 + 3.0) * 0.65 + daisFbm(c * 14.0 + 11.0) * 0.35);
    vec3 stone = uStoneColor * plate * mottle;

    float joint = 1.0 - smoothstep(0.0, 0.055, v.y - v.x);
    stone = mix(stone, uStoneColor * 0.34, joint * 0.85);

    // Algae collects in two places: the rim, and the joints between plates.
    float edgeMoss = smoothstep(0.24, 0.46, max(abs(c.x), abs(c.y)));
    float mossNoise = daisFbm(c * 5.0 + vec2(uDaisTime * 0.003, 0.0));
    float mossMask = max(
      edgeMoss * smoothstep(0.38, 0.58, mossNoise),
      joint * 0.4 * smoothstep(0.42, 0.72, mossNoise)
    );
    stone = mix(stone, vec3(0.05, 0.10, 0.07), mossMask * 0.45 * uMossIntensity);

    diffuseColor.rgb = stone;
  }
`;

// The cracks light themselves. Emissive radiance rather than a flat colour add,
// so the glow survives tone mapping and reaches the bloom pass the way the
// scene's other light sources do.
const TOP_EMISSIVE = /* glsl */ `
  {
    vec2 c = vDaisPos.xy / uDaisSize;
    vec3 v = daisVoronoi3(c * 5.0);
    float crackEdge = v.y - v.x;
    float crackLine = 1.0 - smoothstep(0.0, 0.05, crackEdge);
    float crackGlow = 1.0 - smoothstep(0.0, 0.2, crackEdge);

    float breathe = 0.45 + 0.25 * sin(uDaisTime * 0.25 + daisFbm(c * 2.0) * 5.0);
    breathe += 0.1 * sin(uDaisTime * 0.4 + length(c) * 6.0);

    float glowPatch = smoothstep(0.35, 0.6, daisFbm(c * 1.8 + 19.0));
    float bio = breathe * glowPatch * uGlowIntensity;

    totalEmissiveRadiance += uBioGlowColor * (crackLine * 0.5 + crackGlow * 0.06) * bio;
  }
`;

function patchDaisMaterial(
  mat: MeshStandardMaterial,
  uniforms: DaisUniforms,
  albedo: string,
  emissive: string,
): void {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: import("three").WebGLRenderer,
  ) => {
    if (prev) prev.call(mat, shader, renderer);

    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "varying vec3 vDaisPos;\nvoid main() {")
      .replace("#include <begin_vertex>", "vDaisPos = position;\n#include <begin_vertex>");

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${DAIS_PARS}`)
      // Runs immediately after diffuseColor is initialised from `diffuse`, so
      // the procedural albedo replaces the flat colour before any lighting.
      .replace("#include <color_fragment>", `#include <color_fragment>\n${albedo}`);

    if (emissive) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>\n${emissive}`,
      );
    }
  };
  mat.needsUpdate = true;
}

function makeUniforms(config: RuinsShaderConfig, width: number, depth: number): DaisUniforms {
  return {
    uDaisTime: { value: 0 },
    uStoneColor: { value: new Color(config.stoneColor) },
    uMossIntensity: { value: config.mossIntensity },
    uBioGlowColor: { value: new Color(config.runeGlowColor) },
    uGlowIntensity: { value: config.glowIntensity },
    uDaisSize: { value: new Vector2(width, depth) },
  };
}

function attach(mat: MeshStandardMaterial, uniforms: DaisUniforms): MeshStandardMaterial {
  mat.userData.daisUniforms = uniforms;
  return mat;
}

/** Vertical stone: body slab, support pillars, column stumps. */
export function createBodyMaterial(config: RuinsShaderConfig): MeshStandardMaterial {
  const uniforms = makeUniforms(config, 1, 1);
  // Wet limestone: matte, non-metallic. The key spot supplies the form the old
  // unlit shader had to fake and could not.
  const mat = new MeshStandardMaterial({
    color: new Color(config.stoneColor),
    roughness: 0.9,
    metalness: 0.0,
  });
  patchDaisMaterial(mat, uniforms, BODY_ALBEDO, "");
  return attach(mat, uniforms);
}

/**
 * The deck. `width` and `depth` are the plane's own metre dimensions, which the
 * shader needs to normalise object space into the centred -0.5..0.5 field the
 * moss rim and crack network are authored against.
 */
export function createTopMaterial(
  config: RuinsShaderConfig,
  width: number,
  depth: number,
): MeshStandardMaterial {
  const uniforms = makeUniforms(config, width, depth);
  const mat = new MeshStandardMaterial({
    // Weathered limestone under water is matte. 0.74 left a broad specular lobe
    // across the whole deck, which is the other half of why a lit slab still
    // read as a lightbox rather than as stone.
    color: new Color(config.stoneColor),
    roughness: 0.92,
    metalness: 0.0,
    side: DoubleSide,
  });
  patchDaisMaterial(mat, uniforms, TOP_ALBEDO, TOP_EMISSIVE);
  return attach(mat, uniforms);
}

export function applyDaisConfig(
  mat: MeshStandardMaterial,
  config: RuinsShaderConfig,
  size?: { width: number; depth: number },
): void {
  const uniforms = mat.userData.daisUniforms as DaisUniforms | undefined;
  if (!uniforms) return;
  uniforms.uStoneColor.value.set(config.stoneColor);
  uniforms.uBioGlowColor.value.set(config.runeGlowColor);
  uniforms.uGlowIntensity.value = config.glowIntensity;
  uniforms.uMossIntensity.value = config.mossIntensity;
  if (size) uniforms.uDaisSize.value.set(size.width, size.depth);
  mat.color.set(config.stoneColor);
}

export function advanceDaisTime(mat: MeshStandardMaterial, delta: number): void {
  const uniforms = mat.userData.daisUniforms as DaisUniforms | undefined;
  if (uniforms) uniforms.uDaisTime.value += delta;
}
