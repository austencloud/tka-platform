import { AdditiveBlending, DoubleSide, ShaderMaterial } from "three";

const vertexShader = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec4 aVelocitySeed;
  attribute vec3 aColor;
  attribute vec4 aOptics;
  attribute vec4 aLens;
  attribute float aCoreStrength;

  varying vec2 vLensUv;
  varying vec3 vColor;
  varying float vEnergy;
  varying float vStretch;
  varying float vStreak;
  varying float vSpikes;
  varying float vChromatic;
  varying float vFalloff;
  varying float vHistory;
  varying float vCoreStrength;
  varying float vSeed;
  varying vec2 vOpticalPoint;

  void main() {
    vLensUv = uv * 2.0 - 1.0;
    vColor = aColor;
    vEnergy = aOptics.x;
    vStretch = aOptics.z;
    vStreak = aOptics.w;
    vSpikes = aLens.x;
    vChromatic = aLens.y;
    vFalloff = aLens.z;
    vHistory = aLens.w;
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
    float isPrism = step(0.001, aLens.y) * (1.0 - aLens.w);
    float centeredAlong = local.x * aOptics.z;
    float prismAlong = mix(-aOptics.z, 1.0, uv.x);
    float alongDistance = mix(centeredAlong, prismAlong, isPrism);
    vOpticalPoint = vec2(alongDistance, local.y);
    vec2 offset =
      along * alongDistance * aOptics.y +
      across * local.y * aOptics.y;
    gl_Position = projectionMatrix * vec4(centerView + vec3(offset, 0.0), 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uEmissiveStrength;

  varying vec2 vLensUv;
  varying vec3 vColor;
  varying float vEnergy;
  varying float vStretch;
  varying float vStreak;
  varying float vSpikes;
  varying float vChromatic;
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

  vec3 spectralPalette(float amount) {
    vec3 red = vec3(1.0, 0.055, 0.075);
    vec3 orange = vec3(1.0, 0.36, 0.035);
    vec3 yellow = vec3(1.0, 0.88, 0.12);
    vec3 green = vec3(0.08, 0.94, 0.38);
    vec3 cyan = vec3(0.04, 0.72, 1.0);
    vec3 violet = vec3(0.34, 0.16, 1.0);
    float t = clamp(amount, 0.0, 1.0);
    if (t < 0.2) return mix(red, orange, t / 0.2);
    if (t < 0.4) return mix(orange, yellow, (t - 0.2) / 0.2);
    if (t < 0.6) return mix(yellow, green, (t - 0.4) / 0.2);
    if (t < 0.8) return mix(green, cyan, (t - 0.6) / 0.2);
    return mix(cyan, violet, (t - 0.8) / 0.2);
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

    // Prism stays quiet at rest. Movement pulls a narrow ordered spectrum
    // behind the source, which makes the effect describe choreography instead
    // of throwing decorative beams over it.
    float prismMotion = clamp((vStretch - 1.18) / 2.0, 0.0, 1.0);
    float trailProgress = clamp(-opticalPoint.x / max(vStretch, 0.001), 0.0, 1.0);
    float trailHalfWidth = mix(0.09, 0.19, trailProgress);
    float spectralPosition = opticalPoint.y / max(trailHalfWidth, 0.001);
    float insideTrail = smoothstep(1.05, 0.8, abs(spectralPosition));
    float behindSource = 1.0 - smoothstep(-0.02, 0.08, opticalPoint.x);
    float trailFade = 1.0 - smoothstep(0.48, 1.0, trailProgress);
    float spectralTrail =
      insideTrail * behindSource * trailFade * vChromatic * prismMotion *
      (1.0 - vHistory);
    vec3 spectral =
      spectralPalette(spectralPosition * 0.5 + 0.5) * spectralTrail;

    float redEdge = gaussian(length(opticalPoint - vec2(0.0, -0.075)), 55.0);
    float cyanEdge = gaussian(length(opticalPoint - vec2(0.0, 0.075)), 55.0);
    float edgeMask = vChromatic * (1.0 - vHistory) * 0.38;
    vec3 spectralEdge = (
      vec3(1.0, 0.055, 0.075) * redEdge +
      vec3(0.04, 0.72, 1.0) * cyanEdge
    ) * edgeMask;

    vec3 hotCore = mix(vColor, vec3(1.0), 0.88);
    float exposure = sqrt(max(vEnergy, 0.0));
    float haloPresence = 1.0 - vChromatic * 0.78;
    vec3 light =
      vColor * (halo * haloPresence + blade * 1.35 * (1.0 - vChromatic) + star * 2.8) +
      hotCore * core * (0.7 + exposure * 1.1) +
      spectralEdge +
      spectral * 2.0;
    light *= uEmissiveStrength;

    float alpha = exposure * (
      halo * 0.45 * haloPresence +
      core * 0.88 +
      blade * 0.68 * (1.0 - vChromatic) +
      star * 1.2 +
      (redEdge + cyanEdge) * edgeMask * 0.18 +
      spectralTrail * 0.72
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
