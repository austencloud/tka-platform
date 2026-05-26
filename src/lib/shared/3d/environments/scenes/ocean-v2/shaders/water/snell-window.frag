uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform vec3 uCameraPosition;
uniform bool uSnellEnabled;
uniform vec3 uSkyColor;
uniform vec3 uSunColor;
uniform float uSunSize;
uniform float uTirDarkness;
uniform float uEdgeSoftness;
uniform float uNoiseScale;
uniform float uNoiseSpeed;
uniform float uNoiseAmplitude;
uniform float uSize;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vDisplacement;
varying vec3 vNormal;
varying float vEdgeFade;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  v += noise(p) * 0.5;
  v += noise(p * 2.1 + 0.3) * 0.25;
  v += noise(p * 4.3 + 0.7) * 0.125;
  return v;
}

void main() {
  float edgeDist = length(vWorldPosition.xz);
  float halfSize = uSize * 0.5;
  float edgeFade = 1.0 - smoothstep(halfSize * 0.3, halfSize * 0.6, edgeDist);
  if (!uSnellEnabled) {
    float highlight = smoothstep(0.0, 0.1, vDisplacement) * 0.3;
    float ripple = sin(vUv.x * 40.0 + uTime * 2.0) * sin(vUv.y * 35.0 - uTime * 1.5) * 0.1;
    float alpha = (uOpacity + highlight + ripple) * edgeFade;
    vec3 color = uColor + vec3(highlight * 0.5);
    gl_FragColor = vec4(color, alpha);
    return;
  }
  vec3 viewDir = normalize(vWorldPosition - uCameraPosition);
  vec3 surfaceNormal = normalize(-vNormal);
  float cosTheta = abs(dot(viewDir, surfaceNormal));
  float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
  const float IOR_WATER = 1.333;
  const float CRITICAL_SIN = 1.0 / IOR_WATER;
  vec2 noiseUv = vWorldPosition.xz * uNoiseScale + uTime * uNoiseSpeed;
  float waveNoise = (fbm(noiseUv) - 0.5) * 2.0 * uNoiseAmplitude;
  float perturbedSin = clamp(sinTheta + waveNoise, 0.0, 1.0);
  float windowMask = 1.0 - smoothstep(
    CRITICAL_SIN - uEdgeSoftness,
    CRITICAL_SIN + uEdgeSoftness,
    perturbedSin
  );
  float centerBrightness = pow(cosTheta, 0.5);
  vec3 skyResult = uSkyColor * (0.6 + 0.4 * centerBrightness);
  vec2 sunOffset = viewDir.xz / max(abs(viewDir.y), 0.001);
  float sunDist = length(sunOffset);
  float sunGlow = smoothstep(uSunSize * 4.0, uSunSize, sunDist);
  skyResult += uSunColor * sunGlow * 0.8;
  vec3 tirResult = uColor * uTirDarkness;
  float edgeFresnel = smoothstep(0.0, 0.15, abs(perturbedSin - CRITICAL_SIN));
  float edgeBright = (1.0 - edgeFresnel) * 0.3;
  vec3 finalColor = mix(tirResult, skyResult, windowMask);
  finalColor += vec3(edgeBright) * uSkyColor * 0.3;
  float highlight = smoothstep(0.0, 0.1, vDisplacement) * 0.15;
  finalColor += vec3(highlight);
  float alpha = mix(0.85, 0.4, windowMask) * edgeFade;
  gl_FragColor = vec4(finalColor, alpha);
}
