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

  // Force perpendicular to curl gradient
  vec2 force = u_strength * vec2(N.y, -N.x) * cC;

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
uniform float u_buoyancy;      // buoyancy strength
uniform float u_ambientTemp;   // baseline temperature

void main() {
  vec2 vel = texture(u_velocity, v_uv).xy;
  float temp = texture(u_temperature, v_uv).x;

  // Buoyancy force: upward (+Y in UV space) proportional to temperature above ambient
  float force = u_buoyancy * (temp - u_ambientTemp);

  // Add a slight lateral wobble from temperature for organic motion
  vel.y += force * u_dt;

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
// The wick itself is always on fire — constant bright flame.
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

// Wick core rendering uniforms (up to 16 tips for multi-point props like fans)
uniform vec2 u_tipPositions[16];
uniform float u_tipSpeeds[16];
uniform float u_tipFlameScales[16];
uniform vec3 u_tipColors[16];
uniform int u_tipCount;
uniform vec2 u_aspectCorrect;

// Standard blackbody for natural fire
vec3 blackbodyColor(float t) {
  vec3 color;
  if (t < 0.4) {
    color = vec3(0.2, 0.02, 0.0) * (t / 0.4);
  } else if (t < 1.0) {
    float f = (t - 0.4) / 0.6;
    color = mix(vec3(0.2, 0.02, 0.0), vec3(0.9, 0.15, 0.0), f);
  } else if (t < 2.0) {
    float f = (t - 1.0);
    color = mix(vec3(0.9, 0.15, 0.0), vec3(1.0, 0.55, 0.05), f);
  } else if (t < 3.5) {
    float f = (t - 2.0) / 1.5;
    color = mix(vec3(1.0, 0.55, 0.05), vec3(1.0, 0.9, 0.35), f);
  } else {
    float f = clamp((t - 3.5) / 2.0, 0.0, 1.0);
    color = mix(vec3(1.0, 0.9, 0.35), vec3(1.0, 0.98, 0.9), f);
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

    // Wick tip color: blend from natural orange toward prop color
    vec3 tipColor = mix(vec3(1.0, 0.65, 0.12), u_tipColors[i], u_colorBlend);

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
    vec3 glowTint = mix(vec3(0.9, 0.25, 0.02), u_tipColors[i] * 0.4, u_colorBlend);
    vec3 glowColor = glowTint * glow * 1.2 * u_displayIntensity;

    color += coreColor + bodyColor + glowColor;
    alpha = max(alpha, max(core, max(body * 0.9, glow * 0.5)));
  }

  alpha = min(alpha, 1.0);
  fragColor = vec4(color * alpha, alpha);
}
`;
