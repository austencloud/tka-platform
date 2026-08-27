import {
  BackSide,
  GLSL3,
  NormalBlending,
  ShaderMaterial,
  Vector3,
  Vector4,
  type Data3DTexture,
  type Texture,
} from "three";
import { simplex3dNoise } from "../fire/fire-noise.glsl";

const VERTEX_SHADER = /* glsl */ `
  in vec3 aCenter;
  in vec3 aHalfExtent;
  in vec3 aAtlasOffset;
  in vec3 aCoreColor;
  in vec3 aEdgeColor;
  in vec4 aOptics;
  in vec3 aDetail;

  out vec3 vWorldPosition;
  flat out vec3 vCenter;
  flat out vec3 vHalfExtent;
  flat out vec3 vAtlasOffset;
  flat out vec3 vCoreColor;
  flat out vec3 vEdgeColor;
  flat out vec4 vOptics;
  flat out vec3 vDetail;

  void main() {
    vec3 localPosition = aCenter + position * aHalfExtent * 2.0;
    vec4 worldPosition = modelMatrix * vec4(localPosition, 1.0);
    vWorldPosition = worldPosition.xyz;
    vCenter = (modelMatrix * vec4(aCenter, 1.0)).xyz;
    vHalfExtent = aHalfExtent;
    vAtlasOffset = aAtlasOffset;
    vCoreColor = aCoreColor;
    vEdgeColor = aEdgeColor;
    vOptics = aOptics;
    vDetail = aDetail;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  precision highp sampler3D;

  ${simplex3dNoise}

  // Opaque scene depth clips the ray itself; the proxy cube never owns depth.
  uniform sampler3D uDensityAtlas;
  uniform sampler2D uSceneDepth;
  uniform float uTime;
  uniform int uStepCount;
  uniform vec3 uLightDirection;
  uniform vec4 uViewport;
  uniform float uSceneDepthReady;
  uniform float uCameraNear;
  uniform float uCameraFar;

  in vec3 vWorldPosition;
  flat in vec3 vCenter;
  flat in vec3 vHalfExtent;
  flat in vec3 vAtlasOffset;
  flat in vec3 vCoreColor;
  flat in vec3 vEdgeColor;
  flat in vec4 vOptics;
  flat in vec3 vDetail;

  out vec4 outColor;

  float hash12(vec2 value) {
    vec3 p = fract(vec3(value.xyx) * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  vec2 intersectBox(vec3 origin, vec3 direction) {
    vec3 safeDirection = sign(direction) * max(abs(direction), vec3(0.00001));
    vec3 inverseDirection = 1.0 / safeDirection;
    vec3 nearPlane = (-vec3(1.0) - origin) * inverseDirection;
    vec3 farPlane = (vec3(1.0) - origin) * inverseDirection;
    vec3 tMin = min(nearPlane, farPlane);
    vec3 tMax = max(nearPlane, farPlane);
    return vec2(max(max(tMin.x, tMin.y), tMin.z), min(min(tMax.x, tMax.y), tMax.z));
  }

  vec3 hueTravel(vec3 color, float amount) {
    const mat3 rotate = mat3(
      0.167, 0.167, 0.667,
      0.667, 0.167, 0.167,
      0.167, 0.667, 0.167
    );
    return mix(color, rotate * color, amount);
  }

  float viewZFromPerspectiveDepth(float depth) {
    return (uCameraNear * uCameraFar) /
      ((uCameraFar - uCameraNear) * depth - uCameraFar);
  }

  float boundaryFade(vec3 unitPosition) {
    float boundary = min(
      min(min(unitPosition.x, 1.0 - unitPosition.x), min(unitPosition.y, 1.0 - unitPosition.y)),
      min(unitPosition.z, 1.0 - unitPosition.z)
    );
    return smoothstep(0.0, 0.075, boundary);
  }

  vec4 sampleVolume(vec3 unitPosition) {
    vec3 atlasPosition = vAtlasOffset + clamp(unitPosition, vec3(0.003), vec3(0.997)) * 0.5;
    return texture(uDensityAtlas, atlasPosition);
  }

  float sampleShadowDensity(vec3 localPosition) {
    vec3 unitPosition = localPosition * 0.5 + 0.5;
    float rawDensity = sampleVolume(unitPosition).r;
    return max(0.0, rawDensity - 0.018) * boundaryFade(unitPosition);
  }

  float sampleDensity(vec3 localPosition, float warpStrength) {
    vec3 unitPosition = localPosition * 0.5 + 0.5;
    vec4 volume = sampleVolume(unitPosition);
    float rawDensity = volume.r;
    vec3 localFlow = volume.gba * 2.0 - 1.0;
    vec3 worldSample = vCenter + localPosition * vHalfExtent;
    float flowAmount = smoothstep(0.04, 0.7, length(localFlow));
    vec3 flowDirection = normalize(localFlow + vec3(0.0001));
    vec3 stretchedSample = worldSample -
      flowDirection * dot(worldSample, flowDirection) * flowAmount * 0.52;
    vec3 noisePosition =
      stretchedSample * mix(2.25, 3.35, warpStrength) +
      localFlow * vec3(-0.82, -0.38, -0.82) +
      vec3(vDetail.z * 19.7, -uTime * 0.16, vDetail.z * 7.9);
    float billow =
      snoise(noisePosition) * 0.68 +
      snoise(noisePosition * 2.07 + vec3(4.7, -1.3, 8.2)) * 0.32;
    float billowNoise = billow * 0.5 + 0.5;
    float ridgeNoise = pow(max(0.0, 1.0 - abs(billow)), 2.4);
    float structure = smoothstep(
      0.24,
      0.78,
      mix(billowNoise, ridgeNoise, 0.34 + warpStrength * 0.24)
    );
    float erosion = mix(0.035, 0.19, clamp(warpStrength, 0.0, 1.0)) *
      (1.0 - structure);
    float carvedDensity = max(0.0, rawDensity - erosion);
    return carvedDensity * mix(0.08, 1.5, structure) * boundaryFade(unitPosition);
  }

  void main() {
    vec3 worldDirection = normalize(vWorldPosition - cameraPosition);
    vec3 origin = (cameraPosition - vCenter) / vHalfExtent;
    vec3 direction = worldDirection / vHalfExtent;
    vec2 hit = intersectBox(origin, direction);
    if (hit.x > hit.y || hit.y < 0.0) discard;

    float start = max(hit.x, 0.0);
    float rayEnd = hit.y;
    if (uSceneDepthReady > 0.5) {
      vec2 screenUv =
        (gl_FragCoord.xy - uViewport.xy) / max(uViewport.zw, vec2(1.0));
      float sceneDepth = texture(
        uSceneDepth,
        clamp(screenUv, vec2(0.001), vec2(0.999))
      ).r;
      if (sceneDepth < 0.999999) {
        float sceneViewZ = viewZFromPerspectiveDepth(sceneDepth);
        vec3 viewDirection = normalize((viewMatrix * vec4(worldDirection, 0.0)).xyz);
        float sceneRayDistance =
          (-sceneViewZ) / max(0.0001, -viewDirection.z);
        rayEnd = min(rayEnd, sceneRayDistance - 0.012);
      }
    }
    if (rayEnd <= start) discard;
    float travel = max(0.0001, rayEnd - start);
    float stepLength = travel / float(max(uStepCount, 1));
    float jitter = hash12(gl_FragCoord.xy + vDetail.zz * 997.0);
    float distanceAlongRay = start + stepLength * jitter;
    vec3 lightDirection = normalize(uLightDirection);
    vec3 lightLocalStep = (lightDirection / vHalfExtent) * 0.085;
    vec3 accumulatedColor = vec3(0.0);
    float transmittance = 1.0;

    for (int stepIndex = 0; stepIndex < 64; stepIndex++) {
      if (stepIndex >= uStepCount || distanceAlongRay > rayEnd || transmittance < 0.018)
        break;
      vec3 localPosition = origin + direction * distanceAlongRay;
      float density = sampleDensity(localPosition, vDetail.x) * vOptics.x;
      if (density > 0.003) {
        float lightDensity =
          sampleShadowDensity(localPosition + lightLocalStep);
        if (uStepCount > 32) {
          lightDensity +=
            sampleShadowDensity(localPosition + lightLocalStep * 2.0) * 0.62 +
            sampleShadowDensity(localPosition + lightLocalStep * 3.0) * 0.38;
        }
        float selfShadow = exp(-lightDensity * vOptics.y * 0.42);
        float forwardScatter =
          0.5 + 0.5 * pow(max(0.0, dot(worldDirection, lightDirection)), 2.0);
        float lighting = selfShadow * forwardScatter * vOptics.z;
        float denseCore = smoothstep(0.035, 0.24, density);
        float edgeMix = mix(0.48, 0.06, denseCore);
        vec3 smokeColor = mix(vCoreColor, vEdgeColor, edgeMix);
        float hueAmount = vDetail.y * (0.35 + 0.3 * sin(uTime * 1.35 + localPosition.y * 4.0));
        smokeColor = hueTravel(smokeColor, hueAmount);
        float coreOcclusion = mix(0.9, 0.32, denseCore);
        float silverLining = mix(1.16, 0.88, denseCore);
        smokeColor *= coreOcclusion * (0.44 + lighting * 0.78) * silverLining;
        float opacity = 1.0 - exp(-density * vOptics.y * stepLength);
        accumulatedColor += transmittance * opacity * smokeColor;
        transmittance *= 1.0 - opacity;
      }
      distanceAlongRay += stepLength;
    }

    float alpha = 1.0 - transmittance;
    if (alpha < 0.002) discard;
    outColor = vec4(accumulatedColor, alpha);
  }
`;

