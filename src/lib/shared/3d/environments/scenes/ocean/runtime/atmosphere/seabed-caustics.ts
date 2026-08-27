import {
  Color,
  Vector2,
  type MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";

// Soft animated voronoi light-dapple injected into any MeshStandardMaterial via
// onBeforeCompile, modulating EMISSIVE radiance so it reads as self-lit light
// landing ON the surface. Two properties keep it from ever becoming the
// full-screen haze that got the old caustics/god-rays cut:
//
//  1. It drifts along the sun's XZ projection in WORLD space (uSunDirXZ * uTime),
//     not screen space — so it stays glued to the floor as the camera orbits,
//     instead of swimming with the view (the dead giveaway of a fake post pass).
//  2. It DEPTH-FADES to zero by mid-water (smoothstep over uCausticFadeHeight
//     above uGroundY), so it physically can't wash the whole frame — it only
//     exists on geometry near the seabed.
//
// Mirrors patchSwayMaterial in FloraInstances. Vertex injection uses anchors
// (`void main`, `#include <project_vertex>`) that the sway patch does NOT touch,
// and the patch CHAINS any prior onBeforeCompile, so a flora reed can carry both
// sway and caustics at once.

const SUN_DIR_XZ = new Vector2(-10, 20).normalize(); // light travel across the floor
const CAUSTIC_COLOR = new Color("#9fd4e8");

// Soft default for the moody mid-depth target. Live-tunable; the dev `caustics`
// toggle drives this to 0 to A/B the cue. Toned down from 0.55 — combined with
// the water-tint scatter it was washing the seabed out. The live value comes
// from oceanDebugToggles.causticStrength (dev slider); this is just the uniform's
// initial value before OceanScene applies the slider.
export const DEFAULT_CAUSTIC_STRENGTH = 0.1;

// Shared singleton uniforms — ONE clock for every patched material (seabed GLB +
// flora/structures). Advanced once per frame by OceanScene.
export const causticUniforms = {
  uTime: { value: 0 },
  uSunDirXZ: { value: SUN_DIR_XZ },
  uCausticStrength: { value: DEFAULT_CAUSTIC_STRENGTH },
  uCausticScale: { value: 0.22 },
  uCausticColor: { value: CAUSTIC_COLOR },
  uGroundY: { value: 0 },
  uCausticFadeHeight: { value: 6.0 }, // caustics gone this many world units above the floor
};

const CAUSTIC_PARS = /* glsl */ `
  uniform float uTime;
  uniform vec2 uSunDirXZ;
  uniform float uCausticStrength;
  uniform float uCausticScale;
  uniform vec3 uCausticColor;
  uniform float uGroundY;
  uniform float uCausticFadeHeight;

  // Four analytic wave evaluations replace the former three-octave Voronoi
  // search (27 hashed neighbour cells per fragment). Crossing wave fronts
  // still form the thin, moving light filaments that read as caustics, while
  // keeping the authored reef fragment-bound scene inside its frame budget.
  float causticPattern(vec2 p, float t) {
    vec2 drift = p + uSunDirXZ * t * 0.16;
    float fold = sin(drift.x * 3.1 + sin(drift.y * 2.7 - t * 0.38));
    float crossA = sin(dot(drift, vec2(0.82, 0.57)) * 4.4 + t * 0.31);
    float crossB = sin(dot(drift, vec2(-0.63, 0.78)) * 3.7 - t * 0.27);
    float ridges = 1.0 - abs((fold + crossA + crossB) * 0.3333333);
    return smoothstep(0.72, 0.96, ridges);
  }
`;

export function patchCausticsMaterial(mat: MeshStandardMaterial): void {
  if (mat.userData.causticsPatched) return;
  mat.userData.causticsPatched = true;

  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: import("three").WebGLRenderer,
  ) => {
    // Preserve any earlier patch (e.g. flora sway) before adding caustics.
    if (prev) prev.call(mat, shader, renderer);

    shader.uniforms.uTime = causticUniforms.uTime;
    shader.uniforms.uSunDirXZ = causticUniforms.uSunDirXZ;
    shader.uniforms.uCausticStrength = causticUniforms.uCausticStrength;
    shader.uniforms.uCausticScale = causticUniforms.uCausticScale;
    shader.uniforms.uCausticColor = causticUniforms.uCausticColor;
    shader.uniforms.uGroundY = causticUniforms.uGroundY;
    shader.uniforms.uCausticFadeHeight = causticUniforms.uCausticFadeHeight;

    // Vertex: carry world position. `void main` + `#include <project_vertex>` are
    // anchors the sway patch leaves intact, so this composes with sway cleanly.
    shader.vertexShader = shader.vertexShader.replace(
      "void main() {",
      "varying vec3 vCausticWorldPos;\nvoid main() {",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "vCausticWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>",
    );

    // Fragment: declare helpers + varying, then add caustic light to emissive
    // radiance (self-lit dapple), depth-faded to the floor.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\n  varying vec3 vCausticWorldPos;\n" + CAUSTIC_PARS,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      /* glsl */ `#include <emissivemap_fragment>
        {
          float fade = smoothstep(uGroundY + uCausticFadeHeight, uGroundY, vCausticWorldPos.y);
          if (fade > 0.001 && uCausticStrength > 0.0001) {
            vec2 cp = vCausticWorldPos.xz * uCausticScale + uSunDirXZ * uTime * 0.04;
            float c = causticPattern(cp, uTime);
            totalEmissiveRadiance += uCausticColor * (c * uCausticStrength * fade);
          }
        }`,
    );
  };

  mat.needsUpdate = true;
}
