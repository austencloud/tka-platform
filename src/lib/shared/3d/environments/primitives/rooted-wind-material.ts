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
}

interface RootedWindOptions {
  direction: Vector2;
  strength: number;
  cacheKey: string;
  storageKey: string;
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
    | RootedWindUniforms
    | undefined;
  if (existing) return existing;

  const uniforms: RootedWindUniforms = {
    time: { value: 0 },
    strength: { value: options.strength },
    direction: { value: options.direction.clone() },
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
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      /* glsl */ `#include <common>
        uniform float uRootedWindTime;
        uniform float uRootedWindStrength;
        uniform vec2 uRootedWindDirection;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      /* glsl */ `#include <begin_vertex>
        {
          vec3 rootedWindWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          float rootedWindWeight = smoothstep(0.02, 0.96, uv.y);
          rootedWindWeight *= rootedWindWeight;
          float rootedWindPhase = dot(rootedWindWorldPos.xz, uRootedWindDirection);
          float rootedWindPrimary = sin(uRootedWindTime * 0.72 + rootedWindPhase * 0.44);
          float rootedWindFlutter = sin(uRootedWindTime * 2.05 + rootedWindPhase * 1.17) * 0.24;
          float rootedWindGust = 0.72 + 0.28 * sin(uRootedWindTime * 0.19 + rootedWindPhase * 0.08);
          float rootedWindSway = (rootedWindPrimary + rootedWindFlutter) * rootedWindGust
            * rootedWindWeight * uRootedWindStrength;
          vec3 rootedWindWorldOffset = vec3(
            uRootedWindDirection.x * rootedWindSway,
            abs(rootedWindSway) * 0.045,
            uRootedWindDirection.y * rootedWindSway
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
  };
  material.customProgramCacheKey = () =>
    `${previousCacheKey()}|${options.cacheKey}`;
  material.userData[options.storageKey] = uniforms;
  material.side = DoubleSide;
  material.needsUpdate = true;
  return uniforms;
}