export interface SmokeVolumeMaterial3D extends ShaderMaterial {
  uniforms: {
    uDensityAtlas: { value: Data3DTexture };
    uSceneDepth: { value: Texture | null };
    uTime: { value: number };
    uStepCount: { value: number };
    uLightDirection: { value: Vector3 };
    uViewport: { value: Vector4 };
    uSceneDepthReady: { value: number };
    uCameraNear: { value: number };
    uCameraFar: { value: number };
  };
}

export function createSmokeVolumeMaterial3D(
  texture: Data3DTexture
): SmokeVolumeMaterial3D {
  return new ShaderMaterial({
    name: "SmokeVolumeMaterial3D",
    glslVersion: GLSL3,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uDensityAtlas: { value: texture },
      uSceneDepth: { value: null },
      uTime: { value: 0 },
      uStepCount: { value: 48 },
      uLightDirection: { value: new Vector3(-0.42, 0.78, 0.46).normalize() },
      uViewport: { value: new Vector4(0, 0, 1, 1) },
      uSceneDepthReady: { value: 0 },
      uCameraNear: { value: 0.1 },
      uCameraFar: { value: 1000 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: BackSide,
    blending: NormalBlending,
    premultipliedAlpha: true,
    toneMapped: true,
  }) as SmokeVolumeMaterial3D;
}
