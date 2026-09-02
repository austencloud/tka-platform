import type {
  MeshStandardMaterial,
  Texture,
  WebGLProgramParametersWithUniforms,
  WebGLRenderer,
} from "three";
import groundLayout from "../../../../../../../../../scripts/autumn-ground-layout.json";

const STORAGE_KEY = "autumnGroundDetailPatch";

interface GroundPathDefinition {
  id: string;
  points: [number, number, number][];
}

const cabinLane = (groundLayout.paths as GroundPathDefinition[]).find(
  (path) => path.id === "cabin_lane"
);

if (!cabinLane) {
  throw new Error("Autumn ground layout is missing the cabin_lane path");
}

function glslNumber(value: number): string {
  return Number.isInteger(value) ? `${value.toFixed(1)}` : `${value}`;
}

/** GLSL generated from the same route definition consumed by Blender. */
export const AUTUMN_CABIN_LANE_GLSL = cabinLane.points
  .slice(0, -1)
  .map((point, index) => {
    const next = cabinLane.points[index + 1]!;
    return `lane = max(lane, autumnGroundSegment(point, vec2(${glslNumber(point[0])}, ${glslNumber(point[1])}), vec2(${glslNumber(next[0])}, ${glslNumber(next[1])}), ${glslNumber(point[2])}));`;
  })
  .join("\n            ");

/**
 * Keep a faint floor signal beneath the authored tree belt, then return to
 * ordinary full fog before the infinite apron reaches its geometric edge.
 */
export const AUTUMN_HORIZON_FOG_FRAGMENT = /* glsl */ `
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp(
        -fogDensity * fogDensity * vFogDepth * vFogDepth
      );
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    float autumnGroundFogCeiling = mix(
      0.88,
      1.0,
      smoothstep(
        180.0,
        650.0,
        length(vAutumnGroundWorldPosition.xz)
      )
    );
    fogFactor = min(fogFactor, autumnGroundFogCeiling);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
  #endif`;

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
  return (
    material.name === "Autumn Living Forest Floor" ||
    material.name === "Autumn Fog Apron"
  );
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
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
          vAutumnGroundWorldPosition = (
            modelMatrix * vec4(transformed, 1.0)
          ).xyz;
          vec2 autumnGroundDetailPoint = vec2(
            vAutumnGroundWorldPosition.x,
            -vAutumnGroundWorldPosition.z
          );
          vec2 autumnGroundDetailWarp = vec2(
            0.075 * sin(autumnGroundDetailPoint.y * 0.29)
              + 0.032 * sin(
                autumnGroundDetailPoint.x * 0.73
                  + autumnGroundDetailPoint.y * 0.18
              ),
            0.068 * cos(autumnGroundDetailPoint.x * 0.31)
              + 0.028 * sin(
                autumnGroundDetailPoint.y * 0.67
                  - autumnGroundDetailPoint.x * 0.16
              )
          );
          vAutumnGroundDetailUv =
            autumnGroundDetailPoint / ${glslNumber(groundLayout.detailMetres)}
              + autumnGroundDetailWarp;`
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
            ${AUTUMN_CABIN_LANE_GLSL}
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

          // Broad, low-amplitude value drift keeps the full terrain and fog
          // apron from reading as one repeated tile. It is evaluated in world
          // space, so it remains stable while the performer and camera move.
          diffuseColor.rgb *= mix(
            vec3(0.93, 0.88, 0.80),
            vec3(1.08, 0.91, 0.72),
            autumnGroundMacro
          );

          // Moonlight is deliberately violet. Grade only the ground toward
          // copper-brown, then deepen the maintained route enough to survive
          // fog, mip reduction, and the settlement camera's grazing angle.
          diffuseColor.rgb *= vec3(1.15, 0.67, 0.42);
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
          gl_FragColor.rgb *= vec3(1.18, 0.62, 0.38);
          gl_FragColor.rgb *= mix(0.92, 1.07, autumnGroundMacro);
          gl_FragColor.rgb = mix(
            gl_FragColor.rgb,
            gl_FragColor.rgb * vec3(0.45, 0.30, 0.20),
            autumnGroundRouteMask * 0.78
          );

          // Cool moon-facing slopes used to wash toward pink-grey even though
          // the same material read as rich leaf mould in shadow. Pull every
          // lighting result toward a luminance-matched copper target so relief
          // remains legible without fragmenting the floor into pale islands.
          float autumnGroundLuminance = dot(
            gl_FragColor.rgb,
            vec3(0.2126, 0.7152, 0.0722)
          );
          vec3 autumnGroundCopper = autumnGroundLuminance
            * vec3(1.35, 0.52, 0.28);
          gl_FragColor.rgb = mix(
            gl_FragColor.rgb,
            autumnGroundCopper,
            0.45
          );`
      );
    if (material.name === "Autumn Fog Apron") {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <fog_fragment>",
        AUTUMN_HORIZON_FOG_FRAGMENT
      );
    }
  };
  material.customProgramCacheKey = () =>
    `${previousCacheKey.call(material)}|autumn-ground-detail-v7|${material.name}`;

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
