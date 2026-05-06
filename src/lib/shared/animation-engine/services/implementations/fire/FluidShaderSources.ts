/**
 * FluidShaderSources
 *
 * GLSL 300 es shader programs for a multi-pass Navier-Stokes fluid simulation
 * with combustion, buoyancy, and blackbody rendering.
 *
 * Architecture: Each frame runs ~30 draw calls through this pipeline:
 *   1. Splat injection (fuel + velocity at tip positions)
 *   2. Velocity self-advection
 *   3. Curl computation → vorticity confinement
 *   4. Buoyancy (temperature drives upward force)
 *   5. Combustion (fuel → heat) + cooling
 *   6. Divergence of velocity
 *   7. Jacobi pressure iterations (20-40x)
 *   8. Gradient subtraction (pressure → velocity correction)
 *   9. Temperature + fuel advection through velocity field
 *   10. Display render (temperature → blackbody color)
 *
 * References:
 *   - GPU Gems Ch. 38 (Harris, 2004)
 *   - "Simulating Fluids, Fire, and Smoke in Real-Time" (Andrew Chan)
 *   - Pavel Dobryakov's WebGL-Fluid-Simulation
 */

// ============================================================
// Shared vertex shader: fullscreen quad via gl_VertexID
// ============================================================

export const VERTEX_SHADER = `#version 300 es
precision highp float;

const vec2 POSITIONS[6] = vec2[6](
  vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
  vec2(-1.0,  1.0), vec2(1.0, -1.0), vec2(1.0,  1.0)
);

out vec2 v_uv;

void main() {
  vec2 pos = POSITIONS[gl_VertexID];
  v_uv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

// ============================================================
// Splat: inject a Gaussian blob of value at a point.
// Used to add fuel, velocity, and temperature at tip positions.
// ============================================================

export const SPLAT_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_target;    // existing field to add into
uniform vec2 u_point;          // splat center in [0,1] UV space
uniform vec3 u_splatValue;     // value to inject (rgb or rg for velocity)
uniform float u_radius;        // Gaussian radius in UV space

void main() {
  vec4 existing = texture(u_target, v_uv);
  vec2 delta = v_uv - u_point;
  float dist2 = dot(delta, delta);
  float splat = exp(-dist2 / (u_radius * u_radius));
  fragColor = existing + vec4(u_splatValue * splat, 0.0);
}
`;

// ============================================================
// Advection: Semi-Lagrangian backtracing.
// Moves a field (velocity, temperature, fuel) through the velocity field.
// ============================================================

export const ADVECTION_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_velocity;  // velocity field
uniform sampler2D u_source;    // field to advect (can be velocity itself)
uniform vec2 u_texelSize;      // 1.0 / simResolution
uniform float u_dt;            // timestep
uniform float u_dissipation;   // decay factor (0.99 = slow fade, 0.9 = fast fade)

void main() {
  vec2 vel = texture(u_velocity, v_uv).xy;
  // Backtrace: where did this fluid come from?
  vec2 prevUV = v_uv - u_dt * vel * u_texelSize;
  fragColor = u_dissipation * texture(u_source, prevUV);
}
`;

// ============================================================
// Curl: compute the scalar curl (vorticity) of 2D velocity field.
// curl = dVy/dx - dVx/dy
// ============================================================

export const CURL_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_velocity;
uniform vec2 u_texelSize;

void main() {
  float vL = texture(u_velocity, v_uv - vec2(u_texelSize.x, 0.0)).y;
  float vR = texture(u_velocity, v_uv + vec2(u_texelSize.x, 0.0)).y;
  float vB = texture(u_velocity, v_uv - vec2(0.0, u_texelSize.y)).x;
  float vT = texture(u_velocity, v_uv + vec2(0.0, u_texelSize.y)).x;
  float curl = (vR - vL) - (vT - vB);
  fragColor = vec4(curl * 0.5, 0.0, 0.0, 1.0);
}
`;

