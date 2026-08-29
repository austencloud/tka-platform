import type {
  Color,
  MeshStandardMaterial,
  Texture,
  Vector2,
  WebGLProgramParametersWithUniforms,
  WebGLRenderer,
} from "three";

export interface MaskedGroundDetailMaps {
  red: Texture;
  green: Texture;
  blue: Texture;
  fourth: Texture;
}

export interface MaskedGroundSurfaceDetailMaps {
  height: Texture;
  roughness: Texture;
}

export interface MaskedGroundSurfaceDetail {
  maps: MaskedGroundSurfaceDetailMaps;
  scale: number;
  albedoStrength: number;
  normalStrength: number;
  roughnessStrength: number;
  slopeProjectionStrength: number;
}

export interface MaskedGroundContactZone {
  center: Vector2;
  halfSize: Vector2;
  feather: number;
  noise: number;
  strength: number;
}

export interface MaskedGroundDetailOptions {
  storageKey: string;
  cacheKey: string;
  maskOrigin: Vector2;
  maskSize: Vector2;
  worldAxisSign: Vector2;
  familyBaselines: [Color, Color, Color, Color];
  macroDark: Color;
  macroLight: Color;
  preserveColor?: Color;
  normalResponse?: number;
  roughnessFloor?: number;
  absoluteColorStrength?: number;
  primaryScale?: number;
  secondaryScale?: number;
  familyContrast?: number;
  heightResponse?: number;
  macroScale?: number;
  macroDetailScale?: number;
  macroDetailStrength?: number;
  slopeFamilyStrength?: number;
  slopeStart?: number;
  surfaceDetail?: MaskedGroundSurfaceDetail;
  contactZone?: MaskedGroundContactZone;
}

export interface MaskedGroundDetailPatch {
  dispose: () => void;
}

