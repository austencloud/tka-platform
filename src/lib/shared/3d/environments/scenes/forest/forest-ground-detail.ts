import type {
  Color,
  MeshStandardMaterial,
  Texture,
  WebGLProgramParametersWithUniforms,
  WebGLRenderer,
} from "three";

const STORAGE_KEY = "forestGroundDetailPatch";

export type ForestGroundDetailFamily = "neutral" | "meadow" | "litter" | "damp";

export const FOREST_GROUND_DETAIL_TEXTURES: Record<
  ForestGroundDetailFamily,
  string
> = {
  neutral: "/textures/forest-floor/forest-ground-detail-neutral.jpg",
  meadow: "/textures/forest-floor/forest-ground-detail-meadow.jpg",
  litter: "/textures/forest-floor/forest-ground-detail-litter.jpg",
  damp: "/textures/forest-floor/forest-ground-detail-damp.jpg",
};

const FOREST_GROUND_MATERIAL_FAMILIES = new Map<
  string,
  ForestGroundDetailFamily
>([
  ["Packed Performance Clearing", "meadow"],
  ["Path Soil", "neutral"],
  ["Leaf Duff", "litter"],
  ["Shade Moss", "litter"],
  ["Damp Hollow", "damp"],
  ["Quiet Distant Ground", "neutral"],
]);

export interface ForestGroundDetailPatch {
  dispose: () => void;
}

interface ForestGroundDetailOptions {
  preserveColor?: Color;
  normalResponse?: number;
  roughnessFloor?: number;
}

export function isForestGroundMaterial(
  material: MeshStandardMaterial
): boolean {
  return getForestGroundDetailFamily(material) !== null;
}

export function getForestGroundDetailFamily(
  material: MeshStandardMaterial
): ForestGroundDetailFamily | null {
  return FOREST_GROUND_MATERIAL_FAMILIES.get(material.name) ?? null;
}