// ============================================================
// Vorticity confinement: restore small-scale rotational detail
// lost to numerical diffusion. Adds force along curl gradient.
// ============================================================

export const VORTICITY_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_velocity;
uniform sampler2D u_curl;
uniform vec2 u_texelSize;
uniform float u_dt;
uniform float u_strength;    // vorticity confinement coefficient
uniform float u_time;        // seconds, for flickering pulse

void main() {
  float cL = texture(u_curl, v_uv - vec2(u_texelSize.x, 0.0)).x;
  float cR = texture(u_curl, v_uv + vec2(u_texelSize.x, 0.0)).x;
  float cB = texture(u_curl, v_uv - vec2(0.0, u_texelSize.y)).x;
  float cT = texture(u_curl, v_uv + vec2(0.0, u_texelSize.y)).x;
  float cC = texture(u_curl, v_uv).x;

  // Gradient of absolute curl
  vec2 grad = vec2(abs(cR) - abs(cL), abs(cT) - abs(cB)) * 0.5;
  float len = max(length(grad), 1e-5);
  vec2 N = grad / len;

  // Time-varying vorticity pulse: real flames flicker at ~10-15 Hz due to
  // periodic vortex shedding. Modulating the confinement strength at this
  // frequency creates a natural pulsing amplification of rotational detail
  // that matches the physical vortex shedding cycle.
  float pulse = 1.0 + 0.4 * sin(u_time * 2.0 * 3.14159 * 12.0)   // ~12 Hz primary
                     + 0.2 * sin(u_time * 2.0 * 3.14159 * 7.3);  // ~7 Hz secondary

  // Force perpendicular to curl gradient
  vec2 force = u_strength * pulse * vec2(N.y, -N.x) * cC;

  vec2 vel = texture(u_velocity, v_uv).xy;
  fragColor = vec4(vel + force * u_dt, 0.0, 1.0);
}
`;

// ============================================================
// Buoyancy: hot fluid rises, cool fluid sinks.
// Applies vertical force proportional to temperature.
// ============================================================

export const BUOYANCY_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_velocity;
uniform sampler2D u_temperature;
uniform float u_dt;
uniform float u_buoyancy;          // buoyancy strength
uniform float u_ambientTemp;       // baseline temperature
uniform float u_terminalVelocity;  // max velocity magnitude from buoyancy/gravity
uniform float u_gravity;           // constant vertical force (negative = downward)

void main() {
  vec2 vel = texture(u_velocity, v_uv).xy;
  float temp = texture(u_temperature, v_uv).x;

  // Buoyancy force: upward (+Y in UV space) proportional to temperature above ambient
  float buoyForce = u_buoyancy * (temp - u_ambientTemp);

  // Gravity: constant vertical force on any heated fluid.
  // Only acts on fluid with some temperature (prevents drift in empty space).
  float gravForce = u_gravity * step(0.01, temp);

  float totalForce = buoyForce + gravForce;

  // Terminal velocity: attenuate force when velocity is already moving in the
  // same direction as the force, preventing runaway accumulation.
  // Works symmetrically for both upward (buoyancy) and downward (gravity) forces.
  float speedInForceDir = sign(totalForce) * vel.y;
  float attenuation = max(0.0, 1.0 - speedInForceDir / u_terminalVelocity);
  vel.y += totalForce * attenuation * u_dt;

  fragColor = vec4(vel, 0.0, 1.0);
}
`;

// ============================================================
// Curl noise turbulence: divergence-free velocity perturbation
// that targets flame boundaries (where temperature gradient is steep).
//
// Real fire flickers because buoyancy-driven shear layers (hot rising
// gas next to cool ambient air) trigger Kelvin-Helmholtz instability.
// On a coarse grid, numerical dissipation kills this instability before
// it can grow. Curl noise injects physically-plausible vorticity at the
// flame boundary to compensate - divergence-free by construction, so
// the pressure solver passes it through untouched.
//
// Reference: Bridson et al., "Curl-Noise for Procedural Fluid Flow"
// (SIGGRAPH 2007)
// ============================================================