export function patchMaskedGroundDetailMaterial(
  material: MeshStandardMaterial,
  detailMaps: MaskedGroundDetailMaps,
  familyMask: Texture,
  strength: number,
  options: MaskedGroundDetailOptions
): MaskedGroundDetailPatch {
  const existing = material.userData[options.storageKey] as
    | MaskedGroundDetailPatch
    | undefined;
  if (existing) return existing;

  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey;
  const previousColor = options.preserveColor?.clone() ?? null;
  const normalResponse = options.normalResponse ?? 0.3;
  const roughnessFloor = options.roughnessFloor ?? 0.98;
  const absoluteColorStrength = options.absoluteColorStrength ?? 0;
  const primaryScale = options.primaryScale ?? 2.8;
  const secondaryScale = options.secondaryScale ?? 7.4;
  const familyContrast = options.familyContrast ?? 1;
  const heightResponse = options.heightResponse ?? 0.18;
  const macroScale = options.macroScale ?? 10.526;
  const macroDetailScale = options.macroDetailScale ?? macroScale;
  const macroDetailStrength = options.macroDetailStrength ?? 0;
  const slopeFamilyStrength = options.slopeFamilyStrength ?? 0;
  const slopeStart = options.slopeStart ?? 0.35;
  const surfaceDetail = options.surfaceDetail;
  const contactZone = options.contactZone;
  if (previousColor) material.color.setRGB(1, 1, 1);

  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer
  ) => {
    previousCompile.call(material, shader, renderer);
    shader.uniforms.uMaskedGroundRedMap = { value: detailMaps.red };
    shader.uniforms.uMaskedGroundGreenMap = { value: detailMaps.green };
    shader.uniforms.uMaskedGroundBlueMap = { value: detailMaps.blue };
    shader.uniforms.uMaskedGroundFourthMap = { value: detailMaps.fourth };
    shader.uniforms.uMaskedGroundFamilyMask = { value: familyMask };
    shader.uniforms.uMaskedGroundDetailStrength = { value: strength };
    shader.uniforms.uMaskedGroundNormalResponse = { value: normalResponse };
    shader.uniforms.uMaskedGroundRoughnessFloor = { value: roughnessFloor };
    shader.uniforms.uMaskedGroundAbsoluteColorStrength = {
      value: absoluteColorStrength,
    };
    shader.uniforms.uMaskedGroundPrimaryScale = { value: primaryScale };
    shader.uniforms.uMaskedGroundSecondaryScale = { value: secondaryScale };
    shader.uniforms.uMaskedGroundFamilyContrast = { value: familyContrast };
    shader.uniforms.uMaskedGroundHeightResponse = { value: heightResponse };
    shader.uniforms.uMaskedGroundMacroScale = { value: macroScale };
    shader.uniforms.uMaskedGroundMacroDetailScale = {
      value: macroDetailScale,
    };
    shader.uniforms.uMaskedGroundMacroDetailStrength = {
      value: macroDetailStrength,
    };
    shader.uniforms.uMaskedGroundSlopeFamilyStrength = {
      value: slopeFamilyStrength,
    };
    shader.uniforms.uMaskedGroundSlopeStart = { value: slopeStart };
    shader.uniforms.uMaskedGroundMaskOrigin = {
      value: options.maskOrigin.clone(),
    };
    shader.uniforms.uMaskedGroundMaskSize = { value: options.maskSize.clone() };
    shader.uniforms.uMaskedGroundWorldAxisSign = {
      value: options.worldAxisSign.clone(),
    };
    shader.uniforms.uMaskedGroundBaselineRed = {
      value: options.familyBaselines[0].clone(),
    };
    shader.uniforms.uMaskedGroundBaselineGreen = {
      value: options.familyBaselines[1].clone(),
    };
    shader.uniforms.uMaskedGroundBaselineBlue = {
      value: options.familyBaselines[2].clone(),
    };
    shader.uniforms.uMaskedGroundBaselineFourth = {
      value: options.familyBaselines[3].clone(),
    };
    shader.uniforms.uMaskedGroundMacroDark = {
      value: options.macroDark.clone(),
    };
    shader.uniforms.uMaskedGroundMacroLight = {
      value: options.macroLight.clone(),
    };
    shader.uniforms.uMaskedGroundContactCenter = {
      value: contactZone?.center.clone() ?? options.maskOrigin.clone(),
    };
    shader.uniforms.uMaskedGroundContactHalfSize = {
      value: contactZone?.halfSize.clone() ?? options.maskSize.clone(),
    };
    shader.uniforms.uMaskedGroundContactFeather = {
      value: contactZone?.feather ?? 1,
    };
    shader.uniforms.uMaskedGroundContactNoise = {
      value: contactZone?.noise ?? 0,
    };
    shader.uniforms.uMaskedGroundContactStrength = {
      value: contactZone?.strength ?? 0,
    };
    if (surfaceDetail) {
      shader.uniforms.uMaskedGroundSurfaceHeightMap = {
        value: surfaceDetail.maps.height,
      };
      shader.uniforms.uMaskedGroundSurfaceRoughnessMap = {
        value: surfaceDetail.maps.roughness,
      };
      shader.uniforms.uMaskedGroundSurfaceScale = {
        value: surfaceDetail.scale,
      };
      shader.uniforms.uMaskedGroundSurfaceAlbedoStrength = {
        value: surfaceDetail.albedoStrength,
      };
      shader.uniforms.uMaskedGroundSurfaceNormalStrength = {
        value: surfaceDetail.normalStrength,
      };
      shader.uniforms.uMaskedGroundSurfaceRoughnessStrength = {
        value: surfaceDetail.roughnessStrength,
      };
      shader.uniforms.uMaskedGroundSurfaceSlopeProjectionStrength = {
        value: surfaceDetail.slopeProjectionStrength,
      };
    }

    const surfaceDeclarations = surfaceDetail
      ? /* glsl */ `
          uniform sampler2D uMaskedGroundSurfaceHeightMap;
          uniform sampler2D uMaskedGroundSurfaceRoughnessMap;
          uniform float uMaskedGroundSurfaceScale;
          uniform float uMaskedGroundSurfaceAlbedoStrength;
          uniform float uMaskedGroundSurfaceNormalStrength;
          uniform float uMaskedGroundSurfaceRoughnessStrength;
          uniform float uMaskedGroundSurfaceSlopeProjectionStrength;`
      : "";
    const surfaceSampling = surfaceDetail
      ? /* glsl */ `
          vec2 maskedGroundSurfaceUv = maskedGroundPoint
            / uMaskedGroundSurfaceScale;
          vec2 maskedGroundSidePoint = abs(vMaskedGroundWorldNormal.x)
            > abs(vMaskedGroundWorldNormal.z)
              ? vec2(
                  vMaskedGroundWorldPosition.z,
                  vMaskedGroundWorldPosition.y
                )
              : vec2(
                  vMaskedGroundWorldPosition.x,
                  vMaskedGroundWorldPosition.y
                );
          vec2 maskedGroundSurfaceSideUv = maskedGroundSidePoint
            / uMaskedGroundSurfaceScale + vec2(6.17, -3.83);
          float maskedGroundSurfaceProjection = clamp(
            maskedGroundSlopeWeight
              * uMaskedGroundSurfaceSlopeProjectionStrength,
            0.0,
            1.0
          );
          float maskedGroundSurfaceHeight = mix(
            texture2D(
              uMaskedGroundSurfaceHeightMap,
              maskedGroundSurfaceUv
            ).r,
            texture2D(
              uMaskedGroundSurfaceHeightMap,
              maskedGroundSurfaceSideUv
            ).r,
            maskedGroundSurfaceProjection
          );
          float maskedGroundSurfaceRoughness = mix(
            texture2D(
              uMaskedGroundSurfaceRoughnessMap,
              maskedGroundSurfaceUv
            ).r,
            texture2D(
              uMaskedGroundSurfaceRoughnessMap,
              maskedGroundSurfaceSideUv
            ).r,
            maskedGroundSurfaceProjection
          );
          float maskedGroundSurfaceValue = (
            smoothstep(0.12, 0.9, maskedGroundSurfaceHeight) - 0.5
          ) * 2.0;
          diffuseColor.rgb *= 1.0
            + maskedGroundSurfaceValue
              * uMaskedGroundSurfaceAlbedoStrength
              * uMaskedGroundDetailStrength;`
      : /* glsl */ `
          float maskedGroundSurfaceHeight = 0.5;
          float maskedGroundSurfaceRoughness = 1.0;`;
    const surfaceRoughness = surfaceDetail
      ? /* glsl */ `
          roughnessFactor = mix(
            roughnessFactor,
            max(roughnessFactor, maskedGroundSurfaceRoughness),
            clamp(
              uMaskedGroundSurfaceRoughnessStrength
                * uMaskedGroundDetailStrength,
              0.0,
              1.0
            )
          );`
      : "";
    const surfaceHeightContribution = surfaceDetail
      ? "(maskedGroundSurfaceHeight - 0.5) * uMaskedGroundSurfaceNormalStrength"
      : "0.0";

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
          varying vec3 vMaskedGroundWorldPosition;
          varying vec3 vMaskedGroundWorldNormal;`
      )
      .replace(
        "#include <defaultnormal_vertex>",
        /* glsl */ `#include <defaultnormal_vertex>
          vMaskedGroundWorldNormal = normalize(
            mat3(modelMatrix) * transformedNormal
          );`
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
          vMaskedGroundWorldPosition = (
            modelMatrix * vec4(transformed, 1.0)
          ).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
          uniform sampler2D uMaskedGroundRedMap;
          uniform sampler2D uMaskedGroundGreenMap;
          uniform sampler2D uMaskedGroundBlueMap;
          uniform sampler2D uMaskedGroundFourthMap;
          uniform sampler2D uMaskedGroundFamilyMask;
          uniform float uMaskedGroundDetailStrength;
          uniform float uMaskedGroundNormalResponse;
          uniform float uMaskedGroundRoughnessFloor;
          uniform float uMaskedGroundAbsoluteColorStrength;
          uniform float uMaskedGroundPrimaryScale;
          uniform float uMaskedGroundSecondaryScale;
          uniform float uMaskedGroundFamilyContrast;
          uniform float uMaskedGroundHeightResponse;
          uniform float uMaskedGroundMacroScale;
          uniform float uMaskedGroundMacroDetailScale;
          uniform float uMaskedGroundMacroDetailStrength;
          uniform float uMaskedGroundSlopeFamilyStrength;
          uniform float uMaskedGroundSlopeStart;
          uniform vec2 uMaskedGroundMaskOrigin;
          uniform vec2 uMaskedGroundMaskSize;
          uniform vec2 uMaskedGroundWorldAxisSign;
          uniform vec3 uMaskedGroundBaselineRed;
          uniform vec3 uMaskedGroundBaselineGreen;
          uniform vec3 uMaskedGroundBaselineBlue;
          uniform vec3 uMaskedGroundBaselineFourth;
          uniform vec3 uMaskedGroundMacroDark;
          uniform vec3 uMaskedGroundMacroLight;
          uniform vec2 uMaskedGroundContactCenter;
          uniform vec2 uMaskedGroundContactHalfSize;
          uniform float uMaskedGroundContactFeather;
          uniform float uMaskedGroundContactNoise;
          uniform float uMaskedGroundContactStrength;
          varying vec3 vMaskedGroundWorldPosition;
          varying vec3 vMaskedGroundWorldNormal;
          ${surfaceDeclarations}

          float maskedGroundHash(vec2 point) {
            return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
          }

          float maskedGroundNoise(vec2 point) {
            vec2 cell = floor(point);
            vec2 blend = fract(point);
            blend = blend * blend * (3.0 - 2.0 * blend);
            return mix(
              mix(maskedGroundHash(cell), maskedGroundHash(cell + vec2(1.0, 0.0)), blend.x),
              mix(maskedGroundHash(cell + vec2(0.0, 1.0)), maskedGroundHash(cell + vec2(1.0)), blend.x),
              blend.y
            );
          }`
      )
      .replace(
        "#include <map_fragment>",
        /* glsl */ `#include <map_fragment>
          vec2 maskedGroundPoint = vec2(
            vMaskedGroundWorldPosition.x,
            vMaskedGroundWorldPosition.z
          ) * uMaskedGroundWorldAxisSign;
          vec2 detailUv = maskedGroundPoint / uMaskedGroundPrimaryScale;
          vec2 secondaryUv = mat2(0.8192, -0.5736, 0.5736, 0.8192)
            * maskedGroundPoint / uMaskedGroundSecondaryScale + vec2(4.7, -2.9);
          vec2 familyUv = (
            maskedGroundPoint - uMaskedGroundMaskOrigin
          ) / uMaskedGroundMaskSize;
          vec2 familyFeather = vec2(0.006);
          vec3 maskWeights = (
            texture2D(uMaskedGroundFamilyMask, familyUv).rgb * 2.0
            + texture2D(
              uMaskedGroundFamilyMask,
              familyUv + vec2(familyFeather.x, 0.0)
            ).rgb
            + texture2D(
              uMaskedGroundFamilyMask,
              familyUv - vec2(familyFeather.x, 0.0)
            ).rgb
            + texture2D(
              uMaskedGroundFamilyMask,
              familyUv + vec2(0.0, familyFeather.y)
            ).rgb
            + texture2D(
              uMaskedGroundFamilyMask,
              familyUv - vec2(0.0, familyFeather.y)
            ).rgb
          ) / 6.0;
          vec4 familyWeights = vec4(
            maskWeights,
            max(0.0, 1.0 - maskWeights.r - maskWeights.g - maskWeights.b)
          );
          familyWeights /= max(
            familyWeights.r + familyWeights.g + familyWeights.b + familyWeights.a,
            0.001
          );

          vec2 contactDelta = abs(
            maskedGroundPoint - uMaskedGroundContactCenter
          ) - uMaskedGroundContactHalfSize;
          float contactDistance = length(max(contactDelta, vec2(0.0)))
            + min(max(contactDelta.x, contactDelta.y), 0.0);
          float contactNoise = (
            maskedGroundNoise(maskedGroundPoint * 0.31) - 0.5
          ) * uMaskedGroundContactNoise;
          float contactWeight = (
            1.0 - smoothstep(
              0.1,
              max(0.11, uMaskedGroundContactFeather),
              contactDistance + contactNoise
            )
          ) * uMaskedGroundContactStrength;
          familyWeights = mix(
            familyWeights,
            vec4(1.0, 0.0, 0.0, 0.0),
            clamp(contactWeight, 0.0, 1.0)
          );

          float maskedGroundSlope = 1.0 - clamp(
            abs(vMaskedGroundWorldNormal.y),
            0.0,
            1.0
          );
          float maskedGroundSlopeWeight = smoothstep(
            uMaskedGroundSlopeStart,
            1.0,
            maskedGroundSlope
          );
          familyWeights = mix(
            familyWeights,
            vec4(0.0, 0.0, 1.0, 0.0),
            clamp(
              maskedGroundSlopeWeight * uMaskedGroundSlopeFamilyStrength,
              0.0,
              0.82
            )
          );

          vec3 detailColorPrimary =
            texture2D(uMaskedGroundRedMap, detailUv).rgb * familyWeights.r
            + texture2D(uMaskedGroundGreenMap, detailUv).rgb * familyWeights.g
            + texture2D(uMaskedGroundBlueMap, detailUv).rgb * familyWeights.b
            + texture2D(uMaskedGroundFourthMap, detailUv).rgb * familyWeights.a;
          vec3 detailColorSecondary =
            texture2D(uMaskedGroundRedMap, secondaryUv).rgb * familyWeights.r
            + texture2D(uMaskedGroundGreenMap, secondaryUv).rgb * familyWeights.g
            + texture2D(uMaskedGroundBlueMap, secondaryUv).rgb * familyWeights.b
            + texture2D(uMaskedGroundFourthMap, secondaryUv).rgb * familyWeights.a;
          vec3 detailColor = mix(detailColorPrimary, detailColorSecondary, 0.28);
          float detailLuma = dot(detailColor, vec3(0.299, 0.587, 0.114));
          vec3 familyBaseline =
            uMaskedGroundBaselineRed * familyWeights.r
            + uMaskedGroundBaselineGreen * familyWeights.g
            + uMaskedGroundBaselineBlue * familyWeights.b
            + uMaskedGroundBaselineFourth * familyWeights.a;
          vec3 familyVariation = clamp(
            (detailColor - familyBaseline) * uMaskedGroundFamilyContrast,
            vec3(-0.12),
            vec3(0.12)
          );
          float baselineLuma = dot(familyBaseline, vec3(0.299, 0.587, 0.114));
          float microValue = clamp(
            (detailLuma - baselineLuma)
              * 0.82
              * uMaskedGroundFamilyContrast,
            -0.11,
            0.11
          );
          vec3 modulation = vec3(1.0)
            + familyVariation * (0.60 * uMaskedGroundDetailStrength)
            + vec3(microValue * uMaskedGroundDetailStrength);
          float macroBroad = maskedGroundNoise(
            maskedGroundPoint / uMaskedGroundMacroScale
          );
          float macroDetail = maskedGroundNoise(
            mat2(0.7071, -0.7071, 0.7071, 0.7071)
              * maskedGroundPoint / uMaskedGroundMacroDetailScale
              + vec2(-7.1, 5.3)
          );
          float macro = mix(
            macroBroad,
            macroBroad * 0.68 + macroDetail * 0.32,
            clamp(uMaskedGroundMacroDetailStrength, 0.0, 1.0)
          );
          float meadowBladeSignal = mix(
            sin(dot(maskedGroundPoint, vec2(8.4, 2.7))),
            sin(dot(maskedGroundPoint, vec2(-3.1, 10.6)) + 1.7),
            maskedGroundNoise(maskedGroundPoint * 0.37)
          ) * familyWeights.g;
          diffuseColor.rgb = mix(
            diffuseColor.rgb,
            detailColor,
            clamp(
              uMaskedGroundAbsoluteColorStrength * uMaskedGroundDetailStrength,
              0.0,
              0.92
            )
          );
          diffuseColor.rgb *= modulation;
          diffuseColor.rgb *= mix(
            uMaskedGroundMacroDark,
            uMaskedGroundMacroLight,
            macro
          );
          diffuseColor.rgb *= 1.0 + meadowBladeSignal * 0.025;
          ${surfaceSampling}`
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `vec3 maskedGroundBaseNormal = normal;
          #include <normal_fragment_maps>
          normal = normalize(mix(
            maskedGroundBaseNormal,
            normal,
            clamp(uMaskedGroundNormalResponse, 0.0, 0.32)
          ));
          vec3 maskedGroundPositionDx = dFdx(vViewPosition);
          vec3 maskedGroundPositionDy = dFdy(vViewPosition);
          float maskedGroundCombinedHeight = detailLuma
            + ${surfaceHeightContribution};
          float maskedGroundHeightDx = dFdx(maskedGroundCombinedHeight);
          float maskedGroundHeightDy = dFdy(maskedGroundCombinedHeight);
          vec3 maskedGroundCrossX = cross(maskedGroundPositionDy, normal);
          vec3 maskedGroundCrossY = cross(normal, maskedGroundPositionDx);
          float maskedGroundDeterminant = dot(
            maskedGroundPositionDx,
            maskedGroundCrossX
          );
          vec3 maskedGroundSurfaceGradient = sign(maskedGroundDeterminant) * (
            maskedGroundHeightDx * maskedGroundCrossX
            + maskedGroundHeightDy * maskedGroundCrossY
          );
          normal = normalize(
            abs(maskedGroundDeterminant) * normal
              - maskedGroundSurfaceGradient
                * (uMaskedGroundHeightResponse * uMaskedGroundDetailStrength)
          );`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
          roughnessFactor = max(
            roughnessFactor,
            uMaskedGroundRoughnessFloor
          );
          ${surfaceRoughness}`
      );
  };
  material.customProgramCacheKey = () =>
    `${previousCacheKey.call(material)}|${options.cacheKey}`;

  const patch: MaskedGroundDetailPatch = {
    dispose: () => {
      if (material.userData[options.storageKey] !== patch) return;
      material.onBeforeCompile = previousCompile;
      material.customProgramCacheKey = previousCacheKey;
      if (previousColor) material.color.copy(previousColor);
      delete material.userData[options.storageKey];
      material.needsUpdate = true;
    },
  };
  material.userData[options.storageKey] = patch;
  material.needsUpdate = true;
  return patch;
}

export function inheritMaskedGroundDetailPatch(
  source: MeshStandardMaterial,
  target: MeshStandardMaterial,
  storageKey: string
): void {
  const patch = source.userData[storageKey] as
    | MaskedGroundDetailPatch
    | undefined;
  if (!patch) return;
  target.onBeforeCompile = source.onBeforeCompile;
  target.customProgramCacheKey = source.customProgramCacheKey;
  target.userData[storageKey] = patch;
  target.needsUpdate = true;
}
