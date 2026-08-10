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
uniform vec3 uFogColor;
uniform float uFogDensity;
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

// Octaves are ROTATED, not just scaled. Stacking value noise on one axis-
// aligned lattice leaves the lattice visible: looking up at the old surface
// showed rows of identical lozenges marching to the horizon, which is what
// "so programmatic that it doesn't look any good" was describing. A different
// rotation per octave has no shared axis for the eye to lock onto.
const mat2 OCTAVE_ROTATION = mat2(0.8, -0.6, 0.6, 0.8);

float fbm(vec2 p) {
  float v = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    v += noise(p) * amplitude;
    p = OCTAVE_ROTATION * p * 2.03 + 11.7;
    amplitude *= 0.5;
  }
  return v;
}

// Warping the sample point by another fbm bends the noise into curved,
// current-driven bands. This is what makes the Snell edge read as water
// moving rather than as a circle with a fuzzy outline.
float warpedFbm(vec2 p) {
  vec2 warp = vec2(fbm(p + 3.1), fbm(p.yx - 1.7)) - 0.5;
  return fbm(p + warp * 1.6);
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
  float waveNoise = (warpedFbm(noiseUv) - 0.5) * 2.0 * uNoiseAmplitude;
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
  // Total internal reflection is a MIRROR, not a lid. Outside the Snell window
  // the underside reflects the lit water below it, so it carries the reef's own
  // light and a moving caustic shimmer. Rendering it as one flat dark colour is
  // what produced the black tiled ceiling: at any camera angle short of looking
  // straight up, sinTheta exceeds the critical angle everywhere, so that flat
  // colour WAS the entire sky.
  // Two cues, because noise alone renders as weather. The fbm supplies drifting
  // patches, but what makes a ceiling read as WATER is banding that follows the
  // swell -- so the dominant term is the surface tilt, which peaks on the face
  // of every wave and is zero at its crest and trough. Contrast stays narrow:
  // the first pass mixed across a 0.34 range and produced hard-edged clouds.
  float shimmer = warpedFbm(vWorldPosition.xz * uNoiseScale * 2.5
                            - uTime * uNoiseSpeed * 3.0);
  float tilt = clamp(length(vNormal.xz) * 3.2, 0.0, 1.0);
  // Floor at 0.46, not 0.34: measured against the graded frame, the ceiling was
  // coming out at (23,37,50) while the water below it sat at (39,62,74). A
  // surface darker than the water under it is the definition of a lid. It has
  // to be the brightest thing in the upper frame -- it is where the light is.
  float sheen = 0.46 + 0.32 * tilt + 0.12 * shimmer;
  vec3 tirResult = mix(uColor, uSkyColor, sheen) * uTirDarkness;
  float edgeFresnel = smoothstep(0.0, 0.15, abs(perturbedSin - CRITICAL_SIN));
  float edgeBright = (1.0 - edgeFresnel) * 0.3;
  vec3 finalColor = mix(tirResult, skyResult, windowMask);
  finalColor += vec3(edgeBright) * uSkyColor * 0.3;
  float highlight = smoothstep(0.0, 0.1, vDisplacement) * 0.15;
  finalColor += vec3(highlight);
  // Total internal reflection reflects ALL of it -- that is what total means --
  // so the surface is effectively opaque outside the Snell window and a window
  // inside it. The old 0.26 / 0.18 had it near-transparent everywhere and
  // barely distinguished the two, so the ceiling was mostly the backdrop dome
  // showing through, and the dome's upward colour is nearly black. Making the
  // mirror opaque is what lets the authored surface colour actually be seen.
  float alpha = mix(0.94, 0.24, windowMask) * edgeFade;

  // The surface was the one thing in the scene exempt from fog, because a raw
  // ShaderMaterial does not get Three's fog chunks. Every other object dissolved
  // into haze at distance while the plane held its own colour all the way out,
  // so its far rim cut a hard horizontal line across the frame -- the "ceiling"
  // read that making the plane 110 m wide was supposed to prevent and did not.
  // Fogging it lets the rim dissolve into the same haze as the reef below it.
  float viewDistance = length(vWorldPosition - uCameraPosition);
  float fogAmount = 1.0 - exp(-uFogDensity * uFogDensity
                              * viewDistance * viewDistance);
  finalColor = mix(finalColor, uFogColor, clamp(fogAmount, 0.0, 1.0));

  gl_FragColor = vec4(finalColor, alpha);
}