export const CURL_NOISE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_velocity;
uniform sampler2D u_temperature;
uniform vec2 u_texelSize;
uniform float u_dt;
uniform float u_time;
uniform float u_strength;      // curl noise amplitude

// 2D gradient noise (Perlin-style) - less blocky than value noise,
// avoids the axis-aligned artifacts that look artificial in fire.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 gradHash(vec2 p) {
  float h = hash(p);
  float angle = h * 6.2831853;
  return vec2(cos(angle), sin(angle));
}

float gradientNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float n00 = dot(gradHash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
  float n10 = dot(gradHash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float n01 = dot(gradHash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float n11 = dot(gradHash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));

  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
}

// 3-octave FBM of gradient noise, used as a scalar potential field.
// The curl of this field gives us divergence-free velocity.
float noisePotential(vec2 p, float time) {
  float n = 0.0;
  float amp = 0.5;
  float freq = 5.0;
  // Scroll with time so the turbulence evolves. Different speeds per
  // octave prevent visible repetition.
  vec2 drift = vec2(time * 0.6, time * 0.9);
  for (int i = 0; i < 3; i++) {
    n += amp * gradientNoise(p * freq + drift);
    freq *= 2.2;
    amp *= 0.45;
    drift *= 1.5;
  }
  return n;
}

void main() {
  vec2 vel = texture(u_velocity, v_uv).xy;
  float temp = texture(u_temperature, v_uv).x;

  // Compute temperature gradient magnitude - this tells us where
  // the flame boundary is (steep gradient = hot/cold interface).
  float tL = texture(u_temperature, v_uv - vec2(u_texelSize.x, 0.0)).x;
  float tR = texture(u_temperature, v_uv + vec2(u_texelSize.x, 0.0)).x;
  float tB = texture(u_temperature, v_uv - vec2(0.0, u_texelSize.y)).x;
  float tT = texture(u_temperature, v_uv + vec2(0.0, u_texelSize.y)).x;
  float gradMag = length(vec2(tR - tL, tT - tB)) * 0.5;

  // Spatial mask: turbulence is strongest at the flame boundary
  // (high temperature gradient) and fades to zero in uniform regions.
  // Also require some heat so we don't perturb empty space.
  float boundaryMask = smoothstep(0.0, 0.8, gradMag * 6.0);
  float heatMask = smoothstep(0.0, 0.15, temp);
  float mask = boundaryMask * heatMask;

  if (mask > 0.001) {
    // Curl of the noise potential: in 2D, curl(psi) = (dpsi/dy, -dpsi/dx).
    // Finite-difference the potential field to get divergence-free velocity.
    float eps = 0.003; // finite difference step in UV space
    float psiR = noisePotential(v_uv + vec2(eps, 0.0), u_time);
    float psiL = noisePotential(v_uv - vec2(eps, 0.0), u_time);
    float psiT = noisePotential(v_uv + vec2(0.0, eps), u_time);
    float psiB = noisePotential(v_uv - vec2(0.0, eps), u_time);

    float dpdx = (psiR - psiL) / (2.0 * eps);
    float dpdy = (psiT - psiB) / (2.0 * eps);

    // curl(psi) = (dpsi/dy, -dpsi/dx)
    vec2 curlForce = vec2(dpdy, -dpdx);

    vel += curlForce * u_strength * mask * u_dt;
  }

  fragColor = vec4(vel, 0.0, 1.0);
}
`;

// ============================================================
// Combustion + Cooling: fuel burns to produce heat,
// temperature decays via Stefan-Boltzmann-inspired cooling.
// Packed: temperature.x = temperature, fuel stored separately.
// ============================================================

export const COMBUSTION_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_temperature;
uniform sampler2D u_fuel;
uniform float u_dt;
uniform float u_burnRate;       // how fast fuel converts to heat
uniform float u_burnTemp;       // temperature at which fuel ignites
uniform float u_fuelEfficiency; // heat produced per unit fuel burned
uniform float u_coolingRate;    // radiative cooling coefficient
uniform float u_ambientTemp;    // baseline temperature

// Writes ONLY the updated temperature. Fuel decays via advection dissipation.
// This avoids the channel-swizzle problem of packing both into one FBO.

void main() {
  float temp = texture(u_temperature, v_uv).x;
  float fuel = texture(u_fuel, v_uv).x;

  // Combustion: fuel contributes heat proportional to its density
  float burnAmount = 0.0;
  if (temp > u_burnTemp && fuel > 0.0) {
    burnAmount = min(fuel, u_burnRate * u_dt);
  }

  // Spontaneous combustion for freshly injected fuel (bootstrap ignition)
  if (fuel > 0.5) {
    burnAmount = max(burnAmount, min(fuel * 0.3, u_burnRate * u_dt * 2.0));
  }

  float newTemp = temp + burnAmount * u_fuelEfficiency;

  // Radiative cooling toward ambient
  float cooling = u_coolingRate * (newTemp - u_ambientTemp) * u_dt;
  newTemp = max(u_ambientTemp, newTemp - cooling);

  fragColor = vec4(newTemp, 0.0, 0.0, 1.0);
}
`;

// ============================================================
// Divergence: compute velocity field divergence for pressure solve.
// div(v) = dVx/dx + dVy/dy
// ============================================================

export const DIVERGENCE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_velocity;
uniform vec2 u_texelSize;

void main() {
  float vL = texture(u_velocity, v_uv - vec2(u_texelSize.x, 0.0)).x;
  float vR = texture(u_velocity, v_uv + vec2(u_texelSize.x, 0.0)).x;
  float vB = texture(u_velocity, v_uv - vec2(0.0, u_texelSize.y)).y;
  float vT = texture(u_velocity, v_uv + vec2(0.0, u_texelSize.y)).y;
  float divergence = 0.5 * ((vR - vL) + (vT - vB));
  fragColor = vec4(divergence, 0.0, 0.0, 1.0);
}
`;

// ============================================================
// Jacobi iteration: iteratively solve pressure Poisson equation.
// Laplacian(p) = divergence(v)
// Each iteration relaxes toward the solution.
// ============================================================

export const JACOBI_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
uniform vec2 u_texelSize;

void main() {
  float pL = texture(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)).x;
  float pR = texture(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)).x;
  float pB = texture(u_pressure, v_uv - vec2(0.0, u_texelSize.y)).x;
  float pT = texture(u_pressure, v_uv + vec2(0.0, u_texelSize.y)).x;
  float div = texture(u_divergence, v_uv).x;

  // Jacobi iteration: p_new = (sum of neighbors - divergence) / 4
  float pressure = (pL + pR + pB + pT - div) * 0.25;
  fragColor = vec4(pressure, 0.0, 0.0, 1.0);
}
`;

// ============================================================
// Gradient subtraction: make velocity divergence-free.
// v_new = v - gradient(pressure)
// ============================================================

export const GRADIENT_SUBTRACT_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_velocity;
uniform sampler2D u_pressure;
uniform vec2 u_texelSize;

void main() {
  float pL = texture(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)).x;
  float pR = texture(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)).x;
  float pB = texture(u_pressure, v_uv - vec2(0.0, u_texelSize.y)).x;
  float pT = texture(u_pressure, v_uv + vec2(0.0, u_texelSize.y)).x;

  vec2 vel = texture(u_velocity, v_uv).xy;
  vel -= 0.5 * vec2(pR - pL, pT - pB);
  fragColor = vec4(vel, 0.0, 1.0);
}
`;

// ============================================================
// Clear: fill a texture with a uniform value.
// ============================================================

export const CLEAR_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec4 u_clearValue;

void main() {
  fragColor = u_clearValue;
}
`;

