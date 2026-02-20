/**
 * FireShaderSource
 *
 * GLSL 300 es vertex + fragment shaders for procedural fire rendering.
 * Uses domain-warped FBM with gradient noise to generate organic,
 * volumetric-looking fire at each prop tip position.
 *
 * The fire reacts to spin velocity: leaning away from direction of motion,
 * stretching with speed, increasing turbulence and brightness.
 *
 * v2: Complete rewrite fixing coordinate space, organic shape, momentum response.
 */

export const FIRE_VERTEX_SHADER = `#version 300 es
precision highp float;

// Full-screen quad: positions and UVs for 2 triangles
const vec2 POSITIONS[6] = vec2[6](
  vec2(-1.0, -1.0),
  vec2( 1.0, -1.0),
  vec2(-1.0,  1.0),
  vec2(-1.0,  1.0),
  vec2( 1.0, -1.0),
  vec2( 1.0,  1.0)
);

out vec2 v_uv;

void main() {
  vec2 pos = POSITIONS[gl_VertexID];
  v_uv = pos * 0.5 + 0.5; // [0,1] range
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

export const FIRE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

// Frame uniforms
uniform float u_time;
uniform vec2 u_resolution; // matches tip coordinate space (e.g. 950x950)

// Tip data (max 8 tips, typically 4)
uniform int u_tipCount;
uniform vec2 u_tipPositions[8];
uniform vec2 u_tipVelocities[8];
uniform float u_tipSpeeds[8];

// Fire configuration
uniform float u_intensity;
uniform float u_flameHeight;
uniform int u_quality; // FBM octaves: 2 (low) to 4 (high)

// ============================================================
// Gradient noise (smoother than value noise for organic shapes)
// ============================================================

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float gradientNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  // Quintic Hermite interpolation (C2 continuous)
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float a = dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
  float b = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// ============================================================
// FBM with domain warping for turbulent fire
// ============================================================

float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  // Rotation matrix per octave prevents axis-aligned artifacts
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);

  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    value += amplitude * gradientNoise(p * frequency);
    p = rot * p; // rotate domain each octave
    frequency *= 2.1;
    amplitude *= 0.48;
  }
  return value;
}

float turbulentFbm(vec2 p, float time, int octaves) {
  // Domain warp: displace input coordinates with noise
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0), octaves),
    fbm(p + vec2(5.2, 1.3), octaves)
  );

  // Second warp layer with time-driven animation
  vec2 r = vec2(
    fbm(p + 3.0 * q + vec2(1.7, 9.2) + 0.12 * time, octaves),
    fbm(p + 3.0 * q + vec2(8.3, 2.8) + 0.10 * time, octaves)
  );

  return fbm(p + 3.5 * r, octaves);
}

// ============================================================
// Fire color: blackbody-inspired temperature mapping
// ============================================================

vec4 fireColor(float temperature, float density) {
  // temperature: 0 = cool edge, 1 = hot center
  // density: overall opacity/brightness

  // Blackbody color ramp
  vec3 col;
  if (temperature > 0.8) {
    // White-hot core
    col = mix(vec3(1.0, 0.85, 0.3), vec3(1.0, 0.95, 0.85), (temperature - 0.8) * 5.0);
  } else if (temperature > 0.55) {
    // Yellow-orange
    col = mix(vec3(1.0, 0.45, 0.02), vec3(1.0, 0.85, 0.3), (temperature - 0.55) * 4.0);
  } else if (temperature > 0.3) {
    // Orange-red
    col = mix(vec3(0.7, 0.12, 0.0), vec3(1.0, 0.45, 0.02), (temperature - 0.3) * 4.0);
  } else {
    // Dark red to transparent
    col = vec3(0.7, 0.12, 0.0) * (temperature / 0.3);
  }

  // Alpha: soft falloff, boosted at hot center
  float alpha = smoothstep(0.0, 0.15, temperature) * density;
  alpha *= alpha; // square for softer edge

  // Premultiplied alpha output
  return vec4(col * alpha, alpha);
}

// ============================================================
// Per-tip fire computation
// ============================================================

vec4 computeFireForTip(
  vec2 fragCoord,
  vec2 tipPos,
  vec2 tipVelocity,
  float tipSpeed,
  float time,
  float intensity,
  float flameHeight,
  int quality
) {
  vec2 delta = fragCoord - tipPos;

  // Normalize speed: 500 px/s = fully reactive
  // Real fire spinning generates 200-800 px/s in viewbox coordinates
  float speed01 = clamp(tipSpeed / 500.0, 0.0, 1.0);
  float speedSq = speed01 * speed01; // quadratic response feels more natural

  // Flame dimensions scale with speed
  float baseRadius = 15.0 + 20.0 * speed01;
  float height = flameHeight * (30.0 + 50.0 * speed01);

  // Early distance cull (generous bound to allow noise distortion)
  float maxDist = max(baseRadius, height) * 1.8;
  if (abs(delta.x) > maxDist || abs(delta.y) > maxDist) return vec4(0.0);
  float distSq = dot(delta, delta);
  if (distSq > maxDist * maxDist) return vec4(0.0);

  // Rotate fire so "up" opposes velocity direction
  float angle;
  if (tipSpeed > 5.0) {
    angle = atan(-tipVelocity.y, -tipVelocity.x);
  } else {
    angle = -1.5707963; // -PI/2: straight up
  }

  float cosA = cos(angle);
  float sinA = sin(angle);
  vec2 rotated = vec2(
    delta.x * cosA + delta.y * sinA,
    -delta.x * sinA + delta.y * cosA
  );

  // Normalized fire-space coordinates
  float fx = rotated.x / baseRadius;       // lateral: [-1, 1] at base
  float fy = rotated.y / height;           // vertical: 0 = tip, 1 = top of flame

  // Soft bounds with noise distortion
  if (fy < -0.15 || fy > 1.3) return vec4(0.0);

  // ---- Noise sampling (the soul of the fire) ----
  // Scroll noise upward (fire rises), scale with time
  vec2 noiseCoord = vec2(
    fx * 2.5,
    fy * 3.0 - time * 3.0 // upward scroll speed
  );
  // Add speed-driven turbulence: faster spin = more chaotic fire
  float turb = turbulentFbm(noiseCoord + speed01 * 0.5, time, quality);

  // Secondary noise for shape distortion (different frequency)
  float shapeNoise = gradientNoise(vec2(fx * 4.0, fy * 5.0 - time * 4.5)) * 0.3;

  // ---- Flame shape ----
  // Width tapers with height (organic cone, not geometric)
  float taper = 1.0 - pow(clamp(fy, 0.0, 1.0), 0.7);
  // Noise-distorted width boundary
  float effectiveWidth = taper * (0.7 + 0.3 * (turb + 0.5)) + shapeNoise;

  // Soft lateral falloff (Gaussian-like, not hard cutoff)
  float lateralFalloff = exp(-2.5 * (fx * fx) / max(effectiveWidth * effectiveWidth, 0.01));

  // Vertical falloff: fade in at base, fade out at top
  float vertFadeIn = smoothstep(-0.1, 0.08, fy);
  float vertFadeOut = smoothstep(1.1, 0.4, fy);
  float verticalMask = vertFadeIn * vertFadeOut;

  // ---- Combine into fire density ----
  // Remap noise to [0,1] range
  float noiseMapped = clamp(turb * 0.5 + 0.5, 0.0, 1.0);

  float density = noiseMapped * lateralFalloff * verticalMask;

  // Speed boosts brightness and adds flickering
  float speedBrightness = 0.5 + 0.5 * speed01;
  float flicker = 1.0 + 0.15 * sin(time * 12.0 + tipPos.x * 0.1) * speed01;

  density *= intensity * speedBrightness * flicker;

  // Threshold: only render meaningful fire
  if (density < 0.01) return vec4(0.0);

  // Temperature: hotter at center/base, cooler at edges/top
  float temperature = density * (1.0 - fy * 0.6);

  return fireColor(temperature, density);
}

// ============================================================
// Main
// ============================================================

void main() {
  vec2 fragCoord = v_uv * u_resolution;

  vec4 totalColor = vec4(0.0);

  for (int i = 0; i < 8; i++) {
    if (i >= u_tipCount) break;

    vec4 tipFire = computeFireForTip(
      fragCoord,
      u_tipPositions[i],
      u_tipVelocities[i],
      u_tipSpeeds[i],
      u_time,
      u_intensity,
      u_flameHeight,
      u_quality
    );

    // Premultiplied alpha compositing (source-over, not additive)
    totalColor.rgb += tipFire.rgb * (1.0 - totalColor.a);
    totalColor.a += tipFire.a * (1.0 - totalColor.a);
  }

  // Clamp to valid range
  totalColor = clamp(totalColor, vec4(0.0), vec4(1.0));

  fragColor = totalColor;
}
`;
