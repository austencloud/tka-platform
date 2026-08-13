import {
  DoubleSide,
  Vector2,
  type Mesh,
  type MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";

export interface RootedWindUniforms {
  time: { value: number };
  strength: { value: number };
  direction: { value: Vector2 };
  spatialVariation: { value: number };
  rootDarkening: { value: number };
  colorVariation: { value: number };
}

interface RootedWindOptions {
  direction: Vector2;
  strength: number;
  cacheKey: string;
  storageKey: string;
  spatialVariation?: number;
  rootDarkening?: number;
  colorVariation?: number;
}

interface RootedWindPatchState {
  uniforms: RootedWindUniforms;
  onBeforeCompile: MeshStandardMaterial["onBeforeCompile"];
  customProgramCacheKey: MeshStandardMaterial["customProgramCacheKey"];
}

export function expandBoundsForRootedWind(
  mesh: Mesh,
  margin: number,
  markerKey: string
): void {
  const geometry = mesh.geometry;
  if (!geometry || geometry.userData[markerKey]) return;

  geometry.computeBoundingSphere();
  if (geometry.boundingSphere) geometry.boundingSphere.radius += margin;
  geometry.computeBoundingBox();
  geometry.boundingBox?.expandByScalar(margin);
  geometry.userData[markerKey] = true;
}

export function patchRootedWindMaterial(
  material: MeshStandardMaterial,
  options: RootedWindOptions
): RootedWindUniforms {
  const existing = material.userData[options.storageKey] as
    | RootedWindPatchState
    | undefined;
  if (existing) return existing.uniforms;

  const uniforms: RootedWindUniforms = {
    time: { value: 0 },
    strength: { value: options.strength },
    direction: { value: options.direction.clone() },
    spatialVariation: { value: options.spatialVariation ?? 0 },
    rootDarkening: { value: options.rootDarkening ?? 0 },
    colorVariation: { value: options.colorVariation ?? 0 },
  };
  const previousCompile = material.onBeforeCompile.bind(material);
  const previousCacheKey = material.customProgramCacheKey.bind(material);

  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer
  ) => {
    previousCompile(shader, renderer);
    shader.uniforms.uRootedWindTime = uniforms.time;
    shader.uniforms.uRootedWindStrength = uniforms.strength;
    shader.uniforms.uRootedWindDirection = uniforms.direction;
    shader.uniforms.uRootedWindSpatialVariation = uniforms.spatialVariation;
    shader.uniforms.uRootedWindRootDarkening = uniforms.rootDarkening;
    shader.uniforms.uRootedWindColorVariation = uniforms.colorVariation;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      /* glsl */ `#include <common>
        uniform float uRootedWindTime;
        uniform float uRootedWindStrength;
        uniform vec2 uRootedWindDirection;
        uniform float uRootedWindSpatialVariation;
        varying float vRootedWindWeight;
        varying vec3 vRootedWindWorldPosition;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      /* glsl */ `#include <begin_vertex>
        {
          vec3 rootedWindWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          float rootedWindWeight = smoothstep(0.02, 0.96, uv.y);
          rootedWindWeight *= rootedWindWeight;
          vRootedWindWeight = rootedWindWeight;
          vRootedWindWorldPosition = rootedWindWorldPos;
          float rootedWindPhase = dot(rootedWindWorldPos.xz, uRootedWindDirection);
          vec2 rootedWindCrossDirection = vec2(
            -uRootedWindDirection.y,
            uRootedWindDirection.x
          );
          float rootedWindCrossPhase = dot(
            rootedWindWorldPos.xz,
            rootedWindCrossDirection
          );
          float rootedWindPrimary = sin(uRootedWindTime * 0.72 + rootedWindPhase * 0.44);
          float rootedWindFlutter = sin(uRootedWindTime * 2.05 + rootedWindPhase * 1.17) * 0.24;
          float rootedWindGust = 0.72 + 0.28 * sin(uRootedWindTime * 0.19 + rootedWindPhase * 0.08);
          float rootedWindZone =
            sin(
              uRootedWindTime * 0.11
              + rootedWindPhase * 0.13
              + rootedWindCrossPhase * 0.21
            ) * 0.65
            + sin(
              -uRootedWindTime * 0.07
              + rootedWindPhase * 0.043
              - rootedWindCrossPhase * 0.078
            ) * 0.35;
          float rootedWindZoneStrength =
            1.0 + rootedWindZone * uRootedWindSpatialVariation;
          float rootedWindSway = (rootedWindPrimary + rootedWindFlutter) * rootedWindGust
            * rootedWindWeight * uRootedWindStrength * rootedWindZoneStrength;
          float rootedWindCrossSway =
            sin(uRootedWindTime * 0.51 + rootedWindCrossPhase * 0.33)
            * rootedWindWeight
            * uRootedWindStrength
            * uRootedWindSpatialVariation
            * 0.12;
          vec2 rootedWindHorizontalOffset =
            uRootedWindDirection * rootedWindSway
            + rootedWindCrossDirection * rootedWindCrossSway;
          vec3 rootedWindWorldOffset = vec3(
            rootedWindHorizontalOffset.x,
            abs(rootedWindSway) * 0.045,
            rootedWindHorizontalOffset.y
          );
          mat3 rootedWindBasis = mat3(modelMatrix);
          vec3 rootedWindInvSq = vec3(
            1.0 / max(dot(rootedWindBasis[0], rootedWindBasis[0]), 1e-6),
            1.0 / max(dot(rootedWindBasis[1], rootedWindBasis[1]), 1e-6),
            1.0 / max(dot(rootedWindBasis[2], rootedWindBasis[2]), 1e-6)
          );
          transformed += (transpose(rootedWindBasis) * rootedWindWorldOffset) * rootedWindInvSq;
        }`
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
          uniform float uRootedWindRootDarkening;
          uniform float uRootedWindColorVariation;
          varying float vRootedWindWeight;
          varying vec3 vRootedWindWorldPosition;

          float rootedWindHash(vec2 value) {
            return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453123);
          }`
      )
      .replace(
        "#include <map_fragment>",
        /* glsl */ `#include <map_fragment>
          float rootedWindRootShade = mix(
            1.0 - uRootedWindRootDarkening,
            1.0,
            smoothstep(0.0, 0.48, vRootedWindWeight)
          );
          float rootedWindColorNoise = rootedWindHash(
            floor(vRootedWindWorldPosition.xz * 1.7)
          );
          float rootedWindColorScale = mix(
            1.0 - uRootedWindColorVariation,
            1.0 + uRootedWindColorVariation,
            rootedWindColorNoise
          );
          diffuseColor.rgb *= rootedWindRootShade * rootedWindColorScale;`
      );
  };
  material.customProgramCacheKey = () =>
    `${previousCacheKey()}|${options.cacheKey}`;
  material.userData[options.storageKey] = {
    uniforms,
    onBeforeCompile: material.onBeforeCompile,
    customProgramCacheKey: material.customProgramCacheKey,
  } satisfies RootedWindPatchState;
  material.side = DoubleSide;
  // Rooted wind is used on thin grass cards. Rendering their transparent back
  // faces in a separate pass adds cost but no useful depth ordering.
  material.forceSinglePass = true;
  material.needsUpdate = true;
  return uniforms;
}

export function inheritRootedWindPatch(
  source: MeshStandardMaterial,
  target: MeshStandardMaterial
): void {
  const patch = Object.values(source.userData).find(
    (value): value is RootedWindPatchState =>
      Boolean(
        value &&
          typeof value === "object" &&
          "uniforms" in value &&
          "onBeforeCompile" in value &&
          "customProgramCacheKey" in value
      )
  );
  if (!patch) return;

  target.onBeforeCompile = patch.onBeforeCompile;
  target.customProgramCacheKey = patch.customProgramCacheKey;
  const storageKey = Object.keys(source.userData).find(
    (key) => source.userData[key] === patch
  );
  if (storageKey) target.userData[storageKey] = patch;
  target.side = DoubleSide;
  target.forceSinglePass = true;
  target.needsUpdate = true;
}