// ============================================================
// Display: two-layer fire rendering.
//   Layer 1: Fluid sim trail (wake behind the moving wick)
//   Layer 2: Wick cores (always-bright flame at each tip position)
//
// The wick itself is always on fire - constant bright flame.
// Speed only affects how long the trailing wake extends behind it.
// ============================================================

export const DISPLAY_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_temperature;
uniform sampler2D u_fuel;
uniform sampler2D u_colorField;
uniform float u_displayIntensity;
uniform float u_colorBlend; // 0.0 = natural, 0.5 = tinted, 1.0 = colored
uniform float u_time;       // seconds, for FBM noise animation

// Per-fuel-source color curve (replaces hardcoded blackbody ramp)
uniform vec3 u_colorCold;   // FireColorCurve.coldColor
uniform vec3 u_colorMid;    // FireColorCurve.midColor
uniform vec3 u_colorHot;    // FireColorCurve.hotColor
uniform vec3 u_colorCore;   // FireColorCurve.coreColor

// Wick core rendering uniforms (up to 16 tips for multi-point props like fans)
uniform vec2 u_tipPositions[16];
uniform float u_tipSpeeds[16];
uniform float u_tipFlameScales[16];
uniform vec3 u_tipColors[16];
uniform int u_tipCount;
uniform vec2 u_aspectCorrect;

