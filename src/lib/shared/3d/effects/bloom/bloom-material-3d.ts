import { AdditiveBlending, DoubleSide, ShaderMaterial } from "three";

const vertexShader = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec4 aVelocitySeed;
  attribute vec3 aColor;
  attribute vec4 aOptics;
  attribute vec3 aLens;
  attribute float aCoreStrength;

  varying vec3 vColor;
  varying float vEnergy;
  varying float vStretch;
  varying float vStreak;
  varying float vSpikes;
  varying float vFalloff;
  varying float vHistory;
  varying float vCoreStrength;
  varying float vSeed;
  varying vec2 vOpticalPoint;

  void main() {
    vColor = aColor;
    vEnergy = aOptics.x;
    vStretch = aOptics.z;
    vStreak = aOptics.w;
    vSpikes = aLens.x;
    vFalloff = aLens.y;
    vHistory = aLens.z;
    vCoreStrength = aCoreStrength;
    vSeed = aVelocitySeed.w;

    vec3 centerView = (modelViewMatrix * vec4(aCenter, 1.0)).xyz;
    vec3 velocityView = (modelViewMatrix * vec4(aVelocitySeed.xyz, 0.0)).xyz;
    float projectedSpeed = length(velocityView.xy);
    vec2 along = projectedSpeed > 0.0001
      ? velocityView.xy / projectedSpeed
      : vec2(1.0, 0.0);
    vec2 across = vec2(-along.y, along.x);
    vec2 local = position.xy;
    float centeredAlong = local.x * aOptics.z;
    vOpticalPoint = vec2(centeredAlong, local.y);
    vec2 offset =
      along * centeredAlong * aOptics.y +
      across * local.y * aOptics.y;
    gl_Position = projectionMatrix * vec4(centerView + vec3(offset, 0.0), 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uEmissiveStrength;

  varying vec3 vColor;
  varying float vEnergy;
  varying float vStretch;
  varying float vStreak;
  varying float vSpikes;
  varying float vFalloff;
  varying float vHistory;
  varying float vCoreStrength;
  varying float vSeed;
  varying vec2 vOpticalPoint;

  float gaussian(float distanceValue, float sharpness) {
    return exp(-distanceValue * distanceValue * sharpness);
  }

  float ray(vec2 point, float width, float falloff) {
    return exp(-abs(point.y) * width) * pow(max(0.0, 1.0 - abs(point.x)), falloff);
  }

  void main() {
    vec2 opticalPoint = vOpticalPoint;
    vec2 bladePoint = vec2(
      opticalPoint.x / max(vStretch, 0.001),
      opticalPoint.y
    );
    float radial = length(opticalPoint);

    float smoothHalo = gaussian(radial, 2.8);
    float sharpHalo = gaussian(radial, 8.5);
    float halo = vFalloff < 0.5 ? smoothHalo : sharpHalo;

    float core = gaussian(radial, 58.0) * vCoreStrength;
    float blade = ray(bladePoint, 16.0, 2.4) * vStreak;

    float rayAngle = 0.785398 + vSeed * 0.12;
    float cosRay = cos(rayAngle);
    float sinRay = sin(rayAngle);
    vec2 diagonal = vec2(
      opticalPoint.x * cosRay - opticalPoint.y * sinRay,
      opticalPoint.x * sinRay + opticalPoint.y * cosRay
    );
    float star = (
      ray(opticalPoint, 34.0, 3.2) +
      ray(opticalPoint.yx, 44.0, 3.5) +
      ray(diagonal, 52.0, 4.2) +
      ray(diagonal.yx, 52.0, 4.2)
    ) * 0.78 * vSpikes * (1.0 - vHistory);

    vec3 hotCore = mix(vColor, vec3(1.0), 0.88);
    float exposure = sqrt(max(vEnergy, 0.0));
    vec3 light =
      vColor * (halo + blade * 1.35 + star * 2.8) +
      hotCore * core * (0.7 + exposure * 1.1);
    light *= uEmissiveStrength;

    float alpha = exposure * (
      halo * 0.45 +
      core * 0.88 +
      blade * 0.68 +
      star * 1.2
    );
    if (alpha < 0.002) discard;

    gl_FragColor = vec4(light, min(alpha, 1.0));
  }
`;

export function createBloomMaterial3D(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uEmissiveStrength: { value: 2.4 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
}
