import {
  Vector3,
  type MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from "three";

const STORAGE_KEY = "autumnDepthCohesionPatch";

interface AutumnDepthCohesionProfile {
  id: string;
  prefix: string;
  grade: readonly [number, number, number];
  strength: number;
  fogDensityScale: number;
  luminanceScale: number;
}

const AUTUMN_DEPTH_COHESION_PROFILES: readonly AutumnDepthCohesionProfile[] = [
  {
    id: "birch-copper",
    prefix: "Autumn Birch PBR",
    grade: [1.2, 0.5, 0.22],
    strength: 0.82,
    fogDensityScale: 0.8,
    luminanceScale: 0.88,
  },
  {
    id: "larch-gold",
    prefix: "Autumn Larch PBR",
    grade: [1.2, 0.58, 0.18],
    strength: 0.8,
    fogDensityScale: 0.8,
    luminanceScale: 0.9,
  },
  {
    id: "snag-wine",
    prefix: "Autumn Snag PBR",
    grade: [0.86, 0.48, 0.5],
    strength: 0.68,
    fogDensityScale: 0.86,
    luminanceScale: 0.84,
  },
  {
    id: "willow-umber",
    prefix: "Autumn Willow PBR",
    grade: [1.1, 0.52, 0.24],
    strength: 0.78,
    fogDensityScale: 0.82,
    luminanceScale: 0.88,
  },
];

interface AutumnDepthCohesionUniforms {
  grade: { value: Vector3 };
  strength: { value: number };
  fogDensityScale: { value: number };
  luminanceScale: { value: number };
}

export interface AutumnDepthCohesionPatch {
  profileId: string;
  uniforms: AutumnDepthCohesionUniforms;
  dispose: () => void;
}

export function calculateAutumnDepthFogFactor(
  distance: number,
  density: number,
  densityScale: number
): number {
  const scaledDensity = density * densityScale;
  return 1 - Math.exp(-(scaledDensity * scaledDensity * distance * distance));
}

export function getAutumnDepthCohesionProfile(
  materialName: string
): AutumnDepthCohesionProfile | null {
  return (
    AUTUMN_DEPTH_COHESION_PROFILES.find(({ prefix }) =>
      materialName.startsWith(prefix)
    ) ?? null
  );
}

export function patchAutumnDepthCohesionMaterial(
  material: MeshStandardMaterial
): AutumnDepthCohesionPatch | null {
  const profile = getAutumnDepthCohesionProfile(material.name);
  if (!profile) return null;

  const existing = material.userData[STORAGE_KEY] as
    | AutumnDepthCohesionPatch
    | undefined;
  if (existing) return existing;

  const uniforms: AutumnDepthCohesionUniforms = {
    grade: { value: new Vector3(...profile.grade) },
    strength: { value: profile.strength },
    fogDensityScale: { value: profile.fogDensityScale },
    luminanceScale: { value: profile.luminanceScale },
  };
  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey;

  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer
  ) => {
    previousCompile.call(material, shader, renderer);
    shader.uniforms.uAutumnDepthCohesionGrade = uniforms.grade;
    shader.uniforms.uAutumnDepthCohesionStrength = uniforms.strength;
    shader.uniforms.uAutumnDepthFogDensityScale = uniforms.fogDensityScale;
    shader.uniforms.uAutumnDepthLuminanceScale = uniforms.luminanceScale;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
          uniform vec3 uAutumnDepthCohesionGrade;
          uniform float uAutumnDepthCohesionStrength;
          uniform float uAutumnDepthFogDensityScale;
          uniform float uAutumnDepthLuminanceScale;`
      )
      .replace(
        "#include <fog_fragment>",
        /* glsl */ `#ifdef USE_FOG
          float autumnDepthFogFactor = 0.0;
          #ifdef FOG_EXP2
            float autumnDepthFogDensity = fogDensity * uAutumnDepthFogDensityScale;
            autumnDepthFogFactor = 1.0 - exp(
              -autumnDepthFogDensity * autumnDepthFogDensity *
              vFogDepth * vFogDepth
            );
          #else
            autumnDepthFogFactor = smoothstep(
              fogNear,
              fogFar,
              vFogDepth * uAutumnDepthFogDensityScale
            );
          #endif
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, autumnDepthFogFactor);
        #endif

          // These trees still recede, but a material boundary should not look
          // like a sudden bank of snow. Match hue without letting the grade
          // invent brightness, then hold the imported family slightly below
          // the hero canopy's value.
          const vec3 autumnDepthLuminanceWeights = vec3(0.2126, 0.7152, 0.0722);
          float autumnDepthSourceLuminance = dot(
            gl_FragColor.rgb,
            autumnDepthLuminanceWeights
          );
          float autumnDepthGradeLuminance = max(
            dot(uAutumnDepthCohesionGrade, autumnDepthLuminanceWeights),
            0.001
          );
          vec3 autumnDepthHue = uAutumnDepthCohesionGrade *
            (autumnDepthSourceLuminance / autumnDepthGradeLuminance);
          vec3 autumnDepthGraded = mix(
            gl_FragColor.rgb,
            autumnDepthHue,
            uAutumnDepthCohesionStrength
          );
          float autumnDepthGradedLuminance = max(
            dot(autumnDepthGraded, autumnDepthLuminanceWeights),
            0.001
          );
          gl_FragColor.rgb = autumnDepthGraded *
            ((autumnDepthSourceLuminance * uAutumnDepthLuminanceScale) /
              autumnDepthGradedLuminance);`
      );
  };
  material.customProgramCacheKey = () =>
    `${previousCacheKey.call(material)}|autumn-depth-cohesion-${profile.id}-v3`;

  const patch: AutumnDepthCohesionPatch = {
    profileId: profile.id,
    uniforms,
    dispose: () => {
      if (material.userData[STORAGE_KEY] !== patch) return;
      material.onBeforeCompile = previousCompile;
      material.customProgramCacheKey = previousCacheKey;
      delete material.userData[STORAGE_KEY];
      material.needsUpdate = true;
    },
  };
  material.userData[STORAGE_KEY] = patch;
  material.needsUpdate = true;
  return patch;
}
