import {
  BackSide,
  GLSL3,
  NormalBlending,
  ShaderMaterial,
  Vector3,
  type Data3DTexture,
} from "three";

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

  uniform sampler3D uDensityAtlas;
  uniform float uTime;
  uniform int uStepCount;
  uniform vec3 uLightDirection;

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

  float sampleDensity(vec3 localPosition, float warpStrength) {
    vec3 unitPosition = localPosition * 0.5 + 0.5;
    float boundary = min(
      min(min(unitPosition.x, 1.0 - unitPosition.x), min(unitPosition.y, 1.0 - unitPosition.y)),
      min(unitPosition.z, 1.0 - unitPosition.z)
    );
    float boundaryFade = smoothstep(0.0, 0.075, boundary);
    vec3 curlWarp = vec3(
      sin(unitPosition.y * 23.0 + unitPosition.z * 13.0 + uTime * 0.35 + vDetail.z * 11.0),
      sin(unitPosition.z * 19.0 + unitPosition.x * 11.0 - uTime * 0.22),
      sin(unitPosition.x * 21.0 + unitPosition.y * 17.0 + uTime * 0.28)
    );
    unitPosition += curlWarp * 0.028 * warpStrength;
    unitPosition = clamp(unitPosition, vec3(0.003), vec3(0.997));
    vec3 atlasPosition = vAtlasOffset + unitPosition * 0.5;
    float rawDensity = texture(uDensityAtlas, atlasPosition).r;
    float billowNoise = 0.5 + 0.5 *
      sin(dot(unitPosition, vec3(19.0, 31.0, 23.0)) + uTime * 0.24 + vDetail.z * 17.0) *
      sin(dot(unitPosition, vec3(-37.0, 17.0, 29.0)) - uTime * 0.17);
    float erosion = 0.015 +
      mix(0.02, 0.09, clamp(warpStrength, 0.0, 1.0)) * billowNoise;
    float carvedDensity = max(0.0, rawDensity - erosion);
    return carvedDensity * mix(0.52, 1.35, billowNoise) * boundaryFade;
  }

  void main() {
    vec3 worldDirection = normalize(vWorldPosition - cameraPosition);
    vec3 origin = (cameraPosition - vCenter) / vHalfExtent;
    vec3 direction = worldDirection / vHalfExtent;
    vec2 hit = intersectBox(origin, direction);
    if (hit.x > hit.y || hit.y < 0.0) discard;

    float start = max(hit.x, 0.0);
    float travel = max(0.0001, hit.y - start);
    float stepLength = travel / float(max(uStepCount, 1));
    float jitter = hash12(gl_FragCoord.xy + vDetail.zz * 997.0);
    float distanceAlongRay = start + stepLength * jitter;
    vec3 lightDirection = normalize(uLightDirection);
    vec3 lightLocalStep = (lightDirection / vHalfExtent) * 0.085;
    vec3 accumulatedColor = vec3(0.0);
    float transmittance = 1.0;

    for (int stepIndex = 0; stepIndex < 64; stepIndex++) {
      if (stepIndex >= uStepCount || distanceAlongRay > hit.y || transmittance < 0.018)
        break;
      vec3 localPosition = origin + direction * distanceAlongRay;
      float density = sampleDensity(localPosition, vDetail.x) * vOptics.x;
      if (density > 0.003) {
        float lightDensity =
          sampleDensity(localPosition + lightLocalStep, vDetail.x);
        if (uStepCount > 32) {
          lightDensity +=
            sampleDensity(localPosition + lightLocalStep * 2.0, vDetail.x) * 0.62 +
            sampleDensity(localPosition + lightLocalStep * 3.0, vDetail.x) * 0.38;
        }
        float selfShadow = exp(-lightDensity * vOptics.y * 0.34);
        float forwardScatter = 0.68 + 0.32 * pow(max(0.0, dot(worldDirection, lightDirection)), 2.0);
        float lighting = mix(0.3, 0.96 * forwardScatter, selfShadow) * vOptics.z;
        float denseCore = smoothstep(0.03, 0.28, density);
        float edgeMix = mix(0.32, 0.08, denseCore);
        vec3 smokeColor = mix(vCoreColor, vEdgeColor, edgeMix);
        float hueAmount = vDetail.y * (0.35 + 0.3 * sin(uTime * 1.35 + localPosition.y * 4.0));
        smokeColor = hueTravel(smokeColor, hueAmount);
        smokeColor *= 0.42 + lighting;
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
    uTime: { value: number };
    uStepCount: { value: number };
    uLightDirection: { value: Vector3 };
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
      uTime: { value: 0 },
      uStepCount: { value: 48 },
      uLightDirection: { value: new Vector3(-0.42, 0.78, 0.46).normalize() },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: BackSide,
    blending: NormalBlending,
    premultipliedAlpha: true,
    toneMapped: true,
  }) as SmokeVolumeMaterial3D;
}
