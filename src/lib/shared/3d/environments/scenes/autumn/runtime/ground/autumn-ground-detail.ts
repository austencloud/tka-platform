import type {
  MeshStandardMaterial,
  Texture,
  WebGLProgramParametersWithUniforms,
  WebGLRenderer,
} from "three";

const STORAGE_KEY = "autumnGroundDetailPatch";

export interface AutumnGroundDetailUniforms {
  detailMap: { value: Texture };
  strength: { value: number };
}

export interface AutumnGroundDetailPatch {
  uniforms: AutumnGroundDetailUniforms;
  dispose: () => void;
}

export function isAutumnGroundMaterial(
  material: MeshStandardMaterial
): boolean {
  return material.name === "Autumn Living Forest Floor";
}

export function patchAutumnGroundDetailMaterial(
  material: MeshStandardMaterial,
  detailMap: Texture,
  strength = 0.72
): AutumnGroundDetailPatch {
  const existing = material.userData[STORAGE_KEY] as
    | AutumnGroundDetailPatch
    | undefined;
  if (existing) {
    existing.uniforms.detailMap.value = detailMap;
    existing.uniforms.strength.value = strength;
    return existing;
  }

  const uniforms: AutumnGroundDetailUniforms = {
    detailMap: { value: detailMap },
    strength: { value: strength },
  };
  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey;

  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer
  ) => {
    previousCompile.call(material, shader, renderer);
    shader.uniforms.uAutumnGroundDetailMap = uniforms.detailMap;
    shader.uniforms.uAutumnGroundDetailStrength = uniforms.strength;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
          varying vec2 vAutumnGroundDetailUv;
          varying vec3 vAutumnGroundWorldPosition;`
      )
      .replace(
        "#include <uv_vertex>",
        /* glsl */ `#include <uv_vertex>
          vAutumnGroundDetailUv = uv;`
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
          vAutumnGroundWorldPosition = (
            modelMatrix * vec4(transformed, 1.0)
          ).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
          uniform sampler2D uAutumnGroundDetailMap;
          uniform float uAutumnGroundDetailStrength;
          varying vec2 vAutumnGroundDetailUv;
          varying vec3 vAutumnGroundWorldPosition;

          float autumnGroundSegment(
            vec2 point,
            vec2 start,
            vec2 end,
            float halfWidth
          ) {
            vec2 segment = end - start;
            float amount = clamp(
              dot(point - start, segment) / max(dot(segment, segment), 0.0001),
              0.0,
              1.0
            );
            float distanceToSegment = length(
              point - (start + segment * amount)
            );
            return 1.0 - smoothstep(
              halfWidth * 0.48,
              halfWidth + 0.82,
              distanceToSegment
            );
          }

          float autumnCabinLane(vec2 point) {
            float lane = 0.0;
            lane = max(lane, autumnGroundSegment(point, vec2(0.0, 2.9), vec2(-0.35, 6.0), 1.68));
            lane = max(lane, autumnGroundSegment(point, vec2(-0.35, 6.0), vec2(-1.0, 9.5), 1.64));
            lane = max(lane, autumnGroundSegment(point, vec2(-1.0, 9.5), vec2(-2.7, 13.0), 1.58));
            lane = max(lane, autumnGroundSegment(point, vec2(-2.7, 13.0), vec2(-3.2, 17.5), 1.72));
            lane = max(lane, autumnGroundSegment(point, vec2(-3.2, 17.5), vec2(-2.4, 22.0), 1.82));
            lane = max(lane, autumnGroundSegment(point, vec2(-2.4, 22.0), vec2(-2.0, 27.0), 1.72));
            lane = max(lane, autumnGroundSegment(point, vec2(-2.0, 27.0), vec2(-3.2, 33.0), 1.58));
            lane = max(lane, autumnGroundSegment(point, vec2(-3.2, 33.0), vec2(-4.8, 39.5), 1.46));
            lane = max(lane, autumnGroundSegment(point, vec2(-4.8, 39.5), vec2(-6.5, 45.0), 1.34));
            lane = max(lane, autumnGroundSegment(point, vec2(-6.5, 45.0), vec2(-8.5, 50.0), 1.22));
            lane = max(lane, autumnGroundSegment(point, vec2(-8.5, 50.0), vec2(-10.0, 54.5), 1.02));
            return lane;
          }

          float autumnGroundNoise(vec2 point) {
            vec2 cell = floor(point);
            vec2 blend = fract(point);
            blend = blend * blend * (3.0 - 2.0 * blend);
            float first = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
            float second = fract(sin(dot(cell + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
            float third = fract(sin(dot(cell + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
            float fourth = fract(sin(dot(cell + vec2(1.0), vec2(127.1, 311.7))) * 43758.5453);
            return mix(mix(first, second, blend.x), mix(third, fourth, blend.x), blend.y);
          }`
      )
      .replace(
        "#include <map_fragment>",
        /* glsl */ `#include <map_fragment>
          vec2 autumnGroundPoint = vec2(
            vAutumnGroundWorldPosition.x,
            -vAutumnGroundWorldPosition.z
          );
          float autumnGroundRouteMask = autumnCabinLane(autumnGroundPoint);
          float autumnGroundMacro = autumnGroundNoise(
            autumnGroundPoint * 0.11
          );
          vec3 autumnGroundDetail = texture2D(
            uAutumnGroundDetailMap,
            vAutumnGroundDetailUv
          ).rgb;
          vec3 autumnGroundModulation = mix(
            vec3(1.0),
            autumnGroundDetail * 2.0,
            uAutumnGroundDetailStrength
          );
          diffuseColor.rgb *= clamp(
            autumnGroundModulation,
            vec3(0.64),
            vec3(1.36)
          );

          // Broad, low-amplitude value drift keeps the 330-metre floor from
          // reading as one repeated tile. It is evaluated in world space, so
          // it remains stable while the performer and review camera move.
          diffuseColor.rgb *= mix(
            vec3(0.93, 0.88, 0.80),
            vec3(1.08, 0.91, 0.72),
            autumnGroundMacro
          );

          // Moonlight is deliberately violet. Grade only the ground toward
          // copper-brown, then deepen the maintained route enough to survive
          // fog, mip reduction, and the settlement camera's grazing angle.
          diffuseColor.rgb *= vec3(1.10, 0.80, 0.62);
          diffuseColor.rgb *= mix(
            vec3(1.0),
            vec3(1.12, 0.62, 0.34),
            autumnGroundRouteMask * 0.78
          );`
      )
      .replace(
        "#include <opaque_fragment>",
        /* glsl */ `#include <opaque_fragment>
          // A restrained material-local bounce prevents the moon from
          // bleaching compacted soil back to lavender after PBR lighting.
          gl_FragColor.rgb += diffuseColor.rgb * 0.028;
          gl_FragColor.rgb *= vec3(1.08, 0.78, 0.58);
          gl_FragColor.rgb *= mix(0.92, 1.07, autumnGroundMacro);
          gl_FragColor.rgb = mix(
            gl_FragColor.rgb,
            gl_FragColor.rgb * vec3(0.45, 0.30, 0.20),
            autumnGroundRouteMask * 0.78
          );`
      );
  };
  material.customProgramCacheKey = () =>
    `${previousCacheKey.call(material)}|autumn-ground-detail-v3`;

  const patch: AutumnGroundDetailPatch = {
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