export function patchForestGroundDetailMaterial(
  material: MeshStandardMaterial,
  detailMaps: Record<ForestGroundDetailFamily, Texture>,
  familyMask: Texture,
  strength = 0.9,
  options: ForestGroundDetailOptions = {}
): ForestGroundDetailPatch {
  const existing = material.userData[STORAGE_KEY] as
    | ForestGroundDetailPatch
    | undefined;
  if (existing) return existing;

  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey;
  const previousColor = options.preserveColor?.clone() ?? null;
  const normalResponse = options.normalResponse ?? 0.72;
  const roughnessFloor = options.roughnessFloor ?? 0.82;
  if (previousColor) material.color.setRGB(1, 1, 1);

  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer
  ) => {
    previousCompile.call(material, shader, renderer);
    shader.uniforms.uForestGroundNeutralMap = { value: detailMaps.neutral };
    shader.uniforms.uForestGroundMeadowMap = { value: detailMaps.meadow };
    shader.uniforms.uForestGroundLitterMap = { value: detailMaps.litter };
    shader.uniforms.uForestGroundDampMap = { value: detailMaps.damp };
    shader.uniforms.uForestGroundFamilyMask = { value: familyMask };
    shader.uniforms.uForestGroundDetailStrength = { value: strength };
    shader.uniforms.uForestGroundNormalResponse = { value: normalResponse };
    shader.uniforms.uForestGroundRoughnessFloor = { value: roughnessFloor };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
          varying vec3 vForestGroundWorldPosition;`
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
          vForestGroundWorldPosition = (
            modelMatrix * vec4(transformed, 1.0)
          ).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
          uniform sampler2D uForestGroundNeutralMap;
          uniform sampler2D uForestGroundMeadowMap;
          uniform sampler2D uForestGroundLitterMap;
          uniform sampler2D uForestGroundDampMap;
          uniform sampler2D uForestGroundFamilyMask;
          uniform float uForestGroundDetailStrength;
          uniform float uForestGroundNormalResponse;
          uniform float uForestGroundRoughnessFloor;
          varying vec3 vForestGroundWorldPosition;

          float forestGroundHash(vec2 point) {
            return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
          }

          float forestGroundNoise(vec2 point) {
            vec2 cell = floor(point);
            vec2 blend = fract(point);
            blend = blend * blend * (3.0 - 2.0 * blend);
            return mix(
              mix(forestGroundHash(cell), forestGroundHash(cell + vec2(1.0, 0.0)), blend.x),
              mix(forestGroundHash(cell + vec2(0.0, 1.0)), forestGroundHash(cell + vec2(1.0)), blend.x),
              blend.y
            );
          }`
      )
      .replace(
        "#include <map_fragment>",
        /* glsl */ `#include <map_fragment>
          vec2 forestGroundPoint = vec2(
            vForestGroundWorldPosition.x,
            -vForestGroundWorldPosition.z
          );
          vec2 detailUv = forestGroundPoint / 2.8;
          vec2 secondaryUv = mat2(0.8192, -0.5736, 0.5736, 0.8192)
            * forestGroundPoint / 7.4 + vec2(4.7, -2.9);
          vec2 familyUv = vec2(
            (vForestGroundWorldPosition.x + 200.0) / 400.0,
            (vForestGroundWorldPosition.z + 200.0) / 400.0
          );
          vec3 familyWeights = texture2D(
            uForestGroundFamilyMask,
            familyUv
          ).rgb;
          float dampWeight = max(
            0.0,
            1.0 - familyWeights.r - familyWeights.g - familyWeights.b
          );
          float familyTotal = max(
            familyWeights.r + familyWeights.g + familyWeights.b + dampWeight,
            0.001
          );
          vec3 detailColorPrimary = (
            texture2D(uForestGroundNeutralMap, detailUv).rgb * familyWeights.r +
            texture2D(uForestGroundMeadowMap, detailUv).rgb * familyWeights.g +
            texture2D(uForestGroundLitterMap, detailUv).rgb * familyWeights.b +
            texture2D(uForestGroundDampMap, detailUv).rgb * dampWeight
          ) / familyTotal;
          vec3 detailColorSecondary = (
            texture2D(uForestGroundNeutralMap, secondaryUv).rgb * familyWeights.r +
            texture2D(uForestGroundMeadowMap, secondaryUv).rgb * familyWeights.g +
            texture2D(uForestGroundLitterMap, secondaryUv).rgb * familyWeights.b +
            texture2D(uForestGroundDampMap, secondaryUv).rgb * dampWeight
          ) / familyTotal;
          vec3 detailColor = mix(
            detailColorPrimary,
            detailColorSecondary,
            0.28
          );
          float detailLuma = dot(detailColor, vec3(0.299, 0.587, 0.114));
          vec3 blurredFamilyColor = vec3(
            0.36 + 0.08 * familyWeights.g,
            0.38 + 0.24 * familyWeights.g + 0.06 * familyWeights.b,
            0.25 + 0.04 * familyWeights.g
          );
          vec3 familyVariation = clamp(
            detailColor - blurredFamilyColor,
            vec3(-0.18),
            vec3(0.18)
          );
          float microValue = clamp((detailLuma - 0.42) * 0.82, -0.11, 0.11);
          vec3 modulation = vec3(1.0)
            + familyVariation * (0.72 * uForestGroundDetailStrength)
            + vec3(microValue * uForestGroundDetailStrength);
          float macro = forestGroundNoise(forestGroundPoint * 0.095);
          diffuseColor.rgb *= modulation;
          diffuseColor.rgb *= mix(
            vec3(0.94, 0.96, 0.91),
            vec3(1.04, 1.02, 0.93),
            macro
          );`
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `vec3 forestGroundBaseNormal = normal;
          #include <normal_fragment_maps>
          normal = normalize(mix(
            forestGroundBaseNormal,
            normal,
            clamp(uForestGroundNormalResponse, 0.0, 1.0)
          ));
          vec3 forestPositionDx = dFdx(vViewPosition);
          vec3 forestPositionDy = dFdy(vViewPosition);
          float forestHeightDx = dFdx(detailLuma);
          float forestHeightDy = dFdy(detailLuma);
          vec3 forestCrossX = cross(forestPositionDy, normal);
          vec3 forestCrossY = cross(normal, forestPositionDx);
          float forestDeterminant = dot(forestPositionDx, forestCrossX);
          vec3 forestSurfaceGradient = sign(forestDeterminant) * (
            forestHeightDx * forestCrossX + forestHeightDy * forestCrossY
          );
          normal = normalize(
            abs(forestDeterminant) * normal
              - forestSurfaceGradient
                * (0.34 * uForestGroundDetailStrength)
          );`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
          roughnessFactor = max(
            roughnessFactor,
            uForestGroundRoughnessFloor
          );`
      );
  };
  material.customProgramCacheKey = () =>
    `${previousCacheKey.call(material)}|forest-ground-detail-v5`;

  const patch: ForestGroundDetailPatch = {
    dispose: () => {
      if (material.userData[STORAGE_KEY] !== patch) return;
      material.onBeforeCompile = previousCompile;
      material.customProgramCacheKey = previousCacheKey;
      if (previousColor) material.color.copy(previousColor);
      delete material.userData[STORAGE_KEY];
      material.needsUpdate = true;
    },
  };
  material.userData[STORAGE_KEY] = patch;
  material.needsUpdate = true;
  return patch;
}

export function inheritForestGroundDetailPatch(
  source: MeshStandardMaterial,
  target: MeshStandardMaterial
): void {
  const patch = source.userData[STORAGE_KEY] as
    | ForestGroundDetailPatch
    | undefined;
  if (!patch) return;
  target.onBeforeCompile = source.onBeforeCompile;
  target.customProgramCacheKey = source.customProgramCacheKey;
  target.userData[STORAGE_KEY] = patch;
  target.needsUpdate = true;
}