// ---- FBM noise for high-frequency fire detail ----
// Adds flickering that the low-res simulation grid can't capture.
// 2D value noise with smooth interpolation.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep interpolation
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// 3-octave FBM scrolling upward to match fire's natural rise.
// Returns value in [0, 1] range.
float fireNoise(vec2 uv, float time) {
  float n = 0.0;
  float amp = 0.5;
  float freq = 8.0;
  // Scroll upward: fire rises, noise moves with it
  vec2 scroll = vec2(0.0, -time * 1.5);
  for (int i = 0; i < 3; i++) {
    n += amp * valueNoise(uv * freq + scroll);
    freq *= 2.2;
    amp *= 0.45;
    scroll *= 1.8;
  }
  return n;
}

// Natural fire color ramp driven by per-fuel-source uniforms
vec3 blackbodyColor(float t) {
  vec3 color;
  if (t < 0.4) {
    color = u_colorCold * (t / 0.4);
  } else if (t < 1.0) {
    float f = (t - 0.4) / 0.6;
    color = mix(u_colorCold, u_colorMid, f);
  } else if (t < 2.0) {
    float f = (t - 1.0);
    color = mix(u_colorMid, u_colorHot, f);
  } else if (t < 3.5) {
    float f = (t - 2.0) / 1.5;
    color = mix(u_colorHot, u_colorCore, f);
  } else {
    float f = clamp((t - 3.5) / 2.0, 0.0, 1.0);
    color = mix(u_colorCore, vec3(1.0, 0.98, 0.9), f);
  }
  return color;
}

// Fully colored blackbody: temperature ramp entirely in prop color.
// Same fire structure, different palette. Hot core stays white.
vec3 coloredBlackbody(float t, vec3 propColor) {
  vec3 darkBase = propColor * 0.15;
  vec3 brightMid = propColor;
  vec3 hotCore = mix(propColor, vec3(1.0), 0.7);

  vec3 color;
  if (t < 0.4) {
    color = darkBase * (t / 0.4);
  } else if (t < 1.0) {
    float f = (t - 0.4) / 0.6;
    color = mix(darkBase, brightMid * 0.6, f);
  } else if (t < 2.0) {
    float f = (t - 1.0);
    color = mix(brightMid * 0.6, brightMid, f);
  } else if (t < 3.5) {
    float f = (t - 2.0) / 1.5;
    color = mix(brightMid, hotCore, f);
  } else {
    float f = clamp((t - 3.5) / 2.0, 0.0, 1.0);
    color = mix(hotCore, vec3(1.0, 0.98, 0.95), f);
  }
  return color;
}

