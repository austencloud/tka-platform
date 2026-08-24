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

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
          varying vec3 vMaskedGroundWorldPosition;`
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
            detailColor - familyBaseline,
            vec3(-0.12),
            vec3(0.12)
          );
          float baselineLuma = dot(familyBaseline, vec3(0.299, 0.587, 0.114));
          float microValue = clamp(
            (detailLuma - baselineLuma) * 0.82,
            -0.11,
            0.11
          );
          vec3 modulation = vec3(1.0)
            + familyVariation * (0.60 * uMaskedGroundDetailStrength)
            + vec3(microValue * uMaskedGroundDetailStrength);
          float macro = maskedGroundNoise(maskedGroundPoint * 0.095);
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
          diffuseColor.rgb *= 1.0 + meadowBladeSignal * 0.025;`
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
          float maskedGroundHeightDx = dFdx(detailLuma);
          float maskedGroundHeightDy = dFdy(detailLuma);
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
                * (0.18 * uMaskedGroundDetailStrength)
          );`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
          roughnessFactor = max(
            roughnessFactor,
            uMaskedGroundRoughnessFloor
          );`
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