void main() {
  float temp = texture(u_temperature, v_uv).x;
  float fuel = texture(u_fuel, v_uv).x;

  vec3 color = vec3(0.0);
  float alpha = 0.0;

  // --- Layer 1: Fluid sim trail ---
  float fireIntensity = temp + fuel * 0.5;
  fireIntensity *= u_displayIntensity;

  // FBM noise detail: modulate intensity for high-frequency flickering.
  // Only applied where fire already exists (noise never creates fire).
  // The 0.7 + 0.3 * noise range means intensity varies ±15% around baseline,
  // enough for visible flicker without overwhelming the simulation.
  if (fireIntensity > 0.05) {
    float noise = fireNoise(v_uv, u_time);
    fireIntensity *= 0.7 + 0.3 * noise;
  }

  if (fireIntensity > 0.1) {
    vec3 trailColor;
    if (u_colorBlend > 0.01) {
      vec3 fieldColor = texture(u_colorField, v_uv).rgb;
      float maxC = max(fieldColor.r, max(fieldColor.g, fieldColor.b));
      if (maxC > 0.01) {
        fieldColor /= maxC;
      }
      vec3 natural = blackbodyColor(fireIntensity);
      vec3 colored = coloredBlackbody(fireIntensity, fieldColor);
      trailColor = mix(natural, colored, u_colorBlend);
    } else {
      trailColor = blackbodyColor(fireIntensity);
    }
    float trailAlpha = smoothstep(0.1, 0.8, fireIntensity);
    color = trailColor * trailAlpha;
    alpha = trailAlpha;
  }

  // --- Layer 2: Wick cores ---
  for (int i = 0; i < 16; i++) {
    if (i >= u_tipCount) break;

    float fs = u_tipFlameScales[i];
    vec2 delta = (v_uv - u_tipPositions[i]) * u_aspectCorrect;
    float dist2 = dot(delta, delta);

    // Wick tip color: blend from fuel-source hot color toward prop color
    vec3 tipColor = mix(u_colorHot, u_tipColors[i], u_colorBlend);

    // Inner core: white-hot center (always white regardless of mode)
    float coreR = 0.006 * fs;
    float coreR2 = coreR * coreR;
    float core = exp(-dist2 / coreR2);
    vec3 coreColor = vec3(1.0, 0.95, 0.85) * core * 4.0 * u_displayIntensity;

    // Middle flame body
    float bodyR = 0.018 * fs;
    float bodyR2 = bodyR * bodyR;
    float body = exp(-dist2 / bodyR2);
    vec3 bodyColor = tipColor * body * 2.5 * u_displayIntensity;

    // Outer glow
    float glowR = 0.035 * fs;
    float glowR2 = glowR * glowR;
    float glow = exp(-dist2 / glowR2);
    vec3 glowTint = mix(u_colorMid, u_tipColors[i] * 0.4, u_colorBlend);
    vec3 glowColor = glowTint * glow * 1.2 * u_displayIntensity;

    color += coreColor + bodyColor + glowColor;
    alpha = max(alpha, max(core, max(body * 0.9, glow * 0.5)));
  }

  alpha = min(alpha, 1.0);
  fragColor = vec4(color * alpha, alpha);
}
`;

// ============================================================
// Bloom composite: scene + bloom → final output
// Combines the fire display pass with the bloom mip chain.
// ============================================================

export const BLOOM_COMPOSITE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_bloomStrength;

void main() {
  vec4 scene = texture(u_scene, v_uv);
  vec4 bloom = texture(u_bloom, v_uv);

  vec4 combined = scene + bloom * u_bloomStrength;

  float a = min(combined.a, 1.0);
  fragColor = vec4(min(combined.rgb, vec3(a)), a);
}
`;
